<?php

namespace App\Models;

use CodeIgniter\Model;

class PoliklinikModel extends Model
{
    protected $table = 'poliklinik';
    protected $primaryKey = 'id_poli';

    protected $allowedFields = [
        'nama_poli',
        'deskripsi',
        'is_active'
    ];

    protected $useTimestamps = true;
}