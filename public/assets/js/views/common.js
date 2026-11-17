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

function statCards(items) {
    return '<div class="stat-grid">' + items.map(function (item) {
        return '<article class="stat-card"><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong></article>';
    }).join("") + '</div>';
}

function renderNav() {
    const nav = document.getElementById("sideNavigation");
    nav.innerHTML = roleMenus[state.role].map(function (item) {
        return '<button class="nav-item' + (state.page === item[0] ? " active" : "") + '" type="button" data-page="' + item[0] + '">' +
            '<span class="nav-icon">' + item[1] + '</span><span>' + escapeHtml(item[2]) + '</span></button>';
    }).join("");
    nav.querySelectorAll("[data-page]").forEach(function (button) {
        button.addEventListener("click", function () {
            stopCamera();
            state.page = button.dataset.page;
            state.data.pendingPickup = null;
            renderPage();
        });
    });
    document.getElementById("pageTitle").textContent = pageTitles[state.page] || "Dashboard";
    document.getElementById("topRole").textContent = (roleLabels[state.role] || "DASHBOARD").toUpperCase();
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
        const canCheckIn = item.tanggal_kunjungan === localDate && item.status_antrean === "Menunggu" && !item.waktu_check_in;
        const checkIn = canCheckIn
            ? '<button class="button button-primary button-small" data-check-in="' + escapeHtml(item.id_pendaftaran) + '" type="button">Check-in</button>'
            : item.waktu_check_in ? '<span class="text-muted">Sudah check-in</span>' : '<span class="text-muted">—</span>';
        const estimate = item.estimasi_jam_masuk
            ? '<span class="cell-secondary">Perkiraan ' + formatDateTime(item.estimasi_jam_masuk) + '</span>'
            : "";
        return '<tr><td><span class="cell-primary">' + formatDate(item.tanggal_kunjungan) + '</span><span class="cell-secondary">' + escapeHtml(scheduleLabel) + '</span>' + estimate + '</td><td>#' + escapeHtml(item.nomor_antrean) + '</td><td>' + statusBadge(item.status_antrean) + '</td><td>' + checkIn + '</td></tr>';
    });
    return table(["Tanggal & dokter", "Nomor antrean", "Status", "Check-in"], rows, emptyText || "Belum ada pendaftaran antrean.");
}

function notificationList(items) {
    if (!items.length) return '<div class="empty-state">Belum ada notifikasi.</div>';
    return items.map(function (item) {
        return '<article class="notification-card"><span class="notification-dot"></span><div><strong>' + escapeHtml(item.jenis_notifikasi || item.judul || "Informasi MedicFlow") + '</strong><p>' + escapeHtml(item.pesan || item.isi_notifikasi || "") + '</p><time>' + formatDateTime(item.waktu_dikirim || item.created_at) + ' • ' + escapeHtml(item.status || "Pending") + '</time></div></article>';
    }).join("");
}
