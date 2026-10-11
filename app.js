/**
 * app.js - Logika Bisnis Sistem Pergantian Sampel DSRT 7301
 * BPS Kabupaten Kepulauan Selayar
 */

// State Management
const STATE = {
  user: null,
  data: [],            // Seluruh 1.643 data (Utama + Pengganti)
  replacements: {},    // Map: utamaId -> ReplacementRecord
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

// Default Credentials
const CREDENTIALS = {
  username: 'bps7301',
  password: 'selayar2026',
  pin: '7301'
};

// Inisialisasi Aplikasi
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initData();
  setupEventListeners();
  renderKecamatanOptions();
  renderDashboard();
});

// Autentikasi
function initAuth() {
  const savedUser = sessionStorage.getItem(STORAGE_KEYS.AUTH);
  if (savedUser) {
    STATE.user = JSON.parse(savedUser);
    showAppScreen();
  } else {
    showLoginScreen();
  }
}

function handleLogin(e) {
  if (e) e.preventDefault();
  const usernameInput = document.getElementById('login-username').value.trim();
  const passwordInput = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');

  if (
    (usernameInput === CREDENTIALS.username && passwordInput === CREDENTIALS.password) ||
    usernameInput === CREDENTIALS.pin ||
    passwordInput === CREDENTIALS.pin
  ) {
    const user = { username: usernameInput || 'bps7301', loginTime: new Date().toISOString() };
    STATE.user = user;
    sessionStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(user));
    errorEl.classList.add('hidden');
    showAppScreen();
    showToast('Berhasil masuk ke sistem!', 'success');
  } else {
    errorEl.textContent = 'Kredensial tidak valid. Silakan gunakan bps7301 / selayar2026';
    errorEl.classList.remove('hidden');
  }
}

function handleLogout() {
  sessionStorage.removeItem(STORAGE_KEYS.AUTH);
  STATE.user = null;
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
  renderDashboard();
}

function fillDemoLogin() {
  document.getElementById('login-username').value = CREDENTIALS.username;
  document.getElementById('login-password').value = CREDENTIALS.password;
  handleLogin();
}

// Data Handling & LocalStorage
function initData() {
  // Load initial data dari data.js
  if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA)) {
    STATE.data = INITIAL_DATA;
  } else {
    console.error('INITIAL_DATA tidak ditemukan!');
    STATE.data = [];
  }

  // Load replacements dari localStorage
  try {
    const savedReplacements = localStorage.getItem(STORAGE_KEYS.REPLACEMENTS);
    if (savedReplacements) {
      STATE.replacements = JSON.parse(savedReplacements);
    }
  } catch (err) {
    console.warn('Gagal membaca localStorage:', err);
    STATE.replacements = {};
  }
}

function saveReplacements() {
  try {
    localStorage.setItem(STORAGE_KEYS.REPLACEMENTS, JSON.stringify(STATE.replacements));
  } catch (err) {
    console.error('Gagal menyimpan ke localStorage:', err);
  }
}

function resetAllData() {
  if (confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA riwayat pergantian sampel dan mengembalikan ke data awal?')) {
    STATE.replacements = {};
    saveReplacements();
    renderDashboard();
    showToast('Data pergantian sampel berhasil di-reset.', 'info');
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
  const replacedCount = Object.keys(STATE.replacements).length;
  const activeCount = totalUtama - replacedCount;
  const penggantiList = getPenggantiList();
  const usedPenggantiIds = getUsedPenggantiIds();
  const availablePengganti = penggantiList.length - usedPenggantiIds.size;
  const replacePct = totalUtama > 0 ? ((replacedCount / totalUtama) * 100).toFixed(1) : 0;

  document.getElementById('metric-total-utama').textContent = totalUtama;
  document.getElementById('metric-replaced-count').textContent = `${replacedCount} (${replacePct}%)`;
  document.getElementById('metric-active-count').textContent = activeCount;
  document.getElementById('metric-available-pengganti').textContent = `${availablePengganti} / ${penggantiList.length}`;
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
  }

  return list;
}

function renderTable() {
  const tbody = document.getElementById('sample-table-body');
  const filtered = getFilteredUtamaList();
  const total = filtered.length;

  // Pagination calculation
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
        <td colspan="7" class="px-6 py-12 text-center text-slate-500">
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

  // Prev Button
  buttons.push(`
    <button onclick="changePage(${cur - 1})" ${cur === 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-100"'}
      class="px-2.5 py-1 text-xs border border-slate-200 rounded text-slate-700">
      &laquo; Prev
    </button>
  `);

  // Simple page range
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

  // Next Button
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
  STATE.modal.requireSubsektor = true;
  STATE.modal.prioritizeStrata = true;
  STATE.modal.alasan = 'Responden Menolak (Refusal)';
  STATE.modal.catatan = '';

  // Render info target utama
  document.getElementById('modal-utama-nama').textContent = item.nama;
  document.getElementById('modal-utama-kode').textContent = item.kode;
  document.getElementById('modal-utama-wilayah').textContent = `${item.kec} ➔ ${item.desa} ➔ ${item.sls}`;
  document.getElementById('modal-utama-subsektor').textContent = item.sub;
  document.getElementById('modal-utama-strata').textContent = `Strata ${item.strata}`;
  document.getElementById('modal-utama-kbli').textContent = `${item.kd_kbli} - ${item.kbli}`;

  // Form controls
  document.getElementById('modal-input-alasan').value = STATE.modal.alasan;
  document.getElementById('modal-input-catatan').value = '';
  document.getElementById('toggle-req-subsektor').checked = true;
  document.getElementById('toggle-prio-strata').checked = true;

  // Active Scope Tab
  setModalScope('sls');

  document.getElementById('modal-replace').classList.remove('hidden');
}

