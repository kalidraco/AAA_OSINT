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
| `npm run dev` | Rebuilds the data JSON and launches the local dev server on port `3000` |
| `npm run build` | Parses all markdown files in `docs/` and generates `site/data.json` |
| `npm run serve` | Serves the existing `site/` folder directly on port `3000` |

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
