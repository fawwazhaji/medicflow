"use strict";

function renderAdmin() {
    if (state.page === "overview") {
        const counts = state.data.counts || {};
        const logs = (state.data.activityLogs || []).slice(0, 10).map(function (item) {
            return '<tr><td>' + formatDateTime(item.created_at) + '</td><td>' + escapeHtml(item.username || ("User #" + item.id_user)) +
                '</td><td>' + escapeHtml(item.aktivitas) + '</td><td>' + escapeHtml(item.tabel_referensi || "—") +
                (item.id_referensi ? " #" + escapeHtml(item.id_referensi) : "") + '</td><td>' + escapeHtml(item.keterangan || "—") + '</td></tr>';
        });
        return '<div class="page-intro"><div><h2>Ringkasan klinik</h2><p>Angka di bawah menghitung data yang tersimpan saat ini.</p></div></div>' +
            statCards([
                ["Akun", counts.users, "Pasien dan staf"],
                ["Pasien", counts.pasien, "Profil yang terdaftar"],
                ["Dokter", counts.dokter, "Yang bisa menerima jadwal"],
                ["Obat", counts.obat, "Item di katalog farmasi"]
            ]) +
            statCards([
                ["Pendaftaran", counts.pendaftaran, "Semua antrean"],
                ["Pemeriksaan", counts.pemeriksaan, "Catatan dokter"],
                ["Resep", counts.resep, "Termasuk yang selesai"],
                ["Poliklinik", counts.poliklinik, "Unit layanan"]
            ]) +
            panel("Hak administrator", '<p class="text-muted">Admin dapat membuat, mengubah, dan menghapus akun semua peran, jadwal praktik dokter, stok obat, serta data operasional lain pada menu Kelola data.</p>') +
            panel("Log aktivitas terbaru", table(["Waktu", "Aktor", "Aktivitas", "Objek", "Keterangan"], logs, "Belum ada aktivitas tercatat."), "10 aktivitas terbaru");
    }
    if (state.page === "staff") {
        const roleFilter = state.data.staffRole || "semua";
        const users = (state.data.staffUsers || []).filter(function (user) {
            return roleFilter === "semua" || user.role === roleFilter;
        });
        const doctors = state.data.staffDoctors || [];
        const clinics = state.data.staffClinics || [];
        const rows = users.map(function (user) {
            const doctor = doctors.find(function (item) { return String(item.id_user) === String(user.id_user); });
            const clinic = doctor && clinics.find(function (item) { return String(item.id_poli) === String(doctor.id_poli); });
            const detail = doctor
                ? escapeHtml(doctor.spesialisasi || "Dokter") + (clinic ? " • " + escapeHtml(clinic.nama_poli) : "")
                : (user.role === "farmasi" ? "Petugas farmasi" : user.role === "perawat" ? "Petugas pemeriksaan awal" : "Administrator");
            const self = state.user && String(state.user.id_user) === String(user.id_user);
            return '<tr><td><span class="cell-primary">' + escapeHtml(user.nama_lengkap) + '</span><span class="cell-secondary">@' + escapeHtml(user.username) + '</span></td><td>' + statusBadge(roleLabels[user.role] || user.role) + '</td><td>' + detail + '</td><td>' + escapeHtml(user.no_telepon || "—") + '</td><td>' + statusBadge(String(user.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td><td class="actions"><button class="button button-secondary button-small" type="button" data-edit-account="' + escapeHtml(user.id_user) + '">Edit</button>' + (self ? '' : '<button class="button button-danger button-small" type="button" data-delete-account="' + escapeHtml(user.id_user) + '">Hapus</button>') + '</td></tr>';
        });
        const activeClinics = clinics.filter(function (clinic) { return String(clinic.is_active) === "1"; });
        const clinicOptions = activeClinics.map(function (clinic) {
            return '<option value="' + escapeHtml(clinic.id_poli) + '">' + escapeHtml(clinic.nama_poli) + '</option>';
        }).join("");
        const accountForm = '<form id="adminAccountForm" class="form-grid">' +
            '<input type="hidden" name="id_user" id="accountId">' +
            '<div class="field-wrap"><label class="field-label" for="accountName">Nama lengkap</label><input class="field" id="accountName" name="nama_lengkap" maxlength="100" required></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountUsername">Username</label><input class="field" id="accountUsername" name="username" maxlength="50" required></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountPassword">Password</label><input class="field" id="accountPassword" name="password" type="password" minlength="10" maxlength="1024" autocomplete="new-password" required><span class="text-muted">Minimal 10 karakter. Kosongkan saat mengubah akun jika password tidak diganti.</span></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountPhone">Telepon</label><input class="field" id="accountPhone" name="no_telepon" maxlength="20"></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountRole">Peran</label><select class="field" id="accountRole" name="role" required><option value="admin">Admin</option><option value="dokter">Dokter</option><option value="perawat">Perawat</option><option value="farmasi">Farmasi</option><option value="pasien">Pasien</option></select></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountActive">Status</label><select class="field" id="accountActive" name="is_active"><option value="1">Aktif</option><option value="0">Tidak aktif</option></select></div>' +
            '<div id="accountDoctorFields" class="field-full form-grid" hidden>' +
            '<div class="field-wrap"><label class="field-label" for="accountSpecialty">Spesialisasi</label><input class="field" id="accountSpecialty" name="spesialisasi" maxlength="100"></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountClinic">Poliklinik</label><select class="field" id="accountClinic" name="id_poli"><option value="">Pilih poliklinik</option>' + clinicOptions + '</select></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountDuration">Waktu periksa (menit)</label><input class="field" id="accountDuration" name="rata_waktu_periksa_menit" type="number" min="1" max="240" value="15"></div></div>' +
            '<div id="accountPatientFields" class="field-full form-grid" hidden>' +
            '<div class="field-wrap"><label class="field-label" for="accountNik">NIK</label><input class="field" id="accountNik" name="nik" inputmode="numeric" minlength="16" maxlength="16"></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountBirth">Tanggal lahir</label><input class="field" id="accountBirth" name="tanggal_lahir" type="date"></div>' +
            '<div class="field-wrap"><label class="field-label" for="accountGender">Jenis kelamin</label><select class="field" id="accountGender" name="jenis_kelamin"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div></div>' +
            '<div class="field-full form-actions"><button class="button button-secondary" id="accountFormReset" type="button">Batal</button><button class="button button-primary" type="submit">Simpan akun</button></div></form>';
        return '<div class="page-intro"><div><h2>Akun pengguna</h2><p>Buat, ubah, atau hapus akun admin, dokter, perawat, farmasi, dan pasien.</p></div></div>' +
            panel("Akun", accountForm, "Dokter baru juga membuat profil praktik. Pasien baru juga membuat profil pasien.") +
            panel("Filter", '<div class="inline-form"><div><label class="field-label" for="staffRoleFilter">Peran</label><select class="field" id="staffRoleFilter"><option value="semua"' + (roleFilter === "semua" ? " selected" : "") + '>Semua</option><option value="admin"' + (roleFilter === "admin" ? " selected" : "") + '>Admin</option><option value="dokter"' + (roleFilter === "dokter" ? " selected" : "") + '>Dokter</option><option value="perawat"' + (roleFilter === "perawat" ? " selected" : "") + '>Perawat</option><option value="farmasi"' + (roleFilter === "farmasi" ? " selected" : "") + '>Farmasi</option><option value="pasien"' + (roleFilter === "pasien" ? " selected" : "") + '>Pasien</option></select></div></div>') +
            panel("Daftar akun (" + users.length + ")", table(["Nama", "Peran", "Detail", "Telepon", "Status", "Aksi"], rows, "Belum ada akun untuk filter ini."));
    }
    if (state.page === "schedules") {
        const doctors = state.data.staffDoctors || [];
        const doctorOptions = doctors.map(function (doctor) {
            return '<option value="' + escapeHtml(doctor.id_dokter) + '">' + escapeHtml(doctor.nama_dokter) + '</option>';
        }).join("");
        const rows = (state.data.schedules || []).map(function (item) {
            const doctor = doctors.find(function (entry) { return String(entry.id_dokter) === String(item.id_dokter); });
            const start = String(item.jam_mulai).slice(0, 5);
            const end = String(item.jam_selesai).slice(0, 5);
            return '<tr><td>' + escapeHtml(doctor ? doctor.nama_dokter : "Dokter #" + item.id_dokter) + '</td><td>' + escapeHtml(item.nama_poli || "—") + '</td><td>' + escapeHtml(item.hari) + '</td><td>' + escapeHtml(start) + '–' + escapeHtml(end) + '</td><td>' + escapeHtml(item.kuota_maksimal) + '</td><td>' + statusBadge(String(item.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td><td class="actions"><button class="button button-secondary button-small" type="button" data-admin-edit-schedule="' + escapeHtml(item.id_jadwal) + '">Edit</button><button class="button button-danger button-small" type="button" data-admin-delete-schedule="' + escapeHtml(item.id_jadwal) + '">Hapus</button></td></tr>';
        });
        const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(function (day) { return '<option value="' + day + '">' + day + '</option>'; }).join("");
        const form = '<form id="adminScheduleForm" class="form-grid"><input type="hidden" name="id_jadwal" id="adminScheduleId"><div class="field-wrap"><label class="field-label" for="adminScheduleDoctor">Dokter</label><select class="field" id="adminScheduleDoctor" name="id_dokter" required><option value="">Pilih dokter</option>' + doctorOptions + '</select></div><div class="field-wrap"><label class="field-label" for="adminScheduleDay">Hari</label><select class="field" id="adminScheduleDay" name="hari" required>' + days + '</select></div><div class="field-wrap"><label class="field-label" for="adminScheduleStart">Jam mulai</label><input class="field" id="adminScheduleStart" name="jam_mulai" type="time" required></div><div class="field-wrap"><label class="field-label" for="adminScheduleEnd">Jam selesai</label><input class="field" id="adminScheduleEnd" name="jam_selesai" type="time" required></div><div class="field-wrap"><label class="field-label" for="adminScheduleQuota">Kuota</label><input class="field" id="adminScheduleQuota" name="kuota_maksimal" type="number" min="1" max="500" value="20" required></div><div class="field-wrap"><label class="field-label" for="adminScheduleActive">Status</label><select class="field" id="adminScheduleActive" name="is_active"><option value="1">Aktif</option><option value="0">Tidak aktif</option></select></div><div class="field-full form-actions"><button class="button button-secondary" id="adminScheduleReset" type="button">Batal</button><button class="button button-primary" type="submit">Simpan jadwal</button></div></form>';
        return '<div class="page-intro"><div><h2>Jadwal praktik</h2><p>Buat, ubah, atau hapus jadwal pemeriksaan setiap dokter.</p></div></div>' +
            panel("Jadwal", form) +
            panel("Daftar jadwal", table(["Dokter", "Poli", "Hari", "Jam", "Kuota", "Status", "Aksi"], rows, "Belum ada jadwal."));
    }
    if (state.page === "stock") {
        const medicines = state.data.medicines || [];
        const medicineOptions = medicines.map(function (item) {
            return '<option value="' + escapeHtml(item.id_obat) + '">' + escapeHtml(item.nama_obat) + ' • stok ' + escapeHtml(item.stok_rs) + '</option>';
        }).join("");
        const rows = medicines.map(function (item) {
            return '<tr><td><span class="cell-primary">' + escapeHtml(item.nama_obat) + '</span><span class="cell-secondary">' + escapeHtml(item.kode_kemenkes || "—") + '</span></td><td>' + escapeHtml(item.stok_rs) + ' ' + escapeHtml(item.satuan) + '</td><td>' + escapeHtml(item.stok_minimum) + '</td><td>' + escapeHtml(item.harga) + '</td><td>' + statusBadge(String(item.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td><td class="actions"><button class="button button-secondary button-small" type="button" data-admin-edit-medicine="' + escapeHtml(item.id_obat) + '">Edit</button><button class="button button-danger button-small" type="button" data-admin-delete-medicine="' + escapeHtml(item.id_obat) + '">Hapus</button></td></tr>';
        });
        const moves = (state.data.mutations || []).slice(0, 8).map(function (item) {
            return '<tr><td>' + formatDateTime(item.created_at) + '</td><td>' + escapeHtml(item.nama_obat || ("Obat #" + item.id_obat)) + '</td><td>' + escapeHtml(item.jenis_mutasi) + '</td><td>' + escapeHtml(item.jumlah) + '</td><td>' + escapeHtml(item.stok_sesudah) + '</td></tr>';
        });
        return '<div class="page-intro"><div><h2>Stok obat</h2><p>Catat obat masuk, keluar, atau penyesuaian stok. Data katalog juga dapat diubah atau dihapus.</p></div></div>' +
            panel("Mutasi stok", '<form id="adminStockForm" class="inline-form"><div><label class="field-label" for="stockDrug">Obat</label><select class="field" id="stockDrug" name="id_obat" required><option value="">Pilih obat</option>' + medicineOptions + '</select></div><div><label class="field-label" for="stockType">Jenis</label><select class="field" id="stockType" name="jenis_mutasi" required><option value="Masuk">Masuk</option><option value="Keluar">Keluar</option><option value="Penyesuaian">Penyesuaian</option></select></div><div><label class="field-label" for="stockAmount">Jumlah</label><input class="field" id="stockAmount" name="jumlah" type="number" min="1" required></div><div><label class="field-label" for="stockNote">Keterangan</label><input class="field" id="stockNote" name="keterangan" maxlength="255"></div><button class="button button-primary" type="submit">Simpan stok</button></form>') +
            panel("Katalog", '<form id="adminMedicineForm" class="form-grid"><input type="hidden" name="id_obat" id="adminMedicineId"><div class="field-wrap"><label class="field-label" for="adminMedicineName">Nama obat</label><input class="field" id="adminMedicineName" name="nama_obat" maxlength="150" required></div><div class="field-wrap"><label class="field-label" for="adminMedicineCode">Kode</label><input class="field" id="adminMedicineCode" name="kode_kemenkes" maxlength="50" required></div><div class="field-wrap"><label class="field-label" for="adminMedicineUnit">Satuan</label><input class="field" id="adminMedicineUnit" name="satuan" maxlength="30" required></div><div class="field-wrap"><label class="field-label" for="adminMedicineMin">Stok minimum</label><input class="field" id="adminMedicineMin" name="stok_minimum" type="number" min="0" value="10" required></div><div class="field-wrap"><label class="field-label" for="adminMedicinePrice">Harga</label><input class="field" id="adminMedicinePrice" name="harga" type="number" min="0" step="0.01" value="0" required></div><div class="field-wrap"><label class="field-label" for="adminMedicineActive">Status</label><select class="field" id="adminMedicineActive" name="is_active"><option value="1">Aktif</option><option value="0">Tidak aktif</option></select></div><div class="field-full form-actions"><button class="button button-secondary" id="adminMedicineReset" type="button">Batal</button><button class="button button-primary" type="submit">Simpan obat</button></div></form><p class="text-muted">Obat baru dimulai dari stok nol. Tambahkan stok lewat mutasi Masuk.</p>') +
            panel("Daftar obat", table(["Obat", "Stok", "Minimum", "Harga", "Status", "Aksi"], rows, "Belum ada obat.")) +
            panel("Mutasi terbaru", table(["Waktu", "Obat", "Jenis", "Jumlah", "Stok akhir"], moves, "Belum ada mutasi."));
    }
    if (state.page === "resources") {
        const selected = state.data.resource || "users";
        const items = state.data.resourceItems || [];
        const headers = items.length ? Object.keys(items[0]).filter(function (key) { return key !== "password_hash"; }) : [];
        const rows = items.map(function (item) {
            const idKey = resourceIdKeys[selected];
            const cells = headers.map(function (key) {
                let value = item[key];
                if (value && typeof value === "object") value = JSON.stringify(value);
                return '<td>' + escapeHtml(value == null ? "—" : String(value).slice(0, 100)) + '</td>';
            }).join("");
            return '<tr>' + cells + '<td class="actions"><button type="button" class="button button-secondary button-small" data-admin-edit="' + escapeHtml(item[idKey]) + '">Muat</button><button type="button" class="button button-danger button-small" data-admin-delete="' + escapeHtml(item[idKey]) + '">Hapus</button></td></tr>';
        });
        const selectOptions = adminResources.map(function (resource) { return '<option value="' + resource[0] + '"' + (resource[0] === selected ? " selected" : "") + '>' + escapeHtml(resource[1]) + '</option>'; }).join("");
        const form = '<div class="stack"><div><label class="field-label" for="resourceSelect">Data yang dikelola</label><select class="field" id="resourceSelect">' + selectOptions + '</select></div>' +
            '<p class="text-muted">Masukkan objek JSON sesuai field API. Untuk mengubah data, pilih baris lalu sesuaikan JSON dan ID.</p>' +
            '<form id="adminResourceForm" class="stack"><div><label class="field-label" for="resourceId">ID untuk pembaruan (kosongkan untuk data baru)</label><input class="field" id="resourceId" name="id" inputmode="numeric"></div><div><label class="field-label" for="resourceJson">Data JSON</label><textarea class="field json-area" id="resourceJson" name="json" required spellcheck="false">{}</textarea></div><div class="form-actions"><button class="button button-secondary" id="clearResourceForm" type="button">Kosongkan</button><button class="button button-primary" type="submit">Simpan data</button></div></form></div>';
        return '<div class="page-intro"><div><h2>Kelola data</h2><p>Pilih jenis data, lalu isi formulir. Untuk mengubah baris yang ada, tekan Muat, sesuaikan isinya, lalu simpan.</p></div></div>' +
            '<div class="split-grid">' + panel("Form data", form) + panel("Panduan field", '<p class="text-muted">Field berbeda untuk setiap resource. Gunakan ID relasi yang tersedia di database. Data akun memerlukan username, password, nama_lengkap, dan role saat dibuat. Password hanya dikirim melalui API dan tidak ditampilkan dalam daftar.</p>') + '</div>' +
            panel("Data " + (adminResources.find(function (resource) { return resource[0] === selected; }) || ["", selected])[1], table(headers.concat(["Aksi"]), rows, "Belum ada data pada resource ini."));
    }
    if (state.page === "reports") {
        return '<div class="page-intro"><div><h2>Laporan operasional</h2><p>Unduh laporan kunjungan atau pengeluaran obat dalam PDF dan Excel.</p></div></div>' +
            panel("Unduh laporan", reportDownloadForm([
                { id: "kunjungan", label: "Laporan kunjungan" },
                { id: "pengeluaran-obat", label: "Laporan pengeluaran obat" }
            ]), "Pilih rentang tanggal, lalu unduh PDF atau Excel") +
            panel("Isi laporan", '<p>Laporan kunjungan memuat antrean pada rentang tanggal, termasuk poliklinik, dokter, status, dan diagnosis bila pemeriksaan sudah dicatat.</p><p>Laporan pengeluaran obat memuat mutasi stok berjenis Keluar, baik dari peracikan resep maupun pengeluaran manual. Lembar rekapitulasi menjumlahkan obat yang keluar.</p>');
    }
    return '<div class="empty-state">Halaman tidak ditemukan.</div>';
}
