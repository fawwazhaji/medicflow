<?php

namespace App\Libraries;

class ClinicReport
{
    private const MAX_ROWS = 5000;

    public function render(string $kind, string $format, string $from, string $to, string $printedBy): array
    {
        $document = $kind === 'kunjungan'
            ? $this->visits($from, $to, $printedBy)
            : $this->medicine($from, $to, $printedBy);
        $slug = $kind === 'kunjungan' ? 'laporan-kunjungan' : 'laporan-pengeluaran-obat';
        $filename = $slug . '_' . $from . '_' . $to . '.' . $format;

        if ($format === 'pdf') {
            return [
                'filename' => $filename,
                'mime' => 'application/pdf',
                'body' => $this->pdf($document),
            ];
        }

        return [
            'filename' => $filename,
            'mime' => 'application/vnd.ms-excel',
            'body' => $this->excel($document),
        ];
    }

    public function patientExaminations(int $patientId, string $format, string $from, string $to, string $printedBy): array
    {
        $rows = db_connect()->query(
            'SELECT pemeriksaan.waktu_mulai, pemeriksaan.waktu_selesai, pemeriksaan.keluhan, pemeriksaan.diagnosis, ' .
            'pemeriksaan.tindakan, pemeriksaan.catatan_dokter, pemeriksaan.tekanan_darah, pemeriksaan.suhu_tubuh, ' .
            'pemeriksaan.berat_badan, pemeriksaan.tinggi_badan, pemeriksaan.laju_respirasi, pemeriksaan.alergi_obat, ' .
            'dokter.nama_dokter, poliklinik.nama_poli ' .
            'FROM pemeriksaan ' .
            'JOIN pendaftaran_poli ON pendaftaran_poli.id_pendaftaran = pemeriksaan.id_pendaftaran ' .
            'LEFT JOIN dokter ON dokter.id_dokter = pemeriksaan.id_dokter ' .
            'LEFT JOIN poliklinik ON poliklinik.id_poli = dokter.id_poli ' .
            'WHERE pendaftaran_poli.id_pasien = ? AND pemeriksaan.waktu_mulai >= ? AND pemeriksaan.waktu_mulai <= ? ' .
            'ORDER BY pemeriksaan.waktu_mulai ASC ' .
            'LIMIT ' . (self::MAX_ROWS + 1),
            [$patientId, $from . ' 00:00:00', $to . ' 23:59:59']
        )->getResultArray();
        $truncated = count($rows) > self::MAX_ROWS;
        $rows = array_slice($rows, 0, self::MAX_ROWS);
        $table = [];
        $byDoctor = [];

        foreach ($rows as $index => $row) {
            $doctor = trim((string) ($row['nama_dokter'] ?: 'Dokter'));
            $clinic = trim((string) ($row['nama_poli'] ?? ''));
            $byDoctor[$doctor] = ($byDoctor[$doctor] ?? 0) + 1;
            $table[] = [
                (string) ($index + 1),
                $this->dateTime((string) $row['waktu_mulai']),
                $clinic !== '' ? $doctor . ' • ' . $clinic : $doctor,
                $this->text($row['keluhan']),
                $this->text($row['diagnosis']),
                $this->text($row['tindakan']),
                $this->vitals($row),
                $this->text($row['alergi_obat']),
                $this->text($row['catatan_dokter']),
            ];
        }

        ksort($byDoctor);
        $summary = [['Total pemeriksaan', (string) count($rows)]];
        foreach ($byDoctor as $doctor => $count) {
            $summary[] = [$doctor, (string) $count];
        }
        if ($truncated) {
            $summary[] = ['Catatan', 'Hanya ' . self::MAX_ROWS . ' pemeriksaan pertama yang dimuat'];
        }

        $document = $this->document(
            'Riwayat Pemeriksaan',
            $from,
            $to,
            $printedBy,
            ['No', 'Waktu', 'Dokter', 'Keluhan', 'Diagnosis', 'Tindakan', 'Tanda vital', 'Alergi obat', 'Catatan'],
            [24, 78, 110, 96, 96, 90, 112, 80, 90],
            $table,
            'Tidak ada pemeriksaan pada periode ini.',
            $summary,
            ['Dokter', 'Jumlah'],
            [220, 80],
            []
        );
        $document['note'] = 'Laporan hanya memuat pemeriksaan milik pasien yang mengunduhnya.';
        $filename = 'riwayat-pemeriksaan_' . $from . '_' . $to . '.' . $format;

        if ($format === 'pdf') {
            return ['filename' => $filename, 'mime' => 'application/pdf', 'body' => $this->pdf($document)];
        }

        return ['filename' => $filename, 'mime' => 'application/vnd.ms-excel', 'body' => $this->excel($document)];
    }

