document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  const loader = document.getElementById("loader");
  const views = {
    home: document.getElementById("home-screen"),
    level1: document.getElementById("level1"),
    level2: document.getElementById("level2"),
    npl: document.getElementById("npl"),
  };

  const bestLevel1El = document.getElementById("best-level1");
  const bestLevel2El = document.getElementById("best-level2");

  const timers = {
    level1: { display: document.getElementById("timer1"), interval: null, startTime: null },
    level2: { display: document.getElementById("timer2"), interval: null, startTime: null },
  };

  let currentView = "home";

  const bgImages = [
    "../assets/images/image 1.png",
    "../assets/images/image 2.png",
    "../assets/images/image 3.png",
    "../assets/images/image 4.png",
    "../assets/images/image 5.jpg",
    "../assets/images/image 6.png",
    "../assets/images/image 7.JPEG",
  ];
  let bgIndex = 0;
  const bgFlash = document.getElementById("bg-flash");

  function startBackgroundFlash() {
    if (!bgFlash) return;
    bgFlash.style.backgroundImage = `url('${bgImages[bgIndex]}')`;
    setInterval(() => {
      bgIndex = (bgIndex + 1) % bgImages.length;
      bgFlash.style.backgroundImage = `url('${bgImages[bgIndex]}')`;
    }, 1800);
  }

  function showView(view) {
    currentView = view;
    Object.entries(views).forEach(([key, node]) => {
      node.classList.toggle("hidden", key !== view.replace("-screen", ""));
    });
    if (view !== "level1") stopTimer("level1");
    if (view !== "level2") stopTimer("level2");
    if (view === "level1") {
      resetLevel1();
    }
    if (view === "level2") {
      resetLevel2();
    }
    if (view === "npl") {
      resetNpl();
    }
  }

  // Loader
  setTimeout(() => {
    loader.classList.add("hidden");
    app.classList.remove("hidden");
    showView("home");
    startBackgroundFlash();
    refreshBestTimes();
  }, 1200);

  // Chrome buttons
  document.querySelectorAll(".chrome-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "home") showView("home");
      if (action === "refresh") {
        if (currentView === "level1") resetLevel1();
        if (currentView === "level2") resetLevel2();
        if (currentView === "npl") resetNpl();
      }
      if (action === "back") showView("home");
      if (action === "save") downloadResults();
    });
  });

  // Home navigation
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (!btn.dataset.target) return;
    btn.addEventListener("click", () => {
      if (btn.dataset.target === "coming") {
        alert("This chapter is coming soon. For now, play Site Assessment.");
        return;
      }
      showView(btn.dataset.target);
    });
  });

  // Timer helpers
  function formatTime(totalSeconds) {
    const min = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${min}:${sec}`;
  }

  function startTimer(name) {
    const timer = timers[name];
    clearInterval(timer.interval);
    timer.startTime = Date.now();
    timer.display.textContent = formatTime(0);
    timer.interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
      timer.display.textContent = formatTime(elapsed);
    }, 250);
  }

  function stopTimer(name) {
    clearInterval(timers[name].interval);
  }

  // Level 1 puzzle
  const puzzleBoard = document.getElementById("puzzle-board");
  const puzzlePool = document.getElementById("puzzle-pool");
  const legend = document.getElementById("legend");
  const startLevel2Btn = document.getElementById("start-level2");
  const PUZZLE_SIZE = 4;
  let placedPieces = 0;
  let puzzleStartTime = 0;

  function buildPuzzle() {
    puzzleBoard.innerHTML = "";
    puzzlePool.innerHTML = "";
    placedPieces = 0;
    legend.classList.add("hidden");
    puzzleStartTime = Date.now();

    for (let r = 0; r < PUZZLE_SIZE; r += 1) {
      for (let c = 0; c < PUZZLE_SIZE; c += 1) {
        const slot = document.createElement("div");
        slot.className = "drop-slot";
        slot.dataset.slot = `${r}-${c}`;
        puzzleBoard.appendChild(slot);
      }
    }

    const pieces = [];
    for (let r = 0; r < PUZZLE_SIZE; r += 1) {
      for (let c = 0; c < PUZZLE_SIZE; c += 1) {
        const piece = document.createElement("div");
        piece.className = "piece";
        piece.draggable = true;
        piece.dataset.slot = `${r}-${c}`;
        const posX = (c / (PUZZLE_SIZE - 1)) * 100;
        const posY = (r / (PUZZLE_SIZE - 1)) * 100;
        piece.style.backgroundImage = "url('../assets/images/Level 1 Map.png')";
        piece.style.backgroundPosition = `${posX}% ${posY}%`;
        pieces.push(piece);
      }
    }
    shuffle(pieces).forEach((piece) => puzzlePool.appendChild(piece));
    enablePuzzleDragging();
  }

  function enablePuzzleDragging() {
    let dragging = null;

    function handleDrop(e, slotEl) {
      e.preventDefault();
      if (!dragging) return;
      if (slotEl.dataset.filled) return;
      if (slotEl.dataset.slot === dragging.dataset.slot) {
        slotEl.dataset.filled = "true";
        dragging.classList.remove("dragging");
        dragging.draggable = false;
        slotEl.appendChild(dragging);
        placedPieces += 1;
        if (placedPieces === PUZZLE_SIZE * PUZZLE_SIZE) finishPuzzle();
      }
    }

    puzzleBoard.querySelectorAll(".drop-slot").forEach((slot) => {
      slot.addEventListener("dragover", (e) => e.preventDefault());
      slot.addEventListener("drop", (e) => handleDrop(e, slot));
    });

    document.querySelectorAll(".piece").forEach((piece) => {
      piece.addEventListener("dragstart", () => {
        dragging = piece;
        piece.classList.add("dragging");
      });
      piece.addEventListener("dragend", () => {
        piece.classList.remove("dragging");
        dragging = null;
      });
    });
  }

  function finishPuzzle() {
    stopTimer("level1");
    const seconds = Math.floor((Date.now() - puzzleStartTime) / 1000);
    storeBest("level1", seconds);
    legend.classList.remove("hidden");
  }

  function resetLevel1() {
    buildPuzzle();
    startTimer("level1");
  }

  // Legend jump
  startLevel2Btn.addEventListener("click", () => showView("level2"));

  // Level 2 matching
  const targetsEl = document.getElementById("targets");
  const cardsEl = document.getElementById("cards");
  const targetsData = [
    {
      id: "incinerator",
      label: "Municipal incinerator",
      image: "../assets/images/Municipal incinerator.png",
      number: "1",
      drops: [{ x: 39, y: 77 }],
    },
    {
      id: "concrete",
      label: "Concrete mixture",
      image: "../assets/images/Concrete mixture.png",
      number: "2",
      drops: [{ x: 35, y: 65 }],
    },
    {
      id: "gas-plant",
      label: "Manufactured gas plant",
      image: "../assets/images/Manufactured gas plant.png",
      number: "3",
      drops: [{ x: 36, y: 46 }],
    },
    {
      id: "coal-power",
      label: "Coal-fired power plant",
      image: "../assets/images/Coal-fired power plant.png",
      number: "4",
      drops: [{ x: 42, y: 48 }],
    },
    {
      id: "scrap",
      label: "Scrap metal",
      image: "../assets/images/Scrap metal.png",
      number: "5",
      drops: [{ x: 48, y: 50 }],
    },
    {
      id: "coal-yard",
      label: "Coal Yard",
      image: "../assets/images/Coal Yard.png",
      number: "6",
      drops: [{ x: 60, y: 47 }],
    },
  ];

  let level2Matches = 0;
  let level2Start = 0;

  function buildTargets() {
    targetsEl.innerHTML = "";
    // Create invisible drop zones for each number location
    targetsData.forEach((item) => {
      item.drops.forEach((drop) => {
        const zone = document.createElement("div");
        zone.className = "drop-zone";
        zone.dataset.target = item.id;
        zone.dataset.number = item.number;
        zone.style.left = `${drop.x}%`;
        zone.style.top = `${drop.y}%`;
        zone.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        zone.addEventListener("drop", (e) => {
          e.stopPropagation();
          onTargetDrop(e, item.id);
        });
        targetsEl.appendChild(zone);
      });
    });
  }

  function buildCards() {
    cardsEl.innerHTML = "";
    const shuffled = shuffle([...targetsData]);
    shuffled.forEach((item) => {
      const card = document.createElement("div");
      card.className = "card";
      card.draggable = true;
      card.dataset.target = item.id;
      card.dataset.image = item.image;
      card.dataset.number = item.number;
      card.innerHTML = `<img src="${item.image}" alt="${item.label}" /><div>${item.label}</div>`;
      card.addEventListener("dragstart", () => card.classList.add("dragging"));
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      cardsEl.appendChild(card);
    });
  }

  function onTargetDrop(e, expectedId) {
    e.preventDefault();
    const card = document.querySelector(".card.dragging");
    if (!card) return;

    const droppedId = card.dataset.target;

    // Check if the dropped image matches the target location
    if (droppedId !== expectedId) {
      // Wrong match - card stays in place and dragging class is removed
      card.classList.remove("dragging");
      return;
    }

    // Correct match - place the image on the map
    const targetData = targetsData.find(item => item.id === droppedId);
    if (!targetData) return;

    // Remove the card from the grid first
    card.remove();

    // Create and place the image on the map
    const img = document.createElement("img");
    img.className = "placed-image";
    img.src = targetData.image;
    img.alt = targetData.label;
    img.style.left = `${targetData.drops[0].x}%`;
    img.style.top = `${targetData.drops[0].y}%`;
    targetsEl.appendChild(img);

    // Update match count
    level2Matches += 1;
    if (level2Matches === targetsData.length) finishLevel2();
  }

  function resetLevel2() {
    level2Matches = 0;
    buildTargets();
    buildCards();
    level2Start = Date.now();
    startTimer("level2");
  }

  function finishLevel2() {
    stopTimer("level2");
    const seconds = Math.floor((Date.now() - level2Start) / 1000);
    storeBest("level2", seconds);
  }

  // National Priorities List guessing game
  const scoreRowsEl = document.getElementById("score-rows");
  const guessInput = document.getElementById("guess-input");
  const guessSubmit = document.getElementById("guess-submit");
  const guessReset = document.getElementById("guess-reset");
  const guessFeedback = document.getElementById("guess-feedback");

  const GOWANUS_SCORE = 50;
  const NPL_STORAGE_KEY = "gowanus-npl-solved";
  const NPL_ATTEMPTS_KEY = "gowanus-npl-attempts";

  const nplSites = [
    { rank: "1st", name: "Libby Asbestos Site (MT)", score: 100 },
    { rank: "2nd", name: "Tar Creek (Ottawa County) (OK)", score: 100 },
    { rank: "3rd", name: "Hudson River PCBs (NY)", score: 100 },
    { rank: "4th", name: "Times Beach Dioxin Site (MO)", score: 100 },
    { rank: "5th", name: "Haskell Chemical Co. (IL)", score: 100 },
    { rank: "6th", name: "Stauffer Chemical Co. (FL)", score: 100 },
    { rank: "7th", name: "New Bedford Harbor (MA)", score: 100 },
    { rank: "8th", name: "Torch Lake (MI)", score: 100 },
    { rank: "9th", name: "Mid-County Airport GW Plume (MN)", score: 100 },
    { rank: "10th", name: "Love Canal (NY)", score: 93.1 },
    { rank: "11th", name: "Gowanus Canal (NY)", score: GOWANUS_SCORE, target: true },
  ];

  function buildScoreboard(showAnswer) {
    scoreRowsEl.innerHTML = "";
    nplSites.forEach((site) => {
      const row = document.createElement("div");
      row.className = "score-row";
      if (site.target && showAnswer) row.classList.add("highlight");
      if (site.target && !showAnswer) row.classList.add("locked");

      const scoreText = site.target && !showAnswer ? "??" : site.score;

      row.innerHTML = `
        <span class="score-cell rank">${site.rank}</span>
        <span class="score-cell name">${site.name}</span>
        <span class="score-cell score">${scoreText}</span>
      `;
      scoreRowsEl.appendChild(row);
    });
  }

  function setGuessFeedback(message, type) {
    guessFeedback.textContent = message;
    guessFeedback.classList.remove("success", "error");
    if (type) guessFeedback.classList.add(type);
  }

  function resetNpl() {
    const solved = localStorage.getItem(NPL_STORAGE_KEY) === "true";
    buildScoreboard(solved);
    guessInput.value = "";
    guessInput.disabled = solved;
    guessSubmit.disabled = solved;
    if (solved) {
      setGuessFeedback(`Correct! Gowanus Canal scored ${GOWANUS_SCORE}.`, "success");
    } else {
      setGuessFeedback("", null);
    }
  }

  function handleGuess() {
    const value = Number(guessInput.value);
    if (Number.isNaN(value)) {
      setGuessFeedback("Enter a number between 0 and 100.", "error");
      return;
    }
    const attempts = Number(localStorage.getItem(NPL_ATTEMPTS_KEY) || 0) + 1;
    localStorage.setItem(NPL_ATTEMPTS_KEY, attempts);

    if (value === GOWANUS_SCORE) {
      localStorage.setItem(NPL_STORAGE_KEY, "true");
      setGuessFeedback("Correct! Added to the board.", "success");
      buildScoreboard(true);
      guessInput.disabled = true;
      guessSubmit.disabled = true;
    } else if (value > GOWANUS_SCORE) {
      setGuessFeedback("Too high. Hint: Gowanus ranks last on this list.", "error");
    } else {
      setGuessFeedback("Too low. Try a higher HRS score.", "error");
    }
  }

  guessSubmit?.addEventListener("click", handleGuess);
  guessInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGuess();
  });

  guessReset?.addEventListener("click", () => {
    localStorage.removeItem(NPL_STORAGE_KEY);
    localStorage.removeItem(NPL_ATTEMPTS_KEY);
    guessInput.disabled = false;
    guessSubmit.disabled = false;
    resetNpl();
  });

  // Persistence
  function storeBest(level, seconds) {
    const key = `gowanus-${level}-best`;
    const current = Number(localStorage.getItem(key) || Infinity);
    if (seconds < current) localStorage.setItem(key, seconds);
    refreshBestTimes();
  }

  function refreshBestTimes() {
    const l1 = localStorage.getItem("gowanus-level1-best");
    const l2 = localStorage.getItem("gowanus-level2-best");
    bestLevel1El.textContent = l1 ? formatTime(Number(l1)) : "--";
    bestLevel2El.textContent = l2 ? formatTime(Number(l2)) : "--";
  }

  function downloadResults() {
    const data = {
      level1Best: localStorage.getItem("gowanus-level1-best") || "not set",
      level2Best: localStorage.getItem("gowanus-level2-best") || "not set",
      nplSolved: localStorage.getItem(NPL_STORAGE_KEY) === "true",
      nplAttempts: localStorage.getItem(NPL_ATTEMPTS_KEY) || 0,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gowanus-results.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Utilities
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
});