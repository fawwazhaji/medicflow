<?php

namespace App\Models;

use CodeIgniter\Model;

class DokterModel extends Model
{
    protected $table = 'dokter';
    protected $primaryKey = 'id_dokter';

    protected $allowedFields = [
        'id_user',
        'id_poli',
        'nama_dokter',
        'spesialisasi',
        'rata_waktu_periksa_menit',
        'is_active'
    ];

    protected $useTimestamps = true;
}