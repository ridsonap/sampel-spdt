/**
 * app.js - Logika Bisnis & Sinkronisasi Cloud Multi-User
 * BPS Kabupaten Kepulauan Selayar (DSRT 7301)
 */

// State Management
const STATE = {
  user: null,
  data: [],            // Seluruh 1.643 data (Utama + Pengganti)
  replacements: {},    // Map: utamaId -> ReplacementRecord
  cloudSync: false,    // Indikator status koneksi ke cloud (Vercel KV)
  filters: {
    search: '',
    kec: '',
    desa: '',
    subsektor: '',
    status: 'ALL',     // ALL, BELUM_DIGANTI, SUDAH_DIGANTI
    page: 1,
    perPage: 15
  },
  modal: {
    activeUtama: null,
    scope: 'sls',      // sls, desa, kecamatan, lintas_kecamatan
    filterKec: '',     // Filter kecamatan pilihan di modal
    filterDesa: '',    // Filter desa pilihan di modal
    requireSubsektor: true,
    prioritizeStrata: true,
    alasan: 'Responden Menolak (Refusal)',
    catatan: ''
  }
};

const STORAGE_KEYS = {
  AUTH: 'dsrt_7301_auth_user',
  REPLACEMENTS: 'dsrt_7301_replacements_v1'
};

// Manajemen Pengguna & Hak Akses (Role-Based Access Control)
const USERS = [
  {
    username: 'admin',
    password: 'akunadmin',
    name: 'Administrator',
    role: 'admin'        // Akses penuh: Ganti sampel, reset data, ekspor Berita Acara & DSRT Mutakhir
  },
  {
    username: 'petugas',
    password: '1234',
    name: 'Petugas Lapangan',
    role: 'petugas'      // Akses terbatas: Ganti sampel, pencarian, detail/undo (tanpa unduh ekspor)
  }
];

let syncInterval = null;

// Inisialisasi Aplikasi
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initData();
  setupEventListeners();
  renderKecamatanOptions();
  renderDashboard();

  // Sinkronisasi awal dengan cloud & start background polling
  syncWithCloud(false);
  startAutoSync();
});

// Autentikasi
function initAuth() {
  const savedUser = sessionStorage.getItem(STORAGE_KEYS.AUTH);
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      const match = USERS.find(u => u.username === parsed.username);
      if (match) {
        parsed.role = match.role;
        parsed.name = match.name;
      } else {
        parsed.role = parsed.role || 'petugas';
      }
      STATE.user = parsed;
      showAppScreen();
      return;
    } catch (e) {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH);
    }
  }
  showLoginScreen();
}

function handleLogin(e) {
  if (e) e.preventDefault();
  const usernameInput = document.getElementById('login-username').value.trim();
  const passwordInput = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');

  const foundUser = USERS.find(u =>
    (u.username === usernameInput && u.password === passwordInput) ||
    (u.pin && (usernameInput === u.pin || passwordInput === u.pin))
  );

  if (foundUser) {
    const user = {
      username: foundUser.username,
      name: foundUser.name,
      role: foundUser.role,
      loginTime: new Date().toISOString()
    };
    STATE.user = user;
    sessionStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(user));
    errorEl.classList.add('hidden');
    showAppScreen();
    showToast(`Selamat datang, ${foundUser.name}! (${foundUser.role.toUpperCase()})`, 'success');
  } else {
    errorEl.textContent = 'Kredensial tidak valid. Silakan periksa kembali.';
    errorEl.classList.remove('hidden');
  }
}

function handleLogout() {
  sessionStorage.removeItem(STORAGE_KEYS.AUTH);
  STATE.user = null;
  if (syncInterval) clearInterval(syncInterval);
  showLoginScreen();
  showToast('Sesi telah diakhiri.', 'info');
}

function showLoginScreen() {
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-app').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  updateUserUI();
  renderDashboard();
}

function updateUserUI() {
  if (!STATE.user) return;
  const isAdmin = STATE.user.role === 'admin';

  const userDisplay = document.getElementById('user-display');
  const roleBadge = document.getElementById('user-role-badge');
  const btnReset = document.getElementById('btn-reset-data');
  const btnBA = document.getElementById('btn-export-ba');
  const btnDSRT = document.getElementById('btn-export-dsrt');
  const exportNotice = document.getElementById('export-admin-notice');

  if (userDisplay) {
    userDisplay.textContent = STATE.user.username;
  }

  if (roleBadge) {
    if (isAdmin) {
      roleBadge.textContent = 'ADMIN';
      roleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300';
    } else {
      roleBadge.textContent = 'PETUGAS';
      roleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200';
    }
  }

  if (btnReset) {
    if (isAdmin) {
      btnReset.classList.remove('hidden');
    } else {
      btnReset.classList.add('hidden');
    }
  }

  if (isAdmin) {
    if (btnBA) {
      btnBA.className = 'inline-flex items-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer';
      btnBA.title = 'Unduh Berita Acara Pergantian Sampel (Format CSV)';
    }
    if (btnDSRT) {
      btnDSRT.className = 'inline-flex items-center px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer';
      btnDSRT.title = 'Unduh Daftar Sampel Mutakhir Lengkap (Format CSV)';
    }
    if (exportNotice) {
      exportNotice.classList.add('hidden');
    }
  } else {
    if (btnBA) {
      btnBA.className = 'inline-flex items-center px-3 py-2 bg-slate-100 text-slate-400 hover:bg-slate-200 text-xs font-medium rounded-xl border border-slate-200 transition-all cursor-pointer';
      btnBA.title = 'Akses Terbatas: Hanya Akun Admin yang dapat mengunduh Berita Acara';
    }
    if (btnDSRT) {
      btnDSRT.className = 'inline-flex items-center px-3 py-2 bg-slate-100 text-slate-400 hover:bg-slate-200 text-xs font-medium rounded-xl border border-slate-200 transition-all cursor-pointer';
      btnDSRT.title = 'Akses Terbatas: Hanya Akun Admin yang dapat mengunduh DSRT Mutakhir';
    }
    if (exportNotice) {
      exportNotice.classList.remove('hidden');
    }
  }
}

