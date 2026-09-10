// Wielkie przygody gęsi — prototyp v4
// 2D top-down, HTML5 Canvas, czysty JS. Wszystko po polsku.
// Menu (single/ko-op/ustawienia), maskotka, ambient, DUCH, BOSS, dotyk.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const mascot = document.getElementById("mascot");
const mctx = mascot ? mascot.getContext("2d") : null;
if (mctx) mctx.imageSmoothingEnabled = false;

const hpEl = document.getElementById("hp");
const hp2wrap = document.getElementById("hp2wrap");
const hp2El = document.getElementById("hp2");
const bugsEl = document.getElementById("bugs");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ovTitle");
const ovText = document.getElementById("ovText");
const btnStart = document.getElementById("btnStart");
const recordsEl = document.getElementById("records");

const W = 800, H = 600;
const MAX_LEVEL = 3;
const TARGETS = [0, 8, 10, 12];
const ENEMY_SPEED = [0, 122, 134, 148];

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyP" || e.code === "Escape") { togglePause(); return; }
  if (e.code === "KeyM") { toggleMute(); return; }
  if (e.code === "Minus" || e.code === "NumpadSubtract") { changeVolume(-0.1); return; }
  if (e.code === "Equal" || e.code === "NumpadAdd") { changeVolume(0.1); return; }
  if (state !== "gra") return;
  if (e.code === "Space") tryQuack(P1());
  if (e.code === "KeyE") tryTrap(P1());
  if (mode === "coop") {
    if (e.code === "Period") tryQuack(P2());
    if (e.code === "Comma") tryTrap(P2());
  }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

let state = "menu"; // menu | gra | pauza | wygrana | przegrana
let mode = "solo"; // solo | coop
let players = [];
let enemies = [];
let bugs = [], traps = [], poisons = [], walls = [];
let exitDoor = { x: 360, y: 16, w: 80, h: 24, open: false };
let level = 1, startTime = 0, elapsed = 0, score = 0, levelBugs = 0;
let quackFx = 0, muted = false, musicOn = true;
let levelMsg = 0, volume = 0.8, volFx = 1, volMusic = 0.8, volMsg = 0, shakeT = 0, poisonSndCd = 0;
let mascotT = 0, mascotExcite = 0, sens = 1, vibOn = true;
let parts = [];

function saveSettings() {
  try { localStorage.setItem("gesi_set", JSON.stringify({ v: volume, fx: volFx, mus: volMusic, s: sens, vib: vibOn, mo: musicOn })); } catch (e) {}
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("gesi_set") || "null");
    if (!s) return;
    if (typeof s.v === "number") volume = s.v;
    if (typeof s.fx === "number") volFx = s.fx;
    if (typeof s.mus === "number") volMusic = s.mus;
    if (typeof s.s === "number") sens = s.s;
    if (typeof s.vib === "boolean") vibOn = s.vib;
    if (typeof s.mo === "boolean") musicOn = s.mo;
  } catch (e) {}
}

