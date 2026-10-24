/**
 * AAA_OSINT — Centralized Internationalization (i18n) Engine
 * 
 * Languages supported:
 * - 'fr' (Français, default)
 * - 'en' (English)
 * 
 * Features:
 * - Zero dependency, high performance.
 * - Centralized dictionary with complete UI, category, domain and status translations.
 * - Reactive language switching without page reload.
 * - Persistence in localStorage ('aaa_lang').
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.i18n = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Domain Taxonomy ---
  const DOMAINS = [
    {
      id: 'identity',
      title_fr: 'Identité & Personnes',
      title_en: 'Identity & People',
      slugs: ['people-social', 'phishing-email', 'image-reverse', 'video-osint']
    },
    {
      id: 'cyber',
      title_fr: 'Cyber & Infrastructure',
      title_en: 'Cyber & Infrastructure',
      slugs: ['infra-domains', 'darkweb-leaks', 'malware-cti', 'automation-recon', 'comms']
    },
    {
      id: 'geoint',
      title_fr: 'Géospatial & Transports',
      title_en: 'Geospatial & Transportation',
      slugs: ['geospatial-mapping', 'aviation', 'maritime', 'railways']
    },
    {
      id: 'intel',
      title_fr: 'Renseignement & Enquête',
      title_en: 'Intelligence & Investigation',
      slugs: ['intel-feeds', 'news-media', 'business-intel', 'gov-legal', 'document-file', 'ai-osint']
    },
    {
      id: 'resources',
      title_fr: 'Ressources & Archivage',
      title_en: 'Resources & Archiving',
      slugs: ['search-engines', 'archiving-caching', 'academic', 'reporting-visualization', 'learning', 'osint-for-good']
    }
  ];

  // --- Access Status Metadata ---
  const ACCESS_STATUSES = {
    no_account: {
      key: 'no_account',
      fr: {
        label: 'Sans compte',
        shortLabel: 'Sans compte',
        badge: '🟢 Sans compte',
        desc: "Utilisable directement, sans création de compte ni inscription obligatoire."
      },
      en: {
        label: 'No account',
        shortLabel: 'No account',
        badge: '🟢 No account',
        desc: "Usable directly, without account creation or mandatory registration."
      },
      pillClass: 'access-badge--no-account',
      dotColor: 'var(--accent-green)'
    },
    optional_account: {
      key: 'optional_account',
      fr: {
        label: 'Compte facultatif',
        shortLabel: 'Compte facultatif',
        badge: '🔵 Compte facultatif',
        desc: "Fonctionnalités principales accessibles sans compte ; fonctions avancées avec compte."
      },
      en: {
        label: 'Optional account',
        shortLabel: 'Optional account',
        badge: '🔵 Optional account',
        desc: "Core features accessible without account; advanced features with account."
      },
      pillClass: 'access-badge--optional',
      dotColor: 'var(--accent-cyan)'
    },
    limited_access: {
      key: 'limited_access',
      fr: {
        label: 'Accès limité',
        shortLabel: 'Accès limité',
        badge: '🟡 Accès limité',
        desc: "Utilisation sans compte possible, mais avec limites, quotas ou restrictions de résultats."
      },
      en: {
        label: 'Limited access',
        shortLabel: 'Limited access',
        badge: '🟡 Limited access',
        desc: "Usable without account, but with limits, quotas or restricted results."
      },
      pillClass: 'access-badge--limited',
      dotColor: 'var(--accent-amber)'
    },
    required_account: {
      key: 'required_account',
      fr: {
        label: 'Inscription requise',
        shortLabel: 'Inscription requise',
        badge: '🔒 Inscription requise',
        desc: "Un compte utilisateur est obligatoire pour accéder et utiliser le service."
      },
      en: {
        label: 'Account required',
        shortLabel: 'Account required',
        badge: '🔒 Account required',
        desc: "A user account is mandatory to access and use the service."
      },
      pillClass: 'access-badge--required',
      dotColor: 'var(--accent-red)'
    },
    to_verify: {
      key: 'to_verify',
      fr: {
        label: 'À vérifier',
        shortLabel: 'À vérifier',
        badge: '⚪ À vérifier',
        desc: "Modalités d'accès et d'inscription actuellement non confirmées."
      },
      en: {
        label: 'To verify',
        shortLabel: 'To verify',
        badge: '⚪ To verify',
        desc: "Access conditions and registration requirements currently unconfirmed."
      },
      pillClass: 'access-badge--verify',
      dotColor: 'var(--text-muted)'
    }
  };

  // --- Complete UI String Dictionary ---
  const STRINGS = {
    fr: {
      app_title: "AAA_OSINT — Espace de Renseignement & Catalogue OSINT",
      workspace: "Espace de travail",
      all_tools: "Tous les outils",
      favorites: "Favoris",
      recent: "Récemment consultés",
      no_registration: "Sans inscription",
      intelx_module: "Intelligence X",
      intelx_badge: "API",
      integrated_module: "Module Intégré",
      search_placeholder: "Rechercher un outil, domaine, description, mot-clé...",
      search_clear: "Effacer la recherche (Esc)",
      filter_categories_placeholder: "Filtrer les 25 catégories...",
      active_platform_hint: "Base OSINT 2.0 active",
      sidebar_toggle_title: "Basculer la barre latérale",
      density_toggle_title: "Densité d'affichage (Compact / Confortable)",
      shortcuts_toggle_title: "Raccourcis clavier (?)",
      tools_count_label: "outils",
      categories_count_label: "catégories",
      sort_label: "Tri :",
      sort_default: "Ordre thématique",
      sort_alpha: "Alphabétique (A-Z)",
      subsections_label: "Sous-sections :",
      results_label: "Recherche",
      clear_filter_btn: "Effacer le filtre (Esc)",
      search_results_title: "Résultats de recherche",
      no_results_title: "Aucun résultat trouvé",
      no_results_desc: "Essayez un autre mot-clé ou réinitialisez la recherche pour parcourir l'ensemble des catégories.",
      reset_view_btn: "Réinitialiser la vue",
      catalog_root: "Catalogue",
      all_tools_title: "Catalogue général OSINT",
      all_tools_count: "{tools} outils · {categories} catégories",
      no_reg_title: "Outils sans inscription obligatoire",
      no_reg_count: "{count} outils accessibles directement",
      no_reg_tab_all: "Tous sans inscription ({count})",
      no_reg_tab_no_account: "Sans compte ({count})",
      no_reg_tab_optional: "Compte facultatif ({count})",
      no_reg_tab_limited: "Accès limité ({count})",
      no_reg_desc: "Outils OSINT immédiatement exploitables sans inscription préalable ni authentification obligatoire.",
      favorites_title: "Outils favoris enregistrés",
      favorites_count: "{count} outil{s}",
      favorites_empty_title: "Aucun outil dans vos favoris",
      favorites_empty_desc: "Cliquez sur l'étoile (★) d'une carte d'outil pour l'épingler dans cet espace permanent.",
      favorites_empty_btn: "Explorer tous les outils",
      recent_title: "Outils récemment consultés",
      recent_count: "{count} outil{s}",
      recent_empty_title: "Aucun outil consulté récemment",
      recent_empty_desc: "Les outils que vous ouvrirez durant vos investigations apparaîtront automatiquement ici.",
      recent_empty_btn: "Parcourir le catalogue",
      intelx_view_title: "⚡ Module d'Investigation Intelligence X",
      intelx_view_count: "Archives & Leaks connectées",
      copy_url_title: "Copier l'URL",
      pivot_intelx_title: "Pivoter ce domaine dans Intelligence X",
      fav_add_title: "Ajouter aux favoris",
      fav_remove_title: "Retirer des favoris",
      toast_fav_added: "Ajouté aux favoris : {name}",
      toast_fav_removed: "Retiré des favoris : {name}",
      toast_copy_success: "Lien copié dans le presse-papier !",
      toast_copy_fail: "Impossible de copier le lien.",
      toast_density_compact: "Mode compact activé",
      toast_density_comfortable: "Mode standard activé",
      toast_sidebar_reset: "Largeur de navigation réinitialisée (280px)",
      toast_lang_changed: "Langue modifiée : Français",
      shortcuts_modal_title: "Raccourcis clavier & Navigation Desktop",
      shortcut_col_shortcut: "Raccourci",
      shortcut_col_action: "Action",
      shortcut_search_desc: "Activer et cibler la recherche globale",
      shortcut_sidebar_desc: "Masquer / Déplier la barre latérale",
      shortcut_esc_desc: "Effacer la recherche / Fermer les fenêtres",
      shortcut_nav_desc: "Naviguer au clavier parmi les cartes d'outils",
      shortcut_enter_desc: "Ouvrir le lien de l'outil sélectionné",
      shortcut_resize_desc: "Réinitialiser la largeur de la barre latérale",
      shortcut_help_desc: "Afficher cette aide des raccourcis",
      footer_disclaimer: "⚠️ La majorité des outils sont des services tiers. Vérifiez toujours la légalité et la sécurité de vos requêtes dans le cadre de vos investigations.",
      footer_brand: "Workspace d'investigation en sources ouvertes.",
      footer_license: "Licence CC0 1.0 Universal",
      footer_github: "Code source GitHub",
      back_to_top: "Haut de page",
      tool_label: "outil",
      tools_label: "outils",
      result_label: "résultat",
      results_label: "résultats",
      found_label: "trouvé",
      found_plural: "trouvés",
      nav_investigation: "Investigation",
      badge_new: "NOUVEAU",
      investigation_module: "Module Investigation",
      investigation_view_title: "🕵️ Espace d'Investigation OSINT & Rapports",
      investigation_view_count: "Multi-sources, recoupements & génération automatique",
      tab_indicators: "Indices & Contexte",
      tab_tools: "Outils Recommandés",
      tab_findings: "Preuves & Découvertes",
      tab_correlations: "Corrélations & Pivots",
      tab_report: "Rapport d'Investigation",
      tab_saved: "Mes Enquêtes",
      new_investigation: "Nouvelle enquête",
      save_investigation: "Sauvegarder",
      export_report: "Exporter le rapport",
      export_json: "Exporter JSON",
      import_json: "Importer JSON",
      delete_investigation: "Supprimer",
      print_report: "Imprimer / PDF",
      copy_markdown: "Copier Markdown",
      download_markdown: "Télécharger .md",
      download_html: "Télécharger .html",
      add_indicator_btn: "Ajouter l'indice",
      indicator_placeholder: "Saisir un indice (email, nom, pseudo, domaine, IP, tel, etc.)...",
      investigation_name_placeholder: "Nom de l'enquête (ex: Affaire John Doe / Entreprise X)...",
      investigation_obj_placeholder: "Objectif / Contexte de l'enquête...",
      toast_investigation_saved: "Enquête sauvegardée avec succès !",
      toast_investigation_deleted: "Enquête supprimée.",
      toast_indicator_added: "Indice ajouté à l'enquête.",
      toast_finding_added: "Preuve ajoutée à l'enquête.",
      toast_report_copied: "Rapport copié dans le presse-papier !",
      toast_intelx_scan_done: "Recherche IntelX terminée : {count} résultats trouvés.",
      confidence_confirmed: "Confirmé",
      confidence_probable: "Probable",
      confidence_uncertain: "Incertain"
    },
    en: {
      app_title: "AAA_OSINT — Intelligence Workspace & OSINT Catalog",
      workspace: "Workspace",
      all_tools: "All tools",
      favorites: "Favorites",
      recent: "Recently viewed",
      no_registration: "No registration",
      intelx_module: "Intelligence X",
      intelx_badge: "API",
      integrated_module: "Integrated Module",
      search_placeholder: "Search tool, domain, description, keyword...",
      search_clear: "Clear search (Esc)",
      filter_categories_placeholder: "Filter the 25 categories...",
      active_platform_hint: "OSINT 2.0 Base active",
      sidebar_toggle_title: "Toggle sidebar",
      density_toggle_title: "Display density (Compact / Comfortable)",
      shortcuts_toggle_title: "Keyboard shortcuts (?)",
      tools_count_label: "tools",
      categories_count_label: "categories",
      sort_label: "Sort:",
      sort_default: "Thematic order",
      sort_alpha: "Alphabetical (A-Z)",
      subsections_label: "Subsections:",
      results_label: "Search",
      clear_filter_btn: "Clear filter (Esc)",
      search_results_title: "Search results",
      no_results_title: "No results found",
      no_results_desc: "Try another keyword or reset the search to browse all categories.",
      reset_view_btn: "Reset view",
      catalog_root: "Catalog",
      all_tools_title: "General OSINT Catalog",
      all_tools_count: "{tools} tools · {categories} categories",
      no_reg_title: "Tools without mandatory registration",
      no_reg_count: "{count} directly accessible tools",
      no_reg_tab_all: "All without registration ({count})",
      no_reg_tab_no_account: "No account ({count})",
      no_reg_tab_optional: "Optional account ({count})",
      no_reg_tab_limited: "Limited access ({count})",
      no_reg_desc: "OSINT tools immediately usable without prior registration or mandatory authentication.",
      favorites_title: "Saved favorite tools",
      favorites_count: "{count} tool{s}",
      favorites_empty_title: "No tools in your favorites",
      favorites_empty_desc: "Click the star (★) on any tool card to pin it into this permanent workspace.",
      favorites_empty_btn: "Explore all tools",
      recent_title: "Recently viewed tools",
      recent_count: "{count} tool{s}",
      recent_empty_title: "No recently viewed tools",
      recent_empty_desc: "Tools you open during your investigations will automatically appear here.",
      recent_empty_btn: "Browse catalog",
      intelx_view_title: "⚡ Intelligence X Investigation Module",
      intelx_view_count: "Archives & Leaks connected",
      copy_url_title: "Copy URL",
      pivot_intelx_title: "Pivot this domain in Intelligence X",
      fav_add_title: "Add to favorites",
      fav_remove_title: "Remove from favorites",
      toast_fav_added: "Added to favorites: {name}",
      toast_fav_removed: "Removed from favorites: {name}",
      toast_copy_success: "Link copied to clipboard!",
      toast_copy_fail: "Could not copy link.",
      toast_density_compact: "Compact mode enabled",
      toast_density_comfortable: "Standard mode enabled",
      toast_sidebar_reset: "Navigation width reset (280px)",
      toast_lang_changed: "Language changed: English",
      shortcuts_modal_title: "Keyboard Shortcuts & Desktop Navigation",
      shortcut_col_shortcut: "Shortcut",
      shortcut_col_action: "Action",
      shortcut_search_desc: "Focus and target global search",
      shortcut_sidebar_desc: "Show / Hide sidebar",
      shortcut_esc_desc: "Clear search / Close modals",
      shortcut_nav_desc: "Keyboard navigate through tool cards",
      shortcut_enter_desc: "Open selected tool link",
      shortcut_resize_desc: "Reset sidebar width",
      shortcut_help_desc: "Show this shortcuts cheat sheet",
      footer_disclaimer: "⚠️ Most tools are third-party services. Always verify the legality and security of your queries in your investigations.",
      footer_brand: "Open source intelligence investigation workspace.",
      footer_license: "CC0 1.0 Universal License",
      footer_github: "GitHub Source Code",
      back_to_top: "Back to top",
      tool_label: "tool",
      tools_label: "tools",
      result_label: "result",
      results_label: "results",
      found_label: "found",
      found_plural: "found",
      nav_investigation: "Investigation",
      badge_new: "NEW",
      investigation_module: "Investigation Module",
      investigation_view_title: "🕵️ OSINT Investigation Workspace & Reports",
      investigation_view_count: "Multi-source, cross-referencing & automatic reporting",
      tab_indicators: "Indicators & Context",
      tab_tools: "Recommended Tools",
      tab_findings: "Evidence & Findings",
      tab_correlations: "Correlations & Pivots",
      tab_report: "Investigation Report",
      tab_saved: "Saved Cases",
      new_investigation: "New Investigation",
      save_investigation: "Save Case",
      export_report: "Export Report",
      export_json: "Export JSON",
      import_json: "Import JSON",
      delete_investigation: "Delete",
      print_report: "Print / PDF",
      copy_markdown: "Copy Markdown",
      download_markdown: "Download .md",
      download_html: "Download .html",
      add_indicator_btn: "Add Indicator",
      indicator_placeholder: "Enter an indicator (email, name, handle, domain, IP, phone, etc.)...",
      investigation_name_placeholder: "Case name (e.g. Case John Doe / Company X)...",
      investigation_obj_placeholder: "Objective / Scope of investigation...",
      toast_investigation_saved: "Investigation saved successfully!",
      toast_investigation_deleted: "Investigation deleted.",
      toast_indicator_added: "Indicator added to case.",
      toast_finding_added: "Evidence added to case.",
      toast_report_copied: "Report copied to clipboard!",
      toast_intelx_scan_done: "IntelX search completed: {count} results found.",
      confidence_confirmed: "Confirmed",
      confidence_probable: "Probable",
      confidence_uncertain: "Uncertain"
    }
  };

  // --- Listeners for reactive updates ---
  const listeners = new Set();

  let currentLang = 'fr';
  try {
    const saved = localStorage.getItem('aaa_lang');
    if (saved === 'en' || saved === 'fr') {
      currentLang = saved;
    }
  } catch (e) {
    currentLang = 'fr';
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (lang !== 'fr' && lang !== 'en') return;
    if (currentLang === lang) return;
    currentLang = lang;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('aaa_lang', lang); } catch (e) { /* ignore */ }
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
    }

    // Notify all registered listeners
    listeners.forEach(fn => {
      try { fn(currentLang); } catch (err) { console.error('i18n listener error:', err); }
    });
  }

  function onLanguageChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function t(key, params = {}) {
    const langDict = STRINGS[currentLang] || STRINGS.fr;
    let str = langDict[key] || (STRINGS.fr && STRINGS.fr[key]) || key;
    if (typeof str === 'string' && params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return str;
  }

  function getCategoryTitle(cat) {
    if (!cat) return '';
    if (currentLang === 'en') return cat.title_en || cat.title;
    return cat.title_fr || cat.title;
  }

  function getGroupName(group) {
    if (!group) return '';
    if (typeof group === 'string') return group;
    if (currentLang === 'en') return group.name_en || group.name;
    return group.name_fr || group.name;
  }

  function getToolDescription(tool) {
    if (!tool) return '';
    if (currentLang === 'en') return tool.description_en || tool.description || '';
    return tool.description_fr || tool.description || '';
  }

  function getDomainTitle(domain) {
    if (!domain) return '';
    if (currentLang === 'en') return domain.title_en || domain.title;
    return domain.title_fr || domain.title;
  }

  function getAccessInfo(statusKey) {
    const status = ACCESS_STATUSES[statusKey] || ACCESS_STATUSES.to_verify;
    const localized = status[currentLang] || status.fr;
    return {
      key: status.key,
      label: localized.label,
      shortLabel: localized.shortLabel,
      badge: localized.badge,
      desc: localized.desc,
      pillClass: status.pillClass,
      dotColor: status.dotColor
    };
  }

  return {
    getLang,
    setLang,
    onLanguageChange,
    t,
    getCategoryTitle,
    getGroupName,
    getToolDescription,
    getDomainTitle,
    getAccessInfo,
    DOMAINS,
    ACCESS_STATUSES,
    STRINGS
  };
});
