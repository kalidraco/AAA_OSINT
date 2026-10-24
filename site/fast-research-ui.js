/**
 * AAA_OSINT — Fast Research UI Workspace Controller
 *
 * Priorité absolue : Affichage immédiat d'une liste compacte et streaming
 * en temps réel des résultats sans latence superflue.
 * Le graphe est strictement secondaire et facultatif.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FastResearchUI = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  class FastResearchUI {
    constructor(options = {}) {
      this.containerId = options.containerId || 'categories-container';
      this.engine = new FastResearchEngine({ apiBase: options.apiBase || '' });
      this.activeIndicator = '';
      this.activeFilter = 'all';
      this.filterText = '';
      this.currentViewMode = 'list'; // 'list' (default) or 'graph' (optional)
      this.graphEngine = null; // initialized lazily if user opens graph view
      this.catalogTools = [];
    }

    setCatalogTools(tools) {
      this.catalogTools = tools || [];
    }

    /**
     * Render the Fast Research Workspace
     */
    render(prefilledValue = '') {
      const container = document.getElementById(this.containerId);
      if (!container) return;

      container.innerHTML = `
        <div class="fast-research-workspace" id="fast-research-workspace">
          <!-- Top Control Header -->
          <div class="fr-header">
            <div class="fr-header__top">
              <div class="fr-header__title-box">
                <h2 class="fr-header__title">
                  <span class="fr-header__icon">⚡</span>
                  <span id="fr-title-text">Fast Research</span>
                  <span class="fr-badge fr-badge--speed">PARALLÈLE & EN DIRECT</span>
                </h2>
                <p class="fr-header__subtitle" id="fr-subtitle-text">
                  Interrogez instantanément toutes les sources et API automatisables compatibles, sans délai ni intermédiaire.
                </p>
              </div>

              <!-- View Switcher (List Default vs Graph Optional) -->
              <div class="fr-view-switcher" role="group" aria-label="Mode d'affichage">
                <button class="fr-view-btn is-active" id="fr-view-list-btn" title="Vue Liste (Par défaut, rapide & détaillée)">
                  <span class="fr-view-btn__icon">📋</span>
                  <span class="fr-view-btn__text">Liste (Défaut)</span>
                </button>
                <button class="fr-view-btn" id="fr-view-graph-btn" title="Vue Graphe (Optionnelle)">
                  <span class="fr-view-btn__icon">🕸️</span>
                  <span class="fr-view-btn__text">Graphe</span>
                </button>
              </div>
            </div>

            <!-- Universal Input Box -->
            <div class="fr-search-bar">
              <div class="fr-input-wrap">
                <span class="fr-input-icon" id="fr-type-icon">🔍</span>
                <input
                  type="text"
                  id="fr-indicator-input"
                  class="fr-input"
                  placeholder="Saisissez un nom, prénom, email, domaine, IP, pseudo, entreprise, hash, crypto..."
                  value="${escapeHtml(prefilledValue)}"
                  autocomplete="off"
                  spellcheck="false"
                >
                <span class="fr-type-pill" id="fr-type-pill">Général</span>
                <button class="fr-clear-btn" id="fr-clear-input-btn" title="Effacer" style="${prefilledValue ? '' : 'display:none;'}">✕</button>
              </div>

              <!-- Action buttons -->
              <div class="fr-search-actions">
                <button class="fr-btn fr-btn--primary" id="fr-launch-btn">
                  <span class="fr-btn__icon">⚡</span>
                  <span id="fr-launch-text">Fast Research</span>
                </button>
                <button class="fr-btn fr-btn--danger" id="fr-stop-btn" style="display:none;" title="Arrêter les requêtes en cours">
                  <span>⏹</span>
                  <span>Arrêter</span>
                </button>
                <label class="fr-btn fr-btn--secondary fr-upload-btn" title="Téléverser une image (EXIF + Hash SHA-256)">
                  <span>📷</span>
                  <span class="fr-upload-label">Image</span>
                  <input type="file" id="fr-image-file-input" accept="image/*" style="display:none;">
                </label>
              </div>
            </div>

            <!-- Live Progress / Latency Bar -->
            <div class="fr-progress-bar" id="fr-progress-bar" style="display:none;">
              <div class="fr-progress-meta">
                <div class="fr-progress-status" id="fr-progress-status">
                  <span class="fr-spinner"></span>
                  <span id="fr-status-text">Collecte en parallèle...</span>
                </div>
                <div class="fr-metrics" id="fr-metrics">
                  <span class="fr-metric" id="fr-metric-first">Premier résultat : —</span>
                  <span class="fr-metric-sep">·</span>
                  <span class="fr-metric" id="fr-metric-elapsed">Temps total : 0ms</span>
                </div>
              </div>
              <div class="fr-progress-track">
                <div class="fr-progress-fill" id="fr-progress-fill" style="width: 0%;"></div>
              </div>
            </div>
          </div>

          <!-- Main Content Area -->
          <div class="fr-content" id="fr-content">
            <!-- Filter Ribbon & Actions Bar -->
            <div class="fr-filter-bar" id="fr-filter-bar" style="display:none;">
              <div class="fr-filter-chips" id="fr-filter-chips">
                <button class="fr-chip is-active" data-filter="all">Tous (<span id="fr-count-all">0</span>)</button>
                <button class="fr-chip" data-filter="success">Succès (<span id="fr-count-success">0</span>)</button>
                <button class="fr-chip" data-filter="empty">Vides (<span id="fr-count-empty">0</span>)</button>
                <button class="fr-chip" data-filter="error">Erreurs (<span id="fr-count-error">0</span>)</button>
              </div>

              <div class="fr-filter-actions">
                <input type="text" id="fr-filter-text-input" class="fr-filter-search" placeholder="Filtrer dans les résultats...">
                
                <div class="fr-export-group">
                  <button class="fr-btn fr-btn--sm" id="fr-export-btn" title="Exporter les résultats">
                    <span>💾</span>
                    <span>Exporter ▾</span>
                  </button>
                  <div class="fr-export-menu" id="fr-export-menu" style="display:none;">
                    <button class="fr-menu-item" id="fr-export-json">JSON brut</button>
                    <button class="fr-menu-item" id="fr-export-csv">Tableau CSV</button>
                    <button class="fr-menu-item" id="fr-export-md">Rapport Markdown</button>
                  </div>
                </div>

                <button class="fr-btn fr-btn--sm fr-btn--accent" id="fr-sync-investigation-btn" title="Transférer tous les constats dans le dossier d'investigation">
                  <span>🕵️</span>
                  <span>Sync Investigation</span>
                </button>
              </div>
            </div>

            <!-- View Container : Primary List View -->
            <div class="fr-list-view" id="fr-list-view">
              <!-- Initial Welcome / Empty Guide -->
              <div class="fr-welcome-box" id="fr-welcome-box">
                <div class="fr-welcome-icon">⚡</div>
                <h3>Recherche Rapide Multi-Sources</h3>
                <p>Saisissez n'importe quel indice pour déclencher l'interrogation parallèle des sources automatisables :</p>
                <div class="fr-examples-grid">
                  <button class="fr-example-chip" data-val="google.com">🌐 google.com</button>
                  <button class="fr-example-chip" data-val="1.1.1.1">🖥️ 1.1.1.1</button>
                  <button class="fr-example-chip" data-val="torvalds">👤 torvalds</button>
                  <button class="fr-example-chip" data-val="contact@proton.me">📧 contact@proton.me</button>
                  <button class="fr-example-chip" data-val="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa">🪙 1A1zP1eP... (BTC)</button>
                  <button class="fr-example-chip" data-val="Dassault Aviation">🏢 Dassault Aviation</button>
                </div>
              </div>

              <!-- Streamed Results Feed -->
              <div class="fr-results-feed" id="fr-results-feed" style="display:none;"></div>
            </div>

            <!-- View Container : Secondary Optional Graph View -->
            <div class="fr-graph-view" id="fr-graph-view" style="display:none;">
              <div class="fr-graph-toolbar">
                <span class="fr-graph-hint">Vue relationnelle secondaire (ne ralentit pas la collecte)</span>
                <div class="fr-graph-controls">
                  <button class="fr-btn fr-btn--sm" id="fr-graph-fit-btn">Recentrer</button>
                  <button class="fr-btn fr-btn--sm" id="fr-graph-reset-btn">Réorganiser</button>
                </div>
              </div>
              <div class="fr-canvas-wrap">
                <canvas id="fr-graph-canvas" class="fr-canvas"></canvas>
              </div>
            </div>

            <!-- Catalog Web Pivots (Always Clearly Distinct) -->
            <div class="fr-catalog-pivots" id="fr-catalog-pivots" style="display:none;">
              <div class="fr-pivots-header">
                <h4 class="fr-pivots-title">
                  <span>🔗</span>
                  <span>Outils du catalogue complémentaires (Ouverture manuelle dans le navigateur)</span>
                </h4>
                <span class="fr-pivots-desc">Services spécialisés ne disposant pas d'API publique libre, pré-remplis avec votre indice.</span>
              </div>
              <div class="fr-pivots-grid" id="fr-pivots-grid"></div>
            </div>
          </div>
        </div>
      `;

      this.bindEvents();

      if (prefilledValue) {
        this.updateTypeBadge(prefilledValue);
        this.runSearch(prefilledValue);
      }
    }

    /**
     * Bind UI event handlers
     */
    bindEvents() {
      const input = document.getElementById('fr-indicator-input');
      const launchBtn = document.getElementById('fr-launch-btn');
      const stopBtn = document.getElementById('fr-stop-btn');
      const clearBtn = document.getElementById('fr-clear-input-btn');
      const imageInput = document.getElementById('fr-image-file-input');
      const listBtn = document.getElementById('fr-view-list-btn');
      const graphBtn = document.getElementById('fr-view-graph-btn');
      const exportBtn = document.getElementById('fr-export-btn');
      const exportMenu = document.getElementById('fr-export-menu');
      const filterTextInput = document.getElementById('fr-filter-text-input');
      const syncBtn = document.getElementById('fr-sync-investigation-btn');

      // Input changes
      if (input) {
        input.addEventListener('input', () => {
          const val = input.value.trim();
          clearBtn.style.display = val ? '' : 'none';
          this.updateTypeBadge(val);
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.runSearch(input.value);
          }
        });
      }

      // Launch
      if (launchBtn) {
        launchBtn.addEventListener('click', () => {
          if (input) this.runSearch(input.value);
        });
      }

      // Stop
      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          this.engine.abort();
          this.setRunningState(false);
        });
      }

      // Clear input
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (input) {
            input.value = '';
            input.focus();
            clearBtn.style.display = 'none';
            this.updateTypeBadge('');
          }
        });
      }

      // View Switcher
      if (listBtn && graphBtn) {
        listBtn.addEventListener('click', () => this.switchViewMode('list'));
        graphBtn.addEventListener('click', () => this.switchViewMode('graph'));
      }

      // Examples chips
      document.querySelectorAll('.fr-example-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.val;
          if (input) {
            input.value = val;
            this.updateTypeBadge(val);
            this.runSearch(val);
          }
        });
      });

      // Filter chips
      document.querySelectorAll('.fr-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('.fr-chip').forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');
          this.activeFilter = chip.dataset.filter;
          this.applyFilters();
        });
      });

      // Filter text
      if (filterTextInput) {
        filterTextInput.addEventListener('input', () => {
          this.filterText = filterTextInput.value.trim().toLowerCase();
          this.applyFilters();
        });
      }

      // Export menu toggle
      if (exportBtn && exportMenu) {
        exportBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
          exportMenu.style.display = 'none';
        });

        document.getElementById('fr-export-json')?.addEventListener('click', () => this.downloadFile('fast-research.json', this.engine.exportJSON(), 'application/json'));
        document.getElementById('fr-export-csv')?.addEventListener('click', () => this.downloadFile('fast-research.csv', this.engine.exportCSV(), 'text/csv'));
        document.getElementById('fr-export-md')?.addEventListener('click', () => this.downloadFile('fast-research.md', this.engine.exportMarkdown(), 'text/markdown'));
      }

      // Sync to Investigation Case
      if (syncBtn) {
        syncBtn.addEventListener('click', () => this.syncToInvestigation());
      }

      // Image upload
      if (imageInput) {
        imageInput.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) this.handleImageUpload(file);
        });
      }
    }

    /**
     * Switch between primary List view and secondary Graph view
     */
    switchViewMode(mode) {
      this.currentViewMode = mode;
      const listBtn = document.getElementById('fr-view-list-btn');
      const graphBtn = document.getElementById('fr-view-graph-btn');
      const listView = document.getElementById('fr-list-view');
      const graphView = document.getElementById('fr-graph-view');

      if (!listBtn || !graphBtn || !listView || !graphView) return;

      if (mode === 'list') {
        listBtn.classList.add('is-active');
        graphBtn.classList.remove('is-active');
        listView.style.display = '';
        graphView.style.display = 'none';
      } else {
        graphBtn.classList.add('is-active');
        listBtn.classList.remove('is-active');
        listView.style.display = 'none';
        graphView.style.display = 'block';
        this.renderGraphView();
      }
    }

    /**
     * Update indicator type badge
     */
    updateTypeBadge(val) {
      const typePill = document.getElementById('fr-type-pill');
      const typeIcon = document.getElementById('fr-type-icon');
      if (!typePill || !typeIcon) return;

      const detected = this.engine.detectType(val);
      typePill.textContent = detected.label;
      typeIcon.textContent = detected.icon;
    }

    /**
     * Set running / in-flight state
     */
    setRunningState(running) {
      const launchBtn = document.getElementById('fr-launch-btn');
      const stopBtn = document.getElementById('fr-stop-btn');
      const progressBar = document.getElementById('fr-progress-bar');
      const fill = document.getElementById('fr-progress-fill');

      if (launchBtn) launchBtn.style.display = running ? 'none' : '';
      if (stopBtn) stopBtn.style.display = running ? '' : 'none';
      if (progressBar) progressBar.style.display = '';
      if (fill && !running) fill.style.width = '100%';
    }

    /**
     * Run Fast Research on indicator
     */
    async runSearch(indicator) {
      const clean = String(indicator || '').trim();
      if (!clean) return;

      this.activeIndicator = clean;
      const feed = document.getElementById('fr-results-feed');
      const welcome = document.getElementById('fr-welcome-box');
      const filterBar = document.getElementById('fr-filter-bar');
      const pivotsBox = document.getElementById('fr-catalog-pivots');
      const statusText = document.getElementById('fr-status-text');
      const firstMetric = document.getElementById('fr-metric-first');
      const elapsedMetric = document.getElementById('fr-metric-elapsed');
      const progressFill = document.getElementById('fr-progress-fill');

      if (feed) {
        feed.innerHTML = '';
        feed.style.display = 'flex';
      }
      if (welcome) welcome.style.display = 'none';
      if (filterBar) filterBar.style.display = 'flex';
      if (pivotsBox) pivotsBox.style.display = 'block';

      this.setRunningState(true);
      this.renderCatalogPivots(clean);

      const detected = this.engine.detectType(clean);

      await this.engine.execute(clean, {
        onStart: (info) => {
          if (statusText) statusText.textContent = `Interrogation de ${info.totalSources} sources en parallèle pour "${clean}"...`;
          if (progressFill) progressFill.style.width = '10%';
          if (firstMetric) firstMetric.textContent = 'Premier résultat : en attente...';
        },
        onResult: (result, stats) => {
          this.appendResultCard(result);
          this.updateCounts(stats);

          if (stats.firstResultMs !== null && firstMetric) {
            firstMetric.textContent = `Premier résultat : ${stats.firstResultMs}ms`;
          }
          if (elapsedMetric) {
            elapsedMetric.textContent = `${stats.completed}/${stats.totalSources} terminées`;
          }
          if (progressFill) {
            const pct = Math.round((stats.completed / stats.totalSources) * 100);
            progressFill.style.width = `${pct}%`;
          }
        },
        onProgress: (progress) => {
          if (statusText) {
            statusText.textContent = `${progress.completed}/${progress.total} sources terminées (${progress.successCount} trouvées) · ${progress.elapsedMs}ms`;
          }
        },
        onComplete: (summary) => {
          this.setRunningState(false);
          const st = summary.stats;
          if (statusText) {
            statusText.textContent = `Recherche terminée en ${st.totalDurationMs}ms · ${st.totalSources} sources interrogées (${st.successCount} avec données, ${st.emptyCount} vides, ${st.errorCount} erreurs)`;
          }
          if (elapsedMetric) {
            elapsedMetric.textContent = `Temps total : ${st.totalDurationMs}ms`;
          }
        },
      });
    }

    /**
     * Append a single streamed result card to the DOM immediately
     */
    appendResultCard(result) {
      const feed = document.getElementById('fr-results-feed');
      if (!feed) return;

      const card = document.createElement('div');
      card.className = `fr-result-card fr-result-card--${result.status}`;
      card.dataset.status = result.status;
      card.dataset.category = result.category;
      card.dataset.title = (result.title || '').toLowerCase();
      card.dataset.summary = (result.summary || '').toLowerCase();

      const statusBadge = result.status === 'success'
        ? `<span class="fr-status-badge fr-status-badge--success">🟢 Succès (${result.latencyMs}ms)</span>`
        : (result.status === 'empty'
          ? `<span class="fr-status-badge fr-status-badge--empty">⚪ Aucun résultat (${result.latencyMs}ms)</span>`
          : `<span class="fr-status-badge fr-status-badge--error">🔴 Échec (${result.latencyMs}ms)</span>`);

      card.innerHTML = `
        <div class="fr-card-header">
          <div class="fr-card-meta">
            <span class="fr-card-icon">${result.icon}</span>
            <strong class="fr-card-source">${escapeHtml(result.sourceName)}</strong>
            <span class="fr-card-cat">${escapeHtml(result.category)}</span>
          </div>
          <div class="fr-card-status-wrap">
            ${statusBadge}
          </div>
        </div>

        <div class="fr-card-body">
          <h4 class="fr-card-title">${escapeHtml(result.title)}</h4>
          ${result.summary ? `<p class="fr-card-summary">${escapeHtml(result.summary)}</p>` : ''}
        </div>

        <div class="fr-card-footer">
          <div class="fr-card-links">
            ${result.sourceUrl ? `<a href="${escapeHtml(result.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="fr-card-link">🔗 Source / Preuve</a>` : '<span class="fr-card-offline">Interrogation directe</span>'}
            <span class="fr-card-time">${new Date(result.timestamp).toLocaleTimeString()}</span>
          </div>

          <div class="fr-card-actions">
            <button class="fr-action-btn fr-action-copy" title="Copier le résumé">📋 Copier</button>
            <button class="fr-action-btn fr-action-pivot" title="Approfondir : lancer une nouvelle recherche sur ce résultat">🔍 Approfondir</button>
          </div>
        </div>
      `;

      // Copy button
      card.querySelector('.fr-action-copy')?.addEventListener('click', () => {
        const text = `${result.title}\n${result.summary || ''}\n${result.sourceUrl || ''}`;
        navigator.clipboard?.writeText(text);
        const btn = card.querySelector('.fr-action-copy');
        if (btn) {
          const original = btn.textContent;
          btn.textContent = '✅ Copié !';
          setTimeout(() => { btn.textContent = original; }, 1500);
        }
      });

      // Pivot / Deepen button
      card.querySelector('.fr-action-pivot')?.addEventListener('click', () => {
        const input = document.getElementById('fr-indicator-input');
        // Extract pivot term from data
        let pivotTerm = '';
        if (result.data?.records?.A?.[0]) pivotTerm = result.data.records.A[0];
        else if (Array.isArray(result.data) && typeof result.data[0] === 'string') pivotTerm = result.data[0];
        else if (result.data?.siren) pivotTerm = result.data.siren;
        else pivotTerm = result.title;

        if (input && pivotTerm) {
          input.value = pivotTerm;
          this.updateTypeBadge(pivotTerm);
          this.runSearch(pivotTerm);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

      feed.appendChild(card);
    }

    /**
     * Update filter counters
     */
    updateCounts(stats) {
      const all = document.getElementById('fr-count-all');
      const succ = document.getElementById('fr-count-success');
      const empty = document.getElementById('fr-count-empty');
      const err = document.getElementById('fr-count-error');

      if (all) all.textContent = stats.completed;
      if (succ) succ.textContent = stats.successCount;
      if (empty) empty.textContent = stats.emptyCount;
      if (err) err.textContent = stats.errorCount;
    }

    /**
     * Apply active filter chip and search query
     */
    applyFilters() {
      const cards = document.querySelectorAll('.fr-result-card');
      cards.forEach(card => {
        const status = card.dataset.status;
        const title = card.dataset.title || '';
        const summary = card.dataset.summary || '';

        const statusMatch = (this.activeFilter === 'all') || (status === this.activeFilter);
        const textMatch = !this.filterText || title.includes(this.filterText) || summary.includes(this.filterText);

        card.style.display = (statusMatch && textMatch) ? 'block' : 'none';
      });
    }

    /**
     * Render distinct catalog tool pivots (manual opening in browser)
     */
    renderCatalogPivots(indicator) {
      const grid = document.getElementById('fr-pivots-grid');
      if (!grid) return;

      const detected = this.engine.detectType(indicator);
      const pivots = this.engine.getCatalogPivots(detected.id, indicator);

      grid.innerHTML = pivots.map(p => `
        <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="fr-pivot-card">
          <div class="fr-pivot-card__top">
            <strong class="fr-pivot-card__name">${escapeHtml(p.name)}</strong>
            <span class="fr-pivot-card__cat">${escapeHtml(p.cat)}</span>
          </div>
          <p class="fr-pivot-card__desc">${escapeHtml(p.desc)}</p>
          <span class="fr-pivot-card__link">Ouvrir dans le navigateur ↗</span>
        </a>
      `).join('');
    }

    /**
     * Lazy rendering of the optional secondary graph view
     */
    renderGraphView() {
      const canvas = document.getElementById('fr-graph-canvas');
      if (!canvas) return;

      if (!this.graphEngine && typeof GraphEngine !== 'undefined') {
        this.graphEngine = new GraphEngine(canvas, { layout: 'force' });
      }

      if (!this.graphEngine) return;

      // Reset graph and populate with active results
      this.graphEngine.clear();

      const seedId = 'root';
      const detected = this.engine.detectType(this.activeIndicator);
      this.graphEngine.addNode({
        id: seedId,
        label: this.activeIndicator,
        type: detected.id,
        isRoot: true,
      });

      for (const r of this.engine.results) {
        if (r.status === 'success') {
          const nodeId = `res-${r.id}`;
          this.graphEngine.addNode({
            id: nodeId,
            label: r.sourceName,
            type: r.category === 'Infrastructure' ? 'infra' : (r.category === 'Identité' ? 'identity' : 'web'),
            properties: {
              title: r.title,
              summary: r.summary,
              latency: `${r.latencyMs}ms`,
            },
          });

          this.graphEngine.addEdge({
            source: seedId,
            target: nodeId,
            label: 'Extrait',
            isCandidate: false,
          });
        }
      }

      this.graphEngine.fitView();

      // Graph controls
      document.getElementById('fr-graph-fit-btn')?.addEventListener('click', () => this.graphEngine?.fitView());
      document.getElementById('fr-graph-reset-btn')?.addEventListener('click', () => this.graphEngine?.applyLayout('radial'));
    }

    /**
     * Handle Image File Upload (Local EXIF parse + SHA-256)
     */
    async handleImageUpload(file) {
      const input = document.getElementById('fr-indicator-input');
      if (input) input.value = file.name;

      const buffer = await file.arrayBuffer();

      // Compute SHA-256 locally
      let hashHex = '';
      if (crypto?.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const feed = document.getElementById('fr-results-feed');
      const welcome = document.getElementById('fr-welcome-box');
      if (feed) {
        feed.innerHTML = '';
        feed.style.display = 'flex';
      }
      if (welcome) welcome.style.display = 'none';

      // Append instant client-side image card
      this.appendResultCard({
        id: 'image_fingerprint',
        sourceName: 'Empreinte Locale du Fichier (Web Crypto)',
        category: 'Fichier',
        icon: '📷',
        status: 'success',
        title: `Image : ${file.name} (${Math.round(file.size / 1024)} Ko)`,
        summary: `Hash SHA-256 : ${hashHex || 'N/A'} · Type MIME : ${file.type}`,
        data: { fileName: file.name, size: file.size, sha256: hashHex },
        sourceUrl: '',
        timestamp: new Date().toISOString(),
        latencyMs: 12,
      });

      // Also run threat check on hash
      if (hashHex) {
        this.runSearch(hashHex);
      }
    }

    /**
     * Synchronize results into Investigation Case workspace
     */
    syncToInvestigation() {
      if (typeof investigationEngine === 'undefined') {
        alert('Module d\'investigation non disponible.');
        return;
      }

      const title = `Enquête Fast Research — ${this.activeIndicator}`;
      const inv = investigationEngine.createInvestigation({
        title,
        objective: `Collecte automatisée multi-sources pour l'indicateur ${this.activeIndicator}`,
      });

      // Add main indicator
      const detected = this.engine.detectType(this.activeIndicator);
      investigationEngine.addIndicator(inv, {
        value: this.activeIndicator,
        type: detected.id,
        label: `Indicateur racine : ${this.activeIndicator}`,
      });

      // Add successful results as findings
      let count = 0;
      for (const r of this.engine.results) {
        if (r.status === 'success') {
          investigationEngine.addFinding(inv, {
            title: r.title,
            content: r.summary || r.title,
            type: r.category.toLowerCase().includes('infra') ? 'infra' : 'account',
            confidence: 'confirmed',
            sourceName: r.sourceName,
            url: r.sourceUrl,
          });
          count++;
        }
      }

      alert(`✅ ${count} constat(s) synchronisé(s) dans le dossier d'investigation "${title}".`);
    }

    /**
     * File download utility
     */
    downloadFile(filename, text, mimeType) {
      const blob = new Blob([text], { type: mimeType });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
  }

  return FastResearchUI;
});
