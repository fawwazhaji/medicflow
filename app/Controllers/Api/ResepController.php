<?php

namespace App\Controllers\Api;

use App\Models\ResepModel;

class ResepController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new ResepModel();
    }
}