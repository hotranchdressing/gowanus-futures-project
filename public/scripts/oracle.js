// Configuration
const CONFIG = {
  minNodeRadius: 10,
  maxNodeRadius: 22,
  nodeColor: '#9370db',
  yourNodeColor: '#e8d5ff',
  driftSpeed: 0.06,
  waveAmplitude: 0.02,
  waveFrequency: 0.0015
};

// Markov models
let models = {};
let modelsLoaded = false;

// Pusher state
let pusher;
let channel;

// State
let analysesNodes = [];
let canvas, ctx;
let animationId = null;
let selectedNode = null;
let showingSpeculations = false;
let currentAnalysis = null;
let yourAnalyses = 0;
let clickSequence = []; // Track clicked nodes in order
let connections = []; // Store connections between nodes

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  canvas = document.getElementById('oracle-canvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  await initOracle();
  await loadAnalyses();

  // Start animation loop
  animate();

  document.getElementById('oracle-submit').addEventListener('click', handleOracleButton);
  document.getElementById('oracle-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.getElementById('oracle-submit').textContent === 'Analyze') {
      handleSubmit();
    }
  });
  document.getElementById('close-oracle-panel').addEventListener('click', closePanel);
  document.getElementById('show-speculations-btn').addEventListener('click', showSpeculations);
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousemove', handleCanvasHover);

  initializePusher();
});

async function initOracle() {
  console.log('Loading oracle corpora...');

  try {
    const response = await fetch('../data/corpora.json');
    const corpora = await response.json();

    console.log('Building oracle models...');

    models.epa = new MarkovGenerator(corpora.epa, 2);
    models.blogs = new MarkovGenerator(corpora.blogs, 2);
    models.youtube = new MarkovGenerator(corpora.youtube, 2);
    models.tiktok = new MarkovGenerator(corpora.tiktok, 2);
    models.reviews = new MarkovGenerator(corpora.google_reviews, 2);
    models.twitter = new MarkovGenerator(corpora.twitter, 2);
    models.cyborg = new MarkovGenerator(corpora.cyborg, 2);

    console.log('✓ Core models loaded');

    // Load user-generated corpus (non-blocking)
    loadUserCorpus().catch(err => {
      console.warn('User corpus load failed, continuing anyway:', err);
      models.user = new MarkovGenerator([], 2);
    });

    // Set loaded flag immediately after core models
    modelsLoaded = true;
    console.log('✓ Oracle ready');
  } catch (error) {
    console.error('Error loading oracle:', error);
    showStatus('Error loading oracle systems');
  }
}

async function loadUserCorpus() {
  try {
    const response = await fetch('/api/get-corpus');
    
    // Check if response is ok
    if (!response.ok) {
      console.warn('Failed to fetch user corpus, continuing with empty model');
      models.user = new MarkovGenerator([], 2);
      return;
    }
    
    const data = await response.json();

    if (data.corpus && data.corpus.length > 0) {
      // FIX: Extract just the text strings, not the whole objects
      const userTexts = data.corpus.map(entry => entry.text).filter(text => text && typeof text === 'string');
      
      if (userTexts.length > 0) {
        models.user = new MarkovGenerator(userTexts, 2);
        console.log(`✓ User corpus loaded (${userTexts.length} entries)`);
      } else {
        console.log('No valid text in corpus');
        models.user = new MarkovGenerator([], 2);
      }
    } else {
      console.log('No user corpus yet');
      models.user = new MarkovGenerator([], 2); // Empty model
    }
  } catch (error) {
    console.warn('Failed to load user corpus:', error);
    models.user = new MarkovGenerator([], 2); // Empty model on error
  }
}