function P1() { return players[0]; }
function P2() { return players[1]; }
function alivePlayers() { return players.filter((p) => !p.dead); }
function targetBugs() { return TARGETS[level] || 8; }
function rand(a, b) { return a + Math.random() * (b - a); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function center(e) { return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }

// --- dźwięk: pliki WAV + awaryjne piski ---
let audioCtx = null;
const SFX = {};
function loadSfx(name) {
  try {
    if (typeof Audio === "undefined") return;
    const a = new Audio("sounds/" + name + ".wav");
    a.preload = "auto";
    SFX[name] = a;
  } catch (e) {}
}
["quack", "eat", "hurt", "win", "level", "trap", "sizzle"].forEach(loadSfx);
function beep(freq, dur, type) {
  if (muted || volume <= 0 || volFx <= 0) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || "square"; o.frequency.value = freq;
    g.gain.value = 0.06 * volume * volFx;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
function sfx(name, freq, dur, type) {
  if (muted || volume <= 0 || volFx <= 0) return;
  const a = SFX[name];
  if (a) { try { a.volume = volume * volFx; a.currentTime = 0; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); return; } catch (e) {} }
  beep(freq, dur, type);
}
function sndQuack() { sfx("quack", 300, 0.18, "sawtooth"); }
function sndEat() { sfx("eat", 660, 0.1, "square"); }
function sndHurt() { sfx("hurt", 120, 0.25, "sawtooth"); }
function sndWin() { sfx("win", 523, 0.4, "square"); }
function sndLevel() { sfx("level", 392, 0.2, "square"); }
function sndTrap() { sfx("trap", 180, 0.15, "square"); }
function toggleMute() { muted = !muted; const c = document.getElementById("chkSound"); if (c) c.checked = !muted; }
function changeVolume(d) {
  volume = Math.max(0, Math.min(1, Math.round((volume + d) * 10) / 10));
  volMsg = 1.5;
  const r = document.getElementById("volRange"); if (r) r.value = Math.round(volume * 100);
  applyMusicVol();
  saveSettings();
  if (d > 0 && volume > 0) beep(520, 0.07, "square");
}

// --- mroczny ambient w pętli ---
let musicEl = null;
function startMusic() {
  if (musicEl || typeof Audio === "undefined") return;
  try {
    musicEl = new Audio("sounds/ambient.wav");
    musicEl.loop = true;
    applyMusicVol();
    const pr = musicEl.play(); if (pr && pr.catch) pr.catch(() => {});
  } catch (e) {}
}
function applyMusicVol() {
  if (musicEl) { try { musicEl.volume = (musicOn && !muted) ? 0.3 * volume * volMusic : 0; } catch (e) {} }
}

// --- dotyk: joystick + przyciski (gracz 1) ---
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
let touchRun = false;
function setupTouch() {
  const hasTouch = (typeof window !== "undefined") && ("ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));
  if (!hasTouch) return;
  document.body.classList.add("touch");
  const joyZone = document.getElementById("joy");
  const stick = document.getElementById("stick");
  const R = 50;
  joyZone.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY;
    joy.dx = 0; joy.dy = 0;
    stick.style.transform = "translate(0px,0px)";
  }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (!joy.active) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy;
        const len = Math.hypot(dx, dy) || 1;
        const cl = Math.min(len, R);
        dx = dx / len * cl; dy = dy / len * cl;
        joy.dx = dx / R; joy.dy = dy / R;
        stick.style.transform = "translate(" + dx + "px," + dy + "px)";
      }
    }
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        joy.active = false; joy.dx = 0; joy.dy = 0;
        stick.style.transform = "translate(0px,0px)";
      }
    }
  });
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener("touchstart", (e) => { e.preventDefault(); fn(true); }, { passive: false });
    el.addEventListener("touchend", (e) => { e.preventDefault(); fn(false); }, { passive: false });
  };
  bind("tQuack", (down) => { if (down && P1()) tryQuack(P1()); });
  bind("tTrap", (down) => { if (down && P1()) tryTrap(P1()); });
  bind("tRun", (down) => { touchRun = down; });
  bind("tPause", (down) => { if (down) togglePause(); });
}

// --- rekordy ---
function loadRekordy() {
  try {
    if (typeof localStorage === "undefined") return [];
    return JSON.parse(localStorage.getItem("gesi_rekordy") || "[]");
  } catch (e) { return []; }
}
function saveRekord(s, lvl) {
  try {
    if (typeof localStorage === "undefined") return;
    const r = loadRekordy();
    r.push({ s, l: lvl, m: mode, d: new Date().toLocaleDateString("pl-PL") });
    r.sort((a, b) => b.s - a.s);
    localStorage.setItem("gesi_rekordy", JSON.stringify(r.slice(0, 5)));
  } catch (e) {}
}
function rekordyHTML() {
  const r = loadRekordy();
  if (!r.length) return "<p style='opacity:.6'>Brak rekordów — bądź pierwszy!</p>";
  let h = "<p><b>🏆 Rekordy TOP5:</b></p>";
  r.forEach((x, i) => { h += "<div>" + (i + 1) + ". " + x.s + " pkt (poz." + x.l + (x.m === "coop" ? ", 2P" : "") + ", " + x.d + ")</div>"; });
  return h;
}

// --- ekrany menu ---
function showScreen(id) {
  ["scr-main", "scr-multi", "scr-settings", "scr-msg"].forEach((s) => {
    document.getElementById(s).hidden = (s !== id);
  });
}
function showMenu() {
  state = "menu";
  overlay.classList.remove("hidden");
  document.getElementById("hud").style.display = "none";
  ovTitle.textContent = "Wielkie przygody gęsi";
  showScreen("scr-main");
  recordsEl.innerHTML = rekordyHTML();
}
function showMsg(title, html, btn, quit) {
  overlay.classList.remove("hidden");
  ovTitle.textContent = title;
  ovText.innerHTML = html;
  btnStart.textContent = btn;
  document.getElementById("btnQuit").hidden = !quit;
  recordsEl.innerHTML = rekordyHTML();
  showScreen("scr-msg");
}

