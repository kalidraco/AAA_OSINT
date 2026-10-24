/**
 * AAA_OSINT — Visual Investigation Graph Test Suite
 *
 * Automated verification for:
 * 1. Indicator classification & Entity types taxonomy
 * 2. Transforms Registry mapping & Execution
 * 3. EXIF & SHA-256 Fingerprint Extraction
 * 4. Graph Engine Data Model, Physics & Layouts
 * 5. Candidate vs Verified Edge distinctions
 * 6. Graph Serialization (JSON import/export, CSV)
 * 7. Server Transform Endpoints (/api/transform/*)
 */

const assert = require('assert');
const url = require('url');

// Set test environment
process.env.PORT = '3099';
process.env.INTELX_MOCK = 'true';

const { handleTransformRequest } = require('../server.js');
const { ENTITY_TYPES, TransformsRegistry, computeBufferSha256, parseExifFromBuffer } = require('../site/transforms-registry.js');
const GraphEngine = require('../site/graph-engine.js');

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
  console.log('🕸️ AAA_OSINT — Visual Investigation Graph Test Suite');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('📦 1. Entity Taxonomy & Indicator Classification');
  // --------------------------------------------------------------------------
  it('Has all 15 normalized entity types with required visual metadata', () => {
    const requiredTypes = [
      'domain', 'subdomain', 'ip', 'email', 'username',
      'person', 'organization', 'url', 'phone', 'image',
      'document', 'crypto', 'hash', 'leak', 'source'
    ];
    for (const t of requiredTypes) {
      assert.ok(ENTITY_TYPES[t], `Entity type "${t}" should exist in taxonomy`);
      assert.ok(ENTITY_TYPES[t].name_fr, `Type "${t}" should have French name`);
      assert.ok(ENTITY_TYPES[t].name_en, `Type "${t}" should have English name`);
      assert.ok(ENTITY_TYPES[t].icon, `Type "${t}" should have visual icon`);
      assert.ok(ENTITY_TYPES[t].color, `Type "${t}" should have theme color`);
    }
  });

  // --------------------------------------------------------------------------
  console.log('\n⚡ 2. Transforms Registry & Catalog Tool Pivots');
  // --------------------------------------------------------------------------
  const registry = new TransformsRegistry({ apiBase: 'http://127.0.0.1:3099' });

  it('Maps domain entity to DNS, crt.sh subdomains, and RDAP transforms', () => {
    const domainTransforms = registry.getApplicableTransforms('domain');
    assert.ok(domainTransforms.length >= 4, 'Domain should have at least 4 applicable transforms');
    const ids = domainTransforms.map(t => t.id);
    assert.ok(ids.includes('domain_dns_all'));
    assert.ok(ids.includes('domain_subdomains_crtsh'));
    assert.ok(ids.includes('domain_rdap_whois'));
  });

  it('Maps IP entity to reverse DNS and RDAP network transforms', () => {
    const ipTransforms = registry.getApplicableTransforms('ip');
    assert.ok(ipTransforms.some(t => t.id === 'ip_rdns_ptr'));
    assert.ok(ipTransforms.some(t => t.id === 'ip_rdap_network'));
  });

  it('Maps email entity to domain extraction transform', () => {
    const emailTransforms = registry.getApplicableTransforms('email');
    assert.ok(emailTransforms.some(t => t.id === 'email_domain_extract'));
  });

  it('Generates pre-filled external tool pivots for catalog integration', () => {
    const pivots = registry.getCatalogPivots('domain', 'target.org');
    assert.ok(pivots.length >= 3, 'Should provide at least 3 catalog pivots for domain');
    assert.ok(pivots.some(p => p.url.includes('shodan.io')));
    assert.ok(pivots.some(p => p.url.includes('target.org')));
  });

  // --------------------------------------------------------------------------
  console.log('\n📷 3. Image Fingerprint & EXIF Parsing');
  // --------------------------------------------------------------------------
  it('Computes SHA-256 hash from ArrayBuffer', async () => {
    const buffer = Buffer.from('AAA_OSINT_INVESTIGATION_TEST_SAMPLE');
    const sha = await computeBufferSha256(buffer.buffer);
    assert.strictEqual(typeof sha, 'string');
    assert.strictEqual(sha.length, 64);
  });

  it('Safely parses non-JPEG buffers without crashing', () => {
    const nonJpeg = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const exif = parseExifFromBuffer(nonJpeg.buffer);
    assert.strictEqual(exif.hasExif, false);
  });

  // --------------------------------------------------------------------------
  console.log('\n🕸️ 4. Graph Engine Data Model & Node Management');
  // --------------------------------------------------------------------------
  // Mock Canvas Context
  const mockCanvas = {
    getContext: () => ({
      resetTransform: () => {},
      scale: () => {},
      translate: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      measureText: (txt) => ({ width: (txt || '').length * 7 }),
      fillText: () => {},
      save: () => {},
      restore: () => {},
      moveTo: () => {},
      lineTo: () => {},
      setLineDash: () => {},
      strokeRect: () => {},
    }),
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
    addEventListener: () => {},
    style: {},
  };

  const graph = new GraphEngine(mockCanvas);

  it('Adds nodes with default coordinates and properties', () => {
    const n1 = graph.addNode({
      id: 'domain_example_com',
      type: 'domain',
      label: 'example.com',
      properties: { domain: 'example.com' },
    });
    assert.ok(n1);
    assert.strictEqual(n1.id, 'domain_example_com');
    assert.strictEqual(n1.label, 'example.com');
    assert.strictEqual(graph.getAllNodes().length, 1);
  });

  it('Adds edges and connects nodes', () => {
    const n2 = graph.addNode({
      id: 'ip_93_184_216_34',
      type: 'ip',
      label: '93.184.216.34',
    });
    const edge = graph.addEdge({
      sourceId: 'domain_example_com',
      targetId: 'ip_93_184_216_34',
      type: 'resolves_to',
      label: 'A Record',
      confidence: 'verified',
    });
    assert.ok(edge);
    assert.strictEqual(graph.getAllEdges().length, 1);
    assert.strictEqual(edge.confidence, 'verified');
  });

  it('Distinguishes verified edges from candidate relationships', () => {
    const n3 = graph.addNode({
      id: 'user_alice',
      type: 'username',
      label: 'alice',
    });
    const candidateEdge = graph.addEdge({
      sourceId: 'domain_example_com',
      targetId: 'user_alice',
      type: 'associated_with',
      label: 'Possible Webmaster',
      confidence: 'candidate',
    });
    assert.strictEqual(candidateEdge.confidence, 'candidate');
  });

  it('Finds neighbors and connected edges accurately', () => {
    const neighbors = graph.getNeighbors('domain_example_com');
    assert.strictEqual(neighbors.length, 2);
    const connectedEdges = graph.getConnectedEdges('domain_example_com');
    assert.strictEqual(connectedEdges.length, 2);
  });

  it('Cascade removes edges when node is removed', () => {
    graph.removeNode('user_alice');
    assert.strictEqual(graph.getNode('user_alice'), undefined);
    assert.strictEqual(graph.getAllEdges().length, 1);
  });

  it('Executes physics step without NaN coordinates', () => {
    graph.stepPhysics();
    const nodes = graph.getAllNodes();
    for (const node of nodes) {
      assert.ok(!Number.isNaN(node.x), 'Node X must not be NaN');
      assert.ok(!Number.isNaN(node.y), 'Node Y must not be NaN');
      assert.ok(!Number.isNaN(node.vx), 'Node Vx must not be NaN');
      assert.ok(!Number.isNaN(node.vy), 'Node Vy must not be NaN');
    }
  });

  it('Applies radial, hierarchical, and grid layouts cleanly', () => {
    graph.applyLayout('radial');
    assert.ok(graph.getAllNodes().length > 0);
    graph.applyLayout('hierarchical');
    assert.ok(graph.getAllNodes().length > 0);
    graph.applyLayout('grid');
    assert.ok(graph.getAllNodes().length > 0);
  });

  // --------------------------------------------------------------------------
  console.log('\n💾 5. Serialization & Export Integrity');
  // --------------------------------------------------------------------------
  it('Exports full graph to JSON string with positions and properties', () => {
    const jsonStr = graph.exportJSON();
    assert.strictEqual(typeof jsonStr, 'string');
    const parsed = JSON.parse(jsonStr);
    assert.ok(Array.isArray(parsed.nodes));
    assert.ok(Array.isArray(parsed.edges));
    assert.strictEqual(parsed.nodes.length, 2);
    assert.strictEqual(parsed.edges.length, 1);
  });

  it('Imports JSON and completely reconstructs graph structure', () => {
    const jsonStr = graph.exportJSON();
    graph.clear();
    assert.strictEqual(graph.getAllNodes().length, 0);

    graph.importJSON(jsonStr);
    assert.strictEqual(graph.getAllNodes().length, 2);
    assert.strictEqual(graph.getAllEdges().length, 1);
    assert.ok(graph.getNode('domain_example_com'));
    assert.ok(graph.getNode('ip_93_184_216_34'));
  });

  it('Exports valid CSV representations of nodes and relations', () => {
    const csv = graph.exportCSV();
    assert.ok(csv.includes('domain_example_com'));
    assert.ok(csv.includes('ip_93_184_216_34'));
    assert.ok(csv.includes('resolves_to'));
  });

  // --------------------------------------------------------------------------
  console.log('\n🌐 6. Server Automated Transform Endpoints (/api/transform/*)');
  // --------------------------------------------------------------------------
  await itAsync('GET /api/transform/status returns available transforms', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/status', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.transforms));
    assert.ok(data.transforms.includes('dns'));
    assert.ok(data.transforms.includes('rdap'));
    assert.ok(data.transforms.includes('certs'));
  });

  await itAsync('GET /api/transform/dns resolves domain records', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/dns?domain=example.com', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.domain, 'example.com');
    assert.ok(Array.isArray(data.records.a));
    assert.ok(Array.isArray(data.records.mx));
    assert.ok(Array.isArray(data.records.ns));
  });

  await itAsync('GET /api/transform/rdns resolves IP PTR hostnames', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/rdns?ip=93.184.216.34', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.ip, '93.184.216.34');
    assert.ok(Array.isArray(data.hostnames));
  });

  await itAsync('GET /api/transform/rdap returns structured registration metadata', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/rdap?query=example.com&type=domain', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.ok(data.registrar);
    assert.ok(data.dates);
  });

  await itAsync('GET /api/transform/certs returns subdomains list', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/certs?domain=example.com', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.subdomains));
    assert.ok(data.subdomains.length > 0);
  });

  await itAsync('GET /api/transform/http-headers returns web headers and page title', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/http-headers?url=https://example.com', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.status, 200);
    assert.ok(data.server);
    assert.ok(data.title);
  });

  await itAsync('GET /api/transform/wayback returns historical snapshots', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/wayback?url=example.com', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.snapshots));
  });

  await itAsync('GET /api/transform/profile-check verifies username on platforms', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/profile-check?username=torvalds', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.profiles));
    assert.ok(data.profiles.some(p => p.platform === 'GitHub'));
  });

  await itAsync('GET /api/transform/crypto validates address formats', async () => {
    const req = { method: 'GET', headers: { 'x-intelx-mock': 'true' } };
    const res = createMockResponse();
    const parsedUrl = url.parse('/api/transform/crypto?address=1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', true);

    await handleTransformRequest(req, res, parsedUrl);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getJSON();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.blockchain, 'Bitcoin (BTC)');
    assert.strictEqual(data.isValidFormat, true);
  });

  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`📊 Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
