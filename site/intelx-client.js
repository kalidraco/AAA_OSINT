/**
 * AAA_OSINT — Intelligence X Official Client Adapter
 *
 * Implements full interaction with Intelligence X API capabilities:
 * - Asynchronous selector search with progressive polling
 * - Phonebook selector enumeration (domains, emails, URLs)
 * - Safe preview fetching with automatic sensitive data redaction (passwords, secrets)
 * - Client-side API key management (in-memory, sessionStorage, or localStorage)
 * - Selector validation and automatic classification
 * - Robust error handling (401 invalid key, 402 quota exceeded, 429 rate limit)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IntelXClient = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'aaa_intelx_key';
  const STORAGE_TYPE_KEY = 'aaa_intelx_storage_type';
  const API_BASE = '/api/intelx';

  class IntelXClient {
    constructor(options = {}) {
      this.apiBase = options.apiBase || API_BASE;
      this.activeSearchId = null;
      this.isSearchActive = false;
      this.abortController = null;
      this.mockMode = options.mockMode || false;

      // Initialize stored key
      this.apiKey = this.loadStoredApiKey();
    }

    /**
     * Load API key from preferred client storage
     */
    loadStoredApiKey() {
      try {
        const type = localStorage.getItem(STORAGE_TYPE_KEY) || 'session';
        if (type === 'local') {
          return localStorage.getItem(STORAGE_KEY) || '';
        } else {
          return sessionStorage.getItem(STORAGE_KEY) || '';
        }
      } catch (e) {
        return '';
      }
    }

    /**
     * Save API key to specified storage ('session' or 'local')
     */
    setApiKey(key, storageType = 'session') {
      const cleanKey = (key || '').trim();
      this.apiKey = cleanKey;

      try {
        localStorage.setItem(STORAGE_TYPE_KEY, storageType);
        if (storageType === 'local') {
          sessionStorage.removeItem(STORAGE_KEY);
          if (cleanKey) {
            localStorage.setItem(STORAGE_KEY, cleanKey);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
          if (cleanKey) {
            sessionStorage.setItem(STORAGE_KEY, cleanKey);
          } else {
            sessionStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (e) {
        /* storage may be disabled in restricted environments */
      }
      return cleanKey;
    }

    /**
     * Get current configured API key
     */
    getApiKey() {
      return this.apiKey;
    }

    /**
     * Check if an API key is configured in client
     */
    hasApiKey() {
      return Boolean(this.apiKey && this.apiKey.length >= 8);
    }

    /**
     * Clear configured API key
     */
    clearApiKey() {
      this.apiKey = '';
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) { /* ignore */ }
    }

    /**
     * Get masked version of key for display (e.g. "a1b2••••••••7f8e")
     */
    getMaskedKey() {
      if (!this.apiKey) return '';
      if (this.apiKey.length <= 8) return '••••••••';
      return `${this.apiKey.substring(0, 4)}••••••••${this.apiKey.substring(this.apiKey.length - 4)}`;
    }

    /**
     * Get current storage preference
     */
    getStorageType() {
      try {
        return localStorage.getItem(STORAGE_TYPE_KEY) || 'session';
      } catch (e) {
        return 'session';
      }
    }

    /**
     * Prepare HTTP request headers including authentication
     */
    getHeaders() {
      const headers = {
        'Accept': 'application/json',
      };
      if (this.apiKey) {
        headers['x-intelx-key'] = this.apiKey;
      }
      if (this.mockMode) {
        headers['x-intelx-mock'] = 'true';
      }
      return headers;
    }

    /**
     * Automatically detect the OSINT selector type of a query
     */
    detectSelectorType(query) {
      if (!query || typeof query !== 'string') {
        return { type: 'text', label: 'Terme général', icon: '🔍', placeholder: 'Saisissez un sélecteur...' };
      }
      const val = query.trim();

      // Email
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)) {
        return { type: 'email', label: 'Adresse Email', icon: '📧', category: 'Identité & Personnes' };
      }

      // IPv4 / CIDR
      if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(val)) {
        return { type: 'ip', label: val.includes('/') ? 'Plage Réseau CIDR' : 'Adresse IPv4', icon: '🖥️', category: 'Cyber & Infrastructure' };
      }

      // IPv6
      if (/^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$/.test(val)) {
        return { type: 'ip', label: 'Adresse IPv6', icon: '🖥️', category: 'Cyber & Infrastructure' };
      }

      // URL
      if (/^https?:\/\//i.test(val)) {
        return { type: 'url', label: 'Lien / URL Web', icon: '🔗', category: 'Cyber & Web' };
      }

      // Phone (International or local format with at least 7 digits)
      const digitsOnly = val.replace(/\D/g, '');
      if (/^\+?[0-9\s\-().]{7,25}$/.test(val) && digitsOnly.length >= 7 && digitsOnly.length <= 15 && (val.startsWith('+') || /^0[1-9]/.test(val) || val.includes('-') || val.includes('('))) {
        return { type: 'phone', label: 'Numéro de Téléphone', icon: '📱', category: 'Identité & Personnes' };
      }

      // Cryptographic Hash (MD5, SHA1, SHA256)
      if (/^[a-fA-F0-9]{32}$/.test(val)) {
        return { type: 'hash', label: 'Empreinte MD5', icon: '🔑', category: 'Malware & CTI' };
      }
      if (/^[a-fA-F0-9]{40}$/.test(val)) {
        return { type: 'hash', label: 'Empreinte SHA-1', icon: '🔑', category: 'Malware & CTI' };
      }
      if (/^[a-fA-F0-9]{64}$/.test(val)) {
        return { type: 'hash', label: 'Empreinte SHA-256', icon: '🔑', category: 'Malware & CTI' };
      }

      // UUID or Storage ID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
        return { type: 'uuid', label: 'Identifiant IntelX (UUID)', icon: '🆔', category: 'Renseignement' };
      }

      // Domain
      if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(val)) {
        return { type: 'domain', label: 'Nom de Domaine', icon: '🌐', category: 'Cyber & Infrastructure' };
      }

      // Default text / keyword
      return { type: 'text', label: 'Mot-clé ou Sélecteur', icon: '🔍', category: 'Recherche OSINT' };
    }

    /**
     * Check API connection & authentication status
     */
    async checkStatus() {
      try {
        const res = await fetch(`${this.apiBase}/status`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        if (!res.ok) {
          return { ok: false, status: res.status, error: `Erreur serveur HTTP ${res.status}` };
        }
        return await res.json();
      } catch (err) {
        return { ok: false, error: `Serveur local injoignable: ${err.message}` };
      }
    }

    /**
     * Asynchronous Intelligent Search with Progressive Polling
     *
     * @param {Object} params - Search configuration (term, buckets, maxresults, etc.)
     * @param {Function} onProgress - Callback called on each poll with new records
     * @returns {Promise<Object>} Final collected search results
     */
    async search(params, onProgress = () => {}) {
      const term = (params.term || '').trim();
      if (!term) {
        throw new Error('Veuillez renseigner un sélecteur de recherche valide.');
      }

      this.isSearchActive = true;
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      const isPhonebook = params.mode === 'phonebook';
      const startEndpoint = isPhonebook ? `${this.apiBase}/phonebook` : `${this.apiBase}/search`;
      const resultEndpoint = isPhonebook ? `${this.apiBase}/phonebook/result` : `${this.apiBase}/result`;

      const requestPayload = {
        term,
        maxresults: parseInt(params.maxresults, 10) || 50,
        buckets: Array.isArray(params.buckets) ? params.buckets : [],
        lookuplevel: parseInt(params.lookuplevel, 10) || 0,
        datefrom: params.datefrom || '',
        dateto: params.dateto || '',
        sort: parseInt(params.sort, 10) || 4,
        media: parseInt(params.media, 10) || 0,
        target: parseInt(params.target, 10) || 0,
      };

      // Step 1: Initiate search
      let startResponse;
      try {
        const res = await fetch(startEndpoint, {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal,
        });

        startResponse = await res.json();

        if (!res.ok) {
          this.isSearchActive = false;
          const errorMsg = this.classifyApiError(res.status, startResponse.error);
          throw new Error(errorMsg);
        }
      } catch (err) {
        this.isSearchActive = false;
        if (err.name === 'AbortError') {
          throw new Error('Recherche annulée par l\'utilisateur.');
        }
        throw err;
      }

      const searchId = startResponse.id;
      if (!searchId) {
        this.isSearchActive = false;
        throw new Error('L\'API n\'a pas retourné d\'identifiant de recherche.');
      }

      this.activeSearchId = searchId;

      // Notify initiation
      onProgress({
        searchId,
        status: 'initiated',
        statusCode: 3,
        records: [],
        total: 0,
        isDone: false,
      });

      // Step 2: Progressive Polling Loop
      const collectedRecords = [];
      const seenIds = new Set();
      let pollCount = 0;
      const maxPolls = 60; // 60 seconds max polling
      let isDone = false;

      while (!isDone && pollCount < maxPolls && this.isSearchActive) {
        // Sleep 1200ms between polls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1200));

        if (!this.isSearchActive || signal.aborted) {
          break;
        }

        pollCount++;

        try {
          const pollUrl = `${resultEndpoint}?id=${encodeURIComponent(searchId)}&limit=${requestPayload.maxresults}`;
          const pollRes = await fetch(pollUrl, {
            method: 'GET',
            headers: this.getHeaders(),
            signal,
          });

          if (!pollRes.ok) {
            const errData = await pollRes.json().catch(() => ({}));
            throw new Error(this.classifyApiError(pollRes.status, errData.error));
          }

          const pollData = await pollRes.json();
          const statusCode = pollData.status;

          // Process records or phonebook selectors
          const incoming = isPhonebook ? (pollData.selectors || []) : (pollData.records || []);

          for (const item of incoming) {
            const uniqueId = isPhonebook ? item.selector : (item.systemid || item.storageid);
            if (uniqueId && !seenIds.has(uniqueId)) {
              seenIds.add(uniqueId);
              collectedRecords.push(item);
            }
          }

          // Status 1: Completed; Status 2: Expired/Not Found; Status 0: Results available; Status 3: Waiting
          if (statusCode === 1 || collectedRecords.length >= requestPayload.maxresults) {
            isDone = true;
          } else if (statusCode === 2) {
            isDone = true;
            if (collectedRecords.length === 0) {
              throw new Error('Session de recherche IntelX expirée ou introuvable.');
            }
          }

          onProgress({
            searchId,
            status: isDone ? 'completed' : 'polling',
            statusCode,
            pollCount,
            records: [...collectedRecords],
            total: collectedRecords.length,
            isDone,
          });
        } catch (pollErr) {
          if (pollErr.name === 'AbortError') {
            break;
          }
          throw pollErr;
        }
      }

      this.isSearchActive = false;
      this.activeSearchId = null;

      return {
        searchId,
        records: collectedRecords,
        total: collectedRecords.length,
        isPhonebook,
        selector: term,
      };
    }

    /**
     * Terminate an active search
     */
    async terminate() {
      if (this.abortController) {
        this.abortController.abort();
      }

      const id = this.activeSearchId;
      this.isSearchActive = false;
      this.activeSearchId = null;

      if (!id) return { ok: true };

      try {
        const res = await fetch(`${this.apiBase}/terminate?id=${encodeURIComponent(id)}`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        return await res.json();
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    /**
     * Fetch Content Preview for a specific record
     */
    async fetchPreview(storageId, bucket = '', lines = 120) {
      if (!storageId) {
        throw new Error('Storage ID manquant pour récupérer l\'aperçu.');
      }

      const query = `?sid=${encodeURIComponent(storageId)}&b=${encodeURIComponent(bucket)}&l=${lines}&f=0`;
      const res = await fetch(`${this.apiBase}/preview${query}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(this.classifyApiError(res.status, err.error || 'Impossible de charger l\'aperçu'));
      }

      const data = await res.json();
      return data.preview || '';
    }

    /**
     * Redact sensitive credentials, plain passwords, tokens, API keys in text
     */
    redactSensitiveData(rawText) {
      if (!rawText || typeof rawText !== 'string') {
        return { sanitized: '', original: '', redactedCount: 0 };
      }

      let count = 0;
      let sanitized = rawText;

      // 1. Password patterns (e.g. password: 1234, pass=secret, pwd: xyz)
      const passRegex = /((?:password|passwd|passwort|motdepasse|pass|pwd|secret|api[_-]?key|token|auth)\s*[:=]\s*)([^\s,;"'<>]+)/gi;
      sanitized = sanitized.replace(passRegex, (match, prefix, secret) => {
        count++;
        return `${prefix}•••••••••• [MASQUÉ]`;
      });

      // 2. Combo dump lines (email:password or user:password format where user is email/alphanumeric)
      const comboRegex = /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_-]{3,30}):([^\s:]{4,60})$/gm;
      sanitized = sanitized.replace(comboRegex, (match, user, pass) => {
        count++;
        return `${user}:•••••••••• [MASQUÉ]`;
      });

      // 3. Sensitive private key markers
      sanitized = sanitized.replace(/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi, () => {
        count++;
        return '-----BEGIN PRIVATE KEY-----\n[CLÉ PRIVÉE SENSIBLE MASQUÉE PAR MESURE DE SÉCURITÉ]\n-----END PRIVATE KEY-----';
      });

      return {
        sanitized,
        original: rawText,
        redactedCount: count,
      };
    }

    /**
     * Map HTTP and API error codes to clear user-facing messages
     */
    classifyApiError(status, serverMessage) {
      if (status === 401) {
        return 'Clé API Intelligence X invalide, absente ou révoquée. Veuillez vérifier votre clé dans les paramètres du module.';
      }
      if (status === 402) {
        return 'Quota Intelligence X atteint ou licence requise pour ce type de recherche (Erreur 402). Vérifiez vos crédits sur intelx.io.';
      }
      if (status === 403) {
        return 'Accès refusé. Vos droits actuels ne permettent pas d\'interroger ce bucket ou cette ressource.';
      }
      if (status === 429) {
        return 'Trop de requêtes vers Intelligence X (Erreur 429). Veuillez patienter quelques instants avant de relancer.';
      }
      if (status === 502 || status === 503) {
        return 'Le service Intelligence X ou le relais local est temporairement indisponible.';
      }
      return serverMessage || `Erreur de communication avec Intelligence X (HTTP ${status}).`;
    }

    /**
     * Helpers for formatting metadata
     */
    formatBytes(bytes) {
      if (bytes === 0 || !bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || 'B'}`;
    }

    formatDate(dateStr) {
      if (!dateStr) return '—';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (e) {
        return dateStr;
      }
    }

    getBucketMeta(bucket) {
      const b = (bucket || '').toLowerCase();
      if (b.includes('darknet') || b.includes('tor') || b.includes('i2p')) {
        return { label: 'Dark Web', badgeClass: 'badge--darknet', icon: '🕳️' };
      }
      if (b.includes('pastes')) {
        return { label: 'Pastes', badgeClass: 'badge--pastes', icon: '📋' };
      }
      if (b.includes('leaks')) {
        return { label: 'Leaks & Dumps', badgeClass: 'badge--leaks', icon: '⚠️' };
      }
      if (b.includes('whois') || b.includes('dns')) {
        return { label: 'WHOIS / DNS', badgeClass: 'badge--whois', icon: '🌐' };
      }
      if (b.includes('web')) {
        return { label: 'Web Public', badgeClass: 'badge--web', icon: '🌍' };
      }
      return { label: bucket || 'Général', badgeClass: 'badge--default', icon: '📁' };
    }
  }

  return IntelXClient;
});
