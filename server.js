/**
 * AAA_OSINT — Secure Local Application Server & Intelligence X Proxy
 *
 * Architecture:
 * - Serves the static AAA_OSINT application from the site/ directory.
 * - Provides secure server-side proxy routes for the Intelligence X API (https://2.intelx.io).
 * - Secures API keys: keys are never hardcoded or exposed in front-end code.
 * - Supports environment variable `INTELX_KEY` or user-configured key passed via `x-intelx-key`.
 * - Zero external npm dependencies (uses native Node.js HTTP/HTTPS/Fetch APIs).
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const dns = require('dns').promises;
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const SITE_DIR = path.join(__dirname, 'site');
const INVESTIGATIONS_DIR = path.join(__dirname, 'data', 'investigations');
const INTELX_API_BASE = 'https://2.intelx.io';
const USER_AGENT = 'AAA_OSINT-Client/2.1.0 (+https://github.com/kalidraco/AAA_OSINT)';

function ensureInvestigationsDir() {
  if (!fs.existsSync(INVESTIGATIONS_DIR)) {
    fs.mkdirSync(INVESTIGATIONS_DIR, { recursive: true });
  }
}

// MIME Types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// In-memory mock search store for testing / mock mode
const mockSearches = new Map();

/**
 * Resolve the API key with priority:
 * 1. Request header 'x-intelx-key' (configured by user in UI)
 * 2. Server environment variable `INTELX_KEY`
 */
function resolveApiKey(req) {
  const headerKey = req.headers['x-intelx-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim().length > 0) {
    return headerKey.trim();
  }
  if (process.env.INTELX_KEY && process.env.INTELX_KEY.trim().length > 0) {
    return process.env.INTELX_KEY.trim();
  }
  return null;
}

/**
 * Check if mock mode is explicitly requested or enabled
 */
function isMockMode(req) {
  return (
    process.env.INTELX_MOCK === 'true' ||
    process.env.INTELX_MOCK === '1' ||
    process.env.FAST_SEARCH_MOCK === 'true' ||
    process.env.FAST_SEARCH_MOCK === '1' ||
    (Boolean(req && req.headers) && (
      req.headers['x-intelx-mock'] === 'true' ||
      req.headers['x-fast-search-mock'] === 'true'
    ))
  );
}

/**
 * Send JSON response helper
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-intelx-key, x-intelx-mock',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
  return true;
}

/**
 * Read request body helper
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Forward HTTP request to Intelligence X API
 */
async function forwardToIntelX(endpoint, options = {}) {
  const targetUrl = new URL(endpoint, INTELX_API_BASE).toString();
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(targetUrl, fetchOptions);
  const contentType = response.headers.get('content-type') || '';

  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    ok: response.ok,
    contentType,
    data,
  };
}

/**
 * Handle Mock Mode for testing and demonstrations without consuming API quota
 */
function handleMockRequest(req, res, pathname, query, body) {
  if (pathname === '/api/intelx/status') {
    return sendJSON(res, 200, {
      ok: true,
      authenticated: true,
      mode: 'mock',
      message: 'Mode simulation Intelligence X actif (aucun quota consommé).',
      hasEnvKey: !!process.env.INTELX_KEY,
    });
  }

  if (pathname === '/api/intelx/search' && req.method === 'POST') {
    const searchId = 'mock-' + Math.random().toString(36).substring(2, 10);
    const term = (body && body.term) || 'example';

    mockSearches.set(searchId, {
      term,
      created: Date.now(),
      polls: 0,
      records: [
        {
          systemid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          storageid: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
          bucket: 'pastes',
          name: `Paste dump containing ${term}`,
          description: `Archived public paste indexed with selector match for ${term}`,
          date: new Date(Date.now() - 86400000 * 2).toISOString(),
          size: 14230,
          media: 1,
          mediah: 'Paste',
          type: 1,
          accesslevel: 0,
          accesslevelh: 'Public',
        },
        {
          systemid: '8c2efb5e-4c8e-5cbe-aced-3c1e8c4edc7e',
          storageid: 'b2c3d4e5f6a108293a4b5c6d7e8f901234567890',
          bucket: 'darknet.tor',
          name: `Darknet Forum Thread - Intel regarding ${term}`,
          description: `Tor onion archive thread referencing ${term}`,
          date: new Date(Date.now() - 86400000 * 15).toISOString(),
          size: 48920,
          media: 2,
          mediah: 'Document',
          type: 2,
          accesslevel: 1,
          accesslevelh: 'Analyst',
        },
        {
          systemid: '7d3fac6f-5d9f-6dcf-bdee-4d2f9d5fed8f',
          storageid: 'c3d4e5f6a1b2193a4b5c6d7e8f90123456789012',
          bucket: 'leaks.public',
          name: `Credentials breach table 2024-Q2 (${term})`,
          description: `Public credential compilation including occurrences of ${term}`,
          date: new Date(Date.now() - 86400000 * 45).toISOString(),
          size: 1258400,
          media: 1,
          mediah: 'Database Dump',
          type: 1,
          accesslevel: 0,
          accesslevelh: 'Public',
        },
      ],
    });

    return sendJSON(res, 200, {
      id: searchId,
      status: 0,
      message: 'Recherche simulée initiée avec succès',
    });
  }

  if (pathname === '/api/intelx/result' && req.method === 'GET') {
    const id = query.id;
    const mock = mockSearches.get(id);
    if (!mock) {
      return sendJSON(res, 404, { status: 2, error: 'Identifiant de recherche introuvable ou expiré' });
    }
    mock.polls++;
    // Simulate progressive status:
    // Poll 1: status 0 with partial records
    // Poll 2: status 1 (completed)
    if (mock.polls >= 2) {
      return sendJSON(res, 200, {
        status: 1, // Done
        records: mock.records,
        count: mock.records.length,
      });
    } else {
      return sendJSON(res, 200, {
        status: 0, // In progress with initial results
        records: mock.records.slice(0, 1),
        count: 1,
      });
    }
  }

  if (pathname === '/api/intelx/terminate' && req.method === 'GET') {
    const id = query.id;
    mockSearches.delete(id);
    return sendJSON(res, 200, { status: 0, message: 'Recherche interrompue' });
  }

  if (pathname === '/api/intelx/preview' && req.method === 'GET') {
    return sendJSON(res, 200, {
      status: 200,
      preview: `=== INTELLIGENCE X PREVIEW (SIMULATED DUMP) ===\nSource Bucket: pastes\nTarget: sample@target.org\nTimestamp: 2025-01-10T14:32:00Z\n\n[CONFIDENTIAL DUMP ENTRY]\nUser: admin\nEmail: sample@target.org\nPassword: SuperSecretP@ssw0rd!2024\nAPI_KEY: sk_live_94819482948192849182\nIP: 198.51.100.42\nStatus: Active\n\nNotes: User credentials verified in breach compilation.\n===============================================`,
    });
  }

  if (pathname === '/api/intelx/phonebook' && req.method === 'POST') {
    const searchId = 'pb-' + Math.random().toString(36).substring(2, 10);
    const term = (body && body.term) || 'example.com';
    mockSearches.set(searchId, {
      term,
      polls: 0,
      selectors: [
        { selector: `contact@${term}`, target: 2, type: 1 },
        { selector: `admin@${term}`, target: 2, type: 1 },
        { selector: `vpn.${term}`, target: 1, type: 1 },
        { selector: `mail.${term}`, target: 1, type: 1 },
        { selector: `api.${term}`, target: 1, type: 1 },
        { selector: `https://${term}/login`, target: 3, type: 1 },
      ],
    });
    return sendJSON(res, 200, { id: searchId, status: 0 });
  }

  if (pathname === '/api/intelx/phonebook/result' && req.method === 'GET') {
    const id = query.id;
    const mock = mockSearches.get(id);
    if (!mock) {
      return sendJSON(res, 404, { status: 2, error: 'Identifiant introuvable' });
    }
    return sendJSON(res, 200, {
      status: 1,
      selectors: mock.selectors,
      count: mock.selectors.length,
    });
  }

  return sendJSON(res, 404, { error: 'Route de simulation introuvable' });
}

