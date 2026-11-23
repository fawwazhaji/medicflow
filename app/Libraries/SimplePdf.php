<?php

namespace App\Libraries;

class SimplePdf
{
    private const PAGE_WIDTH = 841.89;
    private const PAGE_HEIGHT = 595.28;

    /** @var list<string> */
    private array $pages = [];

    private string $stream = '';

    public function nextPage(): void
    {
        if ($this->stream === '') {
            return;
        }

        $this->pages[] = $this->stream;
        $this->stream = '';
    }

    public function fill(float $x, float $y, float $width, float $height, string $rgb): void
    {
        $this->stream .= $rgb . " rg\n" . $this->number($x) . ' ' . $this->number($y) . ' ' . $this->number($width) . ' ' . $this->number($height) . " re f\n";
    }

    public function stroke(float $x, float $y, float $width, float $height): void
    {
        $this->stream .= "0.86 0.90 0.89 RG\n0.6 w\n" . $this->number($x) . ' ' . $this->number($y) . ' ' . $this->number($width) . ' ' . $this->number($height) . " re S\n";
    }

    public function text(float $x, float $y, float $size, string $value, bool $bold = false): void
    {
        $font = $bold ? 'F2' : 'F1';
        $this->stream .= "BT /{$font} " . $this->number($size) . ' Tf 0.09 0.16 0.15 rg 1 0 0 1 ' . $this->number($x) . ' ' . $this->number($y) . ' Tm (' . $this->escape($value) . ") Tj ET\n";
    }

    public function render(): string
    {
        if ($this->stream !== '' || $this->pages === []) {
            $this->pages[] = $this->stream;
            $this->stream = '';
        }

        $pageCount = count($this->pages);
        $objects = [];
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $pageNumbers = [];
        $contentNumbers = [];
        $next = 3;

        foreach ($this->pages as $ignored) {
            $pageNumbers[] = $next;
            $contentNumbers[] = $next + 1;
            $next += 2;
        }

        $regularFont = $next;
        $boldFont = $next + 1;
        $kids = array_map(static fn (int $number): string => $number . ' 0 R', $pageNumbers);
        $objects[2] = '<< /Type /Pages /Count ' . $pageCount . ' /Kids [' . implode(' ', $kids) . '] >>';

        foreach ($this->pages as $index => $stream) {
            $objects[$pageNumbers[$index]] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . self::PAGE_WIDTH . ' ' . self::PAGE_HEIGHT . '] /Contents ' . $contentNumbers[$index] . ' 0 R /Resources << /Font << /F1 ' . $regularFont . ' 0 R /F2 ' . $boldFont . ' 0 R >> >> >>';
            $objects[$contentNumbers[$index]] = "<< /Length " . strlen($stream) . " >>\nstream\n" . $stream . 'endstream';
        }

        $objects[$regularFont] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[$boldFont] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        $size = $boldFont;

        for ($number = 1; $number <= $size; $number++) {
            $offsets[$number] = strlen($pdf);
            $pdf .= $number . " 0 obj\n" . $objects[$number] . "\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= 'xref\n0 ' . ($size + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";

        for ($number = 1; $number <= $size; $number++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$number]);
        }

        $pdf .= "trailer\n<< /Size " . ($size + 1) . " /Root 1 0 R >>\nstartxref\n" . $xref . "\n%%EOF";

        return $pdf;
    }

    private function number(float $value): string
    {
        return rtrim(rtrim(sprintf('%.2F', $value), '0'), '.');
    }

    private function escape(string $value): string
    {
        $converted = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value);
        if ($converted === false) {
            $converted = preg_replace('/[^\x20-\x7E]/', '?', $value) ?? '';
        }

        $escaped = '';
        $length = strlen($converted);

        for ($index = 0; $index < $length; $index++) {
            $character = $converted[$index];
            $code = ord($character);
            if ($character === '\\' || $character === '(' || $character === ')') {
                $escaped .= '\\' . $character;
            } elseif ($code < 32 || $code > 126) {
                $escaped .= sprintf('\\%03o', $code);
            } else {
                $escaped .= $character;
            }
        }

        return $escaped;
    }
}
