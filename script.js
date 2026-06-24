/* Тетрис: Миссии и Испытания
   Чистый JavaScript без библиотек. Код разделён на классы, чтобы игровые
   правила, миссии, достижения и сохранение данных не смешивались между собой. */

const COLS = 10;
const ROWS = 20;
const BLOCK = 32;

const COLORS = {
  I: "#40c9ff",
  O: "#ffd166",
  T: "#b388ff",
  S: "#63e6be",
  Z: "#ff6b8a",
  J: "#5c7cfa",
  L: "#ff9f43",
  ghost: "rgba(238, 244, 255, 0.18)"
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const SCORE_TABLE = [0, 100, 300, 500, 800];

const MODES = {
  classic: { label: "Классика", timeLimit: 0, speed: 1, challenge: false },
  timed: { label: "5 минут", timeLimit: 300, speed: 1, challenge: false },
  endless: { label: "Бесконечный", timeLimit: 0, speed: 0.85, challenge: false },
  hardcore: { label: "Хардкор", timeLimit: 0, speed: 2, challenge: false },
  challenge: { label: "Испытания", timeLimit: 0, speed: 1, challenge: true }
};

class Piece {
  constructor(type) {
    this.type = type;
    this.color = COLORS[type];
    this.matrix = SHAPES[type].map((row) => [...row]);
    this.x = Math.floor((COLS - this.matrix[0].length) / 2);
    this.y = 0;
  }

  // Поворот по часовой стрелке: строки становятся колонками.
  rotated() {
    return this.matrix[0].map((_, index) => this.matrix.map((row) => row[index]).reverse());
  }

  clone() {
    const copy = new Piece(this.type);
    copy.matrix = this.matrix.map((row) => [...row]);
    copy.x = this.x;
    copy.y = this.y;
    return copy;
  }
}

class Board {
  constructor() {
    this.grid = this.createGrid();
    this.clearAnimationRows = [];
  }

  createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  reset() {
    this.grid = this.createGrid();
    this.clearAnimationRows = [];
  }

  // Проверяет столкновения с границами поля и уже лежащими блоками.
  collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const boardX = piece.x + x + offsetX;
        const boardY = piece.y + y + offsetY;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
        if (boardY >= 0 && this.grid[boardY][boardX]) return true;
      }
    }
    return false;
  }

  merge(piece) {
    piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value && piece.y + y >= 0) {
          this.grid[piece.y + y][piece.x + x] = piece.color;
        }
      });
    });
  }

  // Возвращает количество очищенных линий и запускает короткую анимацию.
  clearLines() {
    const fullRows = [];
    this.grid.forEach((row, y) => {
      if (row.every(Boolean)) fullRows.push(y);
    });

    if (!fullRows.length) return 0;

    this.clearAnimationRows = fullRows;
    this.grid = this.grid.filter((_, y) => !fullRows.includes(y));
    while (this.grid.length < ROWS) this.grid.unshift(Array(COLS).fill(null));
    setTimeout(() => {
      this.clearAnimationRows = [];
    }, 220);

    return fullRows.length;
  }
}

class ScoreManager {
  constructor() {
    this.storageKey = "missionTetris.progress";
    this.data = this.load();
  }

  load() {
    const defaults = {
      leaderboard: [],
      totalLines: 0,
      totalPlaySeconds: 0,
      achievements: []
    };

    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(this.storageKey)) };
    } catch {
      return defaults;
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  addRecord(score, mode) {
    this.data.leaderboard.push({ score, mode, date: new Date().toLocaleDateString("ru-RU") });
    this.data.leaderboard.sort((a, b) => b.score - a.score);
    this.data.leaderboard = this.data.leaderboard.slice(0, 7);
    this.save();
  }

  addTotals(lines, seconds) {
    this.data.totalLines += lines;
    this.data.totalPlaySeconds += seconds;
    this.save();
  }
}

class MissionManager {
  constructor(scoreManager) {
    this.scoreManager = scoreManager;
    this.missions = [];
    this.dailyMissions = [];
    this.challengeMission = null;
    this.challengeTimer = 0;
  }

