<?php

namespace App\Controllers\Api;

use App\Models\PengambilanObatModel;

class PengambilanObatController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PengambilanObatModel();
    }
}