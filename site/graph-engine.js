/**
 * AAA_OSINT — Visual Graph Engine (Maltego-Inspired Force-Directed Canvas)
 *
 * High-performance, zero-dependency HTML5 Canvas graph visualizer:
 * - 60 FPS Physics simulation (Coulomb repulsion, Hooke springs, collision buffer anti-overlap)
 * - Multiple layout modes: Force-Directed, Hierarchical, Radial, Grid
 * - Smooth Camera navigation: Zoom, Pan, Drag-to-move, Fit-to-screen
 * - High-DPI Retina sharpness
 * - Rich Cyber Visuals: Distinct halos, entity icons, solid verified edges, dashed candidate edges
 * - Multi-selection, Pinning, Hiding, Hover isolation
 * - High-resolution PNG, CSV & JSON Export / Import
 *
 * Zero external npm dependencies. Follows AAA_OSINT IIFE pattern.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GraphEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class GraphEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.options = Object.assign({
        theme: 'cyber',
        backgroundColor: '#06080d',
        nodeRadius: 26,
        springLength: 120,
        springStrength: 0.05,
        repulsionStrength: 1800,
        collisionPadding: 32,
        damping: 0.88,
        minAlpha: 0.001,
        onNodeSelect: () => {},
        onNodeContextMenu: () => {},
        onCanvasClick: () => {},
      }, options);

      // Graph Data Model
      this.nodes = new Map(); // id -> node object
      this.edges = [];        // array of edge objects

      // Camera State
      this.camera = {
        x: 0,
        y: 0,
        zoom: 1.0,
        minZoom: 0.15,
        maxZoom: 3.5,
      };

      // Physics State
      this.isPhysicsActive = true;
      this.alpha = 1.0;
      this.animationFrameId = null;

      // Interaction State
      this.hoveredNode = null;
      this.selectedNodeIds = new Set();
      this.draggedNode = null;
      this.isPanning = false;
      this.panStartX = 0;
      this.panStartY = 0;
      this.mousePos = { x: 0, y: 0 };

      // Marquee selection
      this.isBoxSelecting = false;
      this.boxStart = { x: 0, y: 0 };
      this.boxCurrent = { x: 0, y: 0 };

      // Bind events
      this.initEvents();
      this.resize();
      this.startLoop();
    }

    // ------------------------------------------------------------------------
    // Canvas & Sizing
    // ------------------------------------------------------------------------
    resize() {
      if (!this.canvas) return;
      const rect = (this.canvas.getBoundingClientRect && this.canvas.getBoundingClientRect()) || { width: 800, height: 600 };
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

      this.width = rect.width || 800;
      this.height = rect.height || 600;

      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);

      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);

      // Re-center camera if initial
      if (this.camera.x === 0 && this.camera.y === 0) {
        this.camera.x = this.width / 2;
        this.camera.y = this.height / 2;
      }

      this.requestRender();
    }

    // ------------------------------------------------------------------------
    // Data Model Manipulation
    // ------------------------------------------------------------------------
    addNode(nodeData) {
      if (!nodeData || !nodeData.id) return null;
      const existing = this.nodes.get(nodeData.id);

      if (existing) {
        // Merge properties and sources
        existing.properties = Object.assign({}, existing.properties, nodeData.properties);
        if (Array.isArray(nodeData.sources)) {
          existing.sources = (existing.sources || []).concat(nodeData.sources);
        }
        if (nodeData.label) existing.label = nodeData.label;
        return existing;
      }

      // Initial placement: near center or with slight jitter
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 80;

      const node = {
        id: nodeData.id,
        type: nodeData.type || 'domain',
        label: String(nodeData.label || nodeData.id),
        properties: nodeData.properties || {},
        sources: nodeData.sources || [],
        confidence: nodeData.confidence || 'verified',
        icon: nodeData.icon || this.getIconForType(nodeData.type),
        color: nodeData.color || this.getColorForType(nodeData.type),
        x: typeof nodeData.x === 'number' ? nodeData.x : Math.cos(angle) * radius,
        y: typeof nodeData.y === 'number' ? nodeData.y : Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        radius: nodeData.radius || this.options.nodeRadius,
        pinned: !!nodeData.pinned,
        hidden: !!nodeData.hidden,
        createdAt: nodeData.createdAt || new Date().toISOString(),
      };

      this.nodes.set(node.id, node);
      this.wakePhysics();
      return node;
    }

    addEdge(edgeData) {
      if (!edgeData || !edgeData.sourceId || !edgeData.targetId) return null;
      if (edgeData.sourceId === edgeData.targetId) return null; // Avoid self loops

      // Check if duplicate exists
      const existing = this.edges.find(
        e => (e.sourceId === edgeData.sourceId && e.targetId === edgeData.targetId && e.type === edgeData.type)
      );
      if (existing) return existing;

      const edge = {
        id: edgeData.id || `edge_${edgeData.sourceId}_${edgeData.targetId}_${edgeData.type || 'rel'}`,
        sourceId: edgeData.sourceId,
        targetId: edgeData.targetId,
        type: edgeData.type || 'related_to',
        label: edgeData.label || '',
        confidence: edgeData.confidence === 'candidate' ? 'candidate' : 'verified',
        source: edgeData.source || 'Automated Transform',
        timestamp: edgeData.timestamp || new Date().toISOString(),
      };

      this.edges.push(edge);
      this.wakePhysics();
      return edge;
    }

    removeNode(nodeId) {
      this.nodes.delete(nodeId);
      this.selectedNodeIds.delete(nodeId);
      this.edges = this.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);
      this.wakePhysics();
    }

    clear() {
      this.nodes.clear();
      this.edges = [];
      this.selectedNodeIds.clear();
      this.hoveredNode = null;
      this.draggedNode = null;
      this.camera.x = this.width / 2;
      this.camera.y = this.height / 2;
      this.camera.zoom = 1.0;
      this.requestRender();
    }

    getNode(nodeId) {
      return this.nodes.get(nodeId);
    }

    getAllNodes() {
      return Array.from(this.nodes.values());
    }

    getAllEdges() {
      return this.edges.slice();
    }

    getNeighbors(nodeId) {
      const neighbors = new Set();
      this.edges.forEach(e => {
        if (e.sourceId === nodeId) neighbors.add(e.targetId);
        if (e.targetId === nodeId) neighbors.add(e.sourceId);
      });
      return Array.from(neighbors).map(id => this.nodes.get(id)).filter(Boolean);
    }

    getConnectedEdges(nodeId) {
      return this.edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId);
    }

    // ------------------------------------------------------------------------
    // Visual Helpers
    // ------------------------------------------------------------------------
    getIconForType(type) {
      const icons = {
        domain: '🌐',
        subdomain: '🕸️',
        ip: '🖥️',
        email: '📧',
        username: '👤',
        person: '🧑',
        organization: '🏢',
        url: '🔗',
        phone: '📱',
        image: '🖼️',
        document: '📄',
        crypto: '🪙',
        hash: '🔑',
        leak: '🕳️',
        source: '📚',
      };
      return icons[type] || '📍';
    }

    getColorForType(type) {
      const colors = {
        domain: '#00e5ff',
        subdomain: '#38bdf8',
        ip: '#00e676',
        email: '#ffb74d',
        username: '#b388ff',
        person: '#e040fb',
        organization: '#448aff',
        url: '#26c6da',
        phone: '#69f0ae',
        image: '#ff4081',
        document: '#ffd54f',
        crypto: '#ffd700',
        hash: '#90a4ae',
        leak: '#ff5252',
        source: '#7c4dff',
      };
      return colors[type] || '#00e5ff';
    }

    // ------------------------------------------------------------------------
    // Physics Simulation (Force-Directed)
    // ------------------------------------------------------------------------
    wakePhysics(energy = 1.0) {
      this.alpha = Math.max(this.alpha, energy);
      this.isPhysicsActive = true;
      if (!this.animationFrameId) {
        this.startLoop();
      }
    }

    stepPhysics() {
      if (!this.isPhysicsActive || this.alpha < this.options.minAlpha) {
        this.isPhysicsActive = false;
        return;
      }

      const nodes = Array.from(this.nodes.values()).filter(n => !n.hidden);
      const nodeCount = nodes.length;
      if (nodeCount <= 1) return;

      const repulsion = this.options.repulsionStrength * this.alpha;
      const springStrength = this.options.springStrength * this.alpha;
      const springLength = this.options.springLength;
      const collisionBuffer = this.options.collisionPadding;

      // 1. Repulsion between all node pairs + Hard Collision Avoidance
      for (let i = 0; i < nodeCount; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodeCount; j++) {
          const n2 = nodes[j];
          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let distSq = dx * dx + dy * dy;
          let dist = Math.sqrt(distSq);

          if (dist === 0) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            dist = 1;
            distSq = 1;
          }

          // Force repulsion (Coulomb)
          const force = repulsion / Math.max(distSq, 100);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!n1.pinned && n1 !== this.draggedNode) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (!n2.pinned && n2 !== this.draggedNode) {
            n2.vx += fx;
            n2.vy += fy;
          }

          // Anti-overlap collision buffer
          const minDist = n1.radius + n2.radius + collisionBuffer;
          if (dist < minDist) {
            const overlap = (minDist - dist) * 0.5;
            const pushX = (dx / dist) * overlap;
            const pushY = (dy / dist) * overlap;
            if (!n1.pinned && n1 !== this.draggedNode) {
              n1.x -= pushX;
              n1.y -= pushY;
            }
            if (!n2.pinned && n2 !== this.draggedNode) {
              n2.x += pushX;
              n2.y += pushY;
            }
          }
        }
      }

      // 2. Spring Attraction along Edges
      for (const edge of this.edges) {
        const source = this.nodes.get(edge.sourceId);
        const target = this.nodes.get(edge.targetId);
        if (!source || !target || source.hidden || target.hidden) continue;

        let dx = target.x - source.x;
        let dy = target.y - source.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const displacement = dist - springLength;
        const force = displacement * springStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!source.pinned && source !== this.draggedNode) {
          source.vx += fx;
          source.vy += fy;
        }
        if (!target.pinned && target !== this.draggedNode) {
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      // 3. Center Gravity & Integration with Damping
      const centerGravity = 0.008 * this.alpha;
      for (const node of nodes) {
        if (node.pinned || node === this.draggedNode) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        // Pull toward center
        node.vx -= node.x * centerGravity;
        node.vy -= node.y * centerGravity;

        // Apply velocity with damping
        node.vx *= this.options.damping;
        node.vy *= this.options.damping;

        node.x += node.vx;
        node.y += node.vy;
      }

      // Cool down simulation
      this.alpha *= 0.985;
    }

    // ------------------------------------------------------------------------
    // Alternate Layout Modes
    // ------------------------------------------------------------------------
    applyLayout(mode = 'force') {
      const nodes = Array.from(this.nodes.values()).filter(n => !n.hidden);
      if (nodes.length === 0) return;

      if (mode === 'radial') {
        // Place first node at center, others around concentric circles
        const root = nodes[0];
        root.x = 0;
        root.y = 0;
        const others = nodes.slice(1);
        const count = others.length;
        const radius = Math.max(160, count * 22);

        others.forEach((node, i) => {
          const angle = (i / count) * Math.PI * 2;
          node.x = Math.cos(angle) * radius;
          node.y = Math.sin(angle) * radius;
          node.vx = 0;
          node.vy = 0;
        });
      } else if (mode === 'hierarchical') {
        // Simple tree layout: root at top, children below
        const layers = new Map();
        const visited = new Set();
        const root = nodes[0];

        const assignLayer = (nodeId, depth) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          if (!layers.has(depth)) layers.set(depth, []);
          layers.get(depth).push(nodeId);

          const outgoing = this.edges.filter(e => e.sourceId === nodeId).map(e => e.targetId);
          outgoing.forEach(targetId => assignLayer(targetId, depth + 1));
        };

        assignLayer(root.id, 0);

        // Add unconnected nodes to bottom layer
        nodes.forEach(n => {
          if (!visited.has(n.id)) {
            const lastDepth = layers.size;
            if (!layers.has(lastDepth)) layers.set(lastDepth, []);
            layers.get(lastDepth).push(n.id);
          }
        });

        const layerHeight = 120;
        layers.forEach((nodeIds, depth) => {
          const count = nodeIds.length;
          const totalWidth = Math.max(300, count * 140);
          nodeIds.forEach((id, idx) => {
            const node = this.nodes.get(id);
            if (node) {
              node.x = (idx - (count - 1) / 2) * (totalWidth / count);
              node.y = (depth - (layers.size - 1) / 2) * layerHeight;
              node.vx = 0;
              node.vy = 0;
            }
          });
        });
      } else if (mode === 'grid') {
        // Matrix grid layout
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const spacing = 140;
        nodes.forEach((node, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          node.x = (col - (cols - 1) / 2) * spacing;
          node.y = (row - (Math.ceil(nodes.length / cols) - 1) / 2) * spacing;
          node.vx = 0;
          node.vy = 0;
        });
      } else {
        // Randomize slightly and re-run force
        nodes.forEach(n => {
          n.x += (Math.random() - 0.5) * 40;
          n.y += (Math.random() - 0.5) * 40;
        });
        this.wakePhysics(1.0);
      }

      this.fitView();
    }

    // ------------------------------------------------------------------------
    // Rendering Loop
    // ------------------------------------------------------------------------
    startLoop() {
      const raf = (typeof requestAnimationFrame === 'function')
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 16);

      const loop = () => {
        this.stepPhysics();
        this.render();
        if (this.isPhysicsActive) {
          this.animationFrameId = raf(loop);
        } else {
          this.animationFrameId = null;
        }
      };
      this.animationFrameId = raf(loop);
    }

    requestRender() {
      if (!this.animationFrameId) {
        this.render();
      }
    }

    render() {
      const ctx = this.ctx;
      if (!ctx) return;

      const width = this.width;
      const height = this.height;

      // Clear Canvas
      ctx.fillStyle = this.options.backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Draw Background Grid (Subtle cyber grid)
      this.renderBackgroundGrid();

      ctx.save();
      // Apply Camera Transform
      ctx.translate(this.camera.x, this.camera.y);
      ctx.scale(this.camera.zoom, this.camera.zoom);

      // 1. Draw Edges
      this.renderEdges();

      // 2. Draw Nodes
      this.renderNodes();

      ctx.restore();

      // 3. Draw Marquee Selection Overlay if dragging selection
      if (this.isBoxSelecting) {
        this.renderMarqueeBox();
      }
    }

    renderBackgroundGrid() {
      const ctx = this.ctx;
      const zoom = this.camera.zoom;
      const gridSize = 40 * zoom;

      if (gridSize < 12) return; // Don't draw if too dense

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.035)';
      ctx.lineWidth = 1;

      const offsetX = this.camera.x % gridSize;
      const offsetY = this.camera.y % gridSize;

      ctx.beginPath();
      for (let x = offsetX; x < this.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
      }
      for (let y = offsetY; y < this.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    renderEdges() {
      const ctx = this.ctx;
      const isFocusActive = this.hoveredNode || this.selectedNodeIds.size > 0;

      for (const edge of this.edges) {
        const source = this.nodes.get(edge.sourceId);
        const target = this.nodes.get(edge.targetId);
        if (!source || !target || source.hidden || target.hidden) continue;

        const isHighlighted = (
          (this.hoveredNode && (edge.sourceId === this.hoveredNode.id || edge.targetId === this.hoveredNode.id)) ||
          (this.selectedNodeIds.has(edge.sourceId) || this.selectedNodeIds.has(edge.targetId))
        );

        ctx.save();
        ctx.lineWidth = isHighlighted ? 2.5 : 1.4;

        if (edge.confidence === 'candidate') {
          // Candidate relation: dashed amber line
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = isHighlighted ? '#ffb86c' : 'rgba(255, 184, 108, 0.45)';
        } else {
          // Verified relation: solid cyan/neon line
          ctx.setLineDash([]);
          ctx.strokeStyle = isHighlighted ? '#00e5ff' : (isFocusActive ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 229, 255, 0.45)');
        }

        // Draw Line with arrow
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();

        // Edge label (drawn at midpoint)
        if (edge.label && this.camera.zoom > 0.5) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          ctx.font = '9px "JetBrains Mono", monospace';
          const labelWidth = ctx.measureText(edge.label).width;

          ctx.fillStyle = 'rgba(6, 8, 13, 0.85)';
          ctx.fillRect(midX - labelWidth / 2 - 3, midY - 6, labelWidth + 6, 12);

          ctx.fillStyle = edge.confidence === 'candidate' ? '#ffb86c' : '#8be9fd';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.label, midX, midY);
        }

        ctx.restore();
      }
    }

    renderNodes() {
      const ctx = this.ctx;
      const isFocusActive = this.hoveredNode || this.selectedNodeIds.size > 0;

      for (const node of this.nodes.values()) {
        if (node.hidden) continue;

        const isSelected = this.selectedNodeIds.has(node.id);
        const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;
        const isConnected = isFocusActive && (
          isHovered || isSelected ||
          this.edges.some(e =>
            (e.sourceId === node.id && (this.selectedNodeIds.has(e.targetId) || (this.hoveredNode && e.targetId === this.hoveredNode.id))) ||
            (e.targetId === node.id && (this.selectedNodeIds.has(e.sourceId) || (this.hoveredNode && e.sourceId === this.hoveredNode.id)))
          )
        );

        const nodeOpacity = isFocusActive && !isConnected ? 0.25 : 1.0;

        ctx.save();
        ctx.globalAlpha = nodeOpacity;

        // 1. Halo / Glow ring on Hover or Select
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.22)' : 'rgba(255, 255, 255, 0.15)';
          ctx.fill();

          ctx.lineWidth = 2;
          ctx.strokeStyle = isSelected ? '#00e5ff' : '#ffffff';
          ctx.stroke();
        }

        // 2. Main Node Circle Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = node.color;
        ctx.stroke();

        // 3. Icon
        ctx.font = `${Math.floor(node.radius * 0.9)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon, node.x, node.y);

        // 4. Pin indicator if pinned
        if (node.pinned) {
          ctx.beginPath();
          ctx.arc(node.x + node.radius - 4, node.y - node.radius + 4, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffb86c';
          ctx.fill();
        }

        // 5. Node Label (Text below node)
        if (this.camera.zoom > 0.35) {
          ctx.font = '11px "JetBrains Mono", Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const truncated = node.label.length > 24 ? node.label.substring(0, 22) + '…' : node.label;
          const textWidth = ctx.measureText(truncated).width;

          ctx.fillStyle = 'rgba(6, 8, 13, 0.85)';
          ctx.fillRect(node.x - textWidth / 2 - 4, node.y + node.radius + 4, textWidth + 8, 15);

          ctx.fillStyle = isSelected ? '#00e5ff' : '#f8fafc';
          ctx.fillText(truncated, node.x, node.y + node.radius + 5);

          // Subtitle / Type badge if zoomed in
          if (this.camera.zoom > 0.7) {
            ctx.font = '9px "JetBrains Mono", sans-serif';
            ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
            ctx.fillText(node.type.toUpperCase(), node.x, node.y + node.radius + 20);
          }
        }

        ctx.restore();
      }
    }

    renderMarqueeBox() {
      const ctx = this.ctx;
      const x = Math.min(this.boxStart.x, this.boxCurrent.x);
      const y = Math.min(this.boxStart.y, this.boxCurrent.y);
      const w = Math.abs(this.boxStart.x - this.boxCurrent.x);
      const h = Math.abs(this.boxStart.y - this.boxCurrent.y);

      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // Screen <-> Graph Coordinate Conversions
    // ------------------------------------------------------------------------
    screenToGraph(screenX, screenY) {
      return {
        x: (screenX - this.camera.x) / this.camera.zoom,
        y: (screenY - this.camera.y) / this.camera.zoom,
      };
    }

    graphToScreen(graphX, graphY) {
      return {
        x: (graphX * this.camera.zoom) + this.camera.x,
        y: (graphY * this.camera.zoom) + this.camera.y,
      };
    }

    findNodeAt(screenX, screenY) {
      const pt = this.screenToGraph(screenX, screenY);
      const nodes = Array.from(this.nodes.values()).filter(n => !n.hidden);

      // Search top-to-bottom
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = node.x - pt.x;
        const dy = node.y - pt.y;
        if ((dx * dx + dy * dy) <= (node.radius * node.radius)) {
          return node;
        }
      }
      return null;
    }

    // ------------------------------------------------------------------------
    // Camera Controls
    // ------------------------------------------------------------------------
    fitView(padding = 60) {
      const nodes = Array.from(this.nodes.values()).filter(n => !n.hidden);
      if (nodes.length === 0) {
        this.camera.x = this.width / 2;
        this.camera.y = this.height / 2;
        this.camera.zoom = 1.0;
        this.requestRender();
        return;
      }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        minX = Math.min(minX, n.x - n.radius);
        maxX = Math.max(maxX, n.x + n.radius);
        minY = Math.min(minY, n.y - n.radius);
        maxY = Math.max(maxY, n.y + n.radius);
      });

      const bboxWidth = Math.max(maxX - minX, 100);
      const bboxHeight = Math.max(maxY - minY, 100);

      const availableW = this.width - padding * 2;
      const availableH = this.height - padding * 2;

      const zoom = Math.min(
        availableW / bboxWidth,
        availableH / bboxHeight,
        1.5
      );
      this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, zoom));

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      this.camera.x = this.width / 2 - (centerX * this.camera.zoom);
      this.camera.y = this.height / 2 - (centerY * this.camera.zoom);

      this.requestRender();
    }

    zoomIn(factor = 1.25) {
      this.setZoom(this.camera.zoom * factor, this.width / 2, this.height / 2);
    }

    zoomOut(factor = 1.25) {
      this.setZoom(this.camera.zoom / factor, this.width / 2, this.height / 2);
    }

    setZoom(newZoom, anchorX, anchorY) {
      const clamped = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, newZoom));
      if (clamped === this.camera.zoom) return;

      const graphAnchor = this.screenToGraph(anchorX, anchorY);
      this.camera.zoom = clamped;
      this.camera.x = anchorX - graphAnchor.x * this.camera.zoom;
      this.camera.y = anchorY - graphAnchor.y * this.camera.zoom;

      this.requestRender();
    }

    // ------------------------------------------------------------------------
    // User Interactions & Event Handling
    // ------------------------------------------------------------------------
    initEvents() {
      const canvas = this.canvas;
      if (!canvas) return;

      // Mouse Move
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        this.mousePos = { x: sx, y: sy };

        if (this.draggedNode) {
          // Drag node
          const pt = this.screenToGraph(sx, sy);
          this.draggedNode.x = pt.x;
          this.draggedNode.y = pt.y;
          this.draggedNode.vx = 0;
          this.draggedNode.vy = 0;
          this.wakePhysics(0.3);
          return;
        }

        if (this.isPanning) {
          // Pan camera
          this.camera.x += sx - this.panStartX;
          this.camera.y += sy - this.panStartY;
          this.panStartX = sx;
          this.panStartY = sy;
          this.requestRender();
          return;
        }

        if (this.isBoxSelecting) {
          this.boxCurrent = { x: sx, y: sy };
          this.requestRender();
          return;
        }

        // Hover test
        const hit = this.findNodeAt(sx, sy);
        if (hit !== this.hoveredNode) {
          this.hoveredNode = hit;
          canvas.style.cursor = hit ? 'pointer' : 'default';
          this.requestRender();
        }
      });

      // Mouse Down
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (e.button === 2) {
          // Right-click context menu
          const hit = this.findNodeAt(sx, sy);
          if (hit) {
            this.selectNode(hit.id, false);
            this.options.onNodeContextMenu(hit, e);
          }
          return;
        }

        if (e.button === 0) {
          const hit = this.findNodeAt(sx, sy);

          if (e.shiftKey) {
            // Shift + click or marquee selection
            if (hit) {
              if (this.selectedNodeIds.has(hit.id)) {
                this.selectedNodeIds.delete(hit.id);
              } else {
                this.selectedNodeIds.add(hit.id);
              }
              this.options.onNodeSelect(hit, this.selectedNodeIds);
              this.requestRender();
            } else {
              this.isBoxSelecting = true;
              this.boxStart = { x: sx, y: sy };
              this.boxCurrent = { x: sx, y: sy };
            }
            return;
          }

          if (hit) {
            this.draggedNode = hit;
            this.selectNode(hit.id, false);
            this.options.onNodeSelect(hit, this.selectedNodeIds);
          } else {
            // Click on empty space: start pan
            this.isPanning = true;
            this.panStartX = sx;
            this.panStartY = sy;
            this.selectedNodeIds.clear();
            this.options.onCanvasClick();
            this.requestRender();
          }
        }
      });

      // Mouse Up
      if (typeof window !== 'undefined') {
        window.addEventListener('mouseup', () => {
          if (this.draggedNode) {
            this.draggedNode = null;
          }
          if (this.isPanning) {
            this.isPanning = false;
          }
          if (this.isBoxSelecting) {
            this.applyBoxSelection();
            this.isBoxSelecting = false;
            this.requestRender();
          }
        });
      }

      // Wheel Zoom
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { left: 0, top: 0 };
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.setZoom(this.camera.zoom * factor, sx, sy);
      }, { passive: false });

      // Context menu prevent default on canvas
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      // Keyboard navigation
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
          // If typing in input, ignore
          if (typeof document !== 'undefined' && ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

          if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            this.togglePhysics();
          } else if (e.key === '+' || e.key === '=') {
            this.zoomIn();
          } else if (e.key === '-' || e.key === '_') {
            this.zoomOut();
          } else if (e.key === '0') {
            this.fitView();
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelected();
          }
        });

        // Window resize observer
        window.addEventListener('resize', () => this.resize());
      }
    }

    selectNode(nodeId, multi = false) {
      if (!multi) this.selectedNodeIds.clear();
      this.selectedNodeIds.add(nodeId);
      this.requestRender();
    }

    applyBoxSelection() {
      const p1 = this.screenToGraph(Math.min(this.boxStart.x, this.boxCurrent.x), Math.min(this.boxStart.y, this.boxCurrent.y));
      const p2 = this.screenToGraph(Math.max(this.boxStart.x, this.boxCurrent.x), Math.max(this.boxStart.y, this.boxCurrent.y));

      this.nodes.forEach(node => {
        if (!node.hidden && node.x >= p1.x && node.x <= p2.x && node.y >= p1.y && node.y <= p2.y) {
          this.selectedNodeIds.add(node.id);
        }
      });
    }

    togglePhysics() {
      this.isPhysicsActive = !this.isPhysicsActive;
      if (this.isPhysicsActive) {
        this.wakePhysics(0.5);
      }
    }

    deleteSelected() {
      this.selectedNodeIds.forEach(id => this.removeNode(id));
      this.selectedNodeIds.clear();
      this.requestRender();
    }

    // ------------------------------------------------------------------------
    // Export Functions (JSON, PNG, CSV)
    // ------------------------------------------------------------------------
    exportJSON() {
      const data = {
        version: '2.2.0',
        exportedAt: new Date().toISOString(),
        camera: {
          x: this.camera.x,
          y: this.camera.y,
          zoom: this.camera.zoom,
        },
        nodes: Array.from(this.nodes.values()).map(n => ({
          id: n.id,
          type: n.type,
          label: n.label,
          properties: n.properties,
          sources: n.sources,
          confidence: n.confidence,
          x: Math.round(n.x),
          y: Math.round(n.y),
          pinned: n.pinned,
          hidden: n.hidden,
        })),
        edges: this.edges.map(e => ({
          id: e.id,
          sourceId: e.sourceId,
          targetId: e.targetId,
          type: e.type,
          label: e.label,
          confidence: e.confidence,
          source: e.source,
        })),
      };
      return JSON.stringify(data, null, 2);
    }

    importJSON(rawJSON) {
      const data = typeof rawJSON === 'string' ? JSON.parse(rawJSON) : rawJSON;
      this.clear();

      if (Array.isArray(data.nodes)) {
        data.nodes.forEach(n => this.addNode(n));
      }
      if (Array.isArray(data.edges)) {
        data.edges.forEach(e => this.addEdge(e));
      }

      if (data.camera) {
        this.camera.x = data.camera.x || this.width / 2;
        this.camera.y = data.camera.y || this.height / 2;
        this.camera.zoom = data.camera.zoom || 1.0;
      } else {
        this.fitView();
      }

      this.wakePhysics(0.4);
    }

    exportPNG() {
      // Create high-res offscreen canvas
      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d');

      const width = Math.max(1920, this.width * 2);
      const height = Math.max(1080, this.height * 2);
      offCanvas.width = width;
      offCanvas.height = height;

      // Dark background
      offCtx.fillStyle = '#06080d';
      offCtx.fillRect(0, 0, width, height);

      // Watermark title
      offCtx.font = 'bold 24px "JetBrains Mono", sans-serif';
      offCtx.fillStyle = '#00e5ff';
      offCtx.fillText('AAA_OSINT Visual Investigation Graph', 40, 50);

      offCtx.font = '14px "JetBrains Mono", sans-serif';
      offCtx.fillStyle = '#64748b';
      offCtx.fillText(`Exporté le ${new Date().toLocaleString()} · ${this.nodes.size} entités · ${this.edges.length} liens`, 40, 80);

      // Compute bounding box
      const nodes = Array.from(this.nodes.values()).filter(n => !n.hidden);
      if (nodes.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
          minX = Math.min(minX, n.x - n.radius);
          maxX = Math.max(maxX, n.x + n.radius);
          minY = Math.min(minY, n.y - n.radius);
          maxY = Math.max(maxY, n.y + n.radius);
        });

        const bboxW = Math.max(maxX - minX, 100);
        const bboxH = Math.max(maxY - minY, 100);
        const padding = 120;
        const zoom = Math.min((width - padding * 2) / bboxW, (height - padding * 2 - 100) / bboxH, 2.0);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        offCtx.save();
        offCtx.translate(width / 2 - (centerX * zoom), height / 2 - (centerY * zoom) + 40);
        offCtx.scale(zoom, zoom);

        // Draw edges
        for (const edge of this.edges) {
          const s = this.nodes.get(edge.sourceId);
          const t = this.nodes.get(edge.targetId);
          if (!s || !t) continue;
          offCtx.lineWidth = 2;
          if (edge.confidence === 'candidate') {
            offCtx.setLineDash([5, 5]);
            offCtx.strokeStyle = '#ffb86c';
          } else {
            offCtx.setLineDash([]);
            offCtx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
          }
          offCtx.beginPath();
          offCtx.moveTo(s.x, s.y);
          offCtx.lineTo(t.x, t.y);
          offCtx.stroke();
        }

        // Draw nodes
        for (const n of nodes) {
          offCtx.beginPath();
          offCtx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          offCtx.fillStyle = '#0f172a';
          offCtx.fill();
          offCtx.lineWidth = 3;
          offCtx.strokeStyle = n.color;
          offCtx.stroke();

          offCtx.font = `${Math.floor(n.radius * 0.9)}px sans-serif`;
          offCtx.textAlign = 'center';
          offCtx.textBaseline = 'middle';
          offCtx.fillText(n.icon, n.x, n.y);

          offCtx.font = '12px "JetBrains Mono", sans-serif';
          offCtx.fillStyle = '#f8fafc';
          offCtx.textBaseline = 'top';
          offCtx.fillText(n.label, n.x, n.y + n.radius + 6);
        }

        offCtx.restore();
      }

      const dataUrl = offCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `aaa_osint_graph_${Date.now()}.png`;
      a.click();
    }

    exportCSV() {
      const nodes = Array.from(this.nodes.values());
      let csv = 'ID,Type,Label,Confidence,Created,Properties\n';
      nodes.forEach(n => {
        const props = Object.entries(n.properties || {})
          .map(([k, v]) => `${k}:${v}`)
          .join('; ')
          .replace(/"/g, '""');
        csv += `"${n.id}","${n.type}","${n.label.replace(/"/g, '""')}","${n.confidence}","${n.createdAt}","${props}"\n`;
      });

      csv += '\nSource_ID,Target_ID,Relation_Type,Confidence,Source_Provenance\n';
      this.edges.forEach(e => {
        csv += `"${e.sourceId}","${e.targetId}","${e.type}","${e.confidence}","${(e.source || '').replace(/"/g, '""')}"\n`;
      });

      return csv;
    }
  }

  return GraphEngine;
});
