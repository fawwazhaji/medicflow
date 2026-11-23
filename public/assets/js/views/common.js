"use strict";

function panel(title, body, subtitle) {
    return '<section class="panel"><div class="panel-heading"><div><h3>' + escapeHtml(title) + '</h3>' +
        (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div></div><div class="panel-body">' + body + '</div></section>';
}

function table(headers, rows, emptyText) {
    if (!rows.length) return '<div class="empty-state">' + escapeHtml(emptyText || "Belum ada data.") + '</div>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
        headers.map(function (header) { return '<th>' + escapeHtml(header) + '</th>'; }).join("") +
        '</tr></thead><tbody>' + rows.join("") + '</tbody></table></div>';
}

function statusBadge(status) {
    const value = String(status || "—");
    let color = "badge";
    if (/siap|selesai|berhasil|aktif/i.test(value)) color += " badge-green";
    else if (/batal|tidak aktif|habis/i.test(value)) color += " badge-red";
    else if (/menunggu|antrean|diracik|dipanggil/i.test(value)) color += " badge-yellow";
    else if (/masuk ruangan|pemeriksaan/i.test(value)) color += " badge-blue";
    return '<span class="' + color + '">' + escapeHtml(value) + '</span>';
}

function reportDownloadForm(options) {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startValue = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), "01"].join("-");
    const endValue = [end.getFullYear(), String(end.getMonth() + 1).padStart(2, "0"), String(end.getDate()).padStart(2, "0")].join("-");
    const picker = options.length > 1
        ? filterField("Jenis laporan", '<select class="field" id="reportKind" name="jenis">' + options.map(function (option) {
            return '<option value="' + escapeHtml(option.id) + '">' + escapeHtml(option.label) + '</option>';
        }).join("") + '</select>')
        : '<input id="reportKind" name="jenis" type="hidden" value="' + escapeHtml(options[0].id) + '">';
    return '<form id="reportDownloadForm" class="inline-form">' + picker +
        filterField("Dari tanggal", '<input class="field" id="reportFrom" name="dari" type="date" required value="' + startValue + '">') +
        filterField("Sampai tanggal", '<input class="field" id="reportTo" name="sampai" type="date" required value="' + endValue + '">') +
        '<div class="report-actions"><button class="button button-primary" type="button" data-download-report="pdf">Unduh PDF</button><button class="button button-secondary" type="button" data-download-report="xls">Unduh Excel</button></div></form>';
}

function statCards(items) {
    return '<div class="stat-grid">' + items.map(function (item) {
        return '<article class="stat-card"><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong>' +
            (item[2] ? '<em>' + escapeHtml(item[2]) + '</em>' : '') + '</article>';
    }).join("") + '</div>';
}

function factList(items) {
    return '<dl class="fact-grid">' + items.map(function (item) {
        return '<div><dt>' + escapeHtml(item[0]) + '</dt><dd>' + escapeHtml(item[1] || "Belum dicatat") + '</dd></div>';
    }).join("") + '</dl>';
}

function navIcon(page) {
    const paths = {
        overview: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 10v10h12V10"/>',
        appointments: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>',
        examinations: '<path d="M8 4h8v3a4 4 0 0 1-8 0z"/><path d="M8 5H6.5A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-10A2.5 2.5 0 0 0 17.5 5H16"/>',
        examHistory: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5L15 15"/>',
        prescriptions: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M7 12h10"/>',
        notifications: '<path d="M6 16h12l-1.2-2.1A6 6 0 0 1 16 11V9a4 4 0 0 0-8 0v2a6 6 0 0 1-.8 2.9z"/><path d="M10 18a2 2 0 0 0 4 0"/>',
        profile: '<circle cx="12" cy="8" r="3"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>',
        queue: '<circle cx="9" cy="9" r="2.4"/><circle cx="16" cy="10" r="2"/><path d="M4.5 18.5a4.5 4.5 0 0 1 9 0M13.2 18.5a3.8 3.8 0 0 1 6.3-2.6"/>',
        queueHistory: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5L15 15"/>',
        schedules: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>',
        triage: '<path d="M3 12h4.5l2-6 4 12 2-6H21"/>',
        medicines: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M7 12h10"/>',
        stock: '<path d="M4 8 12 4l8 4-8 4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
        pickup: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
        staff: '<circle cx="9" cy="9" r="2.4"/><circle cx="16" cy="10" r="2"/><path d="M4.5 18.5a4.5 4.5 0 0 1 9 0M13.2 18.5a3.8 3.8 0 0 1 6.3-2.6"/>',
        resources: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
        reports: '<path d="M7 3.5h7l5 5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V9h5M8 13h8M8 17h5"/>'
    };
    return '<svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[page] || paths.overview) + '</svg>';
}