    private function visits(string $from, string $to, string $printedBy): array
    {
        $rows = db_connect()->query(
            'SELECT pendaftaran_poli.tanggal_kunjungan, pendaftaran_poli.nomor_antrean, pendaftaran_poli.status_antrean, ' .
            'pendaftaran_poli.waktu_check_in, pasien.nama_lengkap AS nama_pasien, dokter.nama_dokter, poliklinik.nama_poli, ' .
            'pemeriksaan.diagnosis, pemeriksaan.keluhan ' .
            'FROM pendaftaran_poli ' .
            'JOIN pasien ON pasien.id_pasien = pendaftaran_poli.id_pasien ' .
            'JOIN jadwal_dokter ON jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal ' .
            'JOIN dokter ON dokter.id_dokter = jadwal_dokter.id_dokter ' .
            'JOIN poliklinik ON poliklinik.id_poli = dokter.id_poli ' .
            'LEFT JOIN pemeriksaan ON pemeriksaan.id_pendaftaran = pendaftaran_poli.id_pendaftaran ' .
            'WHERE pendaftaran_poli.tanggal_kunjungan BETWEEN ? AND ? ' .
            'ORDER BY pendaftaran_poli.tanggal_kunjungan ASC, poliklinik.nama_poli ASC, pendaftaran_poli.nomor_antrean ASC ' .
            'LIMIT ' . (self::MAX_ROWS + 1),
            [$from, $to]
        )->getResultArray();
        $truncated = count($rows) > self::MAX_ROWS;
        $rows = array_slice($rows, 0, self::MAX_ROWS);
        $byClinic = [];
        $byStatus = [];
        $table = [];

        foreach ($rows as $index => $row) {
            $clinic = (string) $row['nama_poli'];
            $status = (string) $row['status_antrean'];
            $byClinic[$clinic] = ($byClinic[$clinic] ?? 0) + 1;
            $byStatus[$status] = ($byStatus[$status] ?? 0) + 1;
            $table[] = [
                (string) ($index + 1),
                $this->date((string) $row['tanggal_kunjungan']),
                (string) $row['nama_pasien'],
                $clinic,
                (string) $row['nama_dokter'],
                (string) $row['nomor_antrean'],
                $status,
                $row['diagnosis'] !== null && $row['diagnosis'] !== '' ? (string) $row['diagnosis'] : ($row['keluhan'] !== null && $row['keluhan'] !== '' ? (string) $row['keluhan'] : '-'),
            ];
        }

        ksort($byClinic);
        $summary = [['Total kunjungan', (string) count($rows)]];
        foreach ($byStatus as $status => $count) {
            $summary[] = [$status, (string) $count];
        }
        foreach ($byClinic as $clinic => $count) {
            $summary[] = [$clinic, (string) $count];
        }
        if ($truncated) {
            $summary[] = ['Catatan', 'Hanya ' . self::MAX_ROWS . ' kunjungan pertama yang dimuat'];
        }

        return $this->document(
            'Laporan Kunjungan',
            $from,
            $to,
            $printedBy,
            ['No', 'Tanggal', 'Pasien', 'Poliklinik', 'Dokter', 'Antrean', 'Status', 'Diagnosis / keluhan'],
            [30, 68, 120, 96, 120, 48, 88, 206],
            $table,
            'Tidak ada kunjungan pada periode ini.',
            $summary,
            ['Kelompok', 'Jumlah'],
            [220, 80],
            []
        );
    }

