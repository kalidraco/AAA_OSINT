# 🛰 AAA_OSINT

A curated collection of **940+ OSINT tools & resources** across **25 categories**, paired with a fast, modern interactive web interface to explore, filter, and search tools in real time.

The sources include specialized security newsletters, research teams, investigative communities, curated startpages, GitHub repositories, and open-source intelligence databases.

⚠️ **Disclaimer:** Most listed tools are third-party services. Always vet and use them responsibly within authorized legal frameworks.

---

## ⚡ Quick Start: Running on Localhost

You can run the web dashboard locally in seconds with **Node.js**:

### 1. Clone the repository
```bash
git clone https://github.com/kalidraco/AAA_OSINT.git
cd AAA_OSINT
```

### 2. Start the local server
```bash
npm run dev
```

This will automatically parse all documentation in `docs/`, generate `site/data.json`, and start a lightweight local web server.

### 3. Open in your browser
Navigate to:
```
http://localhost:3000
```

---

## 🛠 Available NPM Scripts

| Command | Action |
|---|---|
| `npm run dev` | Rebuilds data JSON and launches the full local server with Intelligence X proxy on port `3000` |
| `npm run server` | Starts the Node.js server and secure Intelligence X proxy on port `3000` |
| `npm test` | Runs the automated test suite (selectors, masking, polling, mock proxy, catalog integrity) |
| `npm run build` | Parses all markdown files in `docs/` and generates `site/data.json` |
| `npm run serve` | Serves the static `site/` folder directly on port `3000` (without local API proxy) |

---

## ⚡ Fast Research — Recherche Rapide Multi-Sources (Priorité aux Faits)

Le module **Recherche Rapide** (Fast Research) répond à l'impératif absolu des investigations réelles : **la vitesse et la quantité d'informations brutes vérifiables priment sur la visualisation ou les graphes complexes.**

À partir d'un seul indice de départ, le moteur déclenche des requêtes parallèles non-bloquantes vers plus de 13 sources directes et affiche les résultats au fil de l'eau dans une liste claire et compacte en moins de 500 ms.

### Points Clés
- **Saisie Unique & Universelle :** Analyseur d'indices sans sélection manuelle préalable :
  - **Domaines & Sous-domaines :** Résolution DNS native (A, AAAA, MX, TXT, NS, SOA), sous-domaines crt.sh (logs Certificate Transparency), WHOIS / RDAP, archives Wayback Machine, en-têtes HTTP & stack serveur, détection de menaces URLhaus.
  - **Adresses IP :** Reverse DNS PTR, Shodan InternetDB (ports ouverts, CVEs et CPEs sans clé API requise), allocations réseau RDAP/BGP, réputation d'attaques.
  - **Pseudonymes / Handles :** Reconnaissance multi-plateformes simultanée (GitHub, Reddit, HackerNews, GitLab, Keybase) et fiches Wikidata.
  - **Identités & Entreprises :** Consultation instantanée du Registre National des Entreprises (RNE / Insee) via l'API officielle gouv.fr (dénomination, SIREN/SIRET, dirigeants, adresses, codes NAF) et synthèses encyclopédiques.
  - **Cryptomonnaies :** Vérification de format et interrogation en direct du grand livre Bitcoin (`mempool.space`) pour le solde confirmé et le nombre de transactions.
  - **Hashes & Signatures :** Vérification de signatures cryptographiques (MD5, SHA1, SHA256) contre les bases de signatures d'attaques publiques (CIRCL Hashlookup).
  - **Images & Documents :** Extraction locale immédiate des métadonnées EXIF (GPS, appareil photo, date) et calcul d'empreinte SHA-256 dans le navigateur.
- **Affichage Progressif en Streaming (List First) :**
  - Les résultats s'affichent instantanément sous forme de cartes d'action au fur et à mesure de l'arrivée des réponses réseau, sans attendre la source la plus lente.
  - Chaque carte indique le statut (🟢 Succès, ⚪ Aucun résultat, 🔴 Erreur), le nom de la source, la latence mesurée en millisecondes, le lien direct vers la preuve et un bouton de copie rapide.
