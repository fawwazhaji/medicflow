"use strict";

let patientServiceWorkerRegistration = null;

async function loadRoleData() {
    if (state.role === "pasien") {
        const results = await Promise.all([
            request("pasien/me"), request("pasien/pendaftaran"), request("jadwal-dokter"),
            request("pasien/riwayat-klinis"),
            request("pasien/pemeriksaan"), request("pasien/resep"), request("pasien/notifikasi")
        ]);
        state.data = { profile: results[0].data, appointments: results[1].data || [], schedules: results[2].data || [], clinicalHistory: results[3].data || {}, examinations: results[4].data || [], prescriptions: results[5].data || [], notifications: results[6].data || [] };
        if (state.data.profile.nama_lengkap) document.getElementById("userName").textContent = state.data.profile.nama_lengkap;
    } else if (state.role === "dokter") {
        const results = await Promise.all([
            request("dokter/antrian"), request("dokter/antrian/riwayat"),
            request("dokter/jadwal"), request("dokter/pemeriksaan"), request("dokter/obat")
        ]);
        state.data = { queue: results[0].data || [], queueHistory: results[1].data || [], schedules: results[2].data || [], examinations: results[3].data || [], medicines: results[4].data || [] };
    } else if (state.role === "perawat") {
        const result = await request("perawat/antrian");
        state.data = { queue: result.data || [] };
    } else if (state.role === "farmasi") {
        const results = await Promise.all([
            request("farmasi/obat"), request("farmasi/resep"), request("farmasi/mutasi-stok")
        ]);
        state.data = { medicines: results[0].data || [], recipes: results[1].data || [], mutations: results[2].data || [] };
    } else if (state.role === "admin") {
        const resources = ["users", "pasien", "dokter", "obat", "pendaftaran", "pemeriksaan", "resep", "poliklinik"];
        const results = await Promise.all(resources.map(function (resource) { return request("admin/" + resource); }));
        const counts = {};
        resources.forEach(function (resource, index) { counts[resource] = (results[index].data || []).length; });
        const staff = await Promise.all([request("admin/users"), request("admin/dokter"), request("admin/poliklinik")]);
        const activityLogs = await request("admin/log-aktivitas");
        state.data = {
            counts: counts,
            resource: "users",
            resourceItems: results[0].data || [],
            staffUsers: staff[0].data || [],
            staffDoctors: staff[1].data || [],
            staffClinics: staff[2].data || [],
            activityLogs: activityLogs.data || [],
            staffRole: "semua"
        };
    }
}

async function loadAdminResource(resource) {
    const results = await Promise.all([
        request("admin/" + resource),
        request("admin/log-aktivitas")
    ]);
    state.data.resource = resource;
    state.data.resourceItems = results[0].data || [];
    state.data.activityLogs = results[1].data || [];
    renderPage();
}

function renderPage() {
    renderNav();
    const content = document.getElementById("dashboardContent");
    if (!state.role || !roleMenus[state.role]) {
        content.innerHTML = '<div class="empty-state">Akun tidak memiliki peran yang dikenali.</div>';
        return;
    }
    if (state.role === "pasien") content.innerHTML = renderPatient();
    if (state.role === "dokter") content.innerHTML = renderDoctor();
    if (state.role === "perawat") content.innerHTML = renderNurse();
    if (state.role === "farmasi") content.innerHTML = renderPharmacy();
    if (state.role === "admin") content.innerHTML = renderAdmin();
    bindPageActions();
}

async function refreshPage(message) {
    stopCamera();
    await loadRoleData();
    renderPage();
    if (message) showToast(message, false);
}

