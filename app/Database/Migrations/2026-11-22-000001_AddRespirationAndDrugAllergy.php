<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddRespirationAndDrugAllergy extends Migration
{
    public function up()
    {
        $this->forge->addColumn('triase_perawat', [
            'laju_respirasi' => [
                'type' => 'SMALLINT',
                'unsigned' => true,
                'null' => true,
                'after' => 'tinggi_badan',
            ],
        ]);
        $this->forge->addColumn('triase_perawat', [
            'alergi_obat' => [
                'type' => 'TEXT',
                'null' => true,
                'after' => 'laju_respirasi',
            ],
        ]);
        $this->forge->addColumn('pemeriksaan', [
            'laju_respirasi' => [
                'type' => 'SMALLINT',
                'unsigned' => true,
                'null' => true,
                'after' => 'tinggi_badan',
            ],
        ]);
        $this->forge->addColumn('pemeriksaan', [
            'alergi_obat' => [
                'type' => 'TEXT',
                'null' => true,
                'after' => 'laju_respirasi',
            ],
        ]);
        $this->forge->addColumn('riwayat_klinis_pasien', [
            'alergi_obat' => [
                'type' => 'TEXT',
                'null' => true,
                'after' => 'alergi',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('riwayat_klinis_pasien', 'alergi_obat');
        $this->forge->dropColumn('pemeriksaan', ['laju_respirasi', 'alergi_obat']);
        $this->forge->dropColumn('triase_perawat', ['laju_respirasi', 'alergi_obat']);
    }
}
