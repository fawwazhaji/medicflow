<?php

namespace App\Models;

use CodeIgniter\Model;

class RiwayatKlinisPasienModel extends Model
{
    protected $table = 'riwayat_klinis_pasien';
    protected $primaryKey = 'id_pasien';
    protected $useAutoIncrement = false;
    protected $allowedFields = [
        'id_pasien',
        'alergi',
        'alergi_obat',
        'obat_aktif',
        'id_user_diperbarui',
    ];
    protected $useTimestamps = false;

    public function saveDrugAllergy(int $patientId, string $allergy, int $userId): bool
    {
        $value = trim($allergy);
        if ($value === '' || strlen($value) > 2000) {
            return false;
        }

        $data = [
            'alergi_obat' => $value,
            'id_user_diperbarui' => $userId,
        ];

        if ($this->find($patientId)) {
            return (bool) $this->update($patientId, $data);
        }

        $data['id_pasien'] = $patientId;

        return (bool) $this->insert($data);
    }
}
