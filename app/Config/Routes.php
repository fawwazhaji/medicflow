<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');
$routes->get('login', 'Home::login');
$routes->get('register', 'Home::register');
$routes->get('app', 'Home::app');

$routes->post('api/auth/register', 'Api\AuthController::register');
$routes->post('api/auth/login', 'Api\AuthController::login');

$routes->get('api/jadwal-dokter', 'Api\JadwalDokterController::index');

$routes->group('api/pasien', ['filter' => 'jwt:pasien'], static function ($routes) {
    $routes->get('me', 'Api\PasienController::me');
    $routes->put('me', 'Api\PasienController::updateMe');
    $routes->get('pendaftaran', 'Api\PendaftaranPoliController::mine');
    $routes->post('pendaftaran', 'Api\PendaftaranPoliController::register');
    $routes->put('pendaftaran/(:num)', 'Api\PendaftaranPoliController::updateMine/$1');
    $routes->post('pendaftaran/(:num)/check-in', 'Api\PendaftaranPoliController::checkIn/$1');
    $routes->get('riwayat-klinis', 'Api\PasienController::clinicalHistoryMine');
    $routes->get('pemeriksaan', 'Api\PemeriksaanController::mine');
    $routes->get('laporan/riwayat-pemeriksaan', 'Api\LaporanController::patientExaminations');
    $routes->get('resep', 'Api\ResepController::mine');
    $routes->get('resep/(:num)', 'Api\ResepController::showMine/$1');
    $routes->get('resep/(:num)/qr', 'Api\ResepController::qrForMine/$1');
    $routes->put('resep/(:num)/pilihan', 'Api\ResepController::selectDispensing/$1');
    $routes->get('notifikasi', 'Api\NotifikasiController::mine');
});

$routes->group('api/dokter', ['filter' => 'jwt:dokter'], static function ($routes) {
    $routes->get('antrian', 'Api\PendaftaranPoliController::doctorQueue');
    $routes->get('antrian/riwayat', 'Api\PendaftaranPoliController::doctorHistory');
    $routes->put('antrian/(:num)', 'Api\PendaftaranPoliController::updateQueueStatus/$1');
    $routes->get('kunjungan/(:num)/riwayat-klinis', 'Api\PasienController::clinicalHistoryForDoctor/$1');
    $routes->put('kunjungan/(:num)/riwayat-klinis', 'Api\PasienController::updateClinicalHistory/$1');
    $routes->get('obat', 'Api\ObatController::activeCatalog');
    $routes->get('jadwal', 'Api\JadwalDokterController::mine');
    $routes->post('jadwal', 'Api\JadwalDokterController::createForDoctor');
    $routes->put('jadwal/(:num)', 'Api\JadwalDokterController::updateForDoctor/$1');
    $routes->post('hubungi-admin', 'Api\JadwalDokterController::contactAdmin');
    $routes->get('pemeriksaan', 'Api\PemeriksaanController::doctorIndex');
    $routes->post('pemeriksaan', 'Api\PemeriksaanController::createForDoctor');
    $routes->put('pemeriksaan/(:num)', 'Api\PemeriksaanController::updateForDoctor/$1');
    $routes->post('resep', 'Api\ResepController::createForDoctor');
});

$routes->group('api/perawat', ['filter' => 'jwt:perawat'], static function ($routes) {
    $routes->get('antrian', 'Api\PerawatController::queue');
    $routes->get('antrian/riwayat', 'Api\PerawatController::history');
    $routes->post('antrian/(:num)/triase', 'Api\PerawatController::recordTriage/$1');
});

$routes->group('api/farmasi', ['filter' => 'jwt:farmasi'], static function ($routes) {
    $routes->get('obat', 'Api\ObatController::index');
    $routes->get('obat/(:num)', 'Api\ObatController::show/$1');
    $routes->post('obat', 'Api\ObatController::create');
    $routes->put('obat/(:num)', 'Api\ObatController::update/$1');
    $routes->get('resep', 'Api\ResepController::pharmacyIndex');
    $routes->get('mutasi-stok', 'Api\MutasiStokController::index');
    $routes->get('resep/(:num)', 'Api\ResepController::pharmacyShow/$1');
    $routes->put('resep/(:num)/status', 'Api\ResepController::updatePharmacyStatus/$1');
    $routes->post('mutasi-stok', 'Api\MutasiStokController::create');
    $routes->post('pengambilan-obat/preview', 'Api\PengambilanObatController::preview');
    $routes->post('pengambilan-obat', 'Api\PengambilanObatController::dispense');
    $routes->get('laporan/pengeluaran-obat', 'Api\LaporanController::medicine');
});

$routes->group('api/admin', ['filter' => 'jwt:admin'], static function ($routes) {
    $routes->post('dokter/registrasi', 'Api\DokterController::registerDoctor');

    $resources = [
        'pasien'          => 'PasienController',
        'dokter'          => 'DokterController',
        'jadwal-dokter'   => 'JadwalDokterController',
        'poliklinik'      => 'PoliklinikController',
        'pendaftaran'     => 'PendaftaranPoliController',
        'pemeriksaan'     => 'PemeriksaanController',
        'resep'           => 'ResepController',
        'detail-resep'    => 'DetailResepController',
        'obat'            => 'ObatController',
        'pengambilan-obat' => 'PengambilanObatController',
        'notifikasi'      => 'NotifikasiController',
        'users'           => 'UserController',
    ];

    foreach ($resources as $path => $controller) {
        $target = 'Api\\' . $controller;
        $routes->get($path, $target . '::index');
        $routes->get($path . '/(:num)', $target . '::show/$1');
        $routes->post($path, $target . '::create');
        $routes->put($path . '/(:num)', $target . '::update/$1');
        $routes->delete($path . '/(:num)', $target . '::delete/$1');
    }

    $routes->get('laporan/kunjungan', 'Api\LaporanController::visits');
    $routes->get('laporan/pengeluaran-obat', 'Api\LaporanController::medicine');
    $routes->get('mutasi-stok', 'Api\MutasiStokController::index');
    $routes->post('mutasi-stok', 'Api\MutasiStokController::create');
    $routes->get('log-aktivitas', 'Api\LogAktivitasController::index');
    $routes->get('log-aktivitas/(:num)', 'Api\LogAktivitasController::show/$1');
});