function renderNav() {
    const nav = document.getElementById("sideNavigation");
    nav.innerHTML = roleMenus[state.role].map(function (item) {
        return '<button class="nav-item' + (state.page === item[0] ? " active" : "") + '" type="button" data-page="' + item[0] + '">' +
            '<span class="nav-icon">' + navIcon(item[0]) + '</span><span>' + escapeHtml(item[2]) + '</span></button>';
    }).join("");
    nav.querySelectorAll("[data-page]").forEach(function (button) {
        button.addEventListener("click", function () {
            stopCamera();
            state.page = button.dataset.page;
            state.data.pendingPickup = null;
            if (typeof closeNavigation === "function") closeNavigation();
            renderPage();
        });
    });
    const current = roleMenus[state.role].find(function (item) { return item[0] === state.page; });
    document.getElementById("pageTitle").textContent = current ? current[2] : (pageTitles[state.page] || "Dashboard");
    document.getElementById("topRole").textContent = roleLabels[state.role] || "Pengguna";
}

function profileField(label, name, value, type, required) {
    return '<div class="field-wrap"><label class="field-label" for="profile-' + name + '">' + escapeHtml(label) + '</label><input class="field" id="profile-' + name + '" name="' + name + '" type="' + type + '" value="' + escapeHtml(value) + '"' + (required ? " required" : "") + '></div>';
}

function appointmentTable(items, schedules, emptyText) {
    const rows = items.map(function (item) {
        const schedule = schedules.find(function (entry) { return String(entry.id_jadwal) === String(item.id_jadwal); }) || {};
        const scheduleLabel = (schedule.nama_dokter || "Jadwal #" + item.id_jadwal) + (schedule.nama_poli ? " • " + schedule.nama_poli : "");
        const today = new Date();
        const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
        const canChange = item.status_antrean === "Menunggu" && String(item.tanggal_kunjungan).slice(0, 10) >= localDate;
        const edit = canChange
            ? '<button class="button button-secondary button-small" data-edit-appointment="' + escapeHtml(item.id_pendaftaran) + '" data-visit-date="' + escapeHtml(String(item.tanggal_kunjungan || "").slice(0, 10)) + '" type="button">Ubah</button>'
            : '<span class="text-muted">Tidak dapat diubah</span>';
        const estimate = item.estimasi_jam_masuk
            ? '<span class="cell-secondary">Perkiraan ' + formatDateTime(item.estimasi_jam_masuk) + '</span>'
            : "";
        return '<tr><td><span class="cell-primary">' + formatDate(item.tanggal_kunjungan) + '</span><span class="cell-secondary">' + escapeHtml(scheduleLabel) + '</span>' + estimate + '</td><td>#' + escapeHtml(item.nomor_antrean) + '</td><td>' + statusBadge(item.status_antrean) + '</td><td>' + edit + '</td></tr>';
    });
    return table(["Tanggal & dokter", "Nomor antrean", "Status", "Ubah"], rows, emptyText || "Belum ada pendaftaran antrean.");
}

function notificationList(items) {
    if (!items.length) return '<div class="empty-state">Belum ada notifikasi.</div>';
    return items.map(function (item) {
        return '<article class="notification-card"><span class="notification-dot"></span><div><strong>' + escapeHtml(item.jenis_notifikasi || item.judul || "Informasi MedicFlow") + '</strong><p>' + escapeHtml(item.pesan || item.isi_notifikasi || "") + '</p><time>' + formatDateTime(item.waktu_dikirim || item.created_at) + ' • ' + escapeHtml(item.status || "Pending") + '</time></div></article>';
    }).join("");
}
