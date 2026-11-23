<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class Share extends BaseCommand
{
    protected $group = 'MedicFlow';
    protected $name = 'share';
    protected $description = 'Share the development server at http://127.0.0.1:8081/ through a temporary public HTTPS address.';
    protected $usage = 'share';

    public function run(array $params)
    {
        if (ENVIRONMENT !== 'development') {
            CLI::error('php spark share only runs when CI_ENVIRONMENT is development.');

            return EXIT_ERROR;
        }

        if (! $this->enableTunnelMode()) {
            return EXIT_ERROR;
        }

        if (! $this->serverIsUp()) {
            CLI::error('The app is not running at http://127.0.0.1:8081/.');
            CLI::write('Start it first: php spark serve --host 127.0.0.1 --port 8081', 'yellow');

            return EXIT_ERROR;
        }

        $binary = $this->cloudflared();
        if ($binary === null) {
            return EXIT_ERROR;
        }

        CLI::write('Opening a temporary public tunnel to http://127.0.0.1:8081/', 'green');
        CLI::write('Leave this window open while your friend tests. Press Ctrl+C to stop. The address changes every time you start it.', 'yellow');

        $command = escapeshellarg($binary) . ' tunnel --url http://127.0.0.1:8081 --no-autoupdate';
        passthru($command, $exitCode);

        return $exitCode === 0 ? EXIT_SUCCESS : EXIT_ERROR;
    }

    private function enableTunnelMode(): bool
    {
        $path = ROOTPATH . '.env';
        if (! is_file($path) || ! is_readable($path) || ! is_writable($path)) {
            CLI::error('Could not update .env. Set MEDICFLOW_TUNNEL = true and run this command again.');

            return false;
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            CLI::error('Could not read .env.');

            return false;
        }

        if (preg_match('/^MEDICFLOW_TUNNEL\s*=/m', $contents)) {
            $updated = preg_replace('/^MEDICFLOW_TUNNEL\s*=.*$/m', 'MEDICFLOW_TUNNEL = true', $contents, 1);
        } else {
            $updated = rtrim($contents) . PHP_EOL . PHP_EOL . 'MEDICFLOW_TUNNEL = true' . PHP_EOL;
        }

        if (! is_string($updated) || file_put_contents($path, $updated) === false) {
            CLI::error('Could not write MEDICFLOW_TUNNEL to .env.');

            return false;
        }

        return true;
    }

    private function serverIsUp(): bool
    {
        $connection = @fsockopen('127.0.0.1', 8081, $errorNumber, $errorMessage, 2);
        if (! is_resource($connection)) {
            return false;
        }

        fclose($connection);

        return true;
    }

    private function cloudflared(): ?string
    {
        $onPath = $this->findOnPath('cloudflared');
        if ($onPath !== null) {
            return $onPath;
        }

        $target = WRITEPATH . 'tunnel' . DIRECTORY_SEPARATOR . 'cloudflared.exe';
        if (is_file($target)) {
            return $target;
        }

        $directory = dirname($target);
        if (! is_dir($directory) && ! mkdir($directory, 0755, true) && ! is_dir($directory)) {
            CLI::error('Could not create writable/tunnel.');

            return null;
        }

        CLI::write('Downloading Cloudflare Tunnel...', 'yellow');
        $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
        $command = 'curl.exe -L --fail --silent --show-error -o ' . escapeshellarg($target) . ' ' . escapeshellarg($url);
        passthru($command, $exitCode);

        if ($exitCode !== 0 || ! is_file($target) || filesize($target) < 1000000) {
            @unlink($target);
            CLI::error('Could not download cloudflared. Install it, then run php spark share again.');

            return null;
        }

        return $target;
    }

    private function findOnPath(string $name): ?string
    {
        $command = PHP_OS_FAMILY === 'Windows'
            ? 'where.exe ' . escapeshellarg($name) . ' 2>NUL'
            : 'command -v ' . escapeshellarg($name) . ' 2>/dev/null';
        $output = shell_exec($command);
        if (! is_string($output)) {
            return null;
        }

        $path = trim(strtok($output, "\r\n") ?: '');

        return $path !== '' && is_file($path) ? $path : null;
    }
}
