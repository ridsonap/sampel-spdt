import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the browser script into a sandbox with a minimal DOM stub.
const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sandbox = { document: { addEventListener() {} }, console };
vm.createContext(sandbox);
vm.runInContext(appSource, sandbox);
const { getReplacementCandidates, getLintasKecamatanOptions, countCandidatesByScope } = sandbox;

const unit = (id, kd_kec, kec, kd_desa, desa, kd_sls, sub, strata, kd_kbli = '01110') => ({
  id, kd_kec, kec, kd_desa, desa, kd_sls, sub, strata, kd_kbli
});

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
  filterKec: '',
  filterDesa: '',
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
    ids(getReplacementCandidates(target, pool, opts({ scope: 'kecamatan', filterDesa: 'LAIN DESA' }))),
    ['same-kec']
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
    ids(getReplacementCandidates(target, pool, opts({ scope: 'lintas_kecamatan', filterKec: 'PASIMARANNU' }))),
    []
  );
});

test('lintas kecamatan dropdown does not offer the main sample kecamatan', () => {
  const options = getLintasKecamatanOptions([target, ...pool], target);
  assert.deepEqual([...options], ['BENTENG', 'PASIMASSUNGGU']);
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
  const counts = countCandidatesByScope(target, pool, opts({ scope: 'lintas_kecamatan', filterKec: 'BENTENG', filterDesa: 'DESA Y' }));
  assert.deepEqual({ ...counts }, { sls: 1, desa: 2, kecamatan: 3, lintas_kecamatan: 2 });
});

test('countCandidatesByScope follows the subsektor and strata toggles', () => {
  const mixedPool = [...pool, unit('same-sls-strata2', '010', 'PASIMARANNU', '005', 'BATU BINGKUNG', '000202', 'HORTIKULTURA', '2')];
  assert.equal(countCandidatesByScope(target, mixedPool, opts()).sls, 1);
  assert.equal(countCandidatesByScope(target, mixedPool, opts({ requireStrata: false })).sls, 2);
  assert.equal(countCandidatesByScope(target, mixedPool, opts({ requireStrata: false, requireSubsektor: false })).sls, 3);
});
