<?php

namespace App\Models;

use CodeIgniter\Model;

class PendaftaranPoliModel extends Model
{
    protected $table = 'pendaftaran_poli';
    protected $primaryKey = 'id_pendaftaran';

    protected $allowedFields = [
        'id_pasien',
        'id_jadwal',
        'tanggal_kunjungan',
        'nomor_antrean',
        'waktu_check_in',
        'estimasi_jam_masuk',
        'status_antrean',
        'catatan_pasien'
    ];

    protected $useTimestamps = true;
}