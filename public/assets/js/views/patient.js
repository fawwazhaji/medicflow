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
            statCards([
                ["Pendaftaran aktif", upcoming.length, "Kunjungan yang belum selesai"],
                ["Pemeriksaan", exams.length, "Catatan yang sudah dibuat dokter"],
                ["Resep", recipes.length, "Resep yang pernah diterbitkan"],
                ["Notifikasi", notifications.length, "Pemberitahuan tersimpan"]
            ]) +
            panel("Informasi kesehatan", factList([
                ["Alergi", clinicalHistory.alergi],
                ["Alergi obat", clinicalHistory.alergi_obat],
                ["Obat yang sedang dipakai", clinicalHistory.obat_aktif]
            ]) + '<p class="text-muted">Alergi obat dicatat saat pemeriksaan. Alergi lain dan obat yang sedang dipakai diubah oleh dokter.</p>', "Ringkas, tanpa perlu membuka riwayat") +
            panel("Notifikasi perangkat", deviceNotificationSettings(), "Tampilkan pemberitahuan di perangkat ini") +
            panel("Praktik hari ini", todayScheduleList(schedules), "Jadwal per hari ada pada tombol di menu Antrean & jadwal") +
            panel("Pendaftaran terbaru", appointmentTable(appointments.slice(0, 5), schedules), "Status antrean kunjungan Anda") +
            panel("Notifikasi terbaru", notificationList(notifications.slice(0, 4)), "Informasi dari layanan MedicFlow");
    }
    if (state.page === "appointments") {
        return '<div class="page-intro"><div><h2>Jadwalkan kunjungan</h2><p>Pilih hari praktik dari Senin sampai Minggu, isi tanggal kunjungan sendiri, lalu daftar. Satu hari boleh berisi lebih dari satu dokter.</p></div></div>' +
            panel("Daftar antrean baru", '<form id="appointmentForm" class="inline-form">' +
                '<div class="schedule-picker"><span class="field-label" id="schedulePickerLabel">Dokter dan hari praktik</span>' +
                '<button class="button button-secondary button-small schedule-picker-button" id="openSchedulePicker" type="button" aria-haspopup="dialog" aria-controls="scheduleMonthDialog">Pilih jadwal</button>' +
                '<div class="schedule-selection" id="scheduleSelection"><p class="schedule-selection-empty">Belum ada jadwal yang dipilih.</p></div>' +
                '<input type="hidden" id="scheduleId" name="id_jadwal">' +
                '<input type="hidden" id="scheduleDay">' +
                '<div class="schedule-date-field"><label class="field-label" for="visitDate">Tanggal kunjungan</label><input class="field" id="visitDate" name="tanggal_kunjungan" type="date" min="' + localDateValue(new Date()) + '" required><p class="field-hint" id="visitDateHint">Isi tanggal sendiri. Tanggal harus jatuh pada hari praktik yang dipilih.</p></div></div>' +
                '<div><label class="field-label" for="visitNote">Catatan (opsional)</label><input class="field" id="visitNote" name="catatan_pasien" maxlength="500" placeholder="Keluhan singkat"></div>' +
                '<button class="button button-primary" type="submit">Daftar antrean</button></form>' +
                weekdayScheduleDialog(schedules), "Pilih hari praktik, lalu isi tanggal kunjungan") +
            panel("Riwayat pendaftaran", appointmentHistoryPanel(appointments, schedules), "Pendaftaran yang masih menunggu dapat diubah dokter atau tanggalnya");
    }
    if (state.page === "examinations") {
        return '<div class="page-intro"><div><h2>Riwayat pemeriksaan</h2><p>Setiap catatan menampilkan dokter, poliklinik, keluhan, diagnosis, tindakan, dan tanda vital. Laporan dapat diunduh sebagai PDF atau Excel.</p></div></div>' +
            panel("Pemeriksaan Anda", examinationHistoryPanel(exams), "Unduhan mengikuti filter tanggal. Jika tanggal kosong, laporan mencakup 366 hari terakhir.");
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
const practiceDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function localWeekdayName(date) {
    return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][date.getDay()];
}

function localDateValue(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function visitDateMatchesDay(dateValue, dayName) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || "")) || !dayName) return false;
    const parsed = new Date(dateValue + "T00:00:00");
    return !Number.isNaN(parsed.getTime()) && localWeekdayName(parsed) === dayName;
}

function scheduleTimeLabel(item) {
    return String(item.jam_mulai || "").slice(0, 5) + "–" + String(item.jam_selesai || "").slice(0, 5);
}

function sortedSchedules(schedules) {
    return schedules.slice().sort(function (left, right) {
        const day = practiceDays.indexOf(left.hari) - practiceDays.indexOf(right.hari);
        if (day !== 0) return day;
        const time = String(left.jam_mulai).localeCompare(String(right.jam_mulai));
        if (time !== 0) return time;
        return String(left.nama_dokter || "").localeCompare(String(right.nama_dokter || ""), "id");
    });
}

