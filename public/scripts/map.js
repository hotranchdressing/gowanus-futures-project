// Configuration
const CONFIG = {
  nodeRadius: 8,
  revealedNodeRadius: 12,
  connectionColor: '#DEB887',
  hiddenNodeColor: 'transparent',
  revealedNodeColor: '#E07A5F',
  connectionWidth: 1.5,
  connectionOpacity: 0.3,
  labelOffset: 15
};

// Pusher state
let pusher;
let channel;
let activeUsers = 1;
let userColor = generateUserColor();

function generateUserColor() {
  const colors = [
    '#E07A5F', '#81B29A', '#F2CC8F', '#3D5A80',
    '#E63946', '#06FFA5', '#FF6B9D', '#C77DFF'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// State
let nodes = [];
let revealedNodeIds = new Set();
let selectedNode = null;
let canvas, ctx;
let searchCount = 0;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  canvas = document.getElementById('map-canvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  await loadNodes();
  generateConnections();
  draw();
  
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
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  if (ctx) draw();
}

async function loadNodes() {
  try {
    const response = await fetch('../data/nodes.json');
    const data = await response.json();
    nodes = data.nodes.map(node => ({
      ...node,
      connections: [],
      revealed: false,
      views: 0,
      searches: 0,
      revealedBy: null
    }));
    
    initializePusher();
    updateStats();
  } catch (error) {
    console.error('Error loading nodes:', error);
  }
}

function initializePusher() {
  // Check if Pusher is loaded
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
      }
    });
    draw();
  }
}

function displayFloatingSearch(query) {
  const floater = document.createElement('div');
  floater.className = 'floating-search';
  floater.textContent = query;
  floater.style.color = generateUserColor();
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
  
  activeSpan.textContent = `👁️ ${activeUsers} exploring now`;
}

function generateConnections() {
  nodes.forEach((node, i) => {
    nodes.forEach((otherNode, j) => {
      if (i >= j) return;
      
      const sharedKeywords = node.keywords.filter(k => 
        otherNode.keywords.includes(k)
      );
      
      if (sharedKeywords.length >= 2) {
        node.connections.push(otherNode.id);
        otherNode.connections.push(node.id);
      }
    });
  });
}

async function handleSearch() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  if (!query) return;
  
  searchCount++;
  
  const matches = nodes.filter(node => 
    node.keywords.some(keyword => keyword.toLowerCase().includes(query)) ||
    node.title.toLowerCase().includes(query) ||
    node.content.toLowerCase().includes(query)
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
  draw();
}

function clearRevealed() {
  revealedNodeIds.clear();
  nodes.forEach(node => {
    node.revealed = false;
    node.revealedBy = null;
  });
  document.getElementById('search-input').value = '';
  document.getElementById('search-feedback').textContent = '';
  closePanel();
  updateStats();
  draw();
}

function updateStats() {
  document.getElementById('revealed-count').textContent = 
    `Nodes revealed: ${revealedNodeIds.size}/${nodes.length}`;
  document.getElementById('total-searches').textContent = 
    `Total searches: ${searchCount}`;
}

function draw() {
  if (!ctx) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw connections
  nodes.forEach(node => {
    if (!node.revealed) return;
    
    node.connections.forEach(connId => {
      const connNode = nodes.find(n => n.id === connId);
      if (!connNode) return;
      
      ctx.strokeStyle = CONFIG.connectionColor;
      ctx.lineWidth = CONFIG.connectionWidth;
      ctx.globalAlpha = CONFIG.connectionOpacity;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(connNode.x, connNode.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      if (!connNode.revealed) {
        drawNodeOutline(connNode);
      }
    });
  });
  
  // Draw nodes
  nodes.forEach(node => {
    if (node.revealed) {
      drawRevealedNode(node);
    }
  });
}

function drawNodeOutline(node) {
  ctx.strokeStyle = CONFIG.connectionColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(node.x, node.y, CONFIG.nodeRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawRevealedNode(node) {
  const radius = selectedNode && selectedNode.id === node.id ? 
    CONFIG.revealedNodeRadius + 2 : CONFIG.revealedNodeRadius;
  
  const nodeColor = node.revealedBy === 'self' ? 
    CONFIG.revealedNodeColor : '#81B29A';
  
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
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw label
  ctx.fillStyle = '#5C4033';
  ctx.font = '12px "MS Sans Serif"';
  ctx.textAlign = 'center';
  ctx.fillText(node.title, node.x, node.y + radius + CONFIG.labelOffset);
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const clickedNode = nodes.find(node => {
    if (!node.revealed) return false;
    const dx = x - node.x;
    const dy = y - node.y;
    return Math.sqrt(dx * dx + dy * dy) <= CONFIG.revealedNodeRadius;
  });
  
  if (clickedNode) {
    selectedNode = clickedNode;
    clickedNode.views++;
    showNodeInfo(clickedNode);
    draw();
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
    return Math.sqrt(dx * dx + dy * dy) <= CONFIG.revealedNodeRadius;
  });
  
  canvas.style.cursor = hoverNode ? 'pointer' : 'crosshair';
}

function showNodeInfo(node) {
  const panel = document.getElementById('node-info-panel');
  document.getElementById('panel-title').textContent = node.title;
  document.getElementById('panel-meta').textContent = 
    `${node.type} • ${node.year}`;
  document.getElementById('panel-content').textContent = node.content;
  document.getElementById('panel-stats').innerHTML = `
    <div>🔍 Revealed ${node.searches} time${node.searches !== 1 ? 's' : ''}</div>
    <div>👁️ Viewed ${node.views} time${node.views !== 1 ? 's' : ''}</div>
    <div>🔗 Connected to ${node.connections.length} nodes</div>
  `;
  panel.classList.remove('hidden');
}

function closePanel() {
  document.getElementById('node-info-panel').classList.add('hidden');
  selectedNode = null;
  draw();
}