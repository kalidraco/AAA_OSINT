/**
 * AAA_OSINT — Investigation Engine
 *
 * Core logic for multi-source OSINT investigations:
 * - Indicator type detection and classification
 * - Tool recommendation based on indicator → category mapping
 * - Search URL generation for OSINT tools supporting URL queries
 * - Result normalization into a uniform schema
 * - Correlation engine (dedup, linking, confidence scoring)
 * - Report generation with sections A–F
 *
 * Zero external dependencies. Follows existing AAA_OSINT patterns.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InvestigationEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── Indicator Type Definitions ──────────────────────────────────────────

  const INDICATOR_TYPES = {
    person_name:   { id: 'person_name',   icon: '👤', label_fr: 'Nom / Prénom',           label_en: 'Name / Surname' },
    username:      { id: 'username',      icon: '🏷️', label_fr: 'Pseudonyme',              label_en: 'Username' },
    organization:  { id: 'organization',  icon: '🏢', label_fr: 'Organisation / Entreprise', label_en: 'Organization / Company' },
    email:         { id: 'email',         icon: '📧', label_fr: 'Adresse e-mail',          label_en: 'Email Address' },
    phone:         { id: 'phone',         icon: '📱', label_fr: 'Numéro de téléphone',     label_en: 'Phone Number' },
    domain:        { id: 'domain',        icon: '🌐', label_fr: 'Nom de domaine',          label_en: 'Domain Name' },
    url:           { id: 'url',           icon: '🔗', label_fr: 'URL / Lien web',          label_en: 'URL / Web Link' },
    ip:            { id: 'ip',            icon: '🖥️', label_fr: 'Adresse IP',              label_en: 'IP Address' },
    image:         { id: 'image',         icon: '🖼️', label_fr: 'Image',                   label_en: 'Image' },
    platform_id:   { id: 'platform_id',   icon: '🆔', label_fr: 'Identifiant plateforme',  label_en: 'Platform Identifier' },
    document:      { id: 'document',      icon: '📄', label_fr: 'Document / Fichier',      label_en: 'Document / File' },
    hash:          { id: 'hash',          icon: '🔑', label_fr: 'Empreinte (hash)',        label_en: 'Hash Fingerprint' },
    crypto_wallet: { id: 'crypto_wallet', icon: '💰', label_fr: 'Portefeuille crypto',     label_en: 'Crypto Wallet' },
    text:          { id: 'text',          icon: '🔍', label_fr: 'Texte / Mot-clé',         label_en: 'Text / Keyword' },
  };

  // ── Indicator → Catalog Category Mapping ────────────────────────────────
  //
  // Each indicator type maps to catalog category slugs, ordered by relevance.
  // These match the slugs in data.json (e.g., 'people-social', 'infra-domains').

  const INDICATOR_CATEGORY_MAP = {
    person_name:   ['people-social', 'business-intel', 'gov-legal', 'news-media', 'search-engines', 'academic'],
    username:      ['people-social', 'search-engines', 'darkweb-leaks'],
    organization:  ['business-intel', 'gov-legal', 'news-media', 'search-engines', 'infra-domains'],
    email:         ['phishing-email', 'people-social', 'darkweb-leaks', 'search-engines'],
    phone:         ['people-social', 'comms', 'search-engines'],
    domain:        ['infra-domains', 'phishing-email', 'archiving-caching', 'malware-cti', 'search-engines'],
    url:           ['archiving-caching', 'infra-domains', 'search-engines', 'malware-cti'],
    ip:            ['infra-domains', 'malware-cti', 'intel-feeds'],
    image:         ['image-reverse', 'search-engines'],
    platform_id:   ['people-social', 'search-engines'],
    document:      ['document-file', 'search-engines', 'academic'],
    hash:          ['malware-cti', 'infra-domains', 'darkweb-leaks'],
    crypto_wallet: ['darkweb-leaks', 'search-engines', 'intel-feeds'],
    text:          ['search-engines', 'news-media', 'people-social'],
  };

  // ── Search URL Templates for Known Tools ────────────────────────────────
  //
  // Maps tool domain → URL template function.
  // {q} = query, {domain} = domain, {ip} = IP address, {email} = email
  // Only tools that support direct URL-based search are included.

  const SEARCH_URL_TEMPLATES = {
    // Search Engines
    'www.google.com':      (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    'duckduckgo.com':      (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    'www.bing.com':        (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    'yandex.com':          (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}`,
    'search.brave.com':    (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    'www.startpage.com':   (q) => `https://www.startpage.com/do/dsearch?query=${encodeURIComponent(q)}`,

    // Infrastructure & DNS
    'crt.sh':              (q) => `https://crt.sh/?q=${encodeURIComponent(q)}`,
    'www.shodan.io':       (q) => `https://www.shodan.io/search?query=${encodeURIComponent(q)}`,
    'search.censys.io':    (q) => `https://search.censys.io/search?resource=hosts&q=${encodeURIComponent(q)}`,
    'www.virustotal.com':  (q) => `https://www.virustotal.com/gui/search/${encodeURIComponent(q)}`,
    'urlscan.io':          (q) => `https://urlscan.io/search/#${encodeURIComponent(q)}`,
    'securitytrails.com':  (q) => `https://securitytrails.com/domain/${encodeURIComponent(q)}/dns`,
    'viewdns.info':        (q) => `https://viewdns.info/whois/?domain=${encodeURIComponent(q)}`,
    'dnsdumpster.com':     (q) => `https://dnsdumpster.com/`,
    'hunter.io':           (q) => `https://hunter.io/search/${encodeURIComponent(q)}`,
    'www.robtex.com':      (q) => `https://www.robtex.com/dns-lookup/${encodeURIComponent(q)}`,
    'builtwith.com':       (q) => `https://builtwith.com/${encodeURIComponent(q)}`,
    'www.whoxy.com':       (q) => `https://www.whoxy.com/${encodeURIComponent(q)}`,
    'www.nslookup.io':     (q) => `https://www.nslookup.io/domains/${encodeURIComponent(q)}/dns-records/`,
    'completedns.com':     (q) => `https://completedns.com/dns-history/?domain=${encodeURIComponent(q)}`,

    // People & Social
    'www.namechk.com':     (q) => `https://www.namechk.com/`,
    'whatsmyname.app':     (q) => `https://whatsmyname.app/`,
    'www.social-searcher.com': (q) => `https://www.social-searcher.com/search-users/?q6=${encodeURIComponent(q)}`,

    // Image Reverse Search
    'images.google.com':   (q) => `https://images.google.com/`,
    'tineye.com':          (q) => `https://tineye.com/search?url=${encodeURIComponent(q)}`,
    'yandex.com/images':   (q) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(q)}`,

    // Archive & Cache
    'web.archive.org':     (q) => `https://web.archive.org/web/*/${encodeURIComponent(q)}`,
    'archive.org':         (q) => `https://archive.org/search?query=${encodeURIComponent(q)}`,
    'cachedview.nl':       (q) => `https://cachedview.nl/`,

    // Business Intelligence
    'opencorporates.com':  (q) => `https://opencorporates.com/companies?q=${encodeURIComponent(q)}`,
    'www.societe.com':     (q) => `https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(q)}`,
    'www.pappers.fr':      (q) => `https://www.pappers.fr/recherche?q=${encodeURIComponent(q)}`,

    // News & Media
    'news.google.com':     (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}`,

    // Academic
    'scholar.google.com':  (q) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`,

    // Malware & CTI
    'www.hybrid-analysis.com': (q) => `https://www.hybrid-analysis.com/search?query=${encodeURIComponent(q)}`,
    'otx.alienvault.com':  (q) => `https://otx.alienvault.com/indicator/search/${encodeURIComponent(q)}`,
    'threatcrowd.org':     (q) => `https://threatcrowd.org/searchApi/v2/${encodeURIComponent(q)}`,
  };

  // ── Finding Types ───────────────────────────────────────────────────────

  const FINDING_TYPES = {
    profile:     { icon: '👤', label_fr: 'Profil public',        label_en: 'Public Profile' },
    mention:     { icon: '💬', label_fr: 'Mention',              label_en: 'Mention' },
    record:      { icon: '📋', label_fr: 'Enregistrement',       label_en: 'Record' },
    dns_info:    { icon: '🌐', label_fr: 'Information DNS',      label_en: 'DNS Information' },
    whois_info:  { icon: '📝', label_fr: 'Information WHOIS',    label_en: 'WHOIS Information' },
    cert_info:   { icon: '🔒', label_fr: 'Certificat SSL/TLS',   label_en: 'SSL/TLS Certificate' },
    email_info:  { icon: '📧', label_fr: 'Information e-mail',   label_en: 'Email Information' },
    image_match: { icon: '🖼️', label_fr: 'Correspondance image', label_en: 'Image Match' },
    document:    { icon: '📄', label_fr: 'Document',             label_en: 'Document' },
    company:     { icon: '🏢', label_fr: 'Entreprise',           label_en: 'Company' },
    news:        { icon: '📰', label_fr: 'Article / Actualité',  label_en: 'News Article' },
    leak:        { icon: '⚠️', label_fr: 'Fuite de données',     label_en: 'Data Leak' },
    social:      { icon: '📱', label_fr: 'Réseau social',        label_en: 'Social Media' },
    infrastructure: { icon: '🖥️', label_fr: 'Infrastructure', label_en: 'Infrastructure' },
    other:       { icon: '📌', label_fr: 'Autre',                label_en: 'Other' },
  };

  // ── Confidence Levels ───────────────────────────────────────────────────

  const CONFIDENCE_LEVELS = {
    confirmed: { id: 'confirmed', icon: '✅', label_fr: 'Confirmé',  label_en: 'Confirmed',  color: 'var(--accent-green)' },
    probable:  { id: 'probable',  icon: '🟡', label_fr: 'Probable',  label_en: 'Probable',   color: 'var(--accent-amber)' },
    uncertain: { id: 'uncertain', icon: '❓', label_fr: 'Incertain', label_en: 'Uncertain',  color: 'var(--text-muted)' },
  };

  // ── UUID Generator ──────────────────────────────────────────────────────

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }

  // ── Helper: Extract Domain ──────────────────────────────────────────────

  function extractDomain(urlStr) {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
      return urlStr || '';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  InvestigationEngine Class
  // ══════════════════════════════════════════════════════════════════════════

  class InvestigationEngine {
    constructor(options = {}) {
      this.catalogData = options.catalogData || null;
      this.intelxClient = options.intelxClient || null;
      this.apiBase = options.apiBase || '/api/investigation';
      this.activeOperations = new Map();
    }

    // ── Catalog Data Setter ─────────────────────────────────────────────

    setCatalogData(data) {
      this.catalogData = data;
    }

    setIntelXClient(client) {
      this.intelxClient = client;
    }

    // ── Indicator Detection ─────────────────────────────────────────────
    //
    // Detects the type of an indicator from its value.
    // Returns: { type, label_fr, label_en, icon }

    detectIndicatorType(value) {
      if (!value || typeof value !== 'string') {
        return { ...INDICATOR_TYPES.text };
      }
      const val = value.trim();

      // Email
      if (/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(val)) {
        return { ...INDICATOR_TYPES.email };
      }

      // IPv4 / CIDR
      if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(val)) {
        return { ...INDICATOR_TYPES.ip };
      }

      // IPv6
      if (/^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$/.test(val)) {
        return { ...INDICATOR_TYPES.ip };
      }

      // URL
      if (/^https?:\/\//i.test(val)) {
        return { ...INDICATOR_TYPES.url };
      }

      // Crypto wallet (Bitcoin, Ethereum)
      if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(val)) {
        return { ...INDICATOR_TYPES.crypto_wallet };
      }
      if (/^0x[0-9a-fA-F]{40}$/.test(val)) {
        return { ...INDICATOR_TYPES.crypto_wallet };
      }

      // Phone
      const digitsOnly = val.replace(/\D/g, '');
      if (/^\+?[0-9\s\-().]{7,25}$/.test(val) && digitsOnly.length >= 7 && digitsOnly.length <= 15 &&
          (val.startsWith('+') || /^0[1-9]/.test(val) || val.includes('-') || val.includes('('))) {
        return { ...INDICATOR_TYPES.phone };
      }

      // Hash: MD5
      if (/^[a-fA-F0-9]{32}$/.test(val)) {
        return { ...INDICATOR_TYPES.hash };
      }
      // Hash: SHA-1
      if (/^[a-fA-F0-9]{40}$/.test(val)) {
        return { ...INDICATOR_TYPES.hash };
      }
      // Hash: SHA-256
      if (/^[a-fA-F0-9]{64}$/.test(val)) {
        return { ...INDICATOR_TYPES.hash };
      }

      // Domain
      if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(val)) {
        return { ...INDICATOR_TYPES.domain };
      }

      // Username (starts with @, or single word with common username chars)
      if (/^@?[a-zA-Z0-9_.\-]{3,30}$/.test(val) && !val.includes(' ') && !val.includes('.', val.indexOf('.') + 1)) {
        if (val.startsWith('@')) {
          return { ...INDICATOR_TYPES.username };
        }
      }

      // Person name (two to four words, capitalized words, alphabetic, with spaces)
      if (/^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ\-']{1,}\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ\-']{1,}\s*){1,3}$/.test(val)) {
        return { ...INDICATOR_TYPES.person_name };
      }

      // Organization (contains common org suffixes)
      if (/\b(Inc|LLC|Ltd|GmbH|SA|SAS|SARL|Corp|Co|Group|Foundation|Association)\b/i.test(val)) {
        return { ...INDICATOR_TYPES.organization };
      }

      // Default: text/keyword
      return { ...INDICATOR_TYPES.text };
    }

    generateSearchUrl(tool, queryValue) {
      if (!tool || !queryValue) return null;
      const url = typeof tool === 'string' ? tool : (tool.url || '');
      const dom = extractDomain(url).toLowerCase();
      const rawDom = ((url.match(/https?:\/\/([^/?#]+)/i) || [])[1] || dom).toLowerCase();
      const template = SEARCH_URL_TEMPLATES[dom] ||
                       SEARCH_URL_TEMPLATES[rawDom] ||
                       SEARCH_URL_TEMPLATES[`www.${dom}`] ||
                       SEARCH_URL_TEMPLATES[dom.replace(/^www\./, '')];
      if (template) {
        return template(queryValue);
      }
      return null;
    }

    getRecommendedTools(indicatorOrType, limit = 100) {
      let type = 'text';
      let value = '';
      if (typeof indicatorOrType === 'string') {
        if (INDICATOR_TYPES[indicatorOrType]) {
          type = indicatorOrType;
        } else {
          const detected = this.detectIndicatorType(indicatorOrType);
          type = detected.id;
          value = indicatorOrType;
        }
      } else if (indicatorOrType && typeof indicatorOrType === 'object') {
        type = indicatorOrType.type || this.detectIndicatorType(indicatorOrType.value).id;
        value = indicatorOrType.value || '';
      }

      const relevantSlugs = new Set(INDICATOR_CATEGORY_MAP[type] || INDICATOR_CATEGORY_MAP.text || []);
      const results = [];

      if (!this.catalogData || !Array.isArray(this.catalogData.categories)) {
        return results;
      }

      for (const cat of this.catalogData.categories) {
        if (!relevantSlugs.has(cat.slug)) continue;
        for (const group of cat.groups || []) {
          for (const tool of group.tools || []) {
            const copy = {
              ...tool,
              categorySlug: cat.slug,
              categoryTitleFr: cat.title_fr || cat.title,
              categoryTitleEn: cat.title_en || cat.title,
            };
            if (value) {
              copy.directSearchUrl = this.generateSearchUrl(tool, value);
            }
            results.push(copy);
            if (limit && results.length >= limit) return results;
          }
        }
      }
      return results;
    }

    // ── Tool Recommendation ─────────────────────────────────────────────
    //
    // Given a set of indicators, returns recommended tools from the catalog
    // grouped by category, with pre-filled search URLs where possible.

    getRecommendedSources(indicators) {
      if (!this.catalogData || !Array.isArray(this.catalogData.categories)) {
        return [];
      }

      // Collect all relevant category slugs from all indicators
      const relevantSlugs = new Set();
      for (const indicator of indicators) {
        const type = indicator.type || this.detectIndicatorType(indicator.value).id;
        const slugs = INDICATOR_CATEGORY_MAP[type] || INDICATOR_CATEGORY_MAP.text;
        slugs.forEach(s => relevantSlugs.add(s));
      }

      const sources = [];

      // Add IntelX as a special automated source
      sources.push({
        id: 'intelx-search',
        toolName: 'Intelligence X',
        toolUrl: 'https://intelx.io',
        categorySlug: 'darkweb-leaks',
        categoryTitle: 'Intelligence X',
        automated: true,
        selected: true,
        priority: 0,
        icon: '⚡',
        description_fr: 'Recherche automatique via l\'API Intelligence X (archives, fuites, pastes, darknet).',
        description_en: 'Automated search via Intelligence X API (archives, leaks, pastes, darknet).',
      });

      // Add IntelX Phonebook
      sources.push({
        id: 'intelx-phonebook',
        toolName: 'Intelligence X — Phonebook',
        toolUrl: 'https://intelx.io',
        categorySlug: 'darkweb-leaks',
        categoryTitle: 'Intelligence X',
        automated: true,
        selected: true,
        priority: 1,
        icon: '📞',
        description_fr: 'Énumération automatique des sélecteurs (domaines, emails, URLs) via le Phonebook IntelX.',
        description_en: 'Automated selector enumeration (domains, emails, URLs) via IntelX Phonebook.',
      });

      // Walk the catalog to find tools in relevant categories
      let priority = 10;
      for (const cat of this.catalogData.categories) {
        if (!relevantSlugs.has(cat.slug)) continue;

        for (const group of cat.groups) {
          for (const tool of group.tools) {
            const toolDomain = extractDomain(tool.url);

            // Generate search URLs for each indicator
            const searchUrls = [];
            for (const indicator of indicators) {
              const template = SEARCH_URL_TEMPLATES[toolDomain];
              if (template) {
                searchUrls.push({
                  indicatorId: indicator.id,
                  indicatorValue: indicator.value,
                  searchUrl: template(indicator.value),
                });
              }
            }

            sources.push({
              id: `tool-${generateId()}`,
              toolName: tool.name,
              toolUrl: tool.url,
              categorySlug: cat.slug,
              categoryTitle: cat.title_fr || cat.title,
              categoryTitleEn: cat.title_en || cat.title,
              automated: false,
              selected: searchUrls.length > 0, // Pre-select tools with search URLs
              priority: priority++,
              icon: cat.emoji,
              description_fr: tool.description_fr || tool.description,
              description_en: tool.description_en || tool.description,
              access: tool.access,
              searchUrls,
            });
          }
        }
      }

      // Sort: automated first, then by priority
      sources.sort((a, b) => {
        if (a.automated !== b.automated) return a.automated ? -1 : 1;
        return a.priority - b.priority;
      });

      return sources;
    }

    // ── Investigation CRUD ───────────────────────────────────────────────

    createInvestigation(nameOrOptions = 'Investigation sans titre', context = '', indicators = []) {
      let name = 'Investigation sans titre';
      let ctx = context;
      let inds = indicators;
      if (typeof nameOrOptions === 'object' && nameOrOptions !== null) {
        name = nameOrOptions.name || nameOrOptions.title || name;
        ctx = nameOrOptions.context || nameOrOptions.objective || ctx;
        inds = nameOrOptions.indicators || inds;
      } else if (typeof nameOrOptions === 'string') {
        name = nameOrOptions;
      }
      const now = new Date().toISOString();
      const investigation = {
        id: generateId(),
        name: name,
        context: ctx,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        indicators: inds.map(ind => ({
          id: ind.id || generateId(),
          type: ind.type || this.detectIndicatorType(ind.value).id,
          value: ind.value,
          context: ind.context || '',
          addedAt: now,
        })),
        sources: [],
        findings: [],
        correlations: [],
        report: null,
      };
      return investigation;
    }

    addIndicator(investigation, valueOrObj, type, context) {
      let val = '';
      let typ = type;
      let ctx = context;
      if (typeof valueOrObj === 'object' && valueOrObj !== null) {
        val = valueOrObj.value || '';
        typ = valueOrObj.type || type;
        ctx = valueOrObj.context || context;
      } else {
        val = valueOrObj || '';
      }
      val = typeof val === 'string' ? val.trim() : String(val || '').trim();
      const detected = typ ? (INDICATOR_TYPES[typ] || this.detectIndicatorType(val)) : this.detectIndicatorType(val);
      const indicator = {
        id: generateId(),
        type: detected.id || typ || 'text',
        value: val,
        context: ctx || '',
        addedAt: new Date().toISOString(),
      };
      investigation.indicators.push(indicator);
      investigation.updatedAt = new Date().toISOString();
      return indicator;
    }

    removeIndicator(investigation, indicatorId) {
      investigation.indicators = investigation.indicators.filter(i => i.id !== indicatorId);
      investigation.updatedAt = new Date().toISOString();
    }

    // ── Add a Finding ───────────────────────────────────────────────────

    addFinding(investigation, finding) {
      const normalized = {
        id: finding.id || generateId(),
        sourceId: finding.sourceId || null,
        indicatorId: finding.indicatorId || null,
        type: finding.type || 'other',
        title: finding.title || '',
        content: finding.content || '',
        url: finding.url || null,
        metadata: finding.metadata || {},
        dateFound: finding.dateFound || new Date().toISOString(),
        dateOfContent: finding.dateOfContent || null,
        confidence: finding.confidence || 'uncertain',
        excerpt: finding.excerpt || '',
      };
      investigation.findings.push(normalized);
      investigation.updatedAt = new Date().toISOString();
      return normalized;
    }

    // ── Execute Investigation (Automated Sources) ───────────────────────
    //
    // Runs IntelX searches for each indicator. Returns results via callbacks.
    // Manual tools are tracked but not executed automatically.

    async executeInvestigation(investigation, selectedSources, callbacks = {}) {
      const onSourceStart = callbacks.onSourceStart || (() => {});
      const onSourceProgress = callbacks.onSourceProgress || (() => {});
      const onSourceComplete = callbacks.onSourceComplete || (() => {});
      const onSourceError = callbacks.onSourceError || (() => {});
      const onComplete = callbacks.onComplete || (() => {});

      investigation.status = 'running';
      investigation.updatedAt = new Date().toISOString();
      investigation.sources = selectedSources.map(s => ({
        ...s,
        status: s.automated ? 'pending' : (s.selected ? 'manual' : 'skipped'),
        startedAt: null,
        completedAt: null,
        error: null,
        resultCount: 0,
      }));

      // Execute automated sources
      const automatedSources = investigation.sources.filter(s => s.automated && s.selected);
      const promises = [];

      for (const source of automatedSources) {
        for (const indicator of investigation.indicators) {
          const promise = this._executeAutomatedSource(investigation, source, indicator, {
            onSourceStart,
            onSourceProgress,
            onSourceComplete,
            onSourceError,
          });
          promises.push(promise);
        }
      }

      try {
        await Promise.allSettled(promises);
      } catch (err) {
        // Individual errors are handled per-source
      }

      // Run correlation after all automated sources complete
      this.correlateResults(investigation);

      investigation.status = 'completed';
      investigation.updatedAt = new Date().toISOString();
      onComplete(investigation);
      return investigation;
    }

    async _executeAutomatedSource(investigation, source, indicator, callbacks) {
      const sourceKey = `${source.id}__${indicator.id}`;
      source.status = 'running';
      source.startedAt = new Date().toISOString();
      callbacks.onSourceStart(source, indicator);

      try {
        if (!this.intelxClient) {
          throw new Error('Client IntelX non configuré.');
        }

        if (source.id === 'intelx-search') {
          // IntelX Intelligent Search
          const results = await this.intelxClient.search(
            { term: indicator.value, maxresults: 50 },
            (progress) => {
              callbacks.onSourceProgress(source, indicator, progress);
            }
          );

          const records = results.records || [];
          source.resultCount = records.length;

          for (const record of records) {
            this.addFinding(investigation, {
              sourceId: source.id,
              indicatorId: indicator.id,
              type: this._classifyIntelXRecord(record),
              title: record.name || 'Résultat IntelX',
              content: record.description || '',
              url: null,
              metadata: {
                systemid: record.systemid,
                storageid: record.storageid,
                bucket: record.bucket,
                media: record.media,
                mediah: record.mediah,
                size: record.size,
                accesslevel: record.accesslevel,
                accesslevelh: record.accesslevelh,
              },
              dateOfContent: record.date || null,
              confidence: 'probable',
              excerpt: record.description || '',
            });
          }

        } else if (source.id === 'intelx-phonebook') {
          // IntelX Phonebook Enumeration
          const results = await this.intelxClient.search(
            { term: indicator.value, mode: 'phonebook', maxresults: 100 },
            (progress) => {
              callbacks.onSourceProgress(source, indicator, progress);
            }
          );

          const selectors = results.selectors || results.records || [];
          source.resultCount = selectors.length;

          for (const sel of selectors) {
            const selectorValue = sel.selector || sel.name || '';
            if (!selectorValue) continue;

            this.addFinding(investigation, {
              sourceId: source.id,
              indicatorId: indicator.id,
              type: this._classifyPhonebookSelector(sel),
              title: selectorValue,
              content: `Sélecteur associé à ${indicator.value}`,
              metadata: {
                target: sel.target,
                selectorType: sel.type,
              },
              confidence: 'confirmed',
            });
          }
        }

        source.status = 'completed';
        source.completedAt = new Date().toISOString();
        callbacks.onSourceComplete(source, indicator);

      } catch (err) {
        source.status = 'failed';
        source.error = err.message || 'Erreur inconnue';
        source.completedAt = new Date().toISOString();
        callbacks.onSourceError(source, indicator, err);
      }
    }

    _classifyIntelXRecord(record) {
      const bucket = (record.bucket || '').toLowerCase();
      if (bucket.includes('paste')) return 'leak';
      if (bucket.includes('darknet') || bucket.includes('tor')) return 'leak';
      if (bucket.includes('leak')) return 'leak';
      if (bucket.includes('document')) return 'document';
      return 'mention';
    }

    _classifyPhonebookSelector(sel) {
      const target = sel.target;
      if (target === 1) return 'dns_info'; // domain
      if (target === 2) return 'email_info'; // email
      if (target === 3) return 'infrastructure'; // url
      return 'other';
    }

    // ── Correlation Engine ──────────────────────────────────────────────
    //
    // Groups related findings, detects duplicates, calculates confidence.
    // Rules:
    // - Same URL from different sources = confirmed duplicate
    // - Same title/content = probable duplicate
    // - Shared identifiers across findings = relationship
    // - Never fuses entities solely on name match

    autoCorrelate(investigation) {
      return this.correlateResults(investigation);
    }

    correlateResults(investigation) {
      if (!investigation) return [];
      const findings = Array.isArray(investigation.findings) ? investigation.findings : [];
      const indicators = Array.isArray(investigation.indicators) ? investigation.indicators : [];

      const correlations = [];
      const processed = new Set();

      // 1. Cross-reference between Indicators (e.g. Email <-> Domain, URL <-> Domain)
      for (let i = 0; i < indicators.length; i++) {
        for (let j = i + 1; j < indicators.length; j++) {
          const a = indicators[i];
          const b = indicators[j];
          const key = `ind_${a.id}__${b.id}`;
          if (processed.has(key)) continue;

          // Email <-> Domain
          if ((a.type === 'email' && b.type === 'domain') || (a.type === 'domain' && b.type === 'email')) {
            const emailInd = a.type === 'email' ? a : b;
            const domainInd = a.type === 'domain' ? a : b;
            const emailDomain = (emailInd.value.split('@')[1] || '').toLowerCase();
            if (emailDomain === domainInd.value.toLowerCase()) {
              correlations.push({
                id: generateId(),
                findingIds: [],
                indicatorIds: [a.id, b.id],
                type: 'domain_email',
                confidence: 'confirmed',
                justification: `L'adresse e-mail « ${emailInd.value} » est directement rattachée au domaine « ${domainInd.value} ».`,
                justification_en: `Email address "${emailInd.value}" directly belongs to domain "${domainInd.value}".`,
                validatedByUser: true,
              });
              processed.add(key);
            }
          }

          // URL <-> Domain
          if ((a.type === 'url' && b.type === 'domain') || (a.type === 'domain' && b.type === 'url')) {
            const urlInd = a.type === 'url' ? a : b;
            const domainInd = a.type === 'domain' ? a : b;
            if (urlInd.value.toLowerCase().includes(domainInd.value.toLowerCase())) {
              correlations.push({
                id: generateId(),
                findingIds: [],
                indicatorIds: [a.id, b.id],
                type: 'domain_url',
                confidence: 'confirmed',
                justification: `L'URL « ${urlInd.value} » est hébergée sur le domaine « ${domainInd.value} ».`,
                justification_en: `URL "${urlInd.value}" is hosted on domain "${domainInd.value}".`,
                validatedByUser: true,
              });
              processed.add(key);
            }
          }
        }
      }

      // 2. Cross-reference between Indicators and Findings
      for (const ind of indicators) {
        if (!ind.value) continue;
        const indValLower = ind.value.toLowerCase();
        for (const f of findings) {
          const key = `ind_find_${ind.id}__${f.id}`;
          if (processed.has(key)) continue;

          const text = `${f.title || ''} ${f.content || ''} ${f.url || ''}`.toLowerCase();
          if (text.includes(indValLower)) {
            correlations.push({
              id: generateId(),
              findingIds: [f.id],
              indicatorIds: [ind.id],
              type: 'indicator_evidence',
              confidence: f.confidence || 'confirmed',
              justification: `La preuve « ${f.title} » recoupe l'indice « ${ind.value} ».`,
              justification_en: `Finding "${f.title}" cross-references indicator "${ind.value}".`,
              validatedByUser: f.confidence === 'confirmed' ? true : null,
            });
            processed.add(key);
          }
        }
      }

      // 3. Finding to Finding Correlations
      for (let i = 0; i < findings.length; i++) {
        for (let j = i + 1; j < findings.length; j++) {
          const a = findings[i];
          const b = findings[j];
          const pairKey = `${a.id}__${b.id}`;
          if (processed.has(pairKey)) continue;

          const correlation = this._detectCorrelation(a, b, indicators);
          if (correlation) {
            correlations.push(correlation);
            processed.add(pairKey);
          }
        }
      }

      investigation.correlations = correlations;
      investigation.updatedAt = new Date().toISOString();
      return correlations;
    }

    _detectCorrelation(findingA, findingB, indicators) {
      // Rule 1: Same URL = confirmed duplicate
      if (findingA.url && findingB.url && findingA.url === findingB.url) {
        return {
          id: generateId(),
          findingIds: [findingA.id, findingB.id],
          type: 'duplicate',
          confidence: 'confirmed',
          justification: `Même URL source : ${findingA.url}`,
          justification_en: `Same source URL: ${findingA.url}`,
          validatedByUser: null,
        };
      }

      // Rule 2: Same title (normalized) from different sources = probable duplicate
      if (findingA.sourceId !== findingB.sourceId) {
        const titleA = (findingA.title || '').toLowerCase().trim();
        const titleB = (findingB.title || '').toLowerCase().trim();
        if (titleA && titleB && titleA === titleB) {
          return {
            id: generateId(),
            findingIds: [findingA.id, findingB.id],
            type: 'duplicate',
            confidence: 'probable',
            justification: `Titre identique trouvé dans des sources différentes : « ${findingA.title} »`,
            justification_en: `Identical title found in different sources: "${findingA.title}"`,
            validatedByUser: null,
          };
        }
      }

      // Rule 3: Related — same indicator, different type of finding
      if (findingA.indicatorId === findingB.indicatorId &&
          findingA.type !== findingB.type &&
          findingA.sourceId !== findingB.sourceId) {
        return {
          id: generateId(),
          findingIds: [findingA.id, findingB.id],
          type: 'related',
          confidence: 'probable',
          justification: `Éléments trouvés pour le même indice à travers différentes sources.`,
          justification_en: `Elements found for the same indicator across different sources.`,
          validatedByUser: null,
        };
      }

      // Rule 4: Shared email/domain in content — uncertain relationship
      if (findingA.content && findingB.content) {
        const emailsA = findingA.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        const emailsB = findingB.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        const shared = emailsA.filter(e => emailsB.includes(e));
        if (shared.length > 0) {
          return {
            id: generateId(),
            findingIds: [findingA.id, findingB.id],
            type: 'related',
            confidence: 'uncertain',
            justification: `Adresse e-mail partagée détectée : ${shared[0]}`,
            justification_en: `Shared email address detected: ${shared[0]}`,
            validatedByUser: null,
          };
        }
      }

      return null;
    }

    // ── Report Generation ───────────────────────────────────────────────
    //
    // Generates a structured report from the investigation data.
    // Sections: A. Summary, B. Findings, C. Correlations,
    //           D. Timeline, E. Methodology, F. Sources

    generateReport(investigation, langOrOptions = 'fr') {
      let lang = 'fr';
      if (typeof langOrOptions === 'object' && langOrOptions !== null) {
        lang = langOrOptions.language || langOrOptions.lang || 'fr';
      } else if (typeof langOrOptions === 'string') {
        lang = langOrOptions;
      }
      const isFr = lang === 'fr';
      const now = new Date().toISOString();

      const report = {
        generatedAt: now,
        language: lang,
        investigation: {
          id: investigation.id,
          name: investigation.name,
          context: investigation.context,
          createdAt: investigation.createdAt,
        },
        sections: {},
      };

      // Section A: Summary
      report.sections.summary = this._generateSummary(investigation, isFr);

      // Section B: Findings
      report.sections.findings = this._generateFindingsSection(investigation, isFr);

      // Section C: Correlations
      report.sections.correlations = this._generateCorrelationsSection(investigation, isFr);

      // Section D: Timeline
      report.sections.timeline = this._generateTimeline(investigation, isFr);

      // Section E: Methodology
      report.sections.methodology = this._generateMethodology(investigation, isFr);

      // Section F: Sources
      report.sections.sources = this._generateSourcesSection(investigation, isFr);

      investigation.report = report;
      investigation.updatedAt = now;
      return report;
    }

    _generateSummary(inv, isFr) {
      const indicatorList = inv.indicators.map(i => {
        const typeInfo = INDICATOR_TYPES[i.type] || INDICATOR_TYPES.text;
        return `${typeInfo.icon} ${isFr ? typeInfo.label_fr : typeInfo.label_en}: ${i.value}`;
      });

      const completedSources = inv.sources.filter(s => s.status === 'completed');
      const failedSources = inv.sources.filter(s => s.status === 'failed');
      const totalFindings = inv.findings.length;
      const confirmedCorr = inv.correlations.filter(c => c.confidence === 'confirmed').length;

      return {
        title: isFr ? 'Synthèse' : 'Summary',
        objectAndScope: isFr
          ? `Investigation « ${inv.name} »${inv.context ? ` — Contexte : ${inv.context}` : ''}`
          : `Investigation "${inv.name}"${inv.context ? ` — Context: ${inv.context}` : ''}`,
        indicators: indicatorList,
        keyFindings: isFr
          ? `${totalFindings} élément(s) trouvé(s) à travers ${completedSources.length} source(s) interrogée(s).`
          : `${totalFindings} element(s) found across ${completedSources.length} source(s) queried.`,
        conclusions: isFr
          ? `${confirmedCorr} corrélation(s) confirmée(s) identifiée(s).`
          : `${confirmedCorr} confirmed correlation(s) identified.`,
        limitations: failedSources.length > 0
          ? (isFr
            ? `${failedSources.length} source(s) en échec ou inaccessible(s). Les résultats sont partiels.`
            : `${failedSources.length} source(s) failed or inaccessible. Results are partial.`)
          : (isFr ? 'Aucune limitation majeure identifiée.' : 'No major limitations identified.'),
      };
    }

    _generateFindingsSection(inv, isFr) {
      // Group findings by type
      const grouped = {};
      for (const finding of inv.findings) {
        const typeKey = finding.type || 'other';
        if (!grouped[typeKey]) {
          const typeInfo = FINDING_TYPES[typeKey] || FINDING_TYPES.other;
          grouped[typeKey] = {
            type: typeKey,
            label: isFr ? typeInfo.label_fr : typeInfo.label_en,
            icon: typeInfo.icon,
            items: [],
          };
        }
        grouped[typeKey].items.push({
          title: finding.title,
          content: finding.content,
          url: finding.url,
          dateFound: finding.dateFound,
          dateOfContent: finding.dateOfContent,
          confidence: finding.confidence,
          excerpt: finding.excerpt,
          sourceName: this._findSourceName(inv, finding.sourceId),
        });
      }

      return {
        title: isFr ? 'Éléments trouvés' : 'Findings',
        groups: Object.values(grouped),
        totalCount: inv.findings.length,
      };
    }

    _generateCorrelationsSection(inv, isFr) {
      return {
        title: isFr ? 'Corrélations' : 'Correlations',
        items: inv.correlations.map(c => ({
          type: c.type,
          confidence: c.confidence,
          confidenceLabel: CONFIDENCE_LEVELS[c.confidence]
            ? (isFr ? CONFIDENCE_LEVELS[c.confidence].label_fr : CONFIDENCE_LEVELS[c.confidence].label_en)
            : c.confidence,
          justification: isFr ? c.justification : (c.justification_en || c.justification),
          validatedByUser: c.validatedByUser,
          relatedFindings: c.findingIds.map(fid => {
            const f = inv.findings.find(x => x.id === fid);
            return f ? f.title : fid;
          }),
        })),
        totalCount: inv.correlations.length,
      };
    }

    _generateTimeline(inv, isFr) {
      // Collect all dated events
      const events = [];

      // Investigation creation
      events.push({
        date: inv.createdAt,
        type: 'investigation',
        label: isFr ? 'Création de l\'investigation' : 'Investigation created',
      });

      // Indicators added
      for (const ind of inv.indicators) {
        events.push({
          date: ind.addedAt,
          type: 'indicator',
          label: isFr ? `Indice ajouté : ${ind.value}` : `Indicator added: ${ind.value}`,
        });
      }

      // Findings with content dates
      for (const finding of inv.findings) {
        if (finding.dateOfContent) {
          events.push({
            date: finding.dateOfContent,
            type: 'content',
            label: finding.title,
            isContentDate: true,
          });
        }
      }

      // Source completions
      for (const source of inv.sources) {
        if (source.completedAt) {
          events.push({
            date: source.completedAt,
            type: 'source',
            label: isFr
              ? `Source interrogée : ${source.toolName} (${source.status})`
              : `Source queried: ${source.toolName} (${source.status})`,
          });
        }
      }

      events.sort((a, b) => new Date(a.date) - new Date(b.date));

      return {
        title: isFr ? 'Chronologie' : 'Timeline',
        events,
      };
    }

    _generateMethodology(inv, isFr) {
      const completed = inv.sources.filter(s => s.status === 'completed');
      const failed = inv.sources.filter(s => s.status === 'failed');
      const skipped = inv.sources.filter(s => s.status === 'skipped');
      const manual = inv.sources.filter(s => s.status === 'manual');

      return {
        title: isFr ? 'Méthodologie et couverture' : 'Methodology & Coverage',
        toolsUsed: completed.map(s => ({
          name: s.toolName,
          url: s.toolUrl,
          automated: s.automated,
          resultCount: s.resultCount || 0,
        })),
        toolsFailed: failed.map(s => ({
          name: s.toolName,
          error: s.error,
        })),
        toolsSkipped: skipped.map(s => ({ name: s.toolName })),
        toolsManual: manual.map(s => ({ name: s.toolName, url: s.toolUrl })),
        indicatorsSearched: inv.indicators.map(i => ({
          type: i.type,
          value: i.value,
        })),
        disclaimers: [
          isFr
            ? 'Les résultats sont limités aux sources publiques interrogées et aux API disponibles au moment de l\'investigation.'
            : 'Results are limited to the public sources queried and APIs available at the time of investigation.',
          isFr
            ? 'Les corrélations automatiques sont des suggestions et doivent être vérifiées par un analyste.'
            : 'Automated correlations are suggestions and must be verified by an analyst.',
          isFr
            ? 'Aucun accès à des comptes privés, données protégées ou sources illégales n\'a été réalisé.'
            : 'No access to private accounts, protected data, or illegal sources was performed.',
        ],
      };
    }

    _generateSourcesSection(inv, isFr) {
      let refNumber = 1;
      const refs = [];

      for (const source of inv.sources.filter(s => s.status === 'completed' || s.status === 'manual')) {
        const sourceFindings = inv.findings.filter(f => f.sourceId === source.id);
        refs.push({
          refNumber: refNumber++,
          sourceName: source.toolName,
          sourceUrl: source.toolUrl,
          consultedAt: source.completedAt || new Date().toISOString(),
          findingsCount: sourceFindings.length,
          excerpts: sourceFindings.filter(f => f.excerpt).map(f => f.excerpt).slice(0, 3),
        });
      }

      return {
        title: isFr ? 'Sources et annexes' : 'Sources & Appendices',
        references: refs,
      };
    }

    _findSourceName(inv, sourceId) {
      if (!sourceId) return 'Manuel';
      const source = inv.sources.find(s => s.id === sourceId);
      return source ? source.toolName : sourceId;
    }

    // ── Export: Markdown ─────────────────────────────────────────────────

    exportMarkdown(report) {
      if (!report) return '';
      const isFr = report.language === 'fr';
      const lines = [];

      lines.push(`# ${isFr ? 'Rapport d\'Investigation OSINT' : 'OSINT Investigation Report'}`);
      lines.push(`**${report.investigation.name}**`);
      lines.push(`${isFr ? 'Généré le' : 'Generated on'}: ${new Date(report.generatedAt).toLocaleString(report.language)}`);
      lines.push('');
      lines.push('---');
      lines.push('');

      // A. Summary
      const summary = report.sections.summary;
      lines.push(`## A. ${summary.title}`);
      lines.push('');
      lines.push(`**${isFr ? 'Objet et périmètre' : 'Object and scope'}:** ${summary.objectAndScope}`);
      lines.push('');
      lines.push(`**${isFr ? 'Indices de départ' : 'Starting indicators'}:**`);
      for (const ind of summary.indicators) {
        lines.push(`- ${ind}`);
      }
      lines.push('');
      lines.push(`**${isFr ? 'Principaux résultats' : 'Key findings'}:** ${summary.keyFindings}`);
      lines.push('');
      lines.push(`**${isFr ? 'Conclusions' : 'Conclusions'}:** ${summary.conclusions}`);
      lines.push('');
      lines.push(`**${isFr ? 'Limites' : 'Limitations'}:** ${summary.limitations}`);
      lines.push('');

      // B. Findings
      const findingsSection = report.sections.findings;
      lines.push(`## B. ${findingsSection.title}`);
      lines.push('');
      lines.push(`${findingsSection.totalCount} ${isFr ? 'élément(s) au total' : 'total element(s)'}`);
      lines.push('');

      for (const group of findingsSection.groups) {
        lines.push(`### ${group.icon} ${group.label}`);
        lines.push('');
        for (const item of group.items) {
          const conf = CONFIDENCE_LEVELS[item.confidence];
          const confLabel = conf ? (isFr ? conf.label_fr : conf.label_en) : item.confidence;
          lines.push(`- **${item.title}** [${confLabel}]`);
          if (item.content) lines.push(`  ${item.content}`);
          if (item.url) lines.push(`  🔗 ${item.url}`);
          if (item.sourceName) lines.push(`  ${isFr ? 'Source' : 'Source'}: ${item.sourceName}`);
          if (item.dateFound) lines.push(`  ${isFr ? 'Consulté le' : 'Retrieved on'}: ${new Date(item.dateFound).toLocaleString(report.language)}`);
          lines.push('');
        }
      }

      // C. Correlations
      const corrSection = report.sections.correlations;
      lines.push(`## C. ${corrSection.title}`);
      lines.push('');
      if (corrSection.items.length === 0) {
        lines.push(isFr ? '_Aucune corrélation identifiée._' : '_No correlations identified._');
      } else {
        for (const item of corrSection.items) {
          lines.push(`- **${item.type}** [${item.confidenceLabel}]`);
          lines.push(`  ${item.justification}`);
          lines.push(`  ${isFr ? 'Éléments liés' : 'Related findings'}: ${item.relatedFindings.join(', ')}`);
          if (item.validatedByUser === true) lines.push(`  ✅ ${isFr ? 'Validé par l\'analyste' : 'Validated by analyst'}`);
          if (item.validatedByUser === false) lines.push(`  ❌ ${isFr ? 'Écarté par l\'analyste' : 'Dismissed by analyst'}`);
          lines.push('');
        }
      }

      // D. Timeline
      const timeline = report.sections.timeline;
      lines.push(`## D. ${timeline.title}`);
      lines.push('');
      for (const evt of timeline.events) {
        const dateStr = new Date(evt.date).toLocaleString(report.language);
        const tag = evt.isContentDate ? (isFr ? '[Date du contenu]' : '[Content date]') : '';
        lines.push(`- **${dateStr}** ${tag} — ${evt.label}`);
      }
      lines.push('');

      // E. Methodology
      const method = report.sections.methodology;
      lines.push(`## E. ${method.title}`);
      lines.push('');
      lines.push(`### ${isFr ? 'Outils utilisés' : 'Tools used'}`);
      for (const tool of method.toolsUsed) {
        lines.push(`- ${tool.name} (${tool.automated ? (isFr ? 'automatique' : 'automated') : (isFr ? 'manuel' : 'manual')}) — ${tool.resultCount} ${isFr ? 'résultat(s)' : 'result(s)'}`);
      }
      lines.push('');
      if (method.toolsFailed.length > 0) {
        lines.push(`### ${isFr ? 'Sources en échec' : 'Failed sources'}`);
        for (const tool of method.toolsFailed) {
          lines.push(`- ❌ ${tool.name}: ${tool.error}`);
        }
        lines.push('');
      }
      lines.push(`### ${isFr ? 'Avertissements' : 'Disclaimers'}`);
      for (const d of method.disclaimers) {
        lines.push(`> ${d}`);
        lines.push('');
      }

      // F. Sources
      const sourcesSection = report.sections.sources;
      lines.push(`## F. ${sourcesSection.title}`);
      lines.push('');
      for (const ref of sourcesSection.references) {
        lines.push(`[${ref.refNumber}] **${ref.sourceName}** — ${ref.sourceUrl}`);
        lines.push(`  ${isFr ? 'Consulté le' : 'Retrieved on'}: ${new Date(ref.consultedAt).toLocaleString(report.language)} — ${ref.findingsCount} ${isFr ? 'résultat(s)' : 'result(s)'}`);
        if (ref.excerpts.length > 0) {
          lines.push(`  ${isFr ? 'Extraits' : 'Excerpts'}:`);
          for (const excerpt of ref.excerpts) {
            lines.push(`  > ${excerpt}`);
          }
        }
        lines.push('');
      }

      lines.push('---');
      lines.push(`*${isFr ? 'Rapport généré par AAA_OSINT Investigation Module' : 'Report generated by AAA_OSINT Investigation Module'}*`);

      return lines.join('\n');
    }

    // ── Export: HTML ─────────────────────────────────────────────────────

    exportHTML(report) {
      const md = this.exportMarkdown(report);
      // Convert basic Markdown to HTML
      let html = md
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/🔗 (https?:\/\/[^\s<]+)/g, '🔗 <a href="$1" target="_blank" rel="noopener">$1</a>')
        .replace(/^---$/gm, '<hr>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

      return `<!DOCTYPE html>
<html lang="${report.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.investigation.name} — AAA_OSINT Report</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; background: #0a0e16; color: #f1f5f9; line-height: 1.7; }
    h1 { color: #00e5ff; border-bottom: 2px solid #00e5ff; padding-bottom: 0.5rem; }
    h2 { color: #00e5ff; margin-top: 2rem; }
    h3 { color: #94a3b8; }
    a { color: #00e5ff; }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 2rem 0; }
    blockquote { border-left: 3px solid #00e5ff; padding-left: 1rem; color: #94a3b8; margin: 0.5rem 0; }
    li { margin-left: 1.5rem; margin-bottom: 0.3rem; }
    strong { color: #f1f5f9; }
    @media print { body { background: white; color: #1a1a1a; } h1, h2 { color: #0066cc; } a { color: #0066cc; } blockquote { color: #555; } }
  </style>
</head>
<body>
<p>${html}</p>
</body>
</html>`;
    }

    exportToMarkdown(report) {
      return this.exportMarkdown(report);
    }

    exportToHTML(report) {
      return this.exportHTML(report);
    }

    // ── Persistence (via server API) ────────────────────────────────────

    async saveInvestigation(investigation) {
      try {
        const res = await fetch(this.apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(investigation),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn('Failed to save investigation to server, using localStorage fallback:', err.message);
        return this._saveToLocalStorage(investigation);
      }
    }

    async loadInvestigation(id) {
      try {
        const res = await fetch(`${this.apiBase}/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn('Failed to load from server, trying localStorage:', err.message);
        return this._loadFromLocalStorage(id);
      }
    }

    async listInvestigations() {
      try {
        const res = await fetch(`${this.apiBase}s`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn('Failed to list from server, using localStorage:', err.message);
        return this._listFromLocalStorage();
      }
    }

    async deleteInvestigation(id) {
      try {
        const res = await fetch(`${this.apiBase}/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this._removeFromLocalStorage(id);
        return true;
      } catch (err) {
        console.warn('Failed to delete from server:', err.message);
        this._removeFromLocalStorage(id);
        return true;
      }
    }

    // ── LocalStorage Fallback ───────────────────────────────────────────

    _saveToLocalStorage(investigation) {
      try {
        const list = JSON.parse(localStorage.getItem('aaa_investigations_index') || '[]');
        const existing = list.findIndex(i => i.id === investigation.id);
        const meta = {
          id: investigation.id,
          name: investigation.name,
          status: investigation.status,
          createdAt: investigation.createdAt,
          updatedAt: investigation.updatedAt,
          indicatorCount: investigation.indicators.length,
          findingsCount: investigation.findings.length,
        };
        if (existing >= 0) {
          list[existing] = meta;
        } else {
          list.unshift(meta);
        }
        localStorage.setItem('aaa_investigations_index', JSON.stringify(list));
        localStorage.setItem(`aaa_investigation_${investigation.id}`, JSON.stringify(investigation));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    _loadFromLocalStorage(id) {
      try {
        const data = localStorage.getItem(`aaa_investigation_${id}`);
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    }

    _listFromLocalStorage() {
      try {
        return JSON.parse(localStorage.getItem('aaa_investigations_index') || '[]');
      } catch {
        return [];
      }
    }

    _removeFromLocalStorage(id) {
      try {
        const list = JSON.parse(localStorage.getItem('aaa_investigations_index') || '[]');
        const filtered = list.filter(i => i.id !== id);
        localStorage.setItem('aaa_investigations_index', JSON.stringify(filtered));
        localStorage.removeItem(`aaa_investigation_${id}`);
      } catch { /* ignore */ }
    }
  }

  // ── Export Constants for use by UI ─────────────────────────────────────

  InvestigationEngine.INDICATOR_TYPES = INDICATOR_TYPES;
  InvestigationEngine.INDICATOR_CATEGORY_MAP = INDICATOR_CATEGORY_MAP;
  InvestigationEngine.FINDING_TYPES = FINDING_TYPES;
  InvestigationEngine.CONFIDENCE_LEVELS = CONFIDENCE_LEVELS;

  return InvestigationEngine;
});
