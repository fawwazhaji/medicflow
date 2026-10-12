<?php

namespace App\Models;

use CodeIgniter\Model;

class JadwalDokterModel extends Model
{
    protected $table = 'jadwal_dokter';
    protected $primaryKey = 'id_jadwal';

    protected $allowedFields = [
        'id_dokter',
        'hari',
        'jam_mulai',
        'jam_selesai',
        'kuota_maksimal',
        'is_active'
    ];

    protected $useTimestamps = true;
}