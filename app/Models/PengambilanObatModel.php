<?php

namespace App\Models;

use CodeIgniter\Model;

class PengambilanObatModel extends Model
{
    protected $table = 'pengambilan_obat';
    protected $primaryKey = 'id_pengambilan';

    protected $allowedFields = [
        'id_resep',
        'id_user_petugas',
        'diambil_oleh',
        'nama_pengambil',
        'waktu_pengambilan',
        'metode_verifikasi',
        'status',
        'catatan'
    ];

    protected $useTimestamps = true;
}