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

- 🗂 **Sidebar Navigation:** Collapsible sidebar with all 25 categories, emoji icons, and live tool counts — replaces the former horizontal chip bar for faster access and better readability.
- 🔍 **Always-On Search:** Instant search across tool names, descriptions, and domains, accessible from the persistent top bar (press <kbd>/</kbd> to focus, <kbd>Esc</kbd> to clear).
- 📌 **Compact Top Bar:** Brand, search, and global stats always visible — no large hero section in the way.
- 🌐 **Automatic Favicon Resolution:** Auto-fetches official platform favicons for rapid visual identification.
- 🎨 **Deep-Space Dark Aesthetic:** High-contrast dark theme with cyan accents, clean typography (`Inter` + `JetBrains Mono`), and subtle ambient effects.
- 📱 **Fully Responsive:** Desktop sidebar collapses with tooltips; mobile uses a slide-in drawer with overlay.
- 💾 **Persistent Preferences:** Sidebar collapsed/expanded state is remembered across sessions via `localStorage`.
- ⚡ **Zero External Backend Required:** Pure static HTML/CSS/JS frontend powered by an auto-generated JSON catalog.
- ♿ **Keyboard & Focus Support:** All interactive elements have visible focus states and proper ARIA labels.

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
