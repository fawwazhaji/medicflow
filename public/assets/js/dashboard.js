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
        const results = await Promise.all([
            request("perawat/antrian"), request("perawat/antrian/riwayat")
        ]);
        state.data = { queue: results[0].data || [], queueHistory: results[1].data || [] };
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
        const extra = await Promise.all([
            request("admin/dokter"), request("admin/poliklinik"), request("admin/jadwal-dokter"),
            request("admin/mutasi-stok"), request("admin/log-aktivitas")
        ]);
        state.data = {
            counts: counts,
            resource: state.data.resource || "users",
            resourceItems: results[0].data || [],
            staffUsers: results[0].data || [],
            staffDoctors: extra[0].data || [],
            staffClinics: extra[1].data || [],
            schedules: extra[2].data || [],
            medicines: results[3].data || [],
            mutations: extra[3].data || [],
            activityLogs: extra[4].data || [],
            staffRole: state.data.staffRole || "semua"
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
    document.querySelectorAll("dialog.schedule-dialog").forEach(function (node) {
        if (typeof node.close === "function" && node.open) node.close();
        node.remove();
    });
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

function openScheduleDialog(editingAppointmentId, currentDate) {
    const dialog = document.getElementById("scheduleMonthDialog");
    const title = document.getElementById("scheduleMonthTitle");
    const note = document.getElementById("scheduleDialogNote");
    const dateWrap = document.getElementById("scheduleVisitDateWrap");
    const dateInput = document.getElementById("scheduleVisitDate");
    if (!dialog) return;
    state.editingAppointmentId = editingAppointmentId || null;
    const editing = Boolean(state.editingAppointmentId);
    if (title) title.textContent = editing ? "Ubah dokter dan tanggal" : "Jadwal dokter";
    if (note) note.textContent = editing ? "Pilih hari praktik, lalu isi tanggal kunjungan." : (note.dataset.defaultNote || note.textContent);
    if (dateWrap) dateWrap.hidden = !editing;
    if (dateInput) {
        const today = localDateValue(new Date());
        dateInput.min = today;
        const incoming = String(currentDate || "").slice(0, 10);
        dateInput.value = editing && /^\d{4}-\d{2}-\d{2}$/.test(incoming) && incoming >= today ? incoming : "";
    }
    if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
}

function bindAppointmentEditButtons(root) {
    (root || document).querySelectorAll("[data-edit-appointment]").forEach(function (button) {
        button.addEventListener("click", function () {
            openScheduleDialog(button.dataset.editAppointment, button.dataset.visitDate);
        });
    });
}

function bindReportDownloads() {
    const form = document.getElementById("reportDownloadForm");
    if (!form) return;
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        const pdfButton = form.querySelector('[data-download-report="pdf"]');
        if (pdfButton) pdfButton.click();
    });
    form.querySelectorAll("[data-download-report]").forEach(function (button) {
        button.addEventListener("click", async function () {
            const from = document.getElementById("reportFrom").value;
            const to = document.getElementById("reportTo").value;
            const kind = document.getElementById("reportKind").value;
            if (!from || !to || from > to) {
                showToast("Rentang tanggal tidak valid.", true);
                return;
            }
            const prefix = state.role === "farmasi" ? "farmasi" : "admin";
            button.disabled = true;
            try {
                await downloadFile(prefix + "/laporan/" + encodeURIComponent(kind) + "?dari=" + encodeURIComponent(from) + "&sampai=" + encodeURIComponent(to) + "&format=" + encodeURIComponent(button.dataset.downloadReport), "laporan." + button.dataset.downloadReport);
                showToast("Laporan berhasil diunduh.");
            } catch (error) {
                showToast(error.message, true);
            } finally {
                button.disabled = false;
            }
        });
    });
}

