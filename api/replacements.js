/**
 * api/replacements.js - Vercel Serverless Function
 * Sinkronisasi Multi-User Data Pergantian Sampel via Vercel KV / Upstash Redis
 */

let memoryFallback = {}; // Fallback in-memory jika KV belum terhubung

export default async function handler(req, res) {
  // CORS & Cache Control
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const isKvConfigured = Boolean(kvUrl && kvToken);

  const KEY = 'dsrt_7301_replacements';

  // Helper KV Fetcher
  async function redisCommand(commandArray) {
    if (!isKvConfigured) return null;
    const response = await fetch(kvUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kvToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commandArray)
    });
    if (!response.ok) {
      throw new Error(`Redis HTTP error: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return json.result;
  }

  try {
    // 1. GET: Ambil seluruh data pergantian sampel
    if (req.method === 'GET') {
      let data = {};
      if (isKvConfigured) {
        const raw = await redisCommand(['GET', KEY]);
        if (raw) {
          data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
      } else {
        data = memoryFallback;
      }

      return res.status(200).json({
        success: true,
        source: isKvConfigured ? 'kv' : 'memory_fallback',
        count: Object.keys(data).length,
        data: data
      });
    }

    // 2. POST: Tambah, Hapus, atau Reset pergantian sampel
    if (req.method === 'POST') {
      const body = req.body || {};
      const { action, utamaId, replacement, data: bulkData } = body;

      // Ambil data terkini dulu
      let currentData = {};
      if (isKvConfigured) {
        const raw = await redisCommand(['GET', KEY]);
        if (raw) {
          currentData = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
      } else {
        currentData = memoryFallback;
      }

      if (action === 'save' && replacement && replacement.utamaId) {
        currentData[replacement.utamaId] = replacement;
      } else if (action === 'verify' && utamaId && currentData[utamaId]) {
        currentData[utamaId].verified = Boolean(body.verified);
        currentData[utamaId].verifiedAt = body.verified ? new Date().toISOString() : null;
        currentData[utamaId].verifiedBy = body.verified ? (body.petugas || 'admin') : null;
      } else if (action === 'delete' && utamaId) {
        delete currentData[utamaId];
      } else if (action === 'reset') {
        currentData = {};
      } else if (action === 'bulk' && bulkData) {
        currentData = bulkData;
      } else {
        return res.status(400).json({ success: false, error: 'Aksi tidak valid atau data kurang lengkap.' });
      }

      // Simpan kembali
      if (isKvConfigured) {
        await redisCommand(['SET', KEY, JSON.stringify(currentData)]);
      } else {
        memoryFallback = currentData;
      }

      return res.status(200).json({
        success: true,
        source: isKvConfigured ? 'kv' : 'memory_fallback',
        action: action,
        count: Object.keys(currentData).length,
        data: currentData
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Terjadi kesalahan internal server.'
    });
  }
}
