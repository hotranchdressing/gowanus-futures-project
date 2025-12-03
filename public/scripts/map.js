// Configuration
const CONFIG = {
  minNodeRadius: 6,
  maxNodeRadius: 20,
  minStuckRadius: 10,
  maxStuckRadius: 25,
  connectionColor: '#DEB887',
  revealedNodeColor: '#E07A5F',
  otherUserColor: '#81B29A',
  connectionWidth: 2,
  otherConnectionWidth: 1,
  labelOffset: 15,
  driftSpeed: 0.09,
  waveAmplitude: 0.01,
  waveFrequency: 0.001
};

// Pusher state
let pusher;
let channel;
let activeUsers = 1;

// State
let nodes = [];
let revealedNodeIds = new Set();
let stuckNodeIds = new Set(); // Nodes this user has clicked/stuck
let selectedNode = null;
let canvas, ctx;
let searchCount = 0;
let animationId = null;
let clickSequence = []; // Array of node IDs in order clicked
let userConnections = []; // Array of {from, to, color} for this user
let otherUserConnections = []; // Array of {from, to, color} from other users

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  canvas = document.getElementById('map-canvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  await loadNodes();
  
  // Start animation loop
  animate();
  
  document.getElementById('search-btn').addEventListener('click', handleSearch);
  document.getElementById('clear-btn').addEventListener('click', clearRevealed);
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  document.getElementById('close-panel').addEventListener('click', closePanel);
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousemove', handleCanvasHover);
});

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  
  const displayWidth = wrapper.clientWidth;
  const displayHeight = wrapper.clientHeight;
  
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  
  ctx.scale(dpr, dpr);
}

async function loadNodes() {
  try {
    const response = await fetch('../data/nodes.json');
    const data = await response.json();
    nodes = data.nodes.map(node => ({
      ...node,
      revealed: false,
      stuck: false,
      views: 0,
      searches: 0,
      revealedBy: null,
      // Random starting position (off-screen left or scattered)
      x: Math.random() * -200 - 50,
      y: Math.random() * window.innerHeight,
      vx: CONFIG.driftSpeed,
      waveOffset: Math.random() * Math.PI * 2
    }));
    
    initializePusher();
    updateStats();
  } catch (error) {
    console.error('Error loading nodes:', error);
  }
}

function getNodeRadius(node, stuck = false) {
  if (!node.wordCount) {
    // Default size if no word count
    return stuck ? 12 : 8;
  }
  
  // Scale radius based on word count
  // Adjust these values based on your data range
  const minWords = 100;
  const maxWords = 100000;
  
  const normalized = Math.min(Math.max((node.wordCount - minWords) / (maxWords - minWords), 0), 1);
  
  if (stuck) {
    return CONFIG.minStuckRadius + (normalized * (CONFIG.maxStuckRadius - CONFIG.minStuckRadius));
  } else {
    return CONFIG.minNodeRadius + (normalized * (CONFIG.maxNodeRadius - CONFIG.minNodeRadius));
  }
}

function initializePusher() {
  if (typeof Pusher === 'undefined') {
    console.warn('Pusher not loaded, real-time features disabled');
    return;
  }
  
  const pusherKey = document.body.dataset.pusherKey;
  const pusherCluster = document.body.dataset.pusherCluster;
  
  if (!pusherKey || !pusherCluster) {
    console.warn('Pusher credentials missing');
    return;
  }
  
  pusher = new Pusher(pusherKey, {
    cluster: pusherCluster
  });

  channel = pusher.subscribe('gowanus-map');
  
  channel.bind('search-event', function(data) {
    handleRemoteSearch(data);
  });

  channel.bind('connection-event', function(data) {
  handleRemoteConnection(data);
});
  
  channel.bind('pusher:subscription_succeeded', function() {
    activeUsers = Math.max(1, Math.floor(Math.random() * 5) + 1);
    updateActiveUsers();
  });
}