// Data Handling & Local Storage
function initData() {
  if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA)) {
    STATE.data = INITIAL_DATA;
  } else {
    console.error('INITIAL_DATA tidak ditemukan!');
    STATE.data = [];
  }

  // Load cache lokal dulu
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.REPLACEMENTS);
    if (saved) {
      STATE.replacements = JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Gagal membaca localStorage:', err);
    STATE.replacements = {};
  }
}

function saveLocalReplacements() {
  try {
    localStorage.setItem(STORAGE_KEYS.REPLACEMENTS, JSON.stringify(STATE.replacements));
  } catch (err) {
    console.error('Gagal simpan lokal:', err);
  }
}

// Cloud Synchronization (Vercel KV Serverless)
async function syncWithCloud(showToastFeedback = false) {
  const syncBtn = document.getElementById('btn-sync-cloud');
  const syncIcon = document.getElementById('sync-icon');
  const syncText = document.getElementById('sync-status-text');
  const indicator = document.getElementById('cloud-indicator');

  if (syncIcon) syncIcon.classList.add('animate-spin');
  if (syncText) syncText.textContent = 'Menyinkronkan...';

  try {
    const response = await fetch('/api/replacements', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.success && result.data) {
        // Update state dengan data terbaru dari cloud
        STATE.replacements = result.data;
        saveLocalReplacements();
        STATE.cloudSync = true;

        if (indicator) {
          indicator.className = 'w-2 h-2 rounded-full bg-emerald-500';
          indicator.title = result.source === 'kv' ? 'Tersinkronisasi Vercel KV' : 'Tersinkronisasi Cloud';
        }

        renderDashboard();
        if (showToastFeedback) {
          showToast(`Sinkronisasi sukses! (${result.count} sampel diganti)`, 'success');
        }
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    // Mode offline / fallback ke localStorage
    STATE.cloudSync = false;
    if (indicator) {
      indicator.className = 'w-2 h-2 rounded-full bg-amber-500';
      indicator.title = 'Mode Offline (Menggunakan Cache Lokal)';
    }
    if (showToastFeedback) {
      showToast('Tidak dapat terhubung ke cloud serverless. Menggunakan data lokal.', 'info');
    }
  } finally {
    if (syncIcon) syncIcon.classList.remove('animate-spin');
    if (syncText) syncText.textContent = 'Sinkron';
  }
}

function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  // Auto-sync berkala setiap 25 detik agar pergantian dari petugas lain otomatis muncul
  syncInterval = setInterval(() => {
    if (STATE.user) {
      syncWithCloud(false);
    }
  }, 25000);
}

async function pushReplacementToCloud(action, payload) {
  try {
    const response = await fetch('/api/replacements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.data) {
        STATE.replacements = resData.data;
        saveLocalReplacements();
        renderDashboard();
      }
      return true;
    }
  } catch (err) {
    console.warn('Gagal push ke cloud API, perubahan tetap tersimpan lokal:', err);
  }
  return false;
}

async function resetAllData() {
  if (!STATE.user || STATE.user.role !== 'admin') {
    showToast('Akses dibatasi: Hanya akun Admin yang berhak me-reset seluruh data.', 'error');
    return;
  }

  if (confirm('PERINGATAN ADMINISTRATOR:\nApakah Anda yakin ingin MENGHAPUS SEMUA riwayat pergantian sampel di cloud dan lokal?')) {
    STATE.replacements = {};
    saveLocalReplacements();
    renderDashboard();

    await pushReplacementToCloud('reset', {});
    showToast('Seluruh data pergantian sampel telah di-reset.', 'info');
  }
}

// Helper Getters
function getUsedPenggantiIds() {
  const ids = new Set();
  Object.values(STATE.replacements).forEach(r => {
    if (r && r.penggantiId) ids.add(r.penggantiId);
  });
  return ids;
}

function getUtamaList() {
  return STATE.data.filter(item => item.status === 'UTAMA');
}

function getPenggantiList() {
  return STATE.data.filter(item => item.status === 'PENGGANTI');
}

// Render Dashboard & UI
function renderDashboard() {
  renderMetrics();
  renderTable();
}

function renderMetrics() {
  const utamaList = getUtamaList();
  const totalUtama = utamaList.length;
  const reps = Object.values(STATE.replacements);
  const replacedCount = reps.length;
  const verifiedCount = reps.filter(r => r && r.verified).length;
  const unverifiedCount = replacedCount - verifiedCount;
  const activeCount = totalUtama - replacedCount;
  const penggantiList = getPenggantiList();
  const usedPenggantiIds = getUsedPenggantiIds();
  const availablePengganti = penggantiList.length - usedPenggantiIds.size;
  const replacePct = totalUtama > 0 ? ((replacedCount / totalUtama) * 100).toFixed(1) : 0;

  document.getElementById('metric-total-utama').textContent = totalUtama;
  document.getElementById('metric-replaced-count').textContent = `${replacedCount} (${replacePct}%)`;
  document.getElementById('metric-active-count').textContent = activeCount;
  document.getElementById('metric-available-pengganti').textContent = `${availablePengganti} / ${penggantiList.length}`;

  const subtitleEl = document.getElementById('metric-verified-subtitle');
  if (subtitleEl) {
    if (replacedCount > 0) {
      subtitleEl.innerHTML = `<span class="text-emerald-600 font-semibold">✓ ${verifiedCount} dicek</span> &bull; <span class="text-amber-600 font-semibold">${unverifiedCount} belum</span>`;
    } else {
      subtitleEl.textContent = 'Menggunakan sampel cadangan';
    }
  }
}