  createBaseMissions() {
    return [
      { id: "combo2", title: "Собрать 2 линии подряд", target: 1, reward: 250, get: (s) => s.comboLineClears >= 2 },
      { id: "lines10", title: "Очистить 10 линий", target: 10, reward: 500, get: (s) => s.lines },
      { id: "score1000", title: "Набрать 1000 очков", target: 1000, reward: 400, get: (s) => s.score },
      { id: "drops5", title: "Использовать 5 мгновенных падений", target: 5, reward: 350, get: (s) => s.hardDrops },
      { id: "survive3", title: "Продержаться 3 минуты", target: 180, reward: 700, get: (s) => s.elapsed },
      { id: "tetris1", title: "Очистить сразу 4 линии", target: 1, reward: 800, get: (s) => s.tetrises },
      { id: "level5", title: "Достичь 5 уровня", target: 5, reward: 700, get: (s) => s.level },
      { id: "lines30", title: "Очистить 30 линий за игру", target: 30, reward: 1000, get: (s) => s.lines },
      { id: "rotations10", title: "Сделать 10 вращений фигур", target: 10, reward: 350, get: (s) => s.rotations },
      { id: "nolines60", title: "Не очищать линии 60 секунд", target: 60, reward: 600, get: (s) => s.noLineSeconds }
    ].map((mission) => ({ ...mission, complete: false }));
  }

  createDailyMissions() {
    const pool = [
      { id: "daily15", title: "Очистить 15 линий", target: 15, reward: 650, get: (s) => s.lines },
      { id: "daily2500", title: "Набрать 2500 очков", target: 2500, reward: 750, get: (s) => s.score },
      { id: "daily20rot", title: "Выполнить 20 поворотов", target: 20, reward: 500, get: (s) => s.rotations },
      { id: "daily3tetris", title: "Собрать 3 тетриса", target: 3, reward: 1200, get: (s) => s.tetrises },
      { id: "daily5min", title: "Продержаться 5 минут", target: 300, reward: 1000, get: (s) => s.elapsed }
    ];

    return this.shuffle(pool).slice(0, 3).map((mission) => ({ ...mission, complete: false }));
  }

  reset() {
    this.missions = this.createBaseMissions();
    this.dailyMissions = this.createDailyMissions();
    this.challengeMission = null;
    this.challengeTimer = 0;
  }

  shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
  }

  createChallengeMission() {
    const pool = this.createBaseMissions().filter((mission) => mission.id !== "survive3");
    const mission = this.shuffle(pool)[0];
    return { ...mission, id: `challenge-${Date.now()}`, title: `Испытание: ${mission.title}`, complete: false };
  }

  update(state, addScore, modeConfig) {
    const allMissions = [...this.missions, ...this.dailyMissions];
    if (this.challengeMission) allMissions.push(this.challengeMission);

    allMissions.forEach((mission) => {
      const value = mission.get(state);
      const done = typeof value === "boolean" ? value : value >= mission.target;
      if (!mission.complete && done) {
        mission.complete = true;
        addScore(mission.reward);
      }
    });

    if (modeConfig.challenge) {
      this.challengeTimer += state.deltaSeconds;
      if (!this.challengeMission || this.challengeTimer >= 30) {
        this.challengeMission = this.createChallengeMission();
        this.challengeTimer = 0;
      }
    }
  }
}

class AchievementManager {
  constructor(scoreManager) {
    this.scoreManager = scoreManager;
    this.items = [
      { id: "newbie", title: "Новичок", desc: "100 очков", get: (s, p) => s.score >= 100 || p.leaderboard.some((r) => r.score >= 100) },
      { id: "fan", title: "Любитель", desc: "1000 очков", get: (s, p) => s.score >= 1000 || p.leaderboard.some((r) => r.score >= 1000) },
      { id: "pro", title: "Профессионал", desc: "5000 очков", get: (s, p) => s.score >= 5000 || p.leaderboard.some((r) => r.score >= 5000) },
      { id: "master", title: "Мастер тетриса", desc: "10000 очков", get: (s, p) => s.score >= 10000 || p.leaderboard.some((r) => r.score >= 10000) },
      { id: "lineking", title: "Король линий", desc: "100 линий суммарно", get: (s, p) => s.lines + p.totalLines >= 100 },
      { id: "survivor", title: "Выживший", desc: "Играть более 10 минут", get: (s, p) => s.elapsed + p.totalPlaySeconds >= 600 }
    ];
  }

  update(state) {
    this.items.forEach((item) => {
      if (!this.scoreManager.data.achievements.includes(item.id) && item.get(state, this.scoreManager.data)) {
        this.scoreManager.data.achievements.push(item.id);
        this.scoreManager.save();
      }
    });
  }
}

class AudioSystem {
  constructor() {
    this.context = null;
    this.sfxVolume = 0.45;
    this.musicVolume = 0.18;
    this.musicTimer = null;
  }

  ensureContext() {
    if (!this.context) this.context = new AudioContext();
  }