async function loadAnalyses() {
  try {
    const response = await fetch('/api/get-analyses');
    const data = await response.json();

    analysesNodes = data.analyses.map((item, index) => ({
      id: item.id || index,
      question: item.question,
      answer: item.answer,
      contamination: item.contamination || 50,
      timestamp: item.created_at || new Date().toISOString(),
      isYours: false,
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      vx: CONFIG.driftSpeed,
      waveOffset: Math.random() * Math.PI * 2
    }));

    updateStats();
  } catch (error) {
    console.error('Error loading analyses:', error);
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

  channel = pusher.subscribe('gowanus-oracle');

  channel.bind('new-analysis', function(data) {
    handleNewAnalysis(data);
  });
}

function handleNewAnalysis(data) {
  const newNode = {
    id: data.id || Date.now(),
    question: data.question,
    answer: data.answer,
    contamination: data.contamination,
    timestamp: data.timestamp || new Date().toISOString(),
    isYours: false,
    x: -50,
    y: Math.random() * canvas.clientHeight,
    vx: CONFIG.driftSpeed,
    waveOffset: Math.random() * Math.PI * 2
  };

  analysesNodes.push(newNode);
  updateStats();
}

function generateWithWeights(weights) {
  const modelsList = [
    models.epa, 
    models.blogs, 
    models.youtube, 
    models.tiktok, 
    models.reviews, 
    models.twitter, 
    models.cyborg,
    models.user  // ADD user model
  ];
  
  const weightsList = [
    weights.epa, 
    weights.blogs || 0, 
    weights.youtube || 0, 
    weights.tiktok || 0, 
    weights.reviews, 
    weights.twitter, 
    weights.cyborg,
    weights.user || 0  // ADD user weight
  ];

  const combined = MarkovGenerator.combine(modelsList, weightsList);

  for (let i = 0; i < 50; i++) {
    const sentence = combined.generate(50, 10);
    if (sentence && sentence.split(' ').length >= 10) {
      return sentence;
    }
  }

  return "Analysis inconclusive. Temporal data corruption detected.";
}

function askOracle(question) {
  if (!modelsLoaded) {
    return "ERROR: Oracle systems not initialized.";
  }

  const responses = [];

  // Sentence 1: Bureaucratic opening (50% EPA, 20% user)
  const bureaucratic = generateWithWeights({
    epa: 0.3,
    tiktok: 0.1,
    cyborg: 0.1,
    reviews: 0.1,
    twitter: 0.2,
    user: 0.2  // Include user corpus
  });
  responses.push(bureaucratic);

  // Sentence 2: Medium contamination (20% EPA, 30% cyborg, 20% user)
  const prediction = generateWithWeights({
    epa: 0.2,
    cyborg: 0.3,
    reviews: 0.1,
    twitter: 0.2,
    user: 0.2  // Include user corpus
  });
  responses.push(prediction);

  // Sentence 3: High contamination (5% EPA, 40% cyborg, 30% user)
  const mystical = generateWithWeights({
    epa: 0.05,
    cyborg: 0.4,
    reviews: 0.1,
    twitter: 0.15,
    user: 0.3  // Heavy user corpus influence
  });
  responses.push(mystical);

  return responses.join(' ');
}

function calculateContamination(text) {
  const wordCount = text.split(' ').length;
  const base = Math.min(100, (wordCount / 150) * 100);
  const random = Math.random() * 20;
  return Math.min(100, Math.floor(base + random));
}

function handleOracleButton() {
  const submitBtn = document.getElementById('oracle-submit');

  if (submitBtn.textContent === 'Keep Exploring') {
    window.location.href = '/';
  } else {
    handleSubmit();
  }
}

function resetOracleButton() {
  const submitBtn = document.getElementById('oracle-submit');
  submitBtn.textContent = 'Analyze';
  submitBtn.disabled = false;
}

function showStatus(message) {
  const statusDiv = document.getElementById('oracle-status');
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';

  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

async function handleSubmit() {
  const input = document.getElementById('oracle-input');
  const question = input.value.trim();
  const submitBtn = document.getElementById('oracle-submit');

  if (!question) {
    showStatus('Please enter a query');
    return;
  }

  if (!modelsLoaded) {
    showStatus('Oracle systems still initializing');
    return;
  }

  // Save query to corpus
  try {
    await fetch('/api/add-to-corpus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: question,
        type: 'oracle_query',
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.warn('Failed to save query to corpus:', error);
  }

  // Show mystical animation
  const overlay = document.getElementById('mystical-overlay');
  overlay.classList.remove('hidden');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Analyzing...';

  // Wait for mystical animation
  setTimeout(async () => {
    const answer = askOracle(question);
    const contamination = calculateContamination(answer);

    // Hide overlay
    overlay.classList.add('hidden');

    // Store analysis
    currentAnalysis = {
      question,
      answer,
      contamination,
      timestamp: new Date().toISOString()
    };

    // Save to database
    try {
      const response = await fetch('/api/submit-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentAnalysis)
      });

      const data = await response.json();

      if (response.ok) {
        // Add to local nodes
        const newNode = {
          id: data.id || Date.now(),
          question,
          answer,
          contamination,
          timestamp: currentAnalysis.timestamp,
          isYours: true,
          x: -50,
          y: Math.random() * canvas.clientHeight,
          vx: CONFIG.driftSpeed,
          waveOffset: Math.random() * Math.PI * 2
        };

        analysesNodes.push(newNode);
        yourAnalyses++;
        updateStats();

        // Broadcast to other users
        try {
          await fetch('/api/broadcast-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: newNode.id,
              question,
              answer,
              contamination,
              timestamp: newNode.timestamp
            })
          });
        } catch (error) {
          console.warn('Failed to broadcast analysis:', error);
        }
      }
    } catch (error) {
      console.error('Error saving analysis:', error);
    }

    // Show results panel
    showResultsPanel(question, answer, contamination);

    // Reset input
    input.value = '';
    submitBtn.disabled = false;

    // Change button to "Keep Exploring"
    submitBtn.textContent = 'Keep Exploring';
  }, 2500);
}

