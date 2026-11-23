<?php

namespace App\Controllers\Api;

use App\Models\PendaftaranPoliModel;
use App\Models\RiwayatKlinisPasienModel;
use App\Models\TriasePerawatModel;

class PerawatController extends BaseApiController
{
    public function queue()
    {
        $data = db_connect()->table('pendaftaran_poli')
            ->select(
                'pendaftaran_poli.id_pendaftaran, pendaftaran_poli.tanggal_kunjungan, ' .
                'pendaftaran_poli.nomor_antrean, pendaftaran_poli.status_antrean, ' .
                'pendaftaran_poli.waktu_check_in, pendaftaran_poli.estimasi_jam_masuk, ' .
                'pendaftaran_poli.catatan_pasien, pasien.nama_lengkap AS nama_pasien, ' .
                'jadwal_dokter.hari, jadwal_dokter.jam_mulai, dokter.nama_dokter, ' .
                'triase_perawat.keluhan_awal, triase_perawat.tekanan_darah, ' .
                'triase_perawat.suhu_tubuh, triase_perawat.berat_badan, ' .
                'triase_perawat.tinggi_badan, triase_perawat.laju_respirasi, ' .
                'triase_perawat.alergi_obat, triase_perawat.catatan_perawat, ' .
                'triase_perawat.waktu_triase, users.nama_lengkap AS nama_perawat, ' .
                'riwayat_klinis_pasien.alergi_obat AS alergi_obat_tercatat'
            )
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->join('jadwal_dokter', 'jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal')
            ->join('dokter', 'dokter.id_dokter = jadwal_dokter.id_dokter')
            ->join('triase_perawat', 'triase_perawat.id_pendaftaran = pendaftaran_poli.id_pendaftaran', 'left')
            ->join('users', 'users.id_user = triase_perawat.id_user', 'left')
            ->join('riwayat_klinis_pasien', 'riwayat_klinis_pasien.id_pasien = pasien.id_pasien', 'left')
            ->whereIn('pendaftaran_poli.status_antrean', ['Menunggu', 'Siap Diperiksa'])
            ->where('pendaftaran_poli.tanggal_kunjungan >=', date('Y-m-d'))
            ->orderBy('pendaftaran_poli.tanggal_kunjungan', 'ASC')
            ->orderBy('pendaftaran_poli.waktu_check_in IS NULL', 'ASC', false)
            ->orderBy('pendaftaran_poli.estimasi_jam_masuk', 'ASC')
            ->orderBy('pendaftaran_poli.nomor_antrean', 'ASC')
            ->get()
            ->getResultArray();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function history()
    {
        $data = db_connect()->table('pendaftaran_poli')
            ->select(
                'pendaftaran_poli.id_pendaftaran, pendaftaran_poli.tanggal_kunjungan, ' .
                'pendaftaran_poli.nomor_antrean, pendaftaran_poli.status_antrean, ' .
                'pendaftaran_poli.waktu_check_in, pendaftaran_poli.catatan_pasien, ' .
                'pasien.nama_lengkap AS nama_pasien, jadwal_dokter.hari, ' .
                'jadwal_dokter.jam_mulai, jadwal_dokter.jam_selesai, dokter.nama_dokter, ' .
                'poliklinik.nama_poli, triase_perawat.keluhan_awal, triase_perawat.tekanan_darah, ' .
                'triase_perawat.suhu_tubuh, triase_perawat.berat_badan, triase_perawat.tinggi_badan, ' .
                'triase_perawat.laju_respirasi, triase_perawat.alergi_obat, triase_perawat.catatan_perawat, ' .
                'triase_perawat.waktu_triase, users.nama_lengkap AS nama_perawat'
            )
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->join('jadwal_dokter', 'jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal')
            ->join('dokter', 'dokter.id_dokter = jadwal_dokter.id_dokter')
            ->join('poliklinik', 'poliklinik.id_poli = dokter.id_poli', 'left')
            ->join('triase_perawat', 'triase_perawat.id_pendaftaran = pendaftaran_poli.id_pendaftaran', 'left')
            ->join('users', 'users.id_user = triase_perawat.id_user', 'left')
            ->groupStart()
                ->whereNotIn('pendaftaran_poli.status_antrean', ['Menunggu', 'Siap Diperiksa'])
                ->orWhere('pendaftaran_poli.tanggal_kunjungan <', date('Y-m-d'))
            ->groupEnd()
            ->orderBy('pendaftaran_poli.tanggal_kunjungan', 'DESC')
            ->orderBy('triase_perawat.waktu_triase', 'DESC')
            ->orderBy('pendaftaran_poli.nomor_antrean', 'DESC')
            ->get()
            ->getResultArray();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function recordTriage(int $appointmentId)
    {
        $input = $this->request->getJSON(true);

        if (!$this->validTriageInput($input)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Keluhan awal, tekanan darah, suhu, berat, tinggi, laju respirasi, dan alergi obat wajib valid. Catatan perawat maksimal 2000 karakter.',
            ]);
        }

        $userId = (int) $this->currentUser()['id_user'];
        $db = db_connect();
        $db->transBegin();

        $appointment = $db->query(
            'SELECT id_pendaftaran, id_pasien, tanggal_kunjungan, status_antrean FROM pendaftaran_poli WHERE id_pendaftaran = ? FOR UPDATE',
            [$appointmentId]
        )->getRowArray();

        if (!$appointment) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        if ($appointment['tanggal_kunjungan'] < date('Y-m-d')) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan awal tidak dapat dicatat untuk tanggal kunjungan yang sudah lewat',
            ]);
        }

        if ($appointment['status_antrean'] !== 'Menunggu') {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan awal hanya dapat dicatat untuk pasien berstatus Menunggu',
            ]);
        }

        $triage = new TriasePerawatModel();

        if ($triage->where('id_pendaftaran', $appointmentId)->first()) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan awal untuk pendaftaran ini sudah tercatat',
            ]);
        }

        $data = [
            'id_pendaftaran' => $appointmentId,
            'id_user' => $userId,
            'keluhan_awal' => trim($input['keluhan_awal']),
            'tekanan_darah' => $input['tekanan_darah'],
            'suhu_tubuh' => (float) $input['suhu_tubuh'],
            'berat_badan' => (float) $input['berat_badan'],
            'tinggi_badan' => (float) $input['tinggi_badan'],
            'laju_respirasi' => $this->respirationRate($input['laju_respirasi'] ?? null),
            'alergi_obat' => trim($input['alergi_obat']),
            'catatan_perawat' => isset($input['catatan_perawat']) ? trim($input['catatan_perawat']) : null,
            'waktu_triase' => date('Y-m-d H:i:s'),
        ];

        if (!$triage->insert($data)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $triage->errors(),
            ]);
        }

        if (!(new RiwayatKlinisPasienModel())->saveDrugAllergy((int) $appointment['id_pasien'], $data['alergi_obat'], $userId)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Alergi obat gagal disimpan pada riwayat pasien',
            ]);
        }

        if (!(new PendaftaranPoliModel())->update($appointmentId, ['status_antrean' => 'Siap Diperiksa'])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Status antrean gagal diperbarui',
            ]);
        }

        try {
            $this->recordOperationalActivity(
                'Perubahan status antrean',
                'pendaftaran_poli',
                $appointmentId,
                'Perawat menyelesaikan pemeriksaan awal; status antrean berubah menjadi Siap Diperiksa.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan awal gagal dicatat pada log aktivitas',
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan awal gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true,
            'message' => 'Pemeriksaan awal tersimpan; pasien siap dipanggil dokter',
            'id_triase' => $triage->getInsertID(),
        ]);
    }

    private function validTriageInput($input): bool
    {
        if (
            !is_array($input)
            || !is_string($input['keluhan_awal'] ?? null)
            || trim($input['keluhan_awal']) === ''
            || strlen($input['keluhan_awal']) > 2000
            || !is_string($input['tekanan_darah'] ?? null)
            || !preg_match('/\A\d{2,3}\/\d{2,3}\z/', $input['tekanan_darah'])
            || !is_numeric($input['suhu_tubuh'] ?? null)
            || (float) $input['suhu_tubuh'] < 25
            || (float) $input['suhu_tubuh'] > 45
            || !is_numeric($input['berat_badan'] ?? null)
            || (float) $input['berat_badan'] < 0.1
            || (float) $input['berat_badan'] > 500
            || !is_numeric($input['tinggi_badan'] ?? null)
            || (float) $input['tinggi_badan'] < 30
            || (float) $input['tinggi_badan'] > 250
            || $this->respirationRate($input['laju_respirasi'] ?? null) === null
            || !is_string($input['alergi_obat'] ?? null)
            || trim($input['alergi_obat']) === ''
            || strlen(trim($input['alergi_obat'])) > 2000
            || (isset($input['catatan_perawat']) && (
                !is_string($input['catatan_perawat']) || strlen($input['catatan_perawat']) > 2000
            ))
        ) {
            return false;
        }

        return true;
    }

    private function respirationRate($value): ?int
    {
        if (is_int($value)) {
            $rate = $value;
        } elseif (is_string($value) && preg_match('/\A[1-9]\d*\z/', $value)) {
            $rate = (int) $value;
        } elseif (is_float($value) && floor($value) === $value) {
            $rate = (int) $value;
        } else {
            return null;
        }

        return $rate >= 1 && $rate <= 80 ? $rate : null;
    }
}