function handleRemoteSearch(data) {
  const { query, nodes_revealed } = data;
  
  displayFloatingSearch(query);
  
  if (nodes_revealed && nodes_revealed.length > 0) {
    nodes_revealed.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node && !node.revealed) {
        node.revealed = true;
        node.revealedBy = 'other';
        revealedNodeIds.add(node.id);
        // Spawn at left edge
        node.x = -50;
        node.y = Math.random() * canvas.clientHeight;
      }
    });
  }
}

function handleRemoteConnection(data) {
  const { from, to, color } = data;
  
  otherUserConnections.push({
    from: from,
    to: to,
    color: CONFIG.otherUserColor
  });
}

function displayFloatingSearch(query) {
  const floater = document.createElement('div');
  floater.className = 'floating-search';
  floater.textContent = query;
  floater.style.color = CONFIG.otherUserColor;
  floater.style.left = Math.random() * 80 + 10 + '%';
  floater.style.top = Math.random() * 30 + 10 + '%';
  
  document.body.appendChild(floater);
  setTimeout(() => floater.remove(), 5000);
}

function updateActiveUsers() {
  const statsBar = document.querySelector('.stats-bar');
  let activeSpan = document.getElementById('active-users');
  
  if (!activeSpan) {
    activeSpan = document.createElement('span');
    activeSpan.id = 'active-users';
    statsBar.insertBefore(activeSpan, statsBar.firstChild);
  }
  
  activeSpan.textContent = `${activeUsers} exploring now`;
}

async function handleSearch() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  if (!query) return;
  
  searchCount++;
  
  const matches = nodes.filter(node => 
  node.keywords.some(keyword => keyword.toLowerCase().includes(query)) ||
  node.title.toLowerCase().includes(query) ||
  (node.blurb && node.blurb.toLowerCase().includes(query)) ||
  (node.content && node.content.toLowerCase().includes(query))
);
  
  const revealedIds = [];
  
  if (matches.length > 0) {
    matches.forEach(node => {
      if (!revealedNodeIds.has(node.id)) {
        revealedNodeIds.add(node.id);
        node.revealed = true;
        node.searches++;
        node.revealedBy = 'self';
        revealedIds.push(node.id);
        // Spawn at left edge
        node.x = -50;
        node.y = Math.random() * canvas.clientHeight;
      } else {
        // If already floating, highlight it briefly
        highlightNode(node);
      }
    });
    
    document.getElementById('search-feedback').textContent = 
      `Found ${matches.length} node${matches.length > 1 ? 's' : ''} matching "${query}"`;
  } else {
    const unrevealed = nodes.filter(n => !n.revealed);
    const randomCount = Math.min(3, unrevealed.length);
    
    for (let i = 0; i < randomCount; i++) {
      const randomIndex = Math.floor(Math.random() * unrevealed.length);
      const node = unrevealed.splice(randomIndex, 1)[0];
      revealedNodeIds.add(node.id);
      node.revealed = true;
      node.revealedBy = 'self';
      revealedIds.push(node.id);
      // Spawn at left edge
      node.x = -50;
      node.y = Math.random() * canvas.clientHeight * 0.8 + canvas.clientHeight * 0.1;
    }
    
    document.getElementById('search-feedback').textContent = 
      `No exact matches found. Revealing ${randomCount} related nodes.`;
  }
  
  // Broadcast to other users
  try {
    await fetch('/api/broadcast-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        location: 'Brooklyn, NY',
        nodes_revealed: revealedIds
      })
    });
  } catch (error) {
    console.warn('Failed to broadcast search:', error);
  }
  
  updateStats();
}

function highlightNode(node) {
  // Store original color
  const originalRevealedBy = node.revealedBy;
  
  // Pulse effect
  node.revealedBy = 'highlight';
  
  setTimeout(() => {
    node.revealedBy = originalRevealedBy;
  }, 1000);
}