function showResultsPanel(question, answer, contamination) {
  const panel = document.getElementById('oracle-panel');

  document.getElementById('oracle-panel-title').textContent = 'Analysis Results';

  document.getElementById('oracle-panel-meta').innerHTML = `
    <strong>Query:</strong> ${question}<br>
    <strong>Contamination Level:</strong> <span style="color: ${contamination > 70 ? '#ff6b6b' : contamination > 40 ? '#ffd93d' : '#6bcf7f'}">${contamination}%</span>
  `;

  document.getElementById('oracle-panel-content').textContent = answer;

  document.getElementById('oracle-panel-stats').innerHTML = `
    <div style="font-size: 12px; margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(147, 112, 219, 0.3);">
      <div>Analysis Date: ${new Date().toLocaleDateString()}</div>
      <div>Timestamp: ${new Date().toLocaleTimeString()}</div>
      <div>Status: <span style="color: #6bcf7f">COMPLETE</span></div>
    </div>
  `;

  panel.classList.remove('hidden');
}

function showSpeculations() {
  showingSpeculations = true;
  closePanel();
  showStatus('Revealing other speculations...');
}

function updateStats() {
  document.getElementById('analyses-count').textContent =
    `Recent analyses: ${analysesNodes.length}`;
  document.getElementById('contamination-level').textContent =
    currentAnalysis ? `Contamination: ${currentAnalysis.contamination}%` : 'Contamination: 0%';
}

// Animation loop
function animate() {
  updateNodePositions();
  draw();
  animationId = requestAnimationFrame(animate);
}

function updateNodePositions() {
  if (!showingSpeculations) return;

  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;

  analysesNodes.forEach(node => {
    node.x += node.vx;

    const time = Date.now() * CONFIG.waveFrequency;
    node.y += Math.sin(time + node.waveOffset) * CONFIG.waveAmplitude;

    if (node.y < 50) node.y = 50;
    if (node.y > canvasHeight - 50) node.y = canvasHeight - 50;

    if (node.x > canvasWidth + 100) {
      node.x = -50;
      node.y = Math.random() * canvasHeight;
    }
  });
}

function draw() {
  if (!ctx || !showingSpeculations) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Draw faint mystical grid for infinite field effect
  drawGrid(displayWidth, displayHeight);

  // Draw connections between clicked nodes
  connections.forEach(conn => {
    drawConnection(conn.from, conn.to, conn.color);
  });

  analysesNodes.forEach(node => {
    drawNode(node);
  });
}