  beep(freq, duration = 0.06, type = "square") {
    if (!this.sfxVolume) return;
    this.ensureContext();
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = this.sfxVolume * 0.08;
    osc.connect(gain).connect(this.context.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    osc.stop(this.context.currentTime + duration);
  }

  startMusic() {
    if (this.musicTimer) return;
    const notes = [196, 247, 294, 247, 220, 262, 330, 262];
    let index = 0;
    this.musicTimer = setInterval(() => {
      if (!this.musicVolume) return;
      this.ensureContext();
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = "triangle";
      osc.frequency.value = notes[index % notes.length];
      gain.gain.value = this.musicVolume * 0.035;
      osc.connect(gain).connect(this.context.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.24);
      osc.stop(this.context.currentTime + 0.24);
      index++;
    }, 420);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.nextCanvas = document.getElementById("nextCanvas");
    this.nextCtx = this.nextCanvas.getContext("2d");

    this.board = new Board();
    this.scoreManager = new ScoreManager();
    this.missionManager = new MissionManager(this.scoreManager);
    this.achievementManager = new AchievementManager(this.scoreManager);
    this.audio = new AudioSystem();

    this.mode = "classic";
    this.bag = [];
    this.current = null;
    this.next = null;
    this.lastTime = 0;
    this.dropCounter = 0;
    this.uiTimer = 0;
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.state = {};

    this.bindEvents();
    this.resetState();
    this.missionManager.reset();
    this.renderUI();
    this.draw();
    requestAnimationFrame((time) => this.loop(time));
  }

  resetState() {
    this.state = {
      score: 0,
      level: 1,
      lines: 0,
      elapsed: 0,
      deltaSeconds: 0,
      hardDrops: 0,
      rotations: 0,
      tetrises: 0,
      comboLineClears: 0,
      noLineSeconds: 0
    };
  }

  bindEvents() {
    document.querySelectorAll(".mode").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.running) return;
        this.mode = button.dataset.mode;
        document.querySelectorAll(".mode").forEach((item) => item.classList.toggle("is-active", item === button));
      });
    });

    document.getElementById("startBtn").addEventListener("click", () => this.start());
    document.getElementById("restartBtn").addEventListener("click", () => this.start());
    document.getElementById("resumeBtn").addEventListener("click", () => this.togglePause());
    document.getElementById("pauseBtn").addEventListener("click", () => this.togglePause());
    document.getElementById("leftBtn").addEventListener("click", () => this.move(-1));
    document.getElementById("rightBtn").addEventListener("click", () => this.move(1));
    document.getElementById("downBtn").addEventListener("click", () => this.softDrop());
    document.getElementById("rotateBtn").addEventListener("click", () => this.rotate());
    document.getElementById("dropBtn").addEventListener("click", () => this.hardDrop());

    document.getElementById("sfxVolume").addEventListener("input", (event) => {
      this.audio.sfxVolume = Number(event.target.value);
    });

    document.getElementById("musicVolume").addEventListener("input", (event) => {
      this.audio.musicVolume = Number(event.target.value);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") this.move(-1);
      if (event.key === "ArrowRight") this.move(1);
      if (event.key === "ArrowDown") this.softDrop();
      if (event.key === "ArrowUp") this.rotate();
      if (event.code === "Space") {
        event.preventDefault();
        this.hardDrop();
      }
      if (event.key.toLowerCase() === "p") this.togglePause();
    });
  }

  start() {
    this.board.reset();
    this.resetState();
    this.missionManager.reset();
    this.bag = [];
    this.current = this.createPieceFromBag();
    this.next = this.createPieceFromBag();
    this.running = true;
    this.paused = false;
    this.ended = false;
    this.lastTime = performance.now();
    this.dropCounter = 0;
    this.uiTimer = 0;
    this.audio.ensureContext();
    this.audio.startMusic();
    this.showScreen(null);
    this.renderUI();
  }

  endGame() {
    if (this.ended) return;
    this.running = false;
    this.ended = true;
    this.audio.stopMusic();
    this.scoreManager.addTotals(this.state.lines, Math.floor(this.state.elapsed));
    this.scoreManager.addRecord(this.state.score, MODES[this.mode].label);
    document.getElementById("finalScore").textContent = `Ваш счёт: ${this.state.score.toLocaleString("ru-RU")}`;
    this.showScreen("gameOverScreen");
    this.renderUI();
  }

  showScreen(id) {
    ["startScreen", "pauseScreen", "gameOverScreen"].forEach((screenId) => {
      document.getElementById(screenId).classList.toggle("is-hidden", screenId !== id);
    });
  }

  togglePause() {
    if (!this.running || this.ended) return;
    this.paused = !this.paused;
    this.showScreen(this.paused ? "pauseScreen" : null);
    if (this.paused) this.audio.stopMusic();
    else this.audio.startMusic();
  }

  // 7-bag randomizer: каждая пачка содержит все 7 фигур в случайном порядке.
  createPieceFromBag() {
    if (!this.bag.length) {
      this.bag = Object.keys(SHAPES).sort(() => Math.random() - 0.5);
    }
    return new Piece(this.bag.pop());
  }

  spawnPiece() {
    this.current = this.next;
    this.next = this.createPieceFromBag();
    this.current.x = Math.floor((COLS - this.current.matrix[0].length) / 2);
    this.current.y = 0;

    if (this.board.collides(this.current)) {
      this.endGame();
    }
  }

  move(direction) {
    if (!this.canControl()) return;
    if (!this.board.collides(this.current, direction, 0)) {
      this.current.x += direction;
      this.audio.beep(220, 0.035, "sine");
    }
  }

  softDrop() {
    if (!this.canControl()) return;
    if (!this.board.collides(this.current, 0, 1)) {
      this.current.y++;
      this.addScore(1);
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (!this.canControl()) return;
    let distance = 0;
    while (!this.board.collides(this.current, 0, 1)) {
      this.current.y++;
      distance++;
    }
    this.state.hardDrops++;
    this.addScore(distance * 2);
    this.audio.beep(110, 0.09, "sawtooth");
    this.lockPiece();
  }

  rotate() {
    if (!this.canControl() || this.current.type === "O") return;
    const rotated = this.current.rotated();

    // Wall-kick: пробуем несколько смещений, чтобы фигура повернулась рядом со стеной.
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!this.board.collides(this.current, kick, 0, rotated)) {
        this.current.matrix = rotated;
        this.current.x += kick;
        this.state.rotations++;
        this.audio.beep(330, 0.045, "triangle");
        return;
      }
    }
  }

  canControl() {
    return this.running && !this.paused && !this.ended;
  }

  lockPiece() {
    this.board.merge(this.current);
    const cleared = this.board.clearLines();

    if (cleared) {
      this.state.lines += cleared;
      this.state.comboLineClears++;
      this.state.noLineSeconds = 0;
      if (cleared === 4) this.state.tetrises++;
      this.state.level = Math.floor(this.state.lines / 10) + 1;
      this.addScore(SCORE_TABLE[cleared] * this.state.level);
      this.canvas.classList.add("flash");
      setTimeout(() => this.canvas.classList.remove("flash"), 250);
      this.audio.beep(520 + cleared * 80, 0.12, "square");
    } else {
      this.state.comboLineClears = 0;
      this.audio.beep(150, 0.04, "sine");
    }

    this.spawnPiece();
    this.renderUI();
  }

  addScore(points) {
    this.state.score += points;
  }

  getDropInterval() {
    const modeSpeed = MODES[this.mode].speed;
    const base = Math.max(90, 820 - (this.state.level - 1) * 70);
    return base / modeSpeed;
  }

  loop(time) {
    const delta = Math.min(0.05, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;

    if (this.running && !this.paused) {
      this.update(delta);
    }

    this.draw();
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(delta) {
    const modeConfig = MODES[this.mode];
    this.state.deltaSeconds = delta;
    this.state.elapsed += delta;
    this.state.noLineSeconds += delta;
    this.dropCounter += delta * 1000;
    this.uiTimer += delta;

    if (this.dropCounter >= this.getDropInterval()) {
      this.softDrop();
      this.dropCounter = 0;
    }

    if (modeConfig.timeLimit && this.state.elapsed >= modeConfig.timeLimit) {
      this.endGame();
    }

    this.missionManager.update(this.state, (points) => {
      this.addScore(points);
      this.audio.beep(760, 0.16, "triangle");
    }, modeConfig);
    this.achievementManager.update(this.state);

    // Боковые панели обновляются 6-7 раз в секунду, а Canvas рисуется каждый кадр.
    // Так игра остаётся плавной и не тратит время на постоянную пересборку HTML.
    if (this.uiTimer >= 0.15) {
      this.renderUI();
      this.uiTimer = 0;
    }
  }

  getGhostPiece() {
    const ghost = this.current.clone();
    while (!this.board.collides(ghost, 0, 1)) ghost.y++;
    return ghost;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();
    this.drawBoard();

    if (this.current) {
      this.drawPiece(this.getGhostPiece(), COLORS.ghost, true);
      this.drawPiece(this.current, this.current.color);
    }

    this.drawNext();
  }

  drawGrid() {
    this.ctx.fillStyle = "#070a12";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "rgba(149, 164, 197, 0.12)";
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * BLOCK, 0);
      this.ctx.lineTo(x * BLOCK, ROWS * BLOCK);
      this.ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * BLOCK);
      this.ctx.lineTo(COLS * BLOCK, y * BLOCK);
      this.ctx.stroke();
    }
  }

  drawBoard() {
    this.board.grid.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color) this.drawBlock(this.ctx, x, y, color);
      });
    });

    this.board.clearAnimationRows.forEach((row) => {
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      this.ctx.fillRect(0, row * BLOCK, COLS * BLOCK, BLOCK);
    });
  }

  drawPiece(piece, color, ghost = false) {
    piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value && piece.y + y >= 0) {
          this.drawBlock(this.ctx, piece.x + x, piece.y + y, color, ghost);
        }
      });
    });
  }

  drawBlock(context, x, y, color, ghost = false, size = BLOCK) {
    const px = x * size;
    const py = y * size;
    context.save();
    context.fillStyle = color;
    context.strokeStyle = ghost ? "rgba(238,244,255,0.45)" : "rgba(255,255,255,0.28)";
    context.lineWidth = ghost ? 2 : 1;
    context.fillRect(px + 2, py + 2, size - 4, size - 4);
    context.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
    if (!ghost) {
      const gradient = context.createLinearGradient(px, py, px + size, py + size);
      gradient.addColorStop(0, "rgba(255,255,255,0.28)");
      gradient.addColorStop(1, "rgba(0,0,0,0.22)");
      context.fillStyle = gradient;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
    }
    context.restore();
  }

  drawNext() {
    this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    this.nextCtx.fillStyle = "#070a12";
    this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    if (!this.next) return;

    const size = 24;
    const offsetX = (5 - this.next.matrix[0].length) / 2;
    const offsetY = (5 - this.next.matrix.length) / 2;
    this.next.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) this.drawBlock(this.nextCtx, offsetX + x, offsetY + y, this.next.color, false, size);
      });
    });
  }

  renderUI() {
    document.getElementById("score").textContent = Math.floor(this.state.score).toLocaleString("ru-RU");
    document.getElementById("level").textContent = this.state.level;
    document.getElementById("lines").textContent = this.state.lines;

    const remaining = MODES[this.mode].timeLimit ? Math.max(0, MODES[this.mode].timeLimit - this.state.elapsed) : this.state.elapsed;
    document.getElementById("time").textContent = this.formatTime(remaining);

    this.renderMissions("missions", this.missionManager.missions);
    this.renderMissions("dailyMissions", [
      ...this.missionManager.dailyMissions,
      ...(this.missionManager.challengeMission ? [this.missionManager.challengeMission] : [])
    ]);
    this.renderAchievements();
    this.renderLeaderboard();
  }

  renderMissions(id, missions) {
    const container = document.getElementById(id);
    container.innerHTML = missions.map((mission) => {
      const value = mission.get(this.state);
      const progress = typeof value === "boolean" ? (value ? 1 : 0) : Math.min(value / mission.target, 1);
      const shown = typeof value === "boolean" ? (value ? mission.target : 0) : Math.floor(value);
      return `
        <article class="mission ${mission.complete ? "is-complete" : ""}">
          <div class="mission-title"><span>${mission.title}</span><small>+${mission.reward}</small></div>
          <small>${shown} / ${mission.target}</small>
          <div class="progress"><span style="width:${progress * 100}%"></span></div>
        </article>
      `;
    }).join("");
  }

  renderAchievements() {
    const unlocked = this.scoreManager.data.achievements;
    document.getElementById("achievements").innerHTML = this.achievementManager.items.map((item) => `
      <article class="achievement ${unlocked.includes(item.id) ? "is-unlocked" : ""}">
        <div class="achievement-title"><span>${item.title}</span><small>${unlocked.includes(item.id) ? "Открыто" : "Закрыто"}</small></div>
        <small>${item.desc}</small>
      </article>
    `).join("");
  }

  renderLeaderboard() {
    const records = this.scoreManager.data.leaderboard;
    document.getElementById("leaderboard").innerHTML = records.length
      ? records.map((record) => `<li>${record.score.toLocaleString("ru-RU")} · ${record.mode} · ${record.date}</li>`).join("")
      : "<li>Пока нет рекордов</li>";
  }

  formatTime(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = String(Math.floor(whole / 60)).padStart(2, "0");
    const secs = String(whole % 60).padStart(2, "0");
    return `${minutes}:${secs}`;
  }
}

new Game();