function clearRevealed() {
  revealedNodeIds.clear();
  stuckNodeIds.clear();
  clickSequence = []; // Reset sequence
  userConnections = []; // Clear your connections
  otherUserConnections = []; // Clear others' connections
  
  nodes.forEach(node => {
    node.revealed = false;
    node.stuck = false;
    node.revealedBy = null;
  });
  document.getElementById('search-input').value = '';
  document.getElementById('search-feedback').textContent = '';
  closePanel();
  updateStats();
}

function updateStats() {
  document.getElementById('revealed-count').textContent = 
    `Nodes revealed: ${revealedNodeIds.size}/${nodes.length} | Collected: ${stuckNodeIds.size}`;
  document.getElementById('total-searches').textContent = 
    `Total searches: ${searchCount}`;
}

// Animation loop
function animate() {
  updateNodePositions();
  draw();
  animationId = requestAnimationFrame(animate);
}

function updateNodePositions() {
  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;
  
  nodes.forEach(node => {
    if (!node.revealed || node.stuck) return;
    
    // Drift right
    node.x += node.vx;
    
    // Wave motion (sine wave for up/down bobbing)
    const time = Date.now() * CONFIG.waveFrequency;
    node.y += Math.sin(time + node.waveOffset) * CONFIG.waveAmplitude;
    
    // Keep within vertical bounds
    if (node.y < 50) node.y = 50;
    if (node.y > canvasHeight - 50) node.y = canvasHeight - 50;
    
    // Reset to left if off-screen right
    if (node.x > canvasWidth + 100) {
      node.x = -50;
      node.y = Math.random() * canvasHeight;
    }
  });
  
  // Organize stuck nodes into constellation
  organizeStuckNodes();
}

function organizeStuckNodes() {
  const stuckNodes = nodes.filter(n => n.stuck);
  if (stuckNodes.length === 0) return;
  
  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;
  
  stuckNodes.forEach((node, index) => {
    // If node doesn't have a target position yet, assign one randomly
    if (!node.targetX || !node.targetY) {
      node.targetX = Math.random() * (canvasWidth - 200) + 100;
      node.targetY = Math.random() * (canvasHeight - 200) + 100;
    }
    
    // Move toward target position
    const dx = node.targetX - node.x;
    const dy = node.targetY - node.y;
    
    node.x += dx * 0.05;
    node.y += dy * 0.05;
    
    // Repel from other stuck nodes to prevent overlap
    stuckNodes.forEach((otherNode, otherIndex) => {
      if (index === otherIndex) return;
      
      const odx = node.x - otherNode.x;
      const ody = node.y - otherNode.y;
      const dist = Math.sqrt(odx * odx + ody * ody);
      
      const minDist = 120; // Minimum distance between nodes
      
      if (dist < minDist && dist > 0) {
        const force = (minDist - dist) / minDist;
        node.x += (odx / dist) * force * 3;
        node.y += (ody / dist) * force * 3;
      }
    });
    
    // Keep within bounds
    node.x = Math.max(80, Math.min(canvasWidth - 80, node.x));
    node.y = Math.max(80, Math.min(canvasHeight - 80, node.y));
  });
}

function draw() {
  if (!ctx) return;
  
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  
  ctx.clearRect(0, 0, displayWidth, displayHeight);
  
  // Draw other users' connections first (underneath)
  otherUserConnections.forEach(conn => {
    drawConnection(conn.from, conn.to, conn.color, CONFIG.otherConnectionWidth);
  });
  
  // Draw your connections on top
  userConnections.forEach(conn => {
    drawConnection(conn.from, conn.to, conn.color, CONFIG.connectionWidth);
  });
  
  // Draw all revealed nodes
  nodes.forEach(node => {
    if (node.revealed) {
      drawNode(node);
    }
  });
}