/**
 * Handle API Routes
 */
async function handleApiRequest(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-intelx-key, x-intelx-mock',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  // Parse body if POST
  let body = null;
  if (req.method === 'POST') {
    try {
      body = await readRequestBody(req);
    } catch (err) {
      return sendJSON(res, 400, { ok: false, error: 'Invalid JSON request body' });
    }
  }

  // Handle mock mode
  if (isMockMode(req)) {
    return handleMockRequest(req, res, pathname, query, body);
  }

  // Resolve API Key
  const apiKey = resolveApiKey(req);

  // Status check endpoint
  if (pathname === '/api/intelx/status' && req.method === 'GET') {
    if (!apiKey) {
      return sendJSON(res, 200, {
        ok: true,
        authenticated: false,
        hasEnvKey: !!process.env.INTELX_KEY,
        message: 'Aucune clé API IntelX configurée. Configurez votre clé dans les paramètres.',
      });
    }

    // Ping IntelX with a lightweight check
    try {
      const pingRes = await forwardToIntelX('/authenticate/info', {
        headers: { 'x-key': apiKey },
      });

      if (pingRes.status === 200) {
        return sendJSON(res, 200, {
          ok: true,
          authenticated: true,
          hasEnvKey: !!process.env.INTELX_KEY,
          account: pingRes.data,
          message: 'Clé API IntelX valide et connectée.',
        });
      } else if (pingRes.status === 401) {
        return sendJSON(res, 200, {
          ok: true,
          authenticated: false,
          hasEnvKey: !!process.env.INTELX_KEY,
          error: 'Clé API invalide ou révoquée (Code 401).',
        });
      } else if (pingRes.status === 402) {
        return sendJSON(res, 200, {
          ok: true,
          authenticated: true,
          hasEnvKey: !!process.env.INTELX_KEY,
          warning: 'Quota de requêtes IntelX atteint ou licence expirée (Code 402).',
        });
      } else {
        return sendJSON(res, 200, {
          ok: true,
          authenticated: true,
          hasEnvKey: !!process.env.INTELX_KEY,
          status: pingRes.status,
          message: 'API IntelX joignable.',
        });
      }
    } catch (err) {
      return sendJSON(res, 502, {
        ok: false,
        error: `Impossible de contacter l'API IntelX: ${err.message}`,
      });
    }
  }

  // All other IntelX endpoints require an API Key
  if (!apiKey) {
    return sendJSON(res, 401, {
      ok: false,
      status: 401,
      error: 'Clé API IntelX manquante. Veuillez saisir votre clé dans l\'interface ou définir la variable INTELX_KEY.',
    });
  }

  // Route: POST /api/intelx/search
  if (pathname === '/api/intelx/search' && req.method === 'POST') {
    if (!body || !body.term) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre "term" (sélecteur de recherche) obligatoire.' });
    }

    try {
      const payload = {
        term: String(body.term).trim(),
        maxresults: parseInt(body.maxresults, 10) || 50,
        buckets: Array.isArray(body.buckets) ? body.buckets : [],
        lookuplevel: parseInt(body.lookuplevel, 10) || 0,
        maxstorage: parseInt(body.maxstorage, 10) || 0,
        timeout: parseInt(body.timeout, 10) || 0,
        datefrom: body.datefrom || '',
        dateto: body.dateto || '',
        sort: parseInt(body.sort, 10) || 4, // 4 = sort by date desc
        media: parseInt(body.media, 10) || 0,
        terminate: Array.isArray(body.terminate) ? body.terminate : [],
      };

      const result = await forwardToIntelX('/intelligent/search', {
        method: 'POST',
        headers: { 'x-key': apiKey },
        body: payload,
      });

      return sendJSON(res, result.status, result.data);
    } catch (err) {
      return sendJSON(res, 502, { ok: false, error: `Erreur relais IntelX: ${err.message}` });
    }
  }

  // Route: GET /api/intelx/result
  if (pathname === '/api/intelx/result' && req.method === 'GET') {
    const searchId = query.id;
    if (!searchId) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre "id" manquant.' });
    }

    const limit = query.limit ? `&limit=${encodeURIComponent(query.limit)}` : '';
    const offset = query.offset ? `&offset=${encodeURIComponent(query.offset)}` : '';

    try {
      const result = await forwardToIntelX(`/intelligent/search/result?id=${encodeURIComponent(searchId)}${limit}${offset}`, {
        method: 'GET',
        headers: { 'x-key': apiKey },
      });
      return sendJSON(res, result.status, result.data);
    } catch (err) {
      return sendJSON(res, 502, { ok: false, error: `Erreur résultat IntelX: ${err.message}` });
    }
  }

  // Route: GET /api/intelx/terminate
  if (pathname === '/api/intelx/terminate' && req.method === 'GET') {
    const searchId = query.id;
    if (!searchId) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre "id" manquant.' });
    }

    try {
      const result = await forwardToIntelX(`/intelligent/search/terminate?id=${encodeURIComponent(searchId)}`, {
        method: 'GET',
        headers: { 'x-key': apiKey },
      });
      return sendJSON(res, result.status, result.data);
    } catch (err) {
      return sendJSON(res, 502, { ok: false, error: `Erreur annulation IntelX: ${err.message}` });
    }
  }

  // Route: POST /api/intelx/phonebook
  if (pathname === '/api/intelx/phonebook' && req.method === 'POST') {
    if (!body || !body.term) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre "term" manquant.' });
    }

    try {
      const payload = {
        term: String(body.term).trim(),
        maxresults: parseInt(body.maxresults, 10) || 100,
        buckets: Array.isArray(body.buckets) ? body.buckets : [],
        lookuplevel: parseInt(body.lookuplevel, 10) || 0,
        timeout: parseInt(body.timeout, 10) || 0,
        datefrom: body.datefrom || '',
        dateto: body.dateto || '',
        sort: parseInt(body.sort, 10) || 4,
        media: parseInt(body.media, 10) || 0,
        terminate: [],
        target: parseInt(body.target, 10) || 0, // 0 = all, 1 = domains, 2 = emails, 3 = urls
      };

      const result = await forwardToIntelX('/phonebook/search', {
        method: 'POST',
        headers: { 'x-key': apiKey },
        body: payload,
      });

      return sendJSON(res, result.status, result.data);
    } catch (err) {
      return sendJSON(res, 502, { ok: false, error: `Erreur Phonebook IntelX: ${err.message}` });
    }
  }

  // Route: GET /api/intelx/phonebook/result
  if (pathname === '/api/intelx/phonebook/result' && req.method === 'GET') {
    const searchId = query.id;
    if (!searchId) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre "id" manquant.' });
    }

    const limit = query.limit ? `&limit=${encodeURIComponent(query.limit)}` : '&limit=1000';
    try {
      const result = await forwardToIntelX(`/phonebook/search/result?id=${encodeURIComponent(searchId)}${limit}`, {
        method: 'GET',
        headers: { 'x-key': apiKey },
      });
      return sendJSON(res, result.status, result.data);
    } catch (err) {
      return sendJSON(res, 502, { ok: false, error: `Erreur résultat Phonebook: ${err.message}` });
    }
  }

  // Route: GET /api/intelx/preview
  if (pathname === '/api/intelx/preview' && req.method === 'GET') {
    const sid = query.sid;
    const bucket = query.b || '';
    if (!sid) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre "sid" (Storage ID) manquant.' });
    }

    const lines = query.l ? parseInt(query.l, 10) : 100;
    const format = query.f ? parseInt(query.f, 10) : 0;
    const targetQuery = `?sid=${encodeURIComponent(sid)}&b=${encodeURIComponent(bucket)}&f=${format}&l=${lines}&c=1`;

    try {
      const result = await forwardToIntelX(`/file/preview${targetQuery}`, {
        method: 'GET',
        headers: { 'x-key': apiKey },
      });

      return sendJSON(res, result.status, {
        ok: result.ok,
        status: result.status,
        preview: typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
      });
    } catch (err) {
      return sendJSON(res, 502, { ok: false, error: `Erreur aperçu IntelX: ${err.message}` });
    }
  }

  return sendJSON(res, 404, { ok: false, error: `Route API introuvable: ${pathname}` });
}