- **Approfondissement en 1 Clic (Pivot Automatique) :**
  - Un bouton « 🔍 Approfondir » sur chaque donnée découverte permet de relancer immédiatement une recherche ciblée sur ce nouvel élément (ex: pivoter sur une IP découverte dans un enregistrement DNS).
- **Graphe Optionnel Non-Bloquant :**
  - Un sélecteur de vue `[📋 Liste (Défaut)]` / `[🕸️ Graphe]` permet, sur décision de l'analyste, de projeter les résultats collectés dans le graphe interactif. Le graphe ne ralentit jamais la collecte et ne constitue pas un passage obligatoire.
- **Séparation Stricte des Faits & Outils Complémentaires :**
  - Les faits collectés automatiquement par API sont distincts des pivots vers les outils du catalogue (qui s'ouvrent dans le navigateur avec l'indice pré-rempli).
- **Synchronisation avec les Enquêtes :**
  - Bouton « Envoyer vers Enquête » pour injecter instantanément l'ensemble des indices et preuves collectés dans le module d'investigation pour la génération de rapports structurés conformes au Protocole de Berkeley.
- **Multi-Formats d'Export :**
  - Export immédiat de la session en **JSON**, **CSV** tabulaire ou **Markdown**.

---

## 🕸️ Visual Investigation Graph (Maltego-style Workspace)

AAA_OSINT features an interactive visual intelligence workspace inspired by **Maltego**. Analysts can start with a single seed indicator or an uploaded image, trigger automated multi-source transforms, explore relationships on an interactive force-directed canvas, and pivot dynamically into AAA_OSINT's 947 specialized tools.

### Key Capabilities
- **Single-Seed Ingestion & Image Upload:** Auto-detects 15 entity types (domains, IPs, emails, usernames, phones, crypto wallets, hashes, URLs, organizations, persons, locations, certificates, autonomous systems, tech stacks, files). Supports image uploads with automated binary **EXIF parsing** (camera model, GPS coordinates, timestamps) and **SHA-256 fingerprinting**.
- **Automated Live Transforms (`/api/transform/*`):**
  - **DNS Records:** Resolves A, AAAA, MX, TXT, NS, and CNAME records via native DNS.
  - **Reverse DNS (PTR):** Resolves IP addresses back to fully qualified hostnames.
  - **RDAP / WHOIS:** Extracts network blocks, registrar, CIDR, and autonomous system info.
  - **crt.sh Subdomains:** Enumerates public subdomains via SSL/TLS Certificate Transparency logs.
  - **HTTP Headers & Tech Stack:** Fetches server banners, security headers (`HSTS`, `CSP`), and HTML page title.
  - **Wayback Machine:** Queries the Internet Archive for snapshot counts, first seen, and latest capture.
  - **Public Profile Recon:** Checks handle presence across GitHub, GitLab, Reddit, and Wikipedia.
  - **Crypto Address Validation:** Formats and verifies Bitcoin, Ethereum, Monero, and Solana wallet signatures.
  - **Catalog Deep Pivots:** Generates pre-filled query links to relevant tools within the 947-resource catalog.
- **Relationship Provenance & Trust Levels:** Clearly differentiates **Verified Relations** (solid cyan/green edges) from **Candidate / Inferred Relations** (dashed amber edges) to prevent premature conclusions.
- **Interactive High-Performance Canvas Engine:**
  - Physics-based force-directed simulation (Coulomb repulsion, Hooke springs, collision buffer anti-overlap).
  - Multiple layout algorithms: **Force-Directed**, **Hierarchical (Tree)**, **Radial (Concentric)**, and **Grid**.
  - Smooth pan/zoom, node dragging with pin-in-place, multi-selection marquee box, and fit-to-view.
