/**
 * AAA_OSINT — Front-end Application
 *
 * Loads data.json and renders a searchable, category-filterable
 * directory of OSINT tools with fuzzy matching and smooth animations.
 */

(function () {
  'use strict';

  // --- DOM refs ---
  const searchInput        = document.getElementById('search-input');
  const searchKbd          = document.getElementById('search-kbd');
  const searchClear        = document.getElementById('search-clear');
  const catNavInner        = document.getElementById('cat-nav-inner');
  const container          = document.getElementById('categories-container');
  const emptyState         = document.getElementById('empty-state');
  const resultsInfo        = document.getElementById('results-info');
  const statTools          = document.getElementById('stat-tools');
  const statCategories     = document.getElementById('stat-categories');
  const backToTop          = document.getElementById('back-to-top');

  let DATA = null;
  let activeCategory = null;
  let searchTimeout = null;

  // --- Utility ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function getFaviconUrl(url) {
    const domain = getDomain(url);
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }

  // --- Animate counter ---
  function animateCount(el, target, duration = 800) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // --- Build Category Nav ---
  function buildNav() {
    const allChip = document.createElement('button');
    allChip.className = 'cat-chip cat-chip--active';
    allChip.innerHTML = `All <span class="cat-chip__count">${DATA.totalTools}</span>`;
    allChip.dataset.slug = '';
    allChip.addEventListener('click', () => {
      activeCategory = null;
      setActiveChip('');
      render();
    });
    catNavInner.appendChild(allChip);

    for (const cat of DATA.categories) {
      const chip = document.createElement('button');
      chip.className = 'cat-chip';
      chip.innerHTML = `${cat.emoji} ${cat.title} <span class="cat-chip__count">${cat.toolCount}</span>`;
      chip.dataset.slug = cat.slug;
      chip.addEventListener('click', () => {
        activeCategory = cat.slug;
        setActiveChip(cat.slug);
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchKbd.style.display = '';
        render();
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      catNavInner.appendChild(chip);
    }
  }

  function setActiveChip(slug) {
    catNavInner.querySelectorAll('.cat-chip').forEach(c => {
      c.classList.toggle('cat-chip--active', c.dataset.slug === slug);
    });
  }

  // --- Render ---
  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const categories = filterCategories(query);

    container.innerHTML = '';
    let totalVisible = 0;

    for (const cat of categories) {
      const section = document.createElement('section');
      section.className = 'category-section';
      section.id = `cat-${cat.slug}`;

      // Header
      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = `
        <div class="category-header__emoji">${cat.emoji}</div>
        <h2 class="category-header__title">${highlightText(cat.title, query)}</h2>
        <span class="category-header__count">${cat.visibleCount} tool${cat.visibleCount !== 1 ? 's' : ''}</span>
      `;
      section.appendChild(header);

      for (const group of cat.groups) {
        if (group.tools.length === 0) continue;

        const groupEl = document.createElement('div');
        groupEl.className = 'group';

        const groupName = document.createElement('h3');
        groupName.className = 'group__name';
        groupName.innerHTML = highlightText(group.name, query);
        groupEl.appendChild(groupName);

        const grid = document.createElement('div');
        grid.className = 'tools-grid';

        for (const tool of group.tools) {
          const card = document.createElement('a');
          card.className = 'tool-card';
          card.href = tool.url;
          card.target = '_blank';
          card.rel = 'noopener noreferrer';

          const faviconSrc = getFaviconUrl(tool.url);
          const domain = getDomain(tool.url);

          card.innerHTML = `
            ${faviconSrc ? `<img class="tool-card__favicon" src="${faviconSrc}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="tool-card__body">
              <div class="tool-card__name">
                ${highlightText(tool.name, query)}
                <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </div>
              ${tool.description ? `<div class="tool-card__desc">${highlightText(tool.description, query)}</div>` : ''}
              <div class="tool-card__domain">${escapeHtml(domain)}</div>
            </div>
          `;
          grid.appendChild(card);
        }

        groupEl.appendChild(grid);
        section.appendChild(groupEl);
      }

      container.appendChild(section);
      totalVisible += cat.visibleCount;
    }

    // Empty state
    emptyState.style.display = totalVisible === 0 ? '' : 'none';

    // Results info
    if (query) {
      resultsInfo.style.display = '';
      resultsInfo.innerHTML = `Found <strong>${totalVisible}</strong> tool${totalVisible !== 1 ? 's' : ''} matching "<strong>${escapeHtml(query)}</strong>"`;
    } else {
      resultsInfo.style.display = 'none';
    }
  }

  function filterCategories(query) {
    let categories = DATA.categories;

    // Filter by active category
    if (activeCategory) {
      categories = categories.filter(c => c.slug === activeCategory);
    }

    return categories.map(cat => {
      const filteredGroups = cat.groups.map(group => {
        const tools = query
          ? group.tools.filter(t =>
              t.name.toLowerCase().includes(query) ||
              t.description.toLowerCase().includes(query) ||
              getDomain(t.url).toLowerCase().includes(query)
            )
          : group.tools;

        return { name: group.name, tools };
      }).filter(g => g.tools.length > 0);

      // Also include if category title matches
      const titleMatch = query && cat.title.toLowerCase().includes(query);
      const visibleGroups = titleMatch && filteredGroups.length === 0
        ? cat.groups // show all if the category title matches
        : filteredGroups;

      const visibleCount = visibleGroups.reduce((s, g) => s + g.tools.length, 0);

      return { ...cat, groups: visibleGroups, visibleCount };
    }).filter(cat => cat.visibleCount > 0);
  }

  // --- Search ---
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const val = searchInput.value;
    searchClear.style.display = val ? '' : 'none';
    searchKbd.style.display = val ? 'none' : '';

    if (val && activeCategory) {
      activeCategory = null;
      setActiveChip('');
    }

    searchTimeout = setTimeout(() => render(), 120);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchKbd.style.display = '';
    searchInput.focus();
    render();
  });

  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.blur();
      if (searchInput.value) {
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchKbd.style.display = '';
        render();
      }
    }
  });

  // --- Back to top ---
  window.addEventListener('scroll', () => {
    backToTop.classList.toggle('back-to-top--visible', window.scrollY > 400);
  }, { passive: true });

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // --- Init ---
  async function init() {
    try {
      const res = await fetch('data.json');
      DATA = await res.json();
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <h2>Failed to load data</h2>
          <p>Run <code>npm run build</code> first, then <code>npm run serve</code>.</p>
        </div>
      `;
      return;
    }

    // Animate stats
    animateCount(statTools, DATA.totalTools);
    animateCount(statCategories, DATA.totalCategories);

    buildNav();
    render();
  }

  init();
})();
