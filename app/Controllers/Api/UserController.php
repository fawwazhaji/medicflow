
<?php

namespace App\Controllers\Api;

use App\Models\UserModel;

class UserController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new UserModel();
    }

    public function index()
    {
        $data = $this->model
            ->select('id_user, username, role, nama_lengkap, no_telepon, is_active, created_at, updated_at')
            ->findAll();

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data user berhasil diambil',
            'data' => $data
        ]);
    }

    public function show($id)
    {
        $data = $this->model
            ->select('id_user, username, role, nama_lengkap, no_telepon, is_active, created_at, updated_at')
            ->find($id);

        if (!$data) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data user tidak ditemukan'
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data' => $data
        ]);
    }
}