// --- maskotka: ładna gęś (mruga, macha skrzydłem, co ~10 s KWA + podskok) ---
function drawMascot(t) {
  if (!mctx) return;
  mctx.clearRect(0, 0, 200, 260);
  const cyc = t % 10;
  const exc = Math.min(1, mascotExcite);
  const kwa = cyc > 9.0 || exc > 0.25;
  const flap = (t % 7) < 0.6;
  let hop = kwa && exc <= 0.25 ? -Math.sin((cyc - 9.0) * Math.PI) * 26 : 0;
  if (exc > 0) hop += -Math.abs(Math.sin(t * 9)) * 12 * exc;
  const bob = Math.sin(t * 2) * 2;
  const R = (x, y, w, h, c) => { mctx.fillStyle = c; mctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const bx = 45 - 24 * exc, by = 118 + bob + hop;
  R(30, 236, 140, 6, "#000");                       // cień
  R(bx + 8, by + 84, 12, 14, "#ff8800");            // nogi
  R(bx + 62, by + 84, 12, 14, "#e07b00");
  R(bx + 2, by + 96, 24, 6, "#ff8800");             // stopy
  R(bx + 56, by + 96, 24, 6, "#e07b00");
  R(bx - 22, by + 30, 26, 12, "#dfe6ee");           // ogon
  R(bx - 14, by + 20, 20, 12, "#ffffff");
  R(bx, by + 26, 92, 60, "#ffffff");                // tułów
  R(bx, by + 66, 92, 20, "#dfe6ee");                // cień brzucha
  if (flap) { R(bx + 10, by - 2, 60, 26, "#c8d2dd"); }  // skrzydło w górze
  else { R(bx + 14, by + 34, 56, 24, "#c8d2dd"); R(bx + 14, by + 54, 56, 6, "#aeb9c6"); }
  R(bx + 62, by - 34, 30, 62, "#ffffff");           // szyja
  R(bx + 62, by - 34, 8, 62, "#dfe6ee");
  R(bx + 54, by - 62, 46, 32, "#ffffff");           // głowa
  const blink = (t % 4) < 0.15;
  if (blink) R(bx + 66, by - 52, 12, 3, "#000");
  else { R(bx + 66, by - 56, 12, 12, "#000"); R(bx + 69, by - 53, 4, 4, "#fff"); }
  R(bx + 100, by - 54, 22, 9, "#ff8800");           // dziób górny
  if (kwa) {
    R(bx + 100, by - 41, 22, 9, "#e07b00");         // dziób dolny otwarty
    mctx.strokeStyle = "#ffff00"; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(bx + 111, by - 48, 14, -0.9, 0.9); mctx.stroke();
    mctx.beginPath(); mctx.arc(bx + 111, by - 48, 24, -0.9, 0.9); mctx.stroke();
    mctx.fillStyle = "#ffff00"; mctx.font = "bold 22px monospace"; mctx.textAlign = "center";
    mctx.fillText("KWA!!", 100, 34);
  }
  mctx.fillStyle = "#8a93a0"; mctx.font = "12px monospace"; mctx.textAlign = "center";
  mctx.fillText("Zemsta gęsi", 100, 254);
}

// --- poziomy ---
function mkPlayer(name, x, runKey) {
  return { name, x, y: 500, w: 22, h: 22, hp: 100, dir: 1, quackCd: 0, hurtCd: 0, dead: false, runKey };
}
function newGame(m) {
  mode = m;
  players = [mkPlayer("Gęś 1", 80, "ShiftLeft")];
  if (mode === "coop") players.push(mkPlayer("Gęś 2", 150, "ShiftRight"));
  level = 1; score = 0; levelBugs = 0;
  startTime = performance.now();
  elapsed = 0;
  setupLevel();
  state = "gra";
  document.getElementById("hud").style.display = "flex";
  overlay.classList.add("hidden");
}

function mkEnemy(kind, x, y) {
  if (kind === "boss") return { kind, x, y, w: 42, h: 42, hp: 3, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
  if (kind === "ghost") return { kind, x, y, w: 24, h: 24, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
  return { kind: "sanit", x, y, w: 26, h: 26, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
}

function setupLevel() {
  traps = [];
  parts = [];
  exitDoor = { x: 360, y: 16, w: 80, h: 24, open: false };
  players[0].x = 80; players[0].y = 500;
  if (P2()) { P2().x = 150; P2().y = 500; }
  players.forEach((p) => { if (p.dead) { p.dead = false; p.hp = 60; } else p.hp = Math.min(100, p.hp + 25); p.quackCd = 0; });
  levelBugs = 0;
  poisons = [
    { x: 260, y: 180, r: 42 },
    { x: 540, y: 420, r: 48 },
    { x: 340, y: 470, r: 36 },
  ];
  if (level >= 2) poisons.push({ x: 620, y: 300, r: 40 });
  if (level >= 3) poisons.push({ x: 150, y: 220, r: 36 });
  walls = [
    { x: 0, y: 0, w: 800, h: 16 },
    { x: 0, y: 584, w: 800, h: 16 },
    { x: 0, y: 0, w: 16, h: 600 },
    { x: 784, y: 0, w: 16, h: 600 },
    { x: 180, y: 120, w: 200, h: 20 },
    { x: 480, y: 220, w: 20, h: 180 },
    { x: 140, y: 340, w: 220, h: 20 },
  ];
  if (level >= 3) walls.push({ x: 420, y: 420, w: 180, h: 20 });
  enemies = [mkEnemy("sanit", 500, 130)];
  if (level >= 2) enemies.push(mkEnemy("ghost", 620, 400));
  if (level >= 3) enemies.push(mkEnemy("boss", 400, 300));
  bugs = [];
  for (let i = 0; i < 5; i++) spawnBug();
  quackFx = 0; shakeT = 0;
  levelMsg = 2.5;
  updateHUD();
}

function spawnBug() {
  for (let t = 0; t < 40; t++) {
    const b = { x: rand(40, 740), y: rand(60, 540), w: 12, h: 12 };
    let ok = true;
    for (const wl of walls) if (rectsOverlap(b, wl)) { ok = false; break; }
    for (const p of poisons) if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 10) { ok = false; break; }
    if (ok) { bugs.push(b); return; }
  }
}

function tryQuack(p) {
  if (!p || state !== "gra" || p.dead || p.quackCd > 0) return;
  p.quackCd = 2.0;
  quackFx = 0.4;
  sndQuack();
  const pc = center(p);
  for (const e of enemies) {
    const d = dist(pc, center(e));
    if (e.kind === "ghost" && d < 150) e.scare = 4.0;
    else if (e.kind === "boss" && d < 120) e.scare = 1.0;
    else if (e.kind === "sanit" && d < 130) e.scare = 3.0;
  }
}

function tryTrap(p) {
  if (!p || state !== "gra" || p.dead || traps.length >= 4) return;
  traps.push({ x: p.x, y: p.y, w: 18, h: 18, life: 25 });
  sndTrap();
}

function togglePause() {
  if (state === "gra") {
    state = "pauza";
    showMsg("PAUZA", "Poziom " + level + "/" + MAX_LEVEL + " (" + (mode === "coop" ? "2 graczy" : "solo") + "). Odpocznij, gęsi.", "Kontynuuj", true);
  } else if (state === "pauza") {
    state = "gra";
    overlay.classList.add("hidden");
    startTime = performance.now() - elapsed * 1000;
  }
}

function vibrate(ms) {
  try { if (vibOn && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

function feather(x, y, n, cols) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(30, 130);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 5), col: cols[i % cols.length], txt: null });
  }
}
function popup(x, y, txt, col) {
  parts.push({ x, y, vx: 0, vy: -55, life: 1.0, max: 1.0, size: 0, col: col || "#ffff00", txt });
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.life -= dt;
    if (q.life <= 0) { parts.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += 160 * dt;
  }
}

function moveWithWalls(e, dx, dy) {
  e.x += dx;
  for (const wl of walls) if (rectsOverlap(e, wl)) { if (dx > 0) e.x = wl.x - e.w; else if (dx < 0) e.x = wl.x + wl.w; }
  e.x = Math.max(16, Math.min(W - 16 - e.w, e.x));
  e.y += dy;
  for (const wl of walls) if (rectsOverlap(e, wl)) { if (dy > 0) e.y = wl.y - e.h; else if (dy < 0) e.y = wl.y + wl.h; }
  e.y = Math.max(16, Math.min(H - 16 - e.h, e.y));
}

function moveGhost(e, dx, dy) {
  e.x = Math.max(16, Math.min(W - 16 - e.w, e.x + dx));
  e.y = Math.max(16, Math.min(H - 16 - e.h, e.y + dy));
}

function updateHUD() {
  const a = alivePlayers();
  hpEl.textContent = Math.ceil(P1().hp);
  if (mode === "coop" && P2()) {
    hp2wrap.hidden = false;
    hp2El.textContent = P2().dead ? "☠" : Math.ceil(P2().hp);
  } else hp2wrap.hidden = true;
  bugsEl.textContent = Math.min(levelBugs, targetBugs()) + "/" + targetBugs();
  scoreEl.textContent = score;
  levelEl.textContent = level + "/" + MAX_LEVEL;
  const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60);
  timeEl.textContent = m + ":" + String(s).padStart(2, "0");
}

