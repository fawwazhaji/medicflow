"use strict";

function renderPatient() {
    const data = state.data;
    const profile = data.profile || {};
    const appointments = data.appointments || [];
    const schedules = data.schedules || [];
    const exams = data.examinations || [];
    const recipes = data.prescriptions || [];
    const notifications = data.notifications || [];
    const clinicalHistory = data.clinicalHistory || {};

    if (state.page === "overview") {
        const activeStatuses = ["Menunggu", "Siap Diperiksa", "Dipanggil", "Masuk Ruangan"];
        const upcoming = appointments.filter(function (item) { return activeStatuses.includes(item.status_antrean); });
        return '<div class="page-intro"><div><h2>Halo, ' + escapeHtml(profile.nama_lengkap || state.user.username) + '</h2><p>Ringkasan kunjungan dan informasi kesehatan Anda.</p></div></div>' +
            statCards([["Pendaftaran aktif", upcoming.length], ["Pemeriksaan tercatat", exams.length], ["Resep", recipes.length], ["Notifikasi", notifications.length]]) +
            panel("Informasi kesehatan", '<p><strong>Alergi:</strong> ' + escapeHtml(clinicalHistory.alergi || "Belum dicatat") + '</p><p><strong>Obat aktif:</strong> ' + escapeHtml(clinicalHistory.obat_aktif || "Belum dicatat") + '</p><p class="text-muted">Informasi ini dicatat dokter dan dapat diperbarui saat pemeriksaan.</p>', "Catatan klinis Anda") +
            panel("Notifikasi perangkat", deviceNotificationSettings(), "Tampilkan pemberitahuan di perangkat ini") +
            panel("Pendaftaran terbaru", appointmentTable(appointments.slice(0, 5), schedules), "Status antrean kunjungan Anda") +
            panel("Notifikasi terbaru", notificationList(notifications.slice(0, 4)), "Informasi dari layanan MedicFlow");
    }
    if (state.page === "appointments") {
        const scheduleOptions = schedules.map(function (item) {
            const doctor = item.nama_dokter || "Dokter";
            const poli = item.nama_poli ? " • " + item.nama_poli : "";
            const label = doctor + poli + " • " + item.hari + " " + String(item.jam_mulai).slice(0, 5) + "–" + String(item.jam_selesai).slice(0, 5);
            return '<option value="' + escapeHtml(item.id_jadwal) + '">' + escapeHtml(label) + '</option>';
        }).join("");
        return '<div class="page-intro"><div><h2>Jadwalkan kunjungan</h2><p>Pilih jadwal praktik aktif dan tanggal yang sesuai dengan hari praktik.</p></div></div>' +
            panel("Daftar antrean baru", '<form id="appointmentForm" class="inline-form">' +
                '<div><label class="field-label" for="scheduleId">Dokter & jadwal praktik</label><select class="field" id="scheduleId" name="id_jadwal" required><option value="">Pilih jadwal</option>' + scheduleOptions + '</select></div>' +
                '<div><label class="field-label" for="visitDate">Tanggal kunjungan</label><input class="field" id="visitDate" name="tanggal_kunjungan" type="date" min="' + new Date().toISOString().slice(0, 10) + '" required></div>' +
                '<div><label class="field-label" for="visitNote">Catatan (opsional)</label><input class="field" id="visitNote" name="catatan_pasien" maxlength="500" placeholder="Keluhan singkat"></div>' +
                '<button class="button button-primary" type="submit">Daftar antrean</button></form>') +
            panel("Riwayat pendaftaran", appointmentHistoryPanel(appointments, schedules), "Antrean yang pernah Anda daftarkan");
    }
    if (state.page === "examinations") {
        return '<div class="page-intro"><div><h2>Riwayat pemeriksaan</h2><p>Catatan pemeriksaan yang telah dilakukan dokter.</p></div></div>' +
            panel("Pemeriksaan Anda", examinationHistoryPanel(exams));
    }
    if (state.page === "prescriptions") {
        return '<div class="page-intro"><div><h2>Resep obat</h2><p>Pilih cara penebusan saat resep baru diterbitkan oleh dokter.</p></div></div>' +
            '<div class="stack">' + (recipes.length ? recipes.map(function (item) {
                const selectAction = item.status_resep === "Menunggu Pilihan"
                    ? '<div class="form-actions"><button class="button button-primary button-small" data-recipe-choice="' + item.id_resep + '" data-choice="Apotek RS" type="button">Ambil di apotek RS</button><button class="button button-secondary button-small" data-recipe-choice="' + item.id_resep + '" data-choice="Apotek Luar" type="button">Tebus di apotek luar</button></div>'
                    : "";
                const qrPanel = item.status_resep === "Siap Diambil" && item.pilihan_penebusan === "Apotek RS"
                    ? '<div class="qr-actions"><button class="button button-secondary button-small" data-show-qr="' + escapeHtml(item.id_resep) + '" type="button">Tampilkan QR pengambilan</button><div class="qr-display" id="qr-display-' + escapeHtml(item.id_resep) + '" hidden><img class="qr-image" alt="QR verifikasi resep ' + escapeHtml(item.id_resep) + '"><p>Tunjukkan QR ini kepada petugas farmasi. QR tidak langsung menyelesaikan pengambilan.</p></div></div>'
                    : "";
                return '<article class="info-card"><h4>Resep #' + escapeHtml(item.id_resep) + ' <span style="float:right">' + statusBadge(item.status_resep) + '</span></h4><p>Diterbitkan: ' + formatDateTime(item.waktu_diterbitkan) + '</p><p>Pilihan: ' + escapeHtml(item.pilihan_penebusan || "Belum dipilih") + '</p>' + qrPanel + selectAction + '</article>';
            }).join("") : '<div class="empty-state">Belum ada resep.</div>') + '</div>';
    }
    if (state.page === "notifications") {
        return '<div class="page-intro"><div><h2>Notifikasi web</h2><p>Informasi status kunjungan dan obat tersedia di sini.</p></div></div>' +
            panel("Notifikasi perangkat", deviceNotificationSettings(), "Pemberitahuan pop-up di laptop atau ponsel") +
            panel("Semua notifikasi", notificationList(notifications), "Pemberitahuan tersimpan dalam aplikasi");
    }
    if (state.page === "profile") {
        return '<div class="page-intro"><div><h2>Profil pasien</h2><p>Perbarui informasi kontak dan data pribadi Anda.</p></div></div>' +
            panel("Informasi pribadi", '<form id="profileForm" class="form-grid">' +
                profileField("Nama lengkap", "nama_lengkap", profile.nama_lengkap, "text", true) +
                profileField("Tanggal lahir", "tanggal_lahir", profile.tanggal_lahir, "date", true) +
                '<div class="field-wrap"><label class="field-label" for="profileGender">Jenis kelamin</label><select class="field" id="profileGender" name="jenis_kelamin"><option value="L"' + (profile.jenis_kelamin === "L" ? " selected" : "") + '>Laki-laki</option><option value="P"' + (profile.jenis_kelamin === "P" ? " selected" : "") + '>Perempuan</option></select></div>' +
                profileField("Nomor telepon", "no_telepon", profile.no_telepon, "tel", true) +
                profileField("Nomor BPJS", "nomor_bpjs", profile.nomor_bpjs, "text", false) +
                '<div class="field-wrap field-full"><label class="field-label" for="profileAddress">Alamat</label><textarea class="field textarea" id="profileAddress" name="alamat" rows="3">' + escapeHtml(profile.alamat) + '</textarea></div>' +
                '<div class="field-full form-actions"><button class="button button-primary" type="submit">Simpan profil</button></div></form>');
    }
    return '<div class="empty-state">Halaman tidak ditemukan.</div>';
}

