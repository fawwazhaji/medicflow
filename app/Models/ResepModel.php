<?php

namespace App\Models;

use CodeIgniter\Model;

class ResepModel extends Model
{
    protected $table = 'resep';
    protected $primaryKey = 'id_resep';

    protected $allowedFields = [
        'id_pendaftaran',
        'kode_qr_unik',
        'waktu_diterbitkan',
        'pilihan_penebusan',
        'estimasi_jam_selesai',
        'status_resep',
        'kadaluarsa_qr'
    ];

    protected $useTimestamps = true;
}