<?php

namespace App\Controllers\Api;

use App\Libraries\AuditLogger;
use App\Libraries\ClinicReport;
use App\Models\PasienModel;
use DateTimeImmutable;

class LaporanController extends BaseApiController
{
    public function visits()
    {
        return $this->download('kunjungan');
    }

    public function medicine()
    {
        return $this->download('pengeluaran-obat');
    }

    public function patientExaminations()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        $range = $this->reportRange();
        if ($range instanceof \CodeIgniter\HTTP\ResponseInterface) {
            return $range;
        }

        [$format, $from, $to] = $range;
        $user = $this->currentUser();
        $report = (new ClinicReport())->patientExaminations(
            $patientId,
            $format,
            $from,
            $to,
            (string) ($user['nama_lengkap'] ?? $user['username'])
        );

        return $this->sendReport($report, (int) $user['id_user']);
    }

    private function download(string $kind)
    {
        $range = $this->reportRange();
        if ($range instanceof \CodeIgniter\HTTP\ResponseInterface) {
            return $range;
        }

        [$format, $from, $to] = $range;
        $user = $this->currentUser();
        $report = (new ClinicReport())->render($kind, $format, $from, $to, (string) ($user['nama_lengkap'] ?? $user['username']));

        return $this->sendReport($report, (int) $user['id_user']);
    }

    /**
     * @return array{0:string,1:string,2:string}|\CodeIgniter\HTTP\ResponseInterface
     */
    private function reportRange()
    {
        $format = strtolower((string) $this->request->getGet('format'));
        $from = (string) $this->request->getGet('dari');
        $to = (string) $this->request->getGet('sampai');
        $fromDate = DateTimeImmutable::createFromFormat('!Y-m-d', $from);
        $toDate = DateTimeImmutable::createFromFormat('!Y-m-d', $to);

        if (!in_array($format, ['pdf', 'xls'], true) || $fromDate === false || $toDate === false || $fromDate->format('Y-m-d') !== $from || $toDate->format('Y-m-d') !== $to) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Format atau rentang tanggal laporan tidak valid',
            ]);
        }

        if ($from > $to || $fromDate->diff($toDate)->days > 366) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Rentang tanggal paling lama 366 hari dan tanggal awal tidak boleh melewati tanggal akhir',
            ]);
        }

        return [$format, $from, $to];
    }

    private function sendReport(array $report, int $userId)
    {
        try {
            AuditLogger::record($userId, 'Unduh laporan', 'laporan', null, $report['filename']);
        } catch (\Throwable $exception) {
            log_message('error', $exception->getMessage());
        }

        return $this->response
            ->setHeader('Content-Type', $report['mime'])
            ->setHeader('Content-Disposition', 'attachment; filename="' . $report['filename'] . '"')
            ->setHeader('Cache-Control', 'no-store')
            ->setBody($report['body']);
    }
}