function drawNode(node) {
  const radius = getNodeRadius(node, node.stuck);
  
  // Color based on state
  let nodeColor;
  if (node.revealedBy === 'highlight') {
    nodeColor = '#FFD700'; // Gold for highlight pulse
  } else if (node.stuck) {
    nodeColor = CONFIG.revealedNodeColor; // Your collected nodes
  } else if (node.revealedBy === 'other') {
    nodeColor = CONFIG.otherUserColor; // Others' reveals
  } else {
    nodeColor = CONFIG.revealedNodeColor; // Your reveals
  }
  
  // Draw glow
  const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 1.5);
  gradient.addColorStop(0, nodeColor);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // Draw node
  ctx.fillStyle = nodeColor;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw border
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = node.stuck ? 3 : 2;
  ctx.stroke();
  
// Draw label for all revealed nodes
if (node.revealed) {
  ctx.fillStyle = '#5C4033';
  ctx.font = '12px "MS Sans Serif"';
  ctx.textAlign = 'center';
  
  // Add background for readability
  const textWidth = ctx.measureText(node.title).width;
  ctx.fillStyle = 'rgba(245, 241, 232, 0.9)'; // Semi-transparent cream background
  ctx.fillRect(
    node.x - textWidth / 2 - 4, 
    node.y + radius + 4, 
    textWidth + 8, 
    16
  );
  
  // Draw text
  ctx.fillStyle = '#5C4033';
  ctx.fillText(node.title, node.x, node.y + radius + CONFIG.labelOffset);
}
}

function drawConnection(fromId, toId, color, width) {
  const fromNode = nodes.find(n => n.id === fromId);
  const toNode = nodes.find(n => n.id === toId);
  
  if (!fromNode || !toNode) return;
  
  // Only draw if both nodes are stuck (visible)
  if (!fromNode.stuck || !toNode.stuck) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(fromNode.x, fromNode.y);
  ctx.lineTo(toNode.x, toNode.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

async function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
const clickedNode = nodes.find(node => {
  if (!node.revealed) return false;
  const dx = x - node.x;
  const dy = y - node.y;
  const radius = getNodeRadius(node, node.stuck);
  return Math.sqrt(dx * dx + dy * dy) <= radius;
});
  
  if (clickedNode) {
    if (!clickedNode.stuck) {
      // Stick the node
      clickedNode.stuck = true;
      stuckNodeIds.add(clickedNode.id);
      clickedNode.views++;
      
      // Add to click sequence
      clickSequence.push(clickedNode.id);
      
      // If there's a previous node, create connection
      if (clickSequence.length > 1) {
        const prevNodeId = clickSequence[clickSequence.length - 2];
        userConnections.push({
          from: prevNodeId,
          to: clickedNode.id,
          color: CONFIG.revealedNodeColor
        });
        
        // Broadcast this connection to other users
        try {
          await fetch('/api/broadcast-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: prevNodeId,
              to: clickedNode.id,
              color: CONFIG.revealedNodeColor
            })
          });
        } catch (error) {
          console.warn('Failed to broadcast connection:', error);
        }
      }
      
      updateStats();
    }
    
    // Show info panel
    selectedNode = clickedNode;
    showNodeInfo(clickedNode);
  }
}

function handleCanvasHover(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const hoverNode = nodes.find(node => {
  if (!node.revealed) return false;
  const dx = x - node.x;
  const dy = y - node.y;
  const radius = getNodeRadius(node, node.stuck);
  return Math.sqrt(dx * dx + dy * dy) <= radius;
});
  
  canvas.style.cursor = hoverNode ? 'pointer' : 'default';
}