async function refreshPatientUpdates() {
    if (state.role !== "pasien") return;

    try {
        const results = await Promise.all([
            request("pasien/pendaftaran"),
            request("pasien/notifikasi"),
            request("pasien/resep")
        ]);
        const appointments = results[0].data || [];
        const notifications = results[1].data || [];
        const prescriptions = results[2].data || [];
        const appointmentsChanged = JSON.stringify(appointments) !== JSON.stringify(state.data.appointments || []);
        const notificationsChanged = JSON.stringify(notifications) !== JSON.stringify(state.data.notifications || []);
        const prescriptionsChanged = JSON.stringify(prescriptions) !== JSON.stringify(state.data.prescriptions || []);
        const newNotifications = notifications.filter(function (item) {
            return !patientNotificationIds.has(String(item.id_notifikasi));
        });

        patientNotificationIds = new Set(notifications.map(function (item) {
            return String(item.id_notifikasi);
        }));
        state.data.appointments = appointments;
        state.data.notifications = notifications;
        state.data.prescriptions = prescriptions;
        patientPollingErrorShown = false;

        if (newNotifications.length) {
            const latest = newNotifications[0];
            showToast(latest.pesan || "Ada notifikasi baru dari MedicFlow.", false);
            for (const notification of newNotifications.slice(0, 3).reverse()) {
                await showDeviceNotification(notification);
            }
        }
        const appointmentForm = state.page === "appointments" && document.getElementById("appointmentForm");
        const hasUnsavedAppointment = appointmentForm && Object.keys(formObject(appointmentForm)).length > 0;
        const historyFilterFocused = document.activeElement && document.activeElement.closest && document.activeElement.closest(".history-filters");
        const shouldRender = (state.page === "overview" && (appointmentsChanged || notificationsChanged)) ||
            (state.page === "notifications" && notificationsChanged) ||
            (state.page === "prescriptions" && (prescriptionsChanged || notificationsChanged)) ||
            (state.page === "appointments" && (appointmentsChanged || notificationsChanged) && !hasUnsavedAppointment);
        if (shouldRender && historyFilterFocused && state.page === "appointments") renderAppointmentHistoryResults();
        else if (shouldRender) renderPage();
    } catch (error) {
        if (!patientPollingErrorShown) showToast(error.message, true);
        patientPollingErrorShown = true;
    }
}

function startPatientUpdates() {
    if (patientUpdateTimer !== null) window.clearInterval(patientUpdateTimer);
    patientNotificationIds = new Set((state.data.notifications || []).map(function (item) {
        return String(item.id_notifikasi);
    }));
    patientUpdateTimer = window.setInterval(refreshPatientUpdates, 10000);
}

async function showDeviceNotification(item) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const titles = {
        "Pasien Dipanggil": ["Dokter memanggil Anda", "Silakan buka MedicFlow untuk melihat pembaruan kunjungan."],
        "Pasien Masuk Ruangan": ["Anda masuk ruang pemeriksaan", "Dokter mengonfirmasi kunjungan Anda. Silakan ikuti arahan petugas."],
        "Obat Siap": ["Obat siap diambil", "Buka MedicFlow untuk melihat informasi pengambilan obat."]
    };
    const notificationContent = titles[item.jenis_notifikasi] || [
        "Pembaruan MedicFlow",
        "Ada informasi baru. Buka MedicFlow untuk melihat detailnya."
    ];

    try {
        if (patientServiceWorkerRegistration && typeof patientServiceWorkerRegistration.showNotification === "function") {
            await patientServiceWorkerRegistration.showNotification(notificationContent[0], {
                body: notificationContent[1],
                tag: "medicflow-" + String(item.id_notifikasi),
                renotify: false,
                data: { url: window.MEDICFLOW_APP_URL }
            });
            return;
        }

        const notification = new Notification(notificationContent[0], {
            body: notificationContent[1],
            tag: "medicflow-" + String(item.id_notifikasi),
            renotify: false
        });
        notification.onclick = function () {
            window.focus();
            notification.close();
            if (state.role === "pasien") {
                state.page = "notifications";
                renderPage();
            }
        };
    } catch (error) {
        showToast("Notifikasi perangkat gagal ditampilkan: " + error.message, true);
    }
}

function handleForm(id, callback) {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        setBusy(button, true);
        try {
            await callback(form);
        } catch (error) {
            showToast(error.message, true);
            setBusy(button, false);
        }
    });
}