/**
 * Handle Investigation API requests
 * - GET /api/investigations — List all investigations
 * - POST /api/investigation — Save / create investigation
 * - GET /api/investigation/:id — Retrieve investigation by ID
 * - PUT /api/investigation/:id — Update investigation by ID
 * - DELETE /api/investigation/:id — Delete investigation by ID
 */
async function handleInvestigationRequest(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    return res.end();
  }

  ensureInvestigationsDir();

  // Route: GET /api/investigations
  if (pathname === '/api/investigations' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(INVESTIGATIONS_DIR);
      const list = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(INVESTIGATIONS_DIR, file), 'utf-8');
          const data = JSON.parse(raw);
          list.push({
            id: data.id || file.replace(/\.json$/, ''),
            name: data.name || 'Investigation sans titre',
            context: data.context || '',
            status: data.status || 'draft',
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            indicatorCount: Array.isArray(data.indicators) ? data.indicators.length : 0,
            findingsCount: Array.isArray(data.findings) ? data.findings.length : 0,
            correlationsCount: Array.isArray(data.correlations) ? data.correlations.length : 0,
          });
        } catch { /* skip invalid file */ }
      }
      list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      return sendJSON(res, 200, list);
    } catch (err) {
      return sendJSON(res, 500, { ok: false, error: `Erreur lecture des enquêtes: ${err.message}` });
    }
  }

  // Route: POST /api/investigation (Create / save)
  if (pathname === '/api/investigation' && req.method === 'POST') {
    try {
      const raw = await readRequestBody(req);
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || typeof data !== 'object') {
        return sendJSON(res, 400, { ok: false, error: 'Données d\'investigation invalides' });
      }
      const id = (data.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`).replace(/[^a-zA-Z0-9_-]/g, '');
      data.id = id;
      data.updatedAt = new Date().toISOString();
      if (!data.createdAt) data.createdAt = data.updatedAt;

      const filePath = path.join(INVESTIGATIONS_DIR, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return sendJSON(res, 200, { ok: true, id, investigation: data });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, error: `Erreur sauvegarde investigation: ${err.message}` });
    }
  }

  // Match /api/investigation/:id
  const matchId = pathname.match(/^\/api\/investigation\/([^/]+)$/);
  if (matchId) {
    const rawId = decodeURIComponent(matchId[1]);
    const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(INVESTIGATIONS_DIR, `${safeId}.json`);

    // GET /api/investigation/:id
    if (req.method === 'GET') {
      if (!fs.existsSync(filePath)) {
        return sendJSON(res, 404, { ok: false, error: 'Enquête introuvable' });
      }
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return sendJSON(res, 200, JSON.parse(raw));
      } catch (err) {
        return sendJSON(res, 500, { ok: false, error: `Erreur lecture enquête: ${err.message}` });
      }
    }

    // PUT /api/investigation/:id
    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const raw = await readRequestBody(req);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        data.id = safeId;
        data.updatedAt = new Date().toISOString();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return sendJSON(res, 200, { ok: true, id: safeId, investigation: data });
      } catch (err) {
        return sendJSON(res, 500, { ok: false, error: `Erreur mise à jour enquête: ${err.message}` });
      }
    }

    // DELETE /api/investigation/:id
    if (req.method === 'DELETE') {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return sendJSON(res, 200, { ok: true, id: safeId });
      } catch (err) {
        return sendJSON(res, 500, { ok: false, error: `Erreur suppression enquête: ${err.message}` });
      }
    }
  }

  return sendJSON(res, 404, { ok: false, error: `Route investigation introuvable: ${pathname}` });
}

/**
 * Handle OSINT Automated Transforms (/api/transform/*)
 */
async function handleTransformRequest(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query || {};

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return sendJSON(res, 204, {});
  }

  // 1. Status / Capabilities
  if (pathname === '/api/transform/status') {
    return sendJSON(res, 200, {
      ok: true,
      service: 'AAA_OSINT Automated Transforms Engine',
      version: '2.2.0',
      transforms: [
        'dns',
        'rdns',
        'rdap',
        'certs',
        'http-headers',
        'wayback',
        'profile-check',
        'crypto',
      ],
      mockMode: isMockMode(req),
    });
  }

  // 2. DNS Resolution
  if (pathname === '/api/transform/dns') {
    const rawDomain = String(query.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!rawDomain) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre domain requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        domain: rawDomain,
        records: {
          a: ['93.184.216.34', '93.184.216.35'],
          aaaa: ['2606:2800:220:1:248:1893:25c8:1946'],
          mx: [{ exchange: `mail.${rawDomain}`, priority: 10 }, { exchange: `alt.mail.${rawDomain}`, priority: 20 }],
          txt: ['v=spf1 include:_spf.google.com ~all', 'google-site-verification=abc123xyz456'],
          ns: [`ns1.${rawDomain}`, `ns2.${rawDomain}`],
          cname: [],
          soa: { nsname: `ns1.${rawDomain}`, hostmaster: `admin.${rawDomain}`, serial: 2026102401 },
        },
        mode: 'mock',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const records = { a: [], aaaa: [], mx: [], txt: [], ns: [], cname: [], soa: null };
      const [aR, aaaaR, mxR, txtR, nsR, cnameR, soaR] = await Promise.allSettled([
        dns.resolve4(rawDomain),
        dns.resolve6(rawDomain),
        dns.resolveMx(rawDomain),
        dns.resolveTxt(rawDomain),
        dns.resolveNs(rawDomain),
        dns.resolveCname(rawDomain),
        dns.resolveSoa(rawDomain),
      ]);

      if (aR.status === 'fulfilled') records.a = aR.value;
      if (aaaaR.status === 'fulfilled') records.aaaa = aaaaR.value;
      if (mxR.status === 'fulfilled') records.mx = (mxR.value || []).sort((x, y) => x.priority - y.priority);
      if (txtR.status === 'fulfilled') records.txt = (txtR.value || []).map(chunks => chunks.join(' '));
      if (nsR.status === 'fulfilled') records.ns = nsR.value;
      if (cnameR.status === 'fulfilled') records.cname = cnameR.value;
      if (soaR.status === 'fulfilled') records.soa = soaR.value;

      return sendJSON(res, 200, {
        ok: true,
        domain: rawDomain,
        records,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return sendJSON(res, 200, {
        ok: false,
        domain: rawDomain,
        error: `Résolution DNS impossible: ${err.message}`,
        records: { a: [], aaaa: [], mx: [], txt: [], ns: [], cname: [], soa: null },
      });
    }
  }

  // 3. Reverse DNS (PTR)
  if (pathname === '/api/transform/rdns') {
    const rawIp = String(query.ip || '').trim();
    if (!rawIp) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre ip requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        ip: rawIp,
        hostnames: [`host-${rawIp.replace(/\./g, '-')}.infra.example.com`],
        mode: 'mock',
      });
    }

    try {
      const hostnames = await dns.reverse(rawIp);
      return sendJSON(res, 200, { ok: true, ip: rawIp, hostnames });
    } catch (err) {
      return sendJSON(res, 200, { ok: false, ip: rawIp, hostnames: [], error: err.message });
    }
  }

  // 4. RDAP / WHOIS (Domain & IP)
  if (pathname === '/api/transform/rdap') {
    const rawQuery = String(query.query || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const type = query.type === 'ip' ? 'ip' : 'domain';
    if (!rawQuery) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre query requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        query: rawQuery,
        type,
        handle: 'SIM-94819',
        name: rawQuery,
        status: ['clientTransferProhibited', 'active'],
        registrar: 'Example Registrar, LLC',
        dates: {
          registration: '2019-03-15T10:00:00Z',
          expiration: '2028-03-15T10:00:00Z',
          lastChanged: '2024-02-10T14:30:00Z',
        },
        entities: [
          { role: 'registrant', name: 'Privacy Protected Entity', email: `abuse@${rawQuery}` },
        ],
        nameservers: [`ns1.${rawQuery}`, `ns2.${rawQuery}`],
        network: type === 'ip' ? { cidr: [`${rawQuery}/24`], asn: 'AS13335' } : null,
        mode: 'mock',
      });
    }

    const endpoint = type === 'ip'
      ? `https://rdap.org/ip/${encodeURIComponent(rawQuery)}`
      : `https://rdap.org/domain/${encodeURIComponent(rawQuery)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json, application/rdap+json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return sendJSON(res, 200, {
          ok: false,
          query: rawQuery,
          status: response.status,
          error: `Serveur RDAP a renvoyé code ${response.status}`,
        });
      }

      const data = await response.json();
      let registrar = '';
      const dates = {};
      if (Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (ev.eventAction === 'registration') dates.registration = ev.eventDate;
          if (ev.eventAction === 'expiration') dates.expiration = ev.eventDate;
          if (ev.eventAction === 'last changed' || ev.eventAction === 'last update') dates.lastChanged = ev.eventDate;
        }
      }

      const entities = [];
      if (Array.isArray(data.entities)) {
        for (const ent of data.entities) {
          let name = ent.handle || '';
          let email = '';
          if (ent.roles && ent.roles.includes('registrar')) {
            registrar = ent.handle || '';
          }
          if (Array.isArray(ent.vcardArray) && ent.vcardArray[1]) {
            for (const prop of ent.vcardArray[1]) {
              if (prop[0] === 'fn' && prop[3]) name = prop[3];
              if (prop[0] === 'email' && prop[3]) email = prop[3];
            }
          }
          entities.push({ role: (ent.roles || []).join(', '), name, email });
        }
      }

      return sendJSON(res, 200, {
        ok: true,
        query: rawQuery,
        type,
        handle: data.handle || '',
        name: data.name || data.ldhName || rawQuery,
        status: data.status || [],
        registrar,
        dates,
        entities,
        nameservers: (data.nameservers || []).map(n => n.ldhName || n.name).filter(Boolean),
        network: data.startAddress ? {
          start: data.startAddress,
          end: data.endAddress,
          cidr: (data.cidr0_cidrs || []).map(c => `${c.v4prefix || c.v6prefix}/${c.length}`),
        } : null,
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, query: rawQuery, error: `Erreur RDAP: ${err.message}` });
    }
  }

  // 5. Certificate Transparency Subdomains (crt.sh)
  if (pathname === '/api/transform/certs') {
    const rawDomain = String(query.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!rawDomain) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre domain requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        domain: rawDomain,
        count: 5,
        subdomains: [
          `api.${rawDomain}`,
          `auth.${rawDomain}`,
          `mail.${rawDomain}`,
          `vpn.${rawDomain}`,
          `www.${rawDomain}`,
        ],
        mode: 'mock',
      });
    }

    const endpoint = `https://crt.sh/?q=%.${encodeURIComponent(rawDomain)}&output=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return sendJSON(res, 200, { ok: false, domain: rawDomain, subdomains: [], error: `crt.sh code ${response.status}` });
      }

      const list = await response.json();
      const subdomains = new Set();
      if (Array.isArray(list)) {
        for (const item of list) {
          if (!item.name_value) continue;
          const names = item.name_value.split('\n');
          for (let name of names) {
            name = name.trim().toLowerCase().replace(/^\*\./, '');
            if (name && (name === rawDomain || name.endsWith('.' + rawDomain))) {
              subdomains.add(name);
            }
          }
        }
      }

      return sendJSON(res, 200, {
        ok: true,
        domain: rawDomain,
        count: subdomains.size,
        subdomains: Array.from(subdomains).sort().slice(0, 60),
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, domain: rawDomain, subdomains: [], error: err.message });
    }
  }

  // 6. HTTP Headers & Server Tech Stack
  if (pathname === '/api/transform/http-headers') {
    let target = String(query.url || query.domain || '').trim();
    if (!target) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre url ou domain requis' });
    }
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        url: target,
        status: 200,
        server: 'nginx/1.24.0',
        poweredBy: 'Express',
        contentType: 'text/html; charset=UTF-8',
        title: 'Application Web Sécurisée',
        securityHeaders: { hsts: true, csp: true, xFrameOptions: 'SAMEORIGIN' },
        mode: 'mock',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(target, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*' },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      const headers = {};
      for (const [k, v] of response.headers.entries()) {
        headers[k.toLowerCase()] = v;
      }

      let title = '';
      try {
        const bodyText = await response.text();
        const m = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (m) title = m[1].trim();
      } catch { /* ignore body error */ }

      return sendJSON(res, 200, {
        ok: true,
        url: target,
        finalUrl: response.url,
        status: response.status,
        server: headers['server'] || '',
        poweredBy: headers['x-powered-by'] || '',
        contentType: headers['content-type'] || '',
        title,
        securityHeaders: {
          hsts: !!headers['strict-transport-security'],
          csp: !!headers['content-security-policy'],
          xFrameOptions: headers['x-frame-options'] || '',
          xContentTypeOptions: headers['x-content-type-options'] || '',
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, url: target, error: err.message });
    }
  }

  // 7. Wayback Machine Snapshots (archive.org CDX)
  if (pathname === '/api/transform/wayback') {
    const rawTarget = String(query.url || '').trim().replace(/^https?:\/\//, '');
    if (!rawTarget) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre url requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        url: rawTarget,
        count: 3,
        snapshots: [
          { timestamp: '20240115120000', archiveUrl: `https://web.archive.org/web/20240115120000/http://${rawTarget}` },
          { timestamp: '20230620083000', archiveUrl: `https://web.archive.org/web/20230620083000/http://${rawTarget}` },
          { timestamp: '20211105180000', archiveUrl: `https://web.archive.org/web/20211105180000/http://${rawTarget}` },
        ],
        mode: 'mock',
      });
    }

    const endpoint = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(rawTarget)}&output=json&limit=5&fl=timestamp,original,mimetype,statuscode`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return sendJSON(res, 200, { ok: false, url: rawTarget, snapshots: [] });
      }

      const rows = await response.json();
      const snapshots = [];
      if (Array.isArray(rows) && rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const [timestamp, original, mimetype, statuscode] = rows[i];
          snapshots.push({
            timestamp,
            original,
            mimetype,
            statuscode,
            archiveUrl: `https://web.archive.org/web/${timestamp}/${original}`,
          });
        }
      }

      return sendJSON(res, 200, {
        ok: true,
        url: rawTarget,
        count: snapshots.length,
        snapshots,
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, url: rawTarget, snapshots: [], error: err.message });
    }
  }

  // 8. Public Profiles Check (GitHub, GitLab, Reddit, Wikipedia, Gravatar)
  if (pathname === '/api/transform/profile-check') {
    const rawUsername = String(query.username || '').trim().replace(/^@/, '');
    if (!rawUsername) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre username requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        username: rawUsername,
        profiles: [
          { platform: 'GitHub', profileUrl: `https://github.com/${rawUsername}`, name: rawUsername, bio: 'OSINT Researcher' },
          { platform: 'GitLab', profileUrl: `https://gitlab.com/${rawUsername}`, name: rawUsername },
          { platform: 'Reddit', profileUrl: `https://reddit.com/user/${rawUsername}` },
        ],
        mode: 'mock',
      });
    }

    const checks = [
      {
        platform: 'GitHub',
        url: `https://api.github.com/users/${encodeURIComponent(rawUsername)}`,
        profileUrl: `https://github.com/${rawUsername}`,
      },
      {
        platform: 'GitLab',
        url: `https://gitlab.com/api/v4/users?username=${encodeURIComponent(rawUsername)}`,
        profileUrl: `https://gitlab.com/${rawUsername}`,
      },
      {
        platform: 'Reddit',
        url: `https://www.reddit.com/user/${encodeURIComponent(rawUsername)}/about.json`,
        profileUrl: `https://reddit.com/user/${rawUsername}`,
      },
    ];

    const profiles = [];
    await Promise.allSettled(checks.map(async (c) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(c.url, {
          signal: controller.signal,
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        });
        clearTimeout(timeout);
        if (response.status === 200) {
          const data = await response.json();
          if (c.platform === 'GitHub' && data && data.login) {
            profiles.push({
              platform: 'GitHub',
              profileUrl: c.profileUrl,
              name: data.name || data.login,
              bio: data.bio || '',
              avatar: data.avatar_url || '',
              publicRepos: data.public_repos || 0,
            });
          } else if (c.platform === 'GitLab' && Array.isArray(data) && data.length > 0) {
            profiles.push({
              platform: 'GitLab',
              profileUrl: c.profileUrl,
              name: data[0].name || rawUsername,
              avatar: data[0].avatar_url || '',
            });
          } else if (c.platform === 'Reddit' && data && data.data && data.data.name) {
            profiles.push({
              platform: 'Reddit',
              profileUrl: c.profileUrl,
              name: data.data.name,
              karma: (data.data.total_karma || 0),
            });
          }
        }
      } catch {
        clearTimeout(timeout);
      }
    }));

    // Gravatar check (MD5)
    try {
      const hash = crypto.createHash('md5').update(rawUsername.toLowerCase()).digest('hex');
      const gravatarUrl = `https://en.gravatar.com/${hash}.json`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const gravRes = await fetch(gravatarUrl, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
      clearTimeout(timeout);
      if (gravRes.status === 200) {
        profiles.push({
          platform: 'Gravatar',
          profileUrl: `https://gravatar.com/${rawUsername}`,
          avatar: `https://gravatar.com/avatar/${hash}?s=200`,
        });
      }
    } catch { /* ignore gravatar error */ }

    return sendJSON(res, 200, {
      ok: true,
      username: rawUsername,
      count: profiles.length,
      profiles,
    });
  }

  // 9. Crypto Wallet Checks
  if (pathname === '/api/transform/crypto') {
    const rawAddress = String(query.address || '').trim();
    if (!rawAddress) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre address requis' });
    }

    let type = 'unknown';
    let explorerUrl = '';
    if (/^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{8,87})$/i.test(rawAddress)) {
      type = 'Bitcoin (BTC)';
      explorerUrl = `https://blockstream.info/address/${rawAddress}`;
    } else if (/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
      type = 'Ethereum (ETH)';
      explorerUrl = `https://etherscan.io/address/${rawAddress}`;
    } else if (/^T[a-zA-Z0-9]{33}$/.test(rawAddress)) {
      type = 'Tron (TRX)';
      explorerUrl = `https://tronscan.org/#/address/${rawAddress}`;
    }

    return sendJSON(res, 200, {
      ok: true,
      address: rawAddress,
      blockchain: type,
      explorerUrl,
      isValidFormat: type !== 'unknown',
    });
  }

  return sendJSON(res, 404, { ok: false, error: `Transform route introuvable: ${pathname}` });
}

