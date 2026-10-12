<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\Model;

class BaseApiController extends BaseController
{
    protected Model $model;

    public function index()
    {
        return $this->response->setJSON([
            'status' => true,
            'data' => $this->model->findAll()
        ]);
    }

    public function show($id)
    {
        $data = $this->model->find($id);

        if (!$data) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data tidak ditemukan'
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data' => $data
        ]);
    }

    public function create()
    {
        $data = $this->request->getJSON(true);

        if (!$data) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Data tidak boleh kosong'
            ]);
        }

        if (!$this->model->insert($data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->model->errors()
            ]);
        }

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true,
            'message' => 'Data berhasil ditambahkan',
            'id' => $this->model->getInsertID()
        ]);
    }

    public function update($id)
    {
        $data = $this->request->getJSON(true);

        if (!$this->model->find($id)) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data tidak ditemukan'
            ]);
        }

        $this->model->update($id, $data);

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data berhasil diperbarui'
        ]);
    }

    public function delete($id)
    {
        if (!$this->model->find($id)) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data tidak ditemukan'
            ]);
        }

        $this->model->delete($id);

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data berhasil dihapus'
        ]);
    }
}