<?php

namespace App\Controllers\Api;

use App\Models\PemeriksaanModel;

class PemeriksaanController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PemeriksaanModel();
    }
}