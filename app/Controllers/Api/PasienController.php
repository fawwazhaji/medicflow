<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\PasienModel;

class PasienController extends BaseController
{
    protected $pasienModel;

    public function __construct()
    {
        $this->pasienModel = new PasienModel();
    }

    public function index()
    {
        $data = $this->pasienModel->findAll();

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data pasien berhasil diambil',
            'data' => $data
        ]);
    }

    public function show($id)
    {
        $data = $this->pasienModel->find($id);

        if (!$data) {
            return $this->response->setJSON([
                'status' => false,
                'message' => 'Data pasien tidak ditemukan'
            ])->setStatusCode(404);
        }

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data pasien berhasil diambil',
            'data' => $data
        ]);
    }

    public function create()
{
    $data = $this->request->getJSON(true);

    if (!$data) {
        return $this->response->setJSON([
            'status' => false,
            'message' => 'Data tidak boleh kosong'
        ])->setStatusCode(400);
    }

    $this->pasienModel->insert($data);

    return $this->response->setJSON([
        'status' => true,
        'message' => 'Data pasien berhasil ditambahkan',
        'data' => [
            'id_pasien' => $this->pasienModel->getInsertID()
        ]
    ])->setStatusCode(201);

}
public function update($id = null)
    {
        $pasien = $this->pasienModel->find($id);

        if (!$pasien) {
            return $this->response->setJSON([
                'status' => false,
                'message' => 'Data pasien tidak ditemukan'
            ])->setStatusCode(404);
        }

        $data = $this->request->getJSON(true);

        if (!$data) {
            return $this->response->setJSON([
                'status' => false,
                'message' => 'Data pembaruan tidak boleh kosong'
            ])->setStatusCode(400);
        }

        $this->pasienModel->update($id, $data);

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data pasien berhasil diperbarui'
        ]);
    }

    public function delete($id = null)
    {
        $pasien = $this->pasienModel->find($id);

        if (!$pasien) {
            return $this->response->setJSON([
                'status' => false,
                'message' => 'Data pasien tidak ditemukan'
            ])->setStatusCode(404);
        }

        $this->pasienModel->delete($id);

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data pasien berhasil dihapus'
        ]);
    }
}