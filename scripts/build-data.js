/**
 * Build script: Parses all markdown files in docs/ and produces a single
 * JSON data file (site/data.json) that the front-end consumes at runtime.
 *
 * Each markdown file becomes one "category". Subsections (### headings)
 * become groups within that category. Links are parsed into tool objects.
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const SITE_DIR = path.join(__dirname, '..', 'site');
const OUT_FILE = path.join(SITE_DIR, 'data.json');

// Category metadata — maps filename (without .md) to emoji + display title
const CATEGORY_META = {
  'academic':               { emoji: '📚', title: 'Academic & Research Databases' },
  'ai-osint':               { emoji: '🧠', title: 'AI & OSINT Assistance' },
  'archiving-caching':      { emoji: '🗄', title: 'Website Archiving & Caching' },
  'automation-recon':        { emoji: '🤖', title: 'Automation & Recon Frameworks' },
  'aviation':               { emoji: '✈️', title: 'Aviation Movements & Flight Tracking' },
  'business-intel':         { emoji: '💼', title: 'Business & Company Intelligence' },
  'comms':                  { emoji: '📻', title: 'Communications & SIGINT' },
  'darkweb-leaks':          { emoji: '🕳', title: 'Dark Web & Leaks' },
  'document-file':          { emoji: '📑', title: 'Document & File Search' },
  'geospatial-mapping':     { emoji: '🛰', title: 'Geospatial & Mapping OSINT' },
  'gov-legal':              { emoji: '⚖️', title: 'Government & Legal Records' },
  'image-reverse':          { emoji: '📷', title: 'Image & Reverse Search' },
  'infra-domains':          { emoji: '🌍', title: 'Domains, IPs & Infrastructure' },
  'intel-feeds':            { emoji: '📡', title: 'Intelligence Feeds' },
  'learning':               { emoji: '📚', title: 'Learning Resources' },
  'malware-cti':            { emoji: '🦠', title: 'Malware Analysis & CTI' },
  'maritime':               { emoji: '⚓', title: 'Vessel Movements & Shipping' },
  'news-media':             { emoji: '📰', title: 'News & Media Monitoring' },
  'osint-for-good':         { emoji: '🧑‍🤝‍🧑', title: 'OSINT for Good (NGOs & Initiatives)' },
  'people-social':          { emoji: '👤', title: 'People Search & Social Media' },
  'phishing-email':         { emoji: '🎣', title: 'Phishing & Email Investigation' },
  'railways':               { emoji: '🚂', title: 'Railways & Live Train Maps' },
  'reporting-visualization': { emoji: '📝', title: 'Reporting & Visualization' },
  'search-engines':         { emoji: '🔍', title: 'Search Engines' },
  'video-osint':            { emoji: '🎥', title: 'Video OSINT' },
};

function parseMarkdown(content) {
  const lines = content.split('\n');
  const groups = [];
  let currentGroup = null;

  for (const line of lines) {
    // Sub-section heading (### …)
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      currentGroup = { name: headingMatch[1].trim(), tools: [] };
      groups.push(currentGroup);
      continue;
    }

    // Tool link: - [Name](url) — description
    const toolMatch = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[—–-]?\s*(.*)/);
    if (toolMatch && currentGroup) {
      currentGroup.tools.push({
        name: toolMatch[1].trim(),
        url: toolMatch[2].trim(),
        description: toolMatch[3].replace(/\s{2,}$/, '').trim(),
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

  for (const file of files) {
    const slug = file.replace('.md', '');
    const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
    const meta = CATEGORY_META[slug] || { emoji: '🔗', title: slug };
    const groups = parseMarkdown(content);
    const toolCount = groups.reduce((sum, g) => sum + g.tools.length, 0);

    categories.push({
      slug,
      emoji: meta.emoji,
      title: meta.title,
      groups,
      toolCount,
    });
  }

  const totalTools = categories.reduce((sum, c) => sum + c.toolCount, 0);

  const data = { totalTools, totalCategories: categories.length, categories };
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2));

  console.log(`✅ Built data.json — ${totalTools} tools across ${categories.length} categories`);
}

build();