/**
 * Fast Research Handlers - High-Performance Parallel Data Harvesting
 */
async function handleFastSearchRequest(req, res, parsedUrl) {
  if (!parsedUrl) {
    parsedUrl = url.parse(req.url, true);
  }
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query || {};

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-intelx-key, x-intelx-mock, x-fast-search-mock',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  // 1. Status / Providers list
  if (pathname === '/api/fast-search/status') {
    return sendJSON(res, 200, {
      ok: true,
      status: 'ok',
      providersCount: 13,
      service: 'AAA_OSINT Fast Research Engine',
      version: '2.2.0',
      providers: [
        { id: 'dns', name: 'DNS Records (A, MX, TXT, NS, SOA)', category: 'infra', latencyEstimate: '10-50ms' },
        { id: 'rdns', name: 'Reverse DNS PTR', category: 'infra', latencyEstimate: '15-60ms' },
        { id: 'shodan_ip', name: 'Shodan InternetDB (Ports, CVEs, CPEs)', category: 'infra_threat', latencyEstimate: '100-300ms' },
        { id: 'threat_check', name: 'URLhaus & OTX Threat Intelligence', category: 'threat', latencyEstimate: '200-500ms' },
        { id: 'rdap', name: 'RDAP WHOIS & IP Allocations', category: 'infra', latencyEstimate: '200-500ms' },
        { id: 'certs', name: 'crt.sh SSL/TLS Subdomains', category: 'infra', latencyEstimate: '400-1200ms' },
        { id: 'http_headers', name: 'HTTP Web Headers & Server Stack', category: 'web', latencyEstimate: '150-400ms' },
        { id: 'wayback', name: 'Internet Archive Wayback Snapshots', category: 'archive', latencyEstimate: '300-800ms' },
        { id: 'company_fr', name: 'Registre Officiel Entreprises RNE/Insee', category: 'legal', latencyEstimate: '150-400ms' },
        { id: 'knowledge_search', name: 'Wikidata & DuckDuckGo Instant Knowledge', category: 'entity', latencyEstimate: '150-400ms' },
        { id: 'account_recon', name: 'Multi-Plateforme Account Recon (GitHub, Reddit, HN, Keybase)', category: 'identity', latencyEstimate: '200-500ms' },
        { id: 'crypto_balance', name: 'Blockchain Wallet Verification & Balance', category: 'crypto', latencyEstimate: '150-400ms' },
        { id: 'hash_lookup', name: 'Malware & Threat Hash Database', category: 'malware', latencyEstimate: '200-500ms' }
      ]
    });
  }

  // 2. Shodan InternetDB (IP Open Ports, CVE Vulnerabilities, CPEs)
  if (pathname === '/api/fast-search/shodan-ip') {
    const rawIp = String(query.ip || '').trim();
    if (!rawIp || !/^(\d{1,3}\.){3}\d{1,3}$/.test(rawIp)) {
      return sendJSON(res, 400, { ok: false, error: 'Adresse IPv4 valide requise' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        query: rawIp,
        ip: rawIp,
        found: true,
        ports: [80, 443, 8080],
        cpes: ['cpe:/a:apache:http_server:2.4.52'],
        hostnames: [`host-${rawIp.replace(/\./g, '-')}.example.net`],
        vulns: ['CVE-2021-41773'],
        tags: ['web', 'cloud'],
        source: 'Shodan InternetDB',
        sourceUrl: `https://internetdb.shodan.io/${rawIp}`,
        mode: 'mock'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(rawIp)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (response.status === 404) {
        return sendJSON(res, 200, {
          ok: true,
          ip: rawIp,
          found: false,
          ports: [],
          cpes: [],
          hostnames: [],
          vulns: [],
          tags: [],
          message: 'Aucun port ou service ouvert indexé dans Shodan InternetDB.',
          source: 'Shodan InternetDB',
          sourceUrl: `https://internetdb.shodan.io/${rawIp}`
        });
      }

      if (!response.ok) {
        return sendJSON(res, 200, { ok: false, ip: rawIp, error: `Shodan HTTP ${response.status}` });
      }

      const data = await response.json();
      return sendJSON(res, 200, {
        ok: true,
        ip: rawIp,
        found: true,
        ports: data.ports || [],
        cpes: data.cpes || [],
        hostnames: data.hostnames || [],
        vulns: data.vulns || [],
        tags: data.tags || [],
        source: 'Shodan InternetDB',
        sourceUrl: `https://internetdb.shodan.io/${rawIp}`
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, ip: rawIp, error: `Shodan InternetDB timeout/erreur: ${err.message}` });
    }
  }

  // 3. Threat Intelligence Check (URLhaus / Malware check)
  if (pathname === '/api/fast-search/threat-check') {
    const rawTarget = String(query.target || query.query || query.q || '').trim();
    if (!rawTarget) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre target requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        query: rawTarget,
        target: rawTarget,
        threatLevel: 'clean',
        urlCount: 0,
        malwareDetected: false,
        urlhaus: { threatLevel: 'clean', urlCount: 0 },
        source: 'URLhaus (Abuse.ch)',
        sourceUrl: `https://urlhaus.abuse.ch/browse.php?search=${encodeURIComponent(rawTarget)}`,
        mode: 'mock'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`https://urlhaus-api.abuse.ch/v1/host/${encodeURIComponent(rawTarget)}/`, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return sendJSON(res, 200, {
          ok: true,
          target: rawTarget,
          threatLevel: 'clean',
          urlCount: 0,
          malwareDetected: false,
          source: 'URLhaus (Abuse.ch)',
          sourceUrl: `https://urlhaus.abuse.ch/browse.php?search=${encodeURIComponent(rawTarget)}`
        });
      }

      const data = await response.json();
      const isOnline = data.query_status === 'ok';
      const urlCount = data.url_count || 0;

      return sendJSON(res, 200, {
        ok: true,
        target: rawTarget,
        threatLevel: isOnline && urlCount > 0 ? 'malicious' : 'clean',
        urlCount,
        malwareDetected: isOnline && urlCount > 0,
        firstSeen: data.firstseen || null,
        urls: (data.urls || []).slice(0, 5).map(u => ({ url: u.url, status: u.url_status, threat: u.threat })),
        source: 'URLhaus (Abuse.ch)',
        sourceUrl: `https://urlhaus.abuse.ch/browse.php?search=${encodeURIComponent(rawTarget)}`
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, target: rawTarget, error: err.message });
    }
  }

  // 4. Official French Company Register (RNE / Insee)
  if (pathname === '/api/fast-search/company-fr') {
    const rawQuery = String(query.query || query.q || '').trim();
    if (!rawQuery) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre query requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        query: rawQuery,
        count: 1,
        companies: [
          {
            nom: 'ENTREPRISE EXEMPLE SAS',
            siren: '987654321',
            siret: '98765432100018',
            adresse: '10 Rue de la Paix, 75001 Paris',
            activite: 'Programmation informatique (62.01Z)',
            date_creation: '2020-01-15',
            dirigeants: ['Dupont Marie (Président)']
          }
        ],
        source: 'Recherche Entreprises (RNE / Insee)',
        sourceUrl: `https://annuaire-entreprises.data.gouv.fr/recherche?terme=${encodeURIComponent(rawQuery)}`,
        mode: 'mock'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(rawQuery)}&per_page=5`, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return sendJSON(res, 200, { ok: false, query: rawQuery, error: `Insee API code ${response.status}` });
      }

      const data = await response.json();
      const results = (data.results || []).map(item => {
        const siege = item.siege || {};
        const dirigeants = (item.dirigeants || []).map(d => `${d.prenoms || ''} ${d.nom || ''} (${d.qualite || 'Dirigeant'})`.trim());
        return {
          nom: item.nom_complet || item.nom_raison_sociale || rawQuery,
          siren: item.siren,
          siret: siege.siret || '',
          adresse: [siege.adresse, siege.code_postal, siege.libelle_commune].filter(Boolean).join(', '),
          activite: item.activite_principale || '',
          date_creation: item.date_creation || '',
          dirigeants,
          sourceUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${item.siren}`
        };
      });

      return sendJSON(res, 200, {
        ok: true,
        query: rawQuery,
        count: results.length,
        companies: results,
        source: 'Recherche Entreprises (RNE / Insee)',
        sourceUrl: `https://annuaire-entreprises.data.gouv.fr/recherche?terme=${encodeURIComponent(rawQuery)}`
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, query: rawQuery, error: err.message });
    }
  }

  // 5. Knowledge & Entity Lookup (Wikipedia / Wikidata / DuckDuckGo)
  if (pathname === '/api/fast-search/knowledge-search') {
    const rawQuery = String(query.query || query.q || '').trim();
    if (!rawQuery) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre query requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        query: rawQuery,
        title: rawQuery,
        snippet: `Référence encyclopédique pour "${rawQuery}".`,
        officialUrl: `https://fr.wikipedia.org/wiki/${encodeURIComponent(rawQuery)}`,
        articles: [{ title: rawQuery, snippet: `Référence encyclopédique pour "${rawQuery}".` }],
        source: 'Wikipedia & Open Data',
        sourceUrl: `https://fr.wikipedia.org/wiki/${encodeURIComponent(rawQuery)}`,
        mode: 'mock'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const lang = (query.lang === 'en') ? 'en' : 'fr';
      const wpUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(rawQuery)}&limit=3&format=json`;
      const response = await fetch(wpUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return sendJSON(res, 200, { ok: false, query: rawQuery, error: `Wikipedia API code ${response.status}` });
      }

      const rows = await response.json();
      const titles = rows[1] || [];
      const snippets = rows[2] || [];
      const links = rows[3] || [];

      return sendJSON(res, 200, {
        ok: true,
        query: rawQuery,
        found: titles.length > 0,
        title: titles[0] || rawQuery,
        snippet: snippets[0] || '',
        officialUrl: links[0] || '',
        related: titles.slice(1).map((t, idx) => ({ title: t, snippet: snippets[idx + 1] || '', url: links[idx + 1] || '' })),
        source: 'Wikipedia & Open Data',
        sourceUrl: links[0] || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(rawQuery)}`
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, query: rawQuery, error: err.message });
    }
  }

  // 6. Account Recon across Open Platforms (GitHub, GitLab, HackerNews, Reddit)
  if (pathname === '/api/fast-search/account-recon') {
    const rawUsername = String(query.username || '').trim().replace(/^@/, '');
    if (!rawUsername) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre username requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        username: rawUsername,
        count: 3,
        accounts: [
          { platform: 'GitHub', username: rawUsername, url: `https://github.com/${rawUsername}`, name: rawUsername, bio: 'Investigateur OSINT' },
          { platform: 'Reddit', username: rawUsername, url: `https://reddit.com/user/${rawUsername}` },
          { platform: 'HackerNews', username: rawUsername, url: `https://news.ycombinator.com/user?id=${rawUsername}` }
        ],
        source: 'Reconnaissance Multi-Plateformes',
        mode: 'mock'
      });
    }

    const checks = [
      {
        platform: 'GitHub',
        url: `https://api.github.com/users/${encodeURIComponent(rawUsername)}`,
        profileUrl: `https://github.com/${rawUsername}`,
      },
      {
        platform: 'GitLab',
        url: `https://gitlab.com/api/v4/users?username=${encodeURIComponent(rawUsername)}`,
        profileUrl: `https://gitlab.com/${rawUsername}`,
      },
      {
        platform: 'HackerNews',
        url: `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(rawUsername)}.json`,
        profileUrl: `https://news.ycombinator.com/user?id=${rawUsername}`,
      },
      {
        platform: 'Reddit',
        url: `https://www.reddit.com/user/${encodeURIComponent(rawUsername)}/about.json`,
        profileUrl: `https://reddit.com/user/${rawUsername}`,
      },
    ];

    const accounts = [];
    await Promise.allSettled(checks.map(async (c) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(c.url, {
          signal: controller.signal,
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        });
        clearTimeout(timeout);
        if (response.status === 200) {
          const data = await response.json();
          if (c.platform === 'GitHub' && data && data.login) {
            accounts.push({
              platform: 'GitHub',
              username: data.login,
              url: c.profileUrl,
              name: data.name || data.login,
              bio: data.bio || '',
              avatar: data.avatar_url || '',
              publicRepos: data.public_repos || 0,
            });
          } else if (c.platform === 'GitLab' && Array.isArray(data) && data.length > 0) {
            accounts.push({
              platform: 'GitLab',
              username: data[0].username || rawUsername,
              url: c.profileUrl,
              name: data[0].name || rawUsername,
              avatar: data[0].avatar_url || '',
            });
          } else if (c.platform === 'HackerNews' && data && data.id) {
            accounts.push({
              platform: 'HackerNews',
              username: data.id,
              url: c.profileUrl,
              karma: data.karma || 0,
              created: data.created ? new Date(data.created * 1000).toISOString() : '',
            });
          } else if (c.platform === 'Reddit' && data && data.data && data.data.name) {
            accounts.push({
              platform: 'Reddit',
              username: data.data.name,
              url: c.profileUrl,
              karma: data.data.total_karma || 0,
            });
          }
        }
      } catch {
        clearTimeout(timeout);
      }
    }));

    return sendJSON(res, 200, {
      ok: true,
      username: rawUsername,
      count: accounts.length,
      accounts,
      source: 'Reconnaissance Multi-Plateformes'
    });
  }

  // 7. Crypto Balance & Activity Check (Bitcoin mempool.space)
  if (pathname === '/api/fast-search/crypto-balance') {
    const rawAddress = String(query.address || '').trim();
    if (!rawAddress) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre address requis' });
    }

    const isBtc = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{8,87})$/i.test(rawAddress);
    if (!isBtc) {
      return sendJSON(res, 200, {
        ok: true,
        address: rawAddress,
        type: rawAddress.startsWith('0x') ? 'Ethereum (ETH)' : 'Autre',
        supportedLiveBalance: false,
        source: 'Blockchain Explorer',
        sourceUrl: rawAddress.startsWith('0x') ? `https://etherscan.io/address/${rawAddress}` : `https://blockchair.com/search?q=${rawAddress}`
      });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        address: rawAddress,
        type: 'Bitcoin (BTC)',
        supportedLiveBalance: true,
        balanceSat: 2500000,
        balanceBtc: 0.025,
        txCount: 4,
        source: 'mempool.space',
        sourceUrl: `https://mempool.space/address/${rawAddress}`,
        mode: 'mock'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`https://mempool.space/api/address/${encodeURIComponent(rawAddress)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return sendJSON(res, 200, { ok: false, address: rawAddress, error: `Mempool code ${response.status}` });
      }

      const data = await response.json();
      const stats = data.chain_stats || {};
      const funded = stats.funded_txo_sum || 0;
      const spent = stats.spent_txo_sum || 0;
      const balanceSat = Math.max(0, funded - spent);
      const balanceBtc = balanceSat / 100000000;

      return sendJSON(res, 200, {
        ok: true,
        address: rawAddress,
        type: 'Bitcoin (BTC)',
        supportedLiveBalance: true,
        balanceSat,
        balanceBtc,
        txCount: stats.tx_count || 0,
        source: 'mempool.space',
        sourceUrl: `https://mempool.space/address/${rawAddress}`
      });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, address: rawAddress, error: err.message });
    }
  }

  // 8. Hash Signature Lookup
  if (pathname === '/api/fast-search/hash-lookup') {
    const rawHash = String(query.hash || '').trim().toLowerCase();
    if (!rawHash) {
      return sendJSON(res, 400, { ok: false, error: 'Paramètre hash requis' });
    }

    if (isMockMode(req)) {
      return sendJSON(res, 200, {
        ok: true,
        hash: rawHash,
        known: false,
        matched: false,
        message: 'Format valide (non répertorié dans les signatures connues)',
        source: 'Threat & Hash DB',
        sourceUrl: `https://hashlookup.circl.lu/lookup/sha256/${rawHash}`,
        mode: 'mock'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`https://hashlookup.circl.lu/lookup/sha256/${encodeURIComponent(rawHash)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (response.status === 404) {
        return sendJSON(res, 200, {
          ok: true,
          hash: rawHash,
          known: false,
          message: 'Non répertorié dans CIRCL Hashlookup (Clean ou non indexé)',
          source: 'CIRCL Hashlookup',
          sourceUrl: `https://hashlookup.circl.lu/lookup/sha256/${rawHash}`
        });
      }

      if (response.ok) {
        const data = await response.json();
        return sendJSON(res, 200, {
          ok: true,
          hash: rawHash,
          known: true,
          fileName: data.FileName || '',
          fileSize: data.FileSize || 0,
          source: 'CIRCL Hashlookup',
          sourceUrl: `https://hashlookup.circl.lu/lookup/sha256/${rawHash}`
        });
      }

      return sendJSON(res, 200, { ok: true, hash: rawHash, known: false, source: 'CIRCL Hashlookup' });
    } catch (err) {
      clearTimeout(timeout);
      return sendJSON(res, 200, { ok: false, hash: rawHash, error: err.message });
    }
  }

  // Delegation of transforms through fast-search prefix
  if (pathname === '/api/fast-search/dns') {
    parsedUrl.pathname = '/api/transform/dns';
    return handleTransformRequest(req, res, parsedUrl);
  }
  if (pathname === '/api/fast-search/rdns') {
    parsedUrl.pathname = '/api/transform/rdns';
    return handleTransformRequest(req, res, parsedUrl);
  }
  if (pathname === '/api/fast-search/rdap') {
    parsedUrl.pathname = '/api/transform/rdap';
    return handleTransformRequest(req, res, parsedUrl);
  }
  if (pathname === '/api/fast-search/certs') {
    parsedUrl.pathname = '/api/transform/certs';
    return handleTransformRequest(req, res, parsedUrl);
  }
  if (pathname === '/api/fast-search/http-headers') {
    parsedUrl.pathname = '/api/transform/http-headers';
    return handleTransformRequest(req, res, parsedUrl);
  }
  if (pathname === '/api/fast-search/wayback') {
    parsedUrl.pathname = '/api/transform/wayback';
    return handleTransformRequest(req, res, parsedUrl);
  }

  return sendJSON(res, 404, { ok: false, error: `Route Fast Research introuvable: ${pathname}` });
}

