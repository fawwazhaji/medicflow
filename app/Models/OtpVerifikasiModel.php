<?php

namespace App\Models;

use CodeIgniter\Model;

class OtpVerifikasiModel extends Model
{
    protected $table = 'otp_verifikasi';
    protected $primaryKey = 'id_otp';

    protected $allowedFields = [
        'id_user',
        'kode_otp',
        'tujuan',
        'expired_at',
        'verified_at',
        'attempt'
    ];

    protected $useTimestamps = false;
}