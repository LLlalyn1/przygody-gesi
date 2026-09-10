// Wielkie przygody gęsi — prototyp v3
// 2D top-down, HTML5 Canvas, czysty JS. Wszystko po polsku.
// Poziomy 1-3, sanitariusz + DUCH + BOSS, dźwięki z plików, rekordy, dotyk.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const hpEl = document.getElementById("hp");
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
  if (e.code === "Space") tryQuack();
  if (e.code === "KeyE") tryTrap();
  if (e.code === "KeyP" || e.code === "Escape") togglePause();
  if (e.code === "KeyM") toggleMute();
  if (e.code === "Minus" || e.code === "NumpadSubtract") changeVolume(-0.1);
  if (e.code === "Equal" || e.code === "NumpadAdd") changeVolume(0.1);
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

let state = "menu"; // menu | gra | pauza | wygrana | przegrana
let player = null, enemies = [];
let bugs = [], traps = [], poisons = [], walls = [];
let exitDoor = { x: 360, y: 16, w: 80, h: 24, open: false };
let level = 1, startTime = 0, elapsed = 0;
let quackCd = 0, hurtCd = 0, quackFx = 0, muted = false;
let levelMsg = 0, volume = 0.8, volMsg = 0, shakeT = 0, poisonSndCd = 0;

function targetBugs() { return TARGETS[level] || 8; }
function rand(a, b) { return a + Math.random() * (b - a); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function center(e) { return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }

// --- dźwięk: pliki WAV + awaryjne piski WebAudio ---
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
  if (muted || volume <= 0) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || "square"; o.frequency.value = freq;
    g.gain.value = 0.06 * volume;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
function sfx(name, freq, dur, type) {
  if (muted || volume <= 0) return;
  const a = SFX[name];
  if (a) { try { a.volume = volume; a.currentTime = 0; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); return; } catch (e) {} }
  beep(freq, dur, type);
}
function changeVolume(d) {
  volume = Math.max(0, Math.min(1, Math.round((volume + d) * 10) / 10));
  volMsg = 1.5;
  if (d > 0 && volume > 0) beep(520, 0.07, "square");
}
function sndQuack() { sfx("quack", 300, 0.18, "sawtooth"); }
function sndEat() { sfx("eat", 660, 0.1, "square"); }
function sndHurt() { sfx("hurt", 120, 0.25, "sawtooth"); }
function sndWin() { sfx("win", 523, 0.4, "square"); }
function sndLevel() { sfx("level", 392, 0.2, "square"); }
function sndTrap() { sfx("trap", 180, 0.15, "square"); }
function toggleMute() { muted = !muted; }

// --- dotyk: joystick + przyciski ---
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
  bind("tQuack", (down) => { if (down) tryQuack(); });
  bind("tTrap", (down) => { if (down) tryTrap(); });
  bind("tRun", (down) => { touchRun = down; });
  bind("tPause", (down) => { if (down) togglePause(); });
}

// --- rekordy (localStorage TOP5) ---
function loadRekordy() {
  try {
    if (typeof localStorage === "undefined") return [];
    return JSON.parse(localStorage.getItem("gesi_rekordy") || "[]");
  } catch (e) { return []; }
}
function saveRekord(score, lvl) {
  try {
    if (typeof localStorage === "undefined") return;
    const r = loadRekordy();
    r.push({ s: score, l: lvl, d: new Date().toLocaleDateString("pl-PL") });
    r.sort((a, b) => b.s - a.s);
    localStorage.setItem("gesi_rekordy", JSON.stringify(r.slice(0, 5)));
  } catch (e) {}
}
function rekordyHTML() {
  const r = loadRekordy();
  if (!r.length) return "<p style='opacity:.6'>Brak rekordów — bądź pierwszy!</p>";
  let h = "<p><b>🏆 Rekordy TOP5:</b></p>";
  r.forEach((x, i) => { h += "<div>" + (i + 1) + ". " + x.s + " pkt (poz." + x.l + ", " + x.d + ")</div>"; });
  return h;
}
function showMenu() {
  state = "menu";
  overlay.classList.remove("hidden");
  ovTitle.textContent = "Wielkie przygody gęsi";
  ovText.innerHTML = "<i>„Zemsta gęsi”</i><br>Obudziłeś się jako gęś w psychiatryku „Zofiówka”.<br>" +
    "Poziomy <b>1–" + MAX_LEVEL + "</b>: owady, sanitariusze, <b>DUCH</b> i <b>BOSS-ordynator</b>. Ucieknij drzwiami.";
  btnStart.textContent = "Zacznij grę";
  recordsEl.innerHTML = rekordyHTML();
}

