<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\CLI\CLI;
use DateTimeImmutable;
use RuntimeException;

class MedicFlowDemoSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'Demo#2026';

    public function run(): void
    {
        if (ENVIRONMENT !== 'development' && ENVIRONMENT !== 'testing') {
            throw new RuntimeException('Demo accounts can only be seeded in development or testing.');
        }

        $this->db->transBegin();

        try {
            $now = date('Y-m-d H:i:s');
            $this->ensureUser('demo_admin', 'admin', 'Admin Demo MedicFlow', '081200000201', $now);
            $doctorUserId = $this->ensureUser('demo_dokter', 'dokter', 'Dr. Demo MedicFlow', '081200000202', $now);
            $this->ensureUser('demo_perawat', 'perawat', 'Perawat Demo MedicFlow', '081200000205', $now);
            $this->ensureUser('demo_farmasi', 'farmasi', 'Petugas Farmasi Demo', '081200000203', $now);
            $patientUserId = $this->ensureUser('demo_pasien', 'pasien', 'Pasien Demo MedicFlow', '081200000204', $now);

            $clinic = $this->db->table('poliklinik')->where('is_active', 1)->orderBy('id_poli')->get()->getRowArray();

            if (!$clinic) {
                throw new RuntimeException('Tambahkan minimal satu poliklinik aktif sebelum menjalankan demo seeder.');
            }

            $doctor = $this->db->table('dokter')->where('id_user', $doctorUserId)->get()->getRowArray();

            if (!$doctor) {
                $this->db->table('dokter')->insert([
                    'id_user'                    => $doctorUserId,
                    'id_poli'                    => $clinic['id_poli'],
                    'nama_dokter'                => 'Dr. Demo MedicFlow',
                    'spesialisasi'               => 'Dokter Umum',
                    'rata_waktu_periksa_menit'   => 15,
                    'is_active'                  => 1,
                    'created_at'                 => $now,
                    'updated_at'                 => $now,
                ]);
                $doctorId = (int) $this->db->insertID();
            } else {
                $doctorId = (int) $doctor['id_dokter'];
            }

            $patient = $this->db->table('pasien')->where('id_user', $patientUserId)->get()->getRowArray();

            if (!$patient) {
                $this->db->table('pasien')->insert([
                    'id_user'              => $patientUserId,
                    'nik'                  => '9900000000000001',
                    'nomor_bpjs'           => null,
                    'nama_lengkap'         => 'Pasien Demo MedicFlow',
                    'tanggal_lahir'        => '1995-05-15',
                    'jenis_kelamin'        => 'L',
                    'alamat'               => 'Data uji lokal MedicFlow',
                    'no_telepon'           => '081200000204',
                    'terdaftar_satusehat'  => 0,
                    'created_at'           => $now,
                    'updated_at'           => $now,
                ]);
                $patientId = (int) $this->db->insertID();
            } else {
                $patientId = (int) $patient['id_pasien'];
            }

            $schedule = $this->db->table('jadwal_dokter')
                ->where('id_dokter', $doctorId)
                ->where('hari', 'Senin')
                ->where('jam_mulai', '09:00:00')
                ->where('jam_selesai', '12:00:00')
                ->get()
                ->getRowArray();

            if (!$schedule) {
                $this->db->table('jadwal_dokter')->insert([
                    'id_dokter'      => $doctorId,
                    'hari'           => 'Senin',
                    'jam_mulai'      => '09:00:00',
                    'jam_selesai'    => '12:00:00',
                    'kuota_maksimal' => 20,
                    'is_active'      => 1,
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ]);
                $scheduleId = (int) $this->db->insertID();
            } else {
                $scheduleId = (int) $schedule['id_jadwal'];
            }

            $scheduleDate = $this->nextDemoAppointmentDate($patientId, $scheduleId);
            $appointment = $this->db->table('pendaftaran_poli')
                ->where('id_pasien', $patientId)
                ->where('id_jadwal', $scheduleId)
                ->where('tanggal_kunjungan', $scheduleDate)
                ->get()
                ->getRowArray();

            if (!$appointment) {
                $this->db->table('pendaftaran_poli')->insert([
                    'id_pasien'         => $patientId,
                    'id_jadwal'         => $scheduleId,
                    'tanggal_kunjungan' => $scheduleDate,
                    'nomor_antrean'     => 1,
                    'status_antrean'    => 'Menunggu',
                    'catatan_pasien'    => 'DATA UJI DEMO: keluhan dapat diubah saat latihan pemeriksaan.',
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ]);
            }

            $dentalClinic = $this->ensureClinic('Poli Gigi', 'Poliklinik gigi untuk akun demo lokal.', $now);
            $dentalUserId = $this->ensureUser('demo_dokter_gigi', 'dokter', 'Dr. Gigi Demo', '081200000206', $now);
            $dentalDoctorId = $this->ensureDoctor(
                $dentalUserId,
                (int) $dentalClinic['id_poli'],
                'Dr. Gigi Demo',
                'Dokter Gigi',
                $now
            );
            $this->ensureSchedule($dentalDoctorId, 'Senin', '09:00:00', '12:00:00', $now);
            $this->seedPracticeWeek($doctorId, [
                ['Selasa', '09:00:00', '12:00:00'],
                ['Rabu', '09:00:00', '12:00:00'],
                ['Kamis', '09:00:00', '12:00:00'],
                ['Jumat', '09:00:00', '12:00:00'],
                ['Sabtu', '09:00:00', '12:00:00'],
                ['Senin', '13:00:00', '16:00:00'],
                ['Rabu', '13:00:00', '16:00:00'],
                ['Jumat', '13:00:00', '16:00:00'],
            ], $now);
            $this->seedPracticeWeek($dentalDoctorId, [
                ['Selasa', '09:00:00', '12:00:00'],
                ['Rabu', '09:00:00', '12:00:00'],
                ['Kamis', '09:00:00', '12:00:00'],
                ['Jumat', '09:00:00', '12:00:00'],
                ['Sabtu', '08:00:00', '11:00:00'],
                ['Selasa', '13:00:00', '15:00:00'],
                ['Kamis', '13:00:00', '15:00:00'],
            ], $now);
            $this->ensureClinicDoctor(
                'Poli Anak',
                'Poliklinik anak untuk akun demo lokal.',
                'demo_dokter_anak',
                'Dr. Anak Demo',
                '081200000207',
                'Spesialis Anak',
                [
                    ['Senin', '08:00:00', '12:00:00'],
                    ['Rabu', '08:00:00', '12:00:00'],
                    ['Jumat', '08:00:00', '12:00:00'],
                ],
                $now
            );
            $this->ensureClinicDoctor(
                'Poli Kandungan',
                'Poliklinik kandungan untuk akun demo lokal.',
                'demo_dokter_kandungan',
                'Dr. Kandungan Demo',
                '081200000208',
                'Spesialis Kandungan',
                [
                    ['Selasa', '09:00:00', '12:00:00'],
                    ['Kamis', '09:00:00', '12:00:00'],
                    ['Sabtu', '09:00:00', '12:00:00'],
                ],
                $now
            );
            $this->ensureClinicDoctor(
                'Poli Mata',
                'Poliklinik mata untuk akun demo lokal.',
                'demo_dokter_mata',
                'Dr. Mata Demo',
                '081200000209',
                'Spesialis Mata',
                [
                    ['Senin', '13:00:00', '16:00:00'],
                    ['Kamis', '13:00:00', '16:00:00'],
                ],
                $now
            );
            $this->ensureClinicDoctor(
                'Poli THT',
                'Poliklinik telinga, hidung, dan tenggorokan untuk akun demo lokal.',
                'demo_dokter_tht',
                'Dr. THT Demo',
                '081200000210',
                'Spesialis THT',
                [
                    ['Selasa', '13:00:00', '16:00:00'],
                    ['Jumat', '13:00:00', '16:00:00'],
                ],
                $now
            );
            $this->ensureClinicDoctor(
                'Poli Jantung',
                'Poliklinik jantung untuk akun demo lokal.',
                'demo_dokter_jantung',
                'Dr. Jantung Demo',
                '081200000211',
                'Spesialis Jantung',
                [
                    ['Rabu', '08:00:00', '11:00:00'],
                    ['Sabtu', '08:00:00', '11:00:00'],
                ],
                $now
            );
            $this->ensureDemoMedicines($now);

            if (!$this->db->transStatus()) {
                throw new RuntimeException('Database menolak sebagian data demo.');
            }

            $this->db->transCommit();

            CLI::write('Data demo MedicFlow berhasil disiapkan.', 'green');
            CLI::write('Akun demo (password semua akun: ' . self::DEMO_PASSWORD . '):');
            CLI::write('  admin    : demo_admin');
            CLI::write('  dokter   : demo_dokter');
            CLI::write('  dokter gigi : demo_dokter_gigi');
            CLI::write('  perawat  : demo_perawat');
            CLI::write('  farmasi  : demo_farmasi');
            CLI::write('  pasien   : demo_pasien');
            CLI::write('Poli demo: Umum, Gigi, Anak, Kandungan, Mata, THT, dan Jantung.');
            CLI::write('Dokter poli lain: demo_dokter_anak, demo_dokter_kandungan, demo_dokter_mata, demo_dokter_tht, demo_dokter_jantung.');
            CLI::write('Jadwal demo lengkap untuk setiap poli. Minggu tidak ada praktik.');
            CLI::write('Antrean pasien demo tetap pada Senin ' . $scheduleDate . ' pukul 09:00-12:00.');
            CLI::write('Pasien dapat mendaftar ke kedua dokter pada hari yang sama.');
            CLI::write('Katalog obat demo tersedia pada resep dokter selama stok masih aktif.');
            CLI::write('Alur uji: catat pemeriksaan awal sebagai perawat, panggil dan periksa pasien sebagai dokter, lalu lanjutkan resep.');
        } catch (\Throwable $exception) {
            $this->db->transRollback();
            throw $exception;
        }
    }

    private function ensureClinicDoctor(
        string $clinicName,
        string $description,
        string $username,
        string $doctorName,
        string $phone,
        string $specialty,
        array $sessions,
        string $now
    ): void {
        $clinic = $this->ensureClinic($clinicName, $description, $now);
        $userId = $this->ensureUser($username, 'dokter', $doctorName, $phone, $now);
        $doctorId = $this->ensureDoctor($userId, (int) $clinic['id_poli'], $doctorName, $specialty, $now);
        $this->seedPracticeWeek($doctorId, $sessions, $now);
    }

    private function ensureClinic(string $name, string $description, string $now): array
    {
        $clinic = $this->db->table('poliklinik')->where('nama_poli', $name)->get()->getRowArray();

        if ($clinic) {
            if ((int) $clinic['is_active'] !== 1) {
                $this->db->table('poliklinik')->where('id_poli', $clinic['id_poli'])->update([
                    'is_active'  => 1,
                    'updated_at' => $now,
                ]);
                $clinic['is_active'] = 1;
            }

            return $clinic;
        }

        $this->db->table('poliklinik')->insert([
            'nama_poli'  => $name,
            'deskripsi'  => $description,
            'is_active'  => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $this->db->table('poliklinik')->where('id_poli', (int) $this->db->insertID())->get()->getRowArray();
    }

    private function ensureDoctor(int $userId, int $clinicId, string $name, string $specialty, string $now): int
    {
        $doctor = $this->db->table('dokter')->where('id_user', $userId)->get()->getRowArray();

        if ($doctor) {
            return (int) $doctor['id_dokter'];
        }

        $this->db->table('dokter')->insert([
            'id_user'                  => $userId,
            'id_poli'                  => $clinicId,
            'nama_dokter'              => $name,
            'spesialisasi'             => $specialty,
            'rata_waktu_periksa_menit' => 15,
            'is_active'                => 1,
            'created_at'               => $now,
            'updated_at'               => $now,
        ]);

        return (int) $this->db->insertID();
    }

    private function seedPracticeWeek(int $doctorId, array $sessions, string $now): void
    {
        foreach ($sessions as $session) {
            $this->ensureSchedule($doctorId, $session[0], $session[1], $session[2], $now);
        }
    }

    private function ensureSchedule(int $doctorId, string $day, string $start, string $end, string $now): int
    {
        $schedule = $this->db->table('jadwal_dokter')
            ->where('id_dokter', $doctorId)
            ->where('hari', $day)
            ->where('jam_mulai', $start)
            ->where('jam_selesai', $end)
            ->get()
            ->getRowArray();

        if ($schedule) {
            return (int) $schedule['id_jadwal'];
        }

        $this->db->table('jadwal_dokter')->insert([
            'id_dokter'      => $doctorId,
            'hari'           => $day,
            'jam_mulai'      => $start,
            'jam_selesai'    => $end,
            'kuota_maksimal' => 20,
            'is_active'      => 1,
            'created_at'     => $now,
            'updated_at'     => $now,
        ]);

        return (int) $this->db->insertID();
    }

    private function ensureDemoMedicines(string $now): void
    {
        $pharmacist = $this->db->table('users')->where('username', 'demo_farmasi')->get()->getRowArray();
        if (!$pharmacist) {
            return;
        }

        $medicines = [
            ['DEMO-PARA-500', 'Paracetamol 500 mg', 'tablet', 200, '500.00', '2027-12-31'],
            ['DEMO-AMOX-500', 'Amoksisilin 500 mg', 'kapsul', 120, '1500.00', '2027-06-30'],
            ['DEMO-IBU-400', 'Ibuprofen 400 mg', 'tablet', 100, '800.00', '2027-09-30'],
            ['DEMO-CET-10', 'Cetirizine 10 mg', 'tablet', 80, '700.00', '2027-08-31'],
            ['DEMO-ANTASIDA', 'Antasida DOEN', 'tablet', 150, '400.00', '2027-05-31'],
            ['DEMO-ORALIT', 'Oralit', 'sachet', 100, '1000.00', '2027-12-31'],
        ];

        foreach ($medicines as $medicine) {
            $existing = $this->db->table('obat')->where('kode_kemenkes', $medicine[0])->get()->getRowArray();
            if ($existing) {
                continue;
            }

            $this->db->table('obat')->insert([
                'kode_kemenkes'       => $medicine[0],
                'nama_obat'           => $medicine[1],
                'jenis_obat'          => 'Jadi',
                'satuan'              => $medicine[2],
                'cover_bpjs'          => 1,
                'stok_rs'             => $medicine[3],
                'stok_minimum'        => 10,
                'tanggal_kedaluwarsa' => $medicine[5],
                'harga'               => $medicine[4],
                'is_active'           => 1,
                'created_at'          => $now,
                'updated_at'          => $now,
            ]);

            $this->db->table('mutasi_stok')->insert([
                'id_obat'       => (int) $this->db->insertID(),
                'id_user'       => (int) $pharmacist['id_user'],
                'jenis_mutasi'  => 'Masuk',
                'jumlah'        => $medicine[3],
                'stok_sebelum'  => 0,
                'stok_sesudah'  => $medicine[3],
                'keterangan'    => 'Stok awal obat demo',
                'created_at'    => $now,
            ]);
        }
    }

    private function ensureUser(string $username, string $role, string $name, string $phone, string $now): int
    {
        $user = $this->db->table('users')->where('username', $username)->get()->getRowArray();

        if ($user) {
            if ($user['role'] !== $role) {
                throw new RuntimeException('Username demo sudah digunakan oleh role yang berbeda: ' . $username);
            }

            $this->db->table('users')->where('id_user', $user['id_user'])->update([
                'password_hash' => password_hash(self::DEMO_PASSWORD, PASSWORD_DEFAULT),
                'updated_at'    => $now,
            ]);

            return (int) $user['id_user'];
        }

        $this->db->table('users')->insert([
            'username'      => $username,
            'password_hash' => password_hash(self::DEMO_PASSWORD, PASSWORD_DEFAULT),
            'role'          => $role,
            'nama_lengkap'  => $name,
            'no_telepon'    => $phone,
            'is_active'     => 1,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);

        return (int) $this->db->insertID();
    }

    private function nextMonday(): string
    {
        $date = new DateTimeImmutable('today');
        $daysUntilMonday = (8 - (int) $date->format('N')) % 7;

        if ($daysUntilMonday === 0) {
            $daysUntilMonday = 7;
        }

        return $date->modify('+' . $daysUntilMonday . ' days')->format('Y-m-d');
    }

    private function nextDemoAppointmentDate(int $patientId, int $scheduleId): string
    {
        $date = new DateTimeImmutable($this->nextMonday());

        for ($week = 0; $week < 52; $week++) {
            $dateString = $date->format('Y-m-d');
            $appointment = $this->db->table('pendaftaran_poli')
                ->where('id_pasien', $patientId)
                ->where('id_jadwal', $scheduleId)
                ->where('tanggal_kunjungan', $dateString)
                ->get()
                ->getRowArray();

            if (!$appointment || !in_array($appointment['status_antrean'], ['Selesai Pemeriksaan', 'Batal'], true)) {
                return $dateString;
            }

            $date = $date->modify('+7 days');
        }

        throw new RuntimeException('Tidak menemukan tanggal kunjungan demo yang tersedia dalam 52 minggu.');
    }
}
