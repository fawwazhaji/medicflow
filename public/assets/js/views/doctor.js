"use strict";

function renderDoctor() {
    const queue = state.data.queue || [];
    const queueHistory = state.data.queueHistory || [];
    const schedules = state.data.schedules || [];
    const examinations = state.data.examinations || [];
    const medicines = state.data.medicines || [];
    if (state.page === "overview") {
        return '<div class="page-intro"><div><h2>Ringkasan praktik</h2><p>Angka dan antrean di bawah hanya mencakup pasien pada jadwal Anda.</p></div></div>' +
            statCards([
                ["Pasien hari ini", queue.filter(function (item) { return item.tanggal_kunjungan === new Date().toLocaleDateString("sv-SE"); }).length, "Semua status pada jadwal Anda"],
                ["Menunggu", queue.filter(function (item) { return item.tanggal_kunjungan === new Date().toLocaleDateString("sv-SE") && item.status_antrean === "Menunggu"; }).length, "Belum dicatat perawat"],
                ["Siap diperiksa", queue.filter(function (item) { return item.tanggal_kunjungan === new Date().toLocaleDateString("sv-SE") && item.status_antrean === "Siap Diperiksa"; }).length, "Sudah bisa dipanggil"],
                ["Pemeriksaan", examinations.length, "Catatan yang sudah Anda simpan"]
            ]) +
            panel("Antrean aktif", doctorQueueTable(queue.slice(0, 8)), "Kunjungan aktif, tidak termasuk pemeriksaan selesai atau dibatalkan") +
            panel("Riwayat terbaru", doctorHistoryTable(queueHistory.slice(0, 5)), "Kunjungan selesai, batal, atau tanggal yang telah lewat");
    }
    if (state.page === "queue") {
        return '<div class="page-intro"><div><h2>Daftar pasien</h2><p>Perbarui status antrean, lalu catat pemeriksaan pasien.</p></div></div>' +
            panel("Antrean aktif", doctorQueueTable(queue), "Pasien selesai dan batal tersedia pada menu Riwayat antrean");
    }
    if (state.page === "queueHistory") {
        return '<div class="page-intro"><div><h2>Riwayat antrean</h2><p>Daftar kunjungan selesai, batal, atau memiliki tanggal kunjungan yang telah lewat.</p></div></div>' +
            panel("Riwayat kunjungan", doctorHistoryTable(queueHistory), "Riwayat hanya menampilkan pasien pada jadwal praktik Anda");
    }
    if (state.page === "schedules") {
        const rows = schedules.map(function (item) {
            const start = String(item.jam_mulai).slice(0, 5);
            const end = String(item.jam_selesai).slice(0, 5);
            return '<tr><td>' + escapeHtml(item.nama_poli || "—") + '</td><td>' + escapeHtml(item.hari) + '</td><td>' + escapeHtml(start) + '–' + escapeHtml(end) + '</td><td>' + escapeHtml(item.kuota_maksimal) + '</td><td>' + statusBadge(String(item.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td><td><button class="button button-secondary button-small" type="button" data-edit-schedule="' + escapeHtml(item.id_jadwal) + '" data-clinic="' + escapeHtml(item.nama_poli || "") + '" data-day="' + escapeHtml(item.hari) + '" data-start="' + escapeHtml(start) + '" data-end="' + escapeHtml(end) + '" data-quota="' + escapeHtml(item.kuota_maksimal) + '" data-active="' + escapeHtml(String(item.is_active) === "1" ? "1" : "0") + '">Edit</button></td></tr>';
        });
        return '<div class="page-intro"><div><h2>Jadwal praktik</h2><p>Tambahkan jadwal baru, atau tekan Edit untuk mengubah hari, jam, kuota, dan status.</p></div></div>' +
            panel("Tambah jadwal", '<form id="scheduleForm" class="inline-form"><div><label class="field-label" for="scheduleDay">Hari</label><select class="field" name="hari" id="scheduleDay" required><option value="">Pilih hari</option>' + ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(function (day) { return '<option>' + day + '</option>'; }).join("") + '</select></div><div><label class="field-label">Jam mulai</label><input class="field" name="jam_mulai" type="time" required></div><div><label class="field-label">Jam selesai</label><input class="field" name="jam_selesai" type="time" required></div><div><label class="field-label">Kuota maksimal</label><input class="field" name="kuota_maksimal" type="number" min="1" max="500" value="20" required></div><button class="button button-primary" type="submit">Tambah jadwal</button></form>') +
            panel("Jadwal saya", table(["Poli", "Hari", "Jam", "Kuota", "Status", "Aksi"], rows, "Belum ada jadwal praktik.")) +
            panel("Hubungi admin", '<form id="contactAdminForm" class="stack"><p class="text-muted">Sampaikan kebutuhan perubahan jadwal atau kendala praktik. Pesan masuk ke catatan aktivitas administrator.</p><div class="field-wrap"><label class="field-label" for="adminMessage">Pesan</label><textarea class="field textarea" id="adminMessage" name="pesan" rows="3" maxlength="1000" required placeholder="Contoh: Mohon tambahkan jadwal Sabtu sore."></textarea></div><div class="form-actions"><button class="button button-secondary" type="submit">Hubungi admin</button></div></form>') +
            scheduleEditDialog();
    }
    if (state.page === "examinations") {
        const eligible = queue.filter(function (item) {
            return ["Siap Diperiksa", "Dipanggil", "Masuk Ruangan"].includes(item.status_antrean) && item.keluhan_awal;
        });
        const queueOptions = eligible.map(function (item) { return '<option value="' + escapeHtml(item.id_pendaftaran) + '">#' + escapeHtml(item.nomor_antrean) + " • " + escapeHtml(item.nama_pasien) + " • " + formatDate(item.tanggal_kunjungan) + '</option>'; }).join("");
        const medicineOptions = medicines.map(function (item) {
            return '<option value="' + escapeHtml(item.id_obat) + '">' + escapeHtml(item.nama_obat) +
                ' • stok ' + escapeHtml(item.stok_rs) + ' ' + escapeHtml(item.satuan) + '</option>';
        }).join("");
        const form = '<form id="examinationForm" class="form-grid exam-form">' +
            '<div class="field-wrap field-full"><label class="field-label">Pasien</label><select class="field" name="id_pendaftaran" required><option value="">Pilih pasien</option>' + queueOptions + '</select></div>' +
            '<p id="examinationTriageSummary" class="field-full exam-summary">Pilih pasien. Keluhan dan tanda vital dari perawat akan terisi di sini.</p>' +
            '<div class="field-wrap"><label class="field-label">Keluhan</label><textarea class="field textarea" name="keluhan" rows="1" required></textarea></div>' +
            '<div class="field-wrap"><label class="field-label">Diagnosis</label><textarea class="field textarea" name="diagnosis" rows="1" required></textarea></div>' +
            '<div class="field-wrap"><label class="field-label">Tindakan</label><textarea class="field textarea" name="tindakan" rows="1" required></textarea></div>' +
            '<div class="field-wrap"><label class="field-label">Catatan dokter</label><textarea class="field textarea" name="catatan_dokter" rows="1"></textarea></div>' +
            '<div class="field-full exam-vitals">' +
            '<div class="field-wrap"><label class="field-label">Tekanan darah</label><input class="field" name="tekanan_darah" placeholder="120/80"></div>' +
            '<div class="field-wrap"><label class="field-label">Suhu (°C)</label><input class="field" name="suhu_tubuh" type="number" step="0.1"></div>' +
            '<div class="field-wrap"><label class="field-label">Berat (kg)</label><input class="field" name="berat_badan" type="number" step="0.1"></div>' +
            '<div class="field-wrap"><label class="field-label">Tinggi (cm)</label><input class="field" name="tinggi_badan" type="number" step="0.1"></div>' +
            '<div class="field-wrap"><label class="field-label">Respirasi</label><input class="field" name="laju_respirasi" type="number" min="1" max="80" step="1" placeholder="18"></div></div>' +
            '<div class="field-wrap field-full"><label class="field-label">Alergi obat</label><input class="field" name="alergi_obat" maxlength="2000" placeholder="Tidak ada, atau sebutkan obat"></div>' +
            '<div class="field-full exam-prescription">' +
            '<div class="field-wrap"><label class="field-label">Obat (opsional)</label><select class="field" name="id_obat"><option value="">Tidak membuat resep</option>' + medicineOptions + '</select></div>' +
            '<div class="field-wrap"><label class="field-label">Jumlah</label><input class="field" name="jumlah" type="number" min="1"></div>' +
            '<div class="field-wrap"><label class="field-label">Aturan pakai</label><input class="field" name="dosis_aturan_pakai" maxlength="255" placeholder="1 tablet, 3 kali sehari"></div></div>' +
            '<div class="field-full form-actions"><button class="button button-primary" type="submit">Simpan pemeriksaan</button></div></form>';
        const clinicalHistoryForm = '<form id="clinicalHistoryForm" class="form-grid exam-side">' +
            '<div class="field-wrap"><label class="field-label">Alergi</label><textarea class="field textarea" name="alergi" rows="2" maxlength="5000"></textarea></div>' +
            '<div class="field-wrap"><label class="field-label">Alergi obat</label><textarea class="field textarea" name="alergi_obat" rows="2" maxlength="2000" placeholder="Tidak ada, atau sebutkan obat"></textarea></div>' +
            '<div class="field-wrap"><label class="field-label">Obat aktif</label><textarea class="field textarea" name="obat_aktif" rows="2" maxlength="5000"></textarea></div>' +
            '<div class="field-full form-actions"><button class="button button-secondary" type="submit">Simpan riwayat klinis</button></div></form>';
        return '<div class="page-intro"><div><h2>Catat pemeriksaan</h2><p>Pilih pasien, lengkapi diagnosis dan tindakan, lalu simpan. Nilai dari perawat sudah terisi.</p></div></div>' +
            '<div class="split-grid exam-split">' +
            panel("Pemeriksaan baru", form) +
            panel("Riwayat klinis pasien", '<p class="text-muted">Alergi dan obat aktif hanya untuk pasien ini dan dokter yang menanganinya.</p>' + clinicalHistoryForm) +
            '</div>';
    }
    if (state.page === "examHistory") {
        return '<div class="page-intro"><div><h2>Riwayat pemeriksaan</h2><p>Seluruh pemeriksaan yang sudah Anda simpan, beserta tanda vital, catatan, dan resep.</p></div></div>' +
            panel("Catatan pemeriksaan", doctorExamHistory(examinations), examinations.length + " pemeriksaan");
    }
    return '<div class="empty-state">Halaman tidak ditemukan.</div>';
}

function scheduleEditDialog() {
    const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(function (day) {
        return '<option value="' + day + '">' + day + '</option>';
    }).join("");
    return '<dialog class="schedule-dialog schedule-edit-dialog" id="scheduleEditDialog" aria-labelledby="scheduleEditTitle"><form id="scheduleEditForm"><div class="schedule-dialog-head"><div><h3 id="scheduleEditTitle">Ubah jadwal</h3><p id="scheduleEditClinic">Jadwal praktik poli Anda</p></div><button class="button button-secondary button-small" type="button" data-close-schedule-edit>Tutup</button></div><div class="schedule-edit-body"><input type="hidden" name="id_jadwal" id="scheduleEditId"><div class="field-wrap"><label class="field-label" for="scheduleEditDay">Hari</label><select class="field" id="scheduleEditDay" name="hari" required>' + days + '</select></div><div class="exam-vitals schedule-edit-times"><div class="field-wrap"><label class="field-label" for="scheduleEditStart">Jam mulai</label><input class="field" id="scheduleEditStart" name="jam_mulai" type="time" required></div><div class="field-wrap"><label class="field-label" for="scheduleEditEnd">Jam selesai</label><input class="field" id="scheduleEditEnd" name="jam_selesai" type="time" required></div><div class="field-wrap"><label class="field-label" for="scheduleEditQuota">Kuota</label><input class="field" id="scheduleEditQuota" name="kuota_maksimal" type="number" min="1" max="500" required></div></div><div class="field-wrap"><label class="field-label" for="scheduleEditStatus">Status</label><select class="field" id="scheduleEditStatus" name="is_active"><option value="1">Aktif</option><option value="0">Tidak aktif</option></select></div><div class="form-actions"><button class="button button-primary" type="submit">Simpan jadwal</button></div></div></form></dialog>';
}

function doctorExamHistory(items) {
    if (!items.length) return '<div class="empty-state">Belum ada pemeriksaan.</div>';
    return '<div class="stack">' + items.map(function (item) {
        const visit = formatDate(item.tanggal_kunjungan || item.waktu_mulai) +
            (item.nomor_antrean ? " • Antrean #" + item.nomor_antrean : "") +
            (item.nama_poli ? " • " + item.nama_poli : "");
        const finished = item.waktu_selesai ? " – " + formatDateTime(item.waktu_selesai) : "";
        const recipes = Array.isArray(item.resep) ? item.resep : [];
        const recipeText = recipes.length
            ? recipes.map(function (line) {
                return escapeHtml(line.nama_obat) + " • " + escapeHtml(line.jumlah) + " " + escapeHtml(line.satuan || "") +
                    (line.dosis_aturan_pakai ? " • " + escapeHtml(line.dosis_aturan_pakai) : "") +
                    (line.status_resep ? " • " + escapeHtml(line.status_resep) : "");
            }).join("<br>")
            : "Tidak ada resep";
        return '<article class="info-card"><h4>' + escapeHtml(item.nama_pasien || "Pasien") + '</h4>' +
            '<p>' + escapeHtml(visit) + '</p>' +
            '<p>' + formatDateTime(item.waktu_mulai) + finished + '</p>' +
            '<p><strong>Keluhan:</strong> ' + escapeHtml(item.keluhan || "—") + '</p>' +
            '<p><strong>Diagnosis:</strong> ' + escapeHtml(item.diagnosis || "—") + '</p>' +
            '<p><strong>Tindakan:</strong> ' + escapeHtml(item.tindakan || "—") + '</p>' +
            '<p><strong>Tanda vital:</strong> ' + escapeHtml(examinationVitals(item)) + '</p>' +
            '<p><strong>Alergi obat:</strong> ' + escapeHtml(item.alergi_obat || "—") + '</p>' +
            (item.catatan_dokter ? '<p><strong>Catatan dokter:</strong> ' + escapeHtml(item.catatan_dokter) + '</p>' : '') +
            '<p><strong>Resep:</strong><br>' + recipeText + '</p></article>';
    }).join("") + '</div>';
}

function renderDoctorTriageSummary(appointmentId) {
    const summary = document.getElementById("examinationTriageSummary");
    if (!summary) return;
    const item = (state.data.queue || []).find(function (entry) {
        return String(entry.id_pendaftaran) === String(appointmentId);
    });
    const form = document.getElementById("examinationForm");
    if (!item || !item.keluhan_awal) {
        summary.className = "field-full exam-summary";
        summary.textContent = "Pilih pasien. Keluhan dan tanda vital dari perawat akan terisi di sini.";
        applyNurseNotes(form, null);
        return;
    }
    summary.className = "field-full exam-summary is-filled";
    summary.textContent = "Dicatat " + (item.nama_perawat || "perawat") + " • " + formatDateTime(item.waktu_triase) + ". Keluhan dan tanda vital sudah terisi; ubah hanya jika ada koreksi.";
    applyNurseNotes(form, item);
}

function applyNurseNotes(form, item) {
    if (!form) return;
    const values = item ? {
        keluhan: item.keluhan_awal || "",
        tekanan_darah: item.tekanan_darah_awal || "",
        suhu_tubuh: nurseMeasure(item.suhu_tubuh_awal),
        berat_badan: nurseMeasure(item.berat_badan_awal),
        tinggi_badan: nurseMeasure(item.tinggi_badan_awal),
        laju_respirasi: nurseMeasure(item.laju_respirasi_awal),
        alergi_obat: item.alergi_obat_awal || ""
    } : {
        keluhan: "",
        tekanan_darah: "",
        suhu_tubuh: "",
        berat_badan: "",
        tinggi_badan: "",
        laju_respirasi: "",
        alergi_obat: ""
    };
    Object.keys(values).forEach(function (name) {
        const field = form.elements.namedItem(name);
        if (field) field.value = values[name];
    });
}

function nurseMeasure(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : String(value);
}

function doctorQueueTable(items) {
    const rows = items.map(function (item) {
        const allowed = item.status_antrean === "Siap Diperiksa" ? ["Dipanggil", "Batal"] :
            item.status_antrean === "Dipanggil" ? ["Masuk Ruangan", "Batal"] :
                ["Menunggu", "Masuk Ruangan"].includes(item.status_antrean) ? ["Batal"] : [];
        const select = allowed.length ? '<select class="field" data-queue-status="' + escapeHtml(item.id_pendaftaran) + '" aria-label="Ubah status">' +
            '<option value="">Ubah status</option>' + allowed.map(function (status) { return '<option value="' + escapeHtml(status) + '">' + escapeHtml(status) + '</option>'; }).join("") + '</select>' : '<span class="text-muted">—</span>';
        const triage = item.keluhan_awal
            ? '<span class="cell-secondary">Pemeriksaan awal: ' + escapeHtml(item.keluhan_awal) + ' • TD ' + escapeHtml(item.tekanan_darah_awal) + ' • RR ' + escapeHtml(item.laju_respirasi_awal) + 'x/mnt • Alergi obat: ' + escapeHtml(item.alergi_obat_awal || "—") + ' • Perawat ' + escapeHtml(item.nama_perawat || "—") + '</span>'
            : '<span class="cell-secondary">Belum ada pemeriksaan awal perawat</span>';
        const estimate = item.estimasi_jam_masuk ? '<span class="cell-secondary">Perkiraan ' + formatDateTime(item.estimasi_jam_masuk) + '</span>' : "";
        const checkedIn = item.waktu_check_in ? '<span class="cell-secondary">Check-in ' + formatDateTime(item.waktu_check_in) + '</span>' : "";
        return '<tr><td><span class="cell-primary">' + escapeHtml(item.nama_pasien) + '</span><span class="cell-secondary">' + escapeHtml(item.catatan_pasien || "Tanpa catatan pasien") + '</span>' + estimate + checkedIn + triage + '</td><td>' + formatDate(item.tanggal_kunjungan) + '</td><td>#' + escapeHtml(item.nomor_antrean) + '</td><td>' + statusBadge(item.status_antrean) + '</td><td>' + select + '</td></tr>';
    });
    return table(["Pasien", "Tanggal", "Antrean", "Status", "Tindakan"], rows, "Belum ada pasien pada antrean.");
}

function doctorHistoryTable(items) {
    const rows = items.map(function (item) {
        return '<tr><td>' + escapeHtml(item.nama_pasien) + '</td><td>' + formatDate(item.tanggal_kunjungan) + '</td><td>#' +
            escapeHtml(item.nomor_antrean) + '</td><td>' + statusBadge(item.status_antrean) + '</td></tr>';
    });
    return table(["Pasien", "Tanggal", "Antrean", "Status"], rows, "Belum ada riwayat antrean.");
}

async function loadDoctorClinicalHistory(appointmentId) {
    const form = document.getElementById("clinicalHistoryForm");
    const appointment = (state.data.queue || []).find(function (entry) {
        return String(entry.id_pendaftaran) === String(appointmentId);
    });
    if (!form) return;
    form.reset();
    if (!appointment) return;
    try {
        const result = await request("dokter/kunjungan/" + appointmentId + "/riwayat-klinis");
        const stillSelected = document.querySelector('#examinationForm select[name="id_pendaftaran"]');
        if (!stillSelected || String(stillSelected.value) !== String(appointmentId)) return;
        form.elements.namedItem("alergi").value = result.data.alergi || "";
        form.elements.namedItem("alergi_obat").value = result.data.alergi_obat || "";
        form.elements.namedItem("obat_aktif").value = result.data.obat_aktif || "";
    } catch (error) {
        showToast(error.message, true);
    }
}