const queueStatuses = ["Menunggu", "Siap Diperiksa", "Dipanggil", "Masuk Ruangan", "Selesai Pemeriksaan", "Batal"];

function defaultAppointmentFilters() {
    return { status: "semua", checkin: "semua", doctor: "semua", from: "", to: "", query: "" };
}

function defaultExaminationFilters() {
    return { from: "", to: "", query: "" };
}

function ensureHistoryFilters() {
    if (!state.historyFilters) state.historyFilters = {};
    if (!state.historyFilters.appointments) state.historyFilters.appointments = defaultAppointmentFilters();
    if (!state.historyFilters.examinations) state.historyFilters.examinations = defaultExaminationFilters();
}

function filterField(label, control) {
    const match = /id="([^"]+)"/.exec(control);
    const idAttr = match ? ' for="' + match[1] + '"' : "";
    return '<div><label class="field-label"' + idAttr + '>' + escapeHtml(label) + '</label>' + control + '</div>';
}

function filterSelect(id, name, options, selected) {
    const choices = options.slice();
    if (!choices.some(function (option) { return option[0] === selected; })) choices.push([selected, selected]);
    return '<select class="field" id="' + id + '" name="' + name + '">' + choices.map(function (option) {
        return '<option value="' + escapeHtml(option[0]) + '"' + (option[0] === selected ? " selected" : "") + '>' + escapeHtml(option[1]) + '</option>';
    }).join("") + '</select>';
}