function nearestAlive(ec) {
  let best = null, bd = 1e9;
  for (const p of alivePlayers()) {
    const d = dist(center(p), ec);
    if (d < bd) { bd = d; best = p; }
  }
  return { p: best, d: bd };
}

function update(dt) {
  elapsed = (performance.now() - startTime) / 1000;
  quackFx = Math.max(0, quackFx - dt);
  levelMsg = Math.max(0, levelMsg - dt);
  volMsg = Math.max(0, volMsg - dt);
  shakeT = Math.max(0, shakeT - dt);

  // --- gracze ---
  const solos = (mode === "solo");
  let dx1 = (keys["KeyA"] ? -1 : 0) + (keys["KeyD"] ? 1 : 0) + (solos && keys["ArrowLeft"] ? -1 : 0) + (solos && keys["ArrowRight"] ? 1 : 0);
  let dy1 = (keys["KeyW"] ? -1 : 0) + (keys["KeyS"] ? 1 : 0) + (solos && keys["ArrowUp"] ? -1 : 0) + (solos && keys["ArrowDown"] ? 1 : 0);
  if (dx1 === 0 && dy1 === 0 && (joy.dx || joy.dy)) { dx1 = joy.dx * sens; dy1 = joy.dy * sens; }
  movePlayer(P1(), dx1, dy1, dt);
  if (mode === "coop" && P2() && !P2().dead) {
    movePlayer(P2(), (keys["ArrowLeft"] ? -1 : 0) + (keys["ArrowRight"] ? 1 : 0), (keys["ArrowUp"] ? -1 : 0) + (keys["ArrowDown"] ? 1 : 0), dt);
  }

  for (const p of alivePlayers()) {
    const pc = center(p);
    let inPoison = false;
    for (const q of poisons) {
      if (Math.hypot(pc.x - q.x, pc.y - q.y) < q.r) { p.hp -= 20 * dt; inPoison = true; }
    }
    if (inPoison) {
      poisonSndCd = Math.max(0, poisonSndCd - dt);
      if (poisonSndCd <= 0) { sfx("sizzle", 200, 0.3, "sawtooth"); poisonSndCd = 1.0; }
    }
    for (let i = bugs.length - 1; i >= 0; i--) {
      if (rectsOverlap(p, bugs[i])) {
        const bc = center(bugs[i]);
        bugs.splice(i, 1);
        levelBugs++;
        score += 10;
        p.hp = Math.min(100, p.hp + 6);
        feather(bc.x, bc.y, 5, ["#c0ff33", "#ffffff"]);
        popup(bc.x, bc.y - 10, "+10", "#c0ff33");
        sndEat();
        if (levelBugs < targetBugs() + 2) spawnBug();
      }
    }
    p.quackCd = Math.max(0, p.quackCd - dt);
    p.hurtCd = Math.max(0, (p.hurtCd || 0) - dt);
    if (p.hp <= 0) { p.hp = 0; p.dead = true; }
  }
  if (levelBugs >= targetBugs()) exitDoor.open = true;

  for (let i = traps.length - 1; i >= 0; i--) {
    traps[i].life -= dt;
    if (traps[i].life <= 0) { traps.splice(i, 1); continue; }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (rectsOverlap(e, traps[i]) && e.stun <= 0) {
        if (e.kind === "boss") {
          e.hp -= 1; e.stun = 2.0;
          traps.splice(i, 1);
          sndTrap();
          if (e.hp <= 0) { enemies.splice(j, 1); score += 100; feather(center(e).x, center(e).y, 14, ["#aa0000", "#ffffff", "#ffcc00"]); popup(center(e).x, center(e).y - 20, "+100 BOSS", "#ffcc00"); sndWin(); }
        } else {
          e.stun = 3.0;
          traps.splice(i, 1);
          sndTrap();
        }
        break;
      }
    }
  }

  const spd = ENEMY_SPEED[level] || 122;
  for (const e of enemies) {
    e.scare = Math.max(0, e.scare - dt);
    e.stun = Math.max(0, e.stun - dt);
    const ec = center(e);
    const tgt = nearestAlive(ec);
    const espd = e.kind === "ghost" ? 150 : (e.kind === "boss" ? 100 : spd);
    const chaseR = e.kind === "ghost" ? 300 : 240;
    const mv = (mx, my) => { if (e.kind === "ghost") moveGhost(e, mx, my); else moveWithWalls(e, mx, my); };
    if (e.stun <= 0) {
      if (e.scare > 0 && tgt.p) {
        const pc = center(tgt.p);
        const a = Math.atan2(ec.y - pc.y, ec.x - pc.x);
        mv(Math.cos(a) * 135 * dt, Math.sin(a) * 135 * dt);
      } else if (tgt.p && tgt.d < chaseR) {
        const pc = center(tgt.p);
        const a = Math.atan2(pc.y - ec.y, pc.x - ec.x);
        mv(Math.cos(a) * espd * dt, Math.sin(a) * espd * dt);
      } else {
        e.wait -= dt;
        if (Math.hypot(e.tx - ec.x, e.ty - ec.y) < 12 || e.wait <= 0) {
          e.tx = rand(60, 700); e.ty = rand(60, 520); e.wait = rand(1, 3);
        }
        const a = Math.atan2(e.ty - ec.y, e.tx - ec.x);
        mv(Math.cos(a) * 70 * dt, Math.sin(a) * 70 * dt);
      }
    }
    const dmg = e.kind === "boss" ? 25 : 16;
    for (const p of alivePlayers()) {
      if (rectsOverlap(p, e) && (p.hurtCd || 0) <= 0 && e.stun <= 0 && e.scare <= 0) {
        p.hp -= dmg;
        p.hurtCd = 0.9;
        shakeT = 0.35;
        const hc = center(p);
        feather(hc.x, hc.y, 8, ["#ffffff", "#ff5555"]);
        vibrate(80);
        sndHurt();
        if (p.hp <= 0) { p.hp = 0; p.dead = true; }
      }
    }
  }

  for (const p of alivePlayers()) {
    if (exitDoor.open && rectsOverlap(p, exitDoor)) {
      score += 50 + Math.ceil(p.hp / 2);
      if (level >= MAX_LEVEL) return endGame(true);
      level++;
      setupLevel();
      sndLevel();
      return;
    }
  }
  if (!alivePlayers().length) { updateHUD(); return endGame(false); }
  updateParts(dt);
  updateHUD();
}

