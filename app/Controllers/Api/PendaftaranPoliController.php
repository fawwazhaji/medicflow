<?php

namespace App\Controllers\Api;

use App\Models\DokterModel;
use App\Models\JadwalDokterModel;
use App\Models\PasienModel;
use App\Models\PendaftaranPoliModel;
use DateTimeImmutable;
use App\Models\NotifikasiModel;

class PendaftaranPoliController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PendaftaranPoliModel();
    }

    public function mine()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        return $this->response->setJSON([
            'status' => true,
            'data'   => $this->model
                ->where('id_pasien', $patientId)
                ->orderBy('tanggal_kunjungan', 'DESC')
                ->findAll(),
        ]);
    }

    public function register()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        $input = $this->request->getJSON(true);
        $date  = is_array($input) ? ($input['tanggal_kunjungan'] ?? null) : null;
        $scheduleId = is_array($input) ? filter_var($input['id_jadwal'] ?? null, FILTER_VALIDATE_INT) : false;
        $note = is_array($input) ? ($input['catatan_pasien'] ?? null) : null;
        $parsedDate = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;

        if (
            $scheduleId === false || $scheduleId < 1
            || !is_string($date) || $parsedDate === false || $parsedDate->format('Y-m-d') !== $date
            || $date < date('Y-m-d')
            || ($note !== null && !is_string($note))
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Jadwal, tanggal kunjungan, atau catatan tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();
        $db->query('SELECT id_pasien FROM pasien WHERE id_pasien = ? FOR UPDATE', [$patientId]);
        $schedule = $db->query(
            'SELECT jadwal_dokter.id_jadwal, jadwal_dokter.id_dokter, jadwal_dokter.hari, ' .
            'jadwal_dokter.jam_mulai, jadwal_dokter.jam_selesai, jadwal_dokter.kuota_maksimal, ' .
            'jadwal_dokter.is_active, dokter.rata_waktu_periksa_menit ' .
            'FROM jadwal_dokter JOIN dokter ON dokter.id_dokter = jadwal_dokter.id_dokter ' .
            'WHERE jadwal_dokter.id_jadwal = ? FOR UPDATE',
            [$scheduleId]
        )->getRowArray();

        if (!$schedule || (int) $schedule['is_active'] !== 1) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status'  => false,
                'message' => 'Jadwal dokter tidak ditemukan atau tidak aktif',
            ]);
        }

        $days = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];

        if ($days[(int) $parsedDate->format('N')] !== $schedule['hari']) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Tanggal kunjungan tidak sesuai dengan hari praktik dokter',
            ]);
        }

        $duplicate = $this->model
            ->where('id_pasien', $patientId)
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->whereNotIn('status_antrean', ['Batal'])
            ->first();

        if ($duplicate) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status'  => false,
                'message' => 'Anda sudah memiliki pendaftaran pada jadwal tersebut',
            ]);
        }

        // Beberapa dokter pada hari yang sama diizinkan, termasuk jika jam praktik bertumpuk.
        // Tabrakan jam hanya ditolak untuk dokter yang sama.
        $sameDoctorOverlap = $db->table('pendaftaran_poli')
            ->select('pendaftaran_poli.id_pendaftaran')
            ->join('jadwal_dokter', 'jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal')
            ->where('pendaftaran_poli.id_pasien', $patientId)
            ->where('pendaftaran_poli.tanggal_kunjungan', $date)
            ->where('pendaftaran_poli.status_antrean !=', 'Batal')
            ->where('jadwal_dokter.id_dokter', $schedule['id_dokter'])
            ->where('jadwal_dokter.jam_mulai <', $schedule['jam_selesai'])
            ->where('jadwal_dokter.jam_selesai >', $schedule['jam_mulai'])
            ->limit(1)
            ->get()
            ->getRowArray();

        if ($sameDoctorOverlap) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false,
                'message' => 'Anda sudah memiliki pendaftaran dengan dokter ini pada jam yang bertabrakan',
            ]);
        }

        $count = $this->model
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->whereNotIn('status_antrean', ['Batal'])
            ->countAllResults();

        if ($count >= (int) $schedule['kuota_maksimal']) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status'  => false,
                'message' => 'Kuota jadwal dokter pada tanggal tersebut sudah penuh',
            ]);
        }

        $maxQueue = $db->table('pendaftaran_poli')
            ->selectMax('nomor_antrean', 'nomor_terakhir')
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->get()
            ->getRowArray();

        $data = [
            'id_pasien'         => $patientId,
            'id_jadwal'         => $scheduleId,
            'tanggal_kunjungan' => $date,
            'nomor_antrean'     => ((int) ($maxQueue['nomor_terakhir'] ?? 0)) + 1,
        ];
        $estimatedTime = new DateTimeImmutable($date . ' ' . $schedule['jam_mulai']);
        $data['estimasi_jam_masuk'] = $estimatedTime
            ->modify('+' . (($data['nomor_antrean'] - 1) * max(1, (int) ($schedule['rata_waktu_periksa_menit'] ?? 15))) . ' minutes')
            ->format('Y-m-d H:i:s');

        if ($note !== null) {
            $data['catatan_pasien'] = $note;
        }

        if (!$this->model->insert($data)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->model->errors(),
            ]);
        }

        $id = $this->model->getInsertID();

        try {
            $this->recordOperationalActivity(
                'Pendaftaran antrean',
                'pendaftaran_poli',
                (int) $id,
                'Pasien mendaftar antrean #' . $data['nomor_antrean'] . ' untuk ' . $date . '.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pendaftaran gagal dicatat pada log aktivitas',
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();
            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pendaftaran antrean gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status'  => true,
            'message' => 'Pendaftaran antrean berhasil',
            'data'    => [
                'id_pendaftaran' => $id,
                'nomor_antrean'  => $data['nomor_antrean'],
                'status_antrean' => 'Menunggu',
            ],
        ]);
    }

    public function updateMine(int $id)
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        $input = $this->request->getJSON(true);
        $date  = is_array($input) ? ($input['tanggal_kunjungan'] ?? null) : null;
        $scheduleId = is_array($input) ? filter_var($input['id_jadwal'] ?? null, FILTER_VALIDATE_INT) : false;
        $parsedDate = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;

        if (
            $scheduleId === false || $scheduleId < 1
            || !is_string($date) || $parsedDate === false || $parsedDate->format('Y-m-d') !== $date
            || $date < date('Y-m-d')
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Jadwal atau tanggal kunjungan tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();
        $db->query('SELECT id_pasien FROM pasien WHERE id_pasien = ? FOR UPDATE', [$patientId]);
        $appointment = $db->query(
            'SELECT id_pendaftaran, id_pasien, id_jadwal, tanggal_kunjungan, status_antrean, nomor_antrean ' .
            'FROM pendaftaran_poli WHERE id_pendaftaran = ? FOR UPDATE',
            [$id]
        )->getRowArray();

        if (!$appointment || (int) $appointment['id_pasien'] !== $patientId) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        if ($appointment['status_antrean'] !== 'Menunggu' || $appointment['tanggal_kunjungan'] < date('Y-m-d')) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false,
                'message' => 'Hanya pendaftaran yang masih menunggu dan belum lewat tanggal yang dapat diubah',
            ]);
        }

        if ($db->table('triase_perawat')->where('id_pendaftaran', $id)->countAllResults() > 0) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false,
                'message' => 'Pendaftaran yang sudah dicatat perawat tidak dapat diubah',
            ]);
        }

        if ((int) $appointment['id_jadwal'] === $scheduleId && $appointment['tanggal_kunjungan'] === $date) {
            $db->transCommit();

            return $this->response->setJSON([
                'status' => true,
                'message' => 'Dokter dan tanggal kunjungan tetap sama',
                'data' => [
                    'id_pendaftaran' => $id,
                    'nomor_antrean' => (int) $appointment['nomor_antrean'],
                    'tanggal_kunjungan' => $date,
                ],
            ]);
        }

        $schedule = $db->query(
            'SELECT jadwal_dokter.id_jadwal, jadwal_dokter.id_dokter, jadwal_dokter.hari, ' .
            'jadwal_dokter.jam_mulai, jadwal_dokter.jam_selesai, jadwal_dokter.kuota_maksimal, ' .
            'jadwal_dokter.is_active, dokter.rata_waktu_periksa_menit ' .
            'FROM jadwal_dokter JOIN dokter ON dokter.id_dokter = jadwal_dokter.id_dokter ' .
            'WHERE jadwal_dokter.id_jadwal = ? FOR UPDATE',
            [$scheduleId]
        )->getRowArray();

        if (!$schedule || (int) $schedule['is_active'] !== 1) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Jadwal dokter tidak ditemukan atau tidak aktif',
            ]);
        }

        $days = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];

        if ($days[(int) $parsedDate->format('N')] !== $schedule['hari']) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Tanggal kunjungan tidak sesuai dengan hari praktik dokter',
            ]);
        }

        $duplicate = $db->table('pendaftaran_poli')
            ->where('id_pasien', $patientId)
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->where('id_pendaftaran !=', $id)
            ->where('status_antrean !=', 'Batal')
            ->countAllResults();

        if ($duplicate > 0) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Anda sudah memiliki pendaftaran pada jadwal tersebut',
            ]);
        }

        $sameDoctorOverlap = $db->table('pendaftaran_poli')
            ->select('pendaftaran_poli.id_pendaftaran')
            ->join('jadwal_dokter', 'jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal')
            ->where('pendaftaran_poli.id_pasien', $patientId)
            ->where('pendaftaran_poli.tanggal_kunjungan', $date)
            ->where('pendaftaran_poli.id_pendaftaran !=', $id)
            ->where('pendaftaran_poli.status_antrean !=', 'Batal')
            ->where('jadwal_dokter.id_dokter', $schedule['id_dokter'])
            ->where('jadwal_dokter.jam_mulai <', $schedule['jam_selesai'])
            ->where('jadwal_dokter.jam_selesai >', $schedule['jam_mulai'])
            ->limit(1)
            ->get()
            ->getRowArray();

        if ($sameDoctorOverlap) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false,
                'message' => 'Anda sudah memiliki pendaftaran dengan dokter ini pada jam yang bertabrakan',
            ]);
        }

        $count = $db->table('pendaftaran_poli')
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->where('id_pendaftaran !=', $id)
            ->where('status_antrean !=', 'Batal')
            ->countAllResults();

        if ($count >= (int) $schedule['kuota_maksimal']) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Kuota jadwal dokter pada tanggal tersebut sudah penuh',
            ]);
        }

        $maxQueue = $db->table('pendaftaran_poli')
            ->selectMax('nomor_antrean', 'nomor_terakhir')
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->get()
            ->getRowArray();
        $queueNumber = ((int) ($maxQueue['nomor_terakhir'] ?? 0)) + 1;
        $estimatedTime = new DateTimeImmutable($date . ' ' . $schedule['jam_mulai']);
        $estimated = $estimatedTime
            ->modify('+' . (($queueNumber - 1) * max(1, (int) ($schedule['rata_waktu_periksa_menit'] ?? 15))) . ' minutes')
            ->format('Y-m-d H:i:s');

        if (!$this->model->update($id, [
            'id_jadwal' => $scheduleId,
            'tanggal_kunjungan' => $date,
            'nomor_antrean' => $queueNumber,
            'estimasi_jam_masuk' => $estimated,
            'waktu_check_in' => null,
        ])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Jadwal kunjungan gagal diubah',
            ]);
        }

        try {
            $this->recordOperationalActivity(
                'Perubahan jadwal kunjungan',
                'pendaftaran_poli',
                $id,
                'Pasien mengubah kunjungan ke jadwal #' . $scheduleId . ' pada ' . $date . '.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Perubahan jadwal gagal dicatat pada log aktivitas',
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Perubahan jadwal kunjungan gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Dokter dan tanggal kunjungan berhasil diubah',
            'data' => [
                'id_pendaftaran' => $id,
                'nomor_antrean' => $queueNumber,
                'tanggal_kunjungan' => $date,
            ],
        ]);
    }

    public function doctorQueue()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->profileNotFound();
        }

        $data = db_connect()->table('pendaftaran_poli')
            ->select(
                'pendaftaran_poli.*, pasien.nama_lengkap AS nama_pasien, pasien.no_telepon, ' .
                'jadwal_dokter.hari, jadwal_dokter.jam_mulai, jadwal_dokter.jam_selesai, ' .
                'triase_perawat.keluhan_awal, triase_perawat.tekanan_darah AS tekanan_darah_awal, ' .
                'triase_perawat.suhu_tubuh AS suhu_tubuh_awal, triase_perawat.berat_badan AS berat_badan_awal, ' .
                'triase_perawat.tinggi_badan AS tinggi_badan_awal, triase_perawat.laju_respirasi AS laju_respirasi_awal, ' .
                'triase_perawat.alergi_obat AS alergi_obat_awal, triase_perawat.catatan_perawat, ' .
                'triase_perawat.waktu_triase, users.nama_lengkap AS nama_perawat'
            )
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->join('jadwal_dokter', 'jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal')
            ->join('triase_perawat', 'triase_perawat.id_pendaftaran = pendaftaran_poli.id_pendaftaran', 'left')
            ->join('users', 'users.id_user = triase_perawat.id_user', 'left')
            ->where('jadwal_dokter.id_dokter', $doctorId)
            ->whereIn('pendaftaran_poli.status_antrean', [
                'Siap Diperiksa', 'Dipanggil', 'Masuk Ruangan', 'Menunggu',
            ])
            ->where('pendaftaran_poli.tanggal_kunjungan >=', date('Y-m-d'))
            ->orderBy("FIELD(pendaftaran_poli.status_antrean, 'Dipanggil', 'Masuk Ruangan', 'Siap Diperiksa', 'Menunggu')", '', false)
            ->orderBy('pendaftaran_poli.tanggal_kunjungan', 'ASC')
            ->orderBy('pendaftaran_poli.nomor_antrean', 'ASC')
            ->get()
            ->getResultArray();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function doctorHistory()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->profileNotFound();
        }

        $data = db_connect()->table('pendaftaran_poli')
            ->select('pendaftaran_poli.*, pasien.nama_lengkap AS nama_pasien, jadwal_dokter.hari, jadwal_dokter.jam_mulai, jadwal_dokter.jam_selesai')
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->join('jadwal_dokter', 'jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal')
            ->where('jadwal_dokter.id_dokter', $doctorId)
            ->groupStart()
                ->whereIn('pendaftaran_poli.status_antrean', ['Selesai Pemeriksaan', 'Batal'])
                ->orWhere('pendaftaran_poli.tanggal_kunjungan <', date('Y-m-d'))
            ->groupEnd()
            ->orderBy('pendaftaran_poli.tanggal_kunjungan', 'DESC')
            ->orderBy('pendaftaran_poli.nomor_antrean', 'DESC')
            ->get()
            ->getResultArray();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function checkIn(int $id)
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        $db = db_connect();
        $db->transBegin();
        $appointment = $db->query(
            'SELECT id_pendaftaran, id_pasien, tanggal_kunjungan, status_antrean, waktu_check_in ' .
            'FROM pendaftaran_poli WHERE id_pendaftaran = ? FOR UPDATE',
            [$id]
        )->getRowArray();

        if (!$appointment || (int) $appointment['id_pasien'] !== $patientId) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        if ($appointment['tanggal_kunjungan'] !== date('Y-m-d') || $appointment['status_antrean'] !== 'Menunggu') {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false,
                'message' => 'Check-in hanya tersedia pada tanggal kunjungan selama status masih Menunggu',
            ]);
        }

        if ($appointment['waktu_check_in'] !== null) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pendaftaran ini sudah check-in',
            ]);
        }

        if (!$this->model->update($id, ['waktu_check_in' => date('Y-m-d H:i:s')])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        try {
            $this->recordOperationalActivity(
                'Check-in pasien',
                'pendaftaran_poli',
                $id,
                'Pasien melakukan check-in kunjungan.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Check-in gagal dicatat pada log aktivitas',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Check-in berhasil. Silakan menunggu panggilan perawat atau dokter.',
        ]);
    }

    public function updateQueueStatus(int $id)
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->profileNotFound();
        }

        $appointment = $this->model->find($id);
        $input = $this->request->getJSON(true);
        $status = is_array($input) ? ($input['status_antrean'] ?? null) : null;

        if (!$appointment) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        $ownsAppointment = (new JadwalDokterModel())
            ->where('id_jadwal', $appointment['id_jadwal'])
            ->where('id_dokter', $doctorId)
            ->first();

        if (!$ownsAppointment) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Pendaftaran bukan pasien pada jadwal Anda',
            ]);
        }

        if (!in_array($status, ['Dipanggil', 'Masuk Ruangan', 'Batal'], true)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Status antrean tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        $lockedAppointment = $db->query(
            'SELECT id_pendaftaran, id_pasien, id_jadwal, nomor_antrean, status_antrean ' .
            'FROM pendaftaran_poli WHERE id_pendaftaran = ? FOR UPDATE',
            [$id]
        )->getRowArray();

        if (!$lockedAppointment) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        $transitions = [
            'Menunggu'       => ['Batal'],
            'Siap Diperiksa' => ['Dipanggil', 'Batal'],
            'Dipanggil'      => ['Masuk Ruangan', 'Batal'],
            'Masuk Ruangan'  => ['Batal'],
            'Selesai Pemeriksaan' => [],
            'Batal'          => [],
        ];

        if (!in_array($status, $transitions[$lockedAppointment['status_antrean']] ?? [], true)) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Perubahan status antrean tidak sesuai urutan',
            ]);
        }

        $updates = ['status_antrean' => $status];

        if (!$this->model->update($id, $updates)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        if (in_array($status, ['Dipanggil', 'Masuk Ruangan'], true)) {
            $patient = (new PasienModel())->find($lockedAppointment['id_pasien']);
            $doctor = (new DokterModel())->where('id_user', $this->currentUser()['id_user'])->first();

            if (!$patient || !$doctor) {
                $db->transRollback();

                return $this->response->setStatusCode(409)->setJSON([
                    'status' => false, 'message' => 'Data pasien atau dokter untuk notifikasi tidak ditemukan',
                ]);
            }

            $notification = new NotifikasiModel();

            if (!$notification->insert([
                'id_pasien'        => $patient['id_pasien'],
                'id_pendaftaran'   => $lockedAppointment['id_pendaftaran'],
                'jenis_notifikasi' => $status === 'Dipanggil' ? 'Pasien Dipanggil' : 'Pasien Masuk Ruangan',
                'channel'          => 'PWA',
                'nomor_tujuan'     => $patient['no_telepon'],
                'pesan'            => $status === 'Dipanggil'
                    ? 'Dokter ' . $doctor['nama_dokter'] .
                        ' memanggil Anda untuk pemeriksaan. Silakan menuju ruang praktik. Nomor antrean #' .
                        $lockedAppointment['nomor_antrean'] . '.'
                    : 'Dokter ' . $doctor['nama_dokter'] .
                        ' mengonfirmasi Anda masuk ruang pemeriksaan. Nomor antrean #' .
                        $lockedAppointment['nomor_antrean'] . '.',
                'status'           => 'Pending',
            ])) {
                $db->transRollback();

                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'errors' => $notification->errors(),
                ]);
            }
        }

        try {
            $this->recordOperationalActivity(
                'Perubahan status antrean',
                'pendaftaran_poli',
                $id,
                'Status antrean diubah menjadi ' . $status . '.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Perubahan antrean gagal dicatat pada log aktivitas',
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Perubahan antrean gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status' => true,
            'message' => in_array($status, ['Dipanggil', 'Masuk Ruangan'], true)
                ? 'Status diperbarui dan notifikasi pasien berhasil dicatat'
                : 'Status antrean diperbarui',
        ]);
    }

    private function profileNotFound()
    {
        return $this->response->setStatusCode(403)->setJSON([
            'status'  => false,
            'message' => 'Profil yang terhubung ke akun tidak ditemukan',
        ]);
    }
}