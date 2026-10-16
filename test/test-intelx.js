/**
 * AAA_OSINT — Intelligence X Integration Test Suite
 *
 * Runs comprehensive automated unit and integration tests:
 * 1. Selector Auto-Detection & Classification
 * 2. API Key Management & Masking
 * 3. Sensitive Data Redaction (Passwords, Secrets, Private Keys)
 * 4. IntelX Adapter Asynchronous Polling & Termination
 * 5. Local Server Proxy Endpoints (/api/intelx/*)
 * 6. Static Asset Integrity (data.json 25 categories, 947 tools)
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Set test environment
process.env.PORT = '3099';
process.env.INTELX_MOCK = 'true'; // Enable mock mode for safe simulation without spending quota

const { server } = require('../server.js');
const IntelXClient = require('../site/intelx-client.js');

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

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting AAA_OSINT — Intelligence X Test Suite');
  console.log('======================================================\n');

  const client = new IntelXClient({ apiBase: 'http://127.0.0.1:3099/api/intelx', mockMode: true });

  // --------------------------------------------------------------------------
  console.log('📦 1. Unit Tests: Selector Auto-Detection & Classification');
  // --------------------------------------------------------------------------
  it('Detects email selector properly', () => {
    const res = client.detectSelectorType('investigator.target@proton.me');
    assert.strictEqual(res.type, 'email');
    assert.strictEqual(res.category, 'Identité & Personnes');
  });

  it('Detects domain selector properly', () => {
    const res = client.detectSelectorType('intelx.io');
    assert.strictEqual(res.type, 'domain');
    assert.strictEqual(res.category, 'Cyber & Infrastructure');
  });

  it('Detects IPv4 selector properly', () => {
    const res = client.detectSelectorType('185.220.101.5');
    assert.strictEqual(res.type, 'ip');
    assert.strictEqual(res.label, 'Adresse IPv4');
  });

  it('Detects CIDR network range selector properly', () => {
    const res = client.detectSelectorType('192.168.1.0/24');
    assert.strictEqual(res.type, 'ip');
    assert.strictEqual(res.label, 'Plage Réseau CIDR');
  });

  it('Detects URL selector properly', () => {
    const res = client.detectSelectorType('https://pastebin.com/raw/xyz123');
    assert.strictEqual(res.type, 'url');
  });

  it('Detects international phone number properly', () => {
    const res = client.detectSelectorType('+33 6 12 34 56 78');
    assert.strictEqual(res.type, 'phone');
  });

  it('Detects cryptographic hashes (MD5, SHA1, SHA256)', () => {
    const md5 = client.detectSelectorType('5d41402abc4b2a76b9719d911017c592');
    assert.strictEqual(md5.type, 'hash');
    assert.strictEqual(md5.label, 'Empreinte MD5');

    const sha1 = client.detectSelectorType('2fd4e1c67a2d28fced849ee1bb76e7391b93eb12');
    assert.strictEqual(sha1.type, 'hash');
    assert.strictEqual(sha1.label, 'Empreinte SHA-1');

    const sha256 = client.detectSelectorType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.strictEqual(sha256.type, 'hash');
    assert.strictEqual(sha256.label, 'Empreinte SHA-256');
  });

  it('Detects UUID and Storage IDs', () => {
    const res = client.detectSelectorType('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    assert.strictEqual(res.type, 'uuid');
  });

  it('Falls back to general keyword for arbitrary text', () => {
    const res = client.detectSelectorType('cyber espionage campaign 2025');
    assert.strictEqual(res.type, 'text');
  });

  // --------------------------------------------------------------------------
  console.log('\n🔐 2. Unit Tests: Sensitive Data Redaction & Privacy');
  // --------------------------------------------------------------------------
  it('Redacts plain passwords in dump entries', () => {
    const raw = 'user=admin\npassword: SuperSecretP@ssword123!\nemail: test@domain.org';
    const result = client.redactSensitiveData(raw);
    assert.ok(!result.sanitized.includes('SuperSecretP@ssword123!'), 'Password should be masked');
    assert.ok(result.sanitized.includes('•••••••••• [MASQUÉ]'), 'Redaction placeholder should be present');
    assert.strictEqual(result.redactedCount, 1);
  });

  it('Redacts combo dump credentials (email:password)', () => {
    const raw = 'alice@example.com:Winter2024!\nbob@company.org:qwerty12345';
    const result = client.redactSensitiveData(raw);
    assert.ok(!result.sanitized.includes('Winter2024!'));
    assert.ok(!result.sanitized.includes('qwerty12345'));
    assert.ok(result.sanitized.includes('alice@example.com:•••••••••• [MASQUÉ]'));
    assert.strictEqual(result.redactedCount, 2);
  });

  it('Redacts private key blocks', () => {
    const raw = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...PRIVATE_DATA...==\n-----END RSA PRIVATE KEY-----';
    const result = client.redactSensitiveData(raw);
    assert.ok(!result.sanitized.includes('PRIVATE_DATA'));
    assert.ok(result.sanitized.includes('[CLÉ PRIVÉE SENSIBLE MASQUÉE PAR MESURE DE SÉCURITÉ]'));
  });

  // --------------------------------------------------------------------------
  console.log('\n🔑 3. Unit Tests: API Key Management & Masking');
  // --------------------------------------------------------------------------
  it('Correctly stores, retrieves, and masks API key', () => {
    client.setApiKey('a1b2c3d4-e5f6-7890-abcd-1234567890ef', 'session');
    assert.strictEqual(client.hasApiKey(), true);
    assert.strictEqual(client.getApiKey(), 'a1b2c3d4-e5f6-7890-abcd-1234567890ef');

    const masked = client.getMaskedKey();
    assert.strictEqual(masked, 'a1b2••••••••90ef');

    client.clearApiKey();
    assert.strictEqual(client.hasApiKey(), false);
    assert.strictEqual(client.getApiKey(), '');
  });

  // --------------------------------------------------------------------------
  console.log('\n🌐 4. Integration Tests: Local Server & IntelX Proxy Endpoints');
  // --------------------------------------------------------------------------
  // Start server on test port 3099
  await new Promise((resolve) => server.listen(3099, '127.0.0.1', resolve));

  await itAsync('Proxy endpoint GET /api/intelx/status returns valid status', async () => {
    const status = await client.checkStatus();
    assert.strictEqual(status.ok, true);
    assert.strictEqual(status.authenticated, true);
    assert.strictEqual(status.mode, 'mock');
  });

  await itAsync('Asynchronous search initiates and polls progressive results', async () => {
    let progressCalls = 0;
    const searchRes = await client.search(
      {
        term: 'sample@target.org',
        mode: 'intelligent',
        maxresults: 10,
      },
      (progress) => {
        progressCalls++;
        assert.ok(progress.searchId, 'Search ID should be provided in progress');
      }
    );

    assert.ok(searchRes.searchId.startsWith('mock-'), 'Search ID should match mock format');
    assert.ok(searchRes.records.length > 0, 'Should have received records');
    assert.ok(progressCalls >= 1, 'Progress callback should have been called');
  });

  await itAsync('Phonebook search returns enumerated selectors', async () => {
    const pbRes = await client.search({
      term: 'example.com',
      mode: 'phonebook',
      maxresults: 20,
    });

    assert.strictEqual(pbRes.isPhonebook, true);
    assert.ok(pbRes.records.length > 0, 'Should return selectors');
    assert.ok(pbRes.records.some(r => r.selector.includes('example.com')));
  });

  await itAsync('Preview endpoint fetches content for record', async () => {
    const preview = await client.fetchPreview('mock-storage-id', 'pastes');
    assert.ok(preview.length > 0);
    assert.ok(preview.includes('INTELLIGENCE X PREVIEW'));
  });

  await itAsync('Search termination cleanly aborts running query', async () => {
    const termRes = await client.terminate();
    assert.strictEqual(termRes.ok, true);
  });

  // --------------------------------------------------------------------------
  console.log('\n📊 5. Integrity Tests: AAA OSINT Catalog Preservation');
  // --------------------------------------------------------------------------
  it('Preserves all 25 categories and 947 tools in site/data.json', () => {
    const dataFile = path.join(__dirname, '..', 'site', 'data.json');
    assert.ok(fs.existsSync(dataFile), 'site/data.json must exist');

    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    assert.strictEqual(data.totalCategories, 25, 'Must preserve exactly 25 categories');
    assert.strictEqual(data.totalTools, 947, 'Must preserve exactly 947 tools');
  });

  it('Verifies IntelligenceX tool entries exist in catalog', () => {
    const darkwebFile = path.join(__dirname, '..', 'docs', 'darkweb-leaks.md');
    const content = fs.readFileSync(darkwebFile, 'utf-8');
    assert.ok(content.includes('IntelligenceX'), 'IntelligenceX entry preserved in darkweb-leaks.md');
  });

  // Close test server
  await new Promise((resolve) => server.close(resolve));

  console.log('\n======================================================');
  console.log(`🏁 Test Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