function scheduleForAppointment(item, schedules) {
    return schedules.find(function (entry) { return String(entry.id_jadwal) === String(item.id_jadwal); }) || {};
}

function appointmentDoctorLabel(item, schedules) {
    const schedule = scheduleForAppointment(item, schedules);
    return schedule.nama_dokter || ("Jadwal #" + item.id_jadwal);
}

function invalidDateRange(filters) {
    return Boolean(filters.from && filters.to && filters.from > filters.to);
}

function withinDateRange(value, from, to) {
    if (!from && !to) return true;
    const day = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
}

function includesQuery(query, parts) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return true;
    return parts.map(function (part) { return part == null ? "" : String(part); }).join(" ").toLowerCase().indexOf(needle) !== -1;
}

function filterAppointments(appointments, schedules, filters) {
    return appointments.filter(function (item) {
        const schedule = scheduleForAppointment(item, schedules);
        const doctor = appointmentDoctorLabel(item, schedules);
        if (filters.status !== "semua" && item.status_antrean !== filters.status) return false;
        if (filters.checkin === "sudah" && !item.waktu_check_in) return false;
        if (filters.checkin === "belum" && item.waktu_check_in) return false;
        if (filters.doctor !== "semua" && doctor !== filters.doctor) return false;
        if (!withinDateRange(item.tanggal_kunjungan, filters.from, filters.to)) return false;
        return includesQuery(filters.query, [
            doctor, schedule.nama_poli, item.nomor_antrean, "#" + item.nomor_antrean,
            item.status_antrean, item.catatan_pasien, item.tanggal_kunjungan
        ]);
    });
}

function filterExaminations(exams, filters) {
    return exams.filter(function (item) {
        if (!withinDateRange(item.waktu_mulai, filters.from, filters.to)) return false;
        return includesQuery(filters.query, [item.keluhan, item.diagnosis, item.tindakan, item.catatan_dokter, item.waktu_mulai]);
    });
}

function appointmentStatusOptions(appointments) {
    const options = [["semua", "Semua status"]];
    queueStatuses.forEach(function (status) { options.push([status, status]); });
    appointments.forEach(function (item) {
        if (item.status_antrean && !options.some(function (option) { return option[0] === item.status_antrean; })) {
            options.push([item.status_antrean, item.status_antrean]);
        }
    });
    return options;
}

function appointmentFilterSummary(appointments, filtered, filters) {
    if (invalidDateRange(filters)) return "Tanggal awal lebih besar dari tanggal akhir.";
    return "Menampilkan " + filtered.length + " dari " + appointments.length + " pendaftaran";
}

function appointmentEmptyText(appointments, filtered, filters) {
    if (invalidDateRange(filters)) return "Sesuaikan rentang tanggal untuk melihat pendaftaran.";
    if (!appointments.length) return "Belum ada pendaftaran antrean.";
    if (!filtered.length) return "Tidak ada pendaftaran yang sesuai filter.";
    return "Belum ada pendaftaran antrean.";
}

function examinationFilterSummary(exams, filtered, filters) {
    if (invalidDateRange(filters)) return "Tanggal awal lebih besar dari tanggal akhir.";
    return "Menampilkan " + filtered.length + " dari " + exams.length + " pemeriksaan";
}

