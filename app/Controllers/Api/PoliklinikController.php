<?php

namespace App\Controllers\Api;

use App\Models\PoliklinikModel;

class PoliklinikController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PoliklinikModel();
    }
}