function movePlayer(p, dx, dy, dt) {
  if (!p || p.dead) return;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    if (dx !== 0) p.dir = dx > 0 ? 1 : -1;
  }
  const running = (keys[p.runKey] || (p === P1() && touchRun)) ? 1.6 : 1.0;
  moveWithWalls(p, dx * 170 * running * dt, dy * 170 * running * dt);
}

function endGame(win) {
  state = win ? "wygrana" : "przegrana";
  if (win) {
    const bonus = Math.max(0, 300 - Math.floor(elapsed) * 2);
    score += bonus;
    saveRekord(score, level);
    showMsg("WYGRANA! Zemsta dokonana",
      "Gęś " + (mode === "coop" ? "uciekinierki" : "") + " uciekły ze Zofiówki (3 poziomy).<br>Punkty: <b>" + score + "</b> • Czas: <b>" + timeEl.textContent + "</b>",
      "Zagraj ponownie", true);
    sndWin();
  } else {
    saveRekord(score, level);
    showMsg("PRZEGRANA (poziom " + level + ")",
      "Złapano cię w Zofiówce.<br>Punkty: <b>" + score + "</b>",
      "Spróbuj ponownie", true);
    sndHurt();
  }
  scoreEl.textContent = score;
}

function drawEnemy(e) {
  if (e.kind === "ghost") {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = e.scare > 0 ? "#ffffaa" : "#ddddff";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(e.x + 5, e.y + 6, 4, 4);
    ctx.fillRect(e.x + 15, e.y + 6, 4, 4);
    ctx.fillRect(e.x + 8, e.y + 16, 8, 2);
    return;
  }
  if (e.kind === "boss") {
    ctx.fillStyle = e.stun > 0 ? "#888888" : "#aa0000";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(e.x + 8, e.y + 6, 26, 8);
    ctx.fillStyle = "#000";
    ctx.fillRect(e.x + 18, e.y + 6, 6, 22);
    ctx.fillRect(e.x + 10, e.y + 28, 8, 8);
    ctx.fillRect(e.x + 24, e.y + 28, 8, 8);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < e.hp ? "#ff0000" : "#330000";
      ctx.fillRect(e.x + i * 14, e.y - 10, 12, 6);
    }
    return;
  }
  const es = e.stun > 0 ? "#888888" : (e.scare > 0 ? "#ffcc00" : "#ff5555");
  ctx.fillStyle = es;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(e.x + 4, e.y + 4, 18, 6);
  ctx.fillStyle = "#000";
  ctx.fillRect(e.x + 6, e.y + 14, 5, 5);
  ctx.fillRect(e.x + 15, e.y + 14, 5, 5);
}

