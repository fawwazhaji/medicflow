<?php

namespace App\Controllers\Api;

use App\Models\DokterModel;

class DokterController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new DokterModel();
    }
}