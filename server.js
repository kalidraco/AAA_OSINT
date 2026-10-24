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
    req.headers['x-intelx-mock'] === 'true'
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
    console.log(`🚀 AAA_OSINT Investigation Workspace + IntelX Module`);
    console.log(`🌐 Application URL: http://${HOST}:${PORT}`);
    console.log(`🔒 Proxy API IntelX: http://${HOST}:${PORT}/api/intelx/status`);
    console.log(`📁 API Investigations: http://${HOST}:${PORT}/api/investigations`);
    console.log(`🔑 Clé INTELX_KEY d'environnement: ${process.env.INTELX_KEY ? 'Détectée (Active)' : 'Non définie (Configurable dans l\'UI)'}`);
    if (process.env.INTELX_MOCK === 'true' || process.env.INTELX_MOCK === '1') {
      console.log(`🧪 Mode Simulation: ACTIF (requêtes simulées, zéro quota consommé)`);
    }
    console.log(`======================================================\n`);
  });
}

module.exports = { server, forwardToIntelX, resolveApiKey, handleInvestigationRequest };
