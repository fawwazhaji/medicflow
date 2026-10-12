<?php

namespace App\Models;

use CodeIgniter\Model;

class UserModel extends Model
{
    protected $table = 'users';
    protected $primaryKey = 'id_user';
    protected $allowedFields = [
        'username',
        'password_hash',
        'role',
        'nama_lengkap',
        'no_telepon',
        'is_active'
    ];

    protected $useTimestamps = true;
}