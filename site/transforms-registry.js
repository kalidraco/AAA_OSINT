/**
 * AAA_OSINT — Transforms & Adapters Registry (Maltego-Inspired Architecture)
 *
 * Implements:
 * 1. Normalized entity types (domain, subdomain, ip, email, username, person, organization, url, phone, image, document, crypto, hash, leak, source)
 * 2. Relationship taxonomy (resolves_to, subdomain_of, mail_server_for, nameserver_for, registered_by, profile_on, found_in_breach, etc.)
 * 3. Automated Transforms Engine executing real queries against local /api/transform/* & /api/intelx/* endpoints
 * 4. Catalog Pivot Transforms generating pre-filled queries for the 947 AAA OSINT tools
 * 5. Client-side Image EXIF & SHA-256 fingerprint extractor
 *
 * Zero external npm dependencies. Follows AAA_OSINT IIFE pattern.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TransformsRegistry = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Entity Types Taxonomy & Visual Palettes
  // --------------------------------------------------------------------------
  const ENTITY_TYPES = {
    domain: {
      id: 'domain',
      name_fr: 'Domaine',
      name_en: 'Domain',
      icon: '🌐',
      color: '#00e5ff', // Cyan
      badgeClass: 'entity-badge--domain',
    },
    subdomain: {
      id: 'subdomain',
      name_fr: 'Sous-domaine',
      name_en: 'Subdomain',
      icon: '🕸️',
      color: '#38bdf8', // Sky blue
      badgeClass: 'entity-badge--subdomain',
    },
    ip: {
      id: 'ip',
      name_fr: 'Adresse IP',
      name_en: 'IP Address',
      icon: '🖥️',
      color: '#00e676', // Neon green
      badgeClass: 'entity-badge--ip',
    },
    email: {
      id: 'email',
      name_fr: 'Adresse e-mail',
      name_en: 'Email Address',
      icon: '📧',
      color: '#ffb74d', // Warm orange
      badgeClass: 'entity-badge--email',
    },
    username: {
      id: 'username',
      name_fr: 'Pseudonyme / Profil',
      name_en: 'Username / Profile',
      icon: '👤',
      color: '#b388ff', // Purple
      badgeClass: 'entity-badge--username',
    },
    person: {
      id: 'person',
      name_fr: 'Personne physique',
      name_en: 'Person',
      icon: '🧑',
      color: '#e040fb', // Magenta
      badgeClass: 'entity-badge--person',
    },
    organization: {
      id: 'organization',
      name_fr: 'Organisation / Entreprise',
      name_en: 'Organization / Company',
      icon: '🏢',
      color: '#448aff', // Blue
      badgeClass: 'entity-badge--org',
    },
    url: {
      id: 'url',
      name_fr: 'Page Web / URL',
      name_en: 'Web URL',
      icon: '🔗',
      color: '#26c6da', // Teal
      badgeClass: 'entity-badge--url',
    },
    phone: {
      id: 'phone',
      name_fr: 'Numéro de téléphone',
      name_en: 'Phone Number',
      icon: '📱',
      color: '#69f0ae', // Mint
      badgeClass: 'entity-badge--phone',
    },
    image: {
      id: 'image',
      name_fr: 'Image / Visuel',
      name_en: 'Image',
      icon: '🖼️',
      color: '#ff4081', // Pink
      badgeClass: 'entity-badge--image',
    },
    document: {
      id: 'document',
      name_fr: 'Document / Fichier',
      name_en: 'Document',
      icon: '📄',
      color: '#ffd54f', // Gold
      badgeClass: 'entity-badge--document',
    },
    crypto: {
      id: 'crypto',
      name_fr: 'Portefeuille Crypto',
      name_en: 'Crypto Wallet',
      icon: '🪙',
      color: '#ffd700', // Gold
      badgeClass: 'entity-badge--crypto',
    },
    hash: {
      id: 'hash',
      name_fr: 'Empreinte / Hash',
      name_en: 'Hash',
      icon: '🔑',
      color: '#90a4ae', // Slate
      badgeClass: 'entity-badge--hash',
    },
    leak: {
      id: 'leak',
      name_fr: 'Fuite / Dump de données',
      name_en: 'Data Leak / Breach',
      icon: '🕳️',
      color: '#ff5252', // Red
      badgeClass: 'entity-badge--leak',
    },
    source: {
      id: 'source',
      name_fr: 'Source d\'information',
      name_en: 'Source Reference',
      icon: '📚',
      color: '#7c4dff', // Deep violet
      badgeClass: 'entity-badge--source',
    },
  };

  // --------------------------------------------------------------------------
  // 2. Client-side Image EXIF & Hash Parser
  // --------------------------------------------------------------------------
  async function computeBufferSha256(arrayBuffer) {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return '';
  }

  function parseExifFromBuffer(buffer) {
    const view = new DataView(buffer);
    const result = {
      hasExif: false,
      make: '',
      model: '',
      dateTime: '',
      software: '',
      latitude: null,
      longitude: null,
    };

    try {
      // JPEG validation: 0xFFD8
      if (view.getUint16(0, false) !== 0xFFD8) return result;

      let offset = 2;
      const length = view.byteLength;

      while (offset < length) {
        if (view.getUint8(offset) !== 0xFF) break;
        const marker = view.getUint8(offset + 1);

        // APP1 Marker: 0xFFE1
        if (marker === 0xE1) {
          const app1Length = view.getUint16(offset + 2, false);
          // Check for 'Exif\0\0' string (0x457869660000)
          if (view.getUint32(offset + 4, false) === 0x45786966 && view.getUint16(offset + 8, false) === 0x0000) {
            result.hasExif = true;
            const tiffOffset = offset + 10;
            const bigEndian = view.getUint16(tiffOffset, false) === 0x4D4D; // 'MM' vs 'II'

            const firstIfdOffset = view.getUint32(tiffOffset + 4, !bigEndian);
            if (firstIfdOffset >= 8) {
              const numEntries = view.getUint16(tiffOffset + firstIfdOffset, !bigEndian);
              for (let i = 0; i < numEntries && i < 40; i++) {
                const entryOffset = tiffOffset + firstIfdOffset + 2 + (i * 12);
                if (entryOffset + 12 > length) break;
                const tag = view.getUint16(entryOffset, !bigEndian);
                const count = view.getUint32(entryOffset + 4, !bigEndian);
                const valOffset = tiffOffset + view.getUint32(entryOffset + 8, !bigEndian);

                // Helper to read string
                function readString(strOffset, strLen) {
                  let s = '';
                  for (let j = 0; j < strLen && (strOffset + j) < length; j++) {
                    const c = view.getUint8(strOffset + j);
                    if (c === 0) break;
                    s += String.fromCharCode(c);
                  }
                  return s.trim();
                }

                if (tag === 0x010F && count > 0) result.make = readString(count > 4 ? valOffset : entryOffset + 8, count);
                if (tag === 0x0110 && count > 0) result.model = readString(count > 4 ? valOffset : entryOffset + 8, count);
                if (tag === 0x0131 && count > 0) result.software = readString(count > 4 ? valOffset : entryOffset + 8, count);
                if (tag === 0x0132 && count > 0) result.dateTime = readString(count > 4 ? valOffset : entryOffset + 8, count);
              }
            }
          }
          break;
        }
        offset += 2 + view.getUint16(offset + 2, false);
      }
    } catch {
      // EXIF parse error safe fallback
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // 3. Automated Transforms Definitions
  // --------------------------------------------------------------------------
  class TransformsRegistry {
    constructor(options = {}) {
      this.apiBase = options.apiBase || '';
      this.intelxClient = options.intelxClient || null;
      this.catalogData = options.catalogData || null;

      // Register all native transforms
      this.transforms = this.initTransforms();
    }

    initTransforms() {
      const list = [
        // --------------------------------------------------------------------
        // DOMAIN TRANSFORMS
        // --------------------------------------------------------------------
        {
          id: 'domain_dns_all',
          name_fr: 'Résolution DNS (A, AAAA, MX, NS, TXT)',
          name_en: 'DNS Resolution (A, AAAA, MX, NS, TXT)',
          description_fr: 'Résout les enregistrements d\'adresses IP, serveurs de messagerie, serveurs de noms et politiques SPF/TXT.',
          description_en: 'Resolves IP addresses, mail servers, nameservers, and SPF/TXT verification records.',
          category: 'network',
          applicableTypes: ['domain'],
          isAutomated: true,
          execute: async (node) => {
            const domain = node.properties.domain || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/dns?domain=${encodeURIComponent(domain)}`);
            const data = await res.json();
            if (!data.ok && (!data.records || !data.records.a)) {
              throw new Error(data.error || 'Échec de résolution DNS');
            }

            const newEntities = [];
            const newEdges = [];
            const rec = data.records;

            // A Records (IPv4)
            (rec.a || []).forEach(ip => {
              const ipId = `ip_${ip}`;
              newEntities.push({
                id: ipId,
                type: 'ip',
                label: ip,
                properties: { ip, version: 'IPv4', domainOrigin: domain },
                sources: [{ name: 'DNS A Record', url: '', date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: ipId,
                type: 'resolves_to',
                label: 'A (IPv4)',
                confidence: 'verified',
                source: 'DNS',
              });
            });

            // AAAA Records (IPv6)
            (rec.aaaa || []).forEach(ip6 => {
              const ipId = `ip_${ip6}`;
              newEntities.push({
                id: ipId,
                type: 'ip',
                label: ip6,
                properties: { ip: ip6, version: 'IPv6', domainOrigin: domain },
                sources: [{ name: 'DNS AAAA Record', url: '', date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: ipId,
                type: 'resolves_to',
                label: 'AAAA (IPv6)',
                confidence: 'verified',
                source: 'DNS',
              });
            });

            // MX Records (Mail)
            (rec.mx || []).forEach(mx => {
              const host = mx.exchange;
              const hostId = `domain_${host}`;
              newEntities.push({
                id: hostId,
                type: 'domain',
                label: host,
                properties: { domain: host, isMailServer: true, priority: mx.priority },
                sources: [{ name: 'DNS MX Record', url: '', date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: hostId,
                type: 'mail_server_for',
                label: `MX (prio ${mx.priority})`,
                confidence: 'verified',
                source: 'DNS MX',
              });
            });

            // NS Records (Name Servers)
            (rec.ns || []).forEach(ns => {
              const nsId = `domain_${ns}`;
              newEntities.push({
                id: nsId,
                type: 'domain',
                label: ns,
                properties: { domain: ns, isNameServer: true },
                sources: [{ name: 'DNS NS Record', url: '', date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: nsId,
                type: 'nameserver_for',
                label: 'Nameserver (NS)',
                confidence: 'verified',
                source: 'DNS NS',
              });
            });

            return {
              success: true,
              sourceName: 'DNS Resolver',
              newEntities,
              newEdges,
              propertiesToAdd: {
                txtRecords: (rec.txt || []).join(' | '),
                soa: rec.soa ? (rec.soa.nsname || '') : '',
              },
            };
          },
        },

        {
          id: 'domain_subdomains_crtsh',
          name_fr: 'Sous-domaines (Certificate Transparency crt.sh)',
          name_en: 'Subdomains (Certificate Transparency crt.sh)',
          description_fr: 'Énumère les sous-domaines historiques et actifs répertoriés dans les journaux de certificats SSL/TLS publics.',
          description_en: 'Enumerates subdomains indexed in public SSL/TLS Certificate Transparency logs.',
          category: 'infrastructure',
          applicableTypes: ['domain'],
          isAutomated: true,
          execute: async (node) => {
            const domain = node.properties.domain || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/certs?domain=${encodeURIComponent(domain)}`);
            const data = await res.json();
            if (!data.ok && (!data.subdomains || data.subdomains.length === 0)) {
              throw new Error(data.error || 'Aucun certificat trouvé');
            }

            const newEntities = [];
            const newEdges = [];
            const list = data.subdomains || [];

            list.slice(0, 30).forEach(sub => {
              if (sub.toLowerCase() === domain.toLowerCase()) return;
              const subId = `sub_${sub}`;
              newEntities.push({
                id: subId,
                type: 'subdomain',
                label: sub,
                properties: { subdomain: sub, parentDomain: domain },
                sources: [{ name: 'crt.sh Certificate Logs', url: `https://crt.sh/?q=%.${domain}`, date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: subId,
                targetId: node.id,
                type: 'subdomain_of',
                label: 'Sous-domaine',
                confidence: 'verified',
                source: 'crt.sh',
              });
            });

            return {
              success: true,
              sourceName: 'crt.sh CT Logs',
              newEntities,
              newEdges,
              propertiesToAdd: { indexedSubdomainsCount: list.length },
            };
          },
        },

        {
          id: 'domain_rdap_whois',
          name_fr: 'Enregistrement WHOIS / RDAP',
          name_en: 'WHOIS / RDAP Registration',
          description_fr: 'Récupère les informations d\'enregistrement du domaine (Bureau d\'enregistrement, dates, statut, contacts).',
          description_en: 'Retrieves domain registration metadata (Registrar, key dates, status, abuse contacts).',
          category: 'infrastructure',
          applicableTypes: ['domain'],
          isAutomated: true,
          execute: async (node) => {
            const domain = node.properties.domain || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/rdap?query=${encodeURIComponent(domain)}&type=domain`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Échec de consultation RDAP');

            const newEntities = [];
            const newEdges = [];

            // Add Registrar if found
            if (data.registrar) {
              const regId = `org_${data.registrar.replace(/[^a-zA-Z0-9]/g, '_')}`;
              newEntities.push({
                id: regId,
                type: 'organization',
                label: data.registrar,
                properties: { name: data.registrar, role: 'Registrar' },
                sources: [{ name: 'ICANN RDAP', url: `https://rdap.org/domain/${domain}`, date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: regId,
                type: 'registered_by',
                label: 'Enregistré via',
                confidence: 'verified',
                source: 'RDAP',
              });
            }

            // Add Contacts
            (data.entities || []).forEach(ent => {
              if (ent.email) {
                const emailId = `email_${ent.email}`;
                newEntities.push({
                  id: emailId,
                  type: 'email',
                  label: ent.email,
                  properties: { email: ent.email, role: ent.role || 'Contact' },
                  sources: [{ name: 'RDAP Contact', url: '', date: new Date().toISOString() }],
                });
                newEdges.push({
                  sourceId: node.id,
                  targetId: emailId,
                  type: 'contact_point',
                  label: ent.role ? `Contact (${ent.role})` : 'Contact',
                  confidence: 'verified',
                  source: 'RDAP',
                });
              }
            });

            return {
              success: true,
              sourceName: 'ICANN RDAP Service',
              newEntities,
              newEdges,
              propertiesToAdd: {
                registrar: data.registrar || '',
                createdDate: data.dates ? (data.dates.registration || '') : '',
                expiresDate: data.dates ? (data.dates.expiration || '') : '',
                status: Array.isArray(data.status) ? data.status.join(', ') : '',
              },
            };
          },
        },

        {
          id: 'domain_http_tech',
          name_fr: 'En-têtes HTTP & Technologies du serveur',
          name_en: 'HTTP Headers & Server Tech Stack',
          description_fr: 'Analyse les en-têtes HTTP du site web, le serveur web (Nginx, Apache, Cloudflare), le titre HTML et les protections.',
          description_en: 'Inspects HTTP response headers, web server signature, HTML title, and security headers.',
          category: 'infrastructure',
          applicableTypes: ['domain', 'url', 'subdomain'],
          isAutomated: true,
          execute: async (node) => {
            const target = node.properties.url || node.properties.domain || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/http-headers?url=${encodeURIComponent(target)}`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Site web inaccessible');

            const newEntities = [];
            const newEdges = [];

            // Create URL entity if not already a URL node
            if (node.type !== 'url' && data.finalUrl) {
              const urlId = `url_${data.finalUrl}`;
              newEntities.push({
                id: urlId,
                type: 'url',
                label: data.finalUrl,
                properties: { url: data.finalUrl, title: data.title, status: data.status },
                sources: [{ name: 'HTTP Web Probe', url: data.finalUrl, date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: urlId,
                type: 'hosted_on',
                label: `HTTP ${data.status}`,
                confidence: 'verified',
                source: 'HTTP Probe',
              });
            }

            return {
              success: true,
              sourceName: 'HTTP Inspector',
              newEntities,
              newEdges,
              propertiesToAdd: {
                httpStatus: data.status,
                webServer: data.server || 'Non divulgué',
                poweredBy: data.poweredBy || '—',
                pageTitle: data.title || '—',
                hsts: data.securityHeaders && data.securityHeaders.hsts ? 'Oui' : 'Non',
              },
            };
          },
        },

        {
          id: 'domain_wayback_archives',
          name_fr: 'Archives temporelles (Wayback Machine)',
          name_en: 'Temporal Archives (Wayback Machine)',
          description_fr: 'Extrait les instantanés historiques indexés par Internet Archive pour retracer les versions passées du site.',
          description_en: 'Extracts historical snapshots indexed by the Wayback Machine.',
          category: 'archive',
          applicableTypes: ['domain', 'url', 'subdomain'],
          isAutomated: true,
          execute: async (node) => {
            const target = node.properties.url || node.properties.domain || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/wayback?url=${encodeURIComponent(target)}`);
            const data = await res.json();
            if (!data.ok || !data.snapshots || data.snapshots.length === 0) {
              return {
                success: true,
                sourceName: 'Wayback Machine',
                newEntities: [],
                newEdges: [],
                propertiesToAdd: { waybackSnapshots: 'Aucune archive disponible' },
              };
            }

            const newEntities = [];
            const newEdges = [];

            data.snapshots.forEach(snap => {
              const snapId = `archive_${snap.timestamp}`;
              newEntities.push({
                id: snapId,
                type: 'document',
                label: `Archive ${snap.timestamp.substring(0, 8)}`,
                properties: {
                  timestamp: snap.timestamp,
                  archiveUrl: snap.archiveUrl,
                  mimeType: snap.mimetype,
                },
                sources: [{ name: 'Wayback Machine Archive', url: snap.archiveUrl, date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: snapId,
                type: 'archived_in',
                label: snap.timestamp.substring(0, 4),
                confidence: 'verified',
                source: 'Wayback Machine',
              });
            });

            return {
              success: true,
              sourceName: 'Internet Archive CDX',
              newEntities,
              newEdges,
              propertiesToAdd: { snapshotsCount: data.snapshots.length },
            };
          },
        },

        // --------------------------------------------------------------------
        // IP TRANSFORMS
        // --------------------------------------------------------------------
        {
          id: 'ip_rdns_ptr',
          name_fr: 'Reverse DNS (PTR Hostnames)',
          name_en: 'Reverse DNS (PTR Hostnames)',
          description_fr: 'Effectue une résolution DNS inversée pour découvrir les noms d\'hôtes associés à cette adresse IP.',
          description_en: 'Performs a reverse DNS resolution to discover hostnames mapped to this IP.',
          category: 'network',
          applicableTypes: ['ip'],
          isAutomated: true,
          execute: async (node) => {
            const ip = node.properties.ip || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/rdns?ip=${encodeURIComponent(ip)}`);
            const data = await res.json();
            if (!data.ok || !data.hostnames || data.hostnames.length === 0) {
              return {
                success: true,
                sourceName: 'Reverse DNS',
                newEntities: [],
                newEdges: [],
                propertiesToAdd: { reverseDns: 'Aucun enregistrement PTR' },
              };
            }

            const newEntities = [];
            const newEdges = [];

            data.hostnames.forEach(host => {
              const hostId = `domain_${host}`;
              newEntities.push({
                id: hostId,
                type: 'domain',
                label: host,
                properties: { domain: host, isReverseDns: true },
                sources: [{ name: 'Reverse DNS PTR', url: '', date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: hostId,
                type: 'resolves_to',
                label: 'Reverse PTR',
                confidence: 'verified',
                source: 'Reverse DNS',
              });
            });

            return {
              success: true,
              sourceName: 'Reverse DNS Resolver',
              newEntities,
              newEdges,
              propertiesToAdd: { ptrHostnames: data.hostnames.join(', ') },
            };
          },
        },

        {
          id: 'ip_rdap_network',
          name_fr: 'Réseau & Attribution IP (RDAP / ASN)',
          name_en: 'IP Network & Ownership (RDAP / ASN)',
          description_fr: 'Identifie le bloc réseau (CIDR), l\'organisation propriétaire et le registre régional (RIPE, ARIN, APNIC).',
          description_en: 'Identifies the network block (CIDR), owning organization, and regional internet registry.',
          category: 'infrastructure',
          applicableTypes: ['ip'],
          isAutomated: true,
          execute: async (node) => {
            const ip = node.properties.ip || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/rdap?query=${encodeURIComponent(ip)}&type=ip`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Erreur consultation RDAP IP');

            const newEntities = [];
            const newEdges = [];

            // Add Org
            const orgName = data.name || (data.network && data.network.asn) || 'Fournisseur d\'Accès / Hébergeur';
            const orgId = `org_${orgName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            newEntities.push({
              id: orgId,
              type: 'organization',
              label: orgName,
              properties: { name: orgName, role: 'Autonomous System / ISP' },
              sources: [{ name: 'Regional RDAP Registry', url: `https://rdap.org/ip/${ip}`, date: new Date().toISOString() }],
            });
            newEdges.push({
              sourceId: node.id,
              targetId: orgId,
              type: 'allocated_to',
              label: 'Appartient à',
              confidence: 'verified',
              source: 'RDAP IP',
            });

            return {
              success: true,
              sourceName: 'RDAP IP Registry',
              newEntities,
              newEdges,
              propertiesToAdd: {
                cidr: data.network && data.network.cidr ? data.network.cidr.join(', ') : '—',
                range: data.network ? `${data.network.start} - ${data.network.end}` : '—',
                handle: data.handle || '',
              },
            };
          },
        },

        // --------------------------------------------------------------------
        // EMAIL TRANSFORMS
        // --------------------------------------------------------------------
        {
          id: 'email_domain_extract',
          name_fr: 'Extraction & Liaison du Domaine',
          name_en: 'Extract & Link Domain',
          description_fr: 'Isole le nom de domaine de l\'adresse e-mail pour l\'intégrer au graphe et explorer son infrastructure.',
          description_en: 'Extracts the domain from the email address to explore its infrastructure.',
          category: 'identity',
          applicableTypes: ['email'],
          isAutomated: true,
          execute: async (node) => {
            const email = node.properties.email || node.label;
            const parts = email.split('@');
            if (parts.length < 2) throw new Error('Adresse e-mail invalide');

            const domain = parts[1].toLowerCase().trim();
            const username = parts[0].trim();

            const domainId = `domain_${domain}`;
            const userId = `user_${username.toLowerCase()}`;

            const newEntities = [
              {
                id: domainId,
                type: 'domain',
                label: domain,
                properties: { domain, isMailDomain: true },
                sources: [{ name: 'Email Decomposition', url: '', date: new Date().toISOString() }],
              },
              {
                id: userId,
                type: 'username',
                label: username,
                properties: { username, emailPrefix: true },
                sources: [{ name: 'Email Decomposition', url: '', date: new Date().toISOString() }],
              },
            ];

            const newEdges = [
              {
                sourceId: node.id,
                targetId: domainId,
                type: 'domain_of',
                label: 'Domaine de messagerie',
                confidence: 'verified',
                source: 'Email Parse',
              },
              {
                sourceId: node.id,
                targetId: userId,
                type: 'mailbox_user',
                label: 'Identifiant boîte mail',
                confidence: 'verified',
                source: 'Email Parse',
              },
            ];

            return {
              success: true,
              sourceName: 'Email Parser',
              newEntities,
              newEdges,
              propertiesToAdd: { parsedDomain: domain, parsedUser: username },
            };
          },
        },

        // --------------------------------------------------------------------
        // USERNAME TRANSFORMS
        // --------------------------------------------------------------------
        {
          id: 'username_profile_recon',
          name_fr: 'Recherche de profils publics (GitHub, GitLab, Reddit)',
          name_en: 'Public Profile Discovery (GitHub, GitLab, Reddit)',
          description_fr: 'Vérifie l\'existence de comptes publics avec ce pseudonyme sur les plateformes de développement et communautaires.',
          description_en: 'Checks for public profile existence on GitHub, GitLab, Reddit, Wikipedia, and Gravatar.',
          category: 'identity',
          applicableTypes: ['username'],
          isAutomated: true,
          execute: async (node) => {
            const username = node.properties.username || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/profile-check?username=${encodeURIComponent(username)}`);
            const data = await res.json();
            if (!data.ok || !data.profiles || data.profiles.length === 0) {
              return {
                success: true,
                sourceName: 'Profile Checker',
                newEntities: [],
                newEdges: [],
                propertiesToAdd: { verifiedProfiles: 'Aucun compte public identifié sur les plateformes testées' },
              };
            }

            const newEntities = [];
            const newEdges = [];

            data.profiles.forEach(prof => {
              const urlId = `url_${prof.profileUrl}`;
              newEntities.push({
                id: urlId,
                type: 'url',
                label: `${prof.platform} (${username})`,
                properties: {
                  url: prof.profileUrl,
                  platform: prof.platform,
                  displayName: prof.name || username,
                  bio: prof.bio || '',
                },
                sources: [{ name: `${prof.platform} Public API`, url: prof.profileUrl, date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: urlId,
                type: 'profile_on',
                label: prof.platform,
                confidence: 'verified',
                source: `${prof.platform} API`,
              });
            });

            return {
              success: true,
              sourceName: 'Public Profile Checker',
              newEntities,
              newEdges,
              propertiesToAdd: { discoveredAccounts: data.profiles.map(p => p.platform).join(', ') },
            };
          },
        },

        // --------------------------------------------------------------------
        // CRYPTO TRANSFORMS
        // --------------------------------------------------------------------
        {
          id: 'crypto_wallet_check',
          name_fr: 'Validation & Explorateur Blockchain',
          name_en: 'Blockchain Format & Explorer Lookup',
          description_fr: 'Identifie la blockchain (Bitcoin, Ethereum, Tron) et crée un lien vers l\'explorateur public correspondant.',
          description_en: 'Identifies the blockchain network and links to the public blockchain explorer.',
          category: 'infrastructure',
          applicableTypes: ['crypto'],
          isAutomated: true,
          execute: async (node) => {
            const addr = node.properties.address || node.label;
            const res = await fetch(`${this.apiBase}/api/transform/crypto?address=${encodeURIComponent(addr)}`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Vérification crypto échouée');

            const newEntities = [];
            const newEdges = [];

            if (data.explorerUrl) {
              const urlId = `url_${data.explorerUrl}`;
              newEntities.push({
                id: urlId,
                type: 'url',
                label: `Explorer ${data.blockchain}`,
                properties: { url: data.explorerUrl, network: data.blockchain },
                sources: [{ name: 'Blockchain Explorer', url: data.explorerUrl, date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: urlId,
                type: 'ledger_explorer',
                label: 'Registre public',
                confidence: 'verified',
                source: 'Blockchain Format Analysis',
              });
            }

            return {
              success: true,
              sourceName: 'Blockchain Format Verifier',
              newEntities,
              newEdges,
              propertiesToAdd: {
                blockchain: data.blockchain,
                isValidFormat: data.isValidFormat ? 'Valide' : 'Inconnu',
              },
            };
          },
        },

        // --------------------------------------------------------------------
        // INTELLIGENCE X TRANSFORMS (When local proxy is operational)
        // --------------------------------------------------------------------
        {
          id: 'intelx_phonebook_search',
          name_fr: 'Intelligence X — Énumération Phonebook (Emails, Sous-domaines)',
          name_en: 'Intelligence X — Phonebook Enumeration (Emails, Subdomains)',
          description_fr: 'Extrait les adresses e-mail d\'employés et sous-domaines indexés par Intelligence X dans les archives publiques.',
          description_en: 'Extracts employee emails and subdomains indexed by Intelligence X in public archives.',
          category: 'breach',
          applicableTypes: ['domain'],
          isAutomated: true,
          execute: async (node) => {
            const domain = node.properties.domain || node.label;
            const res = await fetch(`${this.apiBase}/api/intelx/phonebook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ term: domain, maxresults: 30 }),
            });
            const data = await res.json();
            if (!data.id) throw new Error('Impossible d\'initier la recherche Phonebook IntelX');

            // Fetch progressive results
            const pollRes = await fetch(`${this.apiBase}/api/intelx/result?id=${encodeURIComponent(data.id)}`);
            const resultData = await pollRes.json();
            const selectors = resultData.selectors || [];

            const newEntities = [];
            const newEdges = [];

            selectors.slice(0, 20).forEach(item => {
              const sel = item.selector;
              if (sel.includes('@')) {
                const emailId = `email_${sel.toLowerCase()}`;
                newEntities.push({
                  id: emailId,
                  type: 'email',
                  label: sel,
                  properties: { email: sel, indexedByIntelX: true },
                  sources: [{ name: 'Intelligence X Phonebook', url: 'https://intelx.io', date: new Date().toISOString() }],
                });
                newEdges.push({
                  sourceId: node.id,
                  targetId: emailId,
                  type: 'associated_email',
                  label: 'Email répertorié',
                  confidence: 'verified',
                  source: 'Intelligence X',
                });
              } else if (!sel.startsWith('http')) {
                const subId = `sub_${sel.toLowerCase()}`;
                newEntities.push({
                  id: subId,
                  type: 'subdomain',
                  label: sel,
                  properties: { subdomain: sel, indexedByIntelX: true },
                  sources: [{ name: 'Intelligence X Phonebook', url: 'https://intelx.io', date: new Date().toISOString() }],
                });
                newEdges.push({
                  sourceId: subId,
                  targetId: node.id,
                  type: 'subdomain_of',
                  label: 'Sous-domaine indexé',
                  confidence: 'verified',
                  source: 'Intelligence X',
                });
              }
            });

            return {
              success: true,
              sourceName: 'Intelligence X Phonebook',
              newEntities,
              newEdges,
              propertiesToAdd: { intelxPhonebookMatches: selectors.length },
            };
          },
        },

        {
          id: 'intelx_breach_search',
          name_fr: 'Intelligence X — Recherche de Fuites & Dumps',
          name_en: 'Intelligence X — Leaks & Data Dumps Search',
          description_fr: 'Recherche les occurrences du sélecteur dans les compilations de fuites, pastes et bases compromises.',
          description_en: 'Searches for records in breach compilations, pastes, and darknet archives.',
          category: 'breach',
          applicableTypes: ['email', 'username', 'domain', 'ip'],
          isAutomated: true,
          execute: async (node) => {
            const term = node.properties.email || node.properties.domain || node.properties.ip || node.properties.username || node.label;
            const res = await fetch(`${this.apiBase}/api/intelx/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ term, maxresults: 10 }),
            });
            const data = await res.json();
            if (!data.id) throw new Error('Impossible d\'initier la recherche IntelX');

            const pollRes = await fetch(`${this.apiBase}/api/intelx/result?id=${encodeURIComponent(data.id)}`);
            const resultData = await pollRes.json();
            const records = resultData.records || [];

            const newEntities = [];
            const newEdges = [];

            records.slice(0, 10).forEach(rec => {
              const leakId = `leak_${rec.systemid || Math.random().toString(36).substring(2, 9)}`;
              newEntities.push({
                id: leakId,
                type: 'leak',
                label: rec.name || `Fuite (${rec.bucket || 'Pastes'})`,
                properties: {
                  bucket: rec.bucket,
                  date: rec.date,
                  size: rec.size,
                  storageId: rec.storageid,
                  systemId: rec.systemid,
                },
                sources: [{ name: 'Intelligence X Archive', url: `https://intelx.io/?did=${rec.systemid}`, date: new Date().toISOString() }],
              });
              newEdges.push({
                sourceId: node.id,
                targetId: leakId,
                type: 'found_in_breach',
                label: rec.bucket || 'Compromission',
                confidence: 'verified',
                source: 'Intelligence X',
              });
            });

            return {
              success: true,
              sourceName: 'Intelligence X Archives',
              newEntities,
              newEdges,
              propertiesToAdd: { breachRecordsCount: records.length },
            };
          },
        },
      ];

      return list;
    }

    /**
     * Get list of applicable transforms for an entity type
     */
    getApplicableTransforms(entityType) {
      return this.transforms.filter(t => t.applicableTypes.includes(entityType));
    }

    /**
     * Get catalog tool pivots for manual exploration
     */
    getCatalogPivots(entityType, indicatorValue) {
      const pivots = [];
      const val = encodeURIComponent(indicatorValue || '');

      if (entityType === 'domain') {
        pivots.push(
          { name: 'Shodan (Hôtes & Ports)', url: `https://www.shodan.io/search?query=hostname%3A${val}`, category: 'Infrastructure' },
          { name: 'ViewDNS (Historique & IP)', url: `https://viewdns.info/iphistory/?domain=${val}`, category: 'DNS & Whois' },
          { name: 'URLScan.io (Analyse DOM & Réseau)', url: `https://urlscan.io/search/#${val}`, category: 'CTI & Web' },
          { name: 'SecurityTrails (Historique DNS)', url: `https://securitytrails.com/domain/${val}/dns`, category: 'Infrastructure' },
          { name: 'Censys (Recherche de Certificats)', url: `https://search.censys.io/certificates?q=${val}`, category: 'Certificats' }
        );
      } else if (entityType === 'ip') {
        pivots.push(
          { name: 'Shodan (Scan de Services)', url: `https://www.shodan.io/host/${val}`, category: 'Infrastructure' },
          { name: 'BGPView (ASN & Routage)', url: `https://bgpview.io/ip/${val}`, category: 'Réseau' },
          { name: 'AbuseIPDB (Signalements)', url: `https://www.abuseipdb.com/check/${val}`, category: 'Réputation' },
          { name: 'Censys (Host Inspection)', url: `https://search.censys.io/hosts/${val}`, category: 'Infrastructure' },
          { name: 'VirusTotal (Analyse IP)', url: `https://www.virustotal.com/gui/ip-address/${val}`, category: 'CTI' }
        );
      } else if (entityType === 'email') {
        pivots.push(
          { name: 'Epieos (Profils Google / Skype)', url: `https://epieos.com/?q=${val}`, category: 'Identité' },
          { name: 'HaveIBeenPwned (Fuites)', url: `https://haveibeenpwned.com/account/${val}`, category: 'Breaches' },
          { name: 'DeHashed (Dumps)', url: `https://dehashed.com/search?query=${val}`, category: 'Dumps' },
          { name: 'Hunter.io (Format entreprise)', url: `https://hunter.io/try/search/${val}`, category: 'Business' }
        );
      } else if (entityType === 'username') {
        pivots.push(
          { name: 'WhatsMyName (Recon 500+ sites)', url: `https://whatsmyname.app/?q=${val}`, category: 'Réseaux Sociaux' },
          { name: 'Namechk (Disponibilité profils)', url: `https://namechk.com/`, category: 'Identité' },
          { name: 'Sherlock Project (CLI)', url: `https://github.com/sherlock-project/sherlock`, category: 'Outils GitHub' },
          { name: 'Blackbird OSINT', url: `https://github.com/p1ngul1n0/blackbird`, category: 'Outils GitHub' }
        );
      } else if (entityType === 'image') {
        pivots.push(
          { name: 'Google Lens (Recherche visuelle)', url: `https://lens.google.com/`, category: 'Image Reverse' },
          { name: 'Yandex Images (Reconnaissance visage & lieux)', url: `https://yandex.com/images/`, category: 'Image Reverse' },
          { name: 'Bing Visual Search', url: `https://www.bing.com/visualsearch`, category: 'Image Reverse' },
          { name: 'TinEye (Suivi d\'antériorité web)', url: `https://tineye.com/`, category: 'Image Reverse' }
        );
      } else if (entityType === 'crypto') {
        pivots.push(
          { name: 'Blockchain.com Explorer', url: `https://www.blockchain.com/explorer/search?search=${val}`, category: 'Blockchain' },
          { name: 'Breadcrumbs.app (Graphing Crypto)', url: `https://www.breadcrumbs.app/`, category: 'Analyse de liens' },
          { name: 'Bitquery (Transactions)', url: `https://explorer.bitquery.io/`, category: 'Blockchain' }
        );
      }

      return pivots;
    }

    /**
     * Parse uploaded image file and create an Image Entity with EXIF & Hash
     */
    async processImageFile(file) {
      if (!file) throw new Error('Aucun fichier image fourni');

      const arrayBuffer = await file.arrayBuffer();
      const sha256 = await computeBufferSha256(arrayBuffer);
      const exif = parseExifFromBuffer(arrayBuffer);

      // Create preview data URL
      let previewUrl = '';
      try {
        previewUrl = URL.createObjectURL(file);
      } catch { /* ignore */ }

      const properties = {
        fileName: file.name,
        fileSize: `${Math.round(file.size / 1024)} KB`,
        mimeType: file.type || 'image/jpeg',
        sha256: sha256 || '—',
        hasExif: exif.hasExif ? 'Oui' : 'Non',
        cameraMake: exif.make || '—',
        cameraModel: exif.model || '—',
        captureDate: exif.dateTime || '—',
        software: exif.software || '—',
      };

      const entity = {
        id: `img_${sha256 ? sha256.substring(0, 16) : Date.now()}`,
        type: 'image',
        label: file.name,
        properties,
        previewUrl,
        sources: [{ name: 'Fichier Image Local', url: '', date: new Date().toISOString() }],
      };

      return { entity, exif, sha256 };
    }
  }

  return {
    ENTITY_TYPES,
    TransformsRegistry,
    computeBufferSha256,
    parseExifFromBuffer,
  };
});
