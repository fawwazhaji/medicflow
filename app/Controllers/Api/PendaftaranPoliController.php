<?php

namespace App\Controllers\Api;

use App\Models\PendaftaranPoliModel;

class PendaftaranPoliController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PendaftaranPoliModel();
    }
}