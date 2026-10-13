<?php

namespace App\Controllers\Api;

use App\Models\NotifikasiModel;

class NotifikasiController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new NotifikasiModel();
    }
}