function renderKecamatanOptions() {
  const kecSelect = document.getElementById('filter-kecamatan');
  const kecamatanList = [...new Set(STATE.data.map(d => d.kec))].sort();

  kecSelect.innerHTML = '<option value="">Semua Kecamatan (11)</option>';
  kecamatanList.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    kecSelect.appendChild(opt);
  });
}

function updateDesaOptions(selectedKec) {
  const desaSelect = document.getElementById('filter-desa');
  if (!selectedKec) {
    desaSelect.innerHTML = '<option value="">Semua Desa</option>';
    desaSelect.disabled = true;
    return;
  }

  const desas = [...new Set(STATE.data.filter(d => d.kec === selectedKec).map(d => d.desa))].sort();
  desaSelect.innerHTML = '<option value="">Semua Desa (' + desas.length + ')</option>';
  desas.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    desaSelect.appendChild(opt);
  });
  desaSelect.disabled = false;
}

// Filter & Table
function getFilteredUtamaList() {
  let list = getUtamaList();
  const { search, kec, desa, subsektor, status } = STATE.filters;

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(item =>
      (item.nama && item.nama.toLowerCase().includes(q)) ||
      (item.kode && item.kode.toLowerCase().includes(q)) ||
      (item.alamat && item.alamat.toLowerCase().includes(q)) ||
      (item.sls && item.sls.toLowerCase().includes(q)) ||
      (item.kbli && item.kbli.toLowerCase().includes(q))
    );
  }

  if (kec) {
    list = list.filter(item => item.kec === kec);
  }

  if (desa) {
    list = list.filter(item => item.desa === desa);
  }

  if (subsektor) {
    list = list.filter(item => item.sub === subsektor);
  }

  if (status === 'BELUM_DIGANTI') {
    list = list.filter(item => !STATE.replacements[item.id]);
  } else if (status === 'SUDAH_DIGANTI') {
    list = list.filter(item => !!STATE.replacements[item.id]);
  } else if (status === 'SUDAH_DICEK') {
    list = list.filter(item => !!STATE.replacements[item.id] && !!STATE.replacements[item.id].verified);
  } else if (status === 'BELUM_DICEK') {
    list = list.filter(item => !!STATE.replacements[item.id] && !STATE.replacements[item.id].verified);
  }

  return list;
}

