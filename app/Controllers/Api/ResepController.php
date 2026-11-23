<?php

namespace App\Controllers\Api;

use App\Models\DetailResepModel;
use App\Models\DokterModel;
use App\Models\PasienModel;
use App\Models\PendaftaranPoliModel;
use App\Models\ResepModel;
use App\Models\JadwalDokterModel;
use App\Models\NotifikasiModel;
use App\Models\MutasiStokModel;
use App\Models\ObatModel;
use Endroid\QrCode\Color\Color;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Writer\SvgWriter;

class ResepController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new ResepModel();
    }

    public function mine()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        $data = $this->model
            ->select('resep.id_resep, resep.id_pendaftaran, resep.waktu_diterbitkan, resep.pilihan_penebusan, resep.estimasi_jam_selesai, resep.status_resep, resep.kadaluarsa_qr')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = resep.id_pendaftaran')
            ->where('pendaftaran_poli.id_pasien', $patientId)
            ->orderBy('resep.waktu_diterbitkan', 'DESC')
            ->findAll();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function pharmacyIndex()
    {
        $db = db_connect();
        $data = $db->table('resep')
            ->select('resep.id_resep, resep.id_pendaftaran, resep.waktu_diterbitkan, resep.pilihan_penebusan, resep.estimasi_jam_selesai, resep.status_resep, resep.kadaluarsa_qr, pendaftaran_poli.id_pasien, pendaftaran_poli.nomor_antrean, pasien.nama_lengkap AS nama_pasien, pasien.no_telepon')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = resep.id_pendaftaran')
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->where('resep.pilihan_penebusan', 'Apotek RS')
            ->orderBy('resep.waktu_diterbitkan', 'DESC')
            ->get()
            ->getResultArray();

        if ($data !== []) {
            $recipeIds = array_column($data, 'id_resep');
            $details = $db->table('detail_resep')
                ->select('detail_resep.id_resep, detail_resep.id_obat, detail_resep.jumlah, detail_resep.dosis_aturan_pakai, obat.nama_obat, obat.satuan')
                ->join('obat', 'obat.id_obat = detail_resep.id_obat')
                ->whereIn('detail_resep.id_resep', $recipeIds)
                ->get()
                ->getResultArray();
            $detailsByRecipe = [];

            foreach ($details as $detail) {
                $detailsByRecipe[$detail['id_resep']][] = $detail;
            }

            foreach ($data as &$recipe) {
                $recipe['detail'] = $detailsByRecipe[$recipe['id_resep']] ?? [];
            }
            unset($recipe);
        }

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function pharmacyShow(int $id)
    {
        $recipe = db_connect()->table('resep')
            ->select('resep.id_resep, resep.id_pendaftaran, resep.waktu_diterbitkan, resep.pilihan_penebusan, resep.estimasi_jam_selesai, resep.status_resep, resep.kadaluarsa_qr, pendaftaran_poli.id_pasien, pendaftaran_poli.nomor_antrean, pasien.nama_lengkap AS nama_pasien')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = resep.id_pendaftaran')
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->where('resep.id_resep', $id)
            ->where('resep.pilihan_penebusan', 'Apotek RS')
            ->get()
            ->getRowArray();

        if (!$recipe) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Resep apotek tidak ditemukan',
            ]);
        }

        $recipe['detail'] = (new DetailResepModel())
            ->select('detail_resep.*, obat.nama_obat, obat.satuan')
            ->join('obat', 'obat.id_obat = detail_resep.id_obat')
            ->where('detail_resep.id_resep', $id)
            ->findAll();

        return $this->response->setJSON(['status' => true, 'data' => $recipe]);
    }

    public function showMine(int $id)
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        $recipe = $this->model
            ->select('resep.id_resep, resep.id_pendaftaran, resep.waktu_diterbitkan, resep.pilihan_penebusan, resep.estimasi_jam_selesai, resep.status_resep, resep.kadaluarsa_qr')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = resep.id_pendaftaran')
            ->where('pendaftaran_poli.id_pasien', $patientId)
            ->where('resep.id_resep', $id)
            ->first();

        if (!$recipe) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Resep tidak ditemukan',
            ]);
        }

        $recipe['detail'] = (new DetailResepModel())
            ->select('detail_resep.*, obat.nama_obat, obat.satuan')
            ->join('obat', 'obat.id_obat = detail_resep.id_obat')
            ->where('detail_resep.id_resep', $id)
            ->findAll();

        return $this->response->setJSON(['status' => true, 'data' => $recipe]);
    }

    public function qrForMine(int $id)
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        $recipe = $this->model
            ->select('resep.id_resep, resep.kode_qr_unik, resep.status_resep, resep.pilihan_penebusan')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = resep.id_pendaftaran')
            ->where('pendaftaran_poli.id_pasien', $patientId)
            ->where('resep.id_resep', $id)
            ->first();

        if (!$recipe) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Resep tidak ditemukan',
            ]);
        }

        if ($recipe['status_resep'] !== 'Siap Diambil' || $recipe['pilihan_penebusan'] !== 'Apotek RS') {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'QR hanya tersedia untuk resep apotek rumah sakit yang siap diambil',
            ]);
        }

        $qrCode = new QrCode(
            data: (string) $recipe['kode_qr_unik'],
            encoding: new Encoding('UTF-8'),
            errorCorrectionLevel: ErrorCorrectionLevel::High,
            size: 320,
            margin: 12,
            foregroundColor: new Color(6, 78, 59),
            backgroundColor: new Color(255, 255, 255),
        );
        if (extension_loaded('gd')) {
            $image = (new PngWriter())->write($qrCode)->getString();
            $contentType = 'image/png';
        } else {
            $image = (new SvgWriter())->write($qrCode)->getString();
            $contentType = 'image/svg+xml';
        }

        return $this->response
            ->setHeader('Content-Type', $contentType)
            ->setHeader('Cache-Control', 'no-store, private')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setBody($image);
    }

    public function selectDispensing(int $id)
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');
        $input = $this->request->getJSON(true);
        $choice = is_array($input) ? ($input['pilihan_penebusan'] ?? null) : null;

        if ($patientId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        if (!in_array($choice, ['Apotek RS', 'Apotek Luar'], true)) {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pilihan penebusan tidak valid atau resep sudah diproses',
            ]);
        }

        $db = db_connect();
        $db->transBegin();
        $recipe = $db->query(
            'SELECT id_resep, id_pendaftaran, status_resep FROM resep WHERE id_resep = ? FOR UPDATE',
            [$id]
        )->getRowArray();

        if (!$recipe) {
            $db->transRollback();
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Resep tidak ditemukan',
            ]);
        }

        $appointment = (new PendaftaranPoliModel())->find($recipe['id_pendaftaran']);
        if (!$appointment || (int) $appointment['id_pasien'] !== $patientId) {
            $db->transRollback();
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Resep tidak ditemukan',
            ]);
        }

        if ($recipe['status_resep'] !== 'Menunggu Pilihan') {
            $db->transRollback();
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pilihan penebusan tidak valid atau resep sudah diproses',
            ]);
        }

        $updates = ['pilihan_penebusan' => $choice];

        if ($choice === 'Apotek RS') {
            $updates['status_resep'] = 'Antrean Farmasi';
        }

        if (!$this->model->update($id, $updates)) {
            $db->transRollback();
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        try {
            $this->recordOperationalActivity(
                'Pilihan penebusan resep',
                'resep',
                $id,
                'Pasien memilih ' . $choice . '.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());
            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pilihan resep gagal dicatat pada log aktivitas',
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();
            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pilihan penebusan resep gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status' => true, 'message' => 'Pilihan penebusan resep berhasil disimpan',
        ]);
    }

    public function createForDoctor()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');
        $input = $this->request->getJSON(true);

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        $appointmentId = is_array($input) ? filter_var($input['id_pendaftaran'] ?? null, FILTER_VALIDATE_INT) : false;
        $details = is_array($input) ? ($input['detail'] ?? null) : null;
        $appointment = $appointmentId !== false
            ? (new PendaftaranPoliModel())->find($appointmentId)
            : null;

        if (!$appointment) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        $schedule = (new JadwalDokterModel())
            ->where('id_jadwal', $appointment['id_jadwal'])
            ->where('id_dokter', $doctorId)
            ->first();

        if (!$schedule) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Resep hanya dapat dibuat untuk pasien pada jadwal Anda',
            ]);
        }

        if ($appointment['status_antrean'] === 'Batal') {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Resep tidak dapat dibuat untuk pendaftaran yang dibatalkan',
            ]);
        }

        if (!is_array($details) || $details === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Resep harus memiliki minimal satu detail obat',
            ]);
        }

        foreach ($details as $detail) {
            if (
                !is_array($detail)
                || filter_var($detail['id_obat'] ?? null, FILTER_VALIDATE_INT) === false
                || filter_var($detail['jumlah'] ?? null, FILTER_VALIDATE_INT) === false
                || (int) $detail['id_obat'] < 1
                || (int) $detail['jumlah'] < 1
                || !is_string($detail['dosis_aturan_pakai'] ?? null)
                || trim($detail['dosis_aturan_pakai']) === ''
            ) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'message' => 'Detail obat resep tidak valid',
                ]);
            }

            if (!(new \App\Models\ObatModel())
                ->where('id_obat', (int) $detail['id_obat'])
                ->where('is_active', 1)
                ->first()) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'message' => 'Obat tidak ditemukan atau tidak aktif',
                ]);
            }
        }

        if ($this->model->where('id_pendaftaran', $appointmentId)->first()) {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Resep untuk pendaftaran ini sudah dibuat',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        $recipeData = [
            'id_pendaftaran'    => (int) $appointmentId,
            'kode_qr_unik'      => bin2hex(random_bytes(32)),
            'waktu_diterbitkan' => date('Y-m-d H:i:s'),
            'pilihan_penebusan' => 'Belum Memilih',
            'status_resep'      => 'Menunggu Pilihan',
        ];

        if (!$this->model->insert($recipeData)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        $recipeId = (int) $this->model->getInsertID();
        $detailModel = new DetailResepModel();

        foreach ($details as $detail) {
            $detailData = [
                'id_resep'           => $recipeId,
                'id_obat'            => (int) $detail['id_obat'],
                'jumlah'             => (int) $detail['jumlah'],
                'dosis_aturan_pakai' => trim($detail['dosis_aturan_pakai']),
            ];

            foreach (['instruksi_racikan', 'catatan'] as $optionalField) {
                if (isset($detail[$optionalField]) && is_string($detail[$optionalField])) {
                    $detailData[$optionalField] = $detail[$optionalField];
                }
            }

            if (!$detailModel->insert($detailData)) {
                $db->transRollback();

                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'errors' => $detailModel->errors(),
                ]);
            }
        }

        try {
            $this->recordOperationalActivity(
                'Pembuatan resep dokter',
                'resep',
                $recipeId,
                'Dokter menerbitkan resep untuk pendaftaran #' . $appointmentId . '.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());
            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pembuatan resep gagal dicatat pada log aktivitas',
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();
            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Resep gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true, 'id_resep' => $recipeId,
        ]);
    }

    public function updatePharmacyStatus(int $id)
    {
        $input = $this->request->getJSON(true);
        $status = is_array($input) ? ($input['status_resep'] ?? null) : null;
        $allowedStatuses = ['Antrean Farmasi', 'Sedang Diracik', 'Siap Diambil', 'Dibatalkan'];

        if (!in_array($status, $allowedStatuses, true)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Status resep tidak valid untuk farmasi',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        $recipe = $db->query(
            'SELECT id_resep, id_pendaftaran, pilihan_penebusan, status_resep FROM resep WHERE id_resep = ? FOR UPDATE',
            [$id]
        )->getRowArray();

        if (!$recipe) {
            $db->transRollback();
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Resep tidak ditemukan',
            ]);
        }

        if ($recipe['status_resep'] === 'Selesai Diambil') {
            $db->transRollback();
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Resep yang sudah diambil tidak dapat diubah',
            ]);
        }

        if ($recipe['pilihan_penebusan'] !== 'Apotek RS') {
            $db->transRollback();
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pasien memilih penebusan di apotek luar',
            ]);
        }

        $currentStatus = $recipe['status_resep'];

        if (
            !in_array($currentStatus, ['Antrean Farmasi', 'Sedang Diracik', 'Siap Diambil'], true)
            || ($currentStatus === 'Siap Diambil' && $status !== 'Siap Diambil')
            || ($currentStatus === 'Sedang Diracik' && $status === 'Antrean Farmasi')
        ) {
            $db->transRollback();
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Perubahan status resep tidak sesuai urutan proses',
            ]);
        }

        if (
            $currentStatus === 'Antrean Farmasi'
            && in_array($status, ['Sedang Diracik', 'Siap Diambil'], true)
        ) {
            $details = (new DetailResepModel())->where('id_resep', $id)->findAll();

            if ($details === []) {
                $db->transRollback();
                return $this->response->setStatusCode(409)->setJSON([
                    'status' => false, 'message' => 'Resep belum memiliki detail obat',
                ]);
            }

            $mutationModel = new MutasiStokModel();
            $userId = (int) $this->currentUser()['id_user'];

            foreach ($details as $detail) {
                $drug = $db->query(
                    'SELECT id_obat, stok_rs, tanggal_kedaluwarsa FROM obat WHERE id_obat = ? FOR UPDATE',
                    [$detail['id_obat']]
                )->getRowArray();

                if (!$drug || (int) $drug['stok_rs'] < (int) $detail['jumlah']) {
                    $db->transRollback();
                    return $this->response->setStatusCode(409)->setJSON([
                        'status' => false, 'message' => 'Stok obat pada resep tidak mencukupi',
                    ]);
                }

                if ($drug['tanggal_kedaluwarsa'] !== null && $drug['tanggal_kedaluwarsa'] < date('Y-m-d')) {
                    $db->transRollback();
                    return $this->response->setStatusCode(409)->setJSON([
                        'status' => false, 'message' => 'Obat pada resep telah kedaluwarsa dan tidak dapat disiapkan',
                    ]);
                }

                $before = (int) $drug['stok_rs'];
                $after = $before - (int) $detail['jumlah'];

                if (!(new ObatModel())->update($drug['id_obat'], ['stok_rs' => $after])) {
                    $db->transRollback();
                    return $this->response->setStatusCode(400)->setJSON([
                        'status' => false, 'message' => 'Stok obat gagal diperbarui',
                    ]);
                }

                if (!$mutationModel->insert([
                    'id_obat'      => $drug['id_obat'],
                    'id_user'      => $userId,
                    'jenis_mutasi' => 'Keluar',
                    'jumlah'       => (int) $detail['jumlah'],
                    'stok_sebelum' => $before,
                    'stok_sesudah' => $after,
                    'keterangan'   => 'Penyiapan resep #' . $id,
                ])) {
                    $db->transRollback();
                    return $this->response->setStatusCode(400)->setJSON([
                        'status' => false, 'errors' => $mutationModel->errors(),
                    ]);
                }

                try {
                    $this->recordOperationalActivity(
                        'Pemakaian stok untuk resep',
                        'obat',
                        (int) $drug['id_obat'],
                        'Resep #' . $id . ': stok berkurang ' . (int) $detail['jumlah'] . ' unit.'
                    );
                } catch (\RuntimeException $exception) {
                    $db->transRollback();
                    log_message('error', $exception->getMessage());
                    return $this->response->setStatusCode(500)->setJSON([
                        'status' => false, 'message' => 'Pemakaian stok gagal dicatat pada log aktivitas',
                    ]);
                }

            }
        }

        if ($currentStatus === 'Sedang Diracik' && $status === 'Dibatalkan') {
            $details = (new DetailResepModel())->where('id_resep', $id)->findAll();
            $mutationModel = new MutasiStokModel();
            $userId = (int) $this->currentUser()['id_user'];

            foreach ($details as $detail) {
                $drug = $db->query(
                    'SELECT id_obat, stok_rs FROM obat WHERE id_obat = ? FOR UPDATE',
                    [$detail['id_obat']]
                )->getRowArray();

                if (!$drug) {
                    $db->transRollback();
                    return $this->response->setStatusCode(409)->setJSON([
                        'status' => false, 'message' => 'Obat resep tidak ditemukan untuk pengembalian stok',
                    ]);
                }

                $before = (int) $drug['stok_rs'];
                $after = $before + (int) $detail['jumlah'];

                if (!(new ObatModel())->update($drug['id_obat'], ['stok_rs' => $after])) {
                    $db->transRollback();
                    return $this->response->setStatusCode(400)->setJSON([
                        'status' => false, 'message' => 'Pengembalian stok obat gagal',
                    ]);
                }

                if (!$mutationModel->insert([
                    'id_obat'      => $drug['id_obat'],
                    'id_user'      => $userId,
                    'jenis_mutasi' => 'Masuk',
                    'jumlah'       => (int) $detail['jumlah'],
                    'stok_sebelum' => $before,
                    'stok_sesudah' => $after,
                    'keterangan'   => 'Pembatalan resep #' . $id,
                ])) {
                    $db->transRollback();
                    return $this->response->setStatusCode(400)->setJSON([
                        'status' => false, 'errors' => $mutationModel->errors(),
                    ]);
                }

                try {
                    $this->recordOperationalActivity(
                        'Pengembalian stok resep dibatalkan',
                        'obat',
                        (int) $drug['id_obat'],
                        'Resep #' . $id . ': stok bertambah ' . (int) $detail['jumlah'] . ' unit.'
                    );
                } catch (\RuntimeException $exception) {
                    $db->transRollback();
                    log_message('error', $exception->getMessage());
                    return $this->response->setStatusCode(500)->setJSON([
                        'status' => false, 'message' => 'Pengembalian stok gagal dicatat pada log aktivitas',
                    ]);
                }
            }
        }

        if (!$this->model->update($id, ['status_resep' => $status])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        if ($status === 'Siap Diambil' && $currentStatus !== 'Siap Diambil') {
            $appointment = (new PendaftaranPoliModel())->find($recipe['id_pendaftaran']);
            $patient = $appointment ? (new PasienModel())->find($appointment['id_pasien']) : null;

            if (!$appointment || !$patient) {
                $db->transRollback();
                return $this->response->setStatusCode(409)->setJSON([
                    'status' => false, 'message' => 'Data pasien untuk resep tidak ditemukan',
                ]);
            }

            $notificationModel = new NotifikasiModel();

            if (!$notificationModel->insert([
                'id_pasien'        => $patient['id_pasien'],
                'id_pendaftaran'   => $appointment['id_pendaftaran'],
                'jenis_notifikasi' => 'Obat Siap',
                'channel'          => 'PWA',
                'nomor_tujuan'     => $patient['no_telepon'],
                'pesan'            => 'Obat Anda sudah siap diambil di farmasi.',
                'status'           => 'Pending',
            ])) {
                $db->transRollback();

                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'errors' => $notificationModel->errors(),
                ]);
            }
        }

        try {
            $this->recordOperationalActivity(
                'Perubahan status resep',
                'resep',
                $id,
                'Status resep diubah dari ' . $currentStatus . ' menjadi ' . $status . '.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());
            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Perubahan resep gagal dicatat pada log aktivitas',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status'  => true,
            'message' => $status === 'Siap Diambil'
                ? 'Status diperbarui dan notifikasi pasien dicatat'
                : 'Status resep diperbarui',
        ]);
    }
}