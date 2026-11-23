<?php

namespace App\Controllers\Api;

use App\Models\DokterModel;
use App\Models\JadwalDokterModel;

class JadwalDokterController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new JadwalDokterModel();
    }

    public function index()
    {
        $data = db_connect()->table('jadwal_dokter')
            ->select('jadwal_dokter.*, dokter.nama_dokter, dokter.spesialisasi, poliklinik.nama_poli')
            ->join('dokter', 'dokter.id_dokter = jadwal_dokter.id_dokter')
            ->join('poliklinik', 'poliklinik.id_poli = dokter.id_poli')
            ->where('jadwal_dokter.is_active', 1)
            ->where('dokter.is_active', 1)
            ->where('poliklinik.is_active', 1)
            ->orderBy('jadwal_dokter.hari')
            ->orderBy('jadwal_dokter.jam_mulai')
            ->get()
            ->getResultArray();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function mine()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data'   => db_connect()->table('jadwal_dokter')
                ->select('jadwal_dokter.*, poliklinik.nama_poli')
                ->join('dokter', 'dokter.id_dokter = jadwal_dokter.id_dokter')
                ->join('poliklinik', 'poliklinik.id_poli = dokter.id_poli', 'left')
                ->where('jadwal_dokter.id_dokter', $doctorId)
                ->orderBy('jadwal_dokter.id_jadwal', 'ASC')
                ->get()
                ->getResultArray(),
        ]);
    }

    public function create()
    {
        $input = $this->request->getJSON(true);
        $doctorId = is_array($input) ? filter_var($input['id_dokter'] ?? null, FILTER_VALIDATE_INT) : false;
        $data = is_array($input) ? $this->validatedSchedule($input) : null;

        if ($doctorId === false || $doctorId < 1 || $data === null || !(new DokterModel())->find($doctorId)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Dokter, hari, jam, atau kuota jadwal tidak valid',
            ]);
        }

        $data['id_dokter'] = $doctorId;
        $data['is_active'] = $data['is_active'] ?? 1;
        if ((int) $data['is_active'] === 1 && $this->hasScheduleConflict($doctorId, $data)) {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Jadwal bertabrakan dengan jadwal praktik lain pada hari dan jam tersebut',
            ]);
        }

        if (!$this->model->insert($data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        $id = (int) $this->model->getInsertID();
        $this->recordOperationalActivity('Admin membuat jadwal', 'jadwal_dokter', $id, 'Admin membuat jadwal dokter.');

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true, 'message' => 'Jadwal berhasil ditambahkan', 'id' => $id,
        ]);
    }

    public function update($id)
    {
        $schedule = $this->model->find($id);
        $input = $this->request->getJSON(true);

        if (!$schedule) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Jadwal tidak ditemukan',
            ]);
        }

        if (!is_array($input) || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data pembaruan tidak valid',
            ]);
        }

        $merged = array_merge($schedule, $input);
        $data = $this->validatedSchedule($merged);
        $doctorId = filter_var($merged['id_dokter'] ?? null, FILTER_VALIDATE_INT);

        if ($data === null || $doctorId === false || $doctorId < 1 || !(new DokterModel())->find($doctorId)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Dokter, hari, jam, atau kuota jadwal tidak valid',
            ]);
        }

        $data['id_dokter'] = $doctorId;
        if ((int) ($data['is_active'] ?? $schedule['is_active']) === 1 && $this->hasScheduleConflict($doctorId, array_merge($schedule, $data), (int) $id)) {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Jadwal bertabrakan dengan jadwal praktik lain pada hari dan jam tersebut',
            ]);
        }

        if (!$this->model->update($id, $data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        $this->recordOperationalActivity('Admin mengubah jadwal', 'jadwal_dokter', (int) $id, 'Admin mengubah jadwal dokter.');

        return $this->response->setJSON(['status' => true, 'message' => 'Jadwal diperbarui']);
    }

    public function delete($id)
    {
        if (!$this->model->find($id)) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Jadwal tidak ditemukan',
            ]);
        }

        try {
            return parent::delete($id);
        } catch (\Throwable $exception) {
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false,
                'message' => 'Jadwal masih dipakai pendaftaran pasien dan tidak dapat dihapus. Nonaktifkan jadwal sebagai gantinya.',
            ]);
        }
    }

    public function contactAdmin()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');
        $input = $this->request->getJSON(true);
        $message = is_array($input) && is_string($input['pesan'] ?? null) ? trim($input['pesan']) : '';

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        if ($message === '' || strlen($message) > 1000) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Tulis pesan untuk admin, paling banyak 1000 karakter',
            ]);
        }

        $user = $this->currentUser();
        $doctor = (new DokterModel())->find($doctorId);
        $this->recordOperationalActivity(
            'Dokter menghubungi admin',
            'users',
            (int) ($user['id_user'] ?? 0),
            ($doctor['nama_dokter'] ?? $user['nama_lengkap'] ?? 'Dokter') . ': ' . $message
        );

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true,
            'message' => 'Pesan terkirim ke admin',
        ]);
    }

    public function createForDoctor()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        $input = $this->request->getJSON(true);

        if (!is_array($input)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data jadwal tidak valid',
            ]);
        }

        $data = $this->validatedSchedule($input);

        if ($data === null) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Hari, jam, atau kuota jadwal tidak valid',
            ]);
        }

        $data['id_dokter'] = $doctorId;
        $db = db_connect();
        $db->transBegin();
        $db->query('SELECT id_dokter FROM dokter WHERE id_dokter = ? FOR UPDATE', [$doctorId]);

        if ($this->hasScheduleConflict($doctorId, $data)) {
            $db->transRollback();
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Jadwal bertabrakan dengan jadwal praktik lain pada hari dan jam tersebut',
            ]);
        }

        if (!$this->model->insert($data)) {
            $db->transRollback();
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        $id = (int) $this->model->getInsertID();
        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true, 'id' => $id,
        ]);
    }

    public function updateForDoctor(int $id)
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');
        $schedule = $this->model->find($id);

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        if (!$schedule) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Jadwal tidak ditemukan',
            ]);
        }

        if ((int) $schedule['id_dokter'] !== $doctorId) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Jadwal ini bukan milik Anda',
            ]);
        }

        $input = $this->request->getJSON(true);

        if (!is_array($input) || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data pembaruan tidak valid',
            ]);
        }

        $data = $this->validatedSchedule(array_merge($schedule, $input));

        if ($data === null) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Hari, jam, atau kuota jadwal tidak valid',
            ]);
        }

        unset($data['id_dokter']);
        $db = db_connect();
        $db->transBegin();
        $db->query('SELECT id_dokter FROM dokter WHERE id_dokter = ? FOR UPDATE', [$doctorId]);

        if ((int) ($data['is_active'] ?? $schedule['is_active']) === 1
            && $this->hasScheduleConflict($doctorId, array_merge($schedule, $data), $id)) {
            $db->transRollback();
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Jadwal bertabrakan dengan jadwal praktik lain pada hari dan jam tersebut',
            ]);
        }

        if (!$this->model->update($id, $data)) {
            $db->transRollback();
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        $db->transCommit();
        return $this->response->setJSON(['status' => true, 'message' => 'Jadwal diperbarui']);
    }

    private function validatedSchedule(array $input, bool $partial = false): ?array
    {
        $data = [];
        $days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

        if (array_key_exists('hari', $input)) {
            if (!in_array($input['hari'], $days, true)) {
                return null;
            }
            $data['hari'] = $input['hari'];
        } elseif (!$partial) {
            return null;
        }

        foreach (['jam_mulai', 'jam_selesai'] as $field) {
            if (array_key_exists($field, $input)) {
                if (!is_string($input[$field]) || !preg_match('/\A(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\z/', $input[$field])) {
                    return null;
                }
                $data[$field] = $input[$field];
            } elseif (!$partial) {
                return null;
            }
        }

        if (isset($data['jam_mulai'], $data['jam_selesai']) && $data['jam_mulai'] >= $data['jam_selesai']) {
            return null;
        }

        if (array_key_exists('kuota_maksimal', $input)) {
            $quota = filter_var($input['kuota_maksimal'], FILTER_VALIDATE_INT);
            if ($quota === false || $quota < 1 || $quota > 500) {
                return null;
            }
            $data['kuota_maksimal'] = $quota;
        } elseif (!$partial) {
            return null;
        }

        if (array_key_exists('is_active', $input)) {
            if (!in_array($input['is_active'], [0, 1, '0', '1', true, false], true)) {
                return null;
            }
            $data['is_active'] = (int) $input['is_active'];
        }

        return $data === [] ? null : $data;
    }

    private function hasScheduleConflict(int $doctorId, array $schedule, ?int $excludeId = null): bool
    {
        $builder = $this->model
            ->where('id_dokter', $doctorId)
            ->where('hari', $schedule['hari'])
            ->where('is_active', 1)
            ->where('jam_mulai <', $schedule['jam_selesai'])
            ->where('jam_selesai >', $schedule['jam_mulai']);

        if ($excludeId !== null) {
            $builder->where('id_jadwal !=', $excludeId);
        }

        return $builder->countAllResults() > 0;
    }
}