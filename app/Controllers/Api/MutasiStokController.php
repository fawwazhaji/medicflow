<?php

namespace App\Controllers\Api;

use App\Models\MutasiStokModel;

class MutasiStokController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new MutasiStokModel();
    }
}