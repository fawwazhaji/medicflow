"use strict";

const apiBase = window.MEDICFLOW_API_BASE || "/api";
const tokenKey = "medicflow_access_token";
const userKey = "medicflow_user";
const roleLabels = { pasien: "Pasien", dokter: "Dokter", perawat: "Perawat", farmasi: "Farmasi", admin: "Administrator" };
const roleMenus = {
    pasien: [
        ["overview", "⌂", "Ringkasan"],
        ["appointments", "▦", "Antrean & jadwal"],
        ["examinations", "♡", "Riwayat pemeriksaan"],
        ["prescriptions", "▤", "Resep obat"],
        ["notifications", "◉", "Notifikasi"],
        ["profile", "◌", "Profil saya"]
    ],
    dokter: [
        ["overview", "⌂", "Ringkasan"],
        ["queue", "▦", "Daftar pasien"],
        ["queueHistory", "◷", "Riwayat antrean"],
        ["schedules", "◷", "Jadwal praktik"],
        ["examinations", "♡", "Pemeriksaan"]
    ],
    perawat: [
        ["overview", "⌂", "Ringkasan"],
        ["triage", "♡", "Pemeriksaan awal"]
    ],
    farmasi: [
        ["overview", "⌂", "Ringkasan"],
        ["prescriptions", "▤", "Antrean resep"],
        ["medicines", "✚", "Katalog obat"],
        ["stock", "▥", "Stok & mutasi"],
        ["pickup", "✓", "Pengambilan"]
    ],
    admin: [
        ["overview", "⌂", "Ringkasan"],
        ["staff", "♙", "Akun staf"],
        ["resources", "▦", "Kelola data"]
    ]
};
let qrScanner = null;
let cameraScanning = false;

function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(String(value).slice(0, 10) + "T00:00:00");
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function showToast(message, isError) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast visible" + (isError ? " error" : "");
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(function () { toast.className = "toast"; }, 4000);
}

async function request(path, options) {
    const settings = options || {};
    const headers = new Headers(settings.headers || {});
    headers.set("Accept", "application/json");
    if (settings.body != null) headers.set("Content-Type", "application/json");
    const token = sessionStorage.getItem(tokenKey);
    if (token) headers.set("Authorization", "Bearer " + token);

    let response;
    try {
        response = await fetch(apiBase.replace(/\/$/, "") + "/" + path.replace(/^\//, ""), {
            method: settings.method || "GET",
            headers: headers,
            body: settings.body == null ? undefined : JSON.stringify(settings.body)
        });
    } catch (_error) {
        throw new Error("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }

    let payload;
    try {
        payload = await response.json();
    } catch (_error) {
        throw new Error("Server mengembalikan respons yang tidak dapat dibaca.");
    }
    if (response.status === 401) {
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem(userKey);
        if (document.body.classList.contains("app-page")) window.location.assign(window.MEDICFLOW_LOGIN_URL);
        throw new Error(payload.message || "Sesi berakhir. Silakan masuk kembali.");
    }
    if (!response.ok || payload.status === false) {
        const details = payload.errors && typeof payload.errors === "object"
            ? Object.values(payload.errors).flat().join(" ")
            : "";
        throw new Error(payload.message || details || "Permintaan gagal (" + response.status + ").");
    }
    return payload;
}

async function requestImage(path) {
    const headers = new Headers({ Accept: "image/png" });
    const token = sessionStorage.getItem(tokenKey);
    if (token) headers.set("Authorization", "Bearer " + token);

    let response;
    try {
        response = await fetch(apiBase.replace(/\/$/, "") + "/" + path.replace(/^\//, ""), { headers: headers });
    } catch (_error) {
        throw new Error("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }

    if (response.status === 401) {
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem(userKey);
        if (document.body.classList.contains("app-page")) window.location.assign(window.MEDICFLOW_LOGIN_URL);
        throw new Error("Sesi berakhir. Silakan masuk kembali.");
    }
    if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const payload = await response.json();
            throw new Error(payload.message || "QR belum dapat ditampilkan.");
        }
        throw new Error("QR belum dapat ditampilkan.");
    }

    return response.blob();
}

function formObject(form) {
    const object = {};
    new FormData(form).forEach(function (value, key) {
        if (value !== "") object[key] = value;
    });
    return object;
}

function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
        button.dataset.originalText = button.textContent;
        button.disabled = true;
        button.textContent = label || "Memproses...";
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || label || "Simpan";
    }
}


const pageTitles = {
    overview: "Ringkasan", appointments: "Antrean & jadwal", examinations: "Riwayat pemeriksaan",
    prescriptions: "Resep obat", notifications: "Notifikasi", profile: "Profil saya",
    queue: "Daftar pasien", schedules: "Jadwal praktik", triage: "Pemeriksaan awal", medicines: "Katalog obat",
    queueHistory: "Riwayat antrean", stock: "Stok & mutasi", pickup: "Pengambilan obat",
    staff: "Akun staf", resources: "Kelola data"
};
const state = {
    role: null,
    user: null,
    page: "overview",
    data: {},
    historyFilters: {
        appointments: { status: "semua", checkin: "semua", doctor: "semua", from: "", to: "", query: "" },
        examinations: { from: "", to: "", query: "" }
    }
};
let patientUpdateTimer = null;
let patientNotificationIds = new Set();
let patientPollingErrorShown = false;

const adminResources = [
    ["users", "Akun pengguna"], ["pasien", "Pasien"], ["dokter", "Dokter"],
    ["poliklinik", "Poliklinik"], ["jadwal-dokter", "Jadwal dokter"],
    ["pendaftaran", "Pendaftaran"], ["pemeriksaan", "Pemeriksaan"],
    ["resep", "Resep"], ["detail-resep", "Detail resep"], ["obat", "Obat"],
    ["pengambilan-obat", "Pengambilan obat"], ["notifikasi", "Notifikasi"]
];
const resourceIdKeys = {
    users: "id_user", pasien: "id_pasien", dokter: "id_dokter", poliklinik: "id_poli",
    "jadwal-dokter": "id_jadwal", pendaftaran: "id_pendaftaran", pemeriksaan: "id_pemeriksaan",
    resep: "id_resep", "detail-resep": "id_detail", obat: "id_obat",
    "pengambilan-obat": "id_pengambilan", notifikasi: "id_notifikasi"
};