function renderTable() {
  const tbody = document.getElementById('sample-table-body');
  const filtered = getFilteredUtamaList();
  const total = filtered.length;

  const totalPages = Math.max(1, Math.ceil(total / STATE.filters.perPage));
  if (STATE.filters.page > totalPages) STATE.filters.page = totalPages;
  const startIdx = (STATE.filters.page - 1) * STATE.filters.perPage;
  const paginated = filtered.slice(startIdx, startIdx + STATE.filters.perPage);

  document.getElementById('table-count-info').textContent =
    `Menampilkan ${total === 0 ? 0 : startIdx + 1}–${Math.min(startIdx + STATE.filters.perPage, total)} dari ${total} unit sampel utama`;

  renderPaginationControls(totalPages);

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-12 text-center text-slate-500">
          <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="font-medium">Tidak ada sampel utama yang sesuai filter.</p>
          <p class="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci atau reset filter pencarian.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paginated.map((item, idx) => {
    const isReplaced = !!STATE.replacements[item.id];
    const rep = STATE.replacements[item.id];

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isReplaced ? 'bg-amber-50/30' : ''}">
        <td class="px-4 py-3 text-xs font-mono text-slate-500">
          ${startIdx + idx + 1}
        </td>
        <td class="px-4 py-3">
          <div class="font-semibold text-slate-900 text-sm">${escapeHtml(item.nama)}</div>
          <div class="text-xs font-mono text-indigo-700 bg-indigo-50 inline-block px-1.5 py-0.5 rounded border border-indigo-100 mt-0.5">
            ${escapeHtml(item.kode)}
          </div>
        </td>
        <td class="px-4 py-3">
          <div class="text-xs font-medium text-slate-800">${escapeHtml(item.kec)}</div>
          <div class="text-xs text-slate-600">${escapeHtml(item.desa)}</div>
          <div class="text-[11px] text-slate-400 truncate max-w-[200px]" title="${escapeHtml(item.sls)}">${escapeHtml(item.sls)}</div>
        </td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSubsektorBadgeClass(item.sub)}">
            ${escapeHtml(item.sub)}
          </span>
          <div class="text-[11px] text-slate-500 mt-1 truncate max-w-[220px]" title="${escapeHtml(item.kbli)}">
            ${escapeHtml(item.kd_kbli)} - ${escapeHtml(item.kbli)}
          </div>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${item.strata === '1' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
            ${item.strata}
          </span>
        </td>
        <td class="px-4 py-3">
          ${isReplaced ? `
            <div>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
                DIGANTI
              </span>
              <div class="text-[11px] text-slate-600 font-medium mt-1 truncate max-w-[170px]" title="${escapeHtml(rep.penggantiNama)}">
                ➔ ${escapeHtml(rep.penggantiNama)}
              </div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider">${formatScopeLabel(rep.scope)}</div>
            </div>
          ` : `
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              AKTIF
            </span>
          `}
        </td>
        <td class="px-3 py-3 text-center">
          ${!isReplaced ? `
            <span class="text-slate-300 font-mono text-xs">-</span>
          ` : `
            <div class="inline-flex flex-col items-center">
              <label class="relative inline-flex items-center cursor-pointer select-none" title="${STATE.user && STATE.user.role === 'admin' ? (rep.verified ? 'Klik untuk membatalkan verifikasi' : 'Klik untuk menandai sudah dicek') : 'Hanya akun Admin yang dapat menandai verifikasi'}">
                <input type="checkbox"
                  ${rep.verified ? 'checked' : ''}
                  ${STATE.user && STATE.user.role === 'admin' ? `onchange="toggleSampleVerification('${item.id}')"` : 'disabled'}
                  class="w-4 h-4 text-emerald-600 bg-white border-slate-300 rounded focus:ring-emerald-500 focus:ring-1 ${STATE.user && STATE.user.role === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}" />
              </label>
              <span class="text-[10px] font-semibold mt-0.5 ${rep.verified ? 'text-emerald-700' : 'text-slate-400'}">
                ${rep.verified ? '✓ Dicek' : 'Belum'}
              </span>
            </div>
          `}
        </td>
        <td class="px-4 py-3 text-right">
          ${isReplaced ? `
            <button onclick="openDetailModal('${item.id}')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all shadow-sm">
              <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Detail / Undo
            </button>
          ` : `
            <button onclick="openReplaceModal('${item.id}')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
              <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Ganti Sampel
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function renderPaginationControls(totalPages) {
  const container = document.getElementById('table-pagination');
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const cur = STATE.filters.page;
  let buttons = [];

  buttons.push(`
    <button onclick="changePage(${cur - 1})" ${cur === 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-100"'}
      class="px-2.5 py-1 text-xs border border-slate-200 rounded text-slate-700">
      &laquo; Prev
    </button>
  `);

  let start = Math.max(1, cur - 2);
  let end = Math.min(totalPages, cur + 2);
  for (let p = start; p <= end; p++) {
    buttons.push(`
      <button onclick="changePage(${p})"
        class="px-3 py-1 text-xs rounded border ${p === cur ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}">
        ${p}
      </button>
    `);
  }

  buttons.push(`
    <button onclick="changePage(${cur + 1})" ${cur === totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-100"'}
      class="px-2.5 py-1 text-xs border border-slate-200 rounded text-slate-700">
      Next &raquo;
    </button>
  `);

  container.innerHTML = buttons.join('');
}

function changePage(page) {
  STATE.filters.page = page;
  renderTable();
  window.scrollTo({ top: 380, behavior: 'smooth' });
}

// Modal Pergantian Sampel Interaktif
function openReplaceModal(utamaId) {
  const item = STATE.data.find(d => d.id === utamaId);
  if (!item) return;

  STATE.modal.activeUtama = item;
  STATE.modal.scope = 'sls';
  STATE.modal.filterKec = '';
  STATE.modal.filterDesa = '';
  STATE.modal.requireSubsektor = true;
  STATE.modal.prioritizeStrata = true;
  STATE.modal.alasan = 'Responden Menolak (Refusal)';
  STATE.modal.catatan = '';

  document.getElementById('modal-utama-nama').textContent = item.nama;
  document.getElementById('modal-utama-kode').textContent = item.kode;
  document.getElementById('modal-utama-wilayah').textContent = `${item.kec} ➔ ${item.desa} ➔ ${item.sls}`;
  document.getElementById('modal-utama-subsektor').textContent = item.sub;
  document.getElementById('modal-utama-strata').textContent = `Strata ${item.strata}`;
  document.getElementById('modal-utama-kbli').textContent = `${item.kd_kbli} - ${item.kbli}`;

  document.getElementById('modal-input-alasan').value = STATE.modal.alasan;
  document.getElementById('modal-input-catatan').value = '';
  document.getElementById('toggle-req-subsektor').checked = true;
  document.getElementById('toggle-prio-strata').checked = true;

  setModalScope('sls');
  document.getElementById('modal-replace').classList.remove('hidden');
}

function closeReplaceModal() {
  document.getElementById('modal-replace').classList.add('hidden');
  STATE.modal.activeUtama = null;
  STATE.modal.filterKec = '';
  STATE.modal.filterDesa = '';
}

function setModalScope(scope) {
  STATE.modal.scope = scope;
  STATE.modal.filterKec = '';
  STATE.modal.filterDesa = '';

  const tabs = ['sls', 'desa', 'kecamatan', 'lintas_kecamatan'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-scope-${t}`);
    if (btn) {
      if (t === scope) {
        btn.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow-xs transition-all text-center';
      } else {
        btn.className = 'flex-1 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all text-center';
      }
    }
  });

  updateModalLocationFilterUI();
  renderCandidateList();
}

function updateModalLocationFilterUI() {
  const container = document.getElementById('modal-location-filters');
  const kecWrapper = document.getElementById('wrapper-modal-filter-kec');
  const kecSelect = document.getElementById('modal-filter-kecamatan');
  const desaWrapper = document.getElementById('wrapper-modal-filter-desa');
  const desaSelect = document.getElementById('modal-filter-desa');
  const hintSpan = document.getElementById('modal-filter-hint');

  if (!container || !STATE.modal.activeUtama) return;

  const target = STATE.modal.activeUtama;
  const scope = STATE.modal.scope;

  if (scope === 'sls' || scope === 'desa') {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  if (scope === 'kecamatan') {
    kecWrapper.classList.add('hidden');
    desaWrapper.classList.remove('hidden');
    if (hintSpan) hintSpan.textContent = `Wilayah: Kecamatan ${target.kec}`;

    const desas = [...new Set(STATE.data.filter(d => d.kec === target.kec && d.status === 'PENGGANTI').map(d => d.desa))].sort();
    desaSelect.innerHTML = `<option value="">Semua Desa di ${escapeHtml(target.kec)} (${desas.length})</option>`;
    desas.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (STATE.modal.filterDesa === d) opt.selected = true;
      desaSelect.appendChild(opt);
    });
  } else if (scope === 'lintas_kecamatan') {
    kecWrapper.classList.remove('hidden');
    desaWrapper.classList.remove('hidden');
    if (hintSpan) hintSpan.textContent = 'Pilih kecamatan & desa tujuan (opsional)';

    const kecs = [...new Set(STATE.data.map(d => d.kec))].sort();
    kecSelect.innerHTML = '<option value="">Semua Kecamatan (11)</option>';
    kecs.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      if (STATE.modal.filterKec === k) opt.selected = true;
      kecSelect.appendChild(opt);
    });

    updateModalDesaOptions(STATE.modal.filterKec);
  }
}