- **Sliding Inspector Panel:** Click any node to inspect properties, verifiable source URLs, direct incoming/outgoing connections, trigger contextual transforms on demand, or open recommended catalog tools.
- **Recursive Multi-Depth Runs & Abort:** Configure 1 to 3 exploration depth levels with live streaming entity counters and instant cancellation.
- **Multi-Format Export & Case Synchronization:**
  - Export and re-import workspace graphs via **JSON**.
  - Capture high-resolution **PNG** diagram screenshots.
  - Export **CSV** entity and relationship matrices.
  - **1-Click Sync to Investigation:** Seamlessly transfers all discovered nodes, relationships, and evidence into the **Investigation Case Report** engine for structured 6-section reporting (Berkeley Protocol).
- **100% Dependency-Free:** Powered strictly by native Node.js built-in APIs and pure HTML5 Canvas with dark cyber aesthetics.

---

## 🕵️ Investigation Workspace & Automated Reporting

AAA_OSINT transforms from a 947-tool static directory into an active **OSINT Investigation Platform**. The **Investigation** workspace allows analysts to input multi-format indicators, discover and launch relevant tools with pre-filled queries, collect and cross-reference evidence, track event timelines, and generate publication-ready investigative reports following international open-source intelligence standards (Berkeley Protocol).

### Key Features
- **Multi-Indicator Ingestion:** Automatic classification for 14 indicator types (emails, IPv4/IPv6, domains, URLs, usernames/handles, phone numbers, crypto wallets, MD5/SHA hashes, person names, organizations, documents, images, platform IDs, free text) with manual type override.
- **Smart Catalog Tool Recommendations & Deep-Linking:** Automatically identifies the best tools from AAA_OSINT's 25 categories and generates direct query URLs (e.g. pre-filling search terms on Epieos, Shodan, DuckDuckGo, ViewDNS, etc.).
- **Evidence Management & IntelX Live Streaming:** Record manual findings with source URLs, archival snapshots, and confidence metrics, or seamlessly stream search findings directly from the built-in Intelligence X engine.
- **Automated Cross-Referencing & Correlation Matrix:** Dynamically computes shared entities, infrastructure overlaps, and corroboration levels (**Confirmé** [≥ 2 distinct sources], **Probable**, **Incertain**), allowing analysts to validate (✅) or dispute (❌) correlations.
- **Structured 6-Section Intelligence Reports:**
  - **A. Synthèse exécutive** (Executive Summary, Case Objectives & Core Findings)
  - **B. Tableau des constats** (Detailed Findings with Types, Sources & Dates)
  - **C. Recoupements & Corrélations** (Validated Cross-References & Corroborated Entities)
  - **D. Chronologie des faits** (Chronological Event Timeline)
  - **E. Méthodologie & Limites** (Protocols, Gaps & Traceability)
  - **F. Sources & Annexes** (Verified Sources with Hashes/Snapshots)
- **Multi-Format Export:** Instant export to **Markdown (`.md`)**, self-contained **HTML**, and **Print / PDF** (styled with clean page breaks and print optimization).
- **Persistent Case Management:** File-based REST API (`POST/GET/PUT/DELETE /api/investigation*`) stored under `data/investigations/`, with transparent `localStorage` client-side fallback and JSON backup/restore.
- **Bilingual Interface (FR/EN):** Full translation parity across all investigative workflows, tables, badges, and generated reports.

---

## ⚡ Intelligence X Integration

AAA_OSINT features a native, real-time investigation module powered by the official **Intelligence X (IntelX) API** (`https://2.intelx.io`), allowing investigators to pivot seamlessly between catalog tools and live correlation queries.

### Key Capabilities
- **Multi-Selector Analysis:** Automatic classification and query execution for emails, domain names, IPv4/IPv6 addresses, CIDR network blocks, URLs, international phone numbers, crypto addresses, and cryptographic hashes (MD5, SHA-1, SHA-256).
- **Asynchronous Search & Polling:** Non-blocking async queries using IntelX search IDs with real-time progressive polling, countdown indicators, and clean user-abort termination.
- **Phonebook OSINT:** Domain-level enumeration of associated subdomains, employee emails, and indexed URLs via `/phonebook/search`.
- **Targeted Source Filters:** Narrow searches by buckets (`pastes`, `darknet.tor`, `darknet.i2p`, `leaks.public`, `web.public`, `whois`) and content media types.
- **Privacy & Sensitive Data Masking:** Previews automatically redact passwords, API tokens, combo credentials, and private keys by default, with an explicit analyst toggle to reveal raw content when legally and operationally authorized.
- **Cross-Search Pivoting:** Jump from global search results or catalog tool cards directly into Intelligence X with one click, pre-filling the selector without executing unprompted costly requests.

