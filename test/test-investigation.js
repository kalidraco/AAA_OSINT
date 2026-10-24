/**
 * AAA_OSINT — Investigation Module Automated Test Suite
 *
 * Runs comprehensive unit and integration tests:
 * 1. Indicator Auto-Detection & Classification
 * 2. Tool Recommendation & Query URL Generation
 * 3. Investigation Lifecycle (CRUD)
 * 4. Finding & Evidence Normalization
 * 5. Cross-referencing & Correlation Engine (Confidence Scoring)
 * 6. Report Generation (Sections A-F) & Export (Markdown, HTML)
 * 7. Server-Side Persistence API (GET, POST, PUT, DELETE)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

const InvestigationEngine = require('../site/investigation-engine.js');
const { handleInvestigationRequest } = require('../server.js');
const dataJson = require('../site/data.json');

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

// Mock request / response helpers for server API testing without external network
function createMockReq(method, pathname, body) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = { 'content-type': 'application/json' };
  process.nextTick(() => {
    if (body !== undefined) {
      req.emit('data', typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.emit('end');
  });
  return req;
}

function createMockRes() {
  let resolvePromise;
  const promise = new Promise((resolve) => { resolvePromise = resolve; });
  const res = {
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(data) {
      this.rawBody = data;
      try {
        this.body = data ? JSON.parse(data) : null;
      } catch {
        this.body = data;
      }
      resolvePromise(this);
    }
  };
  return { res, promise };
}

async function run() {
  console.log('\n======================================================');
  console.log('🕵️ AAA_OSINT — Investigation Module Test Suite');
  console.log('======================================================\n');

  const engine = new InvestigationEngine({ catalogData: dataJson });

  // ── 1. Indicator Auto-Detection ─────────────────────────────────────────
  console.log('📦 1. Indicator Auto-Detection & Classification');

  it('Detects email address', () => {
    const res = engine.detectIndicatorType('analyst.target@proton.me');
    assert.strictEqual(res.id, 'email');
  });

  it('Detects IPv4 address', () => {
    const res = engine.detectIndicatorType('192.168.1.100');
    assert.strictEqual(res.id, 'ip');
  });

  it('Detects IPv6 address', () => {
    const res = engine.detectIndicatorType('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    assert.strictEqual(res.id, 'ip');
  });

  it('Detects domain name', () => {
    const res = engine.detectIndicatorType('subdomain.osint-corp.com');
    assert.strictEqual(res.id, 'domain');
  });

  it('Detects web URL', () => {
    const res = engine.detectIndicatorType('https://github.com/kalidraco/AAA_OSINT');
    assert.strictEqual(res.id, 'url');
  });

  it('Detects phone number', () => {
    const res = engine.detectIndicatorType('+33 6 12 34 56 78');
    assert.strictEqual(res.id, 'phone');
  });

  it('Detects Bitcoin wallet address', () => {
    const res = engine.detectIndicatorType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    assert.strictEqual(res.id, 'crypto_wallet');
  });

  it('Detects Ethereum wallet address', () => {
    const res = engine.detectIndicatorType('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    assert.strictEqual(res.id, 'crypto_wallet');
  });

  it('Detects MD5 hash', () => {
    const res = engine.detectIndicatorType('5d41402abc4b2a76b9719d911017c592');
    assert.strictEqual(res.id, 'hash');
  });

  it('Detects SHA-256 hash', () => {
    const res = engine.detectIndicatorType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.strictEqual(res.id, 'hash');
  });

  it('Detects username / handle', () => {
    const res = engine.detectIndicatorType('@cyber_investigator');
    assert.strictEqual(res.id, 'username');
  });

  it('Defaults generic text to text type', () => {
    const res = engine.detectIndicatorType('opération secrète de renseignement');
    assert.strictEqual(res.id, 'text');
  });

  // ── 2. Tool Recommendation & Query URL Generation ───────────────────────
  console.log('\n📦 2. Catalog Tool Mapping & Query Generation');

  it('Maps email indicators to relevant tool categories', () => {
    const tools = engine.getRecommendedTools('email', 50);
    assert.ok(tools.length > 0, 'Should find recommended tools for email');
    const hasSearchOrPeople = tools.some(t =>
      t.categorySlug === 'people-social' ||
      t.categorySlug === 'search-engines' ||
      t.categorySlug === 'darkweb-leaks'
    );
    assert.ok(hasSearchOrPeople, 'Should include people, search or darkweb categories');
  });

  it('Maps domain indicators to infrastructure tools', () => {
    const tools = engine.getRecommendedTools('domain', 50);
    assert.ok(tools.length > 0);
    const hasDomainTools = tools.some(t =>
      t.categorySlug === 'infra-domains' ||
      t.categorySlug === 'search-engines' ||
      t.categorySlug === 'intelx'
    );
    assert.ok(hasDomainTools, 'Should recommend infra/domain tools');
  });

  it('Generates search URLs with pre-filled query for query-supporting tools', () => {
    const sampleTool = { name: 'Google', url: 'https://www.google.com' };
    const queryUrl = engine.generateSearchUrl(sampleTool, 'target@example.com');
    assert.ok(queryUrl.includes('google.com/search?q='), 'Google query URL generated');
    assert.ok(queryUrl.includes(encodeURIComponent('target@example.com')), 'Query is encoded');
  });

  it('Generates DuckDuckGo and Shodan query URLs', () => {
    const ddgTool = { name: 'DuckDuckGo', url: 'https://duckduckgo.com' };
    const ddgUrl = engine.generateSearchUrl(ddgTool, '192.168.1.1');
    assert.ok(ddgUrl.includes('duckduckgo.com/?q='));

    const shodanTool = { name: 'Shodan', url: 'https://www.shodan.io' };
    const shodanUrl = engine.generateSearchUrl(shodanTool, '1.1.1.1');
    assert.ok(shodanUrl.includes('shodan.io/search?query='));
  });

  // ── 3. Investigation Lifecycle & Findings ────────────────────────────────
  console.log('\n📦 3. Investigation CRUD & Finding Normalization');

  let inv = null;

  it('Creates a new investigation case', () => {
    inv = engine.createInvestigation({
      name: 'Affaire Cybersécurité Alpha',
      context: 'Enquête sur exfiltration de données',
    });
    assert.ok(inv.id, 'Investigation should have an ID');
    assert.strictEqual(inv.name, 'Affaire Cybersécurité Alpha');
    assert.strictEqual(inv.status, 'draft');
    assert.strictEqual(inv.indicators.length, 0);
  });

  it('Adds indicators to the investigation', () => {
    const ind1 = engine.addIndicator(inv, 'target.ceo@corp-target.com', 'email', 'Adresse email professionnelle');
    const ind2 = engine.addIndicator(inv, 'corp-target.com', 'domain', 'Domaine principal');
    const ind3 = engine.addIndicator(inv, '198.51.100.24', 'ip', 'Serveur web');

    assert.strictEqual(inv.indicators.length, 3);
    assert.strictEqual(ind1.value, 'target.ceo@corp-target.com');
    assert.strictEqual(ind2.type, 'domain');
    assert.strictEqual(ind3.type, 'ip');
  });

  it('Records findings with evidence metadata and confidence level', () => {
    const finding1 = engine.addFinding(inv, {
      title: 'Compte GitHub actif découvert',
      content: 'Le profil github.com/target-ceo mentionne l\'adresse email target.ceo@corp-target.com',
      type: 'account',
      confidence: 'confirmed',
      sourceName: 'GitHub',
      url: 'https://github.com/target-ceo',
    });

    const finding2 = engine.addFinding(inv, {
      title: 'Enregistrement DNS MX identifié',
      content: 'MX pointant vers mail.corp-target.com hébergé sur 198.51.100.24',
      type: 'infra',
      confidence: 'confirmed',
      sourceName: 'SecurityTrails',
      url: 'https://securitytrails.com/domain/corp-target.com',
    });

    assert.strictEqual(inv.findings.length, 2);
    assert.strictEqual(finding1.confidence, 'confirmed');
    assert.strictEqual(finding2.type, 'infra');
  });

  // ── 4. Cross-Referencing & Correlation Engine ───────────────────────────
  console.log('\n📦 4. Cross-Referencing & Correlation Engine');

  it('Calculates correlations and cross-references between indicators and findings', () => {
    const correlations = engine.autoCorrelate(inv);
    assert.ok(Array.isArray(correlations), 'Returns array of correlations');
    assert.ok(correlations.length > 0, 'Finds cross-references between email domain and domain indicator');

    const domainEmailCorr = correlations.find(c => c.type === 'domain_email' || c.justification.includes('corp-target.com'));
    assert.ok(domainEmailCorr, 'Detects link between email target.ceo@corp-target.com and domain corp-target.com');
  });

  it('Supports analyst validation of correlations', () => {
    const corr = inv.correlations[0];
    assert.ok(corr);
    corr.validatedByUser = true;
    corr.confidence = 'confirmed';

    assert.strictEqual(corr.validatedByUser, true);
    assert.strictEqual(corr.confidence, 'confirmed');
  });

  // ── 5. Structured Report Generation ──────────────────────────────────────
  console.log('\n📦 5. Structured 6-Section Report Generation');

  let report = null;

  it('Generates structured report with all 6 required sections (A to F)', () => {
    report = engine.generateReport(inv, 'fr');
    assert.ok(report);
    assert.strictEqual(report.language, 'fr');

    const sections = Object.keys(report.sections);
    assert.ok(sections.includes('summary'), 'Section A: Summary');
    assert.ok(sections.includes('findings'), 'Section B: Findings');
    assert.ok(sections.includes('correlations'), 'Section C: Correlations');
    assert.ok(sections.includes('timeline'), 'Section D: Timeline');
    assert.ok(sections.includes('methodology'), 'Section E: Methodology');
    assert.ok(sections.includes('sources'), 'Section F: Sources');
  });

  it('Exports report to Markdown document with headings and evidence links', () => {
    const md = engine.exportMarkdown(report);
    assert.ok(typeof md === 'string');
    assert.ok(md.includes('Affaire Cybersécurité Alpha'));
    assert.ok(md.includes('## A. Synthèse'));
    assert.ok(md.includes('## B. Éléments trouvés'));
    assert.ok(md.includes('## C. Corrélations'));
    assert.ok(md.includes('## D. Chronologie'));
    assert.ok(md.includes('## E. Méthodologie'));
    assert.ok(md.includes('## F. Sources'));
    assert.ok(md.includes('target.ceo@corp-target.com'));
  });

  it('Exports report to HTML ready for printing / PDF', () => {
    const html = engine.exportHTML(report);
    assert.ok(typeof html === 'string');
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('@media print'));
    assert.ok(html.includes('Affaire Cybersécurité Alpha'));
  });

  // ── 6. Server API Persistence Endpoints ─────────────────────────────────
  console.log('\n📦 6. Server API Persistence Endpoints (/api/investigation*)');

  await itAsync('POST /api/investigation saves investigation to file system', async () => {
    const testCase = {
      id: 'test_case_suite_1',
      name: 'Enquête Test Suite',
      status: 'active',
      indicators: [{ id: 'i1', type: 'email', value: 'victim@target.org' }],
      findings: [{ id: 'f1', title: 'Fuite vérifiée', confidence: 'confirmed' }],
      correlations: [],
    };

    const req = createMockReq('POST', '/api/investigation', testCase);
    const { res, promise } = createMockRes();
    handleInvestigationRequest(req, res, { pathname: '/api/investigation' });
    const response = await promise;

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.ok, true);
    assert.strictEqual(response.body.id, 'test_case_suite_1');
  });

  await itAsync('GET /api/investigation/:id retrieves the saved investigation', async () => {
    const req = createMockReq('GET', '/api/investigation/test_case_suite_1');
    const { res, promise } = createMockRes();
    handleInvestigationRequest(req, res, { pathname: '/api/investigation/test_case_suite_1' });
    const response = await promise;

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.name, 'Enquête Test Suite');
    assert.strictEqual(response.body.indicators.length, 1);
  });

  await itAsync('GET /api/investigations lists all saved cases with summary stats', async () => {
    const req = createMockReq('GET', '/api/investigations');
    const { res, promise } = createMockRes();
    handleInvestigationRequest(req, res, { pathname: '/api/investigations' });
    const response = await promise;

    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.body));
    const found = response.body.find(c => c.id === 'test_case_suite_1');
    assert.ok(found, 'Should find the saved case in list');
    assert.strictEqual(found.indicatorCount, 1);
    assert.strictEqual(found.findingsCount, 1);
  });

  await itAsync('DELETE /api/investigation/:id removes the investigation file', async () => {
    const req = createMockReq('DELETE', '/api/investigation/test_case_suite_1');
    const { res, promise } = createMockRes();
    handleInvestigationRequest(req, res, { pathname: '/api/investigation/test_case_suite_1' });
    const response = await promise;

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.ok, true);

    // Verify it is gone
    const getReq = createMockReq('GET', '/api/investigation/test_case_suite_1');
    const { res: getRes, promise: getPromise } = createMockRes();
    handleInvestigationRequest(getReq, getRes, { pathname: '/api/investigation/test_case_suite_1' });
    const getResponse = await getPromise;
    assert.strictEqual(getResponse.status, 404);
  });

  console.log('\n======================================================');
  console.log(`📊 Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