/**
 * Handle Static Files from site/ directory
 */
function handleStaticFile(req, res, pathname) {
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(SITE_DIR, safePath);

  // Security check: ensure filePath is within SITE_DIR
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Accès interdit');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Fichier non trouvé: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Avoid aggressive caching for HTML, JS and JSON so data/code updates take effect immediately
    const noCacheExts = ['.html', '.js', '.json'];
    const cacheControl = noCacheExts.includes(ext)
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=3600';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': cacheControl,
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

/**
 * Main HTTP Server Request Handler
 */
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/intelx/')) {
    handleApiRequest(req, res, parsedUrl);
  } else if (pathname.startsWith('/api/fast-search/')) {
    handleFastSearchRequest(req, res, parsedUrl);
  } else if (pathname.startsWith('/api/transform/')) {
    handleTransformRequest(req, res, parsedUrl);
  } else if (pathname === '/api/investigations' || pathname.startsWith('/api/investigation')) {
    handleInvestigationRequest(req, res, parsedUrl);
  } else {
    handleStaticFile(req, res, pathname);
  }
});

// Start server if executed directly
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 AAA_OSINT Investigation Workspace + Fast Research`);
    console.log(`🌐 Application URL: http://${HOST}:${PORT}`);
    console.log(`⚡ API Fast Research: http://${HOST}:${PORT}/api/fast-search/status`);
    console.log(`🔒 Proxy API IntelX: http://${HOST}:${PORT}/api/intelx/status`);
    console.log(`📁 API Investigations: http://${HOST}:${PORT}/api/investigations`);
    console.log(`🔑 Clé INTELX_KEY d'environnement: ${process.env.INTELX_KEY ? 'Détectée (Active)' : 'Non définie (Configurable dans l\'UI)'}`);
    if (process.env.INTELX_MOCK === 'true' || process.env.INTELX_MOCK === '1') {
      console.log(`🧪 Mode Simulation: ACTIF (requêtes simulées, zéro quota consommé)`);
    }
    console.log(`======================================================\n`);
  });
}

module.exports = { server, forwardToIntelX, resolveApiKey, handleInvestigationRequest, handleTransformRequest, handleFastSearchRequest };
