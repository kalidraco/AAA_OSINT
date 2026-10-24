/**
 * AAA_OSINT — Fast Research Multi-Source Harvester Test Suite
 *
 * Automated verification for:
 * 1. Indicator Classification (15 universal indicator types)
 * 2. Source Selection & Target Mapping per Indicator Type
 * 3. Engine Streaming & Event Callbacks (onStart, onResult, onProgress, onComplete)
 * 4. Latency Tracking & Fast First-Result Reporting
 * 5. Backend Fast Search API Endpoints (/api/fast-search/*)
 * 6. Multi-Format Serialization (JSON, CSV, Markdown)
 * 7. Catalog Tool Pivots Mapping
 */

const assert = require('assert');
const url = require('url');

// Enable test mock environment
process.env.PORT = '3099';
process.env.FAST_SEARCH_MOCK = 'true';
process.env.INTELX_MOCK = 'true';

const { handleFastSearchRequest } = require('../server.js');
const FastResearchEngine = require('../site/fast-research-engine.js');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// Mock HTTP Response Stream for Server testing
function createMockResponse() {
  let statusCode = 200;
  let headers = {};
  let body = '';

  return {
    writeHead: (code, hdrs) => {
      statusCode = code;
      headers = Object.assign(headers, hdrs);
    },
    end: (chunk) => {
      if (chunk) body += chunk;
    },
    getStatusCode: () => statusCode,
    getHeaders: () => headers,
    getJSON: () => JSON.parse(body || '{}'),
    getBody: () => body,
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('⚡ AAA_OSINT — Fast Research Test Suite');
  console.log('======================================================\n');

  const engine = new FastResearchEngine({
    apiBase: 'http://127.0.0.1:3099',
    useMock: true,
    perSourceTimeout: 1000
  });

  // --------------------------------------------------------------------------
  console.log('🔍 1. Universal Indicator Type Detection');
  // --------------------------------------------------------------------------
  it('Detects IPv4 correctly', () => {
    assert.strictEqual(engine.detectIndicatorType('192.168.1.1').type, 'ip');
    assert.strictEqual(engine.detectIndicatorType('8.8.8.8').type, 'ip');
  });

  it('Detects IPv6 correctly', () => {
    assert.strictEqual(engine.detectIndicatorType('2001:0db8:85a3:0000:0000:8a2e:0370:7334').type, 'ip');
    assert.strictEqual(engine.detectIndicatorType('2606:4700:4700::1111').type, 'ip');
  });

  it('Detects Email addresses correctly', () => {
    assert.strictEqual(engine.detectIndicatorType('target.analyst@example.org').type, 'email');
    assert.strictEqual(engine.detectIndicatorType('john.doe+osint@gmail.com').type, 'email');
  });

  it('Detects URLs correctly', () => {
    assert.strictEqual(engine.detectIndicatorType('https://sub.target.com/path?arg=1').type, 'url');
    assert.strictEqual(engine.detectIndicatorType('http://phishing-site.xyz/login.php').type, 'url');
  });

  it('Detects Domain and Subdomain correctly', () => {
    assert.strictEqual(engine.detectIndicatorType('example.com').type, 'domain');
    assert.strictEqual(engine.detectIndicatorType('api.dev.target.io').type, 'subdomain');
  });

  it('Detects Usernames with @ prefix or alphanumeric pattern', () => {
    assert.strictEqual(engine.detectIndicatorType('@cyber_investigator').type, 'username');
    assert.strictEqual(engine.detectIndicatorType('torvalds').type, 'username');
  });

  it('Detects Phone numbers in international and domestic format', () => {
    assert.strictEqual(engine.detectIndicatorType('+33 6 12 34 56 78').type, 'phone');
    assert.strictEqual(engine.detectIndicatorType('06 12 34 56 78').type, 'phone');
  });

  it('Detects Cryptocurrencies (BTC, ETH)', () => {
    assert.strictEqual(engine.detectIndicatorType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').type, 'crypto');
    assert.strictEqual(engine.detectIndicatorType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').type, 'crypto');
    assert.strictEqual(engine.detectIndicatorType('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045').type, 'crypto');
  });

  it('Detects Hashes (MD5, SHA1, SHA256)', () => {
    assert.strictEqual(engine.detectIndicatorType('44d88612fea8a8f36de82e1278abb02f').type, 'hash');
    assert.strictEqual(engine.detectIndicatorType('da39a3ee5e6b4b0d3255bfef95601890afd80709').type, 'hash');
    assert.strictEqual(engine.detectIndicatorType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855').type, 'hash');
  });

  it('Detects French SIREN and SIRET numbers', () => {
    assert.strictEqual(engine.detectIndicatorType('552032534').type, 'siren');
    assert.strictEqual(engine.detectIndicatorType('552 032 534').type, 'siren');
    assert.strictEqual(engine.detectIndicatorType('55203253400018').type, 'siren');
  });

  it('Detects Person names and Company entities', () => {
    assert.strictEqual(engine.detectIndicatorType('Jean Dupont').type, 'person');
    assert.strictEqual(engine.detectIndicatorType('Acme Corporation Inc').type, 'company');
  });

  // --------------------------------------------------------------------------
  console.log('\n🎯 2. Target Source Selection per Indicator Type');
  // --------------------------------------------------------------------------
  it('Selects relevant sources for IP indicators', () => {
    const sources = engine.getSourcesForType('ip');
    const ids = sources.map(s => s.id);
    assert.ok(ids.includes('shodan_internetdb'), 'Should include Shodan InternetDB for IP');
    assert.ok(ids.includes('threat_check'), 'Should include Threat Check for IP');
    assert.ok(ids.includes('rdns_ptr'), 'Should include RDNS for IP');
    assert.ok(ids.includes('rdap'), 'Should include RDAP for IP');
  });

  it('Selects relevant sources for Domain indicators', () => {
    const sources = engine.getSourcesForType('domain');
    const ids = sources.map(s => s.id);
    assert.ok(ids.includes('dns_resolution'), 'Should include DNS for Domain');
    assert.ok(ids.includes('crtsh_subdomains'), 'Should include crt.sh for Domain');
    assert.ok(ids.includes('rdap'), 'Should include RDAP for Domain');
    assert.ok(ids.includes('wayback_history'), 'Should include Wayback for Domain');
    assert.ok(ids.includes('threat_check'), 'Should include Threat Check for Domain');
  });

  it('Selects Account Recon for Username indicators', () => {
    const sources = engine.getSourcesForType('username');
    const ids = sources.map(s => s.id);
    assert.ok(ids.includes('account_recon'), 'Should include Account Recon');
  });

  it('Selects Company FR API for SIREN and Company indicators', () => {
    const sirenSources = engine.getSourcesForType('siren');
    assert.ok(sirenSources.some(s => s.id === 'company_fr'));
    const companySources = engine.getSourcesForType('company');
    assert.ok(companySources.some(s => s.id === 'company_fr'));
  });

  it('Selects Crypto Balance for Crypto indicators', () => {
    const sources = engine.getSourcesForType('crypto');
    assert.ok(sources.some(s => s.id === 'crypto_balance'));
  });

  it('Selects Hash Lookup for Hash indicators', () => {
    const sources = engine.getSourcesForType('hash');
    assert.ok(sources.some(s => s.id === 'hash_lookup'));
  });

  // --------------------------------------------------------------------------
  console.log('\n⚡ 3. Engine Parallel Execution, Streaming & Latency Tracking');
  // --------------------------------------------------------------------------
  await itAsync('Streams results progressively and measures latency', async () => {
    const streamedResults = [];
    let progressCalls = 0;
    let started = false;
    let completed = false;

    const res = await engine.search('1.1.1.1', {
      onStart: (info) => {
        started = true;
        assert.strictEqual(info.type, 'ip');
        assert.ok(info.totalSources >= 3);
      },
      onResult: (sourceResult) => {
        streamedResults.push(sourceResult);
        assert.ok(sourceResult.sourceId, 'Result should have sourceId');
        assert.ok(typeof sourceResult.latencyMs === 'number', 'Result should have latencyMs');
      },
      onProgress: (prog) => {
        progressCalls++;
        assert.ok(prog.completedSources <= prog.totalSources);
      },
      onComplete: (summary) => {
        completed = true;
        assert.ok(summary.totalSources > 0);
        assert.ok(typeof summary.elapsedMs === 'number');
      }
    });

    assert.strictEqual(started, true, 'onStart should be called');
    assert.strictEqual(completed, true, 'onComplete should be called');
    assert.ok(streamedResults.length >= 3, 'Should stream each source as it resolves');
    assert.ok(progressCalls >= 3, 'Should notify progress on each resolution');
    assert.ok(res.firstResultLatencyMs > 0, 'First result latency should be recorded');
    assert.strictEqual(res.query, '1.1.1.1');
    assert.strictEqual(res.type, 'ip');
  });

  // --------------------------------------------------------------------------
  console.log('\n🌐 4. Backend Fast Search API Endpoints (/api/fast-search/*)');
  // --------------------------------------------------------------------------
  await itAsync('GET /api/fast-search/status returns 13 operational providers', async () => {
    const req = {
      url: '/api/fast-search/status',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.status, 'ok');
    assert.strictEqual(json.providersCount, 13);
  });

  await itAsync('GET /api/fast-search/shodan-ip returns open ports and CVEs', async () => {
    const req = {
      url: '/api/fast-search/shodan-ip?ip=1.1.1.1',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.query, '1.1.1.1');
    assert.ok(Array.isArray(json.ports));
  });

  await itAsync('GET /api/fast-search/threat-check queries threat intel', async () => {
    const req = {
      url: '/api/fast-search/threat-check?query=http://bad-domain.com/malware.exe',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.query, 'http://bad-domain.com/malware.exe');
    assert.ok(json.urlhaus !== undefined);
  });

  await itAsync('GET /api/fast-search/company-fr searches French enterprise register', async () => {
    const req = {
      url: '/api/fast-search/company-fr?q=552032534',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.query, '552032534');
    assert.ok(Array.isArray(json.companies));
  });

  await itAsync('GET /api/fast-search/knowledge-search queries Wikipedia and DuckDuckGo', async () => {
    const req = {
      url: '/api/fast-search/knowledge-search?q=Alan+Turing',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.query, 'Alan Turing');
    assert.ok(Array.isArray(json.articles));
  });

  await itAsync('GET /api/fast-search/account-recon checks developer & social platforms', async () => {
    const req = {
      url: '/api/fast-search/account-recon?username=torvalds',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.username, 'torvalds');
    assert.ok(Array.isArray(json.accounts));
  });

  await itAsync('GET /api/fast-search/crypto-balance queries Bitcoin Mempool ledger', async () => {
    const req = {
      url: '/api/fast-search/crypto-balance?address=1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.address, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    assert.ok(json.balanceBtc !== undefined);
  });

  await itAsync('GET /api/fast-search/hash-lookup queries CIRCL Hashlookup database', async () => {
    const req = {
      url: '/api/fast-search/hash-lookup?hash=44d88612fea8a8f36de82e1278abb02f',
      method: 'GET',
      headers: { host: '127.0.0.1:3099' }
    };
    const res = createMockResponse();
    const handled = await handleFastSearchRequest(req, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(res.getStatusCode(), 200);
    const json = res.getJSON();
    assert.strictEqual(json.hash, '44d88612fea8a8f36de82e1278abb02f');
    assert.ok(json.matched !== undefined);
  });

  // --------------------------------------------------------------------------
  console.log('\n📄 5. Multi-Format Serialization (JSON, CSV, Markdown)');
  // --------------------------------------------------------------------------
  await itAsync('Serializes search session to valid JSON, CSV, and Markdown', async () => {
    const session = await engine.search('example.com');

    // JSON export
    const jsonStr = engine.exportJSON(session);
    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.query, 'example.com');
    assert.ok(parsed.results.length > 0);

    // CSV export
    const csvStr = engine.exportCSV(session);
    assert.ok(csvStr.includes('Timestamp,Query,Type,Source,Status,LatencyMs,ItemsCount,Title,Snippet'));
    assert.ok(csvStr.includes('example.com'));

    // Markdown export
    const mdStr = engine.exportMarkdown(session);
    assert.ok(mdStr.includes('# Rapport Fast Research — example.com'));
    assert.ok(mdStr.includes('## Synthèse de la collecte'));
    assert.ok(mdStr.includes('### Résumé par source'));
  });

  // --------------------------------------------------------------------------
  console.log('\n🔗 6. Complementary Catalog Tool Pivots');
  // --------------------------------------------------------------------------
  it('Returns complementary catalog tools for manual browser pivots', () => {
    const pivots = engine.getCatalogPivots('domain', 'example.com');
    assert.ok(pivots.length >= 3, 'Should return at least 3 tool pivots for domain');
    assert.ok(pivots.some(p => p.name.includes('Shodan') || p.name.includes('SecurityTrails') || p.name.includes('VirusTotal')));
  });

  console.log('\n======================================================');
  console.log(`Test Execution Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
