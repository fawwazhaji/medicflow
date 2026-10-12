<?php

namespace App\Models;

use CodeIgniter\Model;

class PemeriksaanModel extends Model
{
    protected $table = 'pemeriksaan';
    protected $primaryKey = 'id_pemeriksaan';

    protected $allowedFields = [
        'id_pendaftaran',
        'id_dokter',
        'keluhan',
        'tekanan_darah',
        'suhu_tubuh',
        'berat_badan',
        'tinggi_badan',
        'diagnosis',
        'tindakan',
        'catatan_dokter',
        'waktu_mulai',
        'waktu_selesai'
    ];

    protected $useTimestamps = true;
}