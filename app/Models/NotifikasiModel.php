<?php

namespace App\Models;

use CodeIgniter\Model;

class NotifikasiModel extends Model
{
    protected $table = 'notifikasi';
    protected $primaryKey = 'id_notifikasi';

    protected $allowedFields = [
        'id_pasien',
        'id_pendaftaran',
        'jenis_notifikasi',
        'channel',
        'nomor_tujuan',
        'pesan',
        'status',
        'waktu_dikirim',
        'response_api'
    ];

    protected $useTimestamps = false;
}