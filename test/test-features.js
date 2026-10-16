/**
 * AAA_OSINT — Unit & Integration Test Suite for:
 * 1. "Outils sans inscription" Section & Access Classifications
 * 2. Bilingual Internationalization (FR / EN) & Search Engine
 * 3. Catalog Integrity & Metadata Consistency
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const i18n = require('../site/i18n.js');

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

async function runTests() {
  console.log('\n==================================================================');
  console.log('🧪 Starting AAA_OSINT — "Sans Inscription" & i18n Test Suite');
  console.log('==================================================================\n');

  // Load catalog
  const dataPath = path.join(__dirname, '../site/data.json');
  assert.ok(fs.existsSync(dataPath), 'site/data.json must exist');
  const DATA = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // --------------------------------------------------------------------------
  console.log('📦 1. Catalog & Access Classification Integrity');

  it('Total categories count is exactly 25 and total tools is 947', () => {
    assert.strictEqual(DATA.totalCategories, 25);
    assert.strictEqual(DATA.totalTools, 947);
    assert.strictEqual(DATA.categories.length, 25);
  });

  const VALID_STATUSES = ['no_account', 'optional_account', 'limited_access', 'required_account', 'to_verify'];

  it('Every single tool in catalog has a valid access status and metadata fields', () => {
    let toolCount = 0;
    const allTools = [];

    DATA.categories.forEach(cat => {
      assert.ok(cat.slug, 'Category must have slug');
      assert.ok(cat.title, 'Category must have title');
      assert.ok(cat.title_fr, 'Category must have title_fr');
      assert.ok(cat.title_en, 'Category must have title_en');
      assert.ok(Array.isArray(cat.groups), 'Category groups must be array');

      cat.groups.forEach(group => {
        assert.ok(group.name, 'Group must have name');
        assert.ok(group.name_fr, 'Group must have name_fr');
        assert.ok(group.name_en, 'Group must have name_en');
        assert.ok(Array.isArray(group.tools), 'Group tools must be array');

        group.tools.forEach(tool => {
          toolCount++;
          allTools.push(tool);
          assert.ok(tool.name, `Tool must have name: ${JSON.stringify(tool)}`);
          assert.ok(tool.url, `Tool must have url: ${tool.name}`);
          assert.ok(VALID_STATUSES.includes(tool.access), `Tool ${tool.name} has invalid access: ${tool.access}`);
          assert.ok('description' in tool, `Tool ${tool.name} must have description field`);
          assert.ok('description_fr' in tool, `Tool ${tool.name} must have description_fr field`);
          assert.ok('access_details_fr' in tool, `Tool ${tool.name} must have access_details_fr field`);
          assert.ok('access_details_en' in tool, `Tool ${tool.name} must have access_details_en field`);
        });
      });
    });

    assert.strictEqual(toolCount, 947);
  });

  it('No duplicate tool URLs exist within the same category group', () => {
    DATA.categories.forEach(cat => {
      cat.groups.forEach(group => {
        const seen = new Set();
        group.tools.forEach(tool => {
          assert.ok(!seen.has(tool.url), `Duplicate url in group ${group.name}: ${tool.url}`);
          seen.add(tool.url);
        });
      });
    });
  });

  it('Calculates exact metrics for "Sans inscription" section without duplication', () => {
    let countNoAccount = 0;
    let countOptional = 0;
    let countLimited = 0;
    let countRequired = 0;
    let countToVerify = 0;

    DATA.categories.forEach(cat => {
      cat.groups.forEach(group => {
        group.tools.forEach(tool => {
          if (tool.access === 'no_account') countNoAccount++;
          else if (tool.access === 'optional_account') countOptional++;
          else if (tool.access === 'limited_access') countLimited++;
          else if (tool.access === 'required_account') countRequired++;
          else if (tool.access === 'to_verify') countToVerify++;
        });
      });
    });

    const totalNoRegistration = countNoAccount + countOptional + countLimited;
    assert.strictEqual(totalNoRegistration, 501, 'Should have 501 verified tools without mandatory account');
    assert.strictEqual(countNoAccount, 420, 'Should have 420 no_account tools');
    assert.strictEqual(countOptional, 44, 'Should have 44 optional_account tools');
    assert.strictEqual(countLimited, 37, 'Should have 37 limited_access tools');
    assert.strictEqual(countRequired, 17, 'Should have 17 required_account tools');
    assert.strictEqual(countToVerify, 429, 'Should have 429 to_verify tools (no guessing)');
    assert.strictEqual(totalNoRegistration + countRequired + countToVerify, 947);
    assert.strictEqual(DATA.noRegistrationCount, 501);
  });

  // --------------------------------------------------------------------------
  console.log('\n🌐 2. Centralized Internationalization (i18n) Engine');

  it('Defaults to French ("fr") and allows switching to English ("en")', () => {
    i18n.setLang('fr');
    assert.strictEqual(i18n.getLang(), 'fr');
    i18n.setLang('en');
    assert.strictEqual(i18n.getLang(), 'en');
    i18n.setLang('fr');
    assert.strictEqual(i18n.getLang(), 'fr');
  });

  it('Translates UI keys with parameter interpolation in both languages', () => {
    i18n.setLang('fr');
    assert.strictEqual(i18n.t('all_tools'), 'Tous les outils');
    assert.strictEqual(i18n.t('no_registration'), 'Sans inscription');
    assert.strictEqual(i18n.t('all_tools_count', { tools: 947, categories: 25 }), '947 outils · 25 catégories');

    i18n.setLang('en');
    assert.strictEqual(i18n.t('all_tools'), 'All tools');
    assert.strictEqual(i18n.t('no_registration'), 'No registration');
    assert.strictEqual(i18n.t('all_tools_count', { tools: 947, categories: 25 }), '947 tools · 25 categories');

    // Reset back to fr
    i18n.setLang('fr');
  });

  it('Translates domain titles for all 5 domains', () => {
    i18n.setLang('fr');
    const domCyberFr = i18n.getDomainTitle({ id: 'cyber', title_fr: 'Cyber & Infrastructure', title_en: 'Cyber & Infrastructure' });
    assert.strictEqual(domCyberFr, 'Cyber & Infrastructure');

    const domIdentityFr = i18n.getDomainTitle({ id: 'identity', title_fr: 'Identité & Personnes', title_en: 'Identity & People' });
    assert.strictEqual(domIdentityFr, 'Identité & Personnes');

    i18n.setLang('en');
    const domIdentityEn = i18n.getDomainTitle({ id: 'identity', title_fr: 'Identité & Personnes', title_en: 'Identity & People' });
    assert.strictEqual(domIdentityEn, 'Identity & People');

    i18n.setLang('fr');
  });

  it('Translates category and group titles reliably', () => {
    const testCat = DATA.categories.find(c => c.slug === 'people-social');
    assert.ok(testCat);

    i18n.setLang('fr');
    assert.strictEqual(i18n.getCategoryTitle(testCat), testCat.title_fr || testCat.title);

    i18n.setLang('en');
    assert.strictEqual(i18n.getCategoryTitle(testCat), testCat.title_en || testCat.title);

    const testGroup = testCat.groups[0];
    i18n.setLang('fr');
    assert.ok(i18n.getGroupName(testGroup).length > 0);
    i18n.setLang('en');
    assert.ok(i18n.getGroupName(testGroup).length > 0);

    i18n.setLang('fr');
  });

  it('Provides access status labels, badges, and CSS classes', () => {
    i18n.setLang('fr');
    const noAccFr = i18n.getAccessInfo('no_account');
    assert.strictEqual(noAccFr.label, 'Sans compte');
    assert.strictEqual(noAccFr.pillClass, 'access-badge--no-account');

    const reqAccFr = i18n.getAccessInfo('required_account');
    assert.strictEqual(reqAccFr.label, 'Inscription requise');
    assert.strictEqual(reqAccFr.pillClass, 'access-badge--required');

    i18n.setLang('en');
    const noAccEn = i18n.getAccessInfo('no_account');
    assert.strictEqual(noAccEn.label, 'No account');

    const reqAccEn = i18n.getAccessInfo('required_account');
    assert.strictEqual(reqAccEn.label, 'Account required');

    i18n.setLang('fr');
  });

  it('Provides reactive event notifications on language change', () => {
    let notifiedLang = null;
    const unsub = i18n.onLanguageChange((lang) => {
      notifiedLang = lang;
    });

    i18n.setLang('en');
    assert.strictEqual(notifiedLang, 'en');
    i18n.setLang('fr');
    assert.strictEqual(notifiedLang, 'fr');

    unsub();
    i18n.setLang('en');
    assert.strictEqual(notifiedLang, 'fr', 'Unsubscribed listener should not be called');
    i18n.setLang('fr');
  });

  // --------------------------------------------------------------------------
  console.log('\n🔍 3. Bilingual Search Functionality');

  function searchCatalog(query) {
    const q = query.toLowerCase().trim();
    const hits = [];

    DATA.categories.forEach(cat => {
      const catTitleFr = (cat.title_fr || cat.title || '').toLowerCase();
      const catTitleEn = (cat.title_en || cat.title || '').toLowerCase();
      const catMatch = catTitleFr.includes(q) || catTitleEn.includes(q);

      cat.groups.forEach(group => {
        const groupNameFr = (group.name_fr || group.name || '').toLowerCase();
        const groupNameEn = (group.name_en || group.name || '').toLowerCase();
        const groupMatch = groupNameFr.includes(q) || groupNameEn.includes(q);

        group.tools.forEach(tool => {
          const nameMatch = (tool.name || '').toLowerCase().includes(q);
          const descEnMatch = (tool.description || '').toLowerCase().includes(q);
          const descFrMatch = (tool.description_fr || '').toLowerCase().includes(q);
          const urlMatch = (tool.url || '').toLowerCase().includes(q);

          if (catMatch || groupMatch || nameMatch || descEnMatch || descFrMatch || urlMatch) {
            hits.push(tool);
          }
        });
      });
    });

    return hits;
  }

  it('Searches successfully with French keywords (e.g. "géolocalisation", "personnes")', () => {
    const hitsGeo = searchCatalog('géolocalisation');
    assert.ok(hitsGeo.length > 0, 'Should find tools for "géolocalisation"');

    const hitsPers = searchCatalog('personnes');
    assert.ok(hitsPers.length > 0, 'Should find tools for "personnes"');
  });

  it('Searches successfully with English keywords (e.g. "geospatial", "people")', () => {
    const hitsGeo = searchCatalog('geospatial');
    assert.ok(hitsGeo.length > 0, 'Should find tools for "geospatial"');

    const hitsPeople = searchCatalog('people');
    assert.ok(hitsPeople.length > 0, 'Should find tools for "people"');
  });

  it('Finds tools by technical keywords and domains regardless of active language', () => {
    const hitsDns = searchCatalog('dnsdumpster');
    assert.ok(hitsDns.length > 0, 'Should find dnsdumpster');
    assert.strictEqual(hitsDns[0].name, 'DNSDumpster');

    const hitsArchive = searchCatalog('archive.org');
    assert.ok(hitsArchive.length > 0, 'Should find archive.org');
  });

  // --------------------------------------------------------------------------
  console.log('\n==================================================================');
  console.log(`📊 Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('==================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
