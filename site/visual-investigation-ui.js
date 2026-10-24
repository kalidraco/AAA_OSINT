/**
 * AAA_OSINT — Visual Investigation UI Controller (Maltego-Inspired Workspace)
 *
 * Provides:
 * - Interactive visual investigation workspace
 * - Seed indicator input with auto-detection & Image drag-and-drop
 * - Automated parallel transforms runner with live streaming
 * - Depth-controlled recursive exploration with user abort
 * - Sliding entity inspector panel with properties, sources, relations, and type-specific transforms menu
 * - Direct pivots to the 947 AAA OSINT catalog tools
 * - Export to JSON, PNG, CSV, and seamless transfer to Investigation Case Report
 *
 * Zero external npm dependencies. Follows AAA_OSINT IIFE pattern.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VisualInvestigationUI = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function detectType(input) {
    const val = String(input || '').trim();
    if (!val) return 'text';

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'email';
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(val)) return 'ip';
    if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(val)) return 'ip';
    if (/^https?:\/\//i.test(val)) return 'url';
    if (/^((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,63}$/.test(val)) return 'domain';
    if (/^(\+?[0-9\s\-\(\)\.]{7,20})$/.test(val) && (val.startsWith('+') || val.replace(/\D/g, '').length >= 10)) return 'phone';
    if (/^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{8,87})$/i.test(val) || /^0x[a-fA-F0-9]{40}$/.test(val)) return 'crypto';
    if (/^[a-fA-F0-9]{32}$/.test(val) || /^[a-fA-F0-9]{64}$/.test(val)) return 'hash';
    if (/^@[a-zA-Z0-9_\-\.]{2,32}$/.test(val) || /^[a-zA-Z0-9_\-\.]{3,30}$/.test(val)) return 'username';

    return 'text';
  }

  class VisualInvestigationUI {
    constructor(options = {}) {
      this.container = options.container || document.getElementById('categories-container');
      this.transformsRegistry = options.transformsRegistry || null;
      this.investigationEngine = options.investigationEngine || null;
      this.showToast = options.showToast || ((msg) => console.log(msg));
      this.onNavigate = options.onNavigate || (() => {});

      // Graph Engine instance
      this.graphEngine = null;

      // Active state
      this.seedValue = '';
      this.seedType = 'domain';
      this.explorationDepth = 1;
      this.isInvestigating = false;
      this.activeAbortController = null;
      this.selectedNode = null;

      // Filter state
      this.activeTypeFilter = 'all';

      // History of executed transforms: transformId -> count
      this.executedTransforms = new Set();
    }

    t(key, params) {
      if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, params);
      }
      return key;
    }

    render(targetSeed = '') {
      if (!this.container) return;
      this.container.innerHTML = '';

      if (targetSeed) {
        this.seedValue = targetSeed;
        this.seedType = detectType(targetSeed);
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'visual-investigation-workspace';
      wrapper.innerHTML = `
        <!-- Top Toolbar Control Bar -->
        <header class="vig-header">
          <div class="vig-header__search-row">
            <div class="vig-seed-box">
              <span class="vig-seed-box__icon">🎯</span>
              <input
                type="text"
                id="vig-seed-input"
                class="vig-seed-box__input"
                placeholder="${escapeHtml(this.t('vig_seed_placeholder') || 'Saisir un nom de domaine, email, IP, pseudo, crypto...')}"
                value="${escapeHtml(this.seedValue)}"
                autocomplete="off"
                spellcheck="false"
              />
              <span class="vig-type-badge" id="vig-type-badge">${escapeHtml(this.seedType.toUpperCase())}</span>
              <label class="vig-upload-btn" title="${escapeHtml(this.t('vig_upload_image_title') || 'Importer une image pour analyse EXIF et recherche inversée')}">
                📷 <span class="desktop-only">${escapeHtml(this.t('vig_btn_image') || 'Image')}</span>
                <input type="file" id="vig-file-input" accept="image/*" style="display:none;" />
              </label>
            </div>

            <div class="vig-actions">
              <div class="vig-select-group" title="${escapeHtml(this.t('vig_depth_title') || 'Profondeur maximale des transforms automatiques')}">
                <label for="vig-depth-select">Profondeur :</label>
                <select id="vig-depth-select" class="vig-select">
                  <option value="1" ${this.explorationDepth === 1 ? 'selected' : ''}>1 (Direct)</option>
                  <option value="2" ${this.explorationDepth === 2 ? 'selected' : ''}>2 (Approfondi)</option>
                  <option value="3" ${this.explorationDepth === 3 ? 'selected' : ''}>3 (Complet)</option>
                </select>
              </div>

              <button class="btn btn--primary vig-btn-launch" id="vig-btn-launch">
                <span class="vig-btn-launch__icon">🚀</span>
                <span>${escapeHtml(this.t('vig_btn_launch') || 'Lancer l\'investigation')}</span>
              </button>

              <button class="btn btn--danger vig-btn-stop" id="vig-btn-stop" style="display:none;">
                <span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span>
                <span>${escapeHtml(this.t('vig_btn_stop') || 'Arrêter')}</span>
              </button>
            </div>
          </div>

          <div class="vig-subbar">
            <!-- Layout controls -->
            <div class="vig-subbar__group">
              <span class="vig-subbar__label">Disposition :</span>
              <button class="vig-subbar__btn is-active" data-layout="force" title="Forces physiques organiques">Forces</button>
              <button class="vig-subbar__btn" data-layout="hierarchical" title="Arborescence hiérarchique">Hiérarchie</button>
              <button class="vig-subbar__btn" data-layout="radial" title="Rayonnement circulaire">Radial</button>
              <button class="vig-subbar__btn" data-layout="grid" title="Grille matricielle">Grille</button>
            </div>

            <!-- Canvas view tools -->
            <div class="vig-subbar__group">
              <button class="vig-subbar__icon-btn" id="vig-zoom-in" title="Zoom avant (+)">➕</button>
              <button class="vig-subbar__icon-btn" id="vig-zoom-out" title="Zoom arrière (-)">➖</button>
              <button class="vig-subbar__icon-btn" id="vig-fit" title="Recentrer le graphe (0)">🎯</button>
              <button class="vig-subbar__icon-btn" id="vig-toggle-physics" title="Figer / Animer la physique (Espace)">⏸️</button>
              <button class="vig-subbar__icon-btn" id="vig-clear" title="Effacer le graphe">🗑️</button>
            </div>

            <!-- Stats & Quick Exports -->
            <div class="vig-subbar__stats" id="vig-stats-bar">
              <span>Nœuds : <strong id="vig-stat-nodes">0</strong></span>
              <span>Liens : <strong id="vig-stat-edges">0</strong></span>
            </div>

            <div class="vig-subbar__group">
              <button class="vig-subbar__btn vig-btn--export" id="vig-btn-export-png" title="Télécharger une capture PNG haute résolution">📷 PNG</button>
              <button class="vig-subbar__btn vig-btn--export" id="vig-btn-export-json" title="Enregistrer le fichier de graphe JSON réouvrable">💾 JSON</button>
              <label class="vig-subbar__btn vig-btn--export" title="Reprendre une enquête depuis un fichier JSON">
                📂 Ouvrir
                <input type="file" id="vig-file-import-json" accept=".json" style="display:none;" />
              </label>
              <button class="vig-subbar__btn vig-btn--sync" id="vig-btn-sync-report" title="Transférer toutes les entités découvertes vers le dossier d'enquête et rapport structuré">
                📄 Vers Rapport
              </button>
            </div>
          </div>
        </header>

        <!-- Main Body: Canvas + Sliding Inspector -->
        <div class="vig-main">
          <!-- Canvas Container -->
          <div class="vig-canvas-container" id="vig-canvas-container">
            <canvas id="vig-canvas" class="vig-canvas"></canvas>

            <!-- Floating Legend & Filters -->
            <div class="vig-floating-legend" id="vig-floating-legend">
              <span class="vig-legend-title">Filtre :</span>
              <button class="vig-filter-chip is-active" data-filter="all">Tous</button>
              <button class="vig-filter-chip" data-filter="domain">🌐 Domaines</button>
              <button class="vig-filter-chip" data-filter="ip">🖥️ IPs</button>
              <button class="vig-filter-chip" data-filter="email">📧 Emails</button>
              <button class="vig-filter-chip" data-filter="subdomain">🕸️ Sous-domaines</button>
              <button class="vig-filter-chip" data-filter="leak">🕳️ Fuites</button>
            </div>
          </div>

          <!-- Sliding Entity Inspector Panel -->
          <aside class="vig-inspector" id="vig-inspector">
            <div class="vig-inspector__empty" id="vig-inspector-empty">
              <div class="vig-inspector__empty-icon">🕸️</div>
              <h3>${escapeHtml(this.t('vig_inspector_empty_title') || 'Inspecteur d\'Entité')}</h3>
              <p>${escapeHtml(this.t('vig_inspector_empty_desc') || 'Cliquez sur n\'importe quel nœud du graphe pour examiner ses propriétés, ses sources et lancer des transformations ciblées (Transforms à la Maltego).')}</p>
            </div>

            <div class="vig-inspector__content" id="vig-inspector-content" style="display:none;">
              <!-- Dynamic inspector content filled on selection -->
            </div>
          </aside>
        </div>
      `;

      this.container.appendChild(wrapper);

      // Initialize Graph Canvas Engine
      const canvasEl = document.getElementById('vig-canvas');
      this.initGraphEngine(canvasEl);

      // Wire DOM events
      this.bindEvents(wrapper);

      // If seed was supplied, trigger initial run automatically
      if (this.seedValue) {
        this.startInvestigation(this.seedValue);
      }
    }

    initGraphEngine(canvasEl) {
      if (!canvasEl || typeof GraphEngine === 'undefined') return;

      this.graphEngine = new GraphEngine(canvasEl, {
        onNodeSelect: (node) => {
          this.selectedNode = node;
          this.renderInspector(node);
        },
        onNodeContextMenu: (node, e) => {
          this.selectedNode = node;
          this.renderInspector(node);
        },
        onCanvasClick: () => {
          this.selectedNode = null;
          this.clearInspector();
        },
      });

      this.updateStats();
    }

    updateStats() {
      if (!this.graphEngine) return;
      const nodes = this.graphEngine.getAllNodes();
      const edges = this.graphEngine.getAllEdges();

      const nodeCountEl = document.getElementById('vig-stat-nodes');
      const edgeCountEl = document.getElementById('vig-stat-edges');

      if (nodeCountEl) nodeCountEl.textContent = nodes.length;
      if (edgeCountEl) edgeCountEl.textContent = edges.length;
    }

    bindEvents(wrapper) {
      const seedInput = wrapper.querySelector('#vig-seed-input');
      const typeBadge = wrapper.querySelector('#vig-type-badge');
      const fileInput = wrapper.querySelector('#vig-file-input');
      const launchBtn = wrapper.querySelector('#vig-btn-launch');
      const stopBtn = wrapper.querySelector('#vig-btn-stop');
      const depthSelect = wrapper.querySelector('#vig-depth-select');

      // Realtime type detection
      if (seedInput && typeBadge) {
        seedInput.addEventListener('input', () => {
          const val = seedInput.value.trim();
          this.seedValue = val;
          this.seedType = detectType(val);
          typeBadge.textContent = this.seedType.toUpperCase();
        });

        seedInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.startInvestigation(seedInput.value);
          }
        });
      }

      // Depth selector
      if (depthSelect) {
        depthSelect.addEventListener('change', () => {
          this.explorationDepth = parseInt(depthSelect.value, 10) || 1;
        });
      }

      // Launch button
      if (launchBtn) {
        launchBtn.addEventListener('click', () => {
          this.startInvestigation(seedInput.value);
        });
      }

      // Stop button
      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          this.stopInvestigation();
        });
      }

      // File input (Image upload)
      if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            await this.handleImageUpload(file);
          }
        });
      }

      // Layout Switcher Buttons
      wrapper.querySelectorAll('[data-layout]').forEach(btn => {
        btn.addEventListener('click', () => {
          wrapper.querySelectorAll('[data-layout]').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const mode = btn.getAttribute('data-layout');
          if (this.graphEngine) {
            this.graphEngine.applyLayout(mode);
          }
        });
      });

      // Canvas Zoom & Pan Tools
      const zoomInBtn = wrapper.querySelector('#vig-zoom-in');
      const zoomOutBtn = wrapper.querySelector('#vig-zoom-out');
      const fitBtn = wrapper.querySelector('#vig-fit');
      const togglePhysicsBtn = wrapper.querySelector('#vig-toggle-physics');
      const clearBtn = wrapper.querySelector('#vig-clear');

      if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.graphEngine && this.graphEngine.zoomIn());
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.graphEngine && this.graphEngine.zoomOut());
      if (fitBtn) fitBtn.addEventListener('click', () => this.graphEngine && this.graphEngine.fitView());
      if (togglePhysicsBtn) {
        togglePhysicsBtn.addEventListener('click', () => {
          if (!this.graphEngine) return;
          this.graphEngine.togglePhysics();
          togglePhysicsBtn.textContent = this.graphEngine.isPhysicsActive ? '⏸️' : '▶️';
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (confirm('Effacer tous les éléments du graphe d\'investigation ?')) {
            if (this.graphEngine) this.graphEngine.clear();
            this.clearInspector();
            this.updateStats();
            this.showToast('Graphe réinitialisé');
          }
        });
      }

      // Filter Chips
      wrapper.querySelectorAll('.vig-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          wrapper.querySelectorAll('.vig-filter-chip').forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');
          const type = chip.getAttribute('data-filter');
          this.filterNodesByType(type);
        });
      });

      // Exports
      const exportPngBtn = wrapper.querySelector('#vig-btn-export-png');
      const exportJsonBtn = wrapper.querySelector('#vig-btn-export-json');
      const importJsonInput = wrapper.querySelector('#vig-file-import-json');
      const syncReportBtn = wrapper.querySelector('#vig-btn-sync-report');

      if (exportPngBtn) {
        exportPngBtn.addEventListener('click', () => {
          if (this.graphEngine) this.graphEngine.exportPNG();
        });
      }

      if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
          if (!this.graphEngine) return;
          const jsonStr = this.graphEngine.exportJSON();
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `investigation_graph_${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.showToast('Graphe exporté au format JSON');
        });
      }

      if (importJsonInput) {
        importJsonInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              if (this.graphEngine) {
                this.graphEngine.importJSON(evt.target.result);
                this.updateStats();
                this.showToast('Graphe chargé avec succès');
              }
            } catch (err) {
              alert('Fichier JSON invalide: ' + err.message);
            }
          };
          reader.readAsText(file);
        });
      }

      if (syncReportBtn) {
        syncReportBtn.addEventListener('click', () => {
          this.syncGraphToCaseInvestigation();
        });
      }
    }

    filterNodesByType(type) {
      if (!this.graphEngine) return;
      this.graphEngine.getAllNodes().forEach(node => {
        node.hidden = (type !== 'all' && node.type !== type);
      });
      this.graphEngine.requestRender();
    }

    // ------------------------------------------------------------------------
    // Image Upload Handling
    // ------------------------------------------------------------------------
    async handleImageUpload(file) {
      if (!this.transformsRegistry) return;
      try {
        const { entity } = await this.transformsRegistry.processImageFile(file);
        if (this.graphEngine) {
          const addedNode = this.graphEngine.addNode(entity);
          this.graphEngine.fitView();
          this.selectedNode = addedNode;
          this.renderInspector(addedNode);
          this.updateStats();
          this.showToast(`Image « ${file.name} » analysée et ajoutée au graphe`);
        }
      } catch (err) {
        alert('Erreur traitement image: ' + err.message);
      }
    }

    // ------------------------------------------------------------------------
    // Investigation Automation Runner (Multi-Threaded / Parallel Transforms)
    // ------------------------------------------------------------------------
    async startInvestigation(initialTerm) {
      const term = String(initialTerm || this.seedValue || '').trim();
      if (!term) {
        this.showToast('Veuillez renseigner un indice valide');
        return;
      }

      this.seedValue = term;
      this.seedType = detectType(term);

      if (!this.graphEngine || !this.transformsRegistry) return;

      this.isInvestigating = true;
      this.activeAbortController = new AbortController();

      const launchBtn = document.getElementById('vig-btn-launch');
      const stopBtn = document.getElementById('vig-btn-stop');
      if (launchBtn) launchBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-flex';

      try {
        // 1. Create or ensure Seed Root Node exists
        const rootId = `seed_${term.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
        let rootNode = this.graphEngine.getNode(rootId);
        if (!rootNode) {
          rootNode = this.graphEngine.addNode({
            id: rootId,
            type: this.seedType,
            label: term,
            properties: {
              [this.seedType]: term,
              isSeed: true,
              detectionType: this.seedType,
            },
            sources: [{ name: 'Indice Initial Déclaré', url: '', date: new Date().toISOString() }],
            confidence: 'verified',
            x: 0,
            y: 0,
            pinned: true,
          });
        }

        this.selectedNode = rootNode;
        this.renderInspector(rootNode);
        this.updateStats();

        // 2. Discover applicable transforms for root
        await this.runTransformsOnNode(rootNode, 1);

        this.graphEngine.fitView();
        this.showToast(`Recherche sur « ${term} » terminée avec succès`);
      } catch (err) {
        if (err.name === 'AbortError') {
          this.showToast('Investigation interrompue par l\'analyste');
        } else {
          this.showToast(`Erreur d'investigation: ${err.message}`);
        }
      } finally {
        this.isInvestigating = false;
        this.activeAbortController = null;
        if (launchBtn) launchBtn.style.display = 'inline-flex';
        if (stopBtn) stopBtn.style.display = 'none';
      }
    }

    stopInvestigation() {
      if (this.activeAbortController) {
        this.activeAbortController.abort();
      }
      this.isInvestigating = false;
      const launchBtn = document.getElementById('vig-btn-launch');
      const stopBtn = document.getElementById('vig-btn-stop');
      if (launchBtn) launchBtn.style.display = 'inline-flex';
      if (stopBtn) stopBtn.style.display = 'none';
    }

    async runTransformsOnNode(node, currentDepth = 1) {
      if (!node || !this.transformsRegistry) return;

      const applicable = this.transformsRegistry.getApplicableTransforms(node.type);
      if (applicable.length === 0) return;

      const newlyDiscoveredNodes = [];

      // Run applicable transforms in parallel
      await Promise.allSettled(applicable.map(async (transform) => {
        if (this.activeAbortController && this.activeAbortController.signal.aborted) return;

        const cacheKey = `${node.id}_${transform.id}`;
        if (this.executedTransforms.has(cacheKey)) return; // Avoid duplicate runs
        this.executedTransforms.add(cacheKey);

        try {
          const result = await transform.execute(node, { signal: this.activeAbortController?.signal });
          if (!result || !result.success) return;

          // 1. Merge properties onto node
          if (result.propertiesToAdd) {
            node.properties = Object.assign({}, node.properties, result.propertiesToAdd);
          }

          // 2. Add newly discovered entities
          (result.newEntities || []).forEach(ent => {
            const added = this.graphEngine.addNode(ent);
            if (added) newlyDiscoveredNodes.push(added);
          });

          // 3. Add relationships
          (result.newEdges || []).forEach(edge => {
            this.graphEngine.addEdge(edge);
          });

          this.updateStats();

          // Live update inspector if this node is currently selected
          if (this.selectedNode && this.selectedNode.id === node.id) {
            this.renderInspector(node);
          }
        } catch (err) {
          console.warn(`Transform ${transform.id} failed:`, err);
        }
      }));

      // Recursive depth expansion if requested
      if (currentDepth < this.explorationDepth && newlyDiscoveredNodes.length > 0) {
        // Expand top 4 nodes to prevent combinatorial explosion
        for (const childNode of newlyDiscoveredNodes.slice(0, 4)) {
          if (this.activeAbortController && this.activeAbortController.signal.aborted) break;
          await this.runTransformsOnNode(childNode, currentDepth + 1);
        }
      }
    }

    // ------------------------------------------------------------------------
    // Sliding Entity Inspector Panel
    // ------------------------------------------------------------------------
    renderInspector(node) {
      const emptyEl = document.getElementById('vig-inspector-empty');
      const contentEl = document.getElementById('vig-inspector-content');
      if (!contentEl) return;

      if (!node) {
        this.clearInspector();
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      contentEl.style.display = 'block';

      const applicableTransforms = this.transformsRegistry
        ? this.transformsRegistry.getApplicableTransforms(node.type)
        : [];

      const pivots = this.transformsRegistry
        ? this.transformsRegistry.getCatalogPivots(node.type, node.properties[node.type] || node.label)
        : [];

      const neighbors = this.graphEngine ? this.graphEngine.getNeighbors(node.id) : [];
      const edges = this.graphEngine ? this.graphEngine.getConnectedEdges(node.id) : [];

      contentEl.innerHTML = `
        <div class="vig-insp-header">
          <div class="vig-insp-header__avatar" style="border-color:${node.color};color:${node.color};">
            ${node.icon}
          </div>
          <div class="vig-insp-header__meta">
            <span class="vig-insp-type" style="color:${node.color};">${node.type.toUpperCase()}</span>
            <h3 class="vig-insp-title" title="${escapeHtml(node.label)}">${escapeHtml(node.label)}</h3>
            <span class="vig-insp-badge ${node.confidence === 'verified' ? 'vig-insp-badge--verified' : 'vig-insp-badge--candidate'}">
              ${node.confidence === 'verified' ? '✓ Relation Vérifiée' : '⚠️ Relation Candidate'}
            </span>
          </div>
        </div>

        <!-- Node Action Buttons -->
        <div class="vig-insp-actions">
          <button class="btn btn--secondary btn--sm" id="vig-btn-focus-node" title="Centrer la caméra sur ce nœud">
            🎯 Centrer
          </button>
          <button class="btn btn--secondary btn--sm" id="vig-btn-pin-node">
            ${node.pinned ? '📌 Débloquer' : '📌 Épingler'}
          </button>
          <button class="btn btn--secondary btn--sm" id="vig-btn-hide-node" title="Masquer du graphe sans supprimer">
            👁️ Masquer
          </button>
          <button class="btn btn--danger btn--sm" id="vig-btn-delete-node" title="Supprimer visuellement">
            🗑️ Supprimer
          </button>
        </div>

        <!-- Image Preview if Image Node -->
        ${node.previewUrl ? `
          <div class="vig-insp-preview">
            <img src="${node.previewUrl}" alt="Preview" class="vig-insp-preview__img" />
          </div>
        ` : ''}

        <!-- Transforms Menu (Maltego Style) -->
        <div class="vig-insp-section">
          <div class="vig-insp-section__header">
            <h4>⚡ Transformations Disponibles (${applicableTransforms.length})</h4>
            ${applicableTransforms.length > 0 ? `
              <button class="btn btn--primary btn--xs" id="vig-btn-run-all-transforms">
                Exécuter tout
              </button>
            ` : ''}
          </div>

          ${applicableTransforms.length === 0 ? `
            <div class="vig-insp-empty-msg">Aucune transformation automatisée disponible pour ce type d'entité.</div>
          ` : `
            <div class="vig-transforms-list">
              ${applicableTransforms.map(tr => `
                <div class="vig-transform-card" data-transform-id="${tr.id}">
                  <div class="vig-transform-card__info">
                    <span class="vig-transform-card__title">${escapeHtml(tr.name_fr)}</span>
                    <span class="vig-transform-card__desc">${escapeHtml(tr.description_fr)}</span>
                  </div>
                  <button class="btn btn--secondary btn--xs vig-btn-exec-single" data-transform-id="${tr.id}">
                    Exécuter
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Catalog Tool Pivots (947 Tools Pre-filled) -->
        ${pivots.length > 0 ? `
          <div class="vig-insp-section">
            <div class="vig-insp-section__header">
              <h4>🔗 Pivots Outils Catalogue (${pivots.length})</h4>
            </div>
            <div class="vig-pivots-list">
              ${pivots.map(p => `
                <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="vig-pivot-item">
                  <span class="vig-pivot-item__icon">↗</span>
                  <div class="vig-pivot-item__text">
                    <strong>${escapeHtml(p.name)}</strong>
                    <span class="vig-pivot-item__cat">${escapeHtml(p.category)}</span>
                  </div>
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Observed Properties Table -->
        <div class="vig-insp-section">
          <div class="vig-insp-section__header">
            <h4>📋 Attributs & Propriétés Observées</h4>
          </div>
          <table class="vig-props-table">
            <tbody>
              ${Object.entries(node.properties || {}).map(([key, val]) => `
                <tr>
                  <td class="vig-props-key">${escapeHtml(key)}</td>
                  <td class="vig-props-val">${escapeHtml(String(val))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Direct Relations -->
        <div class="vig-insp-section">
          <div class="vig-insp-section__header">
            <h4>🕸️ Relations Directes (${neighbors.length})</h4>
          </div>
          ${neighbors.length === 0 ? `
            <div class="vig-insp-empty-msg">Nœud isolé (aucune relation établie).</div>
          ` : `
            <div class="vig-neighbors-list">
              ${neighbors.map(nb => `
                <div class="vig-neighbor-chip" data-node-id="${nb.id}">
                  <span>${nb.icon}</span>
                  <strong title="${escapeHtml(nb.label)}">${escapeHtml(nb.label)}</strong>
                  <span class="vig-neighbor-chip__type">(${nb.type})</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Sources Provenance -->
        <div class="vig-insp-section">
          <div class="vig-insp-section__header">
            <h4>📚 Sources & Traçabilité</h4>
          </div>
          ${(node.sources || []).length === 0 ? `
            <div class="vig-insp-empty-msg">Aucune source externe enregistrée.</div>
          ` : `
            <div class="vig-sources-list">
              ${node.sources.map(src => `
                <div class="vig-source-entry">
                  <strong>${escapeHtml(src.name)}</strong>
                  ${src.url ? `<a href="${src.url}" target="_blank" rel="noopener noreferrer">Consulter la source</a>` : ''}
                  <span class="vig-source-date">${src.date ? new Date(src.date).toLocaleString() : ''}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;

      // Wire Inspector Actions
      const focusBtn = contentEl.querySelector('#vig-btn-focus-node');
      const pinBtn = contentEl.querySelector('#vig-btn-pin-node');
      const hideBtn = contentEl.querySelector('#vig-btn-hide-node');
      const deleteBtn = contentEl.querySelector('#vig-btn-delete-node');
      const runAllBtn = contentEl.querySelector('#vig-btn-run-all-transforms');

      if (focusBtn) {
        focusBtn.addEventListener('click', () => {
          if (this.graphEngine) {
            this.graphEngine.camera.x = this.graphEngine.width / 2 - node.x * this.graphEngine.camera.zoom;
            this.graphEngine.camera.y = this.graphEngine.height / 2 - node.y * this.graphEngine.camera.zoom;
            this.graphEngine.requestRender();
          }
        });
      }

      if (pinBtn) {
        pinBtn.addEventListener('click', () => {
          node.pinned = !node.pinned;
          pinBtn.textContent = node.pinned ? '📌 Débloquer' : '📌 Épingler';
          this.graphEngine.requestRender();
        });
      }

      if (hideBtn) {
        hideBtn.addEventListener('click', () => {
          node.hidden = true;
          this.selectedNode = null;
          this.clearInspector();
          this.graphEngine.requestRender();
          this.showToast('Nœud masqué de la vue visuelle');
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          this.graphEngine.removeNode(node.id);
          this.selectedNode = null;
          this.clearInspector();
          this.updateStats();
          this.showToast('Nœud supprimé du graphe');
        });
      }

      if (runAllBtn) {
        runAllBtn.addEventListener('click', async () => {
          runAllBtn.disabled = true;
          runAllBtn.textContent = 'En cours...';
          await this.runTransformsOnNode(node, 1);
          runAllBtn.disabled = false;
          runAllBtn.textContent = 'Exécuter tout';
          this.showToast('Transformations appliquées');
        });
      }

      // Single Transform Execution
      contentEl.querySelectorAll('.vig-btn-exec-single').forEach(btn => {
        btn.addEventListener('click', async () => {
          const transformId = btn.getAttribute('data-transform-id');
          const transform = applicableTransforms.find(t => t.id === transformId);
          if (!transform) return;

          btn.disabled = true;
          btn.textContent = '...';

          try {
            const res = await transform.execute(node);
            if (res && res.success) {
              if (res.propertiesToAdd) {
                node.properties = Object.assign({}, node.properties, res.propertiesToAdd);
              }
              (res.newEntities || []).forEach(ent => this.graphEngine.addNode(ent));
              (res.newEdges || []).forEach(edge => this.graphEngine.addEdge(edge));
              this.updateStats();
              this.renderInspector(node);
              this.showToast(`Transformation « ${transform.name_fr} » exécutée`);
            }
          } catch (err) {
            alert('Échec transform: ' + err.message);
          } finally {
            btn.disabled = false;
            btn.textContent = 'Exécuter';
          }
        });
      });

      // Jump to neighbor node
      contentEl.querySelectorAll('.vig-neighbor-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const neighborId = chip.getAttribute('data-node-id');
          const target = this.graphEngine.getNode(neighborId);
          if (target) {
            this.graphEngine.selectNode(target.id, false);
            this.selectedNode = target;
            this.renderInspector(target);
          }
        });
      });
    }

    clearInspector() {
      const emptyEl = document.getElementById('vig-inspector-empty');
      const contentEl = document.getElementById('vig-inspector-content');
      if (emptyEl) emptyEl.style.display = 'flex';
      if (contentEl) contentEl.style.display = 'none';
    }

    // ------------------------------------------------------------------------
    // Sync with Case Management (Transférer vers le Rapport d'Enquête)
    // ------------------------------------------------------------------------
    syncGraphToCaseInvestigation() {
      if (!this.graphEngine || !this.investigationEngine) {
        this.showToast('Moteur d\'investigation non configuré');
        return;
      }

      const nodes = this.graphEngine.getAllNodes();
      const edges = this.graphEngine.getAllEdges();

      if (nodes.length === 0) {
        this.showToast('Graphe vide : aucun élément à transférer');
        return;
      }

      // Create new investigation case from graph
      const caseName = `Investigation Graphe — ${this.seedValue || 'Visual OSINT'} (${new Date().toLocaleDateString()})`;
      const inv = this.investigationEngine.createInvestigation({
        name: caseName,
        context: `Investigation visuelle multi-sources à la Maltego à partir de l'indice [${this.seedValue}]. Contient ${nodes.length} entités et ${edges.length} relations vérifiées.`,
        objective: `Identifier et recouper l'infrastructure, les comptes et les empreintes rattachés à ${this.seedValue}.`,
      });

      // Add indicators
      nodes.forEach(n => {
        this.investigationEngine.addIndicator(inv, {
          value: n.label,
          type: n.type,
          context: `Découvert via transform sur le graphe (confiance: ${n.confidence})`,
        });

        // Add finding for significant properties
        const propKeys = Object.keys(n.properties || {});
        if (propKeys.length > 0) {
          const summary = propKeys.slice(0, 4).map(k => `${k}: ${n.properties[k]}`).join(', ');
          this.investigationEngine.addFinding(inv, {
            title: `Entité ${n.type.toUpperCase()}: ${n.label}`,
            description: summary,
            findingType: n.type === 'leak' ? 'credential_breach' : (n.type === 'ip' ? 'network_infra' : 'profile_found'),
            confidence: n.confidence === 'verified' ? 'confirmed' : 'probable',
            sources: n.sources || [],
          });
        }
      });

      // Trigger auto-correlate
      this.investigationEngine.correlateResults(inv);

      // Save to server
      this.investigationEngine.saveInvestigation(inv);

      this.showToast(`Dossier d'enquête créé avec ${nodes.length} entités`);

      // Switch to investigation view
      if (typeof this.onNavigate === 'function') {
        this.onNavigate('investigation');
      }
    }
  }

  return VisualInvestigationUI;
});
