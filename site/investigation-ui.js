/**
 * AAA_OSINT — Investigation UI Controller
 *
 * Dedicated, cyber-themed, high-productivity interface for:
 * - Multi-source OSINT investigations
 * - Dynamic indicator detection & catalog tool recommendation (947 tools)
 * - Automated intelligence gathering via IntelX proxy
 * - Evidence & findings recording with confidence scoring
 * - Cross-referencing & correlation matrix
 * - Comprehensive 6-section report generation with Markdown / HTML / PDF export
 * - Investigation persistence (REST API + LocalStorage fallback)
 *
 * Zero external dependencies. Follows AAA_OSINT IIFE pattern.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InvestigationUI = factory();
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

  function formatDate(isoStr, lang = 'fr') {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  }

  class InvestigationUI {
    constructor(engine, options = {}) {
      this.engine = engine;
      this.container = options.container || document.getElementById('categories-container');
      this.catalogData = options.catalogData || null;
      this.intelxClient = options.intelxClient || null;
      this.onNavigate = options.onNavigate || (() => {});
      this.showToast = options.showToast || ((msg) => console.log(msg));

      // Active investigation in workspace
      this.currentInvestigation = null;

      // Active UI tab: 'indicators' | 'tools' | 'findings' | 'correlations' | 'report' | 'saved'
      this.activeTab = 'indicators';

      // Filtering state
      this.selectedIndicatorFilter = 'all';
      this.selectedCategoryFilter = 'all';
      this.toolSearchQuery = '';
      this.findingsFilter = 'all';

      // IntelX automated scan state
      this.isScanningIntelX = false;
      this.intelxScanResults = [];
      this.activeScanIndicator = null;

      // Modal state
      this.activeModal = null;

      // Saved investigations cache
      this.savedList = [];

      // Initialize default investigation if none loaded
      this.initDefaultInvestigation();
    }

    t(key, params) {
      if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, params);
      }
      return key;
    }

    getLang() {
      if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.getLang === 'function') {
        return window.i18n.getLang();
      }
      return 'fr';
    }

    initDefaultInvestigation() {
      if (!this.currentInvestigation) {
        this.currentInvestigation = this.engine.createInvestigation({
          name: this.getLang() === 'fr' ? 'Nouvelle Enquête OSINT' : 'New OSINT Investigation',
          context: '',
        });
      }
    }

    addQuickIndicator(value) {
      if (!value || !this.currentInvestigation) return;
      const detected = this.engine.detectIndicatorType(value);
      this.engine.addIndicator(this.currentInvestigation, value, detected.id);
      this.activeTab = 'indicators';
      this.render();
      this.showToast(this.t('toast_indicator_added'));
    }

    // ── Main Render Entry Point ──────────────────────────────────────────

    async render() {
      if (!this.container) return;
      const isFr = this.getLang() === 'fr';

      const inv = this.currentInvestigation;
      const indicatorCount = inv ? inv.indicators.length : 0;
      const findingsCount = inv ? inv.findings.length : 0;
      const correlationsCount = inv ? inv.correlations.length : 0;

      this.container.innerHTML = `
        <div class="investigation-workspace" id="investigation-workspace">
          <!-- Main Module Header -->
          <div class="inv-header">
            <div class="inv-header__main">
              <div class="inv-header__badge-wrap">
                <span class="inv-header__badge">AAA OSINT v2.2</span>
                <span class="inv-header__tag">WORKSPACE D'ENQUÊTE</span>
                <span class="inv-status-pill inv-status-pill--${inv.status}">${this.formatStatus(inv.status)}</span>
              </div>
              <h2 class="inv-header__title">
                <span class="inv-header__icon">🕵️</span>
                <span class="inv-title-editable" id="inv-title-display" title="${isFr ? 'Cliquer pour renommer' : 'Click to rename'}">
                  ${escapeHtml(inv.name)}
                </span>
                <button class="inv-btn-icon" id="inv-edit-title-btn" title="${isFr ? 'Modifier le titre et le contexte' : 'Edit title & context'}">✏️</button>
              </h2>
              <p class="inv-header__desc">
                ${inv.context ? escapeHtml(inv.context) : `<em class="text-muted">${isFr ? 'Aucun contexte défini. Cliquez sur le crayon pour préciser le contexte ou l\'objectif.' : 'No context defined. Click edit to set objective or context.'}</em>`}
              </p>
            </div>

            <div class="inv-header__actions">
              <button class="inv-btn inv-btn--secondary" id="inv-saved-cases-btn">
                <span class="inv-btn__icon">📁</span>
                <span>${this.t('tab_saved')}</span>
              </button>
              <button class="inv-btn inv-btn--primary" id="inv-save-case-btn">
                <span class="inv-btn__icon">💾</span>
                <span>${this.t('save_investigation')}</span>
              </button>
              <button class="inv-btn inv-btn--accent" id="inv-new-case-btn">
                <span class="inv-btn__icon">➕</span>
                <span>${this.t('new_investigation')}</span>
              </button>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <nav class="inv-tabs" role="tablist">
            <button class="inv-tab ${this.activeTab === 'indicators' ? 'is-active' : ''}" data-tab="indicators">
              <span class="inv-tab__icon">🎯</span>
              <span class="inv-tab__label">${this.t('tab_indicators')}</span>
              <span class="inv-tab__count">${indicatorCount}</span>
            </button>
            <button class="inv-tab ${this.activeTab === 'tools' ? 'is-active' : ''}" data-tab="tools">
              <span class="inv-tab__icon">🧰</span>
              <span class="inv-tab__label">${this.t('tab_tools')}</span>
            </button>
            <button class="inv-tab ${this.activeTab === 'findings' ? 'is-active' : ''}" data-tab="findings">
              <span class="inv-tab__icon">📋</span>
              <span class="inv-tab__label">${this.t('tab_findings')}</span>
              <span class="inv-tab__count">${findingsCount}</span>
            </button>
            <button class="inv-tab ${this.activeTab === 'correlations' ? 'is-active' : ''}" data-tab="correlations">
              <span class="inv-tab__icon">🔄</span>
              <span class="inv-tab__label">${this.t('tab_correlations')}</span>
              <span class="inv-tab__count">${correlationsCount}</span>
            </button>
            <button class="inv-tab ${this.activeTab === 'report' ? 'is-active' : ''}" data-tab="report">
              <span class="inv-tab__icon">📑</span>
              <span class="inv-tab__label">${this.t('tab_report')}</span>
            </button>
          </nav>

          <!-- Tab Content Container -->
          <div class="inv-content" id="inv-tab-content">
            <!-- Rendered dynamically -->
          </div>

          <!-- Modal Layer -->
          <div class="inv-modal-overlay" id="inv-modal-overlay" style="display: none;"></div>
        </div>
      `;

      this.bindHeaderEvents();
      this.bindTabEvents();
      this.renderActiveTab();
    }

    formatStatus(status) {
      const isFr = this.getLang() === 'fr';
      switch (status) {
        case 'active':
        case 'in_progress':
          return isFr ? 'En cours' : 'In Progress';
        case 'completed':
        case 'closed':
          return isFr ? 'Clôturée' : 'Completed';
        case 'draft':
        default:
          return isFr ? 'Brouillon' : 'Draft';
      }
    }

    // ── Tab Dispatcher ───────────────────────────────────────────────────

    renderActiveTab() {
      const container = document.getElementById('inv-tab-content');
      if (!container) return;

      switch (this.activeTab) {
        case 'indicators':
          this.renderIndicatorsTab(container);
          break;
        case 'tools':
          this.renderToolsTab(container);
          break;
        case 'findings':
          this.renderFindingsTab(container);
          break;
        case 'correlations':
          this.renderCorrelationsTab(container);
          break;
        case 'report':
          this.renderReportTab(container);
          break;
        case 'saved':
          this.renderSavedTab(container);
          break;
      }
    }

    // ── TAB 1: Indicators & Context ──────────────────────────────────────

    renderIndicatorsTab(container) {
      const isFr = this.getLang() === 'fr';
      const inv = this.currentInvestigation;
      const typeList = Object.values(InvestigationEngine.INDICATOR_TYPES);

      let indicatorsHtml = '';
      if (!inv.indicators || inv.indicators.length === 0) {
        indicatorsHtml = `
          <div class="inv-empty-state">
            <span class="inv-empty-state__icon">🎯</span>
            <h3>${isFr ? 'Aucun indice pour le moment' : 'No starting indicators yet'}</h3>
            <p>${isFr ? 'Saisissez votre premier indice ci-dessus (email, pseudonyme, domaine, numéro de téléphone, IP, etc.) pour lancer la cartographie d\'outils et les recoupements.' : 'Enter your first indicator above (email, handle, domain, phone number, IP, etc.) to map relevant tools and cross-reference.'}</p>
          </div>
        `;
      } else {
        indicatorsHtml = `
          <div class="inv-indicators-grid">
            ${inv.indicators.map(ind => {
              const typeInfo = InvestigationEngine.INDICATOR_TYPES[ind.type] || InvestigationEngine.INDICATOR_TYPES.text;
              const tools = this.engine.getRecommendedTools(ind.type, 100);
              const toolCount = tools.length;
              return `
                <div class="inv-indicator-card" data-id="${ind.id}">
                  <div class="inv-indicator-card__header">
                    <span class="inv-type-badge">
                      <span class="inv-type-badge__icon">${typeInfo.icon}</span>
                      <span class="inv-type-badge__name">${isFr ? typeInfo.label_fr : typeInfo.label_en}</span>
                    </span>
                    <button class="inv-btn-icon inv-btn-icon--danger" data-action="delete-indicator" data-id="${ind.id}" title="${isFr ? 'Supprimer cet indice' : 'Delete this indicator'}">✕</button>
                  </div>
                  <div class="inv-indicator-card__body">
                    <div class="inv-indicator-value" title="${isFr ? 'Cliquer pour copier' : 'Click to copy'}" data-action="copy-val" data-val="${escapeHtml(ind.value)}">
                      <code>${escapeHtml(ind.value)}</code>
                      <span class="inv-copy-icon">📋</span>
                    </div>
                    ${ind.context ? `<div class="inv-indicator-context">${escapeHtml(ind.context)}</div>` : ''}
                  </div>
                  <div class="inv-indicator-card__footer">
                    <button class="inv-btn inv-btn--xs inv-btn--secondary" data-action="view-tools" data-type="${ind.type}" data-val="${escapeHtml(ind.value)}">
                      🧰 ${toolCount} ${isFr ? 'outils catalogués' : 'catalog tools'}
                    </button>
                    ${this.isIntelXSupported(ind.type) ? `
                      <button class="inv-btn inv-btn--xs inv-btn--cyan" data-action="intelx-quick-scan" data-id="${ind.id}" data-val="${escapeHtml(ind.value)}">
                        ⚡ IntelX
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      container.innerHTML = `
        <div class="inv-tab-body">
          <!-- Add Indicator Console Card -->
          <div class="inv-card inv-add-indicator-card">
            <div class="inv-card__header">
              <h3 class="inv-card__title">
                <span class="inv-card__icon">➕</span>
                ${isFr ? 'Ajouter un indice d\'investigation' : 'Add an investigation indicator'}
              </h3>
              <span class="inv-card__hint">
                ${isFr ? 'Détection automatique du type en temps réel' : 'Real-time automatic type detection'}
              </span>
            </div>

            <form class="inv-add-form" id="inv-add-indicator-form">
              <div class="inv-form-row">
                <div class="inv-input-group inv-input-group--value">
                  <div class="inv-input-wrap">
                    <input
                      type="text"
                      class="inv-input inv-input--lg"
                      id="inv-indicator-input"
                      placeholder="${isFr ? 'Ex: target@domain.com, john_doe, 192.168.1.1, +33612345678, example.com...' : 'E.g. target@domain.com, john_doe, 192.168.1.1, +33612345678, example.com...'}"
                      autocomplete="off"
                      required
                    />
                    <div class="inv-detected-badge" id="inv-detected-badge">
                      <span id="inv-detected-icon">🔍</span>
                      <span id="inv-detected-label">${isFr ? 'Texte' : 'Text'}</span>
                    </div>
                  </div>
                </div>

                <div class="inv-input-group inv-input-group--type">
                  <select class="inv-select inv-select--lg" id="inv-indicator-type-override">
                    <option value="">${isFr ? '— Détection auto —' : '— Auto detect —'}</option>
                    ${typeList.map(t => `
                      <option value="${t.id}">${t.icon} ${isFr ? t.label_fr : t.label_en}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="inv-form-row inv-form-row--secondary">
                <input
                  type="text"
                  class="inv-input inv-input--sm"
                  id="inv-indicator-context"
                  placeholder="${isFr ? 'Contexte optionnel (ex: vu dans un tweet, suspect principal, mentionné dans le rapport X...)' : 'Optional context (e.g. found in leak, primary suspect, seen in document...)'}"
                />
                <button type="submit" class="inv-btn inv-btn--primary">
                  <span>${isFr ? '+ Ajouter l\'indice' : '+ Add Indicator'}</span>
                </button>
              </div>
            </form>

            <!-- Sample / Quick Test Chips -->
            <div class="inv-sample-chips">
              <span class="inv-sample-label">${isFr ? 'Exemples d\'indices :' : 'Sample indicators:'}</span>
              <button class="inv-sample-chip" data-sample="contact@proton.me">📧 contact@proton.me</button>
              <button class="inv-sample-chip" data-sample="cyber_sherlock">🏷️ cyber_sherlock</button>
              <button class="inv-sample-chip" data-sample="8.8.8.8">🖥️ 8.8.8.8</button>
              <button class="inv-sample-chip" data-sample="github.com">🌐 github.com</button>
              <button class="inv-sample-chip" data-sample="+33612345678">📱 +33612345678</button>
            </div>
          </div>

          <!-- Starting Indicators List -->
          <div class="inv-section-header">
            <h3 class="inv-section-title">
              <span>🎯 ${isFr ? 'Indices enregistrés' : 'Recorded Indicators'}</span>
              <span class="inv-badge">${inv.indicators.length}</span>
            </h3>
            ${inv.indicators.length > 0 ? `
              <div class="inv-section-actions">
                <button class="inv-btn inv-btn--sm inv-btn--accent" id="inv-go-to-tools-btn">
                  🧰 ${isFr ? 'Voir tous les outils recommandés' : 'View all recommended tools'} →
                </button>
              </div>
            ` : ''}
          </div>

          ${indicatorsHtml}
        </div>
      `;

      this.bindIndicatorsTabEvents(container);
    }

    bindIndicatorsTabEvents(container) {
      const isFr = this.getLang() === 'fr';
      const input = container.querySelector('#inv-indicator-input');
      const badge = container.querySelector('#inv-detected-badge');
      const icon = container.querySelector('#inv-detected-icon');
      const label = container.querySelector('#inv-detected-label');
      const override = container.querySelector('#inv-indicator-type-override');
      const form = container.querySelector('#inv-add-indicator-form');

      // Real-time auto detection
      if (input) {
        input.addEventListener('input', () => {
          const val = input.value;
          if (override.value) {
            const selected = InvestigationEngine.INDICATOR_TYPES[override.value];
            if (selected) {
              icon.textContent = selected.icon;
              label.textContent = isFr ? selected.label_fr : selected.label_en;
            }
            return;
          }
          const detected = this.engine.detectIndicatorType(val);
          icon.textContent = detected.icon;
          label.textContent = isFr ? detected.label_fr : detected.label_en;
        });

        override.addEventListener('change', () => {
          if (override.value) {
            const selected = InvestigationEngine.INDICATOR_TYPES[override.value];
            if (selected) {
              icon.textContent = selected.icon;
              label.textContent = isFr ? selected.label_fr : selected.label_en;
            }
          } else {
            const detected = this.engine.detectIndicatorType(input.value);
            icon.textContent = detected.icon;
            label.textContent = isFr ? detected.label_fr : detected.label_en;
          }
        });
      }

      // Add indicator form submit
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const val = input.value.trim();
          if (!val) return;
          const type = override.value || null;
          const context = container.querySelector('#inv-indicator-context').value.trim();

          this.engine.addIndicator(this.currentInvestigation, val, type, context);
          this.engine.autoCorrelate(this.currentInvestigation);
          this.render();
          this.showToast(this.t('toast_indicator_added'));
        });
      }

      // Sample chips click
      container.querySelectorAll('.inv-sample-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const sample = chip.dataset.sample;
          if (input) {
            input.value = sample;
            input.dispatchEvent(new Event('input'));
            input.focus();
          }
        });
      });

      // Actions on indicator cards
      container.querySelectorAll('[data-action="delete-indicator"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          this.engine.removeIndicator(this.currentInvestigation, id);
          this.render();
        });
      });

      container.querySelectorAll('[data-action="copy-val"]').forEach(elem => {
        elem.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(elem.dataset.val);
            this.showToast(this.t('toast_copy_success'));
          } catch {
            this.showToast(this.t('toast_copy_fail'));
          }
        });
      });

      container.querySelectorAll('[data-action="view-tools"]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.selectedIndicatorFilter = btn.dataset.val;
          this.activeTab = 'tools';
          this.render();
        });
      });

      container.querySelectorAll('[data-action="intelx-quick-scan"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.val;
          this.activeScanIndicator = val;
          this.activeTab = 'findings';
          this.render();
          this.launchIntelXScan(val);
        });
      });

      const goToolsBtn = container.querySelector('#inv-go-to-tools-btn');
      if (goToolsBtn) {
        goToolsBtn.addEventListener('click', () => {
          this.selectedIndicatorFilter = 'all';
          this.activeTab = 'tools';
          this.render();
        });
      }
    }

    isIntelXSupported(type) {
      return ['email', 'domain', 'ip', 'phone', 'hash', 'url'].includes(type);
    }

    // ── TAB 2: Recommended Tools ─────────────────────────────────────────

    renderToolsTab(container) {
      const isFr = this.getLang() === 'fr';
      const inv = this.currentInvestigation;

      if (!inv.indicators || inv.indicators.length === 0) {
        container.innerHTML = `
          <div class="inv-tab-body">
            <div class="inv-empty-state">
              <span class="inv-empty-state__icon">🧰</span>
              <h3>${isFr ? 'Aucun indice saisi' : 'No indicators entered'}</h3>
              <p>${isFr ? 'Veuillez d\'abord ajouter un ou plusieurs indices dans l\'onglet « Indices & Contexte » pour afficher les 947 outils recommandés correspondants.' : 'Please first add one or more indicators in the "Indicators & Context" tab to see matching catalog tools.'}</p>
              <button class="inv-btn inv-btn--primary" id="inv-switch-to-indicators">
                🎯 ${this.t('tab_indicators')}
              </button>
            </div>
          </div>
        `;
        const btn = container.querySelector('#inv-switch-to-indicators');
        if (btn) btn.addEventListener('click', () => { this.activeTab = 'indicators'; this.render(); });
        return;
      }

      // Collect all recommended tools for all indicators or selected indicator
      let indicatorsToUse = inv.indicators;
      if (this.selectedIndicatorFilter !== 'all') {
        indicatorsToUse = inv.indicators.filter(i => i.value === this.selectedIndicatorFilter);
      }

      // Group tools by catalog category
      const categoriesMap = new Map();
      let totalToolsCount = 0;

      for (const ind of indicatorsToUse) {
        const recommended = this.engine.getRecommendedTools(ind.type, 200);
        for (const t of recommended) {
          const catSlug = t.categorySlug || 'search-engines';
          if (!categoriesMap.has(catSlug)) {
            categoriesMap.set(catSlug, {
              slug: catSlug,
              title_fr: t.categoryTitleFr || catSlug,
              title_en: t.categoryTitleEn || catSlug,
              tools: [],
            });
          }
          const cat = categoriesMap.get(catSlug);
          if (!cat.tools.some(existing => existing.name === t.name)) {
            // Compute direct search URL for this indicator
            const searchUrl = this.engine.generateSearchUrl(t, ind.value);
            cat.tools.push({
              ...t,
              indicatorValue: ind.value,
              indicatorType: ind.type,
              directSearchUrl: searchUrl,
            });
            totalToolsCount++;
          }
        }
      }

      // Filter categories if selected
      let displayCategories = Array.from(categoriesMap.values());
      if (this.selectedCategoryFilter !== 'all') {
        displayCategories = displayCategories.filter(c => c.slug === this.selectedCategoryFilter);
      }

      // Filter by tool search query if present
      if (this.toolSearchQuery) {
        const q = this.toolSearchQuery.toLowerCase();
        displayCategories = displayCategories.map(cat => ({
          ...cat,
          tools: cat.tools.filter(t =>
            (t.name && t.name.toLowerCase().includes(q)) ||
            (t.desc_fr && t.desc_fr.toLowerCase().includes(q)) ||
            (t.desc_en && t.desc_en.toLowerCase().includes(q))
          )
        })).filter(cat => cat.tools.length > 0);
      }

      container.innerHTML = `
        <div class="inv-tab-body">
          <!-- Filter Controls Bar -->
          <div class="inv-tools-toolbar">
            <div class="inv-tools-toolbar__item">
              <label class="inv-label">${isFr ? 'Filtrer par indice :' : 'Filter by indicator:'}</label>
              <select class="inv-select inv-select--sm" id="inv-tools-indicator-filter">
                <option value="all">${isFr ? 'Tous les indices' : 'All indicators'} (${inv.indicators.length})</option>
                ${inv.indicators.map(ind => {
                  const typeInfo = InvestigationEngine.INDICATOR_TYPES[ind.type] || InvestigationEngine.INDICATOR_TYPES.text;
                  return `
                    <option value="${escapeHtml(ind.value)}" ${this.selectedIndicatorFilter === ind.value ? 'selected' : ''}>
                      ${typeInfo.icon} ${escapeHtml(ind.value)}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            <div class="inv-tools-toolbar__item">
              <label class="inv-label">${isFr ? 'Catégorie :' : 'Category:'}</label>
              <select class="inv-select inv-select--sm" id="inv-tools-category-filter">
                <option value="all">${isFr ? 'Toutes les catégories' : 'All categories'} (${categoriesMap.size})</option>
                ${Array.from(categoriesMap.values()).map(cat => `
                  <option value="${cat.slug}" ${this.selectedCategoryFilter === cat.slug ? 'selected' : ''}>
                    ${isFr ? cat.title_fr : cat.title_en} (${cat.tools.length})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="inv-tools-toolbar__item inv-tools-toolbar__item--search">
              <label class="inv-label">${isFr ? 'Rechercher un outil :' : 'Search tool:'}</label>
              <input
                type="text"
                class="inv-input inv-input--sm"
                id="inv-tools-search-input"
                placeholder="${isFr ? 'Nom, description, mot-clé...' : 'Name, description, keyword...'}"
                value="${escapeHtml(this.toolSearchQuery)}"
              />
            </div>
          </div>

          <!-- Total Tools Banner -->
          <div class="inv-tools-count-bar">
            <span>
              <strong>${totalToolsCount}</strong> ${isFr ? 'outils recommandés pour vos indices' : 'tools recommended for your indicators'}
            </span>
            <span class="inv-tools-hint">
              💡 ${isFr ? 'Cliquez sur « Lancer la recherche ↗ » pour ouvrir l\'outil avec l\'indice déjà pré-rempli dans la requête.' : 'Click "Direct Search ↗" to launch the tool with the query pre-filled.'}
            </span>
          </div>

          <!-- Category Sections -->
          <div class="inv-categories-stack">
            ${displayCategories.map(cat => `
              <div class="inv-cat-block" data-slug="${cat.slug}">
                <div class="inv-cat-block__header">
                  <h4 class="inv-cat-block__title">
                    <span class="inv-cat-block__name">${isFr ? cat.title_fr : cat.title_en}</span>
                    <span class="inv-badge">${cat.tools.length}</span>
                  </h4>
                </div>
                <div class="inv-tools-grid">
                  ${cat.tools.map(tool => {
                    const hasQuery = Boolean(tool.directSearchUrl);
                    const isIntelX = /intelx|intelligence\s*x/i.test(tool.name) || /intelx\.io/i.test(tool.url);
                    const desc = isFr ? (tool.desc_fr || tool.desc) : (tool.desc_en || tool.desc_fr || tool.desc);

                    return `
                      <div class="inv-tool-card ${hasQuery ? 'inv-tool-card--query' : ''}">
                        <div class="inv-tool-card__header">
                          <h5 class="inv-tool-card__title">
                            <a href="${escapeHtml(tool.url)}" target="_blank" rel="noopener" class="inv-tool-link">
                              ${escapeHtml(tool.name)}
                            </a>
                          </h5>
                          ${tool.pricing ? `<span class="inv-pricing-badge">${escapeHtml(tool.pricing)}</span>` : ''}
                        </div>
                        <p class="inv-tool-card__desc">${escapeHtml(desc || '')}</p>
                        <div class="inv-tool-card__actions">
                          ${hasQuery ? `
                            <a href="${escapeHtml(tool.directSearchUrl)}" target="_blank" rel="noopener" class="inv-btn inv-btn--xs inv-btn--primary">
                              🚀 ${isFr ? 'Recherche directe ↗' : 'Direct Search ↗'}
                            </a>
                          ` : `
                            <a href="${escapeHtml(tool.url)}" target="_blank" rel="noopener" class="inv-btn inv-btn--xs inv-btn--secondary">
                              🔗 ${isFr ? 'Ouvrir l\'outil ↗' : 'Open Tool ↗'}
                            </a>
                          `}

                          ${isIntelX ? `
                            <button class="inv-btn inv-btn--xs inv-btn--cyan" data-action="intelx-scan-tool" data-val="${escapeHtml(tool.indicatorValue)}">
                              ⚡ Scanner IntelX
                            </button>
                          ` : ''}

                          <button class="inv-btn inv-btn--xs inv-btn--ghost" data-action="add-finding-from-tool" data-tool="${escapeHtml(tool.name)}" data-url="${escapeHtml(tool.url)}" data-indicator="${escapeHtml(tool.indicatorValue)}" title="${isFr ? 'Consigner une découverte faite avec cet outil' : 'Record a finding from this tool'}">
                            📝 ${isFr ? '+ Preuve' : '+ Evidence'}
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      this.bindToolsTabEvents(container);
    }

    bindToolsTabEvents(container) {
      const indFilter = container.querySelector('#inv-tools-indicator-filter');
      const catFilter = container.querySelector('#inv-tools-category-filter');
      const searchIn = container.querySelector('#inv-tools-search-input');

      if (indFilter) {
        indFilter.addEventListener('change', () => {
          this.selectedIndicatorFilter = indFilter.value;
          this.renderToolsTab(container);
        });
      }

      if (catFilter) {
        catFilter.addEventListener('change', () => {
          this.selectedCategoryFilter = catFilter.value;
          this.renderToolsTab(container);
        });
      }

      if (searchIn) {
        searchIn.addEventListener('input', () => {
          this.toolSearchQuery = searchIn.value.trim();
          this.renderToolsTab(container);
        });
      }

      container.querySelectorAll('[data-action="add-finding-from-tool"]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openAddFindingModal({
            sourceTool: btn.dataset.tool,
            sourceUrl: btn.dataset.url,
            indicatorValue: btn.dataset.indicator,
          });
        });
      });

      container.querySelectorAll('[data-action="intelx-scan-tool"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.val;
          this.activeScanIndicator = val;
          this.activeTab = 'findings';
          this.render();
          this.launchIntelXScan(val);
        });
      });
    }

    // ── TAB 3: Evidence & Findings ───────────────────────────────────────

    renderFindingsTab(container) {
      const isFr = this.getLang() === 'fr';
      const inv = this.currentInvestigation;

      const findings = inv.findings || [];
      const applicableIndicators = (inv.indicators || []).filter(i => this.isIntelXSupported(i.type));

      let findingsHtml = '';
      if (findings.length === 0) {
        findingsHtml = `
          <div class="inv-empty-state">
            <span class="inv-empty-state__icon">📋</span>
            <h3>${isFr ? 'Aucune preuve ni découverte enregistrée' : 'No findings or evidence recorded yet'}</h3>
            <p>${isFr ? 'Enregistrez les résultats de vos recherches (profils trouvés, fuites de données, adresses IP, captures, etc.) manuellement ou lancez une interrogation automatique IntelX.' : 'Record your findings (profiles, breaches, IP addresses, captures, etc.) manually or run an automated IntelX scan.'}</p>
            <div class="inv-empty-state__actions">
              <button class="inv-btn inv-btn--primary" id="inv-empty-add-finding-btn">
                ➕ ${isFr ? 'Ajouter une preuve manuellement' : 'Add manual evidence'}
              </button>
            </div>
          </div>
        `;
      } else {
        findingsHtml = `
          <div class="inv-findings-list">
            ${findings.map(f => {
              const typeInfo = InvestigationEngine.FINDING_TYPES[f.type] || InvestigationEngine.FINDING_TYPES.other;
              const conf = InvestigationEngine.CONFIDENCE_LEVELS[f.confidence] || InvestigationEngine.CONFIDENCE_LEVELS.uncertain;
              const confLabel = isFr ? conf.label_fr : conf.label_en;

              // Check if finding contains potential pivotable indicators
              const emailMatches = (f.content || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
              const ipMatches = (f.content || '').match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
              const potentialPivots = Array.from(new Set([...emailMatches, ...ipMatches]));

              return `
                <div class="inv-finding-card" data-id="${f.id}">
                  <div class="inv-finding-card__header">
                    <div class="inv-finding-card__meta">
                      <span class="inv-type-badge">
                        <span>${typeInfo.icon}</span>
                        <span>${isFr ? typeInfo.label_fr : typeInfo.label_en}</span>
                      </span>
                      <span class="inv-confidence-badge inv-confidence-badge--${f.confidence}">
                        ${confLabel}
                      </span>
                      ${f.sourceName ? `<span class="inv-source-badge">Source: ${escapeHtml(f.sourceName)}</span>` : ''}
                    </div>
                    <div class="inv-finding-card__actions">
                      <button class="inv-btn-icon inv-btn-icon--danger" data-action="delete-finding" data-id="${f.id}" title="${isFr ? 'Supprimer' : 'Delete'}">✕</button>
                    </div>
                  </div>

                  <h4 class="inv-finding-card__title">${escapeHtml(f.title)}</h4>

                  ${f.content ? `<div class="inv-finding-card__content">${escapeHtml(f.content)}</div>` : ''}

                  ${f.excerpt ? `
                    <blockquote class="inv-finding-card__excerpt">
                      ${escapeHtml(f.excerpt)}
                    </blockquote>
                  ` : ''}

                  <div class="inv-finding-card__footer">
                    <div class="inv-finding-footer-meta">
                      ${f.url ? `<a href="${escapeHtml(f.url)}" target="_blank" rel="noopener" class="inv-finding-url">🔗 ${escapeHtml(f.url)}</a>` : ''}
                      <span class="inv-date-tag">🕒 ${formatDate(f.dateFound, this.getLang())}</span>
                    </div>

                    ${potentialPivots.length > 0 ? `
                      <div class="inv-pivots-wrap">
                        <span class="inv-pivots-label">🔍 ${isFr ? 'Pivots détectés :' : 'Detected pivots:'}</span>
                        ${potentialPivots.map(p => `
                          <button class="inv-btn inv-btn--xs inv-btn--cyan" data-action="pivot-indicator" data-val="${escapeHtml(p)}">
                            + ${escapeHtml(p)}
                          </button>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      container.innerHTML = `
        <div class="inv-tab-body">
          <!-- Top Action Bar -->
          <div class="inv-actions-toolbar">
            <button class="inv-btn inv-btn--primary" id="inv-manual-add-finding-btn">
              <span>➕ ${isFr ? 'Ajouter une découverte / preuve' : 'Add finding / evidence'}</span>
            </button>

            ${applicableIndicators.length > 0 ? `
              <button class="inv-btn inv-btn--cyan ${this.isScanningIntelX ? 'is-loading' : ''}" id="inv-intelx-batch-btn">
                <span>⚡ ${isFr ? 'Interroger IntelX sur les indices' : 'Scan indicators with IntelX'}</span>
              </button>
            ` : ''}
          </div>

          <!-- IntelX Live Scan Panel -->
          <div class="inv-card inv-intelx-scan-card" id="inv-intelx-panel" style="${this.intelxScanResults.length > 0 || this.isScanningIntelX ? '' : 'display: none;'}">
            <div class="inv-card__header">
              <h4 class="inv-card__title">
                <span>⚡ IntelX Live Collector</span>
                ${this.isScanningIntelX ? `<span class="inv-spinner"></span>` : ''}
              </h4>
              <button class="inv-btn-icon" id="inv-close-intelx-panel">✕</button>
            </div>
            <div class="inv-card__body">
              <div id="inv-intelx-results-list" class="inv-intelx-results-stream">
                ${this.intelxScanResults.map(item => `
                  <div class="inv-intelx-item">
                    <div class="inv-intelx-item__header">
                      <span class="inv-badge">${escapeHtml(item.bucket || 'Leak')}</span>
                      <strong>${escapeHtml(item.name || item.system || 'Result')}</strong>
                      <span class="inv-date-tag">${formatDate(item.date, this.getLang())}</span>
                    </div>
                    <div class="inv-intelx-item__body">
                      <code>${escapeHtml(item.snippet || item.selector || '')}</code>
                    </div>
                    <div class="inv-intelx-item__actions">
                      <button class="inv-btn inv-btn--xs inv-btn--primary" data-action="save-intelx-finding" data-item='${escapeHtml(JSON.stringify(item))}'>
                        📥 ${isFr ? 'Conserver comme preuve' : 'Keep as evidence'}
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Recorded Findings Header -->
          <div class="inv-section-header">
            <h3 class="inv-section-title">
              <span>📋 ${isFr ? 'Preuves & Découvertes enregistrées' : 'Recorded Evidence & Findings'}</span>
              <span class="inv-badge">${findings.length}</span>
            </h3>
          </div>

          ${findingsHtml}
        </div>
      `;

      this.bindFindingsTabEvents(container);
    }

    bindFindingsTabEvents(container) {
      const isFr = this.getLang() === 'fr';

      const addBtn = container.querySelector('#inv-manual-add-finding-btn');
      if (addBtn) addBtn.addEventListener('click', () => this.openAddFindingModal());

      const emptyAddBtn = container.querySelector('#inv-empty-add-finding-btn');
      if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => this.openAddFindingModal());

      const batchIntelXBtn = container.querySelector('#inv-intelx-batch-btn');
      if (batchIntelXBtn) {
        batchIntelXBtn.addEventListener('click', () => {
          const indicators = (this.currentInvestigation.indicators || []).filter(i => this.isIntelXSupported(i.type));
          if (indicators.length > 0) {
            this.launchIntelXScan(indicators[0].value);
          }
        });
      }

      const closeIntelX = container.querySelector('#inv-close-intelx-panel');
      if (closeIntelX) {
        closeIntelX.addEventListener('click', () => {
          this.intelxScanResults = [];
          this.renderFindingsTab(container);
        });
      }

      container.querySelectorAll('[data-action="delete-finding"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          this.currentInvestigation.findings = this.currentInvestigation.findings.filter(f => f.id !== id);
          this.engine.autoCorrelate(this.currentInvestigation);
          this.renderFindingsTab(container);
        });
      });

      container.querySelectorAll('[data-action="pivot-indicator"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.val;
          this.engine.addIndicator(this.currentInvestigation, val);
          this.engine.autoCorrelate(this.currentInvestigation);
          this.render();
          this.showToast(`${isFr ? 'Nouvel indice ajouté :' : 'New indicator added:'} ${val}`);
        });
      });

      container.querySelectorAll('[data-action="save-intelx-finding"]').forEach(btn => {
        btn.addEventListener('click', () => {
          try {
            const item = JSON.parse(btn.dataset.item);
            this.engine.addFinding(this.currentInvestigation, {
              title: item.name || `IntelX: ${item.selector}`,
              content: item.snippet || item.preview || `Leak / Record trouvé pour ${item.selector}`,
              type: 'identity',
              sourceName: 'Intelligence X',
              url: `https://intelx.io/?s=${encodeURIComponent(item.selector)}`,
              confidence: 'confirmed',
            });
            this.engine.autoCorrelate(this.currentInvestigation);
            this.showToast(this.t('toast_finding_added'));
            this.render();
          } catch (e) {
            console.error('Error saving IntelX finding:', e);
          }
        });
      });
    }

    async launchIntelXScan(selector) {
      if (!selector) return;
      const isFr = this.getLang() === 'fr';
      this.isScanningIntelX = true;
      this.render();

      try {
        if (!this.intelxClient && typeof IntelXClient !== 'undefined') {
          this.intelxClient = new IntelXClient();
        }

        if (this.intelxClient) {
          const res = await this.intelxClient.intelligentSearch(selector, { maxresults: 20 });
          if (res && res.records) {
            this.intelxScanResults = res.records.slice(0, 15).map(r => ({
              selector,
              name: r.name || r.storageid,
              bucket: r.bucket,
              system: r.system,
              date: r.date,
              snippet: r.description || `Record ID: ${r.storageid}`,
            }));
          } else {
            this.intelxScanResults = [{
              selector,
              name: `Recherche IntelX: ${selector}`,
              bucket: 'Status',
              snippet: isFr ? 'Aucun résultat direct ou clé requise' : 'No direct results or API key required',
              date: new Date().toISOString(),
            }];
          }
        } else {
          this.intelxScanResults = [{
            selector,
            name: `IntelX: ${selector}`,
            bucket: 'Simulation',
            snippet: isFr ? 'Module IntelX connecté — simulation prête' : 'IntelX module connected — simulation ready',
            date: new Date().toISOString(),
          }];
        }
      } catch (err) {
        this.intelxScanResults = [{
          selector,
          name: `IntelX: ${selector}`,
          bucket: 'Erreur',
          snippet: err.message,
          date: new Date().toISOString(),
        }];
      } finally {
        this.isScanningIntelX = false;
        this.render();
      }
    }

    // ── TAB 4: Correlations & Pivots ─────────────────────────────────────

    renderCorrelationsTab(container) {
      const isFr = this.getLang() === 'fr';
      const inv = this.currentInvestigation;

      // Always refresh automatic correlations
      this.engine.autoCorrelate(inv);
      const correlations = inv.correlations || [];

      let correlationsHtml = '';
      if (correlations.length === 0) {
        correlationsHtml = `
          <div class="inv-empty-state">
            <span class="inv-empty-state__icon">🔄</span>
            <h3>${isFr ? 'Aucune corrélation détectée pour le moment' : 'No correlations detected yet'}</h3>
            <p>${isFr ? 'Ajoutez d\'autres indices et consignez des preuves pour que le moteur de recoupement établisse des liens automatiques entre vos cibles.' : 'Add more indicators and record findings so the engine can calculate links and certainty levels.'}</p>
          </div>
        `;
      } else {
        correlationsHtml = `
          <div class="inv-correlations-grid">
            ${correlations.map(c => {
              const conf = InvestigationEngine.CONFIDENCE_LEVELS[c.confidence] || InvestigationEngine.CONFIDENCE_LEVELS.uncertain;
              const confLabel = isFr ? conf.label_fr : conf.label_en;
              const isConfirmed = c.validatedByUser === true;
              const isDismissed = c.validatedByUser === false;

              return `
                <div class="inv-correlation-card ${isConfirmed ? 'is-confirmed' : ''} ${isDismissed ? 'is-dismissed' : ''}" data-id="${c.id}">
                  <div class="inv-correlation-card__header">
                    <span class="inv-confidence-badge inv-confidence-badge--${c.confidence}">
                      ${confLabel}
                    </span>
                    <span class="inv-corr-type-tag">${escapeHtml(c.type || 'Lien')}</span>
                  </div>

                  <p class="inv-correlation-card__justification">
                    ${escapeHtml(isFr ? c.justification : (c.justification_en || c.justification))}
                  </p>

                  <div class="inv-correlation-card__actions">
                    <button class="inv-btn inv-btn--xs ${isConfirmed ? 'inv-btn--primary' : 'inv-btn--secondary'}" data-action="validate-corr" data-id="${c.id}">
                      ✅ ${isFr ? 'Confirmer' : 'Confirm'}
                    </button>
                    <button class="inv-btn inv-btn--xs ${isDismissed ? 'inv-btn--danger' : 'inv-btn--outline-danger'}" data-action="dismiss-corr" data-id="${c.id}">
                      ❌ ${isFr ? 'Écarter' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      container.innerHTML = `
        <div class="inv-tab-body">
          <div class="inv-section-header">
            <h3 class="inv-section-title">
              <span>🔄 ${isFr ? 'Recoupements & Niveaux de Certitude' : 'Cross-Referencing & Certainty Matrix'}</span>
              <span class="inv-badge">${correlations.length}</span>
            </h3>
            <button class="inv-btn inv-btn--sm inv-btn--secondary" id="inv-recalculate-corr-btn">
              ⚡ ${isFr ? 'Recalculer' : 'Recalculate'}
            </button>
          </div>

          <!-- Explanation of confidence levels -->
          <div class="inv-confidence-legend">
            <div class="inv-legend-item">
              <span class="inv-confidence-badge inv-confidence-badge--confirmed">🟢 ${isFr ? 'Confirmé' : 'Confirmed'}</span>
              <span>${isFr ? 'Recoupé par plusieurs sources indépendantes' : 'Cross-referenced by multiple independent sources'}</span>
            </div>
            <div class="inv-legend-item">
              <span class="inv-confidence-badge inv-confidence-badge--probable">🟡 ${isFr ? 'Probable' : 'Probable'}</span>
              <span>${isFr ? 'Forte présomption, une source fiable' : 'Strong presumption, single reliable source'}</span>
            </div>
            <div class="inv-legend-item">
              <span class="inv-confidence-badge inv-confidence-badge--uncertain">🟠 ${isFr ? 'Incertain' : 'Uncertain'}</span>
              <span>${isFr ? 'Indice unique ou source non vérifiée' : 'Single unverified or partial indicator'}</span>
            </div>
          </div>

          ${correlationsHtml}
        </div>
      `;

      this.bindCorrelationsTabEvents(container);
    }

    bindCorrelationsTabEvents(container) {
      const recalcBtn = container.querySelector('#inv-recalculate-corr-btn');
      if (recalcBtn) {
        recalcBtn.addEventListener('click', () => {
          this.engine.autoCorrelate(this.currentInvestigation);
          this.renderCorrelationsTab(container);
          this.showToast(this.getLang() === 'fr' ? 'Corrélations actualisées' : 'Correlations updated');
        });
      }

      container.querySelectorAll('[data-action="validate-corr"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const corr = this.currentInvestigation.correlations.find(c => c.id === id);
          if (corr) {
            corr.validatedByUser = true;
            corr.confidence = 'confirmed';
            this.renderCorrelationsTab(container);
          }
        });
      });

      container.querySelectorAll('[data-action="dismiss-corr"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const corr = this.currentInvestigation.correlations.find(c => c.id === id);
          if (corr) {
            corr.validatedByUser = false;
            this.renderCorrelationsTab(container);
          }
        });
      });
    }

    // ── TAB 5: Investigation Report ──────────────────────────────────────

    renderReportTab(container) {
      const isFr = this.getLang() === 'fr';
      const inv = this.currentInvestigation;

      // Generate report object
      const report = this.engine.generateReport(inv, this.getLang());
      const markdown = this.engine.exportMarkdown(report);
      const htmlDoc = this.engine.exportHTML(report);

      container.innerHTML = `
        <div class="inv-tab-body">
          <!-- Report Header & Export Actions -->
          <div class="inv-report-toolbar">
            <div class="inv-report-toolbar__info">
              <h3 class="inv-report-toolbar__title">
                <span>📑 ${isFr ? 'Rapport d\'Investigation Structuré' : 'Structured Investigation Report'}</span>
              </h3>
              <p class="inv-report-toolbar__desc">
                ${isFr ? 'Rapport complet en 6 sections (Synthèse, Éléments trouvés, Corrélations, Chronologie, Méthodologie, Sources).' : 'Complete 6-section report (Executive summary, Findings, Correlations, Timeline, Methodology, Sources).'}
              </p>
            </div>

            <div class="inv-report-toolbar__buttons">
              <button class="inv-btn inv-btn--primary" id="inv-print-report-btn">
                🖨️ ${this.t('print_report')}
              </button>
              <button class="inv-btn inv-btn--secondary" id="inv-download-md-btn">
                📥 ${this.t('download_markdown')}
              </button>
              <button class="inv-btn inv-btn--secondary" id="inv-download-html-btn">
                🌐 ${this.t('download_html')}
              </button>
              <button class="inv-btn inv-btn--ghost" id="inv-copy-md-btn">
                📋 ${this.t('copy_markdown')}
              </button>
            </div>
          </div>

          <!-- Printable / Rendered Report Paper -->
          <div class="inv-report-paper" id="inv-report-paper">
            <div class="inv-report-paper__header">
              <div class="inv-report-paper__brand">AAA_OSINT INVESTIGATION REPORT</div>
              <h1 class="inv-report-paper__title">${escapeHtml(inv.name)}</h1>
              <div class="inv-report-paper__date">${formatDate(report.generatedAt, this.getLang())}</div>
            </div>

            <!-- Section A: Summary -->
            <section class="inv-report-section">
              <h2 class="inv-report-section__title">A. ${escapeHtml(report.sections.summary.title)}</h2>
              <div class="inv-report-section__body">
                <p><strong>${isFr ? 'Objet et périmètre :' : 'Object and scope:'}</strong> ${escapeHtml(report.sections.summary.objectAndScope)}</p>
                <p><strong>${isFr ? 'Indices de départ :' : 'Starting indicators:'}</strong></p>
                <ul>
                  ${report.sections.summary.indicators.map(ind => `<li>${escapeHtml(ind)}</li>`).join('')}
                </ul>
                <p><strong>${isFr ? 'Principaux résultats :' : 'Key findings:'}</strong> ${escapeHtml(report.sections.summary.keyFindings)}</p>
                <p><strong>${isFr ? 'Conclusions :' : 'Conclusions:'}</strong> ${escapeHtml(report.sections.summary.conclusions)}</p>
                <p><strong>${isFr ? 'Limites :' : 'Limitations:'}</strong> ${escapeHtml(report.sections.summary.limitations)}</p>
              </div>
            </section>

            <!-- Section B: Findings -->
            <section class="inv-report-section">
              <h2 class="inv-report-section__title">B. ${escapeHtml(report.sections.findings.title)}</h2>
              <div class="inv-report-section__body">
                <p class="text-muted">${report.sections.findings.totalCount} ${isFr ? 'élément(s) documenté(s)' : 'documented item(s)'}</p>
                ${report.sections.findings.groups.map(group => `
                  <h3 class="inv-report-h3">${group.icon} ${escapeHtml(group.label)}</h3>
                  <div class="inv-report-findings-table-wrap">
                    <table class="inv-report-table">
                      <thead>
                        <tr>
                          <th>${isFr ? 'Intitulé / Découverte' : 'Item / Finding'}</th>
                          <th>${isFr ? 'Détails' : 'Details'}</th>
                          <th>${isFr ? 'Source' : 'Source'}</th>
                          <th>${isFr ? 'Certitude' : 'Confidence'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${group.items.map(item => `
                          <tr>
                            <td><strong>${escapeHtml(item.title)}</strong></td>
                            <td>${escapeHtml(item.content || item.excerpt || '—')}</td>
                            <td>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.sourceName || 'Lien')}</a>` : escapeHtml(item.sourceName || 'Manuel')}</td>
                            <td><span class="inv-confidence-badge inv-confidence-badge--${item.confidence}">${item.confidence}</span></td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `).join('')}
              </div>
            </section>

            <!-- Section C: Correlations -->
            <section class="inv-report-section">
              <h2 class="inv-report-section__title">C. ${escapeHtml(report.sections.correlations.title)}</h2>
              <div class="inv-report-section__body">
                ${report.sections.correlations.items.length === 0 ? `
                  <p class="text-muted"><em>${isFr ? 'Aucune corrélation enregistrée.' : 'No recorded correlations.'}</em></p>
                ` : `
                  <ul>
                    ${report.sections.correlations.items.map(item => `
                      <li>
                        <strong>[${escapeHtml(item.confidenceLabel)}]</strong>
                        ${escapeHtml(item.justification)}
                        ${item.validatedByUser === true ? ' <span class="inv-check-badge">✅ Validé</span>' : ''}
                      </li>
                    `).join('')}
                  </ul>
                `}
              </div>
            </section>

            <!-- Section D: Timeline -->
            <section class="inv-report-section">
              <h2 class="inv-report-section__title">D. ${escapeHtml(report.sections.timeline.title)}</h2>
              <div class="inv-report-section__body">
                <div class="inv-timeline">
                  ${report.sections.timeline.events.map(evt => `
                    <div class="inv-timeline-item">
                      <div class="inv-timeline-item__date">${formatDate(evt.date, this.getLang())}</div>
                      <div class="inv-timeline-item__content">${escapeHtml(evt.label)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </section>

            <!-- Section E: Methodology -->
            <section class="inv-report-section">
              <h2 class="inv-report-section__title">E. ${escapeHtml(report.sections.methodology.title)}</h2>
              <div class="inv-report-section__body">
                <p><strong>${isFr ? 'Outils utilisés :' : 'Tools used:'}</strong></p>
                <ul>
                  ${report.sections.methodology.toolsUsed.map(t => `
                    <li>${escapeHtml(t.name)} (${t.automated ? (isFr ? 'automatique' : 'automated') : (isFr ? 'manuel' : 'manual')}) — ${t.resultCount} ${isFr ? 'résultat(s)' : 'result(s)'}</li>
                  `).join('')}
                </ul>
                <p><strong>${isFr ? 'Avertissements méthodologiques :' : 'Methodological disclaimers:'}</strong></p>
                ${report.sections.methodology.disclaimers.map(d => `<blockquote>${escapeHtml(d)}</blockquote>`).join('')}
              </div>
            </section>

            <!-- Section F: Sources -->
            <section class="inv-report-section">
              <h2 class="inv-report-section__title">F. ${escapeHtml(report.sections.sources.title)}</h2>
              <div class="inv-report-section__body">
                <ol>
                  ${report.sections.sources.references.map(ref => `
                    <li>
                      <strong>${escapeHtml(ref.sourceName)}</strong> —
                      <a href="${escapeHtml(ref.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(ref.sourceUrl)}</a>
                      (${isFr ? 'Consulté le' : 'Retrieved on'} ${formatDate(ref.consultedAt, this.getLang())})
                    </li>
                  `).join('')}
                </ol>
              </div>
            </section>
          </div>
        </div>
      `;

      this.bindReportTabEvents(container, markdown, htmlDoc);
    }

    bindReportTabEvents(container, markdown, htmlDoc) {
      const isFr = this.getLang() === 'fr';

      // Print / PDF
      const printBtn = container.querySelector('#inv-print-report-btn');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          window.print();
        });
      }

      // Copy Markdown
      const copyMdBtn = container.querySelector('#inv-copy-md-btn');
      if (copyMdBtn) {
        copyMdBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            this.showToast(this.t('toast_report_copied'));
          } catch {
            this.showToast(isFr ? 'Erreur lors de la copie' : 'Copy failed');
          }
        });
      }

      // Download Markdown
      const dlMdBtn = container.querySelector('#inv-download-md-btn');
      if (dlMdBtn) {
        dlMdBtn.addEventListener('click', () => {
          const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rapport_${(this.currentInvestigation.name || 'osint').toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }

      // Download HTML
      const dlHtmlBtn = container.querySelector('#inv-download-html-btn');
      if (dlHtmlBtn) {
        dlHtmlBtn.addEventListener('click', () => {
          const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rapport_${(this.currentInvestigation.name || 'osint').toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    }

    // ── TAB 6: Saved Investigations Management ───────────────────────────

    async renderSavedTab(container) {
      const isFr = this.getLang() === 'fr';

      container.innerHTML = `
        <div class="inv-tab-body">
          <div class="inv-section-header">
            <h3 class="inv-section-title">
              <span>📁 ${isFr ? 'Mes Enquêtes OSINT' : 'Saved Investigations'}</span>
            </h3>
            <div class="inv-section-actions">
              <label class="inv-btn inv-btn--sm inv-btn--secondary" for="inv-import-file-input">
                📥 ${this.t('import_json')}
              </label>
              <input type="file" id="inv-import-file-input" accept=".json" style="display:none;" />
              <button class="inv-btn inv-btn--sm inv-btn--accent" id="inv-create-from-saved-btn">
                ➕ ${this.t('new_investigation')}
              </button>
            </div>
          </div>

          <div id="inv-saved-list-container">
            <div class="inv-loading-state">
              <span class="inv-spinner"></span>
              <span>${isFr ? 'Chargement des enquêtes...' : 'Loading investigations...'}</span>
            </div>
          </div>
        </div>
      `;

      const listContainer = container.querySelector('#inv-saved-list-container');
      try {
        const list = await this.engine.listInvestigations();
        this.savedList = list || [];
        this.renderSavedList(listContainer);
      } catch (e) {
        listContainer.innerHTML = `<p class="inv-error">${isFr ? 'Impossible de charger la liste' : 'Could not load cases'}: ${escapeHtml(e.message)}</p>`;
      }

      this.bindSavedTabEvents(container);
    }

    renderSavedList(listContainer) {
      const isFr = this.getLang() === 'fr';
      if (!this.savedList || this.savedList.length === 0) {
        listContainer.innerHTML = `
          <div class="inv-empty-state">
            <span class="inv-empty-state__icon">📁</span>
            <h3>${isFr ? 'Aucune enquête enregistrée' : 'No saved cases found'}</h3>
            <p>${isFr ? 'Sauvegardez votre enquête active pour la retrouver ici ou importez un fichier d\'enquête JSON.' : 'Save your active case to retrieve it here or import a JSON case file.'}</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = `
        <div class="inv-saved-grid">
          ${this.savedList.map(item => `
            <div class="inv-saved-card ${this.currentInvestigation && this.currentInvestigation.id === item.id ? 'is-current' : ''}">
              <div class="inv-saved-card__header">
                <span class="inv-status-pill inv-status-pill--${item.status || 'draft'}">${this.formatStatus(item.status)}</span>
                <span class="inv-date-tag">🕒 ${formatDate(item.updatedAt || item.createdAt, this.getLang())}</span>
              </div>
              <h4 class="inv-saved-card__title">${escapeHtml(item.name)}</h4>
              ${item.context ? `<p class="inv-saved-card__desc">${escapeHtml(item.context)}</p>` : ''}
              <div class="inv-saved-card__counts">
                <span>🎯 ${item.indicatorCount || 0} ${isFr ? 'indices' : 'indicators'}</span>
                <span>📋 ${item.findingsCount || 0} ${isFr ? 'preuves' : 'findings'}</span>
              </div>
              <div class="inv-saved-card__actions">
                <button class="inv-btn inv-btn--xs inv-btn--primary" data-action="load-case" data-id="${item.id}">
                  📂 ${isFr ? 'Ouvrir' : 'Open'}
                </button>
                <button class="inv-btn inv-btn--xs inv-btn--secondary" data-action="export-case-json" data-id="${item.id}">
                  📥 JSON
                </button>
                <button class="inv-btn inv-btn--xs inv-btn--danger" data-action="delete-case" data-id="${item.id}">
                  🗑️
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      listContainer.querySelectorAll('[data-action="load-case"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const loaded = await this.engine.loadInvestigation(id);
          if (loaded) {
            this.currentInvestigation = loaded;
            this.activeTab = 'indicators';
            this.render();
            this.showToast(isFr ? `Enquête « ${loaded.name} » chargée` : `Case "${loaded.name}" loaded`);
          }
        });
      });

      listContainer.querySelectorAll('[data-action="export-case-json"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const caseData = await this.engine.loadInvestigation(id);
          if (caseData) {
            const blob = new Blob([JSON.stringify(caseData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `enquete_${(caseData.name || id).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }
        });
      });

      listContainer.querySelectorAll('[data-action="delete-case"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (confirm(isFr ? 'Voulez-vous vraiment supprimer cette enquête ?' : 'Do you really want to delete this case?')) {
            await this.engine.deleteInvestigation(id);
            this.savedList = this.savedList.filter(i => i.id !== id);
            this.renderSavedList(listContainer);
            this.showToast(this.t('toast_investigation_deleted'));
          }
        });
      });
    }

    bindSavedTabEvents(container) {
      const isFr = this.getLang() === 'fr';

      const fileInput = container.querySelector('#inv-import-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (evt) => {
            try {
              const data = JSON.parse(evt.target.result);
              if (data && typeof data === 'object') {
                await this.engine.saveInvestigation(data);
                this.currentInvestigation = data;
                this.activeTab = 'indicators';
                this.render();
                this.showToast(isFr ? 'Enquête importée avec succès !' : 'Case imported successfully!');
              }
            } catch (err) {
              alert(isFr ? 'Fichier JSON invalide : ' + err.message : 'Invalid JSON file: ' + err.message);
            }
          };
          reader.readAsText(file);
        });
      }

      const createBtn = container.querySelector('#inv-create-from-saved-btn');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          this.currentInvestigation = this.engine.createInvestigation({
            name: isFr ? 'Nouvelle Enquête OSINT' : 'New OSINT Investigation',
          });
          this.activeTab = 'indicators';
          this.render();
        });
      }
    }

    // ── Global Header & Navigation Events ────────────────────────────────

    bindHeaderEvents() {
      const isFr = this.getLang() === 'fr';

      const titleDisplay = document.getElementById('inv-title-display');
      const editTitleBtn = document.getElementById('inv-edit-title-btn');
      const savedBtn = document.getElementById('inv-saved-cases-btn');
      const saveBtn = document.getElementById('inv-save-case-btn');
      const newBtn = document.getElementById('inv-new-case-btn');

      const triggerEditMeta = () => {
        const newTitle = prompt(isFr ? 'Titre de l\'enquête :' : 'Case title:', this.currentInvestigation.name);
        if (newTitle !== null && newTitle.trim()) {
          this.currentInvestigation.name = newTitle.trim();
        }
        const newContext = prompt(isFr ? 'Contexte / Objectif de l\'enquête :' : 'Case context / objective:', this.currentInvestigation.context || '');
        if (newContext !== null) {
          this.currentInvestigation.context = newContext.trim();
        }
        this.render();
      };

      if (titleDisplay) titleDisplay.addEventListener('click', triggerEditMeta);
      if (editTitleBtn) editTitleBtn.addEventListener('click', triggerEditMeta);

      if (savedBtn) {
        savedBtn.addEventListener('click', () => {
          this.activeTab = 'saved';
          this.render();
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          await this.engine.saveInvestigation(this.currentInvestigation);
          this.showToast(this.t('toast_investigation_saved'));
        });
      }

      if (newBtn) {
        newBtn.addEventListener('click', () => {
          if (confirm(isFr ? 'Créer une nouvelle enquête ? Pensez à sauvegarder votre enquête actuelle si nécessaire.' : 'Create new case? Remember to save your current case first.')) {
            this.currentInvestigation = this.engine.createInvestigation({
              name: isFr ? 'Nouvelle Enquête OSINT' : 'New OSINT Investigation',
            });
            this.activeTab = 'indicators';
            this.render();
          }
        });
      }
    }

    bindTabEvents() {
      document.querySelectorAll('.inv-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeTab = btn.dataset.tab;
          document.querySelectorAll('.inv-tab').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.renderActiveTab();
        });
      });
    }

    // ── Modals: Add Finding / Edit Finding ────────────────────────────────

    openAddFindingModal(prefill = {}) {
      const isFr = this.getLang() === 'fr';
      const overlay = document.getElementById('inv-modal-overlay');
      if (!overlay) return;

      const types = Object.values(InvestigationEngine.FINDING_TYPES);

      overlay.innerHTML = `
        <div class="inv-modal" role="dialog" aria-modal="true">
          <div class="inv-modal__header">
            <h3 class="inv-modal__title">
              <span>📋 ${isFr ? 'Enregistrer une découverte / preuve' : 'Record Finding / Evidence'}</span>
            </h3>
            <button class="inv-btn-icon" id="inv-modal-close-btn">✕</button>
          </div>

          <form class="inv-modal__form" id="inv-modal-finding-form">
            <div class="inv-form-group">
              <label class="inv-label">${isFr ? 'Titre de la découverte *' : 'Finding title *'}</label>
              <input
                type="text"
                class="inv-input"
                id="inv-finding-title"
                placeholder="${isFr ? 'Ex: Compte Twitter/X découvert, Fuite de base de données, IP d\'hébergement...' : 'E.g. Twitter/X account found, Database breach, Host IP...'}"
                required
              />
            </div>

            <div class="inv-form-row">
              <div class="inv-form-group">
                <label class="inv-label">${isFr ? 'Catégorie d\'information' : 'Information category'}</label>
                <select class="inv-select" id="inv-finding-type">
                  ${types.map(t => `<option value="${t.id}">${t.icon} ${isFr ? t.label_fr : t.label_en}</option>`).join('')}
                </select>
              </div>

              <div class="inv-form-group">
                <label class="inv-label">${isFr ? 'Niveau de confiance' : 'Confidence level'}</label>
                <select class="inv-select" id="inv-finding-confidence">
                  <option value="confirmed">🟢 ${isFr ? 'Confirmé (multi-sources)' : 'Confirmed (multi-source)'}</option>
                  <option value="probable" selected>🟡 ${isFr ? 'Probable (une source fiable)' : 'Probable (single source)'}</option>
                  <option value="uncertain">🟠 ${isFr ? 'Incertain (à vérifier)' : 'Uncertain (to verify)'}</option>
                </select>
              </div>
            </div>

            <div class="inv-form-group">
              <label class="inv-label">${isFr ? 'Détails / Données observées' : 'Details / Observed data'}</label>
              <textarea
                class="inv-textarea"
                id="inv-finding-content"
                rows="4"
                placeholder="${isFr ? 'Détaillez les informations constatées (nom, pseudo, date, texte, extrait, numéro...)' : 'Detail the observed facts (name, handle, date, text, excerpt, phone...)'}"
              ></textarea>
            </div>

            <div class="inv-form-row">
              <div class="inv-form-group">
                <label class="inv-label">${isFr ? 'Outil source' : 'Source tool'}</label>
                <input
                  type="text"
                  class="inv-input"
                  id="inv-finding-source"
                  value="${escapeHtml(prefill.sourceTool || '')}"
                  placeholder="${isFr ? 'Ex: Shodan, IntelX, Epieos, Manuel...' : 'E.g. Shodan, IntelX, Epieos, Manual...'}"
                />
              </div>

              <div class="inv-form-group">
                <label class="inv-label">${isFr ? 'URL de preuve / source' : 'Evidence / Source URL'}</label>
                <input
                  type="url"
                  class="inv-input"
                  id="inv-finding-url"
                  value="${escapeHtml(prefill.sourceUrl || '')}"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div class="inv-modal__footer">
              <button type="button" class="inv-btn inv-btn--secondary" id="inv-modal-cancel-btn">
                ${isFr ? 'Annuler' : 'Cancel'}
              </button>
              <button type="submit" class="inv-btn inv-btn--primary">
                ${isFr ? 'Enregistrer la découverte' : 'Save Finding'}
              </button>
            </div>
          </form>
        </div>
      `;

      overlay.style.display = 'flex';

      const close = () => { overlay.style.display = 'none'; };
      overlay.querySelector('#inv-modal-close-btn').addEventListener('click', close);
      overlay.querySelector('#inv-modal-cancel-btn').addEventListener('click', close);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });

      const form = overlay.querySelector('#inv-modal-finding-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = overlay.querySelector('#inv-finding-title').value.trim();
        const type = overlay.querySelector('#inv-finding-type').value;
        const confidence = overlay.querySelector('#inv-finding-confidence').value;
        const content = overlay.querySelector('#inv-finding-content').value.trim();
        const sourceName = overlay.querySelector('#inv-finding-source').value.trim();
        const url = overlay.querySelector('#inv-finding-url').value.trim();

        this.engine.addFinding(this.currentInvestigation, {
          title,
          type,
          confidence,
          content,
          sourceName,
          url,
        });

        this.engine.autoCorrelate(this.currentInvestigation);
        close();
        this.render();
        this.showToast(this.t('toast_finding_added'));
      });
    }
  }

  return InvestigationUI;
});
