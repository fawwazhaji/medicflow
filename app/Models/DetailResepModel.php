<?php

namespace App\Models;

use CodeIgniter\Model;

class DetailResepModel extends Model
{
    protected $table = 'detail_resep';
    protected $primaryKey = 'id_detail';

    protected $allowedFields = [
        'id_resep',
        'id_obat',
        'jumlah',
        'dosis_aturan_pakai',
        'instruksi_racikan',
        'catatan'
    ];

    protected $useTimestamps = true;
}