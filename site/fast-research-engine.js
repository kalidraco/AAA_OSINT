/**
 * AAA_OSINT — Fast Research Execution Engine
 *
 * Priorité absolue : Vitesse maximale & volume de collecte réelle en parallèle.
 * - Détection universelle de l'indicateur (15 types)
 * - Sélection stricte des sources automatisées compatibles
 * - Exécution concurrente non-bloquante avec streaming de chaque résultat au fil de l'eau
 * - Calcul des latences en millisecondes par source
 * - Zéro dépendance externe
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FastResearchEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 15 Normalized Entity Types
  const INDICATOR_TYPES = {
    DOMAIN: { id: 'domain', type: 'domain', label: 'Nom de domaine', icon: '🌐', category: 'infra' },
    SUBDOMAIN: { id: 'subdomain', type: 'subdomain', label: 'Sous-domaine', icon: '🌐', category: 'infra' },
    IP: { id: 'ip', type: 'ip', label: 'Adresse IPv4/IPv6', icon: '🖥️', category: 'infra' },
    EMAIL: { id: 'email', type: 'email', label: 'Adresse E-mail', icon: '📧', category: 'identity' },
    USERNAME: { id: 'username', type: 'username', label: 'Pseudonyme / Handle', icon: '👤', category: 'identity' },
    URL: { id: 'url', type: 'url', label: 'URL Web', icon: '🔗', category: 'web' },
    PHONE: { id: 'phone', type: 'phone', label: 'Numéro de Téléphone', icon: '📱', category: 'identity' },
    CRYPTO: { id: 'crypto', type: 'crypto', label: 'Portefeuille Crypto', icon: '🪙', category: 'crypto' },
    HASH: { id: 'hash', type: 'hash', label: 'Empreinte Cryptographique', icon: '🔑', category: 'malware' },
    COMPANY: { id: 'company', type: 'company', label: 'Entreprise / Société', icon: '🏢', category: 'legal' },
    ORG: { id: 'company', type: 'company', label: 'Entreprise / Organisation', icon: '🏢', category: 'legal' },
    SIREN: { id: 'siren', type: 'siren', label: 'SIREN / SIRET (Entreprise FR)', icon: '🏛️', category: 'legal' },
    PERSON: { id: 'person', type: 'person', label: 'Personne physique (Nom)', icon: '🧑', category: 'identity' },
    FILE: { id: 'file', type: 'file', label: 'Fichier / Image', icon: '📁', category: 'file' },
    TEXT: { id: 'text', type: 'text', label: 'Mots-clés / Texte libre', icon: '🔍', category: 'general' },
  };

  class FastResearchEngine {
    constructor(options = {}) {
      this.apiBase = options.apiBase || '';
      this.useMock = !!options.useMock;
      this.perSourceTimeout = options.perSourceTimeout || 3500;
      this.activeController = null;
      this.isRunning = false;
      this.results = [];
      this.stats = {
        totalSources: 0,
        completed: 0,
        successCount: 0,
        emptyCount: 0,
        errorCount: 0,
        firstResultMs: null,
        totalDurationMs: 0,
      };
    }

    /**
     * Auto-detect the primary type of a raw indicator string
     */
    detectType(input) {
      if (!input || typeof input !== 'string') return INDICATOR_TYPES.TEXT;
      const val = input.trim();

      // Email
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)) {
        return INDICATOR_TYPES.EMAIL;
      }
      // URL
      if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(val)) {
        return INDICATOR_TYPES.URL;
      }
      // IPv4
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(val)) {
        const parts = val.split('.').map(Number);
        if (parts.every(p => p >= 0 && p <= 255)) return INDICATOR_TYPES.IP;
      }
      // IPv6
      if (/^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$/.test(val) || /^::1$/.test(val) || /^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/.test(val)) {
        return INDICATOR_TYPES.IP;
      }
      // Crypto address (BTC, ETH, TRX)
      if (/^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{8,87})$/i.test(val) ||
          /^0x[a-fA-F0-9]{40}$/.test(val) ||
          /^T[a-zA-Z0-9]{33}$/.test(val)) {
        return INDICATOR_TYPES.CRYPTO;
      }
      // Hashes
      if (/^[a-fA-F0-9]{32}$/.test(val) || /^[a-fA-F0-9]{40}$/.test(val) || /^[a-fA-F0-9]{64}$/.test(val)) {
        return INDICATOR_TYPES.HASH;
      }
      // SIREN / SIRET (9 or 14 digits)
      const cleanDigits = val.replace(/\s+/g, '');
      if (/^\d{9}$/.test(cleanDigits) || /^\d{14}$/.test(cleanDigits)) {
        return INDICATOR_TYPES.SIREN;
      }
      // Domain & Subdomain
      if (/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(val)) {
        const parts = val.split('.');
        if (parts.length > 2) {
          return INDICATOR_TYPES.SUBDOMAIN;
        }
        return INDICATOR_TYPES.DOMAIN;
      }
      // Phone
      if (/^\+?[0-9\s\-().]{8,20}$/.test(val) && (val.startsWith('+') || /^0[1-9]/.test(val))) {
        return INDICATOR_TYPES.PHONE;
      }
      // Company keywords (SAS, SARL, INC, LLC, GMBH, CORP, SA, LTD)
      if (/\b(sas|sarl|inc|llc|gmbh|corp|sa|ltd|eurl|fondation|association|corporation)\b/i.test(val)) {
        return INDICATOR_TYPES.COMPANY;
      }
      // Person name (Two or more capitalized names, e.g. "Jean Dupont")
      if (/^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+(\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+)+$/.test(val)) {
        return INDICATOR_TYPES.PERSON;
      }
      // Username (@handle or single alphanumeric word)
      if (/^@[a-zA-Z0-9_.-]{2,30}$/.test(val) || /^[a-zA-Z0-9_-]{3,24}$/.test(val)) {
        return INDICATOR_TYPES.USERNAME;
      }

      return INDICATOR_TYPES.TEXT;
    }

    /**
     * Alias for detectType
     */
    detectIndicatorType(input) {
      return this.detectType(input);
    }

    /**
     * Map compatible automated sources for a given indicator
     */
    getSourcesForIndicator(indicator, typeId) {
      const clean = String(indicator || '').trim();
      const sources = [];

      const cleanDomain = clean.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
      const cleanUsername = clean.replace(/^@/, '');

      // Helper to do safe fetch with timeout and optional mock header
      const fetchWithTimeout = async (url, timeoutMs = this.perSourceTimeout) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const headers = { 'Accept': 'application/json' };
          if (this.useMock) {
            headers['x-fast-search-mock'] = 'true';
          }
          const res = await fetch(url, {
            signal: controller.signal,
            headers,
          });
          clearTimeout(timer);
          return res;
        } catch (err) {
          clearTimeout(timer);
          throw err;
        }
      };

      // ── DOMAIN & SUBDOMAIN SOURCES ───────────────────────────────────────────
      if (typeId === 'domain' || typeId === 'subdomain' || typeId === 'url') {
        sources.push({
          id: 'dns_resolution',
          name: 'Résolution DNS (A, AAAA, MX, TXT, NS, SOA)',
          category: 'Infrastructure',
          icon: '⚡',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/dns?domain=${encodeURIComponent(cleanDomain)}`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Échec DNS');
            const totalRecords = (data.records.A?.length || 0) + (data.records.MX?.length || 0) + (data.records.TXT?.length || 0) + (data.records.NS?.length || 0);
            return {
              status: totalRecords > 0 ? 'success' : 'empty',
              title: `DNS : ${totalRecords} enregistrements résolus`,
              summary: [
                data.records.A?.length ? `A: ${data.records.A.join(', ')}` : null,
                data.records.MX?.length ? `MX: ${data.records.MX.map(m => m.exchange).join(', ')}` : null,
                data.records.NS?.length ? `NS: ${data.records.NS.join(', ')}` : null,
                data.records.TXT?.length ? `TXT: ${data.records.TXT.length} enregistrements` : null,
              ].filter(Boolean).join(' · '),
              data: data.records,
              sourceUrl: `https://viewdns.info/dnsrecord/?domain=${encodeURIComponent(cleanDomain)}`,
            };
          },
        });

        sources.push({
          id: 'crtsh_subdomains',
          name: 'Certificats SSL & Sous-domaines (crt.sh)',
          category: 'Infrastructure',
          icon: '📜',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/certs?domain=${encodeURIComponent(cleanDomain)}`, 5000);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Erreur crt.sh');
            const count = data.subdomains?.length || 0;
            return {
              status: count > 0 ? 'success' : 'empty',
              title: `Certificats SSL : ${count} sous-domaines découverts`,
              summary: count > 0 ? data.subdomains.slice(0, 8).join(', ') + (count > 8 ? ` (+${count - 8} autres)` : '') : 'Aucun sous-domaine répertorié',
              data: data.subdomains || [],
              sourceUrl: `https://crt.sh/?q=%.${encodeURIComponent(cleanDomain)}`,
            };
          },
        });

        sources.push({
          id: 'http_headers',
          name: 'En-têtes Web & Stack Serveur',
          category: 'Web',
          icon: '🌐',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/http-headers?target=${encodeURIComponent(cleanDomain)}`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Serveur web inaccessible');
            const secCount = Object.keys(data.securityHeaders || {}).length;
            return {
              status: 'success',
              title: `Serveur Web : ${data.server || 'Serveur actif'} (HTTP ${data.statusCode})`,
              summary: `Titre : "${data.title || 'N/A'}" · Sécurité : ${secCount} en-têtes actifs${data.poweredBy ? ' · Stack : ' + data.poweredBy : ''}`,
              data: data,
              sourceUrl: data.url || `https://${cleanDomain}`,
            };
          },
        });

        sources.push({
          id: 'wayback_history',
          name: 'Archives Web (Wayback Machine)',
          category: 'Archivage',
          icon: '🗄️',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/wayback?url=${encodeURIComponent(cleanDomain)}`);
            const data = await res.json();
            const count = data.snapshots?.length || 0;
            return {
              status: count > 0 ? 'success' : 'empty',
              title: `Wayback Machine : ${count} captures historiques trouvées`,
              summary: count > 0 ? `Dernière capture : ${data.snapshots[0].timestamp} (${data.snapshots[0].statuscode})` : 'Aucune archive publique',
              data: data.snapshots || [],
              sourceUrl: `https://web.archive.org/web/*/${cleanDomain}`,
            };
          },
        });

        sources.push({
          id: 'threat_check',
          name: 'Réputation & Détection Malware (URLhaus)',
          category: 'Sécurité & Menaces',
          icon: '🛡️',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/threat-check?target=${encodeURIComponent(cleanDomain)}`);
            const data = await res.json();
            const isMalicious = data.threatLevel === 'malicious';
            return {
              status: 'success',
              title: isMalicious ? `⚠️ Alerte Malware : ${data.urlCount} URL malveillantes détectées` : 'Réputation : Aucune menace active connue',
              summary: isMalicious ? `Signalé sur URLhaus (${data.urlCount} URLs compromises)` : 'Non répertorié dans les bases d\'attaques actives',
              data: data,
              sourceUrl: data.sourceUrl,
            };
          },
        });

        sources.push({
          id: 'rdap',
          name: 'Enregistrement Domaine RDAP / WHOIS',
          category: 'Infrastructure',
          icon: '📋',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/rdap?query=${encodeURIComponent(cleanDomain)}&type=domain`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Erreur RDAP');
            const reg = data.rdap?.registrar || 'N/A';
            return {
              status: 'success',
              title: `WHOIS / RDAP : Registrar ${reg}`,
              summary: `Créé : ${data.rdap?.events?.registration || 'N/A'} · Expire : ${data.rdap?.events?.expiration || 'N/A'}`,
              data: data.rdap,
              sourceUrl: `https://whois.domaintools.com/${encodeURIComponent(cleanDomain)}`,
            };
          },
        });
      }

      // ── IP ADDRESS SOURCES ───────────────────────────────────────────
      if (typeId === 'ip') {
        sources.push({
          id: 'shodan_internetdb',
          name: 'Shodan InternetDB (Ports & Vulnérabilités CVE)',
          category: 'Sécurité & Infra',
          icon: '🛡️',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/shodan-ip?ip=${encodeURIComponent(clean)}`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Erreur Shodan');
            const ports = data.ports || [];
            const vulns = data.vulns || [];
            return {
              status: data.found ? 'success' : 'empty',
              title: data.found ? `Shodan : ${ports.length} ports ouverts, ${vulns.length} CVEs` : 'Shodan : Aucun port public indexé',
              summary: data.found ? `Ports : ${ports.join(', ')} · Hostnames : ${data.hostnames?.join(', ') || 'N/A'}${vulns.length ? ' · Vulns : ' + vulns.slice(0, 3).join(', ') : ''}` : 'IP non référencée dans InternetDB',
              data: data,
              sourceUrl: data.sourceUrl || `https://www.shodan.io/host/${encodeURIComponent(clean)}`,
            };
          },
        });

        sources.push({
          id: 'threat_check',
          name: 'Réputation IP & Menaces Actives (URLhaus)',
          category: 'Sécurité & Menaces',
          icon: '🚨',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/threat-check?target=${encodeURIComponent(clean)}`);
            const data = await res.json();
            const isMalicious = data.threatLevel === 'malicious';
            return {
              status: 'success',
              title: isMalicious ? `⚠️ Menaces détectées : ${data.urlCount} URLs actives` : 'Réputation IP : Aucune menace connue',
              summary: isMalicious ? `Signalé sur URLhaus (${data.urlCount} URLs malveillantes associées)` : 'Non listé dans les flux d\'attaques récentes',
              data: data,
              sourceUrl: data.sourceUrl,
            };
          },
        });

        sources.push({
          id: 'rdns_ptr',
          name: 'Reverse DNS PTR',
          category: 'Infrastructure',
          icon: '🔄',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/rdns?ip=${encodeURIComponent(clean)}`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Aucun PTR');
            const count = data.hostnames?.length || 0;
            return {
              status: count > 0 ? 'success' : 'empty',
              title: `Reverse DNS : ${count} nom(s) d'hôte(s) résolu(s)`,
              summary: count > 0 ? data.hostnames.join(', ') : 'Aucun enregistrement PTR associé',
              data: data.hostnames || [],
              sourceUrl: `https://viewdns.info/reverseip/?host=${encodeURIComponent(clean)}`,
            };
          },
        });

        sources.push({
          id: 'rdap',
          name: 'Allocation Réseau & Opérateur (RDAP)',
          category: 'Infrastructure',
          icon: '🏢',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/rdap?query=${encodeURIComponent(clean)}&type=ip`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Erreur RDAP IP');
            const net = data.rdap?.network || {};
            return {
              status: 'success',
              title: `Réseau : ${net.name || 'Inconnu'} (${net.country || 'N/A'})`,
              summary: `Plage : ${net.startAddress || ''} - ${net.endAddress || ''} · CIDR : ${net.cidr?.join(', ') || 'N/A'}`,
              data: data.rdap,
              sourceUrl: `https://bgp.he.net/ip/${encodeURIComponent(clean)}`,
            };
          },
        });
      }

      // ── EMAIL SOURCES ───────────────────────────────────────────
      if (typeId === 'email') {
        const emailDomain = clean.split('@')[1] || '';
        sources.push({
          id: 'email_domain_dns',
          name: 'Vérification Serveurs Mail MX (Domaine E-mail)',
          category: 'Infrastructure',
          icon: '📫',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/dns?domain=${encodeURIComponent(emailDomain)}`);
            const data = await res.json();
            const mx = data.records?.MX || [];
            return {
              status: mx.length > 0 ? 'success' : 'empty',
              title: `Serveurs Mail : ${mx.length} serveurs MX détectés`,
              summary: mx.length > 0 ? mx.map(m => m.exchange).join(', ') : 'Aucun serveur MX configuré pour ce domaine',
              data: mx,
              sourceUrl: `https://mxtoolbox.com/SuperTool.aspx?action=mx%3a${encodeURIComponent(emailDomain)}`,
            };
          },
        });

        sources.push({
          id: 'account_recon',
          name: 'Profils Publics Dérivés du Handle Email',
          category: 'Identité',
          icon: '👤',
          run: async () => {
            const emailUser = clean.split('@')[0] || '';
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/account-recon?username=${encodeURIComponent(emailUser)}`);
            const data = await res.json();
            const count = data.accounts?.length || 0;
            return {
              status: count > 0 ? 'success' : 'empty',
              title: `Reconnaissance Pseudonyme : ${count} compte(s) potentiel(s)`,
              summary: count > 0 ? data.accounts.map(a => `${a.platform} (${a.username})`).join(', ') : 'Aucun compte public direct trouvé',
              data: data.accounts || [],
              sourceUrl: `https://github.com/${encodeURIComponent(emailUser)}`,
            };
          },
        });
      }

      // ── USERNAME / HANDLE SOURCES ───────────────────────────────────────────
      if (typeId === 'username') {
        sources.push({
          id: 'account_recon',
          name: 'Reconnaissance Multi-Plateformes (GitHub, Reddit, HN, Keybase)',
          category: 'Identité',
          icon: '🐙',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/account-recon?username=${encodeURIComponent(cleanUsername)}`);
            const data = await res.json();
            const count = data.accounts?.length || 0;
            return {
              status: count > 0 ? 'success' : 'empty',
              title: `Comptes Publics : ${count} plateforme(s) active(s)`,
              summary: count > 0 ? data.accounts.map(a => `${a.platform}${a.name ? ' (' + a.name + ')' : ''}`).join(' · ') : 'Aucun profil public trouvé',
              data: data.accounts || [],
              sourceUrl: data.accounts?.[0]?.url || `https://github.com/${encodeURIComponent(cleanUsername)}`,
            };
          },
        });

        sources.push({
          id: 'knowledge_search',
          name: 'Encyclopédie & Notoriété Publique (Wikipedia)',
          category: 'Entité',
          icon: '📖',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/knowledge-search?query=${encodeURIComponent(cleanUsername)}`);
            const data = await res.json();
            return {
              status: data.found ? 'success' : 'empty',
              title: data.found ? `Wikidata / Wikipedia : ${data.title}` : 'Aucune entrée encyclopédique',
              summary: data.snippet || 'Aucun article encyclopédique correspondant',
              data: data,
              sourceUrl: data.officialUrl || data.sourceUrl,
            };
          },
        });
      }

      // ── COMPANY / ORGANISATION & SIREN SOURCES ───────────────────────────────────────────
      if (typeId === 'company' || typeId === 'org' || typeId === 'siren') {
        sources.push({
          id: 'company_fr',
          name: 'Registre Officiel des Entreprises (RNE / Insee)',
          category: 'Légal & Entreprises',
          icon: '🏛️',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/company-fr?query=${encodeURIComponent(clean)}`);
            const data = await res.json();
            const count = data.companies?.length || 0;
            return {
              status: count > 0 ? 'success' : 'empty',
              title: count > 0 ? `Registre Entreprises : ${data.companies[0].nom} (SIREN ${data.companies[0].siren})` : 'Aucune entreprise trouvée',
              summary: count > 0 ? `${data.companies[0].adresse} · ${data.companies[0].activite}` : 'Non répertorié au RNE/Insee',
              data: data.companies || [],
              sourceUrl: data.companies?.[0]?.sourceUrl || data.sourceUrl,
            };
          },
        });

        sources.push({
          id: 'knowledge_search',
          name: 'Base de Connaissances & Notoriété (Wikipedia)',
          category: 'Entité & Notoriété',
          icon: '🌐',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/knowledge-search?query=${encodeURIComponent(clean)}`);
            const data = await res.json();
            return {
              status: data.found ? 'success' : 'empty',
              title: data.found ? `Entité reconnue : ${data.title}` : 'Aperçu : Aucun résultat immédiat',
              summary: data.snippet || 'Aucune fiche de synthèse disponible',
              data: data,
              sourceUrl: data.officialUrl || data.sourceUrl,
            };
          },
        });
      }

      // ── PERSON & TEXT SOURCES ───────────────────────────────────────────
      if (typeId === 'person' || typeId === 'text') {
        sources.push({
          id: 'knowledge_search',
          name: 'Encyclopédie & Notoriété Publique (Wikipedia / DuckDuckGo)',
          category: 'Entité & Notoriété',
          icon: '📖',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/knowledge-search?query=${encodeURIComponent(clean)}`);
            const data = await res.json();
            return {
              status: data.found ? 'success' : 'empty',
              title: data.found ? `Wikidata / Wikipedia : ${data.title}` : 'Aucune entrée encyclopédique',
              summary: data.snippet || 'Aucun article encyclopédique correspondant',
              data: data,
              sourceUrl: data.officialUrl || data.sourceUrl,
            };
          },
        });

        sources.push({
          id: 'company_fr',
          name: 'Recherche Dirigeants & Entreprises (RNE / Insee)',
          category: 'Légal & Entreprises',
          icon: '🏛️',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/company-fr?query=${encodeURIComponent(clean)}`);
            const data = await res.json();
            const count = data.companies?.length || 0;
            return {
              status: count > 0 ? 'success' : 'empty',
              title: count > 0 ? `Entreprises / Mandats : ${data.companies[0].nom} (SIREN ${data.companies[0].siren})` : 'Aucun mandat ou entreprise trouvée',
              summary: count > 0 ? `${data.companies[0].adresse} · ${data.companies[0].activite}` : 'Non répertorié au registre',
              data: data.companies || [],
              sourceUrl: data.companies?.[0]?.sourceUrl || data.sourceUrl,
            };
          },
        });
      }

      // ── CRYPTO WALLET SOURCES ───────────────────────────────────────────
      if (typeId === 'crypto') {
        sources.push({
          id: 'crypto_balance',
          name: 'Solde & Transactions Blockchain (Mempool / Explorateurs)',
          category: 'Cryptomonnaies',
          icon: '🪙',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/crypto-balance?address=${encodeURIComponent(clean)}`);
            const data = await res.json();
            return {
              status: 'success',
              title: `${data.type} : ${data.supportedLiveBalance ? `${data.balanceBtc} BTC (${data.txCount} txs)` : 'Adresse valide'}`,
              summary: data.supportedLiveBalance ? `Solde en direct : ${data.balanceBtc} BTC · ${data.txCount} transactions enregistrées` : `Format vérifié (${data.type})`,
              data: data,
              sourceUrl: data.sourceUrl,
            };
          },
        });
      }

      // ── HASH SOURCES ───────────────────────────────────────────
      if (typeId === 'hash') {
        sources.push({
          id: 'hash_lookup',
          name: 'Base de Signatures Malware & Hashes (CIRCL Hashlookup)',
          category: 'Sécurité & Menaces',
          icon: '🔑',
          run: async () => {
            const res = await fetchWithTimeout(`${this.apiBase}/api/fast-search/hash-lookup?hash=${encodeURIComponent(clean)}`);
            const data = await res.json();
            return {
              status: data.known ? 'success' : 'empty',
              title: data.known ? `Fichier identifié : ${data.fileName || 'Connu'}` : 'Hash non répertorié dans CIRCL',
              summary: data.known ? `Taille : ${data.fileSize} octets · Fichier répertorié` : 'Empreinte absente des bases de signatures publiques',
              data: data,
              sourceUrl: data.sourceUrl,
            };
          },
        });
      }

      return sources;
    }

    /**
     * Helper to get sources for a given type ID
     */
    getSourcesForType(typeId) {
      return this.getSourcesForIndicator('', typeId);
    }

    /**
     * Launch parallel streaming research across all compatible sources
     */
    async execute(indicator, callbacks = {}) {
      const clean = String(indicator || '').trim();
      if (!clean) return { results: [], stats: this.stats };

      const detected = this.detectType(clean);
      const sources = this.getSourcesForIndicator(clean, detected.id);

      this.isRunning = true;
      this.activeController = new AbortController();
      this.results = [];
      this.stats = {
        indicator: clean,
        type: detected,
        totalSources: sources.length,
        completed: 0,
        successCount: 0,
        emptyCount: 0,
        errorCount: 0,
        firstResultMs: null,
        totalDurationMs: 0,
      };

      const startTime = performance.now();

      if (callbacks.onStart) {
        callbacks.onStart({
          indicator: clean,
          query: clean,
          type: detected.id,
          totalSources: sources.length,
        });
      }

      // Execute all sources in parallel
      const tasks = sources.map(async (source) => {
        const sourceStart = performance.now();
        let resultItem = null;

        try {
          const outcome = await source.run();
          const latencyMs = Math.round(performance.now() - sourceStart);

          resultItem = {
            id: source.id,
            sourceId: source.id,
            sourceName: source.name,
            category: source.category,
            icon: source.icon,
            status: outcome.status || 'success',
            title: outcome.title || source.name,
            summary: outcome.summary || '',
            data: outcome.data,
            sourceUrl: outcome.sourceUrl || '',
            timestamp: new Date().toISOString(),
            latencyMs,
            indicator: clean,
          };
        } catch (err) {
          const latencyMs = Math.round(performance.now() - sourceStart);
          resultItem = {
            id: source.id,
            sourceId: source.id,
            sourceName: source.name,
            category: source.category,
            icon: source.icon,
            status: 'error',
            title: `Échec : ${source.name}`,
            summary: err.message || 'Erreur réseau ou délai d\'attente dépassé',
            data: null,
            sourceUrl: '',
            timestamp: new Date().toISOString(),
            latencyMs,
            indicator: clean,
          };
        }

        // Update stats
        this.stats.completed++;
        if (resultItem.status === 'success') this.stats.successCount++;
        else if (resultItem.status === 'empty') this.stats.emptyCount++;
        else if (resultItem.status === 'error') this.stats.errorCount++;

        if (this.stats.firstResultMs === null && resultItem.status === 'success') {
          this.stats.firstResultMs = Math.round(performance.now() - startTime);
        }

        this.results.push(resultItem);

        // STREAM RESULT IMMEDIATELY
        if (callbacks.onResult) {
          callbacks.onResult(resultItem, { ...this.stats });
        }

        if (callbacks.onProgress) {
          callbacks.onProgress({
            completedSources: this.stats.completed,
            totalSources: this.stats.totalSources,
            completed: this.stats.completed,
            total: this.stats.totalSources,
            successCount: this.stats.successCount,
            emptyCount: this.stats.emptyCount,
            errorCount: this.stats.errorCount,
            elapsedMs: Math.round(performance.now() - startTime),
          });
        }

        return resultItem;
      });

      await Promise.allSettled(tasks);

      this.isRunning = false;
      this.stats.totalDurationMs = Math.round(performance.now() - startTime);
      if (this.stats.firstResultMs === null) {
        this.stats.firstResultMs = this.stats.totalDurationMs;
      }

      const summary = {
        results: this.results,
        stats: this.stats,
        query: clean,
        type: detected.id,
        firstResultLatencyMs: this.stats.firstResultMs,
        totalSources: this.stats.totalSources,
        elapsedMs: this.stats.totalDurationMs,
      };

      if (callbacks.onComplete) {
        callbacks.onComplete(summary);
      }

      return summary;
    }

    /**
     * Alias for execute
     */
    async search(indicator, callbacks = {}) {
      return this.execute(indicator, callbacks);
    }

    /**
     * Stop active execution
     */
    abort() {
      if (this.activeController) {
        this.activeController.abort();
        this.activeController = null;
      }
      this.isRunning = false;
    }

    /**
     * Catalog tool pivots for manual browser exploration
     */
    getCatalogPivots(typeId, val) {
      const v = encodeURIComponent(String(val || '').trim());
      const pivots = [];

      if (typeId === 'domain' || typeId === 'subdomain') {
        pivots.push({ name: 'Shodan (Recherche Web)', url: `https://www.shodan.io/search?query=hostname%3A${v}`, cat: 'Cyber & Infra', desc: 'Scan ports et bannières du domaine' });
        pivots.push({ name: 'SecurityTrails', url: `https://securitytrails.com/domain/${v}`, cat: 'Cyber & Infra', desc: 'Historique DNS & sous-domaines' });
        pivots.push({ name: 'VirusTotal (Domain)', url: `https://www.virustotal.com/gui/domain/${v}`, cat: 'Sécurité & Menaces', desc: 'Analyse antivirus multi-moteurs' });
        pivots.push({ name: 'ViewDNS All-in-One', url: `https://viewdns.info/dnsreport/?domain=${v}`, cat: 'Cyber & Infra', desc: 'Rapport complet DNS, MX, propagation' });
        pivots.push({ name: 'URLScan.io', url: `https://urlscan.io/search/#${v}`, cat: 'Sécurité', desc: 'Analyse comportementale et DOM' });
      } else if (typeId === 'ip') {
        pivots.push({ name: 'Shodan Host View', url: `https://www.shodan.io/host/${v}`, cat: 'Cyber & Infra', desc: 'Ports et vulnérabilités détaillées' });
        pivots.push({ name: 'VirusTotal (IP)', url: `https://www.virustotal.com/gui/ip-address/${v}`, cat: 'Sécurité & Menaces', desc: 'Détection malware et menaces' });
        pivots.push({ name: 'AbuseIPDB', url: `https://www.abuseipdb.com/check/${v}`, cat: 'Sécurité & Menaces', desc: 'Signalements d\'attaques et réputation' });
        pivots.push({ name: 'BGPView / Hurricane Electric', url: `https://bgp.he.net/ip/${v}`, cat: 'Réseau', desc: 'Routing BGP et allocations' });
        pivots.push({ name: 'IPInfo.io', url: `https://ipinfo.io/${v}`, cat: 'Géolocalisation', desc: 'Fournisseur d\'accès et géolocalisation' });
      } else if (typeId === 'email') {
        pivots.push({ name: 'Epieos (Email Lookup)', url: `https://epieos.com/?q=${v}`, cat: 'Identité & Personnes', desc: 'Détection Google, Skype, Gravatar' });
        pivots.push({ name: 'Hunter.io (Email Verifier)', url: `https://hunter.io/email-verifier/${v}`, cat: 'Identité & Personnes', desc: 'Délivrabilité et format entreprise' });
        pivots.push({ name: 'Have I Been Pwned', url: `https://haveibeenpwned.com/account/${v}`, cat: 'Fuites & Brèches', desc: 'Vérification brèches de données publiques' });
      } else if (typeId === 'username') {
        pivots.push({ name: 'WhatsMyName.app', url: `https://whatsmyname.app/?q=${v}`, cat: 'Identité & Personnes', desc: 'Recherche sur 500+ plateformes sociales' });
        pivots.push({ name: 'Namechk', url: `https://namechk.com/namechk/?q=${v}`, cat: 'Identité & Personnes', desc: 'Disponibilité des pseudonymes' });
        pivots.push({ name: 'Sherlock (GitHub)', url: `https://github.com/sherlock-project/sherlock`, cat: 'Outils CLI', desc: 'Outil de traçage de pseudos en ligne de commande' });
      } else if (typeId === 'crypto') {
        pivots.push({ name: 'Blockchain.com Explorer', url: `https://www.blockchain.com/explorer/addresses/btc/${v}`, cat: 'Cryptomonnaies', desc: 'Explorateur de blocs et transactions' });
        pivots.push({ name: 'Blockchair Multi-Chain', url: `https://blockchair.com/search?q=${v}`, cat: 'Cryptomonnaies', desc: 'Explorateur de transactions Bitcoin, Ethereum, etc.' });
      } else if (typeId === 'hash') {
        pivots.push({ name: 'VirusTotal (Hash)', url: `https://www.virustotal.com/gui/file/${v}`, cat: 'Sécurité & Menaces', desc: 'Rapport antivirus mondial' });
        pivots.push({ name: 'Hybrid Analysis', url: `https://www.hybrid-analysis.com/search?query=${v}`, cat: 'Sécurité & Menaces', desc: 'Sandbox d\'analyse dynamique' });
      } else {
        pivots.push({ name: 'DuckDuckGo OSINT Search', url: `https://duckduckgo.com/?q=${v}`, cat: 'Moteurs', desc: 'Recherche web sans pistage' });
        pivots.push({ name: 'CyberChef', url: `https://gchq.github.io/CyberChef/#input=${v}`, cat: 'Encodage & Analyse', desc: 'Couteau suisse d\'analyse et décodage' });
      }

      return pivots;
    }

    /**
     * Export collected results to JSON string
     */
    exportJSON(session) {
      const targetStats = session?.stats || this.stats;
      const targetResults = session?.results || this.results;
      const query = session?.query || targetStats.indicator || '';
      return JSON.stringify({
        generator: 'AAA_OSINT Fast Research Engine',
        version: '2.2.0',
        exportedAt: new Date().toISOString(),
        query,
        type: session?.type || targetStats.type?.id || 'general',
        stats: targetStats,
        results: targetResults,
      }, null, 2);
    }

    /**
     * Export collected results to CSV string
     */
    exportCSV(session) {
      const targetStats = session?.stats || this.stats;
      const targetResults = session?.results || this.results;
      const query = session?.query || targetStats.indicator || '';
      const type = session?.type || targetStats.type?.id || 'general';

      const headers = ['Timestamp', 'Query', 'Type', 'Source', 'Status', 'LatencyMs', 'ItemsCount', 'Title', 'Snippet'];
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

      const rows = targetResults.map(r => [
        escape(r.timestamp),
        escape(query),
        escape(type),
        escape(r.sourceName),
        escape(r.status),
        r.latencyMs || 0,
        Array.isArray(r.data) ? r.data.length : (r.data ? 1 : 0),
        escape(r.title),
        escape(r.summary),
      ].join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Export collected results to Markdown Report
     */
    exportMarkdown(session) {
      const stats = session?.stats || this.stats;
      const results = session?.results || this.results;
      const query = session?.query || stats.indicator || '';
      const lines = [
        `# Rapport Fast Research — ${query}`,
        ``,
        `## Synthèse de la collecte`,
        `- **Indice analysé :** \`${query}\``,
        `- **Type d'indice :** ${stats.type?.label || stats.type || 'Indéfini'}`,
        `- **Date de recherche :** ${new Date().toISOString()}`,
        `- **Sources interrogées :** ${stats.totalSources} (${stats.successCount || 0} succès, ${stats.emptyCount || 0} vides, ${stats.errorCount || 0} erreurs)`,
        `- **Temps d'exécution :** ${stats.totalDurationMs || 0} ms`,
        ``,
        `---`,
        ``,
        `### Résumé par source`,
        ``,
      ];

      for (const r of results) {
        const badge = r.status === 'success' ? '🟢 SUCCÈS' : (r.status === 'empty' ? '⚪ AUCUN RÉSULTAT' : '🔴 ERREUR');
        lines.push(`#### ${r.icon || '📌'} ${r.sourceName} — ${badge} (${r.latencyMs || 0}ms)`);
        lines.push(`- **Titre :** ${r.title}`);
        if (r.summary) lines.push(`- **Extrait :** ${r.summary}`);
        if (r.sourceUrl) lines.push(`- **Lien source :** [${r.sourceUrl}](${r.sourceUrl})`);
        lines.push(``);
      }

      return lines.join('\n');
    }
  }

  return FastResearchEngine;
});
