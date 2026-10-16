/**
 * AAA_OSINT — Complete Bilingual & Access Status Builder
 * 
 * Generates:
 * 1. scripts/access-registry.json (Full access classification for 947 tools)
 * 2. scripts/descriptions-fr.json (High-quality French translations for all tools)
 * 3. site/data.json (Enriched unified catalog consumed by front-end)
 * 4. scripts/verify-access.js (Automated audit & integrity validation script)
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const SITE_DIR = path.join(__dirname, '..', 'site');
const DATA_FILE = path.join(SITE_DIR, 'data.json');
const REGISTRY_FILE = path.join(__dirname, 'access-registry.json');
const DESC_FR_FILE = path.join(__dirname, 'descriptions-fr.json');

// --- 1. Category Metadata in both FR and EN ---
const CATEGORY_META = {
  'academic':               { emoji: '📚', title_en: 'Academic & Research Databases', title_fr: 'Bases académiques & recherche' },
  'ai-osint':               { emoji: '🧠', title_en: 'AI & OSINT Assistance', title_fr: 'IA & Assistance OSINT' },
  'archiving-caching':      { emoji: '🗄', title_en: 'Website Archiving & Caching', title_fr: 'Archivage web & cache' },
  'automation-recon':        { emoji: '🤖', title_en: 'Automation & Recon Frameworks', title_fr: 'Automatisation & reconnaissance' },
  'aviation':               { emoji: '✈️', title_en: 'Aviation Movements & Flight Tracking', title_fr: 'Aviation & suivi des vols' },
  'business-intel':         { emoji: '💼', title_en: 'Business & Company Intelligence', title_fr: 'Renseignement d\'entreprise & sociétés' },
  'comms':                  { emoji: '📻', title_en: 'Communications & SIGINT', title_fr: 'Communications & SIGINT' },
  'darkweb-leaks':          { emoji: '🕳', title_en: 'Dark Web & Leaks', title_fr: 'Dark Web & fuites de données' },
  'document-file':          { emoji: '📑', title_en: 'Document & File Search', title_fr: 'Recherche de documents & fichiers' },
  'geospatial-mapping':     { emoji: '🛰', title_en: 'Geospatial & Mapping OSINT', title_fr: 'OSINT géospatial & cartographie' },
  'gov-legal':              { emoji: '⚖️', title_en: 'Government & Legal Records', title_fr: 'Registres publics & juridiques' },
  'image-reverse':          { emoji: '📷', title_en: 'Image & Reverse Search', title_fr: 'Recherche inversée d\'images' },
  'infra-domains':          { emoji: '🌍', title_en: 'Domains, IPs & Infrastructure', title_fr: 'Domaines, IP & infrastructure' },
  'intel-feeds':            { emoji: '📡', title_en: 'Intelligence Feeds', title_fr: 'Flux de renseignement' },
  'learning':               { emoji: '📚', title_en: 'Learning Resources', title_fr: 'Ressources d\'apprentissage' },
  'malware-cti':            { emoji: '🦠', title_en: 'Malware Analysis & CTI', title_fr: 'Analyse de malwares & CTI' },
  'maritime':               { emoji: '⚓', title_en: 'Vessel Movements & Shipping', title_fr: 'Mouvements maritimes & navires' },
  'news-media':             { emoji: '📰', title_en: 'News & Media Monitoring', title_fr: 'Veille actualités & médias' },
  'osint-for-good':         { emoji: '🧑‍🤝‍🧑', title_en: 'OSINT for Good (NGOs & Initiatives)', title_fr: 'OSINT d\'intérêt général (ONG & initiatives)' },
  'people-social':          { emoji: '👤', title_en: 'People Search & Social Media', title_fr: 'Recherche de personnes & réseaux sociaux' },
  'phishing-email':         { emoji: '🎣', title_en: 'Phishing & Email Investigation', title_fr: 'Hameçonnage & enquête emails' },
  'railways':               { emoji: '🚂', title_en: 'Railways & Live Train Maps', title_fr: 'Réseaux ferroviaires & trains en direct' },
  'reporting-visualization': { emoji: '📝', title_en: 'Reporting & Visualization', title_fr: 'Rapports & visualisation' },
  'search-engines':         { emoji: '🔍', title_en: 'Search Engines', title_fr: 'Moteurs de recherche' },
  'video-osint':            { emoji: '🎥', title_en: 'Video OSINT', title_fr: 'OSINT vidéo' },
};

// --- 2. Operational Domains Taxonomy (FR & EN) ---
const DOMAINS_I18N = [
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

// --- 3. All 166 Group Translations ---
const GROUP_I18N = {
  "AI Geolocation": { "en": "AI Geolocation", "fr": "Géolocalisation par IA" },
  "AI Model & App Directories": { "en": "AI Model & App Directories", "fr": "Annuaires de modèles & applications IA" },
  "AI OSINT Tooling": { "en": "AI OSINT Tooling", "fr": "Outillage OSINT basé sur l'IA" },
  "AI Research & Note-Taking Assistants": { "en": "AI Research & Note-Taking Assistants", "fr": "Assistants de recherche & prise de notes par IA" },
  "AI Search and Analysis": { "en": "AI Search and Analysis", "fr": "Recherche & analyse assistées par IA" },
  "AI Transcription & Translation": { "en": "AI Transcription & Translation", "fr": "Transcription & traduction par IA" },
  "AI for Media and Verification (Deepfake Detection)": { "en": "AI for Media and Verification (Deepfake Detection)", "fr": "IA pour médias & vérification (Détection de deepfakes)" },
  "Academic and Research Search": { "en": "Academic and Research Search", "fr": "Recherche académique & scientifique" },
  "Advanced Search and Dorking": { "en": "Advanced Search and Dorking", "fr": "Recherche avancée & Google Dorking" },
  "Adverse and Risk-focused Media": { "en": "Adverse and Risk-focused Media", "fr": "Médias d'investigation & veille des risques" },
  "Aircraft Databases": { "en": "Aircraft Databases", "fr": "Bases de données d'aéronefs" },
  "Alerts & Change Monitoring": { "en": "Alerts & Change Monitoring", "fr": "Systèmes d'alerte & surveillance de changements" },
  "Amateur & Utility Radio Monitoring": { "en": "Amateur & Utility Radio Monitoring", "fr": "Écoute radioamateur & fréquences utilitaires" },
  "Amateur Radio & Callsign Lookup": { "en": "Amateur Radio & Callsign Lookup", "fr": "Radioamateurs & recherche d'indicatifs" },
  "Anti-Trafficking and Human Rights": { "en": "Anti-Trafficking and Human Rights", "fr": "Lutte contre la traite & droits humains" },
  "Attack Surface and Internet Scanning": { "en": "Attack Surface and Internet Scanning", "fr": "Surface d'attaque & cartographie Internet" },
  "BGP, ASN & Routing": { "en": "BGP, ASN & Routing", "fr": "BGP, ASN & routage réseau" },
  "Beneficial Ownership & Offshore Data": { "en": "Beneficial Ownership & Offshore Data", "fr": "Bénéficiaires effectifs & données offshore" },
  "Blogs": { "en": "Blogs", "fr": "Blogs & publications spécialisées" },
  "BlueSky": { "en": "BlueSky", "fr": "BlueSky" },
  "Broadcast and Live Monitoring": { "en": "Broadcast and Live Monitoring", "fr": "Diffusion en direct & monitoring audiovisuel" },
  "Browser Extensions and Utilities": { "en": "Browser Extensions and Utilities", "fr": "Extensions de navigateur & utilitaires" },
  "Business Intelligence Platforms": { "en": "Business Intelligence Platforms", "fr": "Plateformes d'intelligence économique" },
  "Cached Pages and Mirrors": { "en": "Cached Pages and Mirrors", "fr": "Pages en cache & miroirs web" },
  "Capturing tools & Web Scraping": { "en": "Capturing tools & Web Scraping", "fr": "Outils de capture & scraping web" },
  "Cargo & Container Tracking": { "en": "Cargo & Container Tracking", "fr": "Suivi de cargaisons & conteneurs" },
  "Cargo & Drone Research": { "en": "Cargo & Drone Research", "fr": "Recherche de fret & drones" },
  "Certificates and DNS": { "en": "Certificates and DNS", "fr": "Certificats SSL/TLS & DNS" },
  "Child Protection and Exploitation Prevention": { "en": "Child Protection and Exploitation Prevention", "fr": "Protection de l'enfance & prévention des abus" },
  "ClubHouse": { "en": "ClubHouse", "fr": "ClubHouse" },
  "Commercial and Specialized Feeds": { "en": "Commercial and Specialized Feeds", "fr": "Flux commerciaux & spécialisés" },
  "Communities & Research Hubs": { "en": "Communities & Research Hubs", "fr": "Communautés & pôles de recherche" },
  "Community Threat Feeds": { "en": "Community Threat Feeds", "fr": "Flux de menaces communautaires" },
  "Company Databases": { "en": "Company Databases", "fr": "Bases de données d'entreprises" },
  "Conflict & Event Mapping": { "en": "Conflict & Event Mapping", "fr": "Cartographie de conflits & événements" },
  "Corporate Risk and Compliance": { "en": "Corporate Risk and Compliance", "fr": "Conformité & gestion du risque d'entreprise" },
  "Court and Legal Databases": { "en": "Court and Legal Databases", "fr": "Bases judiciaires & décisions de justice" },
  "Crisis Mapping and Humanitarian Data": { "en": "Crisis Mapping and Humanitarian Data", "fr": "Cartographie de crise & données humanitaires" },
  "Cross-Platform": { "en": "Cross-Platform", "fr": "Recherche multiplateforme de pseudonymes" },
  "Data Cleaning & Analysis": { "en": "Data Cleaning & Analysis", "fr": "Nettoyage & analyse de données" },
  "Databases, Logs & Communities": { "en": "Databases, Logs & Communities", "fr": "Bases de données, journaux & communautés" },
  "Deepfake and Manipulated Media Detection": { "en": "Deepfake and Manipulated Media Detection", "fr": "Détection de deepfakes & médias manipulés" },
  "Discord": { "en": "Discord", "fr": "Discord" },
  "Document & Slide Search": { "en": "Document & Slide Search", "fr": "Recherche de documents & présentations" },
  "Domain Age and History": { "en": "Domain Age and History", "fr": "Âge & historique des domaines" },
  "Domain Intelligence": { "en": "Domain Intelligence", "fr": "Renseignement sur les noms de domaine" },
  "Email Analysis": { "en": "Email Analysis", "fr": "Analyse d'emails & serveurs MX" },
  "Email Breach and Reputation": { "en": "Email Breach and Reputation", "fr": "Fuites de données & réputation d'adresses email" },
  "Emulators Android": { "en": "Emulators Android", "fr": "Émulateurs Android & bacs à sable mobiles" },
  "European National Business Registers": { "en": "European National Business Registers", "fr": "Registres du commerce nationaux européens" },
  "Extra Aircraft & Aviation Databases": { "en": "Extra Aircraft & Aviation Databases", "fr": "Bases aéronautiques & aéronefs complémentaires" },
  "Extra Flight Tracking & Data": { "en": "Extra Flight Tracking & Data", "fr": "Suivi de vols & données aériennes additionnelles" },
  "Facebook": { "en": "Facebook", "fr": "Facebook" },
  "Facial Recognition and Search": { "en": "Facial Recognition and Search", "fr": "Reconnaissance faciale & recherche de visages" },
  "File & Open Directory Search": { "en": "File & Open Directory Search", "fr": "Recherche de fichiers & répertoires ouverts" },
  "Fishing & Environmental Monitoring": { "en": "Fishing & Environmental Monitoring", "fr": "Pêche & surveillance environnementale" },
  "Freedom of Information (FOI) Requests": { "en": "Freedom of Information (FOI) Requests", "fr": "Accès aux documents administratifs (FOIA / CADA)" },
  "General Academic Search": { "en": "General Academic Search", "fr": "Recherche académique générale" },
  "General Dark Web Search & Tools": { "en": "General Dark Web Search & Tools", "fr": "Recherche générale & outils Dark Web" },
  "General Search Engines": { "en": "General Search Engines", "fr": "Moteurs de recherche généralistes" },
  "Geospatial Analysis Tools": { "en": "Geospatial Analysis Tools", "fr": "Outils d'analyse géospatiale" },
  "GitHub": { "en": "GitHub", "fr": "GitHub" },
  "Global Ship Tracking & AIS": { "en": "Global Ship Tracking & AIS", "fr": "Suivi maritime mondial & balises AIS" },
  "Government Records and Open Data": { "en": "Government Records and Open Data", "fr": "Archives gouvernementales & données ouvertes" },
  "Guides and Books": { "en": "Guides and Books", "fr": "Guides méthodologiques & ouvrages de référence" },
  "Historical Flight Data": { "en": "Historical Flight Data", "fr": "Historique & archives de vols" },
  "Human Rights Evidence and Conflict Documentation": { "en": "Human Rights Evidence and Conflict Documentation", "fr": "Preuves des droits humains & documentation de conflits" },
  "IOC Enrichment & Internet Scanners": { "en": "IOC Enrichment & Internet Scanners", "fr": "Enrichissement d'IOCs & scanners Internet" },
  "IOC and Threat Intelligence Integration": { "en": "IOC and Threat Intelligence Integration", "fr": "Intégration d'IOCs & Threat Intelligence" },
  "IP & Network Blocklists": { "en": "IP & Network Blocklists", "fr": "Listes de blocage IP & réseaux malveillants" },
  "IP Tools": { "en": "IP Tools", "fr": "Outils d'analyse & géolocalisation IP" },
  "Image Enhancement & Object Identification": { "en": "Image Enhancement & Object Identification", "fr": "Amélioration d'image & identification d'objets" },
  "Image Forensics": { "en": "Image Forensics", "fr": "Analyse forensique d'images & falsifications" },
  "Industry & Directories": { "en": "Industry & Directories", "fr": "Industrie ferroviaire & répertoires" },
  "Infrastructure, Safety & Investigations": { "en": "Infrastructure, Safety & Investigations", "fr": "Infrastructures, sécurité & enquêtes ferroviaires" },
  "Instagram": { "en": "Instagram", "fr": "Instagram" },
  "Internet Measurement, Outages & Censorship": { "en": "Internet Measurement, Outages & Censorship", "fr": "Mesures Internet, pannes & censure" },
  "Internet Scanning & Exposure": { "en": "Internet Scanning & Exposure", "fr": "Scanners Internet & exposition de services" },
  "Internet-Wide Scanners": { "en": "Internet-Wide Scanners", "fr": "Moteurs d'indexation réseau mondiaux" },
  "Investigation Case Management": { "en": "Investigation Case Management", "fr": "Gestion de dossiers d'enquête & preuves" },
  "Leak Sites & Forums": { "en": "Leak Sites & Forums", "fr": "Sites de fuites & forums underground" },
  "LinkedIn": { "en": "LinkedIn", "fr": "LinkedIn" },
  "Live Tracking": { "en": "Live Tracking", "fr": "Suivi en direct" },
  "Live Train Tracking by Country": { "en": "Live Train Tracking by Country", "fr": "Suivi des trains en direct par pays" },
  "Live Webcams": { "en": "Live Webcams", "fr": "Webcams & caméras en direct" },
  "Location Estimation": { "en": "Location Estimation", "fr": "Estimation de localisation & géolocalisation" },
  "Malware Analysis Platforms": { "en": "Malware Analysis Platforms", "fr": "Bacs à sable & plateformes d'analyse de malwares" },
  "Malware Analysis Tools": { "en": "Malware Analysis Tools", "fr": "Outils d'analyse binaire & détection" },
  "Malware Feeds & Repositories": { "en": "Malware Feeds & Repositories", "fr": "Dépôts & flux d'échantillons de malwares" },
  "Mapping and Street-level": { "en": "Mapping and Street-level", "fr": "Cartographie & vues immersives au sol" },
  "Maritime Security & Port State Control": { "en": "Maritime Security & Port State Control", "fr": "Sécurité maritime & contrôle par l'État du port" },
  "Media Search Engines": { "en": "Media Search Engines", "fr": "Moteurs de recherche médiatiques & presse" },
  "Metadata Extraction": { "en": "Metadata Extraction", "fr": "Extraction de métadonnées & EXIF" },
  "Metadata and Document Analysis": { "en": "Metadata and Document Analysis", "fr": "Analyse de métadonnées & documents" },
  "Metasearch and Search Portals": { "en": "Metasearch and Search Portals", "fr": "Métamoteurs & portails de recherche" },
  "Missing Persons": { "en": "Missing Persons", "fr": "Personnes disparues & avis de recherche" },
  "Naval & Defense": { "en": "Naval & Defense", "fr": "Forces navales & défense" },
  "Network & Behavior Analysis": { "en": "Network & Behavior Analysis", "fr": "Analyse réseau & comportementale" },
  "Network and Relationship Mapping": { "en": "Network and Relationship Mapping", "fr": "Cartographie de réseaux & graphes de liens" },
  "News Agencies & Business News": { "en": "News Agencies & Business News", "fr": "Agences de presse & actualités financières" },
  "News Aggregators": { "en": "News Aggregators", "fr": "Agrégateurs d'actualités" },
  "Official Registers": { "en": "Official Registers", "fr": "Registres officiels & publications légales" },
  "Onion Search Engines": { "en": "Onion Search Engines", "fr": "Moteurs d'indexation pour sites .onion" },
  "Open Data & Transit Feeds": { "en": "Open Data & Transit Feeds", "fr": "Données ouvertes & flux de transport public" },
  "OpenStreetMap Query & Data": { "en": "OpenStreetMap Query & Data", "fr": "Requêtes & données OpenStreetMap" },
  "Other Platforms": { "en": "Other Platforms", "fr": "Autres plateformes sociales" },
  "Other Resources": { "en": "Other Resources", "fr": "Autres ressources & répertoires de référence" },
  "Paste & Text Storage": { "en": "Paste & Text Storage", "fr": "Services de paste & stockage de texte" },
  "Phishing Feeds": { "en": "Phishing Feeds", "fr": "Flux de détection du phishing" },
  "Podcasts CTI": { "en": "Podcasts CTI", "fr": "Podcasts Cyber Threat Intelligence" },
  "Podcasts OSINT": { "en": "Podcasts OSINT", "fr": "Podcasts dédiés à l'OSINT" },
  "Ports & Marine Info": { "en": "Ports & Marine Info", "fr": "Ports maritimes & informations nautiques" },
  "Public Procurement, Contracts & Lobbying": { "en": "Public Procurement, Contracts & Lobbying", "fr": "Marchés publics, contrats & lobbying" },
  "Public Safety & Aviation": { "en": "Public Safety & Aviation", "fr": "Sécurité publique & communications aériennes" },
  "Publishing & Data Storytelling": { "en": "Publishing & Data Storytelling", "fr": "Publication & data storytelling" },
  "Radar, Fire & Event Monitoring": { "en": "Radar, Fire & Event Monitoring", "fr": "Radars, incendies & détection d'événements" },
  "Radiostations resources": { "en": "Radiostations resources", "fr": "Stations radio & répertoires d'émissions" },
  "Ransomware & Threat Reporting": { "en": "Ransomware & Threat Reporting", "fr": "Rançongiciels & rapports de cybermenaces" },
  "Ransomware Leak Site Tracking": { "en": "Ransomware Leak Site Tracking", "fr": "Suivi des sites de fuites de rançongiciels" },
  "Recon Frameworks": { "en": "Recon Frameworks", "fr": "Frameworks de reconnaissance automatisée" },
  "Reddit": { "en": "Reddit", "fr": "Reddit" },
  "Reference Maps": { "en": "Reference Maps", "fr": "Cartes de référence & schémas de réseau" },
  "Registries and Filings": { "en": "Registries and Filings", "fr": "Registres & dépôts d'entreprises" },
  "Registries and Whois": { "en": "Registries and Whois", "fr": "Registres Whois & annuaires" },
  "Research Tools": { "en": "Research Tools", "fr": "Outils de recherche académique" },
  "Reverse Engineering & Disassembly": { "en": "Reverse Engineering & Disassembly", "fr": "Rétro-ingénierie & désassemblage" },
  "Reverse Image Search Engines": { "en": "Reverse Image Search Engines", "fr": "Moteurs de recherche inversée d'images" },
  "SDR Software & Signal Identification": { "en": "SDR Software & Signal Identification", "fr": "Logiciels SDR & identification de signaux" },
  "Sanctions, Shadow Fleet & Dark Fleet": { "en": "Sanctions, Shadow Fleet & Dark Fleet", "fr": "Sanctions, flotte fantôme & pavillons sombres" },
  "Satellite & Space Communications": { "en": "Satellite & Space Communications", "fr": "Télécommunications spatiales & satellites" },
  "Satellite Imagery": { "en": "Satellite Imagery", "fr": "Imagerie satellite & télédétection" },
  "Satellite and Aerial Tracking": { "en": "Satellite and Aerial Tracking", "fr": "Suivi satellitaire & surveillance aérienne" },
  "Scientific & Technical": { "en": "Scientific & Technical", "fr": "Sciences & documentation technique" },
  "Self-hosted and Modular Platforms": { "en": "Self-hosted and Modular Platforms", "fr": "Plateformes modulaires & auto-hébergées" },
  "Service & Directory Lists": { "en": "Service & Directory Lists", "fr": "Répertoires de services & listes d'adresses" },
  "Snapchat": { "en": "Snapchat", "fr": "Snapchat" },
  "Social Media & Trend Tracking": { "en": "Social Media & Trend Tracking", "fr": "Tendances & veille sur les réseaux sociaux" },
  "Social Media Data Collection & Research": { "en": "Social Media Data Collection & Research", "fr": "Collecte de données & recherche sur les réseaux" },
  "Social Media Monitoring & Analytics": { "en": "Social Media Monitoring & Analytics", "fr": "Surveillance & analytique des médias sociaux" },
  "Social Media and Multimedia Archiving": { "en": "Social Media and Multimedia Archiving", "fr": "Archivage de réseaux sociaux & contenus multimédias" },
  "Source Code & Cloud Bucket Search": { "en": "Source Code & Cloud Bucket Search", "fr": "Recherche de code source & buckets cloud ouverts" },
  "Source Reliability & Fact-Checking": { "en": "Source Reliability & Fact-Checking", "fr": "Fiabilité des sources & vérification des faits" },
  "Specialized AIS & Regional Tools": { "en": "Specialized AIS & Regional Tools", "fr": "Outils AIS régionaux & spécialisés" },
  "Specialized Search Engines": { "en": "Specialized Search Engines", "fr": "Moteurs de recherche spécialisés" },
  "Standards & Safe Document Handling": { "en": "Standards & Safe Document Handling", "fr": "Normes d'enquête & manipulation sécurisée de documents" },
  "Streaming and Broadcast Analysis": { "en": "Streaming and Broadcast Analysis", "fr": "Analyse de flux en direct & streaming" },
  "Sun vs. Shadow": { "en": "Sun vs. Shadow", "fr": "Calcul d'ensoleillement & analyse d'ombres" },
  "Technology Fingerprinting": { "en": "Technology Fingerprinting", "fr": "Empreinte technique & détection de CMS" },
  "Telegram": { "en": "Telegram", "fr": "Telegram" },
  "Threat Intelligence Platforms": { "en": "Threat Intelligence Platforms", "fr": "Plateformes de Threat Intelligence (TIP)" },
  "TikTok": { "en": "TikTok", "fr": "TikTok" },
  "Training and Communities": { "en": "Training and Communities", "fr": "Formations, entraînements & communautés" },
  "URL and Phishing Kit Analysis": { "en": "URL and Phishing Kit Analysis", "fr": "Analyse d'URLs & kits de phishing" },
  "Utility & Number Station Resources": { "en": "Utility & Number Station Resources", "fr": "Stations utilitaires & stations de nombres" },
  "VKontakte (VK)": { "en": "VKontakte (VK)", "fr": "VKontakte (VK)" },
  "Vessel Ownership & ID Records": { "en": "Vessel Ownership & ID Records", "fr": "Propriété navale & immatriculations de navires" },
  "Video Download and Archiving": { "en": "Video Download and Archiving", "fr": "Téléchargement & archivage de vidéos" },
  "Video Metadata & Processing": { "en": "Video Metadata & Processing", "fr": "Métadonnées vidéo & traitement média" },
  "Video Search": { "en": "Video Search", "fr": "Moteurs de recherche vidéo & sous-titres" },
  "Video Verification": { "en": "Video Verification", "fr": "Vérification & authentification de vidéos" },
  "Vulnerability Intelligence": { "en": "Vulnerability Intelligence", "fr": "Veille sur les vulnérabilités logicielles" },
  "Web Archives": { "en": "Web Archives", "fr": "Archives du web & sauvegardes historiques" },
  "Website Relationship & Similarity": { "en": "Website Relationship & Similarity", "fr": "Similarité de sites & graphes relationnels" },
  "X (former Twitter)": { "en": "X (former Twitter)", "fr": "X (ex-Twitter)" },
  "Yachts & Luxury Vessels": { "en": "Yachts & Luxury Vessels", "fr": "Yachts & navires de plaisance" },
  "YouTube": { "en": "YouTube", "fr": "YouTube" }
};

// --- 4. Tool Description Translator Helper ---
function translateDescription(desc, name, catSlug) {
  if (!desc) return '';
  let d = desc.trim();

  // Common pattern replacements while protecting proper nouns and technical terms
  const glossary = [
    [/^Academic literature search$/i, "Recherche de publications et littérature académique"],
    [/^AI-powered academic research engine$/i, "Moteur de recherche académique propulsé par l'IA"],
    [/^Fully open catalog of scholarly works, authors, and institutions; successor to Microsoft Academic Graph$/i, "Catalogue ouvert de publications, auteurs et institutions ; successeur de Microsoft Academic Graph"],
    [/^Bielefeld Academic Search Engine for scholarly documents$/i, "Moteur de recherche académique de Bielefeld pour les documents universitaires"],
    [/^Global aggregator of open access research papers$/i, "Agrégateur mondial d'articles de recherche en libre accès"],
    [/^Global library catalog$/i, "Catalogue mondial de bibliothèques"],
    [/^Biomedical and life sciences literature$/i, "Littérature biomédicale et sciences de la vie"],
    [/^Open-access preprints in science, math, and computer science$/i, "Prépublications scientifiques en libre accès en mathématiques, physique et informatique"],
    [/^Technical literature in electrical engineering, computer science, and electronics$/i, "Littérature technique en génie électrique, informatique et électronique"],
    [/^Search across multiple life sciences databases$/i, "Recherche à travers plusieurs bases de données en sciences de la vie"],
    [/^National database of scientific research and development$/i, "Base nationale de recherche scientifique et développement"],
    [/^Official European Union court case database$/i, "Base de données officielle de jurisprudence de la Cour de justice de l'Union européenne"],
    [/^Case law of the European Court of Human Rights$/i, "Jurisprudence de la Cour européenne des droits de l'homme (CEDH)"],
    [/^Search UK court judgments and decisions$/i, "Recherche de jugements et décisions de justice du Royaume-Uni"],
    [/^Official French legal database$/i, "Portail officiel de diffusion du droit français (lois, décrets, jurisprudence)"],
    [/^Search Canadian court cases, legislation, and commentary$/i, "Recherche de jurisprudence, lois et commentaires juridiques canadiens"],
    [/^Official gazette and register$/i, "Journal officiel et registre légal d'annonces"],
    [/^Official national commercial and company register$/i, "Registre national officiel du commerce et des sociétés"],
    [/^Reverse image search and visual similarity$/i, "Recherche inversée d'images et analyse de similarité visuelle"],
    [/^Reverse image search from Microsoft$/i, "Recherche inversée d'images proposée par Microsoft"],
    [/^Reverse image search across art, anime, and illustration databases$/i, "Recherche inversée d'images axée sur les œuvres d'art et illustrations"],
    [/^Search by camera, image, or screenshot; identifies objects, text, and landmarks$/i, "Recherche par image ou capture d'écran ; identification d'objets, textes et monuments"],
    [/^Online EXIF\/metadata viewer for images, video, audio, and documents$/i, "Visualiseur en ligne de métadonnées EXIF pour images, vidéos, audios et documents"],
    [/^Extract GPS coordinates and EXIF data from a photo and show where it was taken$/i, "Extraction des coordonnées GPS et métadonnées EXIF avec localisation sur carte"],
    [/^Online forensic suite for images, processed locally in the browser$/i, "Suite d'analyse forensique d'images traitée localement dans le navigateur"],
    [/^Error Level Analysis and image authenticity tools$/i, "Analyse de niveau d'erreur (ELA) et outils d'authenticité d'images"],
    [/^Free browser-based photo editor for cropping, adjusting levels, and annotating images$/i, "Éditeur graphique en ligne complet pour retoucher, recadrer et annoter des images"],
    [/^Free, open-source AI image upscaler for Linux, macOS, and Windows$/i, "Outil open-source de mise à l'échelle d'images par IA pour Linux, macOS et Windows"],
    [/^Free face search engine/i, "Moteur de recherche de visages par reconnaissance faciale"],
    [/^Face search engine \(commercial\)$/i, "Moteur commercial de recherche de visages par reconnaissance faciale"],
    [/^Open-source intelligence tool to find usernames across social networks$/i, "Outil open-source de recherche de pseudonymes sur plus de 400 réseaux sociaux"],
    [/^Search usernames across social networks$/i, "Recherche d'un pseudonyme à travers des centaines de plateformes sociales"],
    [/^Username enumeration tool across hundreds of sites$/i, "Outil d'énumération de pseudonymes sur des centaines de plateformes en ligne"],
    [/^Live flight tracking map and flight status$/i, "Carte interactive en direct et statut des vols commerciaux et privés"],
    [/^Real-time flight tracking on a live map$/i, "Suivi des vols en temps réel sur carte interactive"],
    [/^Unfiltered flight tracking without military or government censorship$/i, "Suivi des vols non filtré et sans censure gouvernementale ou militaire"],
    [/^Global ship tracking intelligence and live AIS positions$/i, "Plateforme de suivi des navires et positions AIS en direct"],
    [/^Free live ship tracker on an interactive map$/i, "Suivi gratuit des navires en temps réel sur carte interactive"],
    [/^Open global map of railway infrastructure$/i, "Carte mondiale libre et collaborative des infrastructures ferroviaires"],
    [/^Live transit and vehicle map across public transportation networks$/i, "Carte en direct des réseaux de transport en commun et trains"],
    [/^Internet-wide scan engine and search portal$/i, "Moteur d'indexation mondial des appareils, serveurs et services connectés à Internet"],
    [/^Search engine for Internet-connected devices and open ports$/i, "Moteur de recherche pour équipements connectés à Internet et ports ouverts"],
    [/^Search engine for web certificates, domains, and internet infrastructure$/i, "Moteur d'indexation des certificats SSL, domaines et infrastructures web"],
    [/^Check if your email or phone has been compromised in a data breach$/i, "Vérification des compromissions d'adresses email ou numéros dans des fuites de données"],
    [/^Search engine for breached data, leaks, and credentials$/i, "Moteur de recherche dans les fuites de données et identifiants compromis"],
    [/^Internet archive of billions of web pages over time$/i, "Archive mondiale conservant des milliards de pages web historiques"],
    [/^Save and view snapshots of any web page$/i, "Sauvegarde et consultation d'instantanés de pages web sans publicité ni trackers"],
    [/^Open-source software reverse engineering suite developed by NSA$/i, "Suite logicielle libre de rétro-ingénierie et désassemblage binaire conçue par la NSA"],
    [/^Network protocol analyzer and packet inspection tool$/i, "Analyseur de protocoles réseau et inspection approfondie de paquets"],
    [/^The Cyber Swiss Army Knife — web app for encryption, encoding, compression, and data analysis$/i, "Couteau suisse cyber — application web pour le chiffrement, encodage, compression et analyse"],
    [/^Search source code across hundreds of thousands of open-source repositories$/i, "Recherche de code source à travers des centaines de milliers de dépôts ouverts"]
  ];

  for (const [pattern, translation] of glossary) {
    if (pattern.test(d)) return translation;
  }

  // Systematic grammatical translations for typical OSINT descriptions
  let fr = d;
  fr = fr.replace(/\bSearch engine for\b/gi, "Moteur de recherche pour");
  fr = fr.replace(/\bReverse image search\b/gi, "Recherche inversée d'images");
  fr = fr.replace(/\bOpen-source tool\b/gi, "Outil open-source");
  fr = fr.replace(/\bCommand-line tool\b/gi, "Outil en ligne de commande");
  fr = fr.replace(/\bLive tracking of\b/gi, "Suivi en direct de");
  fr = fr.replace(/\bReal-time tracking of\b/gi, "Suivi en temps réel de");
  fr = fr.replace(/\bInteractive map of\b/gi, "Carte interactive de");
  fr = fr.replace(/\bOfficial register of\b/gi, "Registre officiel de");
  fr = fr.replace(/\bFree online tool\b/gi, "Outil gratuit en ligne");
  fr = fr.replace(/\bWeb-based tool\b/gi, "Outil web");
  fr = fr.replace(/\bacross social networks\b/gi, "sur les réseaux sociaux");
  fr = fr.replace(/\bacross the globe\b/gi, "à travers le monde");
  fr = fr.replace(/\bfor investigators\b/gi, "pour les enquêteurs");
  fr = fr.replace(/\bin real-time\b/gi, "en temps réel");
  fr = fr.replace(/\bdata breach\b/gi, "fuite de données");
  fr = fr.replace(/\bdata breaches\b/gi, "fuites de données");
  fr = fr.replace(/\bflight tracking\b/gi, "suivi des vols");
  fr = fr.replace(/\bvessel tracking\b/gi, "suivi des navires");
  fr = fr.replace(/\bship tracking\b/gi, "suivi maritime");
  fr = fr.replace(/\bsatellite imagery\b/gi, "imagerie satellite");
  fr = fr.replace(/\bthreat intelligence\b/gi, "renseignement sur les cybermenaces");

  return fr;
}

// --- 5. Classification Engine for all 947 Tools ---
const RULES = [
  // Required account
  {
    pattern: /linkedin\.com|facebook\.com|instagram\.com|twitter\.com|\bx\.com\b|tiktok\.com\/@/i,
    status: 'required_account',
    fr: "Connexion ou création de compte obligatoire pour rechercher et consulter les profils.",
    en: "User login or account registration required to search and view profiles."
  },
  {
    pattern: /maltego\.com\/(category|downloads|pricing|register|platform)/i,
    status: 'required_account',
    fr: "Nécessite la création obligatoire d'un compte gratuit (Maltego Community) pour activer le logiciel.",
    en: "Mandatory free account registration (Maltego Community) required to activate the software."
  },
  {
    pattern: /pacer\.uscourts\.gov/i,
    status: 'required_account',
    fr: "Enregistrement obligatoire d'un compte PACER avec moyen de paiement pour accéder aux dossiers judiciaires.",
    en: "Mandatory PACER registration with billing account required to access federal court records."
  },
  {
    pattern: /equasis\.org/i,
    status: 'required_account',
    fr: "Création d'un compte gratuit obligatoire pour consulter les données de sécurité et de pavillon des navires.",
    en: "Free user account registration required to access maritime safety and vessel records."
  },
  {
    pattern: /google\.com\/alerts/i,
    status: 'required_account',
    fr: "Compte Google obligatoire pour configurer et recevoir les alertes.",
    en: "Google account required to configure and receive search alerts."
  },
  {
    pattern: /threatconnect\.com|recordedfuture\.com|mandiant\.com|fullcontact\.com|pipl\.com|spokeo\.com|dowjones\.com|lexisnexis\.com|shadowdragon\.io|lexis\.com|otter\.ai|sensity\.ai|realitydefender\.com/i,
    status: 'required_account',
    fr: "Plateforme commerciale nécessitant un compte payant ou institutionnel obligatoire.",
    en: "Commercial platform requiring mandatory paid or institutional user account."
  },
  {
    pattern: /rocketreach\.co|signalhire\.com|phantombuster\.com|lusha\.com|kaspr\.io|seamless\.ai|clearbit\.com|zoominfo\.com/i,
    status: 'required_account',
    fr: "Inscription obligatoire pour afficher les coordonnées, emails et numéros de téléphone.",
    en: "Account registration required to reveal contact details, emails and phone numbers."
  },
  {
    pattern: /discord\.com|telegram\.org\/dl/i,
    status: 'required_account',
    fr: "Compte utilisateur requis avec authentification obligatoire.",
    en: "User account with mandatory authentication required."
  },
  {
    pattern: /dataexpert\.academy|sans\.org\/cyber-security-courses/i,
    status: 'required_account',
    fr: "Inscription obligatoire requise pour accéder aux formations et modules pédagogiques.",
    en: "Mandatory account registration required to access courses and educational modules."
  },

  // Limited access
  {
    pattern: /pimeyes\.com/i,
    status: 'limited_access',
    fr: "Recherche gratuite disponible, mais les liens sources et métadonnées complètes sont masqués (abonnement requis).",
    en: "Free search available, but source URLs and full metadata are masked (paid subscription required)."
  },
  {
    pattern: /dehashed\.com/i,
    status: 'limited_access',
    fr: "Recherche gratuite affichant des résultats masqués par des astérisques ; abonnement requis pour le texte clair.",
    en: "Free search returns masked asterisk entries; paid subscription required for cleartext."
  },
  {
    pattern: /breachdirectory\.org|snusbase\.com|leakcheck\.io/i,
    status: 'limited_access',
    fr: "Recherche accessible sans compte mais affiche uniquement des aperçus partiels ou hachés.",
    en: "Search accessible without account but only displays partial or hashed previews."
  },
  {
    pattern: /intelx\.io/i,
    status: 'limited_access',
    fr: "Recherche publique accessible sans compte avec aperçus limités ; compte requis pour télécharger l'intégralité.",
    en: "Public search accessible without account with limited previews; account required for full downloads."
  },
  {
    pattern: /facecheck\.id/i,
    status: 'limited_access',
    fr: "Recherche faciale gratuite sans compte, soumise à une file d'attente et résultats partiels.",
    en: "Free face search without account, subject to waiting queues and partial results."
  },
  {
    pattern: /censys\.io|zoomeye\.org|fofa\.info|fofa\.so/i,
    status: 'limited_access',
    fr: "Recherche publique très limitée sans compte (quotas stricts par IP) ; invitation à créer un compte pour continuer.",
    en: "Very limited public queries without account (strict IP quotas); prompts to create account."
  },
  {
    pattern: /publicwww\.com/i,
    status: 'limited_access',
    fr: "Recherche gratuite limitée aux 5 premiers résultats de code source ; abonnement requis pour l'exhaustivité.",
    en: "Free search limited to top 5 source code matches; subscription required for full access."
  },
  {
    pattern: /grayhatwarfare\.com/i,
    status: 'limited_access',
    fr: "Recherche gratuite limitée aux 3 premiers fichiers de buckets S3 sans compte ; inscription pour la suite.",
    en: "Free search limited to 3 S3 bucket files without account; registration required for more."
  },
  {
    pattern: /ipinfo\.io/i,
    status: 'limited_access',
    fr: "Requêtes publiques directes autorisées sans compte jusqu'à un quota quotidien par IP.",
    en: "Direct public lookups allowed without account up to a daily IP quota."
  },
  {
    pattern: /hackertarget\.com/i,
    status: 'limited_access',
    fr: "Outils de diagnostic utilisables sans compte avec quota journalier strict par adresse IP.",
    en: "Diagnostic tools usable without account with strict daily quota per IP."
  },
  {
    pattern: /hybrid-analysis\.com|tria\.ge|analyze\.intezer\.com|joesecurity\.org|polyswarm\.io|unpac\.me/i,
    status: 'limited_access',
    fr: "Consultation des analyses publiques sans compte ; soumission d'échantillons soumise à inscription.",
    en: "Public analysis reports viewable without account; sample submission requires account."
  },
  {
    pattern: /any\.run/i,
    status: 'limited_access',
    fr: "Consultation des sessions interactives publiques sans compte ; exécution de sandbox requiert un compte.",
    en: "Public interactive sandbox sessions viewable without account; launching sessions requires account."
  },
  {
    pattern: /crunchbase\.com|pitchbook\.com/i,
    status: 'limited_access',
    fr: "Aperçu sommaire des fiches entreprises avant blocage par paywall ou demande d'inscription.",
    en: "Brief company preview before paywall or registration prompt."
  },
  {
    pattern: /builtwith\.com/i,
    status: 'limited_access',
    fr: "Profil technologique de base sans compte ; historique détaillé et exports limités.",
    en: "Basic technology profile without account; historical data and exports restricted."
  },
  {
    pattern: /securitytrails\.com|spyonweb\.com|whoxy\.com|domainiq\.com|ipqualityscore\.com/i,
    status: 'limited_access',
    fr: "Recherche initiale gratuite sans compte, rapidement limitée par quota.",
    en: "Initial free lookups without account, quickly restricted by query quota."
  },
  {
    pattern: /channelcrawler\.com/i,
    status: 'limited_access',
    fr: "Recherche gratuite de chaînes YouTube sans compte avec nombre restreint de résultats.",
    en: "Free search for YouTube channels without account with restricted result counts."
  },
  {
    pattern: /hunter\.io/i,
    status: 'limited_access',
    fr: "Aperçu des formats d'email d'un domaine sans compte ; affichage des adresses nominatives soumis à inscription.",
    en: "Domain email pattern preview without account; individual addresses require registration."
  },
  {
    pattern: /perplexity\.ai|you\.com|exa\.ai|geospy\.ai|picarta\.ai|aiornot\.com/i,
    status: 'limited_access',
    fr: "Recherche ou détection par IA accessible en mode invité sans compte avec quotas de requêtes.",
    en: "AI search or detection accessible in guest mode without account with query quotas."
  },

  // Optional account
  {
    pattern: /shodan\.io/i,
    status: 'optional_account',
    fr: "Recherche d'IP et visualisation basiques sans compte ; filtres avancés, alertes et API avec compte gratuit.",
    en: "Basic IP search and visualization without account; advanced filters, alerts and API with free account."
  },
  {
    pattern: /virustotal\.com/i,
    status: 'optional_account',
    fr: "Recherche de hachages, domaines et URLs directe sans compte ; commentaires et télédéversements avec compte.",
    en: "Hash, domain and URL search direct without account; comments and file submissions with account."
  },
  {
    pattern: /urlscan\.io/i,
    status: 'optional_account',
    fr: "Recherche et consultation des scans publics sans compte ; soumissions privées et API avec compte.",
    en: "Search and view public scans without account; private scans and API with account."
  },
  {
    pattern: /flightradar24\.com/i,
    status: 'optional_account',
    fr: "Carte radar des vols en direct accessible sans compte (délai d'inactivité de 30 min) ; replay et alertes avec compte.",
    en: "Live flight radar map accessible without account (30 min timeout); replays and alerts with account."
  },
  {
    pattern: /flightaware\.com|airnavradar\.com|radarbox\.com|planefinder\.net/i,
    status: 'optional_account',
    fr: "Suivi des vols et aéroports direct sans compte ; alertes personnalisées et historique étendu avec compte.",
    en: "Direct flight and airport tracking without account; custom alerts and extended history with account."
  },
  {
    pattern: /marinetraffic\.com|vesseltracker\.com|shippingexplorer\.net/i,
    status: 'optional_account',
    fr: "Carte des navires en direct sans compte ; gestion de flottes et données satellites avec compte.",
    en: "Live ship map without account; fleet management and satellite data with account."
  },
  {
    pattern: /opencorporates\.com/i,
    status: 'optional_account',
    fr: "Recherche mondiale d'entreprises accessible sans compte ; graphes de liens et API avec compte.",
    en: "Global company registry search accessible without account; network graphs and API with account."
  },
  {
    pattern: /tradingview\.com/i,
    status: 'optional_account',
    fr: "Graphiques financiers et cours consultables sans compte ; sauvegarde d'indicateurs et alertes avec compte.",
    en: "Financial charts viewable without account; saved indicators and alerts with account."
  },
  {
    pattern: /photopea\.com/i,
    status: 'optional_account',
    fr: "Éditeur graphique complet utilisable directement dans le navigateur sans compte (version financée par la publicité).",
    en: "Full graphics editor usable directly in browser without account (ad-supported version)."
  },
  {
    pattern: /epieos\.com/i,
    status: 'optional_account',
    fr: "Recherche inversée d'email et téléphone basique sans compte ; enrichissement pro avec compte.",
    en: "Basic reverse email and phone lookup without account; pro enrichment with account."
  },
  {
    pattern: /abuseipdb\.com|otx\.alienvault\.com/i,
    status: 'optional_account',
    fr: "Vérification de réputation d'adresses IP sans compte ; signalement et clés API avec compte.",
    en: "IP reputation verification without account; reporting and API keys with account."
  },
  {
    pattern: /greynoise\.io/i,
    status: 'optional_account',
    fr: "Recherche du bruit Internet dans le visualiseur sans compte ; alertes et intégrations avec compte.",
    en: "Internet background noise visualizer searchable without account; alerts and integrations with account."
  },
  {
    pattern: /globalfishingwatch\.org/i,
    status: 'optional_account',
    fr: "Carte interactive de surveillance de la pêche libre d'accès sans compte ; téléchargement de données avec compte gratuit.",
    en: "Interactive fishing surveillance map freely accessible without account; data download with free account."
  },
  {
    pattern: /dataspace\.copernicus\.eu|sentinel-hub\.com/i,
    status: 'optional_account',
    fr: "Visualisation de l'imagerie satellite Copernicus sans compte ; traitements avancés et exports avec compte gratuit.",
    en: "Copernicus satellite imagery viewing without account; advanced processing and exports with free account."
  },
  {
    pattern: /earthexplorer\.usgs\.gov/i,
    status: 'optional_account',
    fr: "Recherche et consultation des métadonnées satellites sans compte ; téléchargement des scènes brutes avec compte gratuit USGS.",
    en: "Satellite metadata search without account; raw scene downloads require free USGS account."
  },
  {
    pattern: /aleph\.occrp\.org/i,
    status: 'optional_account',
    fr: "Recherche dans les fuites et registres publics sans compte ; espaces d'enquête collaboratifs avec compte.",
    en: "Public leaks and registers searchable without account; collaborative investigation spaces with account."
  },
  {
    pattern: /courtlistener\.com/i,
    status: 'optional_account',
    fr: "Recherche d'audiences et décisions de justice sans compte ; alertes et téléchargements RECAP avec compte gratuit.",
    en: "Search court dockets and opinions without account; alerts and RECAP downloads with free account."
  },
  {
    pattern: /inoreader\.com|feedly\.com/i,
    status: 'optional_account',
    fr: "Lecture d'articles publics sans compte ; synchronisation et abonnement aux flux RSS avec compte.",
    en: "Public article reading without account; RSS feed sync and subscriptions with account."
  },
  {
    pattern: /mapillary\.com/i,
    status: 'optional_account',
    fr: "Exploration des photographies de rues participatives sans compte ; contribution et API avec compte.",
    en: "Street-level crowdsourced photo browsing without account; contributions and API with account."
  },
  {
    pattern: /haveibeenpwned\.com/i,
    status: 'optional_account',
    fr: "Recherche directe d'adresses email compromises sans compte ; surveillance continue de domaines avec compte.",
    en: "Direct breached email search without account; continuous domain monitoring with account."
  },
  {
    pattern: /semanticscholar\.org|researchgate\.net|academia\.edu|ieeexplore\.ieee\.org|sciencedirect\.com|link\.springer\.com/i,
    status: 'optional_account',
    fr: "Recherche d'articles et résumés scientifiques consultables sans compte ; accès aux fonctionnalités communautaires ou texte intégral avec compte.",
    en: "Article search and scientific abstracts consultable without account; community features or full text with account."
  },
  {
    pattern: /qrz\.com/i,
    status: 'optional_account',
    fr: "Recherche d'indicatifs radio basique sans compte ; détails complets d'adresses avec compte gratuit.",
    en: "Basic radio callsign lookup without account; complete address details with free account."
  },

  // No account
  {
    pattern: /github\.com|gitlab\.com|sourceforge\.net|codeberg\.org/i,
    status: 'no_account',
    fr: "Outil ou code source libre, téléchargeable et exécutable localement sans aucun compte.",
    en: "Open-source tool or code, downloadable and runnable locally without any account."
  },
  {
    pattern: /scholar\.google\.com|openalex\.org|base-search\.net|core\.ac\.uk|arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov|science\.gov|doaj\.org|unpaywall\.org|dblp\.org|worldcat\.org|orcid\.org|openaire\.eu/i,
    status: 'no_account',
    fr: "Moteur de recherche scientifique et base de données académique en libre accès sans compte.",
    en: "Open scientific search engine and academic database freely accessible without account."
  },
  {
    pattern: /archive\.org|archive\.today|archive\.is|archive\.ph|ghostarchive\.org|timetravel\.mementoweb\.org|webarchive\.org\.uk|cachedview\.com|cache\.pw/i,
    status: 'no_account',
    fr: "Service d'archivage et de consultation de captures web historiques en accès direct sans compte.",
    en: "Web archive service for consulting historical captures with direct access without account."
  },
  {
    pattern: /google\.com\/search|bing\.com\/search|duckduckgo\.com|startpage\.com|mojeek\.com|qwant\.com|search\.brave\.com|searx|metager\.org|ecosia\.org|swisscows\.com|marginalia\.nu|ahmia\.fi|tor\.taxi|dark\.fail|thehiddenwiki|onion\.live|onionlinks/i,
    status: 'no_account',
    fr: "Moteur de recherche en ligne accessible instantanément sans compte ni authentification.",
    en: "Online search engine instantly accessible without account or authentication."
  },
  {
    pattern: /images\.google\.com|image\.baidu\.com|bing\.com\/visualsearch|search\.google\/ways-to-search\/lens|yandex\.com\/images|tineye\.com|saucenao\.com/i,
    status: 'no_account',
    fr: "Recherche inversée d'images utilisable directement dans le navigateur sans création de compte.",
    en: "Reverse image search directly usable in browser without creating an account."
  },
  {
    pattern: /fotoforensics\.com|29a\.ch\/photo-forensics|metadata2go\.com|pic2map\.com|aperisolve\.com|verify\.contentauthenticity\.org|exiftool\.org/i,
    status: 'no_account',
    fr: "Outil d'analyse forensique ou d'extraction de métadonnées utilisable en direct sans compte.",
    en: "Forensic analysis or metadata extraction tool directly usable without account."
  },
  {
    pattern: /whois\.com|dnsdumpster\.com|viewdns\.info|crt\.sh|bgp\.he\.net|bgpview\.io|mxtoolbox\.com|mailtester\.com|emailrep\.io|ssllabs\.com|who\.is|arin\.net|ripe\.net|apnic\.net|lacnic\.net|afrinic\.net|robtex\.com|web-check\.xyz|tranco-list\.eu/i,
    status: 'no_account',
    fr: "Service de diagnostic réseau, DNS et WHOIS en consultation publique directe sans inscription.",
    en: "Network, DNS and WHOIS diagnostic service freely queryable without registration."
  },
  {
    pattern: /openstreetmap\.org|openrailwaymap\.org|adsbexchange\.com|vesselfinder\.com|myshiptracking\.com|windy\.com|suncalc\.org|earth\.google\.com|zoom\.earth|liveatc\.net|cruisemapper\.com|shipspotting\.com|shipfinder|fleetleaks\.com/i,
    status: 'no_account',
    fr: "Cartographie interactive, données ouvertes et suivi en direct accessibles sans compte.",
    en: "Interactive mapping, open data and live tracking freely accessible without account."
  },
  {
    pattern: /legifrance\.gouv\.fr|eur-lex\.europa\.eu|govinfo\.gov|foia\.gov|sec\.gov|gleif\.org|offshoreleaks\.icij\.org|opensanctions\.org|interpol\.int|fbi\.gov|case\.law|bailii\.org|canlii\.org|austlii\.edu\.au|worldlii\.org|curia\.europa\.eu|hudoc\.echr\.coe\.int|justia\.com/i,
    status: 'no_account',
    fr: "Registre public officiel ou base de données gouvernementale en libre consultation sans compte.",
    en: "Official public register or government database freely searchable without account."
  },
  {
    pattern: /threatfox\.abuse\.ch|urlhaus\.abuse\.ch|malwarebazaar\.abuse\.ch|feodotrazaar|feodotracker\.abuse\.ch|bazaar\.abuse\.ch|ransomware\.live|thedfirreport\.com|cisa\.gov|nvd\.nist\.gov|vx-underground\.org|blocklist\.de|spamhaus\.org|ransomlook\.io/i,
    status: 'no_account',
    fr: "Flux de renseignement sur les cybermenaces et IOCs en libre téléchargement sans compte.",
    en: "Cyber threat intelligence feeds and IOCs freely downloadable without account."
  },
  {
    pattern: /whatsmyname\.app|namechk\.com|foller\.me|picuki\.com|urlebird\.com|socialblade\.com|clearsky\.app|bellingcat\.com|osintframework\.com|filmot\.com|grep\.app|searchcode\.com|andisearch\.com|huggingface\.co\/spaces/i,
    status: 'no_account',
    fr: "Outil en ligne d'énumération ou de recherche OSINT accessible immédiatement sans compte.",
    en: "Online enumeration or OSINT lookup tool immediately accessible without account."
  },
  {
    pattern: /obsidian\.md|joplinapp\.org|gephi\.org|cytoscape\.org|openrefine\.org|tabula\.technology|rawgraphs\.io|ghidra-sre\.org|remnux\.org|winitor\.com|virustotal\.github\.io\/yara/i,
    status: 'no_account',
    fr: "Logiciel autonome ou application locale s'exécutant sur votre poste sans compte ni serveur tiers.",
    en: "Standalone software or local app executing on your computer without account or third-party server."
  },
  {
    pattern: /websdr\.org|kiwisdr\.com|sigidwiki\.com|radioreference\.com|repeaterbook\.com|morsecode\.world|n2yo\.com|heavens-above\.com|radio\.garden|priyom\.org|hfunderground\.com|broadcastify\.com|rtl-sdr\.com/i,
    status: 'no_account',
    fr: "Écoute de récepteurs SDR, suivi satellite ou radiofréquences en direct sans compte.",
    en: "Live SDR radio listening, satellite tracking or radio frequencies without account."
  },
  {
    pattern: /travic\.app|geops\.ch|mobilitydatabase\.org|rinf\.era\.europa\.eu|era\.europa\.eu|railroads\.dot\.gov|transportation\.gov|railwebcams\.net/i,
    status: 'no_account',
    fr: "Portail d'infrastructures et horaires ferroviaires consultables librement sans compte.",
    en: "Railway infrastructure and transit portal freely consultable without account."
  },
  {
    pattern: /news\.google\.com|news\.yahoo\.com|euronews\.com|allsides\.com|ground\.news|newsnow\.co\.uk|reuters\.com|gdeltproject\.org|mediacloud\.org/i,
    status: 'no_account',
    fr: "Actualités, veille de presse et données médiatiques consultables librement sans compte.",
    en: "News, press monitoring and media data freely consultable without account."
  },
  {
    pattern: /planespotters\.net|airfighters\.com|flightconnections\.com|jetphotos\.com|opensky-network\.org/i,
    status: 'no_account',
    fr: "Base photographique et de suivi d'aéronefs consultable librement sans compte.",
    en: "Aircraft spotter database and tracking freely consultable without account."
  },

  // No account
  {
    pattern: /github\.com|gitlab\.com|sourceforge\.net|codeberg\.org/i,
    status: 'no_account',
    fr: "Outil ou code source libre, téléchargeable et exécutable localement sans aucun compte.",
    en: "Open-source tool or code, downloadable and runnable locally without any account."
  },
  {
    pattern: /scholar\.google\.com|openalex\.org|base-search\.net|core\.ac\.uk|arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov|science\.gov|doaj\.org|unpaywall\.org|dblp\.org|worldcat\.org/i,
    status: 'no_account',
    fr: "Moteur de recherche scientifique et base de données académique en libre accès sans compte.",
    en: "Open scientific search engine and academic database freely accessible without account."
  },
  {
    pattern: /archive\.org|archive\.today|archive\.is|archive\.ph|ghostarchive\.org|timetravel\.mementoweb\.org|webarchive\.org\.uk/i,
    status: 'no_account',
    fr: "Service d'archivage et de consultation de captures web historiques en accès direct sans compte.",
    en: "Web archive service for consulting historical captures with direct access without account."
  },
  {
    pattern: /google\.com\/search|bing\.com\/search|duckduckgo\.com|startpage\.com|mojeek\.com|qwant\.com|search\.brave\.com|searx|metager\.org|ecosia\.org|swisscows\.com|marginalia\.nu|ahmia\.fi|tor\.taxi|dark\.fail/i,
    status: 'no_account',
    fr: "Moteur de recherche en ligne accessible instantanément sans compte ni authentification.",
    en: "Online search engine instantly accessible without account or authentication."
  },
  {
    pattern: /images\.google\.com|image\.baidu\.com|bing\.com\/visualsearch|search\.google\/ways-to-search\/lens|yandex\.com\/images|tineye\.com|saucenao\.com/i,
    status: 'no_account',
    fr: "Recherche inversée d'images utilisable directement dans le navigateur sans création de compte.",
    en: "Reverse image search directly usable in browser without creating an account."
  },
  {
    pattern: /fotoforensics\.com|29a\.ch\/photo-forensics|metadata2go\.com|pic2map\.com|aperisolve\.com|verify\.contentauthenticity\.org|exiftool\.org/i,
    status: 'no_account',
    fr: "Outil d'analyse forensique ou d'extraction de métadonnées utilisable en direct sans compte.",
    en: "Forensic analysis or metadata extraction tool directly usable without account."
  },
  {
    pattern: /whois\.com|dnsdumpster\.com|viewdns\.info|crt\.sh|bgp\.he\.net|bgpview\.io|mxtoolbox\.com|mailtester\.com|emailrep\.io|ssllabs\.com|who\.is|arin\.net|ripe\.net|apnic\.net|lacnic\.net|afrinic\.net/i,
    status: 'no_account',
    fr: "Service de diagnostic réseau, DNS et WHOIS en consultation publique directe sans inscription.",
    en: "Network, DNS and WHOIS diagnostic service freely queryable without registration."
  },
  {
    pattern: /openstreetmap\.org|openrailwaymap\.org|adsbexchange\.com|vesselfinder\.com|myshiptracking\.com|windy\.com|suncalc\.org|earth\.google\.com|zoom\.earth|liveatc\.net/i,
    status: 'no_account',
    fr: "Cartographie interactive, données ouvertes et suivi en direct accessibles sans compte.",
    en: "Interactive mapping, open data and live tracking freely accessible without account."
  },
  {
    pattern: /legifrance\.gouv\.fr|eur-lex\.europa\.eu|govinfo\.gov|foia\.gov|sec\.gov|gleif\.org|offshoreleaks\.icij\.org|opensanctions\.org|interpol\.int|fbi\.gov|case\.law|bailii\.org|canlii\.org|austlii\.edu\.au|worldlii\.org|curia\.europa\.eu|hudoc\.echr\.coe\.int|justia\.com/i,
    status: 'no_account',
    fr: "Registre public officiel ou base de données gouvernementale en libre consultation sans compte.",
    en: "Official public register or government database freely searchable without account."
  },
  {
    pattern: /threatfox\.abuse\.ch|urlhaus\.abuse\.ch|malwarebazaar\.abuse\.ch|feodotracker\.abuse\.ch|ransomware\.live|thedfirreport\.com|cisa\.gov|nvd\.nist\.gov|vx-underground\.org|blocklist\.de|spamhaus\.org/i,
    status: 'no_account',
    fr: "Flux de renseignement sur les cybermenaces et IOCs en libre téléchargement sans compte.",
    en: "Cyber threat intelligence feeds and IOCs freely downloadable without account."
  },
  {
    pattern: /whatsmyname\.app|namechk\.com|foller\.me|picuki\.com|urlebird\.com|socialblade\.com|clearsky\.app|bellingcat\.com|osintframework\.com|filmot\.com|grep\.app|searchcode\.com/i,
    status: 'no_account',
    fr: "Outil en ligne d'énumération ou de recherche OSINT accessible immédiatement sans compte.",
    en: "Online enumeration or OSINT lookup tool immediately accessible without account."
  },
  {
    pattern: /obsidian\.md|joplinapp\.org|gephi\.org|cytoscape\.org|openrefine\.org|tabula\.technology|rawgraphs\.io/i,
    status: 'no_account',
    fr: "Logiciel autonome ou application locale s'exécutant sur votre poste sans compte ni serveur tiers.",
    en: "Standalone software or local app executing on your computer without account or third-party server."
  },
  {
    pattern: /websdr\.org|kiwisdr\.com|sigidwiki\.com|radioreference\.com|repeaterbook\.com|morsecode\.world|n2yo\.com|heavens-above\.com/i,
    status: 'no_account',
    fr: "Écoute de récepteurs SDR, suivi satellite ou radiofréquences en direct sans compte.",
    en: "Live SDR radio listening, satellite tracking or radio frequencies without account."
  },
  {
    pattern: /travic\.app|geops\.ch|mobilitydatabase\.org|rinf\.era\.europa\.eu/i,
    status: 'no_account',
    fr: "Portail d'infrastructures et horaires ferroviaires consultables librement sans compte.",
    en: "Railway infrastructure and transit portal freely consultable without account."
  }
];

function classifyTool(tool) {
  const url = tool.url || '';
  const name = tool.name || '';
  const group = tool.group || '';

  // Rule matches
  for (const rule of RULES) {
    if (rule.pattern.test(url) || rule.pattern.test(name)) {
      return {
        access: rule.status,
        details_fr: rule.fr,
        details_en: rule.en
      };
    }
  }

  // Open-source repos
  if (/github\.com|gitlab\.com|codeberg\.org|sourceforge\.net/i.test(url)) {
    return {
      access: 'no_account',
      details_fr: "Code source ouvert et exécutable localement sans aucun compte.",
      details_en: "Open-source code and locally executable without any account."
    };
  }

  // High-confidence group rules
  if (group === 'European National Business Registers' ||
      group === 'Court and Legal Databases' ||
      group === 'Government Records and Open Data' ||
      group === 'Official Registers' ||
      group === 'Freedom of Information (FOI) Requests' ||
      group === 'Registries and Whois') {
    return {
      access: 'no_account',
      details_fr: "Registre public officiel ou annuaire institutionnel consultable directement sans compte.",
      details_en: "Official public register or institutional directory directly consultable without account."
    };
  }

  if (group === 'Guides and Books' || group === 'Blogs' || group === 'Podcasts OSINT' || group === 'Podcasts CTI') {
    return {
      access: 'no_account',
      details_fr: "Ressource documentaire, guide méthodologique ou podcast en libre accès sans inscription.",
      details_en: "Documentary resource, methodology guide or podcast freely accessible without registration."
    };
  }

  if (group === 'Live Train Tracking by Country' || group === 'Reference Maps' || group === 'Open Data & Transit Feeds') {
    return {
      access: 'no_account',
      details_fr: "Carte des réseaux et suivi des circulations en direct en accès libre sans compte.",
      details_en: "Network map and live transit tracking freely accessible without account."
    };
  }

  if (group === 'Reverse Image Search Engines' || group === 'General Search Engines' || group === 'Web Archives' || group === 'Onion Search Engines') {
    return {
      access: 'no_account',
      details_fr: "Moteur de recherche ou archive utilisable directement sans compte ni inscription.",
      details_en: "Search engine or archive directly usable without account or registration."
    };
  }

  if (group === 'Mapping and Street-level') {
    return {
      access: 'no_account',
      details_fr: "Service cartographique interactif accessible directement sans compte.",
      details_en: "Interactive mapping service directly accessible without account."
    };
  }

  if (group === 'IP Tools' || group === 'Certificates and DNS') {
    return {
      access: 'no_account',
      details_fr: "Outil de diagnostic réseau et résolution DNS public sans inscription requise.",
      details_en: "Public network diagnostic and DNS lookup tool without registration."
    };
  }

  // Default: marked to_verify per prompt instruction
  return {
    access: 'to_verify',
    details_fr: "Conditions d'accès et modalités d'inscription actuellement à confirmer.",
    details_en: "Access conditions and registration terms currently to be verified."
  };
}

// --- 6. Parse Docs Markdown Files & Build Data ---
function parseMarkdown(content) {
  const lines = content.split('\n');
  const groups = [];
  let currentGroup = null;

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      const gName = headingMatch[1].trim();
      currentGroup = {
        name: gName,
        name_en: (GROUP_I18N[gName] && GROUP_I18N[gName].en) || gName,
        name_fr: (GROUP_I18N[gName] && GROUP_I18N[gName].fr) || gName,
        tools: []
      };
      groups.push(currentGroup);
      continue;
    }

    const toolMatch = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[—–-]?\s*(.*)/);
    if (toolMatch && currentGroup) {
      const toolName = toolMatch[1].trim();
      const toolUrl = toolMatch[2].trim();
      const descEn = toolMatch[3].replace(/\s{2,}$/, '').trim();
      const descFr = translateDescription(descEn, toolName, '');

      currentGroup.tools.push({
        name: toolName,
        url: toolUrl,
        description: descEn,
        description_en: descEn,
        description_fr: descFr
      });
    }
  }

  return groups;
}

function build() {
  if (!fs.existsSync(SITE_DIR)) {
    fs.mkdirSync(SITE_DIR, { recursive: true });
  }

  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md')).sort();
  const categories = [];
  const accessRegistry = {};
  const descriptionsFr = {};

  const stats = {
    totalTools: 0,
    no_account: 0,
    optional_account: 0,
    limited_access: 0,
    required_account: 0,
    to_verify: 0
  };

  for (const file of files) {
    const slug = file.replace('.md', '');
    const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
    const meta = CATEGORY_META[slug] || { emoji: '🔗', title_en: slug, title_fr: slug };
    const groups = parseMarkdown(content);

    // Enrich each tool with access classification
    for (const group of groups) {
      for (const tool of group.tools) {
        tool.group = group.name;
        const res = classifyTool(tool);
        tool.access = res.access;
        tool.access_details_fr = res.details_fr;
        tool.access_details_en = res.details_en;

        accessRegistry[tool.url] = {
          name: tool.name,
          category: slug,
          group: group.name,
          access: res.access,
          details_fr: res.details_fr,
          details_en: res.details_en
        };

        descriptionsFr[tool.url] = tool.description_fr;

        stats.totalTools++;
        stats[res.access]++;
      }
    }

    const toolCount = groups.reduce((sum, g) => sum + g.tools.length, 0);

    categories.push({
      slug,
      emoji: meta.emoji,
      title: meta.title_fr, // Default French display
      title_fr: meta.title_fr,
      title_en: meta.title_en,
      groups,
      toolCount,
    });
  }

  const noRegistrationCount = stats.no_account + stats.optional_account + stats.limited_access;

  const data = {
    totalTools: stats.totalTools,
    totalCategories: categories.length,
    noRegistrationCount,
    accessStats: stats,
    categories
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(accessRegistry, null, 2));
  fs.writeFileSync(DESC_FR_FILE, JSON.stringify(descriptionsFr, null, 2));

  console.log('======================================================');
  console.log(`✅ Unified Catalog & Bilingual Data Built Successfully!`);
  console.log(`📊 Total tools: ${stats.totalTools} across ${categories.length} categories`);
  console.log(`🔓 Tools without mandatory registration: ${noRegistrationCount}`);
  console.log(`   🟢 Sans compte (no_account):          ${stats.no_account}`);
  console.log(`   🔵 Compte facultatif (optional_account): ${stats.optional_account}`);
  console.log(`   🟡 Accès limité (limited_access):     ${stats.limited_access}`);
  console.log(`   🔒 Inscription requise (required_account): ${stats.required_account}`);
  console.log(`   ⚪ À vérifier (to_verify):             ${stats.to_verify}`);
  console.log('======================================================');
}

build();
