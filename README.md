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
│   ├── style.css             # Design system & styles (sidebar, topbar, responsive)
│   ├── app.js                # Search, sidebar navigation, and rendering logic
│   ├── data.json             # Structured JSON dataset (947 tools)
│   └── favicon.svg           # Site favicon
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