    private function medicine(string $from, string $to, string $printedBy): array
    {
        $rows = db_connect()->query(
            'SELECT mutasi_stok.created_at, mutasi_stok.jumlah, mutasi_stok.stok_sebelum, mutasi_stok.stok_sesudah, ' .
            'mutasi_stok.keterangan, obat.nama_obat, obat.satuan, users.nama_lengkap AS petugas ' .
            'FROM mutasi_stok ' .
            'JOIN obat ON obat.id_obat = mutasi_stok.id_obat ' .
            'JOIN users ON users.id_user = mutasi_stok.id_user ' .
            "WHERE mutasi_stok.jenis_mutasi = 'Keluar' AND mutasi_stok.created_at >= ? AND mutasi_stok.created_at <= ? " .
            'ORDER BY mutasi_stok.created_at ASC, obat.nama_obat ASC ' .
            'LIMIT ' . (self::MAX_ROWS + 1),
            [$from . ' 00:00:00', $to . ' 23:59:59']
        )->getResultArray();
        $truncated = count($rows) > self::MAX_ROWS;
        $rows = array_slice($rows, 0, self::MAX_ROWS);
        $totals = [];
        $quantity = 0;
        $table = [];

        foreach ($rows as $index => $row) {
            $name = (string) $row['nama_obat'];
            $unit = (string) $row['satuan'];
            $amount = (int) $row['jumlah'];
            $quantity += $amount;
            $key = $name . "\n" . $unit;
            if (!isset($totals[$key])) {
                $totals[$key] = ['nama' => $name, 'satuan' => $unit, 'jumlah' => 0];
            }
            $totals[$key]['jumlah'] += $amount;
            $table[] = [
                (string) ($index + 1),
                $this->dateTime((string) $row['created_at']),
                $name,
                $unit,
                (string) $amount,
                (string) $row['stok_sebelum'],
                (string) $row['stok_sesudah'],
                (string) $row['petugas'],
                $row['keterangan'] !== null && $row['keterangan'] !== '' ? (string) $row['keterangan'] : '-',
            ];
        }

        $summary = [
            ['Transaksi keluar', (string) count($rows)],
            ['Total jumlah obat', (string) $quantity],
        ];
        if ($truncated) {
            $summary[] = ['Catatan', 'Hanya ' . self::MAX_ROWS . ' transaksi pertama yang dimuat'];
        }
        $recap = [];
        foreach ($totals as $item) {
            $recap[] = [$item['nama'], $item['satuan'], (string) $item['jumlah']];
        }

        return [
            'title' => 'Laporan Pengeluaran Obat',
            'subtitle' => 'Periode ' . $this->date($from) . ' sampai ' . $this->date($to) . '. Dicetak oleh ' . $printedBy . ' pada ' . $this->dateTime(date('Y-m-d H:i:s')) . '.',
            'note' => 'Pengeluaran dihitung dari mutasi stok berjenis Keluar, termasuk obat yang diracik untuk resep dan pengeluaran manual.',
            'columns' => ['No', 'Waktu', 'Obat', 'Satuan', 'Jumlah', 'Stok awal', 'Stok akhir', 'Petugas', 'Keterangan'],
            'widths' => [28, 88, 120, 48, 46, 54, 54, 100, 238],
            'rows' => $table,
            'empty' => 'Tidak ada pengeluaran obat pada periode ini.',
            'summary' => $summary,
            'recapTitle' => 'Rekapitulasi per obat',
            'recapColumns' => ['Obat', 'Satuan', 'Total keluar'],
            'recapWidths' => [280, 80, 90],
            'recapRows' => $recap,
        ];
    }

    private function document(
        string $title,
        string $from,
        string $to,
        string $printedBy,
        array $columns,
        array $widths,
        array $rows,
        string $empty,
        array $summary,
        array $recapColumns,
        array $recapWidths,
        array $recapRows
    ): array {
        return [
            'title' => $title,
            'subtitle' => 'Periode ' . $this->date($from) . ' sampai ' . $this->date($to) . '. Dicetak oleh ' . $printedBy . ' pada ' . $this->dateTime(date('Y-m-d H:i:s')) . '.',
            'note' => '',
            'columns' => $columns,
            'widths' => $widths,
            'rows' => $rows,
            'empty' => $empty,
            'summary' => $summary,
            'recapTitle' => 'Rekapitulasi',
            'recapColumns' => $recapColumns,
            'recapWidths' => $recapWidths,
            'recapRows' => $recapRows,
        ];
    }

