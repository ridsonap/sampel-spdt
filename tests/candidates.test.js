import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the browser script into a sandbox with a minimal DOM stub.
const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sandbox = { document: { addEventListener() {} }, console };
vm.createContext(sandbox);
vm.runInContext(appSource, sandbox);
const {
  getReplacementCandidates,
  getKecamatanOptions,
  getDesaOptions,
  matchesLocation,
  countCandidatesByScope,
  countCandidatesByLocation,
  getFilteredUtamaList
} = sandbox;

const unit = (id, kd_kec, kec, kd_desa, desa, kd_sls, sub, strata, kd_kbli = '01110', status = 'PENGGANTI') => ({
  id, kd_kec, kec, kd_desa, desa, kd_sls, sub, strata, kd_kbli, status
});

// Copy sandbox-realm values into this realm so deepStrictEqual compares structure only.
const plain = value => JSON.parse(JSON.stringify(value));

const target = unit('T', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'HORTIKULTURA', '1');

const pool = [
  unit('same-sls', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'HORTIKULTURA', '1'),
  unit('same-desa', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000300', 'HORTIKULTURA', '1'),
  unit('same-kec', '010', 'PASIMARANNU', '006', 'LAIN DESA', '000100', 'HORTIKULTURA', '1'),
  unit('other-kec', '020', 'PASIMASSUNGGU', '001', 'DESA X', '000100', 'HORTIKULTURA', '1'),
  unit('other-kec-2', '041', 'BENTENG', '002', 'DESA Y', '000100', 'HORTIKULTURA', '1'),
  unit('other-sub', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'PETERNAKAN', '1')
];

const opts = (overrides = {}) => ({
  scope: 'sls',
  filterKec: [],
  filterDesa: [],
  requireSubsektor: true,
  requireStrata: true,
  ...overrides
});

const ids = list => list.map(c => c.id).sort();

test('scope sls only returns units in the same SLS', () => {
  assert.deepEqual(ids(getReplacementCandidates(target, pool, opts({ scope: 'sls' }))), ['same-sls']);
});

test('scope desa returns units in the same desa', () => {
  assert.deepEqual(
    ids(getReplacementCandidates(target, pool, opts({ scope: 'desa' }))),
    ['same-desa', 'same-sls']
  );
});

test('scope kecamatan returns units in the same kecamatan and honours desa filter', () => {
  assert.deepEqual(
    ids(getReplacementCandidates(target, pool, opts({ scope: 'kecamatan' }))),
    ['same-desa', 'same-kec', 'same-sls']
  );
  assert.deepEqual(
    ids(getReplacementCandidates(target, pool, opts({ scope: 'kecamatan', filterDesa: ['010-006'] }))),
    ['same-kec']
  );
});

test('scope kecamatan accepts several desa at once', () => {
  assert.deepEqual(
    ids(getReplacementCandidates(target, pool, opts({ scope: 'kecamatan', filterDesa: ['010-005', '010-006'] }))),
    ['same-desa', 'same-kec', 'same-sls']
  );
});

test('scope lintas_kecamatan accepts several kecamatan at once', () => {
  const widePool = [...pool, unit('third-kec', '051', 'BUKI', '003', 'DESA Z', '000100', 'HORTIKULTURA', '1')];
  assert.deepEqual(
    ids(getReplacementCandidates(target, widePool, opts({ scope: 'lintas_kecamatan', filterKec: ['020', '041'] }))),
    ['other-kec', 'other-kec-2']
  );
});

test('scope lintas_kecamatan excludes the main sample kecamatan', () => {
  assert.deepEqual(
    ids(getReplacementCandidates(target, pool, opts({ scope: 'lintas_kecamatan' }))),
    ['other-kec', 'other-kec-2']
  );
});

test('scope lintas_kecamatan ignores a filter pointing at the main sample kecamatan', () => {
  assert.deepEqual(
    ids(getReplacementCandidates(target, pool, opts({ scope: 'lintas_kecamatan', filterKec: ['010'] }))),
    []
  );
});

test('lintas kecamatan dropdown does not offer the main sample kecamatan', () => {
  const options = getKecamatanOptions([target, ...pool], target.kd_kec);
  assert.deepEqual(plain(options), [
    { value: '041', label: 'BENTENG' },
    { value: '020', label: 'PASIMASSUNGGU' }
  ]);
});

test('getDesaOptions lists desa of the chosen kecamatan, grouped by kecamatan name', () => {
  const options = getDesaOptions([target, ...pool], ['010', '041']);
  assert.deepEqual(plain(options), [
    { value: '041-002', label: 'DESA Y', group: 'BENTENG' },
    { value: '010-005', label: 'BATU BINGKUNG', group: 'PASIMARANNU' },
    { value: '010-006', label: 'LAIN DESA', group: 'PASIMARANNU' }
  ]);
  assert.deepEqual(plain(getDesaOptions([target, ...pool], [])), []);
});

test('matchesLocation: empty selection matches everything', () => {
  assert.ok(pool.every(p => matchesLocation(p, [], [])));
});

test('matchesLocation: several kecamatan act as OR', () => {
  const hits = pool.filter(p => matchesLocation(p, ['020', '041'], [])).map(p => p.id);
  assert.deepEqual(hits, ['other-kec', 'other-kec-2']);
});

test('matchesLocation: a desa narrows only its own kecamatan', () => {
  // PASIMARANNU narrowed to LAIN DESA; PASIMASSUNGGU has no desa picked, so it stays whole.
  const hits = pool.filter(p => matchesLocation(p, ['010', '020'], ['010-006'])).map(p => p.id);
  assert.deepEqual(hits, ['same-kec', 'other-kec']);
});

test('requireSubsektor filters by subsektor; turning it off admits other subsektor', () => {
  assert.ok(!ids(getReplacementCandidates(target, pool, opts({ scope: 'sls' }))).includes('other-sub'));
  const relaxed = getReplacementCandidates(target, pool, opts({ scope: 'sls', requireSubsektor: false }));
  assert.deepEqual(relaxed.map(c => c.id), ['same-sls', 'other-sub']);
});

test('requireStrata excludes candidates with a different strata', () => {
  const strataPool = [
    unit('near-strata2', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'HORTIKULTURA', '2'),
    unit('far-strata1', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000300', 'HORTIKULTURA', '1')
  ];
  const strict = getReplacementCandidates(target, strataPool, opts({ scope: 'desa', requireStrata: true }));
  assert.deepEqual(strict.map(c => c.id), ['far-strata1']);
});

test('requireStrata off admits other strata but still ranks same strata first', () => {
  const strataPool = [
    unit('near-strata2', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'HORTIKULTURA', '2'),
    unit('far-strata1', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000300', 'HORTIKULTURA', '1')
  ];
  const relaxed = getReplacementCandidates(target, strataPool, opts({ scope: 'desa', requireStrata: false }));
  assert.deepEqual(relaxed.map(c => c.id), ['far-strata1', 'near-strata2']);
});

test('countCandidatesByScope reports candidates per tab, ignoring the location dropdowns', () => {
  const counts = countCandidatesByScope(target, pool, opts({ scope: 'lintas_kecamatan', filterKec: ['041'], filterDesa: ['041-002'] }));
  assert.deepEqual({ ...counts }, { sls: 1, desa: 2, kecamatan: 3, lintas_kecamatan: 2 });
});

test('main list filter accepts several kecamatan and desa', () => {
  const utama = [
    unit('u1', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'HORTIKULTURA', '1', '01110', 'UTAMA'),
    unit('u2', '010', 'PASIMARANNU', '006', 'LAIN DESA', '000100', 'HORTIKULTURA', '1', '01110', 'UTAMA'),
    unit('u3', '020', 'PASIMASSUNGGU', '001', 'DESA X', '000100', 'HORTIKULTURA', '1', '01110', 'UTAMA'),
    unit('u4', '041', 'BENTENG', '002', 'DESA Y', '000100', 'HORTIKULTURA', '1', '01110', 'UTAMA')
  ];
  sandbox.__testData = utama;
  vm.runInContext("STATE.data = __testData; STATE.replacements = {};", sandbox);
  const run = (kec, desa) => {
    sandbox.__kec = kec;
    sandbox.__desa = desa;
    vm.runInContext('STATE.filters.kec = __kec; STATE.filters.desa = __desa;', sandbox);
    return getFilteredUtamaList().map(u => u.id);
  };

  assert.deepEqual(run([], []), ['u1', 'u2', 'u3', 'u4']);
  assert.deepEqual(run(['010', '041'], []), ['u1', 'u2', 'u4']);
  assert.deepEqual(run(['010', '041'], ['010-005']), ['u1', 'u4']);
});

test('countCandidatesByLocation counts candidates per kecamatan and desa for the active scope', () => {
  const widePool = [...pool, unit('other-kec-b', '041', 'BENTENG', '003', 'DESA W', '000100', 'HORTIKULTURA', '1')];
  const counts = plain(countCandidatesByLocation(target, widePool, opts({ scope: 'lintas_kecamatan', filterKec: ['041'], filterDesa: ['041-002'] })));
  assert.deepEqual(counts, {
    byKec: { '020': 1, '041': 2 },
    byDesa: { '020-001': 1, '041-002': 1, '041-003': 1 }
  });
  const kecScope = plain(countCandidatesByLocation(target, pool, opts({ scope: 'kecamatan', requireSubsektor: false })));
  assert.deepEqual(kecScope.byDesa, { '010-005': 3, '010-006': 1 });
});

test('countCandidatesByScope follows the subsektor and strata toggles', () => {
  const mixedPool = [...pool, unit('same-sls-strata2', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'HORTIKULTURA', '2')];
  assert.equal(countCandidatesByScope(target, mixedPool, opts()).sls, 1);
  assert.equal(countCandidatesByScope(target, mixedPool, opts({ requireStrata: false })).sls, 2);
  assert.equal(countCandidatesByScope(target, mixedPool, opts({ requireStrata: false, requireSubsektor: false })).sls, 3);
});
