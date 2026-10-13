<?php

namespace App\Controllers\Api;

use App\Models\ObatModel;

class ObatController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new ObatModel();
    }
}