function scheduleSlotCard(item, pickable) {
    const detail = (item.nama_poli || "Poliklinik") + (item.spesialisasi ? " • " + item.spesialisasi : "");
    const when = item.hari;
    const hours = scheduleTimeLabel(item) + " • Kuota " + item.kuota_maksimal;
    const label = [item.nama_dokter || "Dokter", detail, when, hours].join(" • ");
    const action = pickable
        ? '<button class="button button-secondary button-small" type="button" data-pick-schedule="' + escapeHtml(item.id_jadwal) + '" data-schedule-day="' + escapeHtml(item.hari) + '" data-doctor="' + escapeHtml(item.nama_dokter || "Dokter") + '" data-clinic="' + escapeHtml(detail) + '" data-when="' + escapeHtml(when) + '" data-hours="' + escapeHtml(hours) + '" data-schedule-label="' + escapeHtml(label) + '">Pilih</button>'
        : "";
    return '<article class="schedule-slot"><div><strong>' + escapeHtml(item.nama_dokter || "Dokter") + '</strong><span>' + escapeHtml(detail) + '</span><span>' + escapeHtml(scheduleTimeLabel(item)) + " • Kuota " + escapeHtml(item.kuota_maksimal) + '</span></div>' + action + '</article>';
}

function weekdayScheduleDialog(schedules) {
    const ordered = sortedSchedules(schedules);
    const sections = practiceDays.map(function (dayName) {
        const slots = ordered.filter(function (item) { return item.hari === dayName; });
        const body = slots.length
            ? slots.map(function (item) { return scheduleSlotCard(item, true); }).join("")
            : '<p class="schedule-empty">Tidak ada praktik</p>';
        return '<section class="schedule-month-day"><h4>' + escapeHtml(dayName) + "</h4>" + body + "</section>";
    });
    const note = "Senin sampai Minggu • " + ordered.length + " sesi praktik. Tanggal kunjungan diisi sendiri.";
    const body = schedules.length
        ? sections.join("")
        : '<div class="empty-state">Belum ada jadwal dokter yang aktif.</div>';
    return '<dialog class="schedule-dialog" id="scheduleMonthDialog" aria-labelledby="scheduleMonthTitle"><div class="schedule-dialog-head"><div><h3 id="scheduleMonthTitle">Jadwal dokter</h3><p id="scheduleDialogNote" data-default-note="' + escapeHtml(note) + '">' + escapeHtml(note) + '</p></div><button class="button button-secondary button-small" type="button" data-close-schedule>Tutup</button></div><div class="schedule-visit-date" id="scheduleVisitDateWrap" hidden><label class="field-label" for="scheduleVisitDate">Tanggal kunjungan</label><input class="field" id="scheduleVisitDate" type="date"><p class="field-hint">Isi tanggal yang jatuh pada hari praktik yang dipilih.</p></div><div class="schedule-month">' + body + "</div></dialog>";
}

function updateVisitDateHint(dayName) {
    const hint = document.getElementById("visitDateHint");
    if (!hint) return;
    hint.textContent = dayName
        ? "Isi tanggal yang jatuh pada hari " + dayName + "."
        : "Isi tanggal sendiri. Tanggal harus jatuh pada hari praktik yang dipilih.";
}

function showScheduleChoice(choice) {
    const summary = document.getElementById("scheduleSelection");
    const opener = document.getElementById("openSchedulePicker");
    if (opener) opener.textContent = "Ubah jadwal";
    if (!summary) return;
    summary.innerHTML = '<div class="schedule-choice"><strong>' + escapeHtml(choice.doctor || "Dokter") + '</strong><span>' + escapeHtml(choice.clinic || "") + '</span><span>' + escapeHtml((choice.when || "") + " • " + (choice.hours || "")) + '</span></div>';
}

function todayScheduleList(schedules) {
    const todayName = localWeekdayName(new Date());
    const slots = sortedSchedules(schedules).filter(function (item) { return item.hari === todayName; });
    if (!slots.length) return '<div class="empty-state">Tidak ada praktik dokter pada hari ' + escapeHtml(todayName) + '.</div>';
    return '<div class="schedule-list">' + slots.map(function (item) { return scheduleSlotCard(item, false); }).join("") + '</div>';
}

