<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#047857">
    <title>Masuk - MedicFlow</title>
    <link rel="stylesheet" href="<?= esc(parse_url(base_url('assets/css/app.css'), PHP_URL_PATH)) ?>">
</head>
<body class="auth-page">
    <main class="auth-shell">
        <section class="auth-intro">
            <a class="brand brand-light" href="<?= esc(parse_url(site_url('/'), PHP_URL_PATH)) ?>">
                <span class="brand-mark">+</span>
                <span>MedicFlow</span>
            </a>
            <p class="eyebrow">KLINIK MEDICFLOW</p>
            <h1>Masuk untuk melanjutkan layanan Anda.</h1>
            <ul class="intro-points">
                <li>Pasien mengatur kunjungan dan melihat resep</li>
                <li>Perawat, dokter, dan farmasi bekerja sesuai tugasnya</li>
                <li>Admin mengelola data dan laporan klinik</li>
            </ul>
        </section>

        <section class="auth-card">
            <div class="card-heading">
                <span class="eyebrow">AKUN</span>
                <h2>Masuk</h2>
                <p>Isi username dan password yang sudah terdaftar.</p>
            </div>
            <form id="loginForm">
                <label class="field-label" for="username">Username</label>
                <input class="field" id="username" name="username" autocomplete="username" required maxlength="50" placeholder="Masukkan username">
                <label class="field-label" for="password">Password</label>
                <input class="field" id="password" name="password" type="password" autocomplete="current-password" required placeholder="Masukkan password">
                <p id="formMessage" class="form-message" role="status" aria-live="polite"></p>
                <button class="button button-primary button-wide" id="submitButton" type="submit">Masuk <span>→</span></button>
            </form>
            <p class="auth-footer">Belum punya akun pasien? <a href="<?= esc(parse_url(site_url('register'), PHP_URL_PATH)) ?>">Daftar sebagai pasien</a></p>
            <p class="auth-footnote">Akun dokter, perawat, farmasi, dan admin dibuat oleh administrator.</p>
        </section>
    </main>
    <script>
        window.MEDICFLOW_API_BASE = <?= json_encode(rtrim(parse_url(site_url('api'), PHP_URL_PATH), '/'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_LOGIN_URL = <?= json_encode(parse_url(site_url('login'), PHP_URL_PATH), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_APP_URL = <?= json_encode(parse_url(site_url('app'), PHP_URL_PATH), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_REGISTER_URL = <?= json_encode(parse_url(site_url('register'), PHP_URL_PATH), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    </script>
    <script src="<?= esc(parse_url(base_url('assets/js/core.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/auth.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/app.js'), PHP_URL_PATH)) ?>" defer></script>
</body>
</html>
