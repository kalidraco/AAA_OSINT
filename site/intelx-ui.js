/**
 * AAA_OSINT — Intelligence X Investigation Module UI Controller
 *
 * Provides a dedicated, responsive, high-performance interface for Intelligence X
 * investigations, matching the AAA_OSINT cyber dark theme & design system.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IntelXUI = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class IntelXUI {
    constructor(client, options = {}) {
      this.client = client;
      this.container = options.container || document.getElementById('categories-container');
      this.onNavigate = options.onNavigate || (() => {});
      this.showToast = options.showToast || ((msg) => console.log(msg));

      // Investigation State
      this.state = {
        selector: '',
        mode: 'intelligent', // 'intelligent' | 'phonebook'
        bucket: '',
        media: '0',
        dateRange: 'all',
        maxresults: '50',
        status: 'idle', // 'idle' | 'searching' | 'results' | 'empty' | 'error'
        records: [],
        currentSearchId: null,
        activeRecord: null,
        showRawSensitive: false,
        lastError: null,
        pollStats: { polls: 0, total: 0 },
        activeTab: 'results', // 'results' | 'detail'
      };

      this.previewCache = new Map();
    }

    /**
     * Set a pre-filled selector (e.g. from global search or tool card)
     */
    setPrefilledSelector(term) {
      if (!term) return;
      this.state.selector = term.trim();
      const input = document.getElementById('intelx-selector-input');
      if (input) {
        input.value = this.state.selector;
        this.updateSelectorBadge();
      }
    }

    /**
     * Render the entire Intelligence X investigation workspace
     */
    render() {
      if (!this.container) return;

      this.container.innerHTML = `
        <div class="intelx-workspace" id="intelx-workspace">
          <!-- Module Header -->
          <div class="intelx-header">
            <div class="intelx-header__main">
              <div class="intelx-header__badge-wrap">
                <span class="intelx-header__badge">MODULE OFFICIEL INTELX</span>
                <span class="intelx-header__version">API v2</span>
              </div>
              <h2 class="intelx-header__title">
                <span class="intelx-header__icon">⚡</span>
                Intelligence X — Enquêtes & Renseignement
              </h2>
              <p class="intelx-header__desc">
                Interrogez les archives d'Intelligence X pour corréler des sélecteurs (emails, domaines, adresses IP, numéros, URLs, empreintes) à travers les fuites de données, pastes et réseaux sombres.
              </p>
            </div>
            <div class="intelx-header__actions">
              <button class="intelx-btn intelx-btn--secondary" id="intelx-key-settings-btn" title="Paramétrer votre clé API IntelX">
                <span class="intelx-btn__icon">🔑</span>
                <span id="intelx-key-btn-text">Configurer Clé API</span>
                <span class="intelx-status-indicator" id="intelx-key-indicator"></span>
              </button>
            </div>
          </div>

          <!-- Investigation Console Card -->
          <div class="intelx-card intelx-search-card">
            <!-- Mode Selector Tabs -->
            <div class="intelx-modes">
              <button class="intelx-mode-tab ${this.state.mode === 'intelligent' ? 'is-active' : ''}" data-mode="intelligent">
                <span class="intelx-mode-tab__icon">🎯</span>
                <div class="intelx-mode-tab__text">
                  <span class="intelx-mode-tab__title">Recherche Renseignement</span>
                  <span class="intelx-mode-tab__sub">Leaks, Pastes, Darknet, Documents</span>
                </div>
              </button>
              <button class="intelx-mode-tab ${this.state.mode === 'phonebook' ? 'is-active' : ''}" data-mode="phonebook">
                <span class="intelx-mode-tab__icon">📖</span>
                <div class="intelx-mode-tab__text">
                  <span class="intelx-mode-tab__title">Phonebook OSINT</span>
                  <span class="intelx-mode-tab__sub">Sous-domaines, emails & URLs du domaine</span>
                </div>
              </button>
            </div>

            <!-- Search Form -->
            <form class="intelx-form" id="intelx-search-form" onsubmit="return false;">
              <div class="intelx-input-group">
                <div class="intelx-input-wrap">
                  <span class="intelx-input-icon">🔍</span>
                  <input
                    type="text"
                    id="intelx-selector-input"
                    class="intelx-input"
                    placeholder="Saisissez un sélecteur : email, domaine, IP, URL, téléphone, hash..."
                    value="${this.escapeHtml(this.state.selector)}"
                    autocomplete="off"
                    spellcheck="false"
                  >
                  <div class="intelx-selector-badge" id="intelx-selector-badge">
                    <span class="intelx-selector-badge__icon">🔍</span>
                    <span class="intelx-selector-badge__text">Mot-clé</span>
                  </div>
                </div>
                <div class="intelx-action-buttons">
                  <button type="submit" class="intelx-btn intelx-btn--primary" id="intelx-submit-btn">
                    <span class="intelx-btn__icon">⚡</span>
                    <span>Lancer la recherche</span>
                    <kbd class="intelx-btn__kbd">Entrée</kbd>
                  </button>
                  <button type="button" class="intelx-btn intelx-btn--danger" id="intelx-stop-btn" style="display:none;">
                    <span class="intelx-btn__spinner"></span>
                    <span>Arrêter</span>
                  </button>
                </div>
              </div>

              <!-- Quick Examples Chips -->
              <div class="intelx-examples">
                <span class="intelx-examples__label">Exemples de sélecteurs :</span>
                <button type="button" class="intelx-chip" data-example="proton.me">🌐 proton.me</button>
                <button type="button" class="intelx-chip" data-example="investigation@target.org">📧 investigation@target.org</button>
                <button type="button" class="intelx-chip" data-example="185.220.101.5">🖥️ 185.220.101.5</button>
                <button type="button" class="intelx-chip" data-example="https://pastebin.com">🔗 URL Paste</button>
              </div>

              <!-- Filter Controls Accordion -->
              <div class="intelx-filters" id="intelx-filters">
                <div class="intelx-filter-group">
                  <label class="intelx-filter-label" for="intelx-filter-bucket">Sources / Buckets :</label>
                  <select id="intelx-filter-bucket" class="intelx-select">
                    <option value="">Tous les buckets</option>
                    <option value="pastes">Pastes publics (Pastebin, etc.)</option>
                    <option value="darknet">Darknet (Tor .onion, I2P)</option>
                    <option value="leaks">Fuites de données & Dumps</option>
                    <option value="web">Web Public & Archives</option>
                    <option value="whois">WHOIS & Enregistrements DNS</option>
                  </select>
                </div>

                <div class="intelx-filter-group" id="intelx-media-group">
                  <label class="intelx-filter-label" for="intelx-filter-media">Type de contenu :</label>
                  <select id="intelx-filter-media" class="intelx-select">
                    <option value="0">Tous les types de médias</option>
                    <option value="1">Textes & Pastes</option>
                    <option value="2">Documents & PDF</option>
                    <option value="3">Bases de données / Tableurs</option>
                    <option value="4">Images & Médias</option>
                  </select>
                </div>

                <div class="intelx-filter-group">
                  <label class="intelx-filter-label" for="intelx-filter-date">Période :</label>
                  <select id="intelx-filter-date" class="intelx-select">
                    <option value="all">Toute la période</option>
                    <option value="24h">Dernières 24 heures</option>
                    <option value="7d">Derniers 7 jours</option>
                    <option value="30d">Derniers 30 jours</option>
                    <option value="1y">Dernière année</option>
                  </select>
                </div>

                <div class="intelx-filter-group">
                  <label class="intelx-filter-label" for="intelx-filter-max">Limite :</label>
                  <select id="intelx-filter-max" class="intelx-select">
                    <option value="25">25 résultats</option>
                    <option value="50" selected>50 résultats</option>
                    <option value="100">100 résultats</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          <!-- Progress / Polling Banner -->
          <div class="intelx-progress-card" id="intelx-progress-card" style="display:none;">
            <div class="intelx-progress-info">
              <div class="intelx-spinner"></div>
              <div class="intelx-progress-text">
                <span class="intelx-progress-title" id="intelx-progress-title">Interrogation d'Intelligence X...</span>
                <span class="intelx-progress-meta" id="intelx-progress-meta">Initialisation du flux de recherche</span>
              </div>
            </div>
            <div class="intelx-progress-stats">
              <span class="intelx-stat-badge" id="intelx-poll-counter">0 résultats</span>
              <button class="intelx-btn intelx-btn--sm intelx-btn--danger" id="intelx-progress-cancel">Annuler</button>
            </div>
          </div>

          <!-- Results View Area -->
          <div class="intelx-results-wrap" id="intelx-results-wrap">
            <div id="intelx-dynamic-content">
              <!-- Rendered depending on state: idle, results, detail, empty, error -->
            </div>
          </div>
        </div>

        <!-- API Key Configuration Modal -->
        <div class="modal-backdrop" id="intelx-key-modal" aria-hidden="true" style="display:none;">
          <div class="modal intelx-modal" role="dialog" aria-labelledby="intelx-key-modal-title">
            <div class="modal__header">
              <h3 id="intelx-key-modal-title" class="modal__title">
                🔑 Configuration de la Clé API Intelligence X
              </h3>
              <button class="modal__close" id="intelx-key-modal-close" aria-label="Fermer la fenêtre">✕</button>
            </div>
            <div class="modal__body">
              <p class="intelx-modal__desc">
                Intelligence X requiert une clé API personnelle pour interroger ses archives et ses services. Votre clé n'est <strong>jamais partagée publiquement</strong> ni enregistrée dans le code source du projet.
              </p>

              <div class="intelx-key-status-banner" id="intelx-key-status-banner">
                <!-- Live connection status rendered here -->
              </div>

              <div class="intelx-form-group">
                <label for="intelx-api-key-input" class="intelx-label">Clé API Intelligence X (UUID) :</label>
                <div class="intelx-key-input-wrap">
                  <input
                    type="password"
                    id="intelx-api-key-input"
                    class="intelx-input intelx-input--mono"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    autocomplete="off"
                    spellcheck="false"
                  >
                  <button type="button" class="intelx-toggle-visibility" id="intelx-toggle-key-vis" title="Afficher/Masquer la clé">
                    👁️
                  </button>
                </div>
                <span class="intelx-field-hint">
                  Obtenez votre clé sur <a href="https://intelx.io/account?tab=developer" target="_blank" rel="noopener">intelx.io &gt; Account &gt; Developer</a>.
                </span>
              </div>

              <div class="intelx-form-group">
                <label class="intelx-label">Emplacement de stockage côté client :</label>
                <div class="intelx-radio-group">
                  <label class="intelx-radio-label">
                    <input type="radio" name="intelx-storage-type" value="session" id="intelx-storage-session" checked>
                    <span><strong>Session uniquement</strong> (effacée à la fermeture du navigateur — recommandé)</span>
                  </label>
                  <label class="intelx-radio-label">
                    <input type="radio" name="intelx-storage-type" value="local" id="intelx-storage-local">
                    <span><strong>Stockage local persistant</strong> (conservée dans ce navigateur)</span>
                  </label>
                </div>
              </div>

              <div class="intelx-legal-notice">
                <span class="intelx-legal-icon">⚖️</span>
                <p>
                  <strong>Conditions d'utilisation & Licence :</strong> L'intégration dans un produit ou service commercial requiert une licence commerciale souscrite auprès d'Intelligence X Services GmbH. Respectez les quotas et les règles de confidentialité.
                </p>
              </div>
            </div>
            <div class="modal__footer intelx-modal__footer">
              <button class="intelx-btn intelx-btn--secondary" id="intelx-test-key-btn">
                <span>Tester la connexion</span>
              </button>
              <div class="intelx-modal__footer-right">
                <button class="intelx-btn intelx-btn--outline-danger" id="intelx-clear-key-btn">
                  Supprimer la clé
                </button>
                <button class="intelx-btn intelx-btn--primary" id="intelx-save-key-btn">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Result Detail & Safe Preview Modal / Drawer -->
        <div class="modal-backdrop" id="intelx-detail-modal" aria-hidden="true" style="display:none;">
          <div class="modal intelx-modal intelx-modal--large" role="dialog" aria-labelledby="intelx-detail-title">
            <div class="modal__header">
              <div class="intelx-detail-header-info">
                <span class="intelx-badge" id="intelx-detail-bucket-badge">Bucket</span>
                <h3 id="intelx-detail-title" class="modal__title">Fiche d'enregistrement IntelX</h3>
              </div>
              <button class="modal__close" id="intelx-detail-modal-close" aria-label="Fermer la vue détaillée">✕</button>
            </div>
            <div class="modal__body" id="intelx-detail-body">
              <!-- Dynamically populated -->
            </div>
            <div class="modal__footer">
              <button class="intelx-btn intelx-btn--secondary" id="intelx-detail-back-btn">
                ← Revenir aux résultats
              </button>
              <a href="#" target="_blank" rel="noopener" class="intelx-btn intelx-btn--primary" id="intelx-detail-ext-link">
                <span>Ouvrir sur Intelligence X</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
          </div>
        </div>
      `;

      this.bindEvents();
      this.updateKeyIndicator();
      this.updateSelectorBadge();
      this.renderContentState();
    }

    /**
     * Attach event listeners
     */
    bindEvents() {
      const input = document.getElementById('intelx-selector-input');
      const form = document.getElementById('intelx-search-form');
      const stopBtn = document.getElementById('intelx-stop-btn');
      const cancelBtn = document.getElementById('intelx-progress-cancel');
      const keySettingsBtn = document.getElementById('intelx-key-settings-btn');
      const keyModal = document.getElementById('intelx-key-modal');
      const keyModalClose = document.getElementById('intelx-key-modal-close');
      const saveKeyBtn = document.getElementById('intelx-save-key-btn');
      const clearKeyBtn = document.getElementById('intelx-clear-key-btn');
      const testKeyBtn = document.getElementById('intelx-test-key-btn');
      const toggleVisBtn = document.getElementById('intelx-toggle-key-vis');
      const keyInput = document.getElementById('intelx-api-key-input');

      // Selector typing -> dynamic selector badge detection
      if (input) {
        input.addEventListener('input', () => {
          this.state.selector = input.value;
          this.updateSelectorBadge();
        });
      }

      // Mode switcher tabs
      document.querySelectorAll('.intelx-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.intelx-mode-tab').forEach(t => t.classList.remove('is-active'));
          tab.classList.add('is-active');
          this.state.mode = tab.dataset.mode;

          const mediaGroup = document.getElementById('intelx-media-group');
          if (mediaGroup) {
            mediaGroup.style.display = this.state.mode === 'phonebook' ? 'none' : '';
          }
        });
      });

      // Quick selector chips
      document.querySelectorAll('.intelx-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          if (input) {
            input.value = chip.dataset.example;
            this.state.selector = chip.dataset.example;
            this.updateSelectorBadge();
            input.focus();
          }
        });
      });

      // Form submission -> launch search
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.launchSearch();
        });
      }

      // Stop / Cancel button
      if (stopBtn) stopBtn.addEventListener('click', () => this.cancelSearch());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelSearch());

      // API Key Modal open
      if (keySettingsBtn) {
        keySettingsBtn.addEventListener('click', () => this.openKeyModal());
      }

      // API Key Modal close
      if (keyModalClose) {
        keyModalClose.addEventListener('click', () => this.closeKeyModal());
      }
      if (keyModal) {
        keyModal.addEventListener('click', (e) => {
          if (e.target === keyModal) this.closeKeyModal();
        });
      }

      // Key Modal: Toggle password visibility
      if (toggleVisBtn && keyInput) {
        toggleVisBtn.addEventListener('click', () => {
          const isPass = keyInput.type === 'password';
          keyInput.type = isPass ? 'text' : 'password';
          toggleVisBtn.textContent = isPass ? '🔒' : '👁️';
        });
      }

      // Key Modal: Save key
      if (saveKeyBtn) {
        saveKeyBtn.addEventListener('click', () => {
          const val = (keyInput.value || '').trim();
          const storageType = document.querySelector('input[name="intelx-storage-type"]:checked').value;
          this.client.setApiKey(val, storageType);
          this.showToast(val ? 'Clé API IntelX enregistrée avec succès.' : 'Clé API effacée.');
          this.updateKeyIndicator();
          this.closeKeyModal();
        });
      }

      // Key Modal: Clear key
      if (clearKeyBtn) {
        clearKeyBtn.addEventListener('click', () => {
          this.client.clearApiKey();
          keyInput.value = '';
          this.showToast('Clé API supprimée du stockage client.');
          this.updateKeyIndicator();
          this.checkKeyStatusBanner();
        });
      }

      // Key Modal: Test key
      if (testKeyBtn) {
        testKeyBtn.addEventListener('click', () => this.testKeyConnection());
      }

      // Detail Modal Close
      const detailModal = document.getElementById('intelx-detail-modal');
      const detailModalClose = document.getElementById('intelx-detail-modal-close');
      const detailBackBtn = document.getElementById('intelx-detail-back-btn');

      if (detailModalClose) detailModalClose.addEventListener('click', () => this.closeDetailModal());
      if (detailBackBtn) detailBackBtn.addEventListener('click', () => this.closeDetailModal());
      if (detailModal) {
        detailModal.addEventListener('click', (e) => {
          if (e.target === detailModal) this.closeDetailModal();
        });
      }
    }

    /**
     * Update selector badge based on automatic classification
     */
    updateSelectorBadge() {
      const badge = document.getElementById('intelx-selector-badge');
      if (!badge) return;
      const detected = this.client.detectSelectorType(this.state.selector);
      badge.innerHTML = `
        <span class="intelx-selector-badge__icon">${detected.icon}</span>
        <span class="intelx-selector-badge__text">${detected.label}</span>
      `;
    }

    /**
     * Update the API key status pill in the header
     */
    async updateKeyIndicator() {
      const textEl = document.getElementById('intelx-key-btn-text');
      const indEl = document.getElementById('intelx-key-indicator');
      if (!textEl || !indEl) return;

      const hasClientKey = this.client.hasApiKey();

      // Check server proxy status to see if INTELX_KEY is configured in env
      const statusRes = await this.client.checkStatus().catch(() => ({}));

      if (hasClientKey || statusRes.hasEnvKey || statusRes.authenticated) {
        textEl.textContent = 'Clé API : Active';
        indEl.className = 'intelx-status-indicator intelx-status-indicator--active';
        indEl.title = 'Clé API connectée';
      } else {
        textEl.textContent = 'Configurer Clé API';
        indEl.className = 'intelx-status-indicator intelx-status-indicator--missing';
        indEl.title = 'Aucune clé API configurée';
      }
    }

    /**
     * Open API Key Settings Modal
     */
    openKeyModal() {
      const modal = document.getElementById('intelx-key-modal');
      const keyInput = document.getElementById('intelx-api-key-input');
      const storageType = this.client.getStorageType();

      if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
      }

      if (keyInput) {
        keyInput.value = this.client.getApiKey();
      }

      const radio = document.querySelector(`input[name="intelx-storage-type"][value="${storageType}"]`);
      if (radio) radio.checked = true;

      this.checkKeyStatusBanner();
    }

    /**
     * Close API Key Settings Modal
     */
    closeKeyModal() {
      const modal = document.getElementById('intelx-key-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
    }

    /**
     * Check and display server / key status in modal
     */
    async checkKeyStatusBanner() {
      const banner = document.getElementById('intelx-key-status-banner');
      if (!banner) return;

      banner.innerHTML = `
        <div class="intelx-status-loading">
          <div class="intelx-spinner-sm"></div>
          <span>Vérification de l'état de la connexion...</span>
        </div>
      `;

      const statusRes = await this.client.checkStatus();

      if (!statusRes.ok) {
        banner.innerHTML = `
          <div class="intelx-status-box intelx-status-box--warning">
            <span class="intelx-status-box__icon">⚠️</span>
            <div class="intelx-status-box__text">
              <strong>Relais backend :</strong> ${this.escapeHtml(statusRes.error || 'Statut indisponible')}
            </div>
          </div>
        `;
        return;
      }

      if (statusRes.authenticated) {
        banner.innerHTML = `
          <div class="intelx-status-box intelx-status-box--success">
            <span class="intelx-status-box__icon">✅</span>
            <div class="intelx-status-box__text">
              <strong>Authentification réussie :</strong> ${statusRes.hasEnvKey ? 'Clé d\'environnement serveur active.' : 'Clé client active.'}
              ${statusRes.mode === 'mock' ? '<em>(Mode simulation activé)</em>' : ''}
            </div>
          </div>
        `;
      } else {
        banner.innerHTML = `
          <div class="intelx-status-box intelx-status-box--neutral">
            <span class="intelx-status-box__icon">ℹ️</span>
            <div class="intelx-status-box__text">
              Aucune clé valide active. Saisissez votre clé personnelle pour interroger les services IntelX.
            </div>
          </div>
        `;
      }
    }

    /**
     * Test Key Connection
     */
    async testKeyConnection() {
      const keyInput = document.getElementById('intelx-api-key-input');
      const tempKey = (keyInput ? keyInput.value : '').trim();
      const banner = document.getElementById('intelx-key-status-banner');

      if (!tempKey && !this.client.hasApiKey()) {
        if (banner) {
          banner.innerHTML = `
            <div class="intelx-status-box intelx-status-box--danger">
              <span class="intelx-status-box__icon">❌</span>
              <div class="intelx-status-box__text">Veuillez d'abord saisir une clé API à tester.</div>
            </div>
          `;
        }
        return;
      }

      if (banner) {
        banner.innerHTML = `
          <div class="intelx-status-loading">
            <div class="intelx-spinner-sm"></div>
            <span>Test de validation auprès de 2.intelx.io...</span>
          </div>
        `;
      }

      // Temporarily set key in client for test
      const prevKey = this.client.apiKey;
      if (tempKey) this.client.apiKey = tempKey;

      const res = await this.client.checkStatus();
      this.client.apiKey = prevKey; // revert until explicitly saved

      if (banner) {
        if (res.authenticated) {
          banner.innerHTML = `
            <div class="intelx-status-box intelx-status-box--success">
              <span class="intelx-status-box__icon">✅</span>
              <div class="intelx-status-box__text">
                <strong>Clé valide !</strong> Connexion établie avec succès avec le service Intelligence X.
              </div>
            </div>
          `;
        } else {
          banner.innerHTML = `
            <div class="intelx-status-box intelx-status-box--danger">
              <span class="intelx-status-box__icon">❌</span>
              <div class="intelx-status-box__text">
                <strong>Échec du test :</strong> ${this.escapeHtml(res.error || res.message || 'Clé non autorisée ou expirée.')}
              </div>
            </div>
          `;
        }
      }
    }

    /**
     * Launch Intelligence X Search
     */
    async launchSearch() {
      const input = document.getElementById('intelx-selector-input');
      const selector = (input ? input.value : this.state.selector).trim();

      if (!selector) {
        this.showToast('Veuillez spécifier un sélecteur de recherche.');
        if (input) input.focus();
        return;
      }

      this.state.selector = selector;
      this.state.status = 'searching';
      this.state.records = [];
      this.state.lastError = null;

      // Extract filter values
      const bucketSel = document.getElementById('intelx-filter-bucket');
      const mediaSel = document.getElementById('intelx-filter-media');
      const dateSel = document.getElementById('intelx-filter-date');
      const maxSel = document.getElementById('intelx-filter-max');

      const bucket = bucketSel ? bucketSel.value : '';
      const buckets = bucket ? [bucket] : [];
      const media = mediaSel ? parseInt(mediaSel.value, 10) : 0;
      const maxresults = maxSel ? parseInt(maxSel.value, 10) : 50;

      // Compute date filters
      let datefrom = '';
      const now = new Date();
      if (dateSel) {
        const val = dateSel.value;
        if (val === '24h') {
          datefrom = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
        } else if (val === '7d') {
          datefrom = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
        } else if (val === '30d') {
          datefrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
        } else if (val === '1y') {
          datefrom = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString();
        }
      }

      // UI updates for search in progress
      const submitBtn = document.getElementById('intelx-submit-btn');
      const stopBtn = document.getElementById('intelx-stop-btn');
      const progressCard = document.getElementById('intelx-progress-card');
      const progressTitle = document.getElementById('intelx-progress-title');
      const progressMeta = document.getElementById('intelx-progress-meta');
      const pollCounter = document.getElementById('intelx-poll-counter');

      if (submitBtn) submitBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      if (progressCard) progressCard.style.display = 'flex';
      if (progressTitle) progressTitle.textContent = `Interrogation des buckets pour « ${this.escapeHtml(selector)} »...`;
      if (progressMeta) progressMeta.textContent = 'Initialisation de la requête asynchrone...';
      if (pollCounter) pollCounter.textContent = '0 résultat';

      this.renderContentState();

      try {
        const result = await this.client.search(
          {
            term: selector,
            mode: this.state.mode,
            buckets,
            media,
            datefrom,
            maxresults,
          },
          (progress) => {
            // Live progressive callback
            this.state.records = progress.records;
            this.state.pollStats = { polls: progress.pollCount || 0, total: progress.total };

            if (pollCounter) {
              pollCounter.textContent = `${progress.total} résultat${progress.total > 1 ? 's' : ''}`;
            }
            if (progressMeta) {
              progressMeta.textContent = progress.isDone
                ? `Recherche finalisée (${progress.total} résultats trouvés)`
                : `Flux actif — ${progress.pollCount || 1}e vérification (${progress.total} récupérés)...`;
            }

            // Real-time progressive rendering if records arrive
            if (progress.records.length > 0) {
              this.renderResultsList();
            }
          }
        );

        this.state.status = result.total > 0 ? 'results' : 'empty';
      } catch (err) {
        this.state.status = 'error';
        this.state.lastError = err.message;
        this.showToast(`Erreur IntelX : ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.style.display = 'inline-flex';
        if (stopBtn) stopBtn.style.display = 'none';
        if (progressCard) progressCard.style.display = 'none';
        this.renderContentState();
      }
    }

    /**
     * Cancel active search
     */
    async cancelSearch() {
      await this.client.terminate();
      this.showToast('Recherche interrompue.');
      const submitBtn = document.getElementById('intelx-submit-btn');
      const stopBtn = document.getElementById('intelx-stop-btn');
      const progressCard = document.getElementById('intelx-progress-card');

      if (submitBtn) submitBtn.style.display = 'inline-flex';
      if (stopBtn) stopBtn.style.display = 'none';
      if (progressCard) progressCard.style.display = 'none';

      this.state.status = this.state.records.length > 0 ? 'results' : 'idle';
      this.renderContentState();
    }

    /**
     * Render the main content area based on current state
     */
    renderContentState() {
      const container = document.getElementById('intelx-dynamic-content');
      if (!container) return;

      if (this.state.status === 'idle') {
        container.innerHTML = `
          <div class="intelx-guide-card">
            <div class="intelx-guide-icon">🛡️</div>
            <h3 class="intelx-guide-title">Plateforme d'Investigation Intelligence X</h3>
            <p class="intelx-guide-desc">
              Sélectionnez un type de recherche ci-dessus, saisissez votre sélecteur d'enquête puis lancez l'analyse. L'outil interroge de manière asynchrone les dépôts d'archives et présente les résultats avec aperçu sécurisé.
            </p>
            <div class="intelx-features-grid">
              <div class="intelx-feature">
                <span class="intelx-feature__icon">📧</span>
                <strong>Emails & Identités</strong>
                <p>Recherchez les fuites d'identifiants, combodumps et comptes associés.</p>
              </div>
              <div class="intelx-feature">
                <span class="intelx-feature__icon">🌐</span>
                <strong>Domaines & Sous-domaines</strong>
                <p>Énumération de sous-domaines, hôtes virtuels et enregistrements historiques.</p>
              </div>
              <div class="intelx-feature">
                <span class="intelx-feature__icon">🕳️</span>
                <strong>Dark Web & Archives</strong>
                <p>Surveillance des forums Tor (.onion), pastes publics et dépôts de fuites.</p>
              </div>
              <div class="intelx-feature">
                <span class="intelx-feature__icon">🔒</span>
                <strong>Masquage Sécurisé</strong>
                <p>Les mots de passe et données sensibles sont masqués par défaut dans les aperçus.</p>
              </div>
            </div>
          </div>
        `;
        return;
      }

      if (this.state.status === 'empty') {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <h2>Aucun résultat trouvé dans Intelligence X</h2>
            <p>
              Le sélecteur « <strong>${this.escapeHtml(this.state.selector)}</strong> » n'a retourné aucun enregistrement dans les buckets sélectionnés.
            </p>
            <div class="intelx-empty-hints">
              <span>Conseils d'investigation :</span>
              <ul>
                <li>Vérifiez l'orthographe du domaine, de l'adresse email ou de l'IP.</li>
                <li>Élargissez les filtres de buckets à « Tous les buckets ».</li>
                <li>Basculez sur le mode « Phonebook OSINT » pour les domaines.</li>
              </ul>
            </div>
          </div>
        `;
        return;
      }

      if (this.state.status === 'error') {
        const isAuthError = (this.state.lastError || '').includes('401') || (this.state.lastError || '').includes('Clé API');
        const isQuotaError = (this.state.lastError || '').includes('402') || (this.state.lastError || '').includes('Quota');

        container.innerHTML = `
          <div class="empty-state intelx-error-state">
            <div class="empty-state__icon">${isAuthError ? '🔑' : isQuotaError ? '💳' : '⚠️'}</div>
            <h2>Erreur lors de la recherche Intelligence X</h2>
            <p class="intelx-error-msg">${this.escapeHtml(this.state.lastError || 'Une erreur inconnue est survenue.')}</p>
            <div class="intelx-error-actions">
              ${isAuthError ? `
                <button class="intelx-btn intelx-btn--primary" onclick="document.getElementById('intelx-key-settings-btn').click()">
                  🔑 Configurer la clé API
                </button>
              ` : `
                <button class="intelx-btn intelx-btn--secondary" onclick="window.location.reload()">
                  Réinitialiser
                </button>
              `}
            </div>
          </div>
        `;
        return;
      }

      if (this.state.status === 'results' || this.state.status === 'searching') {
        this.renderResultsList();
      }
    }

    /**
     * Render the list / table of results
     */
    renderResultsList() {
      const container = document.getElementById('intelx-dynamic-content');
      if (!container) return;

      const isPhonebook = this.state.mode === 'phonebook';
      const records = this.state.records;

      let html = `
        <div class="intelx-results-header">
          <div class="intelx-results-title">
            <strong>${records.length}</strong> ${isPhonebook ? 'sélecteur' : 'enregistrement'}${records.length > 1 ? 's' : ''} trouvé${records.length > 1 ? 's' : ''}
            pour « <strong>${this.escapeHtml(this.state.selector)}</strong> »
          </div>
          <div class="intelx-results-meta">
            Mode : ${isPhonebook ? 'Phonebook' : 'Renseignement / Leaks'}
          </div>
        </div>
      `;

      if (isPhonebook) {
        // Phonebook selector list
        html += `
          <div class="intelx-phonebook-grid">
            ${records.map((item, idx) => {
              const targetLabel = item.target === 1 ? 'Domaine' : item.target === 2 ? 'Email' : 'URL';
              const targetIcon = item.target === 1 ? '🌐' : item.target === 2 ? '📧' : '🔗';
              return `
                <div class="intelx-phonebook-card" tabindex="0">
                  <div class="intelx-phonebook-card__header">
                    <span class="intelx-tag intelx-tag--sm">${targetIcon} ${targetLabel}</span>
                  </div>
                  <div class="intelx-phonebook-card__val" title="${this.escapeHtml(item.selector)}">
                    ${this.escapeHtml(item.selector)}
                  </div>
                  <div class="intelx-phonebook-card__actions">
                    <button class="intelx-btn-icon" title="Copier ce sélecteur" onclick="navigator.clipboard.writeText('${this.escapeHtml(item.selector)}'); document.getElementById('toast').textContent='Sélecteur copié !'; document.getElementById('toast').classList.add('is-visible'); setTimeout(()=>document.getElementById('toast').classList.remove('is-visible'), 2000);">
                      📋
                    </button>
                    <button class="intelx-btn-icon" title="Rechercher ce sélecteur" onclick="document.getElementById('intelx-selector-input').value='${this.escapeHtml(item.selector)}'; document.getElementById('intelx-submit-btn').click();">
                      ⚡
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        // Full Intelligence records list
        html += `
          <div class="intelx-table-container">
            <table class="intelx-table">
              <thead>
                <tr>
                  <th>Source / Bucket</th>
                  <th>Titre & Description</th>
                  <th>Type</th>
                  <th>Taille</th>
                  <th>Date</th>
                  <th>Accès</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${records.map((rec, idx) => {
                  const bucketMeta = this.client.getBucketMeta(rec.bucket);
                  const formattedSize = this.client.formatBytes(rec.size);
                  const formattedDate = this.client.formatDate(rec.date);
                  const accessLevel = rec.accesslevelh || (rec.accesslevel === 0 ? 'Public' : 'Analyst');

                  return `
                    <tr class="intelx-row" data-idx="${idx}">
                      <td>
                        <span class="intelx-badge ${bucketMeta.badgeClass}">
                          ${bucketMeta.icon} ${this.escapeHtml(bucketMeta.label)}
                        </span>
                      </td>
                      <td class="intelx-td-title">
                        <div class="intelx-record-title">
                          ${this.escapeHtml(rec.name || 'Enregistrement sans titre')}
                        </div>
                        ${rec.description ? `
                          <div class="intelx-record-sub">${this.escapeHtml(rec.description)}</div>
                        ` : ''}
                      </td>
                      <td>
                        <span class="intelx-media-tag">${this.escapeHtml(rec.mediah || 'Fichier')}</span>
                      </td>
                      <td class="intelx-td-mono">${formattedSize}</td>
                      <td class="intelx-td-mono">${formattedDate}</td>
                      <td>
                        <span class="intelx-access-pill intelx-access-pill--${accessLevel.toLowerCase()}">
                          ${this.escapeHtml(accessLevel)}
                        </span>
                      </td>
                      <td>
                        <div class="intelx-row-actions">
                          <button class="intelx-btn intelx-btn--xs intelx-btn--primary intelx-view-detail-btn" data-idx="${idx}" title="Afficher l'aperçu et les métadonnées">
                            Examiner
                          </button>
                          <a href="https://intelx.io/?did=${encodeURIComponent(rec.systemid || '')}" target="_blank" rel="noopener" class="intelx-btn-icon" title="Ouvrir sur Intelligence X">
                            ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      container.innerHTML = html;

      // Bind record inspection buttons
      container.querySelectorAll('.intelx-view-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          if (records[idx]) {
            this.openDetailModal(records[idx]);
          }
        });
      });
    }

    /**
     * Open Record Detail & Safe Preview Modal
     */
    async openDetailModal(record) {
      this.state.activeRecord = record;
      this.state.showRawSensitive = false;

      const modal = document.getElementById('intelx-detail-modal');
      const titleEl = document.getElementById('intelx-detail-title');
      const bucketBadge = document.getElementById('intelx-detail-bucket-badge');
      const bodyEl = document.getElementById('intelx-detail-body');
      const extLink = document.getElementById('intelx-detail-ext-link');

      if (!modal || !bodyEl) return;

      const bucketMeta = this.client.getBucketMeta(record.bucket);

      if (titleEl) titleEl.textContent = record.name || 'Fiche d\'enregistrement Intelligence X';
      if (bucketBadge) {
        bucketBadge.textContent = `${bucketMeta.icon} ${bucketMeta.label}`;
        bucketBadge.className = `intelx-badge ${bucketMeta.badgeClass}`;
      }
      if (extLink) {
        extLink.href = `https://intelx.io/?did=${encodeURIComponent(record.systemid || '')}`;
      }

      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');

      bodyEl.innerHTML = `
        <!-- Metadata Overview Grid -->
        <div class="intelx-detail-meta-grid">
          <div class="intelx-meta-item">
            <span class="intelx-meta-label">System ID (UUID)</span>
            <div class="intelx-meta-val-copy">
              <code>${this.escapeHtml(record.systemid || '—')}</code>
              <button class="intelx-copy-btn" title="Copier" onclick="navigator.clipboard.writeText('${this.escapeHtml(record.systemid || '')}')">📋</button>
            </div>
          </div>
          <div class="intelx-meta-item">
            <span class="intelx-meta-label">Storage ID</span>
            <div class="intelx-meta-val-copy">
              <code>${this.escapeHtml(record.storageid || '—')}</code>
              <button class="intelx-copy-btn" title="Copier" onclick="navigator.clipboard.writeText('${this.escapeHtml(record.storageid || '')}')">📋</button>
            </div>
          </div>
          <div class="intelx-meta-item">
            <span class="intelx-meta-label">Bucket Source</span>
            <span class="intelx-meta-val">${this.escapeHtml(record.bucket || '—')}</span>
          </div>
          <div class="intelx-meta-item">
            <span class="intelx-meta-label">Type de Média</span>
            <span class="intelx-meta-val">${this.escapeHtml(record.mediah || '—')}</span>
          </div>
          <div class="intelx-meta-item">
            <span class="intelx-meta-label">Taille</span>
            <span class="intelx-meta-val">${this.client.formatBytes(record.size)}</span>
          </div>
          <div class="intelx-meta-item">
            <span class="intelx-meta-label">Date d'indexation</span>
            <span class="intelx-meta-val">${this.client.formatDate(record.date)}</span>
          </div>
        </div>

        <!-- Preview Section -->
        <div class="intelx-preview-section">
          <div class="intelx-preview-header">
            <div class="intelx-preview-title">
              <span>📄 Aperçu du contenu</span>
              <span class="intelx-redaction-status" id="intelx-redaction-status"></span>
            </div>
            <div class="intelx-preview-controls">
              <button class="intelx-btn intelx-btn--xs intelx-btn--secondary" id="intelx-toggle-redact-btn">
                🔒 Données sensibles masquées (Actif)
              </button>
              <button class="intelx-btn intelx-btn--xs intelx-btn--secondary" id="intelx-copy-preview-btn">
                Copier le texte
              </button>
            </div>
          </div>

          <div class="intelx-preview-viewer" id="intelx-preview-viewer">
            <div class="intelx-status-loading">
              <div class="intelx-spinner-sm"></div>
              <span>Récupération de l'aperçu auprès de l'API Intelligence X...</span>
            </div>
          </div>
        </div>
      `;

      // Fetch preview
      const storageId = record.storageid;
      let rawText = '';

      if (this.previewCache.has(storageId)) {
        rawText = this.previewCache.get(storageId);
      } else {
        try {
          rawText = await this.client.fetchPreview(storageId, record.bucket);
          this.previewCache.set(storageId, rawText);
        } catch (e) {
          const viewer = document.getElementById('intelx-preview-viewer');
          if (viewer) {
            viewer.innerHTML = `
              <div class="intelx-preview-error">
                <span>⚠️ Aperçu non disponible : ${this.escapeHtml(e.message)}</span>
                <p>Consultez la fiche directement sur <a href="https://intelx.io/?did=${encodeURIComponent(record.systemid)}" target="_blank" rel="noopener">Intelligence X</a>.</p>
              </div>
            `;
          }
          return;
        }
      }

      this.renderPreviewContent(rawText);
    }

    /**
     * Render Preview Content with Redaction Toggle
     */
    renderPreviewContent(rawText) {
      const viewer = document.getElementById('intelx-preview-viewer');
      const redactStatus = document.getElementById('intelx-redaction-status');
      const toggleRedactBtn = document.getElementById('intelx-toggle-redact-btn');
      const copyBtn = document.getElementById('intelx-copy-preview-btn');

      if (!viewer) return;

      const redacted = this.client.redactSensitiveData(rawText);
      const textToDisplay = this.state.showRawSensitive ? rawText : redacted.sanitized;

      if (redactStatus) {
        if (redacted.redactedCount > 0) {
          redactStatus.innerHTML = `
            <span class="intelx-redaction-badge">
              🛡️ ${redacted.redactedCount} secret(s) / identifiant(s) masqué(s)
            </span>
          `;
        } else {
          redactStatus.innerHTML = '';
        }
      }

      if (toggleRedactBtn) {
        if (this.state.showRawSensitive) {
          toggleRedactBtn.textContent = '👁️ Données brutes affichées';
          toggleRedactBtn.className = 'intelx-btn intelx-btn--xs intelx-btn--danger';
        } else {
          toggleRedactBtn.textContent = '🔒 Données sensibles masquées';
          toggleRedactBtn.className = 'intelx-btn intelx-btn--xs intelx-btn--secondary';
        }

        toggleRedactBtn.onclick = () => {
          this.state.showRawSensitive = !this.state.showRawSensitive;
          this.renderPreviewContent(rawText);
        };
      }

      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(textToDisplay).then(() => {
            this.showToast('Contenu de l\'aperçu copié dans le presse-papier !');
          });
        };
      }

      viewer.innerHTML = `
        <pre class="intelx-code-block"><code>${this.escapeHtml(textToDisplay)}</code></pre>
      `;
    }

    /**
     * Close Record Detail Modal
     */
    closeDetailModal() {
      const modal = document.getElementById('intelx-detail-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
    }

    /**
     * Utility HTML escape
     */
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  return IntelXUI;
});
