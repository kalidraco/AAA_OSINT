/**
 * AAA_OSINT — Senior Professional Desktop Application Core
 * Architecture: Investigation Workspace & OSINT Command Center
 * Features:
 *   - Bilingual Internationalization (FR / EN) with on-the-fly switching
 *   - Dedicated "Sans inscription" (No Registration) Section & Sub-filters
 *   - Access Status Badging & Classification across all cards
 *   - Resizable & Collapsible Sidebar, Omnisearch with Bilingual Matching
 *   - Operational Domain Hierarchy, Favorites, Recent History
 *   - Density Switcher, Keyboard Navigation & IntelX Integration.
 */

(function () {
  'use strict';

  // --- Platform Detection ---
  const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent || '');
  const modKey = isMac ? '⌘' : 'Ctrl';

  // --- Fallback Domains Taxonomy (overridden by i18n.DOMAINS if loaded) ---
  const DEFAULT_DOMAINS = [
    {
      id: 'identity',
      title: 'Identité & Personnes',
      title_fr: 'Identité & Personnes',
      title_en: 'Identity & People',
      slugs: ['people-social', 'phishing-email', 'image-reverse', 'video-osint']
    },
    {
      id: 'cyber',
      title: 'Cyber & Infrastructure',
      title_fr: 'Cyber & Infrastructure',
      title_en: 'Cyber & Infrastructure',
      slugs: ['infra-domains', 'darkweb-leaks', 'malware-cti', 'automation-recon', 'comms']
    },
    {
      id: 'geoint',
      title: 'Géospatial & Transports',
      title_fr: 'Géospatial & Transports',
      title_en: 'Geospatial & Transportation',
      slugs: ['geospatial-mapping', 'aviation', 'maritime', 'railways']
    },
    {
      id: 'intel',
      title: 'Renseignement & Enquête',
      title_fr: 'Renseignement & Enquête',
      title_en: 'Intelligence & Investigation',
      slugs: ['intel-feeds', 'news-media', 'business-intel', 'gov-legal', 'document-file', 'ai-osint']
    },
    {
      id: 'resources',
      title: 'Ressources & Archivage',
      title_fr: 'Ressources & Archivage',
      title_en: 'Resources & Archiving',
      slugs: ['search-engines', 'archiving-caching', 'academic', 'reporting-visualization', 'learning', 'osint-for-good']
    }
  ];

  // Helper accessor for i18n safe calls
  const t = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);
  const getDOMAINS = () => (window.i18n && window.i18n.DOMAINS) || DEFAULT_DOMAINS;

  // --- State ---
  let DATA = null;
  let activeView = 'all'; // 'all' | 'no-registration' | 'favorites' | 'recent' | 'intelx' | [category slug]
  let noRegSubFilter = 'all'; // 'all' | 'no_account' | 'optional_account' | 'limited_access'
  let searchQuery = '';
  let activeSearchCategoryFilter = null; // slug or null
  let sortMode = 'default'; // 'default' | 'alpha'
  let keyboardFocusedIndex = -1;
  let searchDebounceTimer = null;
  let toastTimer = null;

  // IntelX Client & UI Instances
  let intelxClient = null;
  let intelxUI = null;

  // Investigation Engine & UI Instances
  let investigationEngine = null;
  let investigationUI = null;

  // LocalStorage Stores
  const favorites = new Set(loadJSON('aaa_favorites', []));
  let recentTools = loadJSON('aaa_recent', []);
  const collapsedDomains = new Set(loadJSON('aaa_collapsed_domains', []));
  let currentSidebarWidth = parseInt(localStorage.getItem('aaa_sidebar_width'), 10) || 280;
  let currentDensity = localStorage.getItem('aaa_density') || 'comfortable';

  // --- DOM Elements ---
  const searchInput       = document.getElementById('search-input');
  const searchKbd         = document.getElementById('search-kbd');
  const searchClear       = document.getElementById('search-clear');
  const densityToggle     = document.getElementById('density-toggle');
  const shortcutsToggle   = document.getElementById('shortcuts-toggle');
  const shortcutsModal    = document.getElementById('shortcuts-modal');
  const shortcutsClose    = document.getElementById('shortcuts-modal-close');
  const brandHome         = document.getElementById('brand-home');
  const statTools         = document.getElementById('stat-tools');
  const statCategories    = document.getElementById('stat-categories');
  const labelStatTools    = document.getElementById('label-stat-tools');
  const labelStatCats     = document.getElementById('label-stat-categories');

  const langBtnFr         = document.getElementById('lang-btn-fr');
  const langBtnEn         = document.getElementById('lang-btn-en');

  const sidebar           = document.getElementById('sidebar');
  const sidebarNav        = document.getElementById('sidebar-nav');
  const sidebarToggle     = document.getElementById('sidebar-toggle');
  const sidebarCollapse   = document.getElementById('sidebar-collapse');
  const sidebarOverlay    = document.getElementById('sidebar-overlay');
  const sidebarResizer    = document.getElementById('sidebar-resizer');
  const sidebarHubLabel   = document.getElementById('sidebar-hub-label');
  const categoryFilterIn  = document.getElementById('category-filter-input');
  const categoryFilterClr = document.getElementById('category-filter-clear');
  const countAll          = document.getElementById('count-all');
  const countNoReg        = document.getElementById('count-no-registration');
  const countFavorites    = document.getElementById('count-favorites');
  const countRecent       = document.getElementById('count-recent');
  const sidebarShortcutH  = document.getElementById('sidebar-shortcut-hint');

  const labelNavAll       = document.getElementById('label-nav-all');
  const labelNavNoReg     = document.getElementById('label-nav-no-reg');
  const labelNavFavorites = document.getElementById('label-nav-favorites');
  const labelNavRecent    = document.getElementById('label-nav-recent');

  const mainWrapper       = document.getElementById('main-wrapper');
  const contextBar        = document.getElementById('context-bar');
  const breadcrumbRoot    = document.getElementById('breadcrumb-root');
  const breadcrumbCurrent = document.getElementById('breadcrumb-current');
  const contextTitle      = document.getElementById('context-title');
  const contextCount      = document.getElementById('context-count');
  const sortSelect        = document.getElementById('sort-select');
  const jumpBar           = document.getElementById('jump-bar');
  const jumpBarChips      = document.getElementById('jump-bar-chips');

  const resultsInfo       = document.getElementById('results-info');
  const resultsCountText  = document.getElementById('results-count-text');
  const resultsClearBtn   = document.getElementById('results-clear-btn');
  const resultsChips      = document.getElementById('results-chips');

  const container         = document.getElementById('categories-container');
  const emptyState        = document.getElementById('empty-state');
  const emptyStateTitle   = document.getElementById('empty-state-title');
  const emptyStateDesc    = document.getElementById('empty-state-desc');
  const emptyStateBtn     = document.getElementById('empty-state-btn');
  const backToTop         = document.getElementById('back-to-top');
  const toastEl           = document.getElementById('toast');

  // --- Storage Helpers ---
  function loadJSON(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* ignore */ }
  }

  // --- Utility Helpers ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlightText(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const cleanQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${cleanQuery})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url || '';
    }
  }

  function getFaviconUrl(url) {
    const domain = getDomain(url);
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  }

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2400);
  }

  function animateCount(el, target, duration = 600) {
    if (!el || !target) return;
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // --- Setup Platform UI ---
  function setupPlatformHints() {
    if (searchKbd) searchKbd.textContent = `${modKey}+K`;
    const isEn = window.i18n && window.i18n.getLang() === 'en';
    if (sidebarShortcutH) {
      sidebarShortcutH.textContent = isEn ? `${modKey}+B to toggle` : `${modKey}+B pour basculer`;
    }
    if (sidebarCollapse) {
      sidebarCollapse.setAttribute('title', isEn ? `Toggle sidebar (${modKey}+B)` : `Basculer la barre latérale (${modKey}+B)`);
    }

    const kbdSearch = document.getElementById('kbd-shortcut-search');
    const kbdSidebar = document.getElementById('kbd-shortcut-sidebar');
    if (kbdSearch) kbdSearch.textContent = `${modKey}+K`;
    if (kbdSidebar) kbdSidebar.textContent = `${modKey}+B`;
  }

  // --- Internationalization UI Synchronizer ---
  function updateLanguageUI() {
    const currentLang = window.i18n ? window.i18n.getLang() : 'fr';
    const isEn = currentLang === 'en';

    // HTML lang attribute
    document.documentElement.lang = currentLang;

    // Document title
    document.title = t('app_title');

    // Language switcher buttons state
    if (langBtnFr) langBtnFr.classList.toggle('is-active', !isEn);
    if (langBtnEn) langBtnEn.classList.toggle('is-active', isEn);

    // Header buttons & placeholders
    if (searchInput) searchInput.placeholder = t('search_placeholder');
    if (categoryFilterIn) categoryFilterIn.placeholder = t('filter_categories_placeholder');
    if (labelStatTools) labelStatTools.textContent = t('tools_count_label');
    if (labelStatCats) labelStatCats.textContent = t('categories_count_label');
    if (densityToggle) densityToggle.title = t('density_toggle_title');
    if (shortcutsToggle) shortcutsToggle.title = t('shortcuts_toggle_title');

    // Sidebar labels
    if (sidebarHubLabel) sidebarHubLabel.textContent = t('workspace');
    if (labelNavAll) labelNavAll.textContent = t('all_tools');
    if (labelNavNoReg) labelNavNoReg.textContent = t('no_registration');
    if (labelNavFavorites) labelNavFavorites.textContent = t('favorites');
    if (labelNavRecent) labelNavRecent.textContent = t('recent');
    const footerTextEl = document.querySelector('.sidebar__footer-text');
    if (footerTextEl) footerTextEl.textContent = t('active_platform_hint');

    // Sort selector options
    const sortLabel = document.querySelector('.sort-label');
    if (sortLabel) sortLabel.textContent = t('sort_label');
    const optDefault = sortSelect ? sortSelect.querySelector('option[value="default"]') : null;
    const optAlpha = sortSelect ? sortSelect.querySelector('option[value="alpha"]') : null;
    if (optDefault) optDefault.textContent = t('sort_default');
    if (optAlpha) optAlpha.textContent = t('sort_alpha');

    // Jump Bar label
    const jumpLabel = document.querySelector('.jump-bar__label');
    if (jumpLabel) jumpLabel.textContent = t('subsections_label');

    // Search bar clear
    if (resultsClearBtn) resultsClearBtn.textContent = t('clear_filter_btn');

    // Empty state button
    if (emptyStateBtn) emptyStateBtn.textContent = t('reset_view_btn');

    // Shortcuts modal strings
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = t('shortcuts_modal_title');
    const thShortcut = document.getElementById('th-shortcut');
    const thAction = document.getElementById('th-action');
    if (thShortcut) thShortcut.textContent = t('shortcut_col_shortcut');
    if (thAction) thAction.textContent = t('shortcut_col_action');
    const rowSearch = document.getElementById('row-shortcut-search');
    const rowSidebar = document.getElementById('row-shortcut-sidebar');
    const rowEsc = document.getElementById('row-shortcut-esc');
    const rowNav = document.getElementById('row-shortcut-nav');
    const rowEnter = document.getElementById('row-shortcut-enter');
    const rowResize = document.getElementById('row-shortcut-resize');
    const rowHelp = document.getElementById('row-shortcut-help');
    const labelOrSlash = document.getElementById('label-or-slash');
    const labelBorderHint = document.getElementById('label-border-hint');

    if (rowSearch) rowSearch.textContent = t('shortcut_search_desc');
    if (rowSidebar) rowSidebar.textContent = t('shortcut_sidebar_desc');
    if (rowEsc) rowEsc.textContent = t('shortcut_esc_desc');
    if (rowNav) rowNav.textContent = t('shortcut_nav_desc');
    if (rowEnter) rowEnter.textContent = t('shortcut_enter_desc');
    if (rowResize) rowResize.textContent = t('shortcut_resize_desc');
    if (rowHelp) rowHelp.textContent = t('shortcut_help_desc');
    if (labelOrSlash) labelOrSlash.textContent = isEn ? 'or' : 'ou';
    if (labelBorderHint) labelBorderHint.textContent = isEn ? '(on the border)' : '(sur la bordure)';

    // Footer strings
    const footerBrandDesc = document.getElementById('footer-brand-desc');
    const footerLicenseText = document.getElementById('footer-license-text');
    const footerGithubLink = document.getElementById('footer-github-link');
    const footerNote = document.getElementById('footer-note');
    if (footerBrandDesc) footerBrandDesc.textContent = t('footer_brand');
    if (footerLicenseText) footerLicenseText.textContent = isEn ? 'License' : 'Licence';
    if (footerGithubLink) footerGithubLink.textContent = t('footer_github');
    if (footerNote) footerNote.textContent = t('footer_disclaimer');

    // Back to top button
    if (backToTop) backToTop.title = t('back_to_top');

    // Refresh platform hints (Ctrl vs Cmd + translated strings)
    setupPlatformHints();
  }

  // --- Setup Density ---
  function applyDensity(density) {
    currentDensity = density;
    localStorage.setItem('aaa_density', density);
    document.body.classList.toggle('density-compact', density === 'compact');
  }

  // --- Setup Resizer & Sidebar Width ---
  function setSidebarWidth(width) {
    const clamped = Math.max(220, Math.min(440, width));
    currentSidebarWidth = clamped;
    document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
    try {
      localStorage.setItem('aaa_sidebar_width', clamped);
    } catch (e) { /* ignore */ }
  }

  function setupSidebarResizer() {
    setSidebarWidth(currentSidebarWidth);

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    sidebarResizer.addEventListener('mousedown', (e) => {
      if (document.body.classList.contains('sidebar-collapsed') || isMobile()) return;
      isDragging = true;
      startX = e.clientX;
      startWidth = currentSidebarWidth;
      sidebarResizer.classList.add('is-dragging');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      setSidebarWidth(startWidth + delta);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        sidebarResizer.classList.remove('is-dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    });

    // Double-click to reset default width
    sidebarResizer.addEventListener('dblclick', () => {
      setSidebarWidth(280);
      showToast(t('toast_sidebar_reset'));
    });
  }

  // --- Setup Collapsed Sidebar ---
  function toggleSidebarCollapse() {
    if (isMobile()) {
      sidebar.classList.toggle('is-open');
      sidebarOverlay.classList.toggle('is-visible', sidebar.classList.contains('is-open'));
      return;
    }
    document.body.classList.toggle('sidebar-collapsed');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    try {
      localStorage.setItem('aaa_sidebar_collapsed', isCollapsed ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  // --- Favorites Management ---
  function toggleFavorite(tool, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const url = tool.url;
    if (favorites.has(url)) {
      favorites.delete(url);
      showToast(t('toast_fav_removed', { name: tool.name }));
    } else {
      favorites.add(url);
      showToast(t('toast_fav_added', { name: tool.name }));
    }
    saveJSON('aaa_favorites', Array.from(favorites));
    updateSidebarCounts();

    // If currently on favorites view, re-render
    if (activeView === 'favorites') {
      render();
    } else {
      // Update star button visuals on the current view
      document.querySelectorAll(`.tool-card__btn--star[data-url="${CSS.escape(url)}"]`).forEach(btn => {
        btn.classList.toggle('is-starred', favorites.has(url));
        btn.setAttribute('title', favorites.has(url) ? t('fav_remove_title') : t('fav_add_title'));
      });
    }
  }

  // --- Recent History Management ---
  function recordRecentTool(tool) {
    if (!tool || !tool.url) return;
    recentTools = recentTools.filter(t => t.url !== tool.url);
    recentTools.unshift({
      name: tool.name,
      url: tool.url,
      description: tool.description,
      description_fr: tool.description_fr || '',
      description_en: tool.description_en || '',
      access: tool.access || 'to_verify',
      access_details_fr: tool.access_details_fr || '',
      access_details_en: tool.access_details_en || '',
      categoryTitle: tool._categoryTitle || '',
      categorySlug: tool._categorySlug || '',
      timestamp: Date.now()
    });
    if (recentTools.length > 30) recentTools = recentTools.slice(0, 30);
    saveJSON('aaa_recent', recentTools);
    updateSidebarCounts();
  }

  function copyToolUrl(url, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    navigator.clipboard.writeText(url).then(() => {
      showToast(t('toast_copy_success'));
    }).catch(() => {
      showToast(t('toast_copy_fail'));
    });
  }

  function updateSidebarCounts() {
    if (countAll && DATA) countAll.textContent = DATA.totalTools || 947;
    if (countNoReg) {
      let count = (DATA && DATA.noRegistrationCount) ? DATA.noRegistrationCount : 0;
      if (!count && DATA && Array.isArray(DATA.categories)) {
        DATA.categories.forEach(c => {
          if (Array.isArray(c.groups)) {
            c.groups.forEach(g => {
              if (Array.isArray(g.tools)) {
                g.tools.forEach(t => {
                  if (['no_account', 'optional_account', 'limited_access'].includes(t.access)) {
                    count++;
                  }
                });
              }
            });
          }
        });
      }
      countNoReg.textContent = count || 501;
    }
    if (countFavorites) countFavorites.textContent = favorites.size;
    if (countRecent) countRecent.textContent = recentTools.length;
  }

  // --- Sidebar Build & Navigation ---
  function buildSidebarNav() {
    sidebarNav.innerHTML = '';
    const filterQuery = (categoryFilterIn.value || '').trim().toLowerCase();
    const domains = getDOMAINS();

    // Loop through each operational domain
    for (const domain of domains) {
      const domainTitle = window.i18n ? window.i18n.getDomainTitle(domain) : domain.title;

      // Find matching categories in DATA for this domain
      const domainCategories = DATA.categories.filter(c => domain.slugs.includes(c.slug));
      if (domainCategories.length === 0) continue;

      // Filter categories if user typed in sidebar search (matches in either FR or EN)
      const visibleCategories = filterQuery
        ? domainCategories.filter(c => {
            const titleFr = (c.title_fr || c.title || '').toLowerCase();
            const titleEn = (c.title_en || c.title || '').toLowerCase();
            return titleFr.includes(filterQuery) || titleEn.includes(filterQuery);
          })
        : domainCategories;

      if (filterQuery && visibleCategories.length === 0) continue;

      const domainTotalTools = domainCategories.reduce((s, c) => s + c.toolCount, 0);
      const isCollapsed = !filterQuery && collapsedDomains.has(domain.id);

      const domainEl = document.createElement('div');
      domainEl.className = `sidebar-domain ${isCollapsed ? 'is-collapsed' : ''}`;
      domainEl.dataset.domainId = domain.id;

      // Domain Header Accordion
      const header = document.createElement('button');
      header.className = 'sidebar-domain__header';
      header.innerHTML = `
        <div class="sidebar-domain__title-wrap">
          <svg class="sidebar-domain__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span class="sidebar-domain__title">${escapeHtml(domainTitle)}</span>
        </div>
        <span class="sidebar-domain__count">${domainTotalTools}</span>
      `;

      header.addEventListener('click', (e) => {
        e.stopPropagation();
        if (filterQuery) return; // Keep open during filtering
        domainEl.classList.toggle('is-collapsed');
        if (domainEl.classList.contains('is-collapsed')) {
          collapsedDomains.add(domain.id);
        } else {
          collapsedDomains.delete(domain.id);
        }
        saveJSON('aaa_collapsed_domains', Array.from(collapsedDomains));
      });

      domainEl.appendChild(header);

      // Category items list
      const list = document.createElement('div');
      list.className = 'sidebar-domain__list';

      for (const cat of visibleCategories) {
        const catTitle = window.i18n ? window.i18n.getCategoryTitle(cat) : cat.title;
        const item = document.createElement('button');
        item.className = `sidebar-item ${activeView === cat.slug ? 'sidebar-item--active' : ''}`;
        item.dataset.slug = cat.slug;
        item.dataset.tooltip = `${catTitle} (${cat.toolCount})`;
        item.innerHTML = `
          <span class="sidebar-item__icon">${cat.emoji}</span>
          <span class="sidebar-item__text">${highlightText(catTitle, filterQuery)}</span>
          <span class="sidebar-item__count">${cat.toolCount}</span>
        `;

        item.addEventListener('click', () => {
          selectCategory(cat.slug);
        });

        list.appendChild(item);
      }

      domainEl.appendChild(list);
      sidebarNav.appendChild(domainEl);
    }
  }

  function selectCategory(slug) {
    activeView = slug;
    activeSearchCategoryFilter = null;
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchKbd.style.display = '';
    searchQuery = '';

    updateActiveSidebarItem();
    render();

    if (isMobile()) {
      sidebar.classList.remove('is-open');
      sidebarOverlay.classList.remove('is-visible');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateActiveSidebarItem() {
    // Quick hub buttons
    document.querySelectorAll('.sidebar__quick-nav .sidebar-item').forEach(btn => {
      btn.classList.toggle('sidebar-item--active', btn.dataset.nav === activeView);
    });
    // Category items
    document.querySelectorAll('.sidebar__nav .sidebar-item').forEach(btn => {
      btn.classList.toggle('sidebar-item--active', btn.dataset.slug === activeView);
    });
  }

  // --- Switch to Intelligence X View with Optional Prefill ---
  function switchToIntelX(prefilledSelector = '') {
    activeView = 'intelx';
    activeSearchCategoryFilter = null;
    searchQuery = '';
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchKbd.style.display = '';

    updateActiveSidebarItem();
    render();

    if (prefilledSelector && intelxUI) {
      intelxUI.setPrefilledSelector(prefilledSelector);
    }

    if (isMobile()) {
      sidebar.classList.remove('is-open');
      sidebarOverlay.classList.remove('is-visible');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Switch to Investigation Workspace View with Optional Indicator ---
  function switchToInvestigation(indicatorValue = '') {
    activeView = 'investigation';
    activeSearchCategoryFilter = null;
    searchQuery = '';
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchKbd.style.display = '';

    updateActiveSidebarItem();
    render();

    if (indicatorValue && investigationUI) {
      investigationUI.addQuickIndicator(indicatorValue);
    }

    if (isMobile()) {
      sidebar.classList.remove('is-open');
      sidebarOverlay.classList.remove('is-visible');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Workspace Rendering Engine ---
  function render() {
    keyboardFocusedIndex = -1;
    container.innerHTML = '';
    jumpBar.style.display = 'none';
    jumpBarChips.innerHTML = '';

    // Update Context / Breadcrumb Bar
    updateContextBar();

    // 0. Investigation Workspace View
    if (activeView === 'investigation' && !searchQuery) {
      if (investigationUI) {
        investigationUI.render();
      }
      return;
    }

    // 0b. Intelligence X Investigation View
    if (activeView === 'intelx' && !searchQuery) {
      if (intelxUI) {
        intelxUI.render();
      }
      return;
    }

    // 1. Dedicated "Sans Inscription" View
    if (activeView === 'no-registration' && !searchQuery) {
      renderNoRegistrationView();
      return;
    }

    // 2. Favorites View
    if (activeView === 'favorites' && !searchQuery) {
      renderFavoritesView();
      return;
    }

    // 3. Recent Tools View
    if (activeView === 'recent' && !searchQuery) {
      renderRecentView();
      return;
    }

    // 4. Search Mode (Global or Filtered, Bilingual)
    if (searchQuery) {
      renderSearchView();
      return;
    }

    // 5. Specific Category or All Tools View
    renderStandardView();
  }

  function updateContextBar() {
    if (searchQuery) {
      breadcrumbRoot.textContent = t('search_results_title');
      breadcrumbCurrent.textContent = `« ${searchQuery} »`;
      contextTitle.textContent = t('search_results_title');
      resultsInfo.style.display = '';
      return;
    }

    resultsInfo.style.display = 'none';

    if (activeView === 'all') {
      breadcrumbRoot.textContent = t('workspace');
      breadcrumbCurrent.textContent = t('all_tools');
      contextTitle.textContent = t('all_tools_title');
      contextCount.textContent = t('all_tools_count', {
        tools: DATA.totalTools,
        categories: DATA.totalCategories
      });
    } else if (activeView === 'no-registration') {
      breadcrumbRoot.textContent = t('workspace');
      breadcrumbCurrent.textContent = t('no_registration');
      contextTitle.textContent = `🔓 ${t('no_reg_title')}`;
      const noRegCount = DATA.noRegistrationCount || 501;
      contextCount.textContent = t('no_reg_count', { count: noRegCount });
    } else if (activeView === 'investigation') {
      breadcrumbRoot.textContent = t('workspace');
      breadcrumbCurrent.textContent = t('nav_investigation') || 'Investigation';
      contextTitle.textContent = t('investigation_view_title');
      contextCount.textContent = t('investigation_view_count');
    } else if (activeView === 'intelx') {
      breadcrumbRoot.textContent = t('workspace');
      breadcrumbCurrent.textContent = t('intelx_module');
      contextTitle.textContent = t('intelx_view_title');
      contextCount.textContent = t('intelx_view_count');
    } else if (activeView === 'favorites') {
      breadcrumbRoot.textContent = t('workspace');
      breadcrumbCurrent.textContent = t('favorites');
      contextTitle.textContent = t('favorites_title');
      contextCount.textContent = t('favorites_count', {
        count: favorites.size,
        s: favorites.size > 1 ? 's' : ''
      });
    } else if (activeView === 'recent') {
      breadcrumbRoot.textContent = t('workspace');
      breadcrumbCurrent.textContent = t('recent');
      contextTitle.textContent = t('recent_title');
      contextCount.textContent = t('recent_count', {
        count: recentTools.length,
        s: recentTools.length > 1 ? 's' : ''
      });
    } else {
      const cat = DATA.categories.find(c => c.slug === activeView);
      if (cat) {
        const domain = getDOMAINS().find(d => d.slugs.includes(cat.slug));
        breadcrumbRoot.textContent = domain
          ? (window.i18n ? window.i18n.getDomainTitle(domain) : domain.title)
          : t('catalog_root');
        const catTitle = window.i18n ? window.i18n.getCategoryTitle(cat) : cat.title;
        breadcrumbCurrent.textContent = catTitle;
        contextTitle.textContent = `${cat.emoji} ${catTitle}`;
        contextCount.textContent = `${cat.toolCount} ${cat.toolCount > 1 ? t('tools_label') : t('tool_label')}`;
      }
    }
  }

  // --- Dedicated "Sans Inscription" (No Registration) Section ---
  function renderNoRegistrationView() {
    // 1. Gather all tools without mandatory registration from existing catalog
    // Statuses allowed: no_account, optional_account, limited_access
    const NO_REG_STATUSES = ['no_account', 'optional_account', 'limited_access'];

    let countNoAccount = 0;
    let countOptional = 0;
    let countLimited = 0;

    DATA.categories.forEach(cat => {
      cat.groups.forEach(group => {
        group.tools.forEach(tool => {
          if (tool.access === 'no_account') countNoAccount++;
          else if (tool.access === 'optional_account') countOptional++;
          else if (tool.access === 'limited_access') countLimited++;
        });
      });
    });

    const totalNoReg = countNoAccount + countOptional + countLimited;

    // Header Banner
    const banner = document.createElement('div');
    banner.className = 'no-reg-header-banner';
    banner.innerHTML = `
      <div class="no-reg-header-banner__top">
        <div class="no-reg-header-banner__icon">🔓</div>
        <div>
          <h2 class="no-reg-header-banner__title">${escapeHtml(t('no_reg_title'))}</h2>
          <p class="no-reg-header-banner__desc">${escapeHtml(t('no_reg_desc'))}</p>
        </div>
      </div>
      <div class="no-reg-chips" id="no-reg-chips"></div>
    `;

    // Filter Chips: All, No Account, Optional Account, Limited Access
    const chipsContainer = banner.querySelector('#no-reg-chips');
    const filterTabs = [
      { id: 'all', label: t('no_reg_tab_all', { count: totalNoReg }) },
      { id: 'no_account', label: t('no_reg_tab_no_account', { count: countNoAccount }) },
      { id: 'optional_account', label: t('no_reg_tab_optional', { count: countOptional }) },
      { id: 'limited_access', label: t('no_reg_tab_limited', { count: countLimited }) }
    ];

    filterTabs.forEach(tab => {
      const chip = document.createElement('button');
      chip.className = `no-reg-chip ${noRegSubFilter === tab.id ? 'is-active' : ''}`;
      chip.textContent = tab.label;
      chip.addEventListener('click', () => {
        noRegSubFilter = tab.id;
        render();
      });
      chipsContainer.appendChild(chip);
    });

    container.appendChild(banner);

    // Filter and group tools across categories
    let totalToolsRendered = 0;

    for (const cat of DATA.categories) {
      const matchingGroups = [];

      for (const group of cat.groups) {
        const matchingTools = group.tools.filter(tool => {
          if (noRegSubFilter === 'all') {
            return NO_REG_STATUSES.includes(tool.access);
          }
          return tool.access === noRegSubFilter;
        });

        if (matchingTools.length > 0) {
          matchingGroups.push({
            name: group.name,
            name_fr: group.name_fr,
            name_en: group.name_en,
            tools: matchingTools
          });
        }
      }

      if (matchingGroups.length === 0) continue;

      const catTitle = window.i18n ? window.i18n.getCategoryTitle(cat) : cat.title;
      const catCount = matchingGroups.reduce((s, g) => s + g.tools.length, 0);

      const section = document.createElement('section');
      section.className = 'category-section';
      section.id = `cat-${cat.slug}`;

      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = `
        <div class="category-header__emoji">${cat.emoji}</div>
        <h2 class="category-header__title">${escapeHtml(catTitle)}</h2>
        <span class="category-header__count">${catCount} ${catCount > 1 ? t('tools_label') : t('tool_label')}</span>
      `;
      section.appendChild(header);

      for (const group of matchingGroups) {
        let tools = [...group.tools];
        if (sortMode === 'alpha') {
          tools.sort((a, b) => a.name.localeCompare(b.name));
        }

        const groupName = window.i18n ? window.i18n.getGroupName(group) : group.name;

        const groupEl = document.createElement('div');
        groupEl.className = 'group';
        groupEl.innerHTML = `
          <div class="group__header">
            <h3 class="group__name">${escapeHtml(groupName)}</h3>
            <span class="group__count">${tools.length}</span>
          </div>
        `;

        const grid = document.createElement('div');
        grid.className = 'tools-grid';

        for (const tool of tools) {
          tool._categoryTitle = catTitle;
          tool._categorySlug = cat.slug;
          grid.appendChild(createToolCard(tool, catTitle, true));
          totalToolsRendered++;
        }

        groupEl.appendChild(grid);
        section.appendChild(groupEl);
      }

      container.appendChild(section);
    }

    if (totalToolsRendered === 0) {
      emptyState.style.display = '';
      const isEn = window.i18n && window.i18n.getLang() === 'en';
      emptyStateTitle.textContent = isEn
        ? 'No confirmed registration-free tools for this filter'
        : 'Aucun outil sans inscription confirmé pour ce filtre';
      emptyStateDesc.textContent = isEn
        ? 'Only tools whose registration-free access terms have been formally verified are listed here. Services with unconfirmed requirements remain under "To verify" to avoid misclassification.'
        : 'Seuls les outils dont les conditions d\'accès sans compte sont formellement vérifiées sont répertoriés ici. Les services incertains sont conservés sous « À vérifier » pour garantir une classification fiable.';
      emptyStateBtn.textContent = isEn ? 'Show all registration-free tools' : 'Afficher tous les outils sans inscription';
      emptyStateBtn.onclick = () => {
        noRegSubFilter = 'all';
        render();
      };
    } else {
      emptyState.style.display = 'none';
    }
  }

  function renderStandardView() {
    let categoriesToRender = DATA.categories;
    if (activeView !== 'all') {
      categoriesToRender = categoriesToRender.filter(c => c.slug === activeView);
    }

    let totalToolsRendered = 0;

    // If single category, build Jump Chips for subsections
    if (categoriesToRender.length === 1 && categoriesToRender[0].groups.length > 1) {
      jumpBar.style.display = 'flex';
      jumpBarChips.innerHTML = '';
      categoriesToRender[0].groups.forEach((g, idx) => {
        const groupName = window.i18n ? window.i18n.getGroupName(g) : g.name;
        const chip = document.createElement('button');
        chip.className = 'jump-chip';
        chip.textContent = `${groupName} (${g.tools.length})`;
        chip.addEventListener('click', () => {
          const el = document.getElementById(`group-sec-${idx}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        jumpBarChips.appendChild(chip);
      });
    }

    for (const cat of categoriesToRender) {
      const catTitle = window.i18n ? window.i18n.getCategoryTitle(cat) : cat.title;

      const section = document.createElement('section');
      section.className = 'category-section';
      section.id = `cat-${cat.slug}`;

      // Show header when viewing All Tools or multiple categories
      if (categoriesToRender.length > 1) {
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
          <div class="category-header__emoji">${cat.emoji}</div>
          <h2 class="category-header__title">${escapeHtml(catTitle)}</h2>
          <span class="category-header__count">${cat.toolCount} ${cat.toolCount > 1 ? t('tools_label') : t('tool_label')}</span>
        `;
        section.appendChild(header);
      }

      cat.groups.forEach((group, gIdx) => {
        if (group.tools.length === 0) return;

        let tools = [...group.tools];
        if (sortMode === 'alpha') {
          tools.sort((a, b) => a.name.localeCompare(b.name));
        }

        const groupName = window.i18n ? window.i18n.getGroupName(group) : group.name;

        const groupEl = document.createElement('div');
        groupEl.className = 'group';
        groupEl.id = `group-sec-${gIdx}`;

        groupEl.innerHTML = `
          <div class="group__header">
            <h3 class="group__name">${escapeHtml(groupName)}</h3>
            <span class="group__count">${tools.length}</span>
          </div>
        `;

        const grid = document.createElement('div');
        grid.className = 'tools-grid';

        for (const tool of tools) {
          tool._categoryTitle = catTitle;
          tool._categorySlug = cat.slug;
          grid.appendChild(createToolCard(tool, catTitle, categoriesToRender.length > 1));
          totalToolsRendered++;
        }

        groupEl.appendChild(grid);
        section.appendChild(groupEl);
      });

      container.appendChild(section);
    }

    emptyState.style.display = totalToolsRendered === 0 ? '' : 'none';
  }

  function renderFavoritesView() {
    const allToolsMap = new Map();
    DATA.categories.forEach(c => {
      const catTitle = window.i18n ? window.i18n.getCategoryTitle(c) : c.title;
      c.groups.forEach(g => {
        g.tools.forEach(t => {
          t._categoryTitle = catTitle;
          t._categorySlug = c.slug;
          allToolsMap.set(t.url, t);
        });
      });
    });

    const favTools = [];
    favorites.forEach(url => {
      if (allToolsMap.has(url)) {
        favTools.push(allToolsMap.get(url));
      }
    });

    if (sortMode === 'alpha') {
      favTools.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (favTools.length === 0) {
      emptyState.style.display = '';
      emptyStateTitle.textContent = t('favorites_empty_title');
      emptyStateDesc.textContent = t('favorites_empty_desc');
      emptyStateBtn.textContent = t('favorites_empty_btn');
      emptyStateBtn.onclick = () => selectCategory('all');
      return;
    }

    emptyState.style.display = 'none';

    const section = document.createElement('section');
    section.className = 'category-section';

    const grid = document.createElement('div');
    grid.className = 'tools-grid';

    for (const tool of favTools) {
      grid.appendChild(createToolCard(tool, tool._categoryTitle, true));
    }

    section.appendChild(grid);
    container.appendChild(section);
  }

  function renderRecentView() {
    if (recentTools.length === 0) {
      emptyState.style.display = '';
      emptyStateTitle.textContent = t('recent_empty_title');
      emptyStateDesc.textContent = t('recent_empty_desc');
      emptyStateBtn.textContent = t('recent_empty_btn');
      emptyStateBtn.onclick = () => selectCategory('all');
      return;
    }

    emptyState.style.display = 'none';

    const section = document.createElement('section');
    section.className = 'category-section';

    const grid = document.createElement('div');
    grid.className = 'tools-grid';

    for (const tool of recentTools) {
      grid.appendChild(createToolCard(tool, tool.categoryTitle || 'OSINT', true));
    }

    section.appendChild(grid);
    container.appendChild(section);
  }

  // --- Bilingual Search Engine ---
  function renderSearchView() {
    const query = searchQuery.toLowerCase().trim();
    const matchedCategories = [];
    let totalMatches = 0;
    const categoryHitsMap = new Map();

    for (const cat of DATA.categories) {
      const catTitleFr = (cat.title_fr || cat.title || '').toLowerCase();
      const catTitleEn = (cat.title_en || cat.title || '').toLowerCase();
      const catTitleMatch = catTitleFr.includes(query) || catTitleEn.includes(query);

      const matchingGroups = [];

      for (const group of cat.groups) {
        const groupNameFr = (group.name_fr || group.name || '').toLowerCase();
        const groupNameEn = (group.name_en || group.name || '').toLowerCase();
        const groupNameMatch = groupNameFr.includes(query) || groupNameEn.includes(query);

        const matchingTools = group.tools.filter(t => {
          const nameMatch = (t.name || '').toLowerCase().includes(query);
          const descEnMatch = (t.description || '').toLowerCase().includes(query);
          const descFrMatch = (t.description_fr || '').toLowerCase().includes(query);
          const domainMatch = getDomain(t.url).toLowerCase().includes(query);

          // Access status matching
          const accessKey = t.access || 'to_verify';
          const accessInfo = window.i18n ? window.i18n.getAccessInfo(accessKey) : null;
          const accessLabelMatch = accessInfo && accessInfo.label.toLowerCase().includes(query);
          const accessDetailsFrMatch = (t.access_details_fr || '').toLowerCase().includes(query);
          const accessDetailsEnMatch = (t.access_details_en || '').toLowerCase().includes(query);

          return (
            catTitleMatch ||
            groupNameMatch ||
            nameMatch ||
            descEnMatch ||
            descFrMatch ||
            domainMatch ||
            accessLabelMatch ||
            accessDetailsFrMatch ||
            accessDetailsEnMatch
          );
        });

        if (matchingTools.length > 0) {
          matchingGroups.push({
            name: group.name,
            name_fr: group.name_fr,
            name_en: group.name_en,
            tools: matchingTools
          });
        }
      }

      if (matchingGroups.length > 0) {
        const count = matchingGroups.reduce((s, g) => s + g.tools.length, 0);
        const localizedCatTitle = window.i18n ? window.i18n.getCategoryTitle(cat) : cat.title;
        matchedCategories.push({
          slug: cat.slug,
          emoji: cat.emoji,
          title: localizedCatTitle,
          groups: matchingGroups,
          matchCount: count
        });
        categoryHitsMap.set(cat.slug, { title: localizedCatTitle, count });
        totalMatches += count;
      }
    }

    // Build Results Banner & Filter Chips
    const isEn = window.i18n && window.i18n.getLang() === 'en';
    const toolWord = totalMatches > 1 ? t('tools_label') : t('tool_label');
    const foundWord = totalMatches > 1 ? t('found_plural') : t('found_label');
    const forWord = isEn ? 'for' : 'pour';

    resultsCountText.innerHTML = `<strong>${totalMatches}</strong> ${toolWord} ${foundWord} ${forWord} « <strong>${escapeHtml(query)}</strong> »`;

    resultsChips.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.className = `result-cat-chip ${!activeSearchCategoryFilter ? 'is-active' : ''}`;
    allChip.textContent = `${isEn ? 'All' : 'Tous'} (${totalMatches})`;
    allChip.addEventListener('click', () => {
      activeSearchCategoryFilter = null;
      render();
    });
    resultsChips.appendChild(allChip);

    for (const [slug, meta] of categoryHitsMap.entries()) {
      const chip = document.createElement('button');
      chip.className = `result-cat-chip ${activeSearchCategoryFilter === slug ? 'is-active' : ''}`;
      chip.textContent = `${meta.title} (${meta.count})`;
      chip.addEventListener('click', () => {
        activeSearchCategoryFilter = activeSearchCategoryFilter === slug ? null : slug;
        render();
      });
      resultsChips.appendChild(chip);
    }

    // Cross-module IntelX action chip
    const intelxSearchChip = document.createElement('button');
    intelxSearchChip.className = 'result-cat-chip result-cat-chip--intelx';
    intelxSearchChip.title = isEn
      ? `Search archives and leaks for "${escapeHtml(query)}" in Intelligence X`
      : `Lancer une recherche d'archives et de leaks sur « ${escapeHtml(query)} » dans Intelligence X`;
    intelxSearchChip.innerHTML = `<span>⚡</span> ${isEn ? 'Search' : 'Rechercher'} « <strong>${escapeHtml(query)}</strong> » ${isEn ? 'in IntelX' : 'dans IntelX'}`;
    intelxSearchChip.addEventListener('click', () => {
      switchToIntelX(query);
    });
    resultsChips.appendChild(intelxSearchChip);

    // Cross-module Investigation action chip
    const invSearchChip = document.createElement('button');
    invSearchChip.className = 'result-cat-chip result-cat-chip--investigation';
    invSearchChip.title = isEn
      ? `Investigate "${escapeHtml(query)}" in the Investigation workspace`
      : `Ouvrir une enquête sur « ${escapeHtml(query)} » dans le module d'Investigation`;
    invSearchChip.innerHTML = `<span>🕵️</span> ${isEn ? 'Investigate' : 'Enquêter sur'} « <strong>${escapeHtml(query)}</strong> »`;
    invSearchChip.addEventListener('click', () => {
      switchToInvestigation(query);
    });
    resultsChips.appendChild(invSearchChip);

    // Filter categories if specific chip active
    let displayCategories = matchedCategories;
    if (activeSearchCategoryFilter) {
      displayCategories = displayCategories.filter(c => c.slug === activeSearchCategoryFilter);
    }

    if (totalMatches === 0 || displayCategories.length === 0) {
      emptyState.style.display = '';
      emptyStateTitle.textContent = t('no_results_title');
      emptyStateDesc.innerHTML = isEn
        ? `No local tool matches « <strong>${escapeHtml(query)}</strong> ». You can launch this selector in Intelligence X archives or reset the search.`
        : `Aucun outil local ne correspond à « <strong>${escapeHtml(query)}</strong> ». Vous pouvez relancer ce sélecteur dans les archives d'Intelligence X ou réinitialiser la recherche.`;
      emptyStateBtn.textContent = `⚡ ${isEn ? 'Search' : 'Rechercher'} « ${escapeHtml(query)} » ${isEn ? 'in IntelX' : 'dans IntelX'}`;
      emptyStateBtn.onclick = () => switchToIntelX(query);
      return;
    }

    emptyState.style.display = 'none';

    for (const cat of displayCategories) {
      const section = document.createElement('section');
      section.className = 'category-section';

      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = `
        <div class="category-header__emoji">${cat.emoji}</div>
        <h2 class="category-header__title">${highlightText(cat.title, query)}</h2>
        <span class="category-header__count">${cat.matchCount} ${cat.matchCount > 1 ? t('results_label') : t('result_label')}</span>
      `;
      section.appendChild(header);

      for (const group of cat.groups) {
        let tools = [...group.tools];
        if (sortMode === 'alpha') {
          tools.sort((a, b) => a.name.localeCompare(b.name));
        }

        const groupName = window.i18n ? window.i18n.getGroupName(group) : group.name;

        const groupEl = document.createElement('div');
        groupEl.className = 'group';
        groupEl.innerHTML = `
          <div class="group__header">
            <h3 class="group__name">${highlightText(groupName, query)}</h3>
            <span class="group__count">${tools.length}</span>
          </div>
        `;

        const grid = document.createElement('div');
        grid.className = 'tools-grid';

        for (const tool of tools) {
          tool._categoryTitle = cat.title;
          tool._categorySlug = cat.slug;
          grid.appendChild(createToolCard(tool, cat.title, true, query));
        }

        groupEl.appendChild(grid);
        section.appendChild(groupEl);
      }

      container.appendChild(section);
    }
  }

  // --- Tool Card Component Factory ---
  function createToolCard(tool, categoryTag, showTag = false, query = '') {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.setAttribute('tabindex', '0');
    card.dataset.url = tool.url;

    const domain = getDomain(tool.url);
    const faviconSrc = getFaviconUrl(tool.url);
    const isStarred = favorites.has(tool.url);
    const initialLetter = (tool.name || 'O').charAt(0).toUpperCase();
    const isIntelXTool = /intelx|intelligence\s*x/i.test(tool.name || '') || /intelx\.io/i.test(tool.url || '');

    // Internationalized tool description & access status
    const description = window.i18n ? window.i18n.getToolDescription(tool) : tool.description;
    const accessKey = tool.access || 'to_verify';
    const accessInfo = window.i18n ? window.i18n.getAccessInfo(accessKey) : null;
    const isEn = window.i18n && window.i18n.getLang() === 'en';

    // Tooltip detail (prefers tool-specific explanation when available, fallback to status definition)
    const accessDetails = (isEn ? tool.access_details_en : tool.access_details_fr) || (accessInfo ? accessInfo.desc : '');
    const accessLabel = accessInfo ? accessInfo.label : accessKey;

    card.innerHTML = `
      <div class="tool-card__header">
        <div class="tool-card__brand">
          <img class="tool-card__favicon" src="${faviconSrc}" alt="" loading="lazy">
          <div class="tool-card__title-wrap">
            <span class="tool-card__name">
              ${highlightText(tool.name, query)}
              <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </span>
            <span class="tool-card__domain">${highlightText(domain, query)}</span>
          </div>
        </div>
        <div class="tool-card__actions">
          <button class="tool-card__btn tool-card__btn--pivot" title="${escapeHtml(t('pivot_intelx_title'))}" data-domain="${escapeHtml(domain)}">
            <span style="font-size:0.75rem; font-weight:700; color:var(--accent-cyan);">⚡</span>
          </button>
          <button class="tool-card__btn tool-card__btn--copy" title="${escapeHtml(t('copy_url_title'))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
          </button>
          <button class="tool-card__btn tool-card__btn--star ${isStarred ? 'is-starred' : ''}" data-url="${escapeHtml(tool.url)}" title="${isStarred ? escapeHtml(t('fav_remove_title')) : escapeHtml(t('fav_add_title'))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
      ${description ? `<p class="tool-card__desc">${highlightText(description, query)}</p>` : ''}
      <div class="tool-card__footer">
        <span class="access-badge access-badge--${accessKey}" title="${escapeHtml(accessDetails)}">${escapeHtml(accessLabel)}</span>
        ${isIntelXTool ? `<span class="tool-card__tag tool-card__tag--intelx" title="${escapeHtml(t('intelx_module'))}">⚡ ${escapeHtml(t('integrated_module'))}</span>` : ''}
        ${showTag && categoryTag ? `<span class="tool-card__tag">${escapeHtml(categoryTag)}</span>` : ''}
      </div>
    `;

    // Favicon Fallback
    const imgEl = card.querySelector('.tool-card__favicon');
    imgEl.addEventListener('error', () => {
      const fallback = document.createElement('div');
      fallback.className = 'tool-card__favicon-fallback';
      fallback.textContent = initialLetter;
      imgEl.replaceWith(fallback);
    });

    // Card Click -> Open Link & Record History
    card.addEventListener('click', (e) => {
      // Ignore if clicking action buttons or badges
      if (e.target.closest('.tool-card__btn') || e.target.closest('.tool-card__tag--intelx')) return;
      recordRecentTool(tool);
      window.open(tool.url, '_blank', 'noopener,noreferrer');
    });

    // Action: Copy URL
    const copyBtn = card.querySelector('.tool-card__btn--copy');
    copyBtn.addEventListener('click', (e) => {
      copyToolUrl(tool.url, e);
    });

    // Action: Star Favorite
    const starBtn = card.querySelector('.tool-card__btn--star');
    starBtn.addEventListener('click', (e) => {
      toggleFavorite(tool, e);
    });

    // Action: Pivot to IntelX
    const pivotBtn = card.querySelector('.tool-card__btn--pivot');
    if (pivotBtn) {
      pivotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        switchToIntelX(domain);
      });
    }

    // Action: IntelX Badge Click
    const intelxTag = card.querySelector('.tool-card__tag--intelx');
    if (intelxTag) {
      intelxTag.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        switchToIntelX(domain || '');
      });
    }

    return card;
  }

  // --- Search Input Handlers ---
  function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    const val = searchInput.value;
    searchClear.style.display = val ? '' : 'none';
    searchKbd.style.display = val ? 'none' : '';
    searchQuery = val.trim();
    activeSearchCategoryFilter = null;

    searchDebounceTimer = setTimeout(() => {
      render();
    }, 120);
  }

  function clearSearch() {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchKbd.style.display = '';
    searchQuery = '';
    activeSearchCategoryFilter = null;
    searchInput.focus();
    render();
  }

  // --- Keyboard Shortcuts & Navigation ---
  function setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Cmd/Ctrl + K or "/" -> Focus search
      if ((isCmdOrCtrl && key === 'k') || (e.key === '/' && document.activeElement !== searchInput && document.activeElement !== categoryFilterIn)) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }

      // Cmd/Ctrl + B -> Toggle sidebar collapse
      if (isCmdOrCtrl && key === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
        return;
      }

      // "?" -> Toggle shortcuts cheat sheet
      if (e.key === '?' && document.activeElement !== searchInput && document.activeElement !== categoryFilterIn) {
        e.preventDefault();
        toggleShortcutsModal();
        return;
      }

      // Escape key behavior
      if (e.key === 'Escape') {
        if (!shortcutsModal.style.display || shortcutsModal.style.display !== 'none') {
          shortcutsModal.style.display = 'none';
          shortcutsModal.setAttribute('aria-hidden', 'true');
          return;
        }

        if (document.activeElement === searchInput) {
          if (searchInput.value) {
            clearSearch();
          } else {
            searchInput.blur();
          }
          return;
        }

        if (sidebar.classList.contains('is-open')) {
          sidebar.classList.remove('is-open');
          sidebarOverlay.classList.remove('is-visible');
          return;
        }

        if (searchQuery) {
          clearSearch();
          return;
        }
      }

      // Arrow Down & Arrow Up -> Keyboard navigation across tool cards
      const allCards = Array.from(container.querySelectorAll('.tool-card'));
      if (allCards.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        if (document.activeElement === searchInput && e.key === 'ArrowDown') {
          e.preventDefault();
          keyboardFocusedIndex = 0;
          highlightCard(allCards, keyboardFocusedIndex);
          return;
        }

        if (keyboardFocusedIndex >= 0) {
          e.preventDefault();
          if (e.key === 'ArrowDown') {
            keyboardFocusedIndex = Math.min(keyboardFocusedIndex + 1, allCards.length - 1);
          } else if (e.key === 'ArrowUp') {
            keyboardFocusedIndex = Math.max(keyboardFocusedIndex - 1, 0);
          }
          highlightCard(allCards, keyboardFocusedIndex);
        }
      }

      // Enter key -> Open focused card
      if (e.key === 'Enter' && keyboardFocusedIndex >= 0 && allCards[keyboardFocusedIndex]) {
        const card = allCards[keyboardFocusedIndex];
        const url = card.dataset.url;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  function highlightCard(cards, index) {
    cards.forEach((c, idx) => {
      const isFocused = idx === index;
      c.classList.toggle('is-keyboard-active', isFocused);
      if (isFocused) {
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        c.focus();
      }
    });
  }

  function toggleShortcutsModal() {
    const isHidden = shortcutsModal.style.display === 'none';
    shortcutsModal.style.display = isHidden ? 'flex' : 'none';
    shortcutsModal.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
  }

  // --- Attach Event Handlers ---
  function attachEventHandlers() {
    // Language Switch Buttons & Container Delegation
    const langSwitchEl = document.getElementById('lang-switch');
    if (langSwitchEl) {
      langSwitchEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.lang-btn');
        if (!btn) return;
        const targetLang = btn.dataset.lang;
        if (targetLang && window.i18n && window.i18n.getLang() !== targetLang) {
          window.i18n.setLang(targetLang);
        }
      });
    }

    if (langBtnFr) {
      langBtnFr.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.i18n && window.i18n.getLang() !== 'fr') {
          window.i18n.setLang('fr');
        }
      });
    }

    if (langBtnEn) {
      langBtnEn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.i18n && window.i18n.getLang() !== 'en') {
          window.i18n.setLang('en');
        }
      });
    }

    // React to language changes
    if (window.i18n) {
      window.i18n.onLanguageChange(() => {
        updateLanguageUI();
        buildSidebarNav();
        render();
        showToast(t('toast_lang_changed'));
      });
    }

    // Search Events
    searchInput.addEventListener('input', handleSearchInput);
    searchClear.addEventListener('click', clearSearch);
    resultsClearBtn.addEventListener('click', clearSearch);

    // Sidebar Category Filter Input
    categoryFilterIn.addEventListener('input', () => {
      const val = categoryFilterIn.value;
      categoryFilterClr.style.display = val ? '' : 'none';
      buildSidebarNav();
    });

    categoryFilterClr.addEventListener('click', () => {
      categoryFilterIn.value = '';
      categoryFilterClr.style.display = 'none';
      buildSidebarNav();
      categoryFilterIn.focus();
    });

    // Sidebar Toggles
    sidebarToggle.addEventListener('click', toggleSidebarCollapse);
    sidebarCollapse.addEventListener('click', toggleSidebarCollapse);
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('is-open');
      sidebarOverlay.classList.remove('is-visible');
    });

    // Brand click -> Return to all tools
    brandHome.addEventListener('click', () => selectCategory('all'));

    // Breadcrumb root click
    breadcrumbRoot.addEventListener('click', () => selectCategory('all'));

    // Quick Hub Navigation
    document.querySelectorAll('.sidebar__quick-nav .sidebar-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        activeView = nav;
        activeSearchCategoryFilter = null;
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchKbd.style.display = '';
        searchQuery = '';
        updateActiveSidebarItem();
        render();
        if (isMobile()) {
          sidebar.classList.remove('is-open');
          sidebarOverlay.classList.remove('is-visible');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Density Switcher
    densityToggle.addEventListener('click', () => {
      const newDensity = currentDensity === 'compact' ? 'comfortable' : 'compact';
      applyDensity(newDensity);
      showToast(newDensity === 'compact' ? t('toast_density_compact') : t('toast_density_comfortable'));
    });

    // Shortcuts Modal
    shortcutsToggle.addEventListener('click', toggleShortcutsModal);
    shortcutsClose.addEventListener('click', toggleShortcutsModal);
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) toggleShortcutsModal();
    });

    // Sort Selector
    sortSelect.addEventListener('change', () => {
      sortMode = sortSelect.value;
      render();
    });

    // Back to top floating button
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('back-to-top--visible', window.scrollY > 300);
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Resize Handler
    window.addEventListener('resize', () => {
      if (!isMobile() && sidebar.classList.contains('is-open')) {
        sidebar.classList.remove('is-open');
        sidebarOverlay.classList.remove('is-visible');
      }
    }, { passive: true });
  }

  // --- Initializer ---
  async function init() {
    setupPlatformHints();
    applyDensity(currentDensity);
    setupSidebarResizer();
    setupKeyboardListeners();
    attachEventHandlers();
    updateLanguageUI();

    // Restore collapsed sidebar state on desktop
    try {
      if (localStorage.getItem('aaa_sidebar_collapsed') === '1' && !isMobile()) {
        document.body.classList.add('sidebar-collapsed');
      }
    } catch (e) { /* ignore */ }

    // Fetch data with cache-busting to prevent stale browser responses
    try {
      const res = await fetch('data.json?v=' + Date.now(), { cache: 'no-cache' });
      DATA = await res.json();
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <h2>Erreur lors du chargement des données</h2>
          <p>Assurez-vous que le fichier <code>site/data.json</code> existe et est accessible.</p>
        </div>
      `;
      return;
    }

    // Animate stats
    animateCount(statTools, DATA.totalTools);
    animateCount(statCategories, DATA.totalCategories);

    // Initialize Intelligence X Adapter & UI
    try {
      if (typeof IntelXClient !== 'undefined' && typeof IntelXUI !== 'undefined') {
        intelxClient = new IntelXClient();
        intelxUI = new IntelXUI(intelxClient, {
          container,
          onNavigate: (view, term) => {
            if (view === 'intelx') switchToIntelX(term);
          },
          showToast,
        });
      }
    } catch (e) {
      console.warn('IntelX module initialization deferred or failed:', e);
    }

    // Initialize Investigation Engine & UI
    try {
      if (typeof InvestigationEngine !== 'undefined' && typeof InvestigationUI !== 'undefined') {
        investigationEngine = new InvestigationEngine({
          catalogData: DATA,
          intelxClient,
        });
        investigationUI = new InvestigationUI(investigationEngine, {
          container,
          catalogData: DATA,
          intelxClient,
          onNavigate: (view, term) => {
            if (view === 'intelx') switchToIntelX(term);
            if (view === 'investigation') switchToInvestigation(term);
          },
          showToast,
        });
      }
    } catch (e) {
      console.warn('Investigation module initialization deferred or failed:', e);
    }

    // Build sidebar and render initial view
    updateSidebarCounts();
    buildSidebarNav();
    render();
  }

  init();
})();