// --- poziomy ---
function newGame() {
  player = { x: 80, y: 500, w: 22, h: 22, hp: 100, bugs: 0, score: 0, dir: 1, levelBugs: 0 };
  level = 1;
  startTime = performance.now();
  elapsed = 0;
  setupLevel();
  state = "gra";
  overlay.classList.add("hidden");
}

function mkEnemy(kind, x, y) {
  if (kind === "boss") return { kind, x, y, w: 42, h: 42, hp: 3, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
  if (kind === "ghost") return { kind, x, y, w: 24, h: 24, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
  return { kind: "sanit", x, y, w: 26, h: 26, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
}

function setupLevel() {
  traps = [];
  exitDoor = { x: 360, y: 16, w: 80, h: 24, open: false };
  player.x = 80; player.y = 500;
  player.levelBugs = 0;
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
  quackCd = 0; hurtCd = 0; quackFx = 0;
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

function tryQuack() {
  if (state !== "gra" || !player || quackCd > 0) return;
  quackCd = 2.0;
  quackFx = 0.4;
  sndQuack();
  const pc = center(player);
  for (const e of enemies) {
    const d = dist(pc, center(e));
    if (e.kind === "ghost" && d < 150) e.scare = 4.0;
    else if (e.kind === "boss" && d < 120) e.scare = 1.0;
    else if (e.kind === "sanit" && d < 130) e.scare = 3.0;
  }
}

function tryTrap() {
  if (state !== "gra" || !player || traps.length >= 4) return;
  traps.push({ x: player.x, y: player.y, w: 18, h: 18, life: 25 });
  sndTrap();
}

function togglePause() {
  if (state === "gra") {
    state = "pauza";
    overlay.classList.remove("hidden");
    ovTitle.textContent = "PAUZA";
    ovText.innerHTML = "Poziom " + level + "/" + MAX_LEVEL + ". Odpocznij, gęsi.";
    btnStart.textContent = "Kontynuuj";
    recordsEl.innerHTML = "";
  } else if (state === "pauza") {
    state = "gra";
    overlay.classList.add("hidden");
    startTime = performance.now() - elapsed * 1000;
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
  hpEl.textContent = Math.ceil(player.hp);
  bugsEl.textContent = Math.min(player.levelBugs, targetBugs()) + "/" + targetBugs();
  scoreEl.textContent = player.score;
  levelEl.textContent = level + "/" + MAX_LEVEL;
  const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60);
  timeEl.textContent = m + ":" + String(s).padStart(2, "0");
}

function update(dt) {
  elapsed = (performance.now() - startTime) / 1000;
  quackCd = Math.max(0, quackCd - dt);
  hurtCd = Math.max(0, hurtCd - dt);
  quackFx = Math.max(0, quackFx - dt);
  levelMsg = Math.max(0, levelMsg - dt);
  volMsg = Math.max(0, volMsg - dt);
  shakeT = Math.max(0, shakeT - dt);

  let dx = joy.dx, dy = joy.dy;
  if (keys["KeyA"] || keys["ArrowLeft"]) dx -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) dx += 1;
  if (keys["KeyW"] || keys["ArrowUp"]) dy -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) dy += 1;
  const jl = Math.hypot(dx, dy);
  if (jl > 1) { dx /= jl; dy /= jl; }
  if (dx !== 0) player.dir = dx > 0 ? 1 : -1;
  const running = (keys["ShiftLeft"] || keys["ShiftRight"] || touchRun) ? 1.6 : 1.0;
  moveWithWalls(player, dx * 170 * running * dt, dy * 170 * running * dt);

  const pc = center(player);
  let inPoison = false;
  for (const p of poisons) {
    if (Math.hypot(pc.x - p.x, pc.y - p.y) < p.r) { player.hp -= 20 * dt; inPoison = true; }
  }
  poisonSndCd = Math.max(0, poisonSndCd - dt);
  if (inPoison && poisonSndCd <= 0) { sfx("sizzle", 200, 0.3, "sawtooth"); poisonSndCd = 1.0; }

  for (let i = bugs.length - 1; i >= 0; i--) {
    if (rectsOverlap(player, bugs[i])) {
      bugs.splice(i, 1);
      player.bugs++; player.levelBugs++;
      player.score += 10;
      player.hp = Math.min(100, player.hp + 6);
      sndEat();
      if (player.levelBugs < targetBugs() + 2) spawnBug();
    }
  }
  if (player.levelBugs >= targetBugs()) exitDoor.open = true;

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
          if (e.hp <= 0) { enemies.splice(j, 1); player.score += 100; sndWin(); }
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
    const espd = e.kind === "ghost" ? 150 : (e.kind === "boss" ? 100 : spd);
    const chaseR = e.kind === "ghost" ? 300 : 240;
    const mv = (mx, my) => { if (e.kind === "ghost") moveGhost(e, mx, my); else moveWithWalls(e, mx, my); };
    if (e.stun <= 0) {
      if (e.scare > 0) {
        const a = Math.atan2(ec.y - pc.y, ec.x - pc.x);
        mv(Math.cos(a) * 135 * dt, Math.sin(a) * 135 * dt);
      } else if (dist(pc, ec) < chaseR) {
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
    if (rectsOverlap(player, e) && hurtCd <= 0 && e.stun <= 0 && e.scare <= 0) {
      player.hp -= dmg;
      hurtCd = 0.9;
      shakeT = 0.35;
      sndHurt();
    }
  }

  if (exitDoor.open && rectsOverlap(player, exitDoor)) {
    player.score += 50 + Math.ceil(player.hp / 2);
    if (level >= MAX_LEVEL) return endGame(true);
    level++;
    player.hp = Math.min(100, player.hp + 25);
    setupLevel();
    sndLevel();
    return;
  }
  if (player.hp <= 0) { player.hp = 0; updateHUD(); return endGame(false); }
  updateHUD();
}

function endGame(win) {
  state = win ? "wygrana" : "przegrana";
  overlay.classList.remove("hidden");
  if (win) {
    const bonus = Math.max(0, 300 - Math.floor(elapsed) * 2);
    player.score += bonus;
    saveRekord(player.score, level);
    ovTitle.textContent = "WYGRANA! Zemsta dokonana";
    ovText.innerHTML = "Gęś uciekła ze Zofiówki (3 poziomy).<br>Owady: <b>" + player.bugs +
      "</b> • Punkty: <b>" + player.score + "</b> • Czas: <b>" + timeEl.textContent + "</b>";
    btnStart.textContent = "Zagraj ponownie";
    sndWin();
  } else {
    saveRekord(player.score, level);
    ovTitle.textContent = "PRZEGRANA (poziom " + level + ")";
    ovText.innerHTML = "Złapano cię w Zofiówce.<br>Owady: <b>" + player.bugs +
      "</b> • Punkty: <b>" + player.score + "</b>";
    btnStart.textContent = "Spróbuj ponownie";
    sndHurt();
  }
  recordsEl.innerHTML = rekordyHTML();
  scoreEl.textContent = player.score;
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
    const es = e.stun > 0 ? "#888888" : "#aa0000";
    ctx.fillStyle = es;
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

function draw() {
  ctx.save();
  if (shakeT > 0) ctx.translate(rand(-4, 4) * shakeT * 3, rand(-4, 4) * shakeT * 3);
  ctx.fillStyle = "#1a1f2b";
  ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = "#151a25";
  for (let y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 2);

  if (state === "menu" || !player) { ctx.restore(); return; }

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
  ctx.fillStyle = "#000";
  ctx.font = "12px monospace"; ctx.textAlign = "center";
  ctx.fillText(exitDoor.open ? "WYJŚCIE" : "ZAMKNIĘTE (" + Math.min(player.levelBugs, targetBugs()) + "/" + targetBugs() + ")", exitDoor.x + 40, exitDoor.y + 17);

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

  const px = Math.round(player.x), py = Math.round(player.y);
  const blink = hurtCd > 0 && Math.floor(performance.now() / 100) % 2 === 0;
  ctx.fillStyle = blink ? "#ffaaaa" : "#ffffff";
  ctx.fillRect(px, py + 6, 22, 14);
  ctx.fillRect(px + (player.dir > 0 ? 14 : -4), py, 10, 10);
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(px + (player.dir > 0 ? 22 : -8), py + 4, 6, 4);
  ctx.fillStyle = "#000";
  ctx.fillRect(px + (player.dir > 0 ? 17 : -1), py + 2, 3, 3);

  if (quackFx > 0) {
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 34 + (0.4 - quackFx) * 120, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffff00"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
    ctx.fillText("KWA-KWA!", cx, cy - 24);
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(px - 2, py - 8, 26, 5);
  ctx.fillStyle = player.hp > 50 ? "#00ff00" : (player.hp > 25 ? "#ffcc00" : "#ff0000");
  ctx.fillRect(px - 2, py - 8, 26 * (player.hp / 100), 5);

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
  if (state === "gra") update(dt);
  draw();
  requestAnimationFrame(loop);
}

btnStart.addEventListener("click", () => {
  try { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); } catch (e) {}
  if (state === "pauza") { togglePause(); return; }
  newGame();
});

setupTouch();
showMenu();
draw();
requestAnimationFrame(loop);
