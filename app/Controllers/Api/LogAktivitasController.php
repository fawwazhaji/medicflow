<?php

namespace App\Controllers\Api;

use App\Models\LogAktivitasModel;

class LogAktivitasController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new LogAktivitasModel();
    }
}