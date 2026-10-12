<?php

namespace App\Models;

use CodeIgniter\Model;

class MutasiStokModel extends Model
{
    protected $table = 'mutasi_stok';
    protected $primaryKey = 'id_mutasi';

    protected $allowedFields = [
        'id_obat',
        'id_user',
        'jenis_mutasi',
        'jumlah',
        'stok_sebelum',
        'stok_sesudah',
        'keterangan'
    ];

    protected $useTimestamps = false;
}