    private function pdf(array $document): string
    {
        $pdf = new SimplePdf();
        $cursor = 34.0;
        $cursor = $this->pdfHeading($pdf, $document, $cursor, true);
        foreach ($document['summary'] as $item) {
            $cursor = $this->pdfEnsure($pdf, $cursor, 16, $document);
            $pdf->text(32, 595.28 - $cursor - 10, 9, $item[0] . ': ' . $item[1]);
            $cursor += 13;
        }
        $cursor += 6;
        $cursor = $this->pdfTable($pdf, $document['columns'], $document['widths'], $document['rows'], $document['empty'], $cursor, $document);
        if ($document['recapRows'] !== []) {
            $cursor += 16;
            $cursor = $this->pdfEnsure($pdf, $cursor, 36, $document);
            $pdf->text(32, 595.28 - $cursor - 12, 12, $document['recapTitle'], true);
            $cursor += 20;
            $this->pdfTable($pdf, $document['recapColumns'], $document['recapWidths'], $document['recapRows'], '', $cursor, $document);
        }

        return $pdf->render();
    }

    private function pdfHeading(SimplePdf $pdf, array $document, float $cursor, bool $full): float
    {
        $pdf->text(32, 595.28 - $cursor - 14, 16, $document['title'], true);
        $cursor += 22;
        if ($full) {
            $pdf->text(32, 595.28 - $cursor - 10, 9, $document['subtitle']);
            $cursor += 16;
            if ($document['note'] !== '') {
                $pdf->text(32, 595.28 - $cursor - 10, 9, $document['note']);
                $cursor += 16;
            }
        }

        return $cursor + 6;
    }

    private function pdfTable(SimplePdf $pdf, array $columns, array $widths, array $rows, string $empty, float $cursor, array $document): float
    {
        $cursor = $this->pdfHeaderRow($pdf, $columns, $widths, $cursor);
        if ($rows === []) {
            if ($empty !== '') {
                $pdf->text(32, 595.28 - $cursor - 14, 9, $empty);
                $cursor += 20;
            }

            return $cursor;
        }

        foreach ($rows as $row) {
            $lines = [];
            $lineCount = 1;
            foreach ($columns as $index => $ignored) {
                $wrapped = $this->wrap((string) ($row[$index] ?? ''), (float) $widths[$index]);
                $lines[] = $wrapped;
                $lineCount = max($lineCount, count($wrapped));
            }
            $height = 8 + ($lineCount * 11);
            $cursor = $this->pdfEnsure($pdf, $cursor, $height + 20, $document, $columns, $widths);
            $this->pdfCells($pdf, $widths, $lines, $cursor, $height, false);
            $cursor += $height;
        }

        return $cursor;
    }

    private function pdfHeaderRow(SimplePdf $pdf, array $columns, array $widths, float $cursor): float
    {
        $x = 32.0;
        foreach ($columns as $index => $label) {
            $width = (float) $widths[$index];
            $pdf->fill($x, 595.28 - $cursor - 18, $width, 18, '0.93 0.97 0.95');
            $pdf->stroke($x, 595.28 - $cursor - 18, $width, 18);
            $pdf->text($x + 4, 595.28 - $cursor - 12, 8, $label, true);
            $x += $width;
        }

        return $cursor + 18;
    }

    private function pdfCells(SimplePdf $pdf, array $widths, array $lines, float $cursor, float $height, bool $bold): void
    {
        $x = 32.0;
        foreach ($widths as $index => $width) {
            $pdf->stroke($x, 595.28 - $cursor - $height, (float) $width, $height);
            $cellLines = $lines[$index] ?? ['-'];
            foreach ($cellLines as $lineIndex => $line) {
                $pdf->text($x + 4, 595.28 - $cursor - 12 - ($lineIndex * 11), 8, $line, $bold);
            }
            $x += (float) $width;
        }
    }

