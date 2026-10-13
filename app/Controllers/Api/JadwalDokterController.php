<?php

namespace App\Controllers\Api;

use App\Models\JadwalDokterModel;

class JadwalDokterController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new JadwalDokterModel();
    }
}