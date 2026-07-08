(() => {
  "use strict";

  const GAME = {
    width: 1448,
    height: 1086,
    livesMax: 3,
    baseTravelTime: 3600,
    minTravelTime: 1750,
    baseSpawnEvery: 1450,
    minSpawnEvery: 720,
  };

  const FRAME_BY_POSITION = {
    1: "./assets/wolf-pos-1.png",
    2: "./assets/wolf-pos-2.png",
    3: "./assets/wolf-pos-3.png",
    4: "./assets/wolf-pos-4.png",
  };

  /*
    Координаты заданы в системе исходной картинки 1448×1086.
    Нумерация:
      1 — верхняя левая курица,
      2 — верхняя правая курица,
      3 — нижняя левая курица,
      4 — нижняя правая курица.
  */
  const LANES = {
    1: {
      title: "Курица 1",
      zone: { x: 0, y: 105, w: 310, h: 330 },
      path: [
        { x: 100, y: 320 },
        { x: 225, y: 385 },
        { x: 350, y: 455 },
        { x: 500, y: 535 },
      ],
      eggAngle: 0.48,
      hint: { x: 76, y: 254, r: 36 },
    },
    2: {
      title: "Курица 2",
      zone: { x: 1138, y: 105, w: 310, h: 330 },
      path: [
        { x: 1345, y: 320 },
        { x: 1220, y: 385 },
        { x: 1095, y: 455 },
        { x: 945, y: 535 },
      ],
      eggAngle: -0.48,
      hint: { x: 1367, y: 254, r: 36 },
    },
    3: {
      title: "Курица 3",
      zone: { x: 0, y: 515, w: 310, h: 360 },
      path: [
        { x: 95, y: 680 },
        { x: 220, y: 742 },
        { x: 345, y: 805 },
        { x: 500, y: 884 },
      ],
      eggAngle: 0.48,
      hint: { x: 74, y: 642, r: 36 },
    },
    4: {
      title: "Курица 4",
      zone: { x: 1138, y: 515, w: 310, h: 360 },
      path: [
        { x: 1350, y: 680 },
        { x: 1222, y: 742 },
        { x: 1094, y: 805 },
        { x: 945, y: 884 },
      ],
      eggAngle: -0.48,
      hint: { x: 1368, y: 642, r: 36 },
    },
  };

  const els = {
    app: document.getElementById("app"),
    stage: document.getElementById("stage"),
    canvas: document.getElementById("gameCanvas"),
    background: document.getElementById("background"),
    score: document.getElementById("score"),
    level: document.getElementById("level"),
    lives: document.getElementById("lives"),
    message: document.getElementById("message"),
    soundToggle: document.getElementById("soundToggle"),
    volume: document.getElementById("volume"),
  };

  const ctx = els.canvas.getContext("2d", { alpha: true });

  const state = {
    running: false,
    gameOver: false,
    wolfPosition: 1,
    score: 0,
    level: 1,
    lives: GAME.livesMax,
    combo: 0,
    eggs: [],
    particles: [],
    spawnTimer: 0,
    lastTime: 0,
    selectedPulse: 0,
    missFlash: 0,
  };

  class RetroSound {
    constructor() {
      const savedEnabled = localStorage.getItem("wolfGameSoundEnabled");
      const savedVolume = Number(localStorage.getItem("wolfGameVolume"));

      this.enabled = savedEnabled === null ? true : savedEnabled === "true";
      this.volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.55;
      this.ctx = null;
      this.master = null;
      this.unlocked = false;
    }

    unlock() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.master.connect(this.ctx.destination);
      }

      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }

      if (!this.unlocked) {
        this.unlocked = true;
        this.tone(880, 0.035, "square", 0.015);
      }
    }

    setEnabled(value) {
      this.enabled = Boolean(value);
      localStorage.setItem("wolfGameSoundEnabled", String(this.enabled));
      this.applyVolume();
    }

    setVolume(value) {
      this.volume = Math.min(1, Math.max(0, Number(value)));
      localStorage.setItem("wolfGameVolume", String(this.volume));
      this.applyVolume();
    }

    applyVolume() {
      if (this.master) {
        this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.012);
      }
    }

    tone(freq, duration = 0.08, type = "square", delay = 0, gainScale = 1) {
      if (!this.enabled || !this.ctx || !this.master) return;

      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.21 * gainScale), t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    noise(duration = 0.08, delay = 0, gainScale = 0.35) {
      if (!this.enabled || !this.ctx || !this.master) return;

      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }

      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      const t0 = this.ctx.currentTime + delay;

      source.buffer = buffer;
      gain.gain.setValueAtTime(0.16 * gainScale, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      source.connect(gain);
      gain.connect(this.master);
      source.start(t0);
      source.stop(t0 + duration + 0.02);
    }

    move() {
      this.tone(660, 0.035, "square", 0, 0.45);
    }

    catch() {
      this.tone(880, 0.05, "square", 0, 0.55);
      this.tone(1175, 0.055, "square", 0.045, 0.55);
    }

    miss() {
      this.noise(0.08, 0, 0.5);
      this.tone(220, 0.12, "sawtooth", 0.03, 0.55);
      this.tone(155, 0.16, "sawtooth", 0.13, 0.45);
    }

    levelUp() {
      this.tone(660, 0.06, "square", 0, 0.55);
      this.tone(880, 0.06, "square", 0.06, 0.55);
      this.tone(1320, 0.08, "square", 0.12, 0.55);
    }

    gameOver() {
      this.tone(420, 0.12, "square", 0, 0.65);
      this.tone(315, 0.14, "square", 0.12, 0.55);
      this.tone(210, 0.22, "square", 0.27, 0.5);
    }
  }

  const sound = new RetroSound();

  function preloadFrames() {
    Object.values(FRAME_BY_POSITION).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }

  function initTelegram() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.("#0aa9f6");
    tg.setBackgroundColor?.("#061928");
  }

  function setHud() {
    els.score.textContent = String(state.score);
    els.level.textContent = String(state.level);
    els.lives.textContent = "🥚".repeat(Math.max(0, state.lives)) || "—";
  }

  function updateSoundControls() {
    els.soundToggle.textContent = sound.enabled ? "🔊" : "🔇";
    els.soundToggle.setAttribute("aria-pressed", String(sound.enabled));
    els.volume.value = String(Math.round(sound.volume * 100));
  }

  function showMessage(title, text, smallText = "") {
    const box = els.message.querySelector(".message-box");
    box.innerHTML = `
      <h1>${title}</h1>
      <p>${text}</p>
      ${smallText ? `<p class="small">${smallText}</p>` : ""}
    `;
    els.message.classList.remove("hidden");
  }

  function hideMessage() {
    els.message.classList.add("hidden");
  }

  function setWolfPosition(position) {
    if (!LANES[position]) return;
    if (state.wolfPosition !== position) sound.move();

    state.wolfPosition = position;
    state.selectedPulse = 1;
    els.background.src = FRAME_BY_POSITION[position];
  }

  function resetGame() {
    state.running = true;
    state.gameOver = false;
    state.score = 0;
    state.level = 1;
    state.lives = GAME.livesMax;
    state.combo = 0;
    state.eggs = [];
    state.particles = [];
    state.spawnTimer = 620;
    state.lastTime = performance.now();
    state.missFlash = 0;
    hideMessage();
    setHud();
  }

  function finishGame() {
    state.running = false;
    state.gameOver = true;
    sound.gameOver();
    showMessage(
      "Игра окончена",
      `Ваш счёт: ${state.score}`,
      "Нажмите на любую курицу, чтобы начать заново."
    );
  }

  function travelTimeForLevel() {
    return Math.max(GAME.minTravelTime, GAME.baseTravelTime - (state.level - 1) * 170);
  }

  function spawnEveryForLevel() {
    return Math.max(GAME.minSpawnEvery, GAME.baseSpawnEvery - (state.level - 1) * 62);
  }

  function randomLane() {
    const ids = [1, 2, 3, 4];
    const recent = state.eggs
      .filter((egg) => egg.progress < 0.32)
      .map((egg) => egg.lane);

    let candidate = ids[Math.floor(Math.random() * ids.length)];
    if (recent.includes(candidate) && Math.random() < 0.62) {
      const alternatives = ids.filter((id) => !recent.includes(id));
      if (alternatives.length) {
        candidate = alternatives[Math.floor(Math.random() * alternatives.length)];
      }
    }
    return candidate;
  }

  function spawnEgg() {
    const lane = randomLane();
    const id = crypto.randomUUID?.() || String(Date.now() + Math.random());
    state.eggs.push({
      id,
      lane,
      progress: 0,
      wobble: Math.random() * Math.PI * 2,
      travelTime: travelTimeForLevel() * (0.93 + Math.random() * 0.16),
    });
  }

  function levelFromScore(score) {
    return Math.min(12, Math.floor(score / 10) + 1);
  }

  function makeParticles(x, y, count, mode = "spark") {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = mode === "shell" ? 45 + Math.random() * 140 : 80 + Math.random() * 190;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (mode === "spark" ? 80 : 10),
        life: mode === "shell" ? 0.85 : 0.55,
        maxLife: mode === "shell" ? 0.85 : 0.55,
        size: mode === "shell" ? 5 + Math.random() * 6 : 4 + Math.random() * 5,
        mode,
      });
    }
  }

  function resolveEgg(egg) {
    const lane = LANES[egg.lane];
    const end = lane.path[lane.path.length - 1];

    if (state.wolfPosition === egg.lane) {
      state.score += 1;
      state.combo += 1;
      makeParticles(end.x, end.y, 7, "spark");
      sound.catch();

      const nextLevel = levelFromScore(state.score);
      if (nextLevel !== state.level) {
        state.level = nextLevel;
        sound.levelUp();
      }
    } else {
      state.lives -= 1;
      state.combo = 0;
      state.missFlash = 1;
      makeParticles(end.x, end.y + 24, 14, "shell");
      sound.miss();
      if (state.lives <= 0) {
        setHud();
        finishGame();
      }
    }
    setHud();
  }

  function pointOnPath(points, progress) {
    const t = Math.min(1, Math.max(0, progress));
    const segments = points.length - 1;
    const raw = t * segments;
    const index = Math.min(segments - 1, Math.floor(raw));
    const local = raw - index;
    const a = points[index];
    const b = points[index + 1];

    return {
      x: a.x + (b.x - a.x) * local,
      y: a.y + (b.y - a.y) * local,
    };
  }

  function update(dt) {
    if (!state.running) return;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEgg();
      state.spawnTimer = spawnEveryForLevel() * (0.78 + Math.random() * 0.52);
    }

    for (const egg of state.eggs) {
      egg.progress += dt / egg.travelTime;
      egg.wobble += dt * 0.005;
    }

    const finished = state.eggs.filter((egg) => egg.progress >= 1);
    state.eggs = state.eggs.filter((egg) => egg.progress < 1);

    for (const egg of finished) {
      if (state.running) resolveEgg(egg);
    }

    for (const p of state.particles) {
      p.life -= dt / 1000;
      p.vy += 360 * dt / 1000;
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    state.selectedPulse = Math.max(0, state.selectedPulse - dt / 420);
    state.missFlash = Math.max(0, state.missFlash - dt / 360);
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, GAME.width, GAME.height);
  }

  function drawEgg(x, y, angle, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    const gradient = ctx.createRadialGradient(-9, -13, 4, 0, 0, 28);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.55, "#fff9e6");
    gradient.addColorStop(1, "#ded2b5");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 23, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(138, 105, 55, 0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-8, -12, 5, 10, -0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawEggs() {
    for (const egg of state.eggs) {
      const lane = LANES[egg.lane];
      const p = pointOnPath(lane.path, egg.progress);
      const bounce = Math.sin(egg.wobble) * 3;
      const rot = lane.eggAngle + egg.progress * Math.PI * 4.2 * (lane.eggAngle > 0 ? 1 : -1);
      const scale = 0.9 + egg.progress * 0.18;
      drawEgg(p.x, p.y + bounce, rot, scale);
    }
  }

  function drawSelectionHints() {
    const selected = LANES[state.wolfPosition];
    const pulse = state.selectedPulse;
    const alpha = 0.28 + pulse * 0.46;
    const ring = 44 + pulse * 22;

    ctx.save();
    ctx.lineWidth = 8;
    ctx.strokeStyle = `rgba(255, 226, 76, ${alpha})`;
    ctx.fillStyle = `rgba(255, 226, 76, ${0.08 + pulse * 0.12})`;
    ctx.beginPath();
    ctx.arc(selected.hint.x, selected.hint.y, ring, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = "800 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4;
    ctx.strokeText("ВОЛК", selected.hint.x, selected.hint.y + 58);
    ctx.fillText("ВОЛК", selected.hint.x, selected.hint.y + 58);
    ctx.restore();
  }

  function drawParticles(dt) {
    ctx.save();
    for (const p of state.particles) {
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = lifeRatio;
      if (p.mode === "shell") {
        ctx.fillStyle = "#fff1c6";
        ctx.strokeStyle = "rgba(122, 75, 22, 0.32)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 1.2, p.size * 0.58, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = "#fff7bf";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    if (state.missFlash > 0) {
      ctx.save();
      ctx.globalAlpha = state.missFlash * 0.18;
      ctx.fillStyle = "#ff2c2c";
      ctx.fillRect(0, 0, GAME.width, GAME.height);
      ctx.restore();
    }
  }

  function drawDebugHitZones() {
    if (!location.search.includes("debug")) return;

    ctx.save();
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    Object.entries(LANES).forEach(([id, lane]) => {
      ctx.fillStyle = "rgba(255, 230, 80, 0.18)";
      ctx.strokeStyle = "rgba(255, 230, 80, 0.75)";
      ctx.lineWidth = 3;
      ctx.fillRect(lane.zone.x, lane.zone.y, lane.zone.w, lane.zone.h);
      ctx.strokeRect(lane.zone.x, lane.zone.y, lane.zone.w, lane.zone.h);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`тап: ${id}`, lane.zone.x + lane.zone.w / 2, lane.zone.y + lane.zone.h / 2);
    });
    ctx.restore();
  }

  function render(dt) {
    clearCanvas();
    drawEggs();
    drawSelectionHints();
    drawParticles(dt);
    drawDebugHitZones();
  }

  function tick(now) {
    const dt = Math.min(48, now - (state.lastTime || now));
    state.lastTime = now;
    update(dt);
    render(dt);
    requestAnimationFrame(tick);
  }

  function eventToGamePoint(event) {
    const rect = els.stage.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;

    return {
      x: ((clientX - rect.left) / rect.width) * GAME.width,
      y: ((clientY - rect.top) / rect.height) * GAME.height,
    };
  }

  function hitChicken(point) {
    return Number(
      Object.keys(LANES).find((id) => {
        const z = LANES[id].zone;
        return point.x >= z.x && point.x <= z.x + z.w && point.y >= z.y && point.y <= z.y + z.h;
      }) || 0
    );
  }

  function handleStagePointer(event) {
    event.preventDefault();
    sound.unlock();

    const point = eventToGamePoint(event);
    const lane = hitChicken(point);
    if (!lane) return;

    if (!state.running) {
      resetGame();
    }

    setWolfPosition(lane);
  }

  function bindEvents() {
    els.stage.addEventListener("pointerdown", handleStagePointer, { passive: false });

    els.soundToggle.addEventListener("click", (event) => {
      event.preventDefault();
      sound.unlock();
      sound.setEnabled(!sound.enabled);
      updateSoundControls();
      if (sound.enabled) sound.levelUp();
    });

    els.volume.addEventListener("input", () => {
      sound.unlock();
      sound.setVolume(Number(els.volume.value) / 100);
      updateSoundControls();
    });

    document.addEventListener("visibilitychange", () => {
      state.lastTime = performance.now();
    });

    window.addEventListener("blur", () => {
      state.lastTime = performance.now();
    });
  }

  function init() {
    initTelegram();
    preloadFrames();
    bindEvents();

    els.background.src = FRAME_BY_POSITION[state.wolfPosition];
    updateSoundControls();
    setHud();
    showMessage(
      "Волк ловит яйца",
      "Нажмите на любую курицу, чтобы начать.",
      "Навигация без кнопок: нажимайте прямо на куриц 1–4."
    );

    requestAnimationFrame(tick);
  }

  init();
})();