function bindSchedulePicker() {
    const opener = document.getElementById("openSchedulePicker");
    const dialog = document.getElementById("scheduleMonthDialog");
    if (!opener || !dialog) return;
    opener.addEventListener("click", function () {
        openScheduleDialog(null);
    });
    const closeButton = dialog.querySelector("[data-close-schedule]");
    if (closeButton) {
        closeButton.addEventListener("click", function () {
            if (typeof dialog.close === "function") dialog.close();
        });
    }
    dialog.addEventListener("click", function (event) {
        if (event.target === dialog && typeof dialog.close === "function") dialog.close();
    });
    dialog.addEventListener("close", function () {
        state.editingAppointmentId = null;
        const title = document.getElementById("scheduleMonthTitle");
        const note = document.getElementById("scheduleDialogNote");
        const dateWrap = document.getElementById("scheduleVisitDateWrap");
        const dateInput = document.getElementById("scheduleVisitDate");
        if (title) title.textContent = "Jadwal dokter";
        if (note) note.textContent = note.dataset.defaultNote || note.textContent;
        if (dateWrap) dateWrap.hidden = true;
        if (dateInput) dateInput.value = "";
    });
}

function bindPageActions() {
    bindReportDownloads();
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
        document.querySelectorAll("[data-pick-schedule]").forEach(function (button) {
            button.addEventListener("click", async function () {
                const select = document.getElementById("scheduleId");
                const dayField = document.getElementById("scheduleDay");
                const opener = document.getElementById("openSchedulePicker");
                const dialog = document.getElementById("scheduleMonthDialog");
                const scheduleId = button.dataset.pickSchedule;
                const dayName = button.dataset.scheduleDay || "";
                if (state.editingAppointmentId) {
                    const editDate = document.getElementById("scheduleVisitDate");
                    const date = editDate ? editDate.value : "";
                    if (!date) {
                        showToast("Isi tanggal kunjungan terlebih dahulu.", true);
                        return;
                    }
                    if (date < localDateValue(new Date())) {
                        showToast("Tanggal kunjungan tidak boleh sebelum hari ini.", true);
                        return;
                    }
                    if (!visitDateMatchesDay(date, dayName)) {
                        showToast("Tanggal kunjungan harus jatuh pada hari " + dayName + ".", true);
                        return;
                    }
                    button.disabled = true;
                    try {
                        const result = await request("pasien/pendaftaran/" + state.editingAppointmentId, {
                            method: "PUT",
                            body: { id_jadwal: Number(scheduleId), tanggal_kunjungan: date }
                        });
                        state.editingAppointmentId = null;
                        if (dialog && typeof dialog.close === "function" && dialog.open) dialog.close();
                        await refreshPage(result.message || "Dokter dan tanggal kunjungan berhasil diubah.");
                    } catch (error) {
                        showToast(error.message, true);
                        button.disabled = false;
                    }
                    return;
                }
                if (select) select.value = scheduleId;
                if (dayField) dayField.value = dayName;
                updateVisitDateHint(dayName);
                showScheduleChoice({
                    doctor: button.dataset.doctor,
                    clinic: button.dataset.clinic,
                    when: button.dataset.when,
                    hours: button.dataset.hours
                });
                if (opener) opener.textContent = "Ubah jadwal";
                if (dialog) {
                    dialog.querySelectorAll(".schedule-slot").forEach(function (slot) { slot.classList.remove("is-selected"); });
                    const slot = button.closest(".schedule-slot");
                    if (slot) slot.classList.add("is-selected");
                    if (typeof dialog.close === "function" && dialog.open) dialog.close();
                }
                showToast("Jadwal dipilih. Isi tanggal kunjungan, lalu daftar antrean.");
            });
        });
        bindSchedulePicker();
        bindAppointmentEditButtons(document);
        handleForm("appointmentForm", async function (form) {
            const data = formObject(form);
            const dayName = (document.getElementById("scheduleDay") || {}).value || "";
            if (!data.id_jadwal) {
                throw new Error("Pilih jadwal dokter terlebih dahulu.");
            }
            if (!data.tanggal_kunjungan) {
                throw new Error("Isi tanggal kunjungan.");
            }
            if (data.tanggal_kunjungan < localDateValue(new Date())) {
                throw new Error("Tanggal kunjungan tidak boleh sebelum hari ini.");
            }
            if (!visitDateMatchesDay(data.tanggal_kunjungan, dayName)) {
                throw new Error("Tanggal kunjungan harus jatuh pada hari " + dayName + ".");
            }
            data.id_jadwal = Number(data.id_jadwal);
            await request("pasien/pendaftaran", { method: "POST", body: data });
            await refreshPage("Pendaftaran antrean berhasil dibuat.");
        });
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
            const drugAllergy = form.elements.namedItem("alergi_obat").value;
            await request("dokter/kunjungan/" + appointment.id_pendaftaran + "/riwayat-klinis", {
                method: "PUT",
                body: {
                    alergi: form.elements.namedItem("alergi").value,
                    alergi_obat: drugAllergy,
                    obat_aktif: form.elements.namedItem("obat_aktif").value
                }
            });
            const examinationAllergy = document.querySelector('#examinationForm [name="alergi_obat"]');
            if (examinationAllergy) examinationAllergy.value = drugAllergy;
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
        document.querySelectorAll("[data-edit-schedule]").forEach(function (button) {
            button.addEventListener("click", function () {
                const dialog = document.getElementById("scheduleEditDialog");
                const form = document.getElementById("scheduleEditForm");
                if (!dialog || !form) return;
                form.elements.namedItem("id_jadwal").value = button.dataset.editSchedule;
                form.elements.namedItem("hari").value = button.dataset.day;
                form.elements.namedItem("jam_mulai").value = button.dataset.start;
                form.elements.namedItem("jam_selesai").value = button.dataset.end;
                form.elements.namedItem("kuota_maksimal").value = button.dataset.quota;
                form.elements.namedItem("is_active").value = button.dataset.active;
                const clinic = document.getElementById("scheduleEditClinic");
                if (clinic) clinic.textContent = button.dataset.clinic || "Jadwal praktik poli Anda";
                if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
                if (typeof dialog.showModal === "function") dialog.showModal();
            });
        });
        const closeScheduleEdit = document.querySelector("[data-close-schedule-edit]");
        if (closeScheduleEdit) {
            closeScheduleEdit.addEventListener("click", function () {
                const dialog = document.getElementById("scheduleEditDialog");
                if (dialog && typeof dialog.close === "function") dialog.close();
            });
        }
        handleForm("scheduleEditForm", async function (form) {
            const data = formObject(form);
            const id = data.id_jadwal;
            delete data.id_jadwal;
            data.kuota_maksimal = Number(data.kuota_maksimal);
            data.is_active = Number(data.is_active);
            await request("dokter/jadwal/" + id, { method: "PUT", body: data });
            const dialog = document.getElementById("scheduleEditDialog");
            if (dialog && typeof dialog.close === "function" && dialog.open) dialog.close();
            await refreshPage("Jadwal praktik berhasil diubah.");
        });
        handleForm("contactAdminForm", async function (form) {
            const data = formObject(form);
            await request("dokter/hubungi-admin", { method: "POST", body: data });
            form.reset();
            setBusy(form.querySelector('button[type="submit"]'), false);
            showToast("Pesan terkirim ke admin.", false);
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
            ["suhu_tubuh", "berat_badan", "tinggi_badan", "laju_respirasi"].forEach(function (field) { if (data[field]) data[field] = Number(data[field]); });
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
                    ["suhu_tubuh", "berat_badan", "tinggi_badan", "laju_respirasi"].forEach(function (field) {
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
        const roleField = document.getElementById("accountRole");
        const showAccountExtras = function () {
            const role = roleField ? roleField.value : "";
            const doctorFields = document.getElementById("accountDoctorFields");
            const patientFields = document.getElementById("accountPatientFields");
            if (doctorFields) doctorFields.hidden = role !== "dokter" || !!document.getElementById("accountId").value;
            if (patientFields) patientFields.hidden = role !== "pasien" || !!document.getElementById("accountId").value;
        };
        if (roleField) roleField.addEventListener("change", showAccountExtras);
        showAccountExtras();
        document.getElementById("accountFormReset").addEventListener("click", function () {
            const form = document.getElementById("adminAccountForm");
            form.reset();
            document.getElementById("accountId").value = "";
            document.getElementById("accountPassword").required = true;
            showAccountExtras();
        });
        document.querySelectorAll("[data-edit-account]").forEach(function (button) {
            button.addEventListener("click", function () {
                const user = (state.data.staffUsers || []).find(function (item) { return String(item.id_user) === button.dataset.editAccount; });
                const form = document.getElementById("adminAccountForm");
                if (!user || !form) return;
                form.elements.namedItem("id_user").value = user.id_user;
                form.elements.namedItem("nama_lengkap").value = user.nama_lengkap || "";
                form.elements.namedItem("username").value = user.username || "";
                form.elements.namedItem("no_telepon").value = user.no_telepon || "";
                form.elements.namedItem("role").value = user.role;
                form.elements.namedItem("is_active").value = String(user.is_active) === "1" ? "1" : "0";
                form.elements.namedItem("password").value = "";
                form.elements.namedItem("password").required = false;
                showAccountExtras();
                form.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
        document.querySelectorAll("[data-delete-account]").forEach(function (button) {
            button.addEventListener("click", async function () {
                if (!window.confirm("Hapus akun ini? Akun yang masih punya data klinik tidak dapat dihapus.")) return;
                button.disabled = true;
                try {
                    await request("admin/users/" + button.dataset.deleteAccount, { method: "DELETE" });
                    await refreshPage("Akun berhasil dihapus.");
                } catch (error) { showToast(error.message, true); button.disabled = false; }
            });
        });
        handleForm("adminAccountForm", async function (form) {
            const data = formObject(form);
            const id = data.id_user;
            delete data.id_user;
            data.is_active = Number(data.is_active);
            if (!data.password) delete data.password;
            if (id) {
                await request("admin/users/" + id, { method: "PUT", body: data });
                await refreshPage("Akun berhasil diubah.");
                return;
            }
            if (data.role === "dokter") {
                await request("admin/dokter/registrasi", { method: "POST", body: {
                    nama_dokter: data.nama_lengkap, username: data.username, password: data.password,
                    no_telepon: data.no_telepon, spesialisasi: data.spesialisasi,
                    id_poli: Number(data.id_poli), rata_waktu_periksa_menit: Number(data.rata_waktu_periksa_menit || 15)
                } });
            } else {
                const created = await request("admin/users", { method: "POST", body: data });
                if (data.role === "pasien") {
                    await request("admin/pasien", { method: "POST", body: {
                        id_user: created.id_user, nik: data.nik, nama_lengkap: data.nama_lengkap,
                        tanggal_lahir: data.tanggal_lahir, jenis_kelamin: data.jenis_kelamin, no_telepon: data.no_telepon
                    } });
                }
            }
            await refreshPage("Akun berhasil dibuat.");
        });
        document.getElementById("staffRoleFilter").addEventListener("change", function (event) {
            state.data.staffRole = event.target.value;
            renderPage();
        });
    }
    if (state.role === "admin" && state.page === "schedules") {
        const resetSchedule = function () {
            const form = document.getElementById("adminScheduleForm");
            form.reset();
            document.getElementById("adminScheduleId").value = "";
            document.getElementById("adminScheduleQuota").value = "20";
        };
        document.getElementById("adminScheduleReset").addEventListener("click", resetSchedule);
        document.querySelectorAll("[data-admin-edit-schedule]").forEach(function (button) {
            button.addEventListener("click", function () {
                const item = (state.data.schedules || []).find(function (row) { return String(row.id_jadwal) === button.dataset.adminEditSchedule; });
                const form = document.getElementById("adminScheduleForm");
                if (!item || !form) return;
                form.elements.namedItem("id_jadwal").value = item.id_jadwal;
                form.elements.namedItem("id_dokter").value = item.id_dokter;
                form.elements.namedItem("hari").value = item.hari;
                form.elements.namedItem("jam_mulai").value = String(item.jam_mulai).slice(0, 5);
                form.elements.namedItem("jam_selesai").value = String(item.jam_selesai).slice(0, 5);
                form.elements.namedItem("kuota_maksimal").value = item.kuota_maksimal;
                form.elements.namedItem("is_active").value = String(item.is_active) === "1" ? "1" : "0";
                form.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
        document.querySelectorAll("[data-admin-delete-schedule]").forEach(function (button) {
            button.addEventListener("click", async function () {
                if (!window.confirm("Hapus jadwal ini?")) return;
                button.disabled = true;
                try {
                    await request("admin/jadwal-dokter/" + button.dataset.adminDeleteSchedule, { method: "DELETE" });
                    await refreshPage("Jadwal berhasil dihapus.");
                } catch (error) { showToast(error.message, true); button.disabled = false; }
            });
        });
        handleForm("adminScheduleForm", async function (form) {
            const data = formObject(form);
            const id = data.id_jadwal;
            delete data.id_jadwal;
            data.id_dokter = Number(data.id_dokter);
            data.kuota_maksimal = Number(data.kuota_maksimal);
            data.is_active = Number(data.is_active);
            await request("admin/jadwal-dokter" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", body: data });
            await refreshPage(id ? "Jadwal berhasil diubah." : "Jadwal berhasil ditambahkan.");
        });
    }
    if (state.role === "admin" && state.page === "stock") {
        document.getElementById("adminMedicineReset").addEventListener("click", function () {
            document.getElementById("adminMedicineForm").reset();
            document.getElementById("adminMedicineId").value = "";
        });
        document.querySelectorAll("[data-admin-edit-medicine]").forEach(function (button) {
            button.addEventListener("click", function () {
                const item = (state.data.medicines || []).find(function (row) { return String(row.id_obat) === button.dataset.adminEditMedicine; });
                const form = document.getElementById("adminMedicineForm");
                if (!item || !form) return;
                form.elements.namedItem("id_obat").value = item.id_obat;
                form.elements.namedItem("nama_obat").value = item.nama_obat || "";
                form.elements.namedItem("kode_kemenkes").value = item.kode_kemenkes || "";
                form.elements.namedItem("satuan").value = item.satuan || "";
                form.elements.namedItem("stok_minimum").value = item.stok_minimum;
                form.elements.namedItem("harga").value = item.harga;
                form.elements.namedItem("is_active").value = String(item.is_active) === "1" ? "1" : "0";
                form.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
        document.querySelectorAll("[data-admin-delete-medicine]").forEach(function (button) {
            button.addEventListener("click", async function () {
                if (!window.confirm("Hapus obat ini?")) return;
                button.disabled = true;
                try {
                    await request("admin/obat/" + button.dataset.adminDeleteMedicine, { method: "DELETE" });
                    await refreshPage("Obat berhasil dihapus.");
                } catch (error) { showToast(error.message, true); button.disabled = false; }
            });
        });
        handleForm("adminMedicineForm", async function (form) {
            const data = formObject(form);
            const id = data.id_obat;
            delete data.id_obat;
            data.stok_minimum = Number(data.stok_minimum);
            data.harga = Number(data.harga || 0);
            data.is_active = Number(data.is_active);
            data.jenis_obat = "Jadi";
            data.cover_bpjs = 0;
            if (!id) data.stok_rs = 0;
            await request("admin/obat" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", body: data });
            await refreshPage(id ? "Data obat berhasil diubah." : "Obat berhasil ditambahkan.");
        });
        handleForm("adminStockForm", async function (form) {
            const data = formObject(form);
            data.id_obat = Number(data.id_obat);
            data.jumlah = Number(data.jumlah);
            await request("admin/mutasi-stok", { method: "POST", body: data });
            await refreshPage("Stok obat berhasil diperbarui.");
        });
    }
}

function setNavigationOpen(open) {
    document.body.classList.toggle("nav-open", open);
    const toggle = document.getElementById("menuToggle");
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
}

function closeNavigation() {
    setNavigationOpen(false);
}

function bindLogout(button) {
    if (!button) return;
    button.addEventListener("click", function () {
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem(userKey);
        window.location.assign(window.MEDICFLOW_LOGIN_URL);
    });
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
        bindLogout(document.getElementById("logoutButton"));
        bindLogout(document.getElementById("logoutButtonTop"));
        const menuToggle = document.getElementById("menuToggle");
        const sidebarBackdrop = document.getElementById("sidebarBackdrop");
        if (menuToggle) {
            menuToggle.addEventListener("click", function () {
                setNavigationOpen(!document.body.classList.contains("nav-open"));
            });
        }
        if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeNavigation);
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeNavigation();
        });
        window.addEventListener("resize", function () {
            if (window.innerWidth > 900) closeNavigation();
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