function drawPlayer(p) {
  const px = Math.round(p.x), py = Math.round(p.y);
  const blink = (p.hurtCd || 0) > 0 && Math.floor(performance.now() / 100) % 2 === 0;
  if (p.dead) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#888888";
    ctx.fillRect(px, py + 6, 22, 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff"; ctx.font = "12px monospace"; ctx.textAlign = "center";
    ctx.fillText("☠", px + 11, py);
    return;
  }
  ctx.fillStyle = blink ? "#ffaaaa" : (p === P2() ? "#e8f4ff" : "#ffffff");
  ctx.fillRect(px, py + 6, 22, 14);
  ctx.fillRect(px + (p.dir > 0 ? 14 : -4), py, 10, 10);
  ctx.fillStyle = p === P2() ? "#ff4444" : "#ff8800";
  ctx.fillRect(px + (p.dir > 0 ? 22 : -8), py + 4, 6, 4);
  ctx.fillStyle = "#000";
  ctx.fillRect(px + (p.dir > 0 ? 17 : -1), py + 2, 3, 3);
  ctx.fillStyle = "#000";
  ctx.fillRect(px - 2, py - 8, 26, 5);
  ctx.fillStyle = p.hp > 50 ? "#00ff00" : (p.hp > 25 ? "#ffcc00" : "#ff0000");
  ctx.fillRect(px - 2, py - 8, 26 * (p.hp / 100), 5);
}