function defaultAppointmentFilters() {
    return { status: "semua", doctor: "semua", from: "", to: "", query: "" };
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
        return includesQuery(filters.query, [item.keluhan, item.diagnosis, item.tindakan, item.catatan_dokter, item.alergi_obat, item.laju_respirasi, item.waktu_mulai, item.nama_dokter, item.nama_poli, item.tekanan_darah]);
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

function examinationVitals(item) {
    const parts = [];
    if (item.tekanan_darah) parts.push("TD " + item.tekanan_darah);
    if (item.suhu_tubuh) parts.push("suhu " + item.suhu_tubuh + " °C");
    if (item.laju_respirasi) parts.push("respirasi " + item.laju_respirasi + " x/menit");
    if (item.berat_badan) parts.push("berat " + item.berat_badan + " kg");
    if (item.tinggi_badan) parts.push("tinggi " + item.tinggi_badan + " cm");
    return parts.length ? parts.join(", ") : "—";
}

function examinationCards(exams) {
    if (!exams.length) return "";
    return '<div class="stack">' + exams.map(function (item) {
        const doctor = (item.nama_dokter || "Dokter") + (item.nama_poli ? " • " + item.nama_poli : "");
        const finished = item.waktu_selesai ? " – " + formatDateTime(item.waktu_selesai) : "";
        return '<article class="info-card"><h4>' + escapeHtml(doctor) + '</h4>' +
            '<p>' + formatDateTime(item.waktu_mulai) + finished + '</p>' +
            '<p><strong>Keluhan:</strong> ' + escapeHtml(item.keluhan || "—") + '</p>' +
            '<p><strong>Diagnosis:</strong> ' + escapeHtml(item.diagnosis || "—") + '</p>' +
            '<p><strong>Tindakan:</strong> ' + escapeHtml(item.tindakan || "—") + '</p>' +
            '<p><strong>Tanda vital:</strong> ' + escapeHtml(examinationVitals(item)) + '</p>' +
            '<p><strong>Alergi obat:</strong> ' + escapeHtml(item.alergi_obat || "—") + '</p>' +
            (item.catatan_dokter ? '<p><strong>Catatan dokter:</strong> ' + escapeHtml(item.catatan_dokter) + '</p>' : '') +
            '</article>';
    }).join("") + '</div>';
}

function examinationReportRange(filters) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const to = filters.to || localDateValue(today);
    let from = filters.from;
    if (!from) {
        const start = new Date(today);
        start.setDate(start.getDate() - 366);
        from = localDateValue(start);
    }
    if (from > to) throw new Error("Tanggal awal lebih besar dari tanggal akhir.");
    return { from: from, to: to };
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
    return '<div class="report-actions"><button class="button button-primary" type="button" data-download-exam="pdf">Unduh PDF</button><button class="button button-secondary" type="button" data-download-exam="xls">Unduh Excel</button></div>' +
        '<form class="history-filters" id="examinationHistoryFilter">' +
        filterField("Dari tanggal", '<input class="field" id="examinationFromFilter" name="from" type="date" value="' + escapeHtml(filters.from) + '">') +
        filterField("Sampai tanggal", '<input class="field" id="examinationToFilter" name="to" type="date" value="' + escapeHtml(filters.to) + '">') +
        filterField("Cari", '<input class="field" id="examinationQueryFilter" name="query" type="search" maxlength="100" placeholder="Dokter, keluhan, atau diagnosis" value="' + escapeHtml(filters.query) + '">') +
        '<div class="history-filter-actions"><button class="button button-secondary" id="examinationFilterReset" type="button">Atur ulang</button></div></form>' +
        '<p class="filter-summary" id="examinationFilterSummary" aria-live="polite">' + escapeHtml(examinationFilterSummary(exams, filtered, filters)) + '</p>' +
        '<div id="examinationHistoryResults">' + (filtered.length ? examinationCards(filtered) : '<div class="empty-state">' + escapeHtml(examinationEmptyText(exams, filtered, filters)) + '</div>') + '</div>';
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
    if (typeof bindAppointmentEditButtons === "function") bindAppointmentEditButtons(results);
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
    results.innerHTML = filtered.length ? examinationCards(filtered) : '<div class="empty-state">' + escapeHtml(examinationEmptyText(exams, filtered, filters)) + '</div>';
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
    document.querySelectorAll("[data-download-exam]").forEach(function (button) {
        button.addEventListener("click", async function () {
            ensureHistoryFilters();
            button.disabled = true;
            try {
                const range = examinationReportRange(state.historyFilters.examinations);
                await downloadFile(
                    "pasien/laporan/riwayat-pemeriksaan?dari=" + encodeURIComponent(range.from) + "&sampai=" + encodeURIComponent(range.to) + "&format=" + encodeURIComponent(button.dataset.downloadExam),
                    "riwayat-pemeriksaan." + button.dataset.downloadExam
                );
                showToast("Laporan riwayat pemeriksaan berhasil diunduh.", false);
            } catch (error) {
                showToast(error.message, true);
            } finally {
                button.disabled = false;
            }
        });
    });
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
