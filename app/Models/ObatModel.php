<?php

namespace App\Models;

use CodeIgniter\Model;

class ObatModel extends Model
{
    protected $table = 'obat';
    protected $primaryKey = 'id_obat';

    protected $allowedFields = [
        'kode_kemenkes',
        'nama_obat',
        'jenis_obat',
        'satuan',
        'cover_bpjs',
        'stok_rs',
        'stok_minimum',
        'harga',
        'is_active'
    ];

    protected $useTimestamps = true;
}