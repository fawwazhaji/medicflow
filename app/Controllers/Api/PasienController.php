
<?php

namespace App\Controllers\Api;

use App\Models\PasienModel;

class PasienController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PasienModel();
    }
}