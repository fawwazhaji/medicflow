<?php

namespace App\Controllers\Api;

use App\Models\DetailResepModel;

class DetailResepController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new DetailResepModel();
    }
}