function updateModalDesaOptions(selectedKec) {
  const desaSelect = document.getElementById('modal-filter-desa');
  if (!desaSelect) return;

  if (!selectedKec) {
    desaSelect.innerHTML = '<option value="">Semua Desa (Pilih kecamatan dulu)</option>';
    return;
  }

  const desas = [...new Set(STATE.data.filter(d => d.kec === selectedKec && d.status === 'PENGGANTI').map(d => d.desa))].sort();
  desaSelect.innerHTML = `<option value="">Semua Desa di ${escapeHtml(selectedKec)} (${desas.length})</option>`;
  desas.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (STATE.modal.filterDesa === d) opt.selected = true;
    desaSelect.appendChild(opt);
  });
}

function renderCandidateList() {
  const target = STATE.modal.activeUtama;
  if (!target) return;

  const container = document.getElementById('candidate-list-container');
  const usedPenggantiIds = getUsedPenggantiIds();
  const allPengganti = getPenggantiList().filter(p => !usedPenggantiIds.has(p.id));

  const scope = STATE.modal.scope;
  const requireSub = STATE.modal.requireSubsektor;
  const prioritizeStrata = STATE.modal.prioritizeStrata;

  let candidates = allPengganti.filter(p => {
    if (requireSub && p.sub !== target.sub) return false;

    if (scope === 'sls') {
      return p.kd_kec === target.kd_kec && p.kd_desa === target.kd_desa && p.kd_sls === target.kd_sls;
    } else if (scope === 'desa') {
      return p.kd_kec === target.kd_kec && p.kd_desa === target.kd_desa;
    } else if (scope === 'kecamatan') {
      if (p.kd_kec !== target.kd_kec) return false;
      if (STATE.modal.filterDesa && p.desa !== STATE.modal.filterDesa) return false;
      return true;
    } else if (scope === 'lintas_kecamatan') {
      if (STATE.modal.filterKec && p.kec !== STATE.modal.filterKec) return false;
      if (STATE.modal.filterDesa && p.desa !== STATE.modal.filterDesa) return false;
      return true;
    }
    return true;
  });

  candidates.forEach(c => {
    let score = 0;
    const isSameSLS = c.kd_kec === target.kd_kec && c.kd_desa === target.kd_desa && c.kd_sls === target.kd_sls;
    const isSameDesa = c.kd_kec === target.kd_kec && c.kd_desa === target.kd_desa;
    const isSameKec = c.kd_kec === target.kd_kec;

    if (isSameSLS) score += 40;
    else if (isSameDesa) score += 30;
    else if (isSameKec) score += 20;
    else score += 10;

    if (c.sub === target.sub) score += 50;
    if (c.strata === target.strata) score += 20;
    if (c.kd_kbli === target.kd_kbli) score += 10;

    c._score = score;
    c._isSameSLS = isSameSLS;
    c._isSameDesa = isSameDesa;
    c._isSameKec = isSameKec;
  });

  candidates.sort((a, b) => b._score - a._score);
  document.getElementById('candidate-count-header').textContent = `${candidates.length} kandidat ditemukan`;

  if (candidates.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <svg class="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-sm font-semibold text-slate-700">Tidak ada sampel pengganti dalam ruang lingkup ini.</p>
        <p class="text-xs text-slate-500 mt-1">Coba beralih ke tab ruang lingkup lebih luas, atau nonaktifkan syarat kesesuaian ketat.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = candidates.map(c => {
    const isSameSub = c.sub === target.sub;
    const isSameStrata = c.strata === target.strata;
    const isSameKBLI = c.kd_kbli === target.kd_kbli;

    return `
      <div class="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-slate-900 text-sm">${escapeHtml(c.nama)}</span>
            <span class="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${escapeHtml(c.kode)}</span>
            ${c._isSameSLS ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">1 SLS</span>' : ''}
            ${!c._isSameSLS && c._isSameDesa ? '<span class="text-[10px] bg-blue-100 text-blue-800 font-medium px-1.5 py-0.5 rounded">1 Desa</span>' : ''}
            ${!c._isSameDesa && c._isSameKec ? '<span class="text-[10px] bg-purple-100 text-purple-800 font-medium px-1.5 py-0.5 rounded">1 Kecamatan</span>' : ''}
            ${!c._isSameKec ? '<span class="text-[10px] bg-amber-100 text-amber-800 font-medium px-1.5 py-0.5 rounded">Lintas Kec</span>' : ''}
          </div>
          <div class="text-xs text-slate-600 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>${escapeHtml(c.kec)}, ${escapeHtml(c.desa)}, ${escapeHtml(c.sls)}</span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span class="text-[11px] px-2 py-0.5 rounded ${isSameSub ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium' : 'bg-slate-100 text-slate-600'}">
              ${escapeHtml(c.sub)} ${isSameSub ? '✓' : ''}
            </span>
            <span class="text-[11px] px-2 py-0.5 rounded ${isSameStrata ? 'bg-blue-50 text-blue-700 border border-blue-200 font-medium' : 'bg-slate-100 text-slate-600'}">
              Strata ${c.strata} ${isSameStrata ? '✓' : ''}
            </span>
            ${isSameKBLI ? '<span class="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">KBLI Identik</span>' : ''}
          </div>
        </div>
        <div class="sm:self-center shrink-0">
          <button onclick="confirmReplacement('${c.id}')"
            class="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-sm transition-all">
            Pilih Pengganti
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Eksekusi Pergantian Sampel (Sync ke Cloud)
async function confirmReplacement(penggantiId) {
  const target = STATE.modal.activeUtama;
  const pengganti = STATE.data.find(d => d.id === penggantiId);
  const alasan = document.getElementById('modal-input-alasan').value;
  const catatan = document.getElementById('modal-input-catatan').value.trim();

  if (!target || !pengganti) return;

  const confirmMsg = `Ganti Sampel Utama:\n` +
    `• ${target.nama} (${target.kode})\n` +
    `dengan Sampel Pengganti:\n` +
    `• ${pengganti.nama} (${pengganti.kode})\n` +
    `Alasan: ${alasan}\nRuang Lingkup: ${formatScopeLabel(STATE.modal.scope)}\n\nLanjutkan?`;

  if (!confirm(confirmMsg)) return;

  const record = {
    utamaId: target.id,
    utamaKode: target.kode,
    utamaNama: target.nama,
    utamaWilayah: `${target.kec}, ${target.desa}, ${target.sls}`,
    utamaSub: target.sub,
    utamaStrata: target.strata,
    penggantiId: pengganti.id,
    penggantiKode: pengganti.kode,
    penggantiNama: pengganti.nama,
    penggantiWilayah: `${pengganti.kec}, ${pengganti.desa}, ${pengganti.sls}`,
    penggantiSub: pengganti.sub,
    penggantiStrata: pengganti.strata,
    alasan: alasan,
    catatan: catatan,
    scope: STATE.modal.scope,
    petugas: STATE.user ? STATE.user.username : 'petugas',
    timestamp: new Date().toISOString(),
    verified: false,
    verifiedAt: null,
    verifiedBy: null
  };

  // Optimistic update
  STATE.replacements[target.id] = record;
  saveLocalReplacements();
  closeReplaceModal();
  renderDashboard();

  showToast(`Menyimpan pergantian ke cloud...`, 'info');
  const cloudSuccess = await pushReplacementToCloud('save', { replacement: record });

  if (cloudSuccess) {
    showToast(`Berhasil! Sampel tersinkronisasi ke cloud untuk semua petugas.`, 'success');
  } else {
    showToast(`Tersimpan lokal. Akan diunggah saat koneksi cloud siap.`, 'info');
  }
}

// Modal Detail & Undo
function openDetailModal(utamaId) {
  const item = STATE.data.find(d => d.id === utamaId);
  const rep = STATE.replacements[utamaId];
  if (!item || !rep) return;

  document.getElementById('detail-utama-nama').textContent = item.nama;
  document.getElementById('detail-utama-kode').textContent = item.kode;
  document.getElementById('detail-utama-wilayah').textContent = `${item.kec}, ${item.desa}, ${item.sls}`;
  document.getElementById('detail-utama-sub').textContent = item.sub;
  document.getElementById('detail-utama-strata').textContent = `Strata ${item.strata}`;

  document.getElementById('detail-pengganti-nama').textContent = rep.penggantiNama;
  document.getElementById('detail-pengganti-kode').textContent = rep.penggantiKode;
  document.getElementById('detail-pengganti-wilayah').textContent = rep.penggantiWilayah;
  document.getElementById('detail-pengganti-sub').textContent = rep.penggantiSub;
  document.getElementById('detail-pengganti-strata').textContent = `Strata ${rep.penggantiStrata}`;

  document.getElementById('detail-alasan').textContent = rep.alasan;
  document.getElementById('detail-scope').textContent = formatScopeLabel(rep.scope);
  document.getElementById('detail-catatan').textContent = rep.catatan || '-';
  document.getElementById('detail-waktu').textContent = new Date(rep.timestamp).toLocaleString('id-ID');

  const verifiedBadge = document.getElementById('detail-verified-badge');
  const verifiedInfo = document.getElementById('detail-verified-info');
  const btnToggleVerify = document.getElementById('btn-toggle-verify-modal');

  if (rep.verified) {
    if (verifiedBadge) verifiedBadge.innerHTML = '<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">✓ Sudah Dicek Admin</span>';
    if (verifiedInfo) verifiedInfo.textContent = rep.verifiedAt ? `Diverifikasi oleh ${rep.verifiedBy || 'Admin'} (${new Date(rep.verifiedAt).toLocaleString('id-ID')})` : 'Telah diverifikasi Admin';
  } else {
    if (verifiedBadge) verifiedBadge.innerHTML = '<span class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">⏳ Belum Dicek Admin</span>';
    if (verifiedInfo) verifiedInfo.textContent = 'Menunggu pengecekan/verifikasi oleh Admin';
  }

  if (btnToggleVerify) {
    if (STATE.user && STATE.user.role === 'admin') {
      btnToggleVerify.classList.remove('hidden');
      if (rep.verified) {
        btnToggleVerify.className = 'inline-flex items-center px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all';
        btnToggleVerify.innerHTML = 'Batalkan Verifikasi';
      } else {
        btnToggleVerify.className = 'inline-flex items-center px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs';
        btnToggleVerify.innerHTML = '✓ Tandai Sudah Dicek';
      }
      btnToggleVerify.onclick = async () => {
        await toggleSampleVerification(utamaId);
        openDetailModal(utamaId);
      };
    } else {
      btnToggleVerify.classList.add('hidden');
    }
  }

  const btnUndo = document.getElementById('btn-undo-replacement');
  btnUndo.onclick = () => undoReplacement(utamaId);

  document.getElementById('modal-detail').classList.remove('hidden');
}

async function toggleSampleVerification(utamaId) {
  if (!STATE.user || STATE.user.role !== 'admin') {
    showToast('Akses ditolak: Hanya Administrator yang berhak menandai verifikasi.', 'error');
    renderTable();
    return;
  }

  const rep = STATE.replacements[utamaId];
  if (!rep) return;

  const newStatus = !rep.verified;
  rep.verified = newStatus;
  rep.verifiedAt = newStatus ? new Date().toISOString() : null;
  rep.verifiedBy = newStatus ? (STATE.user ? STATE.user.name : 'Administrator') : null;

  saveLocalReplacements();
  renderDashboard();

  showToast(newStatus ? 'Sampel berhasil ditandai telah dicek admin ✓' : 'Tanda verifikasi admin dibatalkan', 'info');

  await pushReplacementToCloud('verify', {
    utamaId: utamaId,
    verified: newStatus,
    petugas: STATE.user ? STATE.user.name : 'Administrator'
  });
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.add('hidden');
}

async function undoReplacement(utamaId) {
  const rep = STATE.replacements[utamaId];
  if (!rep) return;

  if (confirm(`Batalkan pergantian sampel ini? Sampel pengganti (${rep.penggantiNama}) akan dikembalikan ke status TERSEDIA untuk semua petugas.`)) {
    delete STATE.replacements[utamaId];
    saveLocalReplacements();
    closeDetailModal();
    renderDashboard();

    showToast('Membatalkan di cloud...', 'info');
    await pushReplacementToCloud('delete', { utamaId });
    showToast('Pergantian sampel telah dibatalkan di cloud & lokal.', 'info');
  }
}

// Ekspor Data CSV (Hanya Admin)
function exportBeritaAcaraCSV() {
  if (!STATE.user || STATE.user.role !== 'admin') {
    showToast('Akses ditolak: Hanya akun Admin yang berhak mengunduh Berita Acara.', 'error');
    return;
  }

  const reps = Object.values(STATE.replacements);
  if (reps.length === 0) {
    alert('Belum ada sampel utama yang diganti.');
    return;
  }

  const headers = [
    'No',
    'Waktu Pergantian',
    'Petugas',
    'Status Cek Admin',
    'Waktu Cek Admin',
    'Verifikator Admin',
    'ID Utama',
    'Kode Identitas Utama',
    'Nama KK Utama',
    'Subsektor Utama',
    'Strata Utama',
    'Wilayah Utama',
    'ID Pengganti',
    'Kode Identitas Pengganti',
    'Nama KK Pengganti',
    'Subsektor Pengganti',
    'Strata Pengganti',
    'Wilayah Pengganti',
    'Ruang Lingkup',
    'Alasan Pergantian',
    'Catatan Lapangan'
  ];

  const rows = reps.map((r, i) => [
    i + 1,
    `"${r.timestamp}"`,
    `"${r.petugas || 'petugas'}"`,
    `"${r.verified ? 'SUDAH DICEK' : 'BELUM DICEK'}"`,
    `"${r.verifiedAt || ''}"`,
    `"${r.verifiedBy || ''}"`,
    `"${r.utamaId}"`,
    `"${r.utamaKode}"`,
    `"${r.utamaNama.replace(/"/g, '""')}"`,
    `"${r.utamaSub}"`,
    `"${r.utamaStrata}"`,
    `"${r.utamaWilayah.replace(/"/g, '""')}"`,
    `"${r.penggantiId}"`,
    `"${r.penggantiKode}"`,
    `"${r.penggantiNama.replace(/"/g, '""')}"`,
    `"${r.penggantiSub}"`,
    `"${r.penggantiStrata}"`,
    `"${r.penggantiWilayah.replace(/"/g, '""')}"`,
    `"${formatScopeLabel(r.scope)}"`,
    `"${r.alasan.replace(/"/g, '""')}"`,
    `"${(r.catatan || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  triggerDownload(csvContent, `Berita_Acara_Pergantian_Sampel_7301_${formatDateForFile(new Date())}.csv`);
}

function exportDSRTFullCSV() {
  if (!STATE.user || STATE.user.role !== 'admin') {
    showToast('Akses ditolak: Hanya akun Admin yang berhak mengunduh DSRT Mutakhir.', 'error');
    return;
  }

  const headers = [
    'No',
    'ID Assignment',
    'Kode Identitas',
    'Status Asal',
    'Status Terkini',
    'Status Cek Admin',
    'Nama KK',
    'Kecamatan',
    'Desa',
    'SLS',
    'Alamat',
    'Subsektor',
    'Kode KBLI',
    'KBLI',
    'Strata',
    'ID Pasangan',
    'Kode Pasangan',
    'Nama Pasangan',
    'Alasan Pergantian',
    'Ruang Lingkup'
  ];

  const usedPenggantiMap = {};
  Object.values(STATE.replacements).forEach(r => {
    usedPenggantiMap[r.penggantiId] = r;
  });

  const rows = STATE.data.map((item, idx) => {
    let statusTerkini = item.status;
    let statusCekAdmin = '-';
    let pasanganId = '';
    let pasanganKode = '';
    let pasanganNama = '';
    let alasan = '';
    let scope = '';

    if (item.status === 'UTAMA') {
      const rep = STATE.replacements[item.id];
      if (rep) {
        statusTerkini = 'DIGANTI';
        statusCekAdmin = rep.verified ? 'SUDAH DICEK' : 'BELUM DICEK';
        pasanganId = rep.penggantiId;
        pasanganKode = rep.penggantiKode;
        pasanganNama = rep.penggantiNama;
        alasan = rep.alasan;
        scope = formatScopeLabel(rep.scope);
      } else {
        statusTerkini = 'AKTIF (TETAP)';
      }
    } else if (item.status === 'PENGGANTI') {
      const rep = usedPenggantiMap[item.id];
      if (rep) {
        statusTerkini = 'PENGGANTI (TERPAKAI)';
        statusCekAdmin = rep.verified ? 'SUDAH DICEK' : 'BELUM DICEK';
        pasanganId = rep.utamaId;
        pasanganKode = rep.utamaKode;
        pasanganNama = rep.utamaNama;
        alasan = rep.alasan;
        scope = formatScopeLabel(rep.scope);
      } else {
        statusTerkini = 'PENGGANTI (TERSEDIA)';
      }
    }

    return [
      idx + 1,
      `"${item.id}"`,
      `"${item.kode}"`,
      `"${item.status}"`,
      `"${statusTerkini}"`,
      `"${statusCekAdmin}"`,
      `"${item.nama.replace(/"/g, '""')}"`,
      `"${item.kec}"`,
      `"${item.desa}"`,
      `"${item.sls.replace(/"/g, '""')}"`,
      `"${item.alamat.replace(/"/g, '""')}"`,
      `"${item.sub}"`,
      `"${item.kd_kbli}"`,
      `"${item.kbli.replace(/"/g, '""')}"`,
      `"${item.strata}"`,
      `"${pasanganId}"`,
      `"${pasanganKode}"`,
      `"${pasanganNama.replace(/"/g, '""')}"`,
      `"${alasan.replace(/"/g, '""')}"`,
      `"${scope}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  triggerDownload(csvContent, `DSRT_7301_Mutakhir_${formatDateForFile(new Date())}.csv`);
}

function triggerDownload(content, filename) {
  const encodedUri = encodeURI(content);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`File ${filename} berhasil diunduh.`, 'success');
}

// Setup Event Listeners
function setupEventListeners() {
  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  let searchTimer;
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        STATE.filters.search = e.target.value.trim();
        STATE.filters.page = 1;
        renderTable();
      }, 250);
    });
  }

  const kecSelect = document.getElementById('filter-kecamatan');
  if (kecSelect) {
    kecSelect.addEventListener('change', (e) => {
      STATE.filters.kec = e.target.value;
      STATE.filters.desa = '';
      STATE.filters.page = 1;
      updateDesaOptions(e.target.value);
      renderTable();
    });
  }

  const desaSelect = document.getElementById('filter-desa');
  if (desaSelect) {
    desaSelect.addEventListener('change', (e) => {
      STATE.filters.desa = e.target.value;
      STATE.filters.page = 1;
      renderTable();
    });
  }

  const subSelect = document.getElementById('filter-subsektor');
  if (subSelect) {
    subSelect.addEventListener('change', (e) => {
      STATE.filters.subsektor = e.target.value;
      STATE.filters.page = 1;
      renderTable();
    });
  }

  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      STATE.filters.status = e.target.value;
      STATE.filters.page = 1;
      renderTable();
    });
  }

  const btnResetFilter = document.getElementById('btn-reset-filter');
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      STATE.filters.search = '';
      STATE.filters.kec = '';
      STATE.filters.desa = '';
      STATE.filters.subsektor = '';
      STATE.filters.status = 'ALL';
      STATE.filters.page = 1;

      document.getElementById('search-input').value = '';
      document.getElementById('filter-kecamatan').value = '';
      document.getElementById('filter-desa').value = '';
      document.getElementById('filter-subsektor').value = '';
      document.getElementById('filter-status').value = 'ALL';
      updateDesaOptions('');

      renderTable();
    });
  }

  const toggleSub = document.getElementById('toggle-req-subsektor');
  if (toggleSub) {
    toggleSub.addEventListener('change', (e) => {
      STATE.modal.requireSubsektor = e.target.checked;
      renderCandidateList();
    });
  }

  const toggleStrata = document.getElementById('toggle-prio-strata');
  if (toggleStrata) {
    toggleStrata.addEventListener('change', (e) => {
      STATE.modal.prioritizeStrata = e.target.checked;
      renderCandidateList();
    });
  }

  const modalKecSelect = document.getElementById('modal-filter-kecamatan');
  if (modalKecSelect) {
    modalKecSelect.addEventListener('change', (e) => {
      STATE.modal.filterKec = e.target.value;
      STATE.modal.filterDesa = '';
      updateModalDesaOptions(e.target.value);
      renderCandidateList();
    });
  }

  const modalDesaSelect = document.getElementById('modal-filter-desa');
  if (modalDesaSelect) {
    modalDesaSelect.addEventListener('change', (e) => {
      STATE.modal.filterDesa = e.target.value;
      renderCandidateList();
    });
  }
}

// Utility Helpers
function formatScopeLabel(scope) {
  switch (scope) {
    case 'sls': return 'Dalam 1 SLS';
    case 'desa': return '1 Desa';
    case 'kecamatan': return '1 Kecamatan';
    case 'lintas_kecamatan': return 'Lintas Kecamatan';
    default: return scope || '-';
  }
}

function getSubsektorBadgeClass(sub) {
  switch (sub) {
    case 'HORTIKULTURA': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'PERIKANAN TANGKAP': return 'bg-sky-100 text-sky-800 border border-sky-200';
    case 'PERIKANAN BUDIDAYA': return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
    case 'PETERNAKAN': return 'bg-amber-100 text-amber-800 border border-amber-200';
    case 'PERKEBUNAN': return 'bg-lime-100 text-lime-800 border border-lime-200';
    case 'KEHUTANAN': return 'bg-teal-100 text-teal-800 border border-teal-200';
    default: return 'bg-slate-100 text-slate-800 border border-slate-200';
  }
}

function formatDateForFile(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.className = `fixed bottom-5 right-5 z-50 flex items-center px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all transform duration-300 ${
    type === 'success'
      ? 'bg-emerald-900 text-white border-emerald-700'
      : type === 'error'
      ? 'bg-rose-900 text-white border-rose-700'
      : 'bg-slate-900 text-white border-slate-700'
  }`;

  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
  }, 3500);
}
