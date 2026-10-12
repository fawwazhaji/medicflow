<?php

namespace App\Models;

use CodeIgniter\Model;

class LogAktivitasModel extends Model
{
    protected $table = 'log_aktivitas';
    protected $primaryKey = 'id_log';

    protected $allowedFields = [
        'id_user',
        'aktivitas',
        'tabel_referensi',
        'id_referensi',
        'keterangan',
        'ip_address'
    ];

    protected $useTimestamps = false;
}