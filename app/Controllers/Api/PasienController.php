<?php

namespace App\Controllers\Api;

use App\Models\PasienModel;
use App\Models\DokterModel;
use App\Models\RiwayatKlinisPasienModel;
use App\Models\UserModel;

class PasienController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PasienModel();
    }

    public function me()
    {
        $profile = $this->model->where('id_user', $this->currentUser()['id_user'])->first();

        if (!$profile) {
            return $this->response->setStatusCode(404)->setJSON([
                'status'  => false,
                'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data'   => $profile,
        ]);
    }

    public function updateMe()
    {
        $profile = $this->model->where('id_user', $this->currentUser()['id_user'])->first();

        if (!$profile) {
            return $this->response->setStatusCode(404)->setJSON([
                'status'  => false,
                'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        $input = $this->request->getJSON(true);

        if (!is_array($input) || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Data pembaruan tidak boleh kosong',
            ]);
        }

        $data = array_intersect_key($input, array_flip([
            'nomor_bpjs',
            'nama_lengkap',
            'tanggal_lahir',
            'jenis_kelamin',
            'alamat',
            'no_telepon',
        ]));

        if ($data === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Tidak ada field profil yang dapat diperbarui',
            ]);
        }

        if (
            (isset($data['nama_lengkap']) && (!is_string($data['nama_lengkap']) || trim($data['nama_lengkap']) === '' || strlen($data['nama_lengkap']) > 150))
            || (array_key_exists('nomor_bpjs', $data) && $data['nomor_bpjs'] !== null && (!is_string($data['nomor_bpjs']) || strlen($data['nomor_bpjs']) > 20))
            || (isset($data['tanggal_lahir']) && (!is_string($data['tanggal_lahir']) || !$this->isValidDate($data['tanggal_lahir']) || $data['tanggal_lahir'] > date('Y-m-d')))
            || (isset($data['jenis_kelamin']) && !in_array($data['jenis_kelamin'], ['L', 'P'], true))
            || (isset($data['no_telepon']) && (!is_string($data['no_telepon']) || trim($data['no_telepon']) === '' || strlen($data['no_telepon']) > 20))
            || (array_key_exists('alamat', $data) && $data['alamat'] !== null && !is_string($data['alamat']))
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Data profil pasien tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        if (!$this->model->update($profile['id_pasien'], $data)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->model->errors(),
            ]);
        }

        $accountUpdates = array_intersect_key($data, array_flip(['nama_lengkap', 'no_telepon']));

        if ($accountUpdates !== [] && !(new UserModel())->update($profile['id_user'], $accountUpdates)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Data akun pasien gagal diperbarui',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status'  => true,
            'message' => 'Profil pasien berhasil diperbarui',
        ]);
    }

    public function clinicalHistoryMine()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        return $this->response->setJSON([
            'status' => true,
            'data' => $this->clinicalHistory($patientId),
        ]);
    }

    public function clinicalHistoryForDoctor(int $appointmentId)
    {
        $appointment = $this->doctorAppointmentForClinicalHistory($appointmentId);
        if ($appointment === null) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Kunjungan aktif tidak ditemukan pada layanan dokter ini',
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data' => $this->clinicalHistory((int) $appointment['id_pasien']),
        ]);
    }

    public function updateClinicalHistory(int $appointmentId)
    {
        $input = $this->request->getJSON(true);
        if (!is_array($input) || array_diff(array_keys($input), ['alergi', 'alergi_obat', 'obat_aktif']) !== [] || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data alergi atau obat aktif tidak valid',
            ]);
        }

        $data = [];
        foreach (['alergi', 'alergi_obat', 'obat_aktif'] as $field) {
            if (!array_key_exists($field, $input)) {
                continue;
            }
            $limit = $field === 'alergi_obat' ? 2000 : 5000;
            if ($input[$field] !== null && (!is_string($input[$field]) || strlen($input[$field]) > $limit)) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'message' => 'Catatan alergi, alergi obat, atau obat aktif terlalu panjang',
                ]);
            }
            $data[$field] = is_string($input[$field]) && trim($input[$field]) !== ''
                ? trim($input[$field])
                : null;
        }
        $data['id_user_diperbarui'] = (int) $this->currentUser()['id_user'];

        $db = db_connect();
        $db->transBegin();
        $appointment = $this->doctorAppointmentForClinicalHistory($appointmentId, true);
        if ($appointment === null) {
            $db->transRollback();
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Kunjungan aktif tidak ditemukan pada layanan dokter ini',
            ]);
        }

        $patientId = (int) $appointment['id_pasien'];
        $model = new RiwayatKlinisPasienModel();
        $existing = $model->find($patientId);
        $saved = $existing
            ? $model->update($patientId, $data)
            : $model->insert(array_merge(['id_pasien' => $patientId], $data));

        if (!$saved) {
            $db->transRollback();
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $model->errors(),
            ]);
        }

        try {
            $this->recordOperationalActivity(
                'Pembaruan riwayat klinis pasien',
                'riwayat_klinis_pasien',
                $patientId,
                'Dokter memperbarui catatan alergi atau obat aktif.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());
            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Riwayat klinis gagal disimpan pada log aktivitas',
            ]);
        }

        $db->transCommit();
        return $this->response->setJSON([
            'status' => true, 'message' => 'Riwayat klinis pasien berhasil diperbarui',
        ]);
    }

    private function doctorAppointmentForClinicalHistory(int $appointmentId, bool $lock = false): ?array
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');
        if ($doctorId === null) {
            return null;
        }

        $sql = 'SELECT pendaftaran_poli.id_pasien FROM pendaftaran_poli ' .
            'JOIN jadwal_dokter ON jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal ' .
            'WHERE pendaftaran_poli.id_pendaftaran = ? AND jadwal_dokter.id_dokter = ? ' .
            "AND pendaftaran_poli.status_antrean IN ('Siap Diperiksa', 'Dipanggil', 'Masuk Ruangan')" .
            ($lock ? ' FOR UPDATE' : '');

        $appointment = db_connect()->query($sql, [$appointmentId, $doctorId])->getRowArray();

        return is_array($appointment) ? $appointment : null;
    }

    private function clinicalHistory(int $patientId): array
    {
        $record = (new RiwayatKlinisPasienModel())->find($patientId);

        return [
            'id_pasien' => $patientId,
            'alergi' => $record['alergi'] ?? null,
            'alergi_obat' => $record['alergi_obat'] ?? null,
            'obat_aktif' => $record['obat_aktif'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
        ];
    }

    private function profileNotFound()
    {
        return $this->response->setStatusCode(403)->setJSON([
            'status' => false,
            'message' => 'Profil pasien tidak ditemukan',
        ]);
    }

    private function isValidDate(string $date): bool
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);

        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }
}