function draw() {
  ctx.save();
  if (shakeT > 0) ctx.translate(rand(-4, 4) * shakeT * 3, rand(-4, 4) * shakeT * 3);
  ctx.fillStyle = "#1a1f2b";
  ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = "#151a25";
  for (let y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 2);

  if (state === "menu" || !players.length) { ctx.restore(); return; }

  for (const p of poisons) {
    ctx.fillStyle = "#3d2b00";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7aff00";
    ctx.beginPath(); ctx.arc(p.x - 10, p.y - 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + 12, p.y + 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + 2, p.y - 14, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = "#3b4252";
  for (const wl of walls) ctx.fillRect(wl.x, wl.y, wl.w, wl.h);

  ctx.fillStyle = exitDoor.open ? "#00ff88" : "#ff3333";
  ctx.fillRect(exitDoor.x, exitDoor.y, exitDoor.w, exitDoor.h);
  if (exitDoor.open) {
    ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2;
    const pr = 6 + Math.sin(performance.now() / 200) * 3;
    ctx.strokeRect(exitDoor.x - pr, exitDoor.y - pr, exitDoor.w + pr * 2, exitDoor.h + pr * 2);
  }
  ctx.fillStyle = "#000";
  ctx.font = "12px monospace"; ctx.textAlign = "center";
  ctx.fillText(exitDoor.open ? "WYJŚCIE" : "ZAMKNIĘTE (" + Math.min(levelBugs, targetBugs()) + "/" + targetBugs() + ")", exitDoor.x + 40, exitDoor.y + 17);

  for (const t of traps) {
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(t.x + 3, t.y + 3, 12, 3);
    ctx.fillRect(t.x + 3, t.y + 8, 12, 3);
  }

  for (const b of bugs) {
    ctx.fillStyle = "#c0ff33";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(b.x + 2, b.y + 2, 3, 3);
    ctx.fillRect(b.x + 7, b.y + 7, 3, 3);
  }

  for (const e of enemies) drawEnemy(e);
  // "!" nad goniącym wrogiem
  for (const e of enemies) {
    if (e.stun <= 0 && e.scare <= 0) {
      const t = nearestAlive(center(e));
      if (t.p && t.d < (e.kind === "ghost" ? 300 : 240)) {
        ctx.fillStyle = "#ff0000"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center";
        ctx.fillText("!", e.x + e.w / 2, e.y - 6 + Math.sin(performance.now() / 150) * 2);
      }
    }
  }
  for (const p of players) drawPlayer(p);

  // cząsteczki i popupy
  for (const q of parts) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    if (q.txt) {
      ctx.fillStyle = q.col; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
      ctx.fillText(q.txt, q.x, q.y);
    } else {
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  if (quackFx > 0 && P1() && !P1().dead) {
    const cx = P1().x + 11, cy = P1().y + 11;
    ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 34 + (0.4 - quackFx) * 120, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffff00"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
    ctx.fillText("KWA-KWA!", cx, cy - 24);
  }

  if (levelMsg > 0 && state === "gra") {
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px monospace"; ctx.textAlign = "center";
    ctx.fillText("POZIOM " + level, W / 2, H / 2 - 20);
    ctx.font = "14px monospace";
    ctx.fillText("Zbierz " + targetBugs() + " owadów i ucieknij!", W / 2, H / 2 + 8);
  }
  if (muted) {
    ctx.fillStyle = "#888"; ctx.font = "12px monospace"; ctx.textAlign = "right";
    ctx.fillText("wyciszone (M)", W - 10, H - 10);
  } else if (volMsg > 0) {
    ctx.fillStyle = "#888"; ctx.font = "12px monospace"; ctx.textAlign = "right";
    ctx.fillText("głośność " + Math.round(volume * 100) + "% (-/+)", W - 10, H - 10);
  }
  ctx.restore();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  mascotT += dt;
  mascotExcite = Math.max(0, mascotExcite - dt);
  if (state === "gra") update(dt);
  draw();
  if (state === "menu" && !overlay.classList.contains("hidden")) drawMascot(mascotT);
  requestAnimationFrame(loop);
}

// --- przyciski menu: guś sam "wciska" przycisk ---
function uiClick(fn) {
  return (ev) => {
    startMusic();
    try { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); } catch (e) {}
    mascotExcite = 1.4;
    const btn = ev && ev.currentTarget;
    if (btn && btn.classList) {
      btn.classList.remove("pressed");
      void btn.offsetWidth;
      btn.classList.add("pressed");
      setTimeout(() => btn.classList.remove("pressed"), 350);
    }
    setTimeout(fn, 180);
  };
}
document.getElementById("btnSingle").addEventListener("click", uiClick(() => newGame("solo")));
document.getElementById("btnCoop").addEventListener("click", uiClick(() => newGame("coop")));
document.getElementById("btnMulti").addEventListener("click", uiClick(() => showScreen("scr-multi")));
document.getElementById("btnSettings").addEventListener("click", uiClick(() => showScreen("scr-settings")));
document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", uiClick(() => showScreen("scr-main"))));
btnStart.addEventListener("click", uiClick(() => {
  if (state === "pauza") { togglePause(); return; }
  newGame(mode);
}));
document.getElementById("btnQuit").addEventListener("click", uiClick(() => showMenu()));
document.getElementById("btnRoom").addEventListener("click", () => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  document.getElementById("roomMsg").textContent = "Pokój " + code + " — serwer online w przygotowaniu. Zagraj we 2 na 1 ekranie!";
});
document.getElementById("btnJoin").addEventListener("click", () => {
  const code = document.getElementById("roomCode").value.trim().toUpperCase();
  document.getElementById("roomMsg").textContent = code
    ? "Pokój " + code + " nie istnieje (serwer w przygotowaniu). Zagraj we 2 na 1 ekranie!"
    : "Wpisz kod pokoju.";
});
document.getElementById("volRange").addEventListener("input", (e) => {
  volume = e.target.value / 100;
  volMsg = 1.5;
  applyMusicVol();
  saveSettings();
});
document.getElementById("fxRange").addEventListener("input", (e) => {
  volFx = e.target.value / 100;
  saveSettings();
  beep(660, 0.08, "square");
});
document.getElementById("musicRange").addEventListener("input", (e) => {
  volMusic = e.target.value / 100;
  applyMusicVol();
  saveSettings();
});
document.getElementById("chkSound").addEventListener("change", (e) => {
  muted = !e.target.checked;
  applyMusicVol();
  saveSettings();
});
document.getElementById("chkMusic").addEventListener("change", (e) => {
  musicOn = e.target.checked;
  applyMusicVol();
  saveSettings();
});
document.getElementById("btnWipe").addEventListener("click", () => {
  try { localStorage.removeItem("gesi_rekordy"); } catch (e) {}
  recordsEl.innerHTML = rekordyHTML();
});
document.getElementById("sensRange").addEventListener("input", (e) => {
  sens = e.target.value / 100;
  saveSettings();
});
document.getElementById("chkVib").addEventListener("change", (e) => {
  vibOn = e.target.checked;
  saveSettings();
});

function syncSettingsUI() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
  set("volRange", Math.round(volume * 100));
  set("fxRange", Math.round(volFx * 100));
  set("musicRange", Math.round(volMusic * 100));
  set("sensRange", Math.round(sens * 100));
  chk("chkSound", !muted);
  chk("chkMusic", musicOn);
  chk("chkVib", vibOn);
}

loadSettings();
syncSettingsUI();
setupTouch();
showMenu();
draw();
requestAnimationFrame(loop);