    private function pdfEnsure(SimplePdf $pdf, float $cursor, float $needed, array $document, array $columns = [], array $widths = []): float
    {
        if ($cursor + $needed <= 560) {
            return $cursor;
        }

        $pdf->nextPage();
        $cursor = $this->pdfHeading($pdf, $document, 34, false);
        if ($columns !== []) {
            $cursor = $this->pdfHeaderRow($pdf, $columns, $widths, $cursor);
        }

        return $cursor;
    }

    private function wrap(string $value, float $width): array
    {
        $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
        if ($value === '') {
            return ['-'];
        }

        $limit = max(4, (int) floor(($width - 8) / 4.3));
        $words = preg_split('/\s/u', $value) ?: [$value];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            if (mb_strlen($word) > $limit) {
                $word = mb_substr($word, 0, $limit - 1) . '…';
            }
            $candidate = $current === '' ? $word : $current . ' ' . $word;
            if (mb_strlen($candidate) <= $limit) {
                $current = $candidate;
                continue;
            }
            if ($current !== '') {
                $lines[] = $current;
            }
            $current = $word;
            if (count($lines) === 3) {
                $current = '';
                break;
            }
        }

        if ($current !== '' && count($lines) < 3) {
            $lines[] = $current;
        }
        if ($lines === []) {
            return ['-'];
        }
        if (count($lines) === 3 && mb_strlen($value) > $limit * 3) {
            $lines[2] = rtrim(mb_substr($lines[2], 0, max(1, $limit - 1))) . '…';
        }

        return $lines;
    }

    private function excel(array $document): string
    {
        $detail = array_merge(
            [[$document['title']], [$document['subtitle']], [$document['note']], [''], $document['columns']],
            $document['rows'] !== [] ? $document['rows'] : [[$document['empty']]]
        );
        $recap = array_merge(
            [[$document['recapTitle']], [''], ['Ringkasan', 'Jumlah']],
            $document['summary'],
            [['']],
            [$document['recapColumns']],
            $document['recapRows'] !== [] ? $document['recapRows'] : [['Tidak ada rincian tambahan']]
        );

        return $this->workbook([
            'Rincian' => $detail,
            'Rekap' => $recap,
        ]);
    }

    private function workbook(array $sheets): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?mso-application progid="Excel.Sheet"?>' . "\n";
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';

        foreach ($sheets as $name => $rows) {
            $xml .= '<Worksheet ss:Name="' . $this->xml((string) $name) . '"><Table>';
            foreach ($rows as $row) {
                $xml .= '<Row>';
                foreach ($row as $cell) {
                    $xml .= '<Cell><Data ss:Type="String">' . $this->xml((string) $cell) . '</Data></Cell>';
                }
                $xml .= '</Row>';
            }
            $xml .= '</Table></Worksheet>';
        }

        return $xml . '</Workbook>';
    }

    private function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function text($value): string
    {
        $text = trim((string) $value);

        return $text === '' ? '-' : $text;
    }

    private function vitals(array $row): string
    {
        $parts = [];
        if ($row['tekanan_darah'] !== null && $row['tekanan_darah'] !== '') {
            $parts[] = 'TD ' . $row['tekanan_darah'];
        }
        if ($row['suhu_tubuh'] !== null && $row['suhu_tubuh'] !== '') {
            $parts[] = 'suhu ' . $row['suhu_tubuh'] . ' C';
        }
        if ($row['laju_respirasi'] !== null && $row['laju_respirasi'] !== '') {
            $parts[] = 'RR ' . $row['laju_respirasi'];
        }
        if ($row['berat_badan'] !== null && $row['berat_badan'] !== '') {
            $parts[] = 'BB ' . $row['berat_badan'] . ' kg';
        }
        if ($row['tinggi_badan'] !== null && $row['tinggi_badan'] !== '') {
            $parts[] = 'TB ' . $row['tinggi_badan'] . ' cm';
        }

        return $parts === [] ? '-' : implode(', ', $parts);
    }

    private function date(string $value): string
    {
        $parsed = \DateTimeImmutable::createFromFormat('Y-m-d', substr($value, 0, 10));

        return $parsed instanceof \DateTimeImmutable ? $parsed->format('d-m-Y') : $value;
    }

    private function dateTime(string $value): string
    {
        $parsed = \DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $value);

        return $parsed instanceof \DateTimeImmutable ? $parsed->format('d-m-Y H:i') : $value;
    }
}
