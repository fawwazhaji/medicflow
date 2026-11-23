"use strict";

function renderPharmacy() {
    const medicines = state.data.medicines || [];
    const recipes = state.data.recipes || [];
    const mutations = state.data.mutations || [];
    const lowStock = medicines.filter(function (item) { return Number(item.stok_rs) <= Number(item.stok_minimum); });
    const expiring = medicines.filter(function (item) {
        if (!item.tanggal_kedaluwarsa) return false;
        const days = (new Date(item.tanggal_kedaluwarsa + "T00:00:00") - new Date(new Date().toDateString())) / 86400000;
        return days <= 30;
    });
    const inventoryWarnings = '<div class="info-card' + (lowStock.length || expiring.length ? " is-warning" : "") + '"><strong>Stok dan kedaluwarsa</strong><p>' +
        lowStock.length + ' obat sudah mencapai batas minimum. ' + expiring.length +
        ' obat kedaluwarsa dalam 30 hari atau sudah lewat. Periksa katalog sebelum meracik.</p></div>';
    if (state.page === "overview") {
        return '<div class="page-intro"><div><h2>Operasional farmasi</h2><p>Kelola obat, proses resep, dan catat penyerahan obat kepada pasien.</p></div></div>' +
            statCards([
                ["Resep masuk", recipes.filter(function (item) { return item.status_resep === "Antrean Farmasi"; }).length, "Belum mulai diracik"],
                ["Sedang diracik", recipes.filter(function (item) { return item.status_resep === "Sedang Diracik"; }).length, "Obat sedang disiapkan"],
                ["Obat di katalog", medicines.length, "Termasuk yang tidak aktif"],
                ["Stok menipis", lowStock.length, "Mencapai atau di bawah minimum"]
            ]) +
            inventoryWarnings +
            panel("Resep terbaru", pharmacyRecipeTable(recipes.slice(0, 8)), "Resep dengan pilihan penebusan di apotek rumah sakit");
    }
    if (state.page === "prescriptions") {
        return '<div class="page-intro"><div><h2>Antrean resep</h2><p>Perbarui status untuk meracik obat dan mengirim notifikasi web saat siap.</p></div></div>' +
            panel("Resep masuk", pharmacyRecipeTable(recipes), "Pasien menerima notifikasi di aplikasi saat status menjadi Siap Diambil");
    }
    if (state.page === "medicines") {
        const rows = medicines.map(function (item) {
            const expiry = item.tanggal_kedaluwarsa ? formatDate(item.tanggal_kedaluwarsa) : "Belum dicatat";
            const expired = item.tanggal_kedaluwarsa && item.tanggal_kedaluwarsa < new Date().toLocaleDateString("sv-SE");
            return '<tr><td><span class="cell-primary">' + escapeHtml(item.nama_obat) + '</span><span class="cell-secondary">' + escapeHtml(item.kode_kemenkes || "Tanpa kode") + '</span></td><td>' + escapeHtml(item.jenis_obat) + '</td><td>' + escapeHtml(item.stok_rs) + " " + escapeHtml(item.satuan) + '</td><td>' + escapeHtml(item.stok_minimum) + '</td><td>' + statusBadge(expired ? "Kedaluwarsa" : expiry) + '</td><td>' + statusBadge(String(item.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td><td><button class="button button-secondary button-small" data-edit-medicine="' + escapeHtml(item.id_obat) + '" type="button">Ubah</button></td></tr>';
        });
        return '<div class="page-intro"><div><h2>Katalog obat</h2><p>Stok hanya berubah melalui transaksi mutasi supaya riwayatnya tercatat.</p></div></div>' +
            panel("Tambah obat", '<form id="medicineForm" class="form-grid"><div class="field-wrap"><label class="field-label">Nama obat</label><input class="field" name="nama_obat" required maxlength="150"></div><div class="field-wrap"><label class="field-label">Kode Kemenkes</label><input class="field" name="kode_kemenkes"></div><div class="field-wrap"><label class="field-label">Jenis obat</label><input class="field" name="jenis_obat" required></div><div class="field-wrap"><label class="field-label">Satuan</label><input class="field" name="satuan" required placeholder="tablet, botol"></div><div class="field-wrap"><label class="field-label">Cover BPJS</label><select class="field" name="cover_bpjs"><option value="1">Ya</option><option value="0">Tidak</option></select></div><div class="field-wrap"><label class="field-label">Stok minimum</label><input class="field" name="stok_minimum" type="number" min="0" value="0" required></div><div class="field-wrap"><label class="field-label">Kedaluwarsa terdekat</label><input class="field" name="tanggal_kedaluwarsa" type="date"></div><div class="field-wrap"><label class="field-label">Harga</label><input class="field" name="harga" type="number" min="0" step="0.01" value="0"></div><div class="field-full form-actions"><button class="button button-primary" type="submit">Simpan obat</button></div></form>') +
            panel("Daftar obat", table(["Obat", "Jenis", "Stok", "Minimum", "Kedaluwarsa", "Status", "Aksi"], rows, "Belum ada obat."));
    }
    if (state.page === "stock") {
        const medicineOptions = medicines.map(function (item) { return '<option value="' + escapeHtml(item.id_obat) + '">' + escapeHtml(item.nama_obat) + " • stok " + escapeHtml(item.stok_rs) + '</option>'; }).join("");
        const rows = mutations.map(function (item) { return '<tr><td>' + formatDateTime(item.created_at) + '</td><td>' + escapeHtml(item.nama_obat || ("Obat #" + item.id_obat)) + '</td><td>' + statusBadge(item.jenis_mutasi) + '</td><td>' + escapeHtml(item.jumlah) + '</td><td>' + escapeHtml(item.stok_sebelum) + " → " + escapeHtml(item.stok_sesudah) + '</td><td>' + escapeHtml(item.keterangan) + '</td></tr>'; });
        return '<div class="page-intro"><div><h2>Stok & mutasi</h2><p>Catat obat masuk, keluar, atau penyesuaian stok fisik.</p></div></div>' +
            panel("Catat mutasi stok", '<form id="stockForm" class="inline-form"><div><label class="field-label">Obat</label><select class="field" name="id_obat" required><option value="">Pilih obat</option>' + medicineOptions + '</select></div><div><label class="field-label">Jenis mutasi</label><select class="field" name="jenis_mutasi" required><option value="Masuk">Masuk</option><option value="Keluar">Keluar</option><option value="Penyesuaian">Penyesuaian</option></select></div><div><label class="field-label">Jumlah</label><input class="field" name="jumlah" type="number" min="1" required></div><div><label class="field-label">Keterangan</label><input class="field" name="keterangan" maxlength="255"></div><button class="button button-primary" type="submit">Simpan mutasi</button></form>') +
            panel("Riwayat mutasi", table(["Waktu", "Obat", "Jenis", "Jumlah", "Perubahan stok", "Keterangan"], rows, "Belum ada riwayat mutasi.")) +
            panel("Laporan pengeluaran obat", reportDownloadForm([{ id: "pengeluaran-obat", label: "Laporan pengeluaran obat" }]), "Unduh mutasi keluar pada rentang tanggal sebagai PDF atau Excel");
    }
    if (state.page === "pickup") {
        return '<div class="page-intro"><div><h2>Pengambilan obat</h2><p>Pindai QR pasien, cocokkan rincian obat, lalu konfirmasi setelah obat diserahkan.</p></div></div>' +
            panel("Pindai QR pasien", '<div class="stack"><p class="text-muted">Izinkan akses kamera dan arahkan kamera belakang ke QR pasien. Setelah kode terbaca, periksa nama pasien dan rincian resep sebelum konfirmasi.</p><div class="form-actions"><button class="button button-primary" id="startCamera" type="button">Buka kamera</button><button class="button button-secondary" id="stopCamera" type="button" hidden>Matikan kamera</button></div><div id="qrReader" class="scan-reader" hidden></div><p id="scanMessage" class="scan-message" role="status" aria-live="polite"></p><form id="manualScanForm" class="inline-form"><div><label class="field-label" for="manualQrCode">Kode QR (opsi manual)</label><input class="field" id="manualQrCode" name="kode_qr_unik" autocomplete="off" required placeholder="Masukkan kode hasil pemindaian"></div><button class="button button-secondary" type="submit">Periksa kode</button></form></div>') +
            panel("Rincian resep terverifikasi", '<div id="pickupPreview" class="empty-state">Pindai atau masukkan QR untuk melihat resep.</div><form id="pickupConfirmForm" class="stack" hidden><div class="form-grid"><div class="field-wrap"><label class="field-label" for="pickupTakenBy">Diambil oleh</label><select class="field" id="pickupTakenBy" name="diambil_oleh"><option value="Pasien">Pasien</option><option value="Keluarga">Keluarga</option></select></div><div class="field-wrap" id="pickupNameWrap" hidden><label class="field-label" for="pickupName">Nama pengambil dari keluarga</label><input class="field" id="pickupName" name="nama_pengambil" maxlength="100"></div></div><div class="form-actions"><button class="button button-primary" type="submit">Konfirmasi obat telah diserahkan</button></div></form>') +
            panel("Resep siap diambil", pharmacyRecipeTable(recipes.filter(function (item) { return item.status_resep === "Siap Diambil"; }), false), "Masukkan kode yang ditampilkan pasien untuk menyelesaikan pengambilan.");
    }
    return '<div class="empty-state">Halaman tidak ditemukan.</div>';
}

function pharmacyRecipeTable(items, allowStatus) {
    if (allowStatus === undefined) allowStatus = true;
    const rows = items.map(function (item) {
        const details = item.detail && item.detail.length
            ? '<ul class="recipe-details">' + item.detail.map(function (line) { return '<li>' + escapeHtml(line.nama_obat || ("Obat #" + line.id_obat)) + " • " + escapeHtml(line.jumlah) + " • " + escapeHtml(line.dosis_aturan_pakai) + '</li>'; }).join("") + '</ul>'
            : "";
        const nextStatus = item.status_resep === "Antrean Farmasi" ? ["Sedang Diracik", "Siap Diambil"] :
            item.status_resep === "Sedang Diracik" ? ["Siap Diambil", "Dibatalkan"] : [];
        const action = allowStatus && nextStatus.length
            ? '<select class="field" data-recipe-status="' + escapeHtml(item.id_resep) + '"><option value="">Ubah status</option>' + nextStatus.map(function (status) { return '<option value="' + escapeHtml(status) + '">' + escapeHtml(status) + '</option>'; }).join("") + '</select>'
            : "—";
        return '<tr><td><span class="cell-primary">' + escapeHtml(item.nama_pasien || "Pasien") + '</span><span class="cell-secondary">Resep #' + escapeHtml(item.id_resep) + " • Antrean #" + escapeHtml(item.nomor_antrean) + '</span>' + details + '</td><td>' + formatDateTime(item.waktu_diterbitkan) + '</td><td>' + statusBadge(item.status_resep) + '</td><td>' + (item.status_resep === "Siap Diambil" ? '<span class="cell-secondary">Kode verifikasi tersedia di resep</span>' : escapeHtml(item.pilihan_penebusan || "Apotek RS")) + '</td><td>' + action + '</td></tr>';
    });
    return table(["Pasien / resep", "Diterbitkan", "Status", "Penebusan", "Tindakan"], rows, "Belum ada resep pada daftar ini.");
}

function stopCamera() {
    cameraScanning = false;
    const scanner = qrScanner;
    qrScanner = null;
    if (scanner) {
        const stopped = scanner.isScanning ? scanner.stop() : Promise.resolve();
        stopped.then(function () {
            scanner.clear();
        }).catch(function () {
            showScanMessage("Kamera gagal dimatikan. Muat ulang halaman sebelum mencoba lagi.", true);
        });
    }
    const reader = document.getElementById("qrReader");
    if (reader) reader.hidden = true;
    const startButton = document.getElementById("startCamera");
    const stopButton = document.getElementById("stopCamera");
    if (startButton) startButton.hidden = false;
    if (stopButton) stopButton.hidden = true;
}

function showScanMessage(message, isError) {
    const element = document.getElementById("scanMessage");
    if (!element) return;
    element.textContent = message;
    element.className = "scan-message" + (isError ? " error" : "");
}

async function previewPickupCode(code) {
    state.data.pendingPickup = null;
    const confirmForm = document.getElementById("pickupConfirmForm");
    const preview = document.getElementById("pickupPreview");
    if (confirmForm) confirmForm.hidden = true;
    if (!preview) return;
    preview.className = "loading-card";
    preview.innerHTML = '<span class="spinner"></span> Memeriksa QR dan status resep...';

    try {
        const result = await request("farmasi/pengambilan-obat/preview", {
            method: "POST",
            body: { kode_qr_unik: code }
        });
        const recipe = result.data;
        if (!recipe || !Array.isArray(recipe.detail) || recipe.detail.length === 0) {
            throw new Error("Detail obat resep tidak tersedia. Minta bantuan administrator.");
        }
        state.data.pendingPickup = { recipe: recipe, code: code };
        const details = recipe.detail.map(function (item) {
            return '<li><strong>' + escapeHtml(item.nama_obat) + '</strong> — ' + escapeHtml(item.jumlah) + ' ' + escapeHtml(item.satuan) +
                '<span class="cell-secondary">' + escapeHtml(item.dosis_aturan_pakai) + '</span></li>';
        }).join("");
        preview.className = "pickup-preview";
        preview.innerHTML = '<div class="pickup-patient"><span class="eyebrow">PASIEN</span><strong>' + escapeHtml(recipe.nama_pasien) +
            '</strong><span>Resep #' + escapeHtml(recipe.id_resep) + ' • Antrean #' + escapeHtml(recipe.nomor_antrean) +
            ' • ' + formatDate(recipe.tanggal_kunjungan) + '</span></div><div><span class="eyebrow">STATUS RESEP</span><p>' +
            statusBadge(recipe.status_resep) + '</p></div><div><span class="eyebrow">OBAT YANG DISIAPKAN</span><ul class="pickup-medicine-list">' +
            details + '</ul></div>';
        confirmForm.hidden = false;
        showScanMessage("QR valid. Cocokkan pasien dan obat sebelum penyerahan.", false);
    } catch (error) {
        preview.className = "empty-state";
        preview.textContent = error.message;
        showScanMessage(error.message, true);
    }
}

async function startCameraScan() {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showScanMessage("Kamera hanya tersedia melalui HTTPS atau localhost. Buka aplikasi dengan koneksi aman, atau gunakan input kode manual.", true);
        return;
    }
    if (typeof window.Html5Qrcode !== "function") {
        showScanMessage("Pemindai QR belum termuat. Muat ulang halaman atau gunakan input kode manual.", true);
        return;
    }

    const scanner = new window.Html5Qrcode("qrReader", { verbose: false });
    qrScanner = scanner;
    const reader = document.getElementById("qrReader");
    reader.hidden = false;
    cameraScanning = true;
    document.getElementById("startCamera").hidden = true;
    document.getElementById("stopCamera").hidden = false;
    showScanMessage("Meminta izin kamera...", false);

    try {
        await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async function (decodedText) {
                if (!cameraScanning) return;
                cameraScanning = false;
                stopCamera();
                await previewPickupCode(decodedText.trim());
            },
            function () {}
        );
        showScanMessage("Arahkan kamera ke QR pasien.", false);
    } catch (error) {
        stopCamera();
        const details = error && typeof error.message === "string" ? error.message : String(error);
        showScanMessage("Kamera tidak dapat dibuka: " + details + ". Periksa izin kamera atau gunakan input kode manual.", true);
    }
}