function closeReplaceModal() {
  document.getElementById('modal-replace').classList.add('hidden');
  STATE.modal.activeUtama = null;
}

function setModalScope(scope) {
  STATE.modal.scope = scope;

  // Update tabs visual
  const tabs = ['sls', 'desa', 'kecamatan', 'lintas_kecamatan'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-scope-${t}`);
    if (btn) {
      if (t === scope) {
        btn.className = 'flex-1 py-2 text-xs font-semibold text-blue-700 border-b-2 border-blue-600 bg-blue-50/50 transition-all';
      } else {
        btn.className = 'flex-1 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent transition-all';
      }
    }
  });

  renderCandidateList();
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

  // Filter kandidat sesuai scope
  let candidates = allPengganti.filter(p => {
    if (requireSub && p.sub !== target.sub) return false;

    if (scope === 'sls') {
      return p.kd_kec === target.kd_kec && p.kd_desa === target.kd_desa && p.kd_sls === target.kd_sls;
    } else if (scope === 'desa') {
      return p.kd_kec === target.kd_kec && p.kd_desa === target.kd_desa;
    } else if (scope === 'kecamatan') {
      return p.kd_kec === target.kd_kec;
    } else if (scope === 'lintas_kecamatan') {
      // Semua kecamatan se-kabupaten Selayar
      return true;
    }
    return true;
  });

  // Calculate score & sort
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

  if (prioritizeStrata) {
    candidates.sort((a, b) => b._score - a._score);
  } else {
    candidates.sort((a, b) => b._score - a._score);
  }

  // Update badge count di tab
  document.getElementById('candidate-count-header').textContent = `${candidates.length} kandidat ditemukan`;

  if (candidates.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <svg class="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-sm font-semibold text-slate-700">Tidak ada sampel pengganti dalam ruang lingkup ini.</p>
        <p class="text-xs text-slate-500 mt-1">Coba beralih ke tab ruang lingkup lebih luas (misal: 1 Desa, 1 Kecamatan, atau Lintas Kecamatan), atau nonaktifkan syarat kesesuaian ketat.</p>
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

// Eksekusi Pergantian Sampel
function confirmReplacement(penggantiId) {
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

  // Simpan record
  STATE.replacements[target.id] = {
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
    timestamp: new Date().toISOString()
  };

  saveReplacements();
  closeReplaceModal();
  renderDashboard();

  showToast(`Sampel berhasil diganti dengan ${pengganti.nama}!`, 'success');
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

  const btnUndo = document.getElementById('btn-undo-replacement');
  btnUndo.onclick = () => undoReplacement(utamaId);

  document.getElementById('modal-detail').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.add('hidden');
}

function undoReplacement(utamaId) {
  const rep = STATE.replacements[utamaId];
  if (!rep) return;

  if (confirm(`Batalkan pergantian sampel ini? Sampel pengganti (${rep.penggantiNama}) akan dikembalikan ke status TERSEDIA.`)) {
    delete STATE.replacements[utamaId];
    saveReplacements();
    closeDetailModal();
    renderDashboard();
    showToast('Pergantian sampel telah dibatalkan.', 'info');
  }
}

// Ekspor Data
function exportBeritaAcaraCSV() {
  const reps = Object.values(STATE.replacements);
  if (reps.length === 0) {
    alert('Belum ada sampel utama yang diganti.');
    return;
  }

  const headers = [
    'No',
    'Waktu Pergantian',
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
  const headers = [
    'No',
    'ID Assignment',
    'Kode Identitas',
    'Status Asal',
    'Status Terkini',
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
    let pasanganId = '';
    let pasanganKode = '';
    let pasanganNama = '';
    let alasan = '';
    let scope = '';

    if (item.status === 'UTAMA') {
      const rep = STATE.replacements[item.id];
      if (rep) {
        statusTerkini = 'DIGANTI';
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
  // Login form
  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Search input with debounce
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

  // Filter Kecamatan
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

  // Filter Desa
  const desaSelect = document.getElementById('filter-desa');
  if (desaSelect) {
    desaSelect.addEventListener('change', (e) => {
      STATE.filters.desa = e.target.value;
      STATE.filters.page = 1;
      renderTable();
    });
  }

  // Filter Subsektor
  const subSelect = document.getElementById('filter-subsektor');
  if (subSelect) {
    subSelect.addEventListener('change', (e) => {
      STATE.filters.subsektor = e.target.value;
      STATE.filters.page = 1;
      renderTable();
    });
  }

  // Filter Status
  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      STATE.filters.status = e.target.value;
      STATE.filters.page = 1;
      renderTable();
    });
  }

  // Reset Filters Button
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

  // Toggle di modal rekomendasi
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