function examinationEmptyText(exams, filtered, filters) {
    if (invalidDateRange(filters)) return "Sesuaikan rentang tanggal untuk melihat pemeriksaan.";
    if (!exams.length) return "Belum ada riwayat pemeriksaan.";
    if (!filtered.length) return "Tidak ada pemeriksaan yang sesuai filter.";
    return "Belum ada riwayat pemeriksaan.";
}

function examinationRows(exams) {
    return exams.map(function (item) {
        return '<tr><td>' + formatDateTime(item.waktu_mulai) + '</td><td>' + escapeHtml(item.keluhan) + '</td><td>' + escapeHtml(item.diagnosis) + '</td><td>' + escapeHtml(item.tindakan) + '</td></tr>';
    });
}

function appointmentHistoryPanel(appointments, schedules) {
    ensureHistoryFilters();
    const filters = state.historyFilters.appointments;
    const invalid = invalidDateRange(filters);
    const filtered = invalid ? [] : filterAppointments(appointments, schedules, filters);
    const doctors = [];
    appointments.forEach(function (item) {
        const name = appointmentDoctorLabel(item, schedules);
        if (doctors.indexOf(name) === -1) doctors.push(name);
    });
    doctors.sort(function (left, right) { return left.localeCompare(right, "id"); });
    return '<form class="history-filters" id="appointmentHistoryFilter">' +
        filterField("Status", filterSelect("appointmentStatusFilter", "status", appointmentStatusOptions(appointments), filters.status)) +
        filterField("Check-in", filterSelect("appointmentCheckinFilter", "checkin", [["semua", "Semua"], ["sudah", "Sudah check-in"], ["belum", "Belum check-in"]], filters.checkin)) +
        filterField("Dokter", filterSelect("appointmentDoctorFilter", "doctor", [["semua", "Semua dokter"]].concat(doctors.map(function (name) { return [name, name]; })), filters.doctor)) +
        filterField("Dari tanggal", '<input class="field" id="appointmentFromFilter" name="from" type="date" value="' + escapeHtml(filters.from) + '">') +
        filterField("Sampai tanggal", '<input class="field" id="appointmentToFilter" name="to" type="date" value="' + escapeHtml(filters.to) + '">') +
        filterField("Cari", '<input class="field" id="appointmentQueryFilter" name="query" type="search" maxlength="100" placeholder="Nomor, dokter, atau poli" value="' + escapeHtml(filters.query) + '">') +
        '<div class="history-filter-actions"><button class="button button-secondary" id="appointmentFilterReset" type="button">Atur ulang</button></div></form>' +
        '<p class="filter-summary" id="appointmentFilterSummary" aria-live="polite">' + escapeHtml(appointmentFilterSummary(appointments, filtered, filters)) + '</p>' +
        '<div id="appointmentHistoryResults">' + appointmentTable(filtered, schedules, appointmentEmptyText(appointments, filtered, filters)) + '</div>';
}

function examinationHistoryPanel(exams) {
    ensureHistoryFilters();
    const filters = state.historyFilters.examinations;
    const invalid = invalidDateRange(filters);
    const filtered = invalid ? [] : filterExaminations(exams, filters);
    return '<form class="history-filters" id="examinationHistoryFilter">' +
        filterField("Dari tanggal", '<input class="field" id="examinationFromFilter" name="from" type="date" value="' + escapeHtml(filters.from) + '">') +
        filterField("Sampai tanggal", '<input class="field" id="examinationToFilter" name="to" type="date" value="' + escapeHtml(filters.to) + '">') +
        filterField("Cari", '<input class="field" id="examinationQueryFilter" name="query" type="search" maxlength="100" placeholder="Keluhan, diagnosis, atau tindakan" value="' + escapeHtml(filters.query) + '">') +
        '<div class="history-filter-actions"><button class="button button-secondary" id="examinationFilterReset" type="button">Atur ulang</button></div></form>' +
        '<p class="filter-summary" id="examinationFilterSummary" aria-live="polite">' + escapeHtml(examinationFilterSummary(exams, filtered, filters)) + '</p>' +
        '<div id="examinationHistoryResults">' + table(["Waktu", "Keluhan", "Diagnosis", "Tindakan"], examinationRows(filtered), examinationEmptyText(exams, filtered, filters)) + '</div>';
}