function drawGrid(width, height) {
  const gridSize = 40; // Grid cell size

  ctx.strokeStyle = 'rgba(138, 43, 226, 0.12)'; // Faint mystical purple lines
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
  const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 1.8);
  gradient.addColorStop(0, nodeColor);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Draw node
  ctx.fillStyle = nodeColor;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = '#8a2be2';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw label
  const label = node.question.length > 25
    ? node.question.substring(0, 25) + '...'
    : node.question;

  ctx.fillStyle = '#e8d5ff';
  ctx.font = '11px "MS Sans Serif"';
  ctx.textAlign = 'center';

  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
  ctx.fillRect(
    node.x - textWidth / 2 - 4,
    node.y + radius + 4,
    textWidth + 8,
    14
  );

  ctx.fillStyle = '#e8d5ff';
  ctx.fillText(label, node.x, node.y + radius + 14);
}

function drawConnection(fromId, toId, color) {
  const fromNode = analysesNodes.find(n => n.id === fromId);
  const toNode = analysesNodes.find(n => n.id === toId);

  if (!fromNode || !toNode) return;

  // Draw mystical glowing line
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;

  // Add glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(fromNode.x, fromNode.y);
  ctx.lineTo(toNode.x, toNode.y);
  ctx.stroke();

  // Reset shadow
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function getNodeRadius(node) {
  const minWords = 20;
  const maxWords = 150;
  const wordCount = node.answer.split(' ').length;

  const normalized = Math.min(Math.max((wordCount - minWords) / (maxWords - minWords), 0), 1);

  return CONFIG.minNodeRadius + (normalized * (CONFIG.maxNodeRadius - CONFIG.minNodeRadius));
}

function handleCanvasClick(e) {
  if (!showingSpeculations) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const clickedNode = analysesNodes.find(node => {
    const dx = x - node.x;
    const dy = y - node.y;
    const radius = getNodeRadius(node);
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });

  if (clickedNode) {
    // Add to click sequence
    clickSequence.push(clickedNode.id);

    // If there's a previous node, create connection
    if (clickSequence.length > 1) {
      const prevNodeId = clickSequence[clickSequence.length - 2];
      connections.push({
        from: prevNodeId,
        to: clickedNode.id,
        color: '#9370db'
      });
    }

    // After 3 clicks, transition to map
    if (clickSequence.length >= 3) {
      setTimeout(() => {
        window.location.href = '/';
      }, 1500); // Short delay to show the final connection
    }

    selectedNode = clickedNode;
    showAnalysisInfo(clickedNode);
  }
}

function handleCanvasHover(e) {
  if (!showingSpeculations) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const hoverNode = analysesNodes.find(node => {
    const dx = x - node.x;
    const dy = y - node.y;
    const radius = getNodeRadius(node);
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });

  canvas.style.cursor = hoverNode ? 'pointer' : 'default';
}

function showAnalysisInfo(node) {
  const panel = document.getElementById('oracle-panel');

  document.getElementById('oracle-panel-title').textContent = 'Speculation Analysis';

  document.getElementById('oracle-panel-meta').innerHTML = `
    <strong>Query:</strong> ${node.question}<br>
    <strong>Contamination:</strong> <span style="color: ${node.contamination > 70 ? '#ff6b6b' : node.contamination > 40 ? '#ffd93d' : '#6bcf7f'}">${node.contamination}%</span>
  `;

  document.getElementById('oracle-panel-content').textContent = node.answer;

  const date = new Date(node.timestamp);
  document.getElementById('oracle-panel-stats').innerHTML = `
    <div style="font-size: 12px; margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(147, 112, 219, 0.3);">
      <div>Analysis Date: ${date.toLocaleDateString()}</div>
      <div>Timestamp: ${date.toLocaleTimeString()}</div>
    </div>
  `;

  // Hide the "Other Speculations" button when viewing a speculation
  document.getElementById('speculations-section').style.display = 'none';

  panel.classList.remove('hidden');
}

function closePanel() {
  document.getElementById('oracle-panel').classList.add('hidden');
  // Show speculations button again
  document.getElementById('speculations-section').style.display = 'block';
  selectedNode = null;

  // Reset button back to Analyze mode when panel is closed
  resetOracleButton();
}