function bindCheckInButtons(root) {
    (root || document).querySelectorAll("[data-check-in]").forEach(function (button) {
        button.addEventListener("click", async function () {
            button.disabled = true;
            try {
                const result = await request("pasien/pendaftaran/" + button.dataset.checkIn + "/check-in", { method: "POST", body: {} });
                await refreshPage(result.message || "Check-in berhasil.");
            } catch (error) {
                showToast(error.message, true);
                button.disabled = false;
            }
        });
    });
}

function bindPageActions() {
    if (state.role === "pasien") {
        document.querySelectorAll("[data-enable-device-notifications]").forEach(function (button) {
            button.addEventListener("click", async function () {
                button.disabled = true;
                try {
                    const permission = await Notification.requestPermission();
                    renderPage();
                    if (permission === "granted") {
                        showToast("Notifikasi perangkat berhasil diaktifkan.", false);
                    } else if (permission === "denied") {
                        showToast("Izin notifikasi ditolak. Ubah izin MedicFlow di pengaturan situs browser.", true);
                    }
                } catch (error) {
                    showToast("Izin notifikasi gagal diminta: " + error.message, true);
                    button.disabled = false;
                }
            });
        });
        handleForm("appointmentForm", async function (form) {
            const data = formObject(form);
            data.id_jadwal = Number(data.id_jadwal);
            await request("pasien/pendaftaran", { method: "POST", body: data });
            await refreshPage("Pendaftaran antrean berhasil dibuat.");
        });
        bindCheckInButtons(document);
        bindPatientHistoryFilters();
        handleForm("profileForm", async function (form) {
            await request("pasien/me", { method: "PUT", body: formObject(form) });
            await refreshPage("Profil berhasil diperbarui.");
        });
        document.querySelectorAll("[data-recipe-choice]").forEach(function (button) {
            button.addEventListener("click", async function () {
                button.disabled = true;
                try {
                    await request("pasien/resep/" + button.dataset.recipeChoice + "/pilihan", {
                        method: "PUT", body: { pilihan_penebusan: button.dataset.choice }
                    });
                    await refreshPage("Pilihan penebusan resep berhasil disimpan.");
                } catch (error) { showToast(error.message, true); button.disabled = false; }
            });
        });
        document.querySelectorAll("[data-show-qr]").forEach(function (button) {
            button.addEventListener("click", async function () {
                const display = document.getElementById("qr-display-" + button.dataset.showQr);
                const image = display && display.querySelector("img");
                if (!display || !image) return;
                if (image.dataset.loaded === "true") {
                    display.hidden = !display.hidden;
                    return;
                }
                button.disabled = true;
                try {
                    const blob = await requestImage("pasien/resep/" + button.dataset.showQr + "/qr");
                    image.src = URL.createObjectURL(blob);
                    image.dataset.loaded = "true";
                    display.hidden = false;
                } catch (error) {
                    showToast(error.message, true);
                } finally {
                    button.disabled = false;
                }
            });
        });
    }
    if (state.role === "dokter") {
        const examinationPatient = document.querySelector('#examinationForm select[name="id_pendaftaran"]');
        if (examinationPatient) examinationPatient.addEventListener("change", function () {
            renderDoctorTriageSummary(examinationPatient.value);
            loadDoctorClinicalHistory(examinationPatient.value);
        });
        handleForm("clinicalHistoryForm", async function (form) {
            const appointment = (state.data.queue || []).find(function (entry) {
                return String(entry.id_pendaftaran) === String(examinationPatient && examinationPatient.value);
            });
            if (!appointment) throw new Error("Pilih pasien yang akan diperiksa terlebih dahulu.");
            await request("dokter/kunjungan/" + appointment.id_pendaftaran + "/riwayat-klinis", {
                method: "PUT",
                body: {
                    alergi: form.elements.namedItem("alergi").value,
                    obat_aktif: form.elements.namedItem("obat_aktif").value
                }
            });
            setBusy(form.querySelector('button[type="submit"]'), false);
            showToast("Riwayat klinis pasien berhasil diperbarui.", false);
        });
        const medicineField = document.querySelector('#examinationForm select[name="id_obat"]');
        if (medicineField) medicineField.addEventListener("change", function () {
            const form = medicineField.form;
            const hasMedicine = medicineField.value !== "";
            form.elements.namedItem("jumlah").required = hasMedicine;
            form.elements.namedItem("dosis_aturan_pakai").required = hasMedicine;
        });
        document.querySelectorAll("[data-queue-status]").forEach(function (select) {
            select.addEventListener("change", async function () {
                if (!select.value) return;
                select.disabled = true;
                try {
                    const result = await request("dokter/antrian/" + select.dataset.queueStatus, { method: "PUT", body: { status_antrean: select.value } });
                    await refreshPage(result.message || "Status antrean diperbarui.");
                } catch (error) { showToast(error.message, true); select.disabled = false; }
            });
        });
        document.querySelectorAll("[data-schedule-toggle]").forEach(function (button) {
            button.addEventListener("click", async function () {
                button.disabled = true;
                try {
                    await request("dokter/jadwal/" + button.dataset.scheduleToggle, { method: "PUT", body: { is_active: String(button.dataset.active) === "1" ? 0 : 1 } });
                    await refreshPage("Jadwal berhasil diperbarui.");
                } catch (error) { showToast(error.message, true); button.disabled = false; }
            });
        });
        handleForm("scheduleForm", async function (form) {
            const data = formObject(form);
            data.kuota_maksimal = Number(data.kuota_maksimal);
            await request("dokter/jadwal", { method: "POST", body: data });
            await refreshPage("Jadwal praktik berhasil ditambahkan.");
        });
        handleForm("examinationForm", async function (form) {
            const data = formObject(form);
            data.id_pendaftaran = Number(data.id_pendaftaran);
            ["suhu_tubuh", "berat_badan", "tinggi_badan"].forEach(function (field) { if (data[field]) data[field] = Number(data[field]); });
            if (data.id_obat) {
                data.resep = {
                    detail: [{
                        id_obat: Number(data.id_obat),
                        jumlah: Number(data.jumlah),
                        dosis_aturan_pakai: data.dosis_aturan_pakai
                    }]
                };
            } else {
                data.resep = null;
            }
            delete data.id_obat;
            delete data.jumlah;
            delete data.dosis_aturan_pakai;
            const result = await request("dokter/pemeriksaan", { method: "POST", body: data });
            await refreshPage(result.message || "Pemeriksaan dan resep berhasil disimpan.");
        });
    }
    if (state.role === "perawat") {
        document.querySelectorAll("[data-triage-form]").forEach(function (form) {
            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                const button = form.querySelector('button[type="submit"]');
                setBusy(button, true, "Menyimpan...");
                try {
                    const data = formObject(form);
                    ["suhu_tubuh", "berat_badan", "tinggi_badan"].forEach(function (field) {
                        data[field] = Number(data[field]);
                    });
                    await request("perawat/antrian/" + form.dataset.triageForm + "/triase", {
                        method: "POST",
                        body: data
                    });
                    await refreshPage("Pemeriksaan awal tercatat. Pasien kini siap dipanggil dokter.");
                } catch (error) {
                    showToast(error.message, true);
                    setBusy(button, false);
                }
            });
        });
    }
    if (state.role === "farmasi") {
        document.querySelectorAll("[data-recipe-status]").forEach(function (select) {
            select.addEventListener("change", async function () {
                if (!select.value) return;
                select.disabled = true;
                try {
                    await request("farmasi/resep/" + select.dataset.recipeStatus + "/status", { method: "PUT", body: { status_resep: select.value } });
                    await refreshPage(select.value === "Siap Diambil" ? "Resep siap. Notifikasi web telah dicatat untuk pasien." : "Status resep diperbarui.");
                } catch (error) { showToast(error.message, true); select.disabled = false; }
            });
        });
        handleForm("stockForm", async function (form) {
            const data = formObject(form);
            data.id_obat = Number(data.id_obat);
            data.jumlah = Number(data.jumlah);
            await request("farmasi/mutasi-stok", { method: "POST", body: data });
            await refreshPage("Mutasi stok berhasil dicatat.");
        });
        const startCameraButton = document.getElementById("startCamera");
        const stopCameraButton = document.getElementById("stopCamera");
        if (startCameraButton) startCameraButton.addEventListener("click", startCameraScan);
        if (stopCameraButton) stopCameraButton.addEventListener("click", function () {
            stopCamera();
            showScanMessage("Kamera dimatikan.", false);
        });
        handleForm("manualScanForm", async function (form) {
            const code = form.elements.namedItem("kode_qr_unik").value.trim();
            await previewPickupCode(code);
            form.reset();
            setBusy(form.querySelector('button[type="submit"]'), false);
        });
        const pickupTakenBy = document.getElementById("pickupTakenBy");
        if (pickupTakenBy) pickupTakenBy.addEventListener("change", function () {
            const nameWrap = document.getElementById("pickupNameWrap");
            const nameField = document.getElementById("pickupName");
            const isFamily = pickupTakenBy.value === "Keluarga";
            nameWrap.hidden = !isFamily;
            nameField.required = isFamily;
        });
        handleForm("pickupConfirmForm", async function (form) {
            const pending = state.data.pendingPickup;
            if (!pending) throw new Error("Pindai dan verifikasi QR resep terlebih dahulu.");
            const data = formObject(form);
            data.id_resep = Number(pending.recipe.id_resep);
            data.kode_qr_unik = pending.code;
            data.metode_verifikasi = "QR";
            if (data.diambil_oleh !== "Keluarga") delete data.nama_pengambil;
            await request("farmasi/pengambilan-obat", { method: "POST", body: data });
            state.data.pendingPickup = null;
            await refreshPage("Penyerahan tercatat; status resep menjadi Selesai Diambil.");
        });
        document.querySelectorAll("[data-edit-medicine]").forEach(function (button) {
            button.addEventListener("click", function () {
                const medicine = (state.data.medicines || []).find(function (item) { return String(item.id_obat) === button.dataset.editMedicine; });
                if (!medicine) return;
                const form = document.getElementById("medicineForm");
                ["nama_obat", "kode_kemenkes", "jenis_obat", "satuan", "cover_bpjs", "stok_minimum", "tanggal_kedaluwarsa", "harga"].forEach(function (key) {
                    const field = form.elements.namedItem(key);
                    if (field) field.value = medicine[key] == null ? "" : medicine[key];
                });
                form.dataset.editId = medicine.id_obat;
                const submit = form.querySelector('button[type="submit"]');
                submit.textContent = "Simpan perubahan";
                form.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
        handleForm("medicineForm", async function (form) {
            const data = formObject(form);
            data.cover_bpjs = Number(data.cover_bpjs);
            data.stok_minimum = Number(data.stok_minimum);
            data.harga = Number(data.harga || 0);
            if (form.dataset.editId) {
                await request("farmasi/obat/" + form.dataset.editId, { method: "PUT", body: data });
                delete form.dataset.editId;
                await refreshPage("Data obat berhasil diperbarui.");
                return;
            }
            await request("farmasi/obat", { method: "POST", body: data });
            await refreshPage("Obat berhasil ditambahkan. Catat stok awal melalui menu Stok & mutasi.");
        });
    }
    if (state.role === "admin" && state.page === "resources") {
        document.getElementById("resourceSelect").addEventListener("change", async function (event) {
            try { await loadAdminResource(event.target.value); }
            catch (error) { showToast(error.message, true); }
        });
        handleForm("adminResourceForm", async function (form) {
            let data;
            try { data = JSON.parse(form.elements.namedItem("json").value); }
            catch (_error) { throw new Error("Data JSON tidak valid."); }
            if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("Data harus berupa satu objek JSON.");
            const resource = state.data.resource || "users";
            const id = form.elements.namedItem("id").value.trim();
            const endpoint = "admin/" + resource + (id ? "/" + encodeURIComponent(id) : "");
            await request(endpoint, { method: id ? "PUT" : "POST", body: data });
            await loadAdminResource(resource);
            showToast(id ? "Data berhasil diperbarui." : "Data berhasil ditambahkan.", false);
        });
        document.getElementById("clearResourceForm").addEventListener("click", function () {
            document.getElementById("resourceId").value = "";
            document.getElementById("resourceJson").value = "{}";
        });
        document.querySelectorAll("[data-admin-edit]").forEach(function (button) {
            button.addEventListener("click", function () {
                const item = (state.data.resourceItems || []).find(function (row) {
                    return String(row[resourceIdKeys[state.data.resource]]) === button.dataset.adminEdit;
                });
                if (!item) return;
                document.getElementById("resourceId").value = item[resourceIdKeys[state.data.resource]];
                document.getElementById("resourceJson").value = JSON.stringify(item, null, 2);
                document.getElementById("adminResourceForm").scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
        document.querySelectorAll("[data-admin-delete]").forEach(function (button) {
            button.addEventListener("click", async function () {
                if (!window.confirm("Hapus data ini? Tindakan ini tidak dapat dibatalkan.")) return;
                button.disabled = true;
                try {
                    await request("admin/" + state.data.resource + "/" + encodeURIComponent(button.dataset.adminDelete), { method: "DELETE" });
                    await loadAdminResource(state.data.resource);
                    showToast("Data berhasil dihapus.", false);
                } catch (error) { showToast(error.message, true); button.disabled = false; }
            });
        });
    }
    if (state.role === "admin" && state.page === "staff") {
        handleForm("doctorAccountForm", async function (form) {
            const data = formObject(form);
            data.id_poli = Number(data.id_poli);
            data.rata_waktu_periksa_menit = Number(data.rata_waktu_periksa_menit);
            await request("admin/dokter/registrasi", { method: "POST", body: data });
            await refreshPage("Akun dokter berhasil dibuat.");
        });
        document.getElementById("staffRoleFilter").addEventListener("change", function (event) {
            state.data.staffRole = event.target.value;
            renderPage();
        });
    }
}

async function initializeDashboard() {
    if (!document.body.classList.contains("app-page")) return;
    const token = sessionStorage.getItem(tokenKey);
    const cachedUser = sessionStorage.getItem(userKey);
    if (!token || !cachedUser) {
        window.location.replace(window.MEDICFLOW_LOGIN_URL);
        return;
    }
    try {
        state.user = JSON.parse(cachedUser);
        state.role = state.user.role;
        if (!roleMenus[state.role]) throw new Error("Peran akun tidak dikenali. Silakan hubungi administrator.");
        document.getElementById("userName").textContent = state.user.username || roleLabels[state.role];
        document.getElementById("userRole").textContent = roleLabels[state.role];
        document.getElementById("userAvatar").textContent = (state.user.username || roleLabels[state.role]).slice(0, 1).toUpperCase();
        document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date());
        document.getElementById("logoutButton").addEventListener("click", function () {
            sessionStorage.removeItem(tokenKey);
            sessionStorage.removeItem(userKey);
            window.location.assign(window.MEDICFLOW_LOGIN_URL);
        });
        if (state.role === "pasien" && "serviceWorker" in navigator && window.isSecureContext) {
            navigator.serviceWorker.register("/service-worker.js")
                .then(function (registration) {
                    patientServiceWorkerRegistration = registration;
                })
                .catch(function (error) {
                    console.error("MedicFlow service worker registration failed:", error);
                });
            navigator.serviceWorker.addEventListener("message", function (event) {
                if (state.role === "pasien" && event.data && event.data.type === "medicflow-notification-click") {
                    state.page = "notifications";
                    renderPage();
                }
            });
        }
        await loadRoleData();
        renderPage();
        if (state.role === "pasien") startPatientUpdates();
    } catch (error) {
        document.getElementById("dashboardContent").innerHTML = '<div class="empty-state">' + escapeHtml(error.message) + '</div>';
    }
}