function readNamedFilters(form, defaults) {
    const next = {};
    Object.keys(defaults).forEach(function (key) {
        const field = form.elements.namedItem(key);
        next[key] = field ? field.value : defaults[key];
    });
    return next;
}

function applyFilterValues(form, values) {
    Object.keys(values).forEach(function (key) {
        const field = form.elements.namedItem(key);
        if (field) field.value = values[key];
    });
}

function renderAppointmentHistoryResults() {
    const results = document.getElementById("appointmentHistoryResults");
    const summary = document.getElementById("appointmentFilterSummary");
    if (!results || !summary) return;
    ensureHistoryFilters();
    const appointments = state.data.appointments || [];
    const schedules = state.data.schedules || [];
    const filters = state.historyFilters.appointments;
    const invalid = invalidDateRange(filters);
    const filtered = invalid ? [] : filterAppointments(appointments, schedules, filters);
    summary.textContent = appointmentFilterSummary(appointments, filtered, filters);
    results.innerHTML = appointmentTable(filtered, schedules, appointmentEmptyText(appointments, filtered, filters));
    if (typeof bindCheckInButtons === "function") bindCheckInButtons(results);
}

function renderExaminationHistoryResults() {
    const results = document.getElementById("examinationHistoryResults");
    const summary = document.getElementById("examinationFilterSummary");
    if (!results || !summary) return;
    ensureHistoryFilters();
    const exams = state.data.examinations || [];
    const filters = state.historyFilters.examinations;
    const invalid = invalidDateRange(filters);
    const filtered = invalid ? [] : filterExaminations(exams, filters);
    summary.textContent = examinationFilterSummary(exams, filtered, filters);
    results.innerHTML = table(["Waktu", "Keluhan", "Diagnosis", "Tindakan"], examinationRows(filtered), examinationEmptyText(exams, filtered, filters));
}

function bindPatientHistoryFilters() {
    ensureHistoryFilters();
    const appointmentForm = document.getElementById("appointmentHistoryFilter");
    if (appointmentForm) {
        appointmentForm.addEventListener("submit", function (event) { event.preventDefault(); });
        appointmentForm.addEventListener("input", function () {
            state.historyFilters.appointments = readNamedFilters(appointmentForm, defaultAppointmentFilters());
            renderAppointmentHistoryResults();
        });
        document.getElementById("appointmentFilterReset").addEventListener("click", function () {
            state.historyFilters.appointments = defaultAppointmentFilters();
            applyFilterValues(appointmentForm, state.historyFilters.appointments);
            renderAppointmentHistoryResults();
        });
    }

    const examinationForm = document.getElementById("examinationHistoryFilter");
    if (examinationForm) {
        examinationForm.addEventListener("submit", function (event) { event.preventDefault(); });
        examinationForm.addEventListener("input", function () {
            state.historyFilters.examinations = readNamedFilters(examinationForm, defaultExaminationFilters());
            renderExaminationHistoryResults();
        });
        document.getElementById("examinationFilterReset").addEventListener("click", function () {
            state.historyFilters.examinations = defaultExaminationFilters();
            applyFilterValues(examinationForm, state.historyFilters.examinations);
            renderExaminationHistoryResults();
        });
    }
}

function deviceNotificationSettings() {
    if (!window.isSecureContext || !("Notification" in window)) {
        return '<p class="text-muted">Browser ini tidak mendukung notifikasi perangkat. Buka aplikasi melalui HTTPS atau localhost dengan browser yang mendukung notifikasi.</p>';
    }

    if (Notification.permission === "granted") {
        return '<p class="text-muted">Notifikasi perangkat aktif. Pemberitahuan baru akan muncul saat MedicFlow terbuka, termasuk ketika tab berada di latar.</p>';
    }

    if (Notification.permission === "denied") {
        return '<p class="text-muted">Izin notifikasi diblokir oleh browser. Ubah izin notifikasi MedicFlow melalui pengaturan situs di browser.</p>';
    }

    return '<p class="text-muted">Izinkan browser menampilkan pop-up saat ada panggilan dokter atau obat siap. MedicFlow perlu tetap terbuka di browser.</p>' +
        '<button class="button button-primary" type="button" data-enable-device-notifications>Aktifkan notifikasi perangkat</button>';
}
