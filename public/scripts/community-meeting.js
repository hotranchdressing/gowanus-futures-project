// Configuration
const CONFIG = {
  minNodeRadius: 8,
  maxNodeRadius: 18,
  nodeColor: '#81B29A',
  yourNodeColor: '#E07A5F',
  connectionColor: '#DEB887',
  labelOffset: 15,
  driftSpeed: 0.08,
  waveAmplitude: 0.015,
  waveFrequency: 0.0012
};

// Pusher state
let pusher;
let channel;

// State
let feedbackNodes = [];
let canvas, ctx;
let animationId = null;
let selectedNode = null;
let yourContributions = 0;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  canvas = document.getElementById('feedback-canvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  await loadFeedback();

  // Start animation loop
  animate();

  document.getElementById('submit-btn').addEventListener('click', handleSubmit);
  document.getElementById('oracle-btn').addEventListener('click', () => {
    window.location.href = '/oracle';
  });
  document.getElementById('feedback-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
  document.getElementById('close-panel').addEventListener('click', closePanel);
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousemove', handleCanvasHover);

  initializePusher();
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

async function loadFeedback() {
  try {
    const response = await fetch('/api/get-feedback');
    const data = await response.json();

    feedbackNodes = data.feedback.map((item, index) => ({
      id: item.id || index,
      comment: item.comment,
      timestamp: item.created_at || new Date().toISOString(),
      isYours: false,
      // Random starting position
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      vx: CONFIG.driftSpeed,
      waveOffset: Math.random() * Math.PI * 2
    }));

    updateStats();
  } catch (error) {
    console.error('Error loading feedback:', error);
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

  channel = pusher.subscribe('gowanus-feedback');

  channel.bind('new-feedback', function(data) {
    handleNewFeedback(data);
  });
}

function handleNewFeedback(data) {
  const newNode = {
    id: data.id || Date.now(),
    comment: data.comment,
    timestamp: data.timestamp || new Date().toISOString(),
    isYours: false,
    x: -50,
    y: Math.random() * canvas.clientHeight,
    vx: CONFIG.driftSpeed,
    waveOffset: Math.random() * Math.PI * 2
  };

  feedbackNodes.push(newNode);
  updateStats();

  // Show floating notification
  showFloatingNotification('New feedback received');
}

function showFloatingNotification(message) {
  const statusDiv = document.getElementById('submit-status');
  statusDiv.textContent = message;
  statusDiv.style.cssText = `
    position: absolute;
    bottom: 80px;
    right: 30px;
    background: rgba(129, 178, 154, 0.9);
    color: #fff;
    padding: 8px 12px;
    font-size: 13px;
    border-radius: 4px;
  `;

  setTimeout(() => {
    statusDiv.textContent = '';
    statusDiv.style.cssText = '';
  }, 3000);
}

async function handleSubmit() {
  const input = document.getElementById('feedback-input');
  const comment = input.value.trim();

  if (!comment) {
    showFloatingNotification('Please enter feedback');
    return;
  }

  try {
    const response = await fetch('/api/submit-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment })
    });

    const data = await response.json();

    if (response.ok) {
      // Add new node immediately
      const newNode = {
        id: data.id || Date.now(),
        comment: comment,
        timestamp: new Date().toISOString(),
        isYours: true,
        x: -50,
        y: Math.random() * canvas.clientHeight,
        vx: CONFIG.driftSpeed,
        waveOffset: Math.random() * Math.PI * 2
      };

      feedbackNodes.push(newNode);
      yourContributions++;
      updateStats();

      // Broadcast to other users
      try {
        await fetch('/api/broadcast-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newNode.id,
            comment: comment,
            timestamp: newNode.timestamp
          })
        });
      } catch (error) {
        console.warn('Failed to broadcast feedback:', error);
      }

      input.value = '';
      showFloatingNotification('Feedback submitted!');
    } else {
      showFloatingNotification('Error: ' + data.error);
    }
  } catch (error) {
    showFloatingNotification('Error submitting feedback');
    console.error(error);
  }
}

function updateStats() {
  document.getElementById('feedback-count').textContent =
    `Feedback nodes: ${feedbackNodes.length}`;
  document.getElementById('your-contributions').textContent =
    `Your contributions: ${yourContributions}`;
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

  feedbackNodes.forEach(node => {
    // Drift right
    node.x += node.vx;

    // Wave motion
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
}

function draw() {
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Draw faint grid for infinite field effect
  drawGrid(displayWidth, displayHeight);

  // Draw all feedback nodes
  feedbackNodes.forEach(node => {
    drawNode(node);
  });
}

function drawGrid(width, height) {
  const gridSize = 40; // Grid cell size

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; // Very faint black lines
  ctx.lineWidth = 1;

  // Draw vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawNode(node) {
  const radius = getNodeRadius(node);
  const nodeColor = node.isYours ? CONFIG.yourNodeColor : CONFIG.nodeColor;

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
  ctx.strokeStyle = '#5C4033';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw label (shortened comment)
  const label = node.comment.length > 30
    ? node.comment.substring(0, 30) + '...'
    : node.comment;

  ctx.fillStyle = '#5C4033';
  ctx.font = '12px "MS Sans Serif"';
  ctx.textAlign = 'center';

  // Add background for readability
  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(245, 241, 232, 0.9)';
  ctx.fillRect(
    node.x - textWidth / 2 - 4,
    node.y + radius + 4,
    textWidth + 8,
    16
  );

  // Draw text
  ctx.fillStyle = '#5C4033';
  ctx.fillText(label, node.x, node.y + radius + CONFIG.labelOffset);
}

function getNodeRadius(node) {
  // Size based on comment length
  const minWords = 10;
  const maxWords = 200;
  const wordCount = node.comment.split(' ').length;

  const normalized = Math.min(Math.max((wordCount - minWords) / (maxWords - minWords), 0), 1);

  return CONFIG.minNodeRadius + (normalized * (CONFIG.maxNodeRadius - CONFIG.minNodeRadius));
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const clickedNode = feedbackNodes.find(node => {
    const dx = x - node.x;
    const dy = y - node.y;
    const radius = getNodeRadius(node);
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });

  if (clickedNode) {
    selectedNode = clickedNode;
    showFeedbackInfo(clickedNode);
  }
}

function handleCanvasHover(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const hoverNode = feedbackNodes.find(node => {
    const dx = x - node.x;
    const dy = y - node.y;
    const radius = getNodeRadius(node);
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });

  canvas.style.cursor = hoverNode ? 'pointer' : 'default';
}

function showFeedbackInfo(node) {
  const panel = document.getElementById('feedback-panel');

  document.getElementById('panel-title').textContent = 'Community Feedback';

  const date = new Date(node.timestamp);
  document.getElementById('panel-meta').textContent =
    `Submitted ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;

  document.getElementById('panel-content').textContent = node.comment;

  panel.classList.remove('hidden');
}

function closePanel() {
  document.getElementById('feedback-panel').classList.add('hidden');
  selectedNode = null;
}
