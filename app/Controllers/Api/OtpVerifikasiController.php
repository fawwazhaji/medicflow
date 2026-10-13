<?php

namespace App\Controllers\Api;

use App\Models\OtpVerifikasiModel;

class OtpVerifikasiController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new OtpVerifikasiModel();
    }
}