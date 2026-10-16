/**
 * AAA_OSINT — Access Status & Catalog Audit Tool
 * 
 * Verifies catalog integrity, access status classifications, and bilingual coverage.
 * Usage:
 *   node scripts/verify-access.js
 *   node scripts/verify-access.js --filter=no_account
 *   node scripts/verify-access.js --stats
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'site', 'data.json');
const REGISTRY_FILE = path.join(__dirname, 'access-registry.json');

const VALID_STATUSES = ['no_account', 'optional_account', 'limited_access', 'required_account', 'to_verify'];

function audit() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ Error: site/data.json does not exist. Run npm run build first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const registry = fs.existsSync(REGISTRY_FILE) ? JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')) : {};

  console.log('\n======================================================');
  console.log('🔍 Auditing AAA_OSINT Catalog & Access Classification');
  console.log('======================================================\n');

  let totalTools = 0;
  const statusCounts = {
    no_account: 0,
    optional_account: 0,
    limited_access: 0,
    required_account: 0,
    to_verify: 0
  };

  let missingAccessCount = 0;
  let missingTranslationCount = 0;
  let invalidStatusCount = 0;

  for (const cat of data.categories) {
    if (!cat.title_fr || !cat.title_en) {
      console.warn(`⚠️ Warning: Category "${cat.slug}" is missing bilingual titles.`);
      missingTranslationCount++;
    }

    for (const group of cat.groups) {
      if (!group.name_fr || !group.name_en) {
        console.warn(`⚠️ Warning: Group "${group.name}" in category "${cat.slug}" is missing bilingual names.`);
        missingTranslationCount++;
      }

      for (const tool of group.tools) {
        totalTools++;

        if (!tool.access) {
          missingAccessCount++;
        } else if (!VALID_STATUSES.includes(tool.access)) {
          invalidStatusCount++;
        } else {
          statusCounts[tool.access]++;
        }

        if (!tool.description_fr || !tool.description_en) {
          missingTranslationCount++;
        }
      }
    }
  }

  console.log(`📋 Total Categories Audited: ${data.categories.length}`);
  console.log(`🛠️ Total Tools Audited:      ${totalTools}`);
  console.log('------------------------------------------------------');
  console.log(`🟢 Sans compte (no_account):          ${statusCounts.no_account}`);
  console.log(`🔵 Compte facultatif (optional_account): ${statusCounts.optional_account}`);
  console.log(`🟡 Accès limité (limited_access):     ${statusCounts.limited_access}`);
  console.log(`🔒 Inscription requise (required_account): ${statusCounts.required_account}`);
  console.log(`⚪ À vérifier (to_verify):             ${statusCounts.to_verify}`);
  console.log('------------------------------------------------------');
  console.log(`🔓 Total "Sans inscription" (No mandatory reg): ${statusCounts.no_account + statusCounts.optional_account + statusCounts.limited_access}`);
  console.log('======================================================\n');

  if (missingAccessCount > 0) {
    console.error(`❌ FAILED: ${missingAccessCount} tools are missing access status metadata.`);
    process.exit(1);
  }

  if (invalidStatusCount > 0) {
    console.error(`❌ FAILED: ${invalidStatusCount} tools have an invalid access status.`);
    process.exit(1);
  }

  console.log('✅ Catalog Audit Passed! All tools have validated access classifications.\n');
}

audit();