function showNodeInfo(node) {
  const panel = document.getElementById('node-info-panel');
  
  // Make title clickable if there's a source URL
  if (node.sourceUrl) {
  const escapedTitle = node.title.replace(/'/g, "\\'");
  document.getElementById('panel-title').innerHTML = 
    `<a href="${node.sourceUrl}" onclick="openSourceWindow('${node.sourceUrl}', '${escapedTitle}'); return false;" style="color: #5C4033; text-decoration: underline; cursor: pointer;">${node.title}</a>`;
} else {
  document.getElementById('panel-title').textContent = node.title;
}
  
  document.getElementById('panel-meta').textContent = 
    `${node.type} • ${node.year}`;
  
  // Use blurb instead of content
  document.getElementById('panel-content').textContent = node.blurb || node.content || '';
  
  let statsHTML = `
    <div>Revealed ${node.searches} time${node.searches !== 1 ? 's' : ''}</div>
    <div>Viewed ${node.views} time${node.views !== 1 ? 's' : ''}</div>
    <div>${node.stuck ? 'Collected' : 'Drifting'}</div>
  `;
  
  if (node.wordCount) {
    statsHTML += `<div>${node.wordCount.toLocaleString()} words</div>`;
  }
  
  // Show community meeting invitation after 10+ clicks
  if (clickSequence.length >= 10) {
    statsHTML += `
      <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #DEB887;">
        <p style="font-size: 13px; margin-bottom: 10px; line-height: 1.5;">
          Do you have an opinion about this? Click to voice your thoughts.
        </p>
        <button onclick="window.location.href='/community'" style="
          width: 100%;
          padding: 12px;
          background: #E07A5F;
          border: 2px solid #8B4513;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
        ">VOICE YOUR THOUGHTS →</button>
      </div>
    `;
  }
  
  // Portal nodes
  if (node.id === 21) {
    statsHTML += `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #DEB887;">
        <button onclick="window.location.href='/community'" style="
          width: 100%;
          padding: 12px;
          background: #E07A5F;
          border: 2px solid #8B4513;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
        ">ENTER COMMUNITY MEETING →</button>
      </div>
    `;
  } else if (node.id === 22) {
    statsHTML += `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #DEB887;">
        <button onclick="window.location.href='/oracle'" style="
          width: 100%;
          padding: 12px;
          background: #3D5A80;
          border: 2px solid #8B4513;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
        ">CONSULT THE ORACLE →</button>
      </div>
    `;
  }
  
  document.getElementById('panel-stats').innerHTML = statsHTML;
  panel.classList.remove('hidden');
}

function closePanel() {
  document.getElementById('node-info-panel').classList.add('hidden');
  selectedNode = null;
}

// Global function for opening source windows
window.openSourceWindow = function(url, title) {
  // Check if it's an internal file (starts with /)
  if (url.startsWith('/assets/') || url.startsWith('/')) {
    // Internal files - use iframe
    createIframeWindow(url, title);
  } else {
    // External links - open in new tab
    window.open(url, '_blank');
  }
};

function createIframeWindow(url, title) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'source-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create window
  const sourceWindow = document.createElement('div');
  sourceWindow.style.cssText = `
    width: 90%;
    max-width: 1000px;
    height: 85%;
    background: #ffffffff;
    border: 1px solid #000000ff;
    box-shadow: 8px 8px 0 rgba(0, 0, 0, 10);
    display: flex;
    flex-direction: column;
  `;
  
  // Create title bar
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    background: linear-gradient(90deg, #5a5853ff, #e8e8dbff);
    color: #fff;
    padding: 6px 10px;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  titleBar.innerHTML = `
    <span>${title}</span>
    <button id="close-source" style="
      background: #000000ff;
      border: 1px solid #8B4513;
      width: 28px;
      height: 28px;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      color: #000000ff;
    ">×</button>
  `;
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = `
    flex: 1;
    border: none;
    width: 100%;
  `;
  
  // Assemble
  sourceWindow.appendChild(titleBar);
  sourceWindow.appendChild(iframe);
  overlay.appendChild(sourceWindow);
  document.body.appendChild(overlay);
  
  // Close handlers
  const closeWindow = () => overlay.remove();
  document.getElementById('close-source').addEventListener('click', closeWindow);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeWindow();
  });
}