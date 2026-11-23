<?php

namespace App\Models;

use CodeIgniter\Model;

class TriasePerawatModel extends Model
{
    protected $table = 'triase_perawat';
    protected $primaryKey = 'id_triase';

    protected $allowedFields = [
        'id_pendaftaran',
        'id_user',
        'keluhan_awal',
        'tekanan_darah',
        'suhu_tubuh',
        'berat_badan',
        'tinggi_badan',
        'laju_respirasi',
        'alergi_obat',
        'catatan_perawat',
        'waktu_triase',
    ];

    protected $useTimestamps = true;
}
