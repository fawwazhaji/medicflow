<?php

namespace App\Models;

use CodeIgniter\Model;

class PasienModel extends Model
{
    protected $table = 'pasien';
    protected $primaryKey = 'id_pasien';

    protected $allowedFields = [
        'id_user',
        'nik',
        'nomor_bpjs',
        'nama_lengkap',
        'tanggal_lahir',
        'jenis_kelamin',
        'alamat',
        'no_telepon',
        'terdaftar_satusehat'
    ];

    protected $useTimestamps = true;
}