### API Key Configuration & Security
- **No Hardcoded Keys:** Neither the repository nor client-side bundles contain pre-configured keys.
- **Configuration Options:**
  1. **UI Dialog:** Enter your personal API key via the **« Configurer Clé API »** header button in the module. Store it ephemerally in `sessionStorage` (cleared on browser close) or `localStorage`.
  2. **Environment Variable:** Set `INTELX_KEY="your-api-key"` on the server hosting `server.js` for automatic server-side authentication without transmitting keys in client requests.
- **Local Proxy Architecture:** `server.js` relays queries to `https://2.intelx.io`, keeping your API key protected from third-party interception or CORS limitations.
- **Simulation / Mock Mode:** Set `INTELX_MOCK=true` or send header `x-intelx-mock: true` to test and demonstrate full workflows without consuming live Intelligence X query credits.

### ⚖️ Legal & Licensing Notice
Intelligence X™ is a service provided by Intelligence X Services GmbH. Usage of the API is subject to the [Intelligence X Terms of Service](https://intelx.io/terms-of-service). Integration into commercial products or services requires a paid commercial license from Intelligence X. Users are responsible for complying with applicable privacy and investigation regulations.

---

## ✨ Web App Features

- 🧭 **Structured Operational Domains:** Organizes the 25 OSINT categories into 5 logical investigation domains (Identity, Cyber & Infra, Geospatial & Transport, Intelligence & Legal, Resources & Archiving) with collapsible accordions.
- 📐 **Resizable & Collapsible Desktop Sidebar:** Drag the sidebar edge to freely adjust width (220px–440px, saved in `localStorage`) or collapse to a 58px icon rail (<kbd>Ctrl+B</kbd> / <kbd>⌘B</kbd>). Double-click the resizer to reset.
- ⚡ **Instant Omnisearch with Category Chips:** Global search across tool names, domains, descriptions, and categories (<kbd>Ctrl+K</kbd> / <kbd>⌘K</kbd> or <kbd>/</kbd>), with interactive category filter pills.
- ⭐ **Favorites & Recent History:** Ephemeral bookmarks (★) and automatic investigation history saved locally without requiring an account.
- 🎛 **Density Modes:** Switch between Standard (Comfortable) and High-Density Compact grid modes to view 30+ tools per screen.
- ⌨️ **Full Desktop Keyboard Navigation:** Jump through search results with <kbd>↑</kbd> / <kbd>↓</kbd>, open links with <kbd>Enter</kbd>, dismiss with <kbd>Esc</kbd>, and open shortcuts cheatsheet with <kbd>?</kbd>.
- 🔗 **Quick Subsection Jump Chips:** In categories with multiple subsections, click floating jump chips to instantly scroll to specific groups.
- 📋 **One-Click URL Copy:** Copy clean tool URLs to your clipboard directly from any card.
- 🌐 **Automatic Favicon Resolution:** Auto-fetches platform favicons with custom SVG monogram fallbacks for offline resilience.
- 🎨 **Deep-Space Dark Cyber Aesthetic:** High-contrast palette (`#06080d`) with subtle cyan accents, `Inter` & `JetBrains Mono` typography.
- 📱 **Multi-Resolution & Split-Screen Support:** Scales from ultra-wide 4K down to 50% split-screen windows and mobile drawers.

---

## 📁 Repository Structure

```
AAA_OSINT/
├── docs/                     # 25 categorized OSINT markdown documentation files
│   ├── academic.md
│   ├── ai-osint.md
│   ├── aviation.md
│   ├── malware-cti.md
│   ├── people-social.md
│   └── ...
├── scripts/
│   └── build-data.js         # Node.js script that parses docs/ into site/data.json
├── site/                     # Web application source files
│   ├── index.html            # Main dashboard HTML (topbar + sidebar + content layout)
│   ├── style.css             # Cyber design system, graph canvas & investigation styles
│   ├── app.js                # Search, sidebar navigation, view router & app controller
│   ├── i18n.js               # Centralized bilingual (FR/EN) translation engine
│   ├── graph-engine.js       # Force-directed HTML5 canvas graph engine & layouts
│   ├── transforms-registry.js# 15-type entity taxonomy, transforms & catalog pivots
│   ├── visual-investigation-ui.js # Maltego-style workspace, inspector & runner
│   ├── investigation-engine.js # Indicators, findings, cross-referencing & 6-section report
│   ├── investigation-ui.js   # Investigation case workspace & report generator UI
│   ├── data.json             # Structured JSON dataset (947 tools)
│   └── favicon.svg           # Site favicon
├── test/                     # Zero-dependency automated test suites
│   ├── test-visual-graph.js  # Transforms, graph layouts, EXIF/SHA-256 & API tests
│   ├── test-investigation.js # Investigation, reporting & persistence tests
│   ├── test-features.js      # Bilingual search, access levels & i18n tests
│   └── test-intelx.js        # Intelligence X proxy & selector tests
├── server.js                 # Local API server, IntelX proxy & native transforms API
├── package.json              # NPM scripts & project configuration
├── CONTRIBUTING.md           # Guidelines for contributing new tools
├── CODE_OF_CONDUCT.md        # Community code of conduct
└── LICENSE                   # CC0 1.0 Universal License
```

---

## 📖 Table of Contents & Categories

- [📚 Academic & Research Databases](./docs/academic.md)  
- [🧠 AI & OSINT Assistance](./docs/ai-osint.md)
- [🤖 Automation & Recon Frameworks](./docs/automation-recon.md) 
- [✈️ Aviation Movements & Flight Tracking](./docs/aviation.md)
- [💼 Business & Company Intelligence](./docs/business-intel.md) 
- [📻 Communications & SIGINT](./docs/comms.md)    
- [🕳 Dark Web & Leaks](./docs/darkweb-leaks.md)
- [📑 Document & File Search](./docs/document-file.md)  
- [🌍 Domains, IPs & Infrastructure](./docs/infra-domains.md) 
- [🛰 Geospatial & Mapping OSINT](./docs/geospatial-mapping.md)  
- [⚖️ Government & Legal Records](./docs/gov-legal.md)  
- [📷 Image & Reverse Search](./docs/image-reverse.md)
- [📡 Intelligence Feeds](./docs/intel-feeds.md) 
- [📚 Learning Resources](./docs/learning.md)  
- [🦠 Malware Analysis & CTI](./docs/malware-cti.md) 
- [📰 News & Media Monitoring](./docs/news-media.md) 
- [🧑‍🤝‍🧑 OSINT for Good (NGOs & Initiatives)](./docs/osint-for-good.md)  
- [👤 People Search & Social Media](./docs/people-social.md)  
- [🎣 Phishing & Email Investigation](./docs/phishing-email.md)  
- [🚂 Railways, Live Train Maps & Transport](./docs/railways.md)  
- [📝 Reporting & Visualization](./docs/reporting-visualization.md) 
- [🔍 Search Engines](./docs/search-engines.md)  
- [⚓ Vessel Movements, Databases & Shipping](./docs/maritime.md)
- [🎥 Video OSINT](./docs/video-osint.md)  
- [🗄 Website Archiving & Caching](./docs/archiving-caching.md)    

---

## 🤝 Contributing

Contributions are welcome! If you'd like to suggest new tools, update links, or fix typos:
1. Fork the repository.
2. Add or update the corresponding entry in the relevant file under `docs/`.
3. Run `npm run build` to test that the JSON builds cleanly.
4. Submit a Pull Request following our [Contributing Guidelines](./CONTRIBUTING.md).

---

## ⚖️ License

This project is licensed under [CC0 1.0 Universal](./LICENSE) — Public Domain Dedication.  
Use, modify, and share freely. Attribution is always appreciated!
