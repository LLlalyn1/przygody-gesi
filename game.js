// Wielkie przygody gęsi — prototyp v4
// 2D top-down, HTML5 Canvas, czysty JS. Wszystko po polsku.
// Menu (single/ko-op/ustawienia), maskotka, ambient, DUCH, BOSS, dotyk.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const mascot = document.getElementById("mascot");
const mctx = mascot && mascot.getContext ? mascot.getContext("2d") : null;
if (mctx) mctx.imageSmoothingEnabled = false;
const doll = document.getElementById("paperdoll");
const dctx = doll && doll.getContext ? doll.getContext("2d") : null;
if (dctx) dctx.imageSmoothingEnabled = false;
const DOLL_NODES = [
  { slot: "hat", label: "Kapelusz", x: 105, y: 60, r: 24 },
  { slot: "glasses", label: "Oczy", x: 88, y: 150, r: 22 },
  { slot: "scarf", label: "Szalik", x: 460, y: 125, r: 24 },
  { slot: "duck", label: "Kaczka", x: 460, y: 205, r: 24 },
  { slot: "shoes", label: "Buty", x: 105, y: 275, r: 24 }
];
let dollEnterT = 99, dollExit = -1, pendingScreen = null;
function currentScreen() {
  const ids = ["scr-main", "scr-multi", "scr-custom", "scr-settings", "scr-msg"];
  for (const s of ids) {
    try { if (!document.getElementById(s).hidden) return s; } catch (e) {}
  }
  return "";
}
// klik w węzeł = następny wariant
function cycleSlot(slot) {
  if (slot === "duck") bodyColor = BODY_KEYS[(BODY_KEYS.indexOf(bodyColor) + 1) % BODY_KEYS.length];
  else if (slot === "scarf") {
    const ks = Object.keys(BANDANAS);
    bandana = ks[(ks.indexOf(bandana) + 1) % ks.length];
  }
  else if (slot === "hat") hat = HATS[(HATS.indexOf(hat) + 1) % HATS.length];
  else if (slot === "shoes") shoes = SHOE_KEYS[(SHOE_KEYS.indexOf(shoes) + 1) % SHOE_KEYS.length];
  else if (slot === "glasses") glasses = GLASSES[(GLASSES.indexOf(glasses) + 1) % GLASSES.length];
  saveSettings();
  setTab(slot);
  sndEat();
}
// --- paper-doll: gęś na środku, linie do węzłów, klik wybiera slot ---
function dollPartAt(x, y) {
  const ax = (x - 120) / 0.95, ay = (y - 5) / 0.95;
  if (ax >= 40 && ax <= 75 && ay >= 52 && ay <= 78) return "glasses";
  if (ax >= 10 && ax <= 110 && ay >= 45 && ay <= 95) return "hat";
  if (ax >= 50 && ax <= 92 && ay >= 105 && ay <= 140) return "scarf";
  if (ax >= 40 && ax <= 145 && ay >= 140 && ay <= 210) return "duck";
  if (ax >= 40 && ax <= 135 && ay >= 200 && ay <= 225) return "shoes";
  return null;
}
function drawPaperdoll(t) {
  if (!dctx) return;
  const g = dctx, pal = bodyPal();
  g.clearRect(0, 0, 560, 340);
  const ox = 50, oy = 55;
  const bob = Math.sin(t * 2) * 2;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  g.save();
  let sc, offX, stepBob;
  if (dollExit >= 0) {
    const q = Math.min(1, dollExit / 0.65); // wyjście: maleje i w prawo
    sc = 0.95 - 0.5 * q * q;
    offX = 300 * q * q;
    stepBob = -Math.abs(Math.sin(t * 14)) * 8 * (1 - q);
  } else {
    const enter = Math.min(1, dollEnterT / 1.2);
    const ease = 1 - Math.pow(1 - enter, 3);
    sc = 0.45 + 0.5 * ease; // wyrasta z maskotki
    offX = (1 - ease) * (1 - ease) * 300;
    stepBob = enter < 1 ? -Math.abs(Math.sin(t * 14)) * 8 : 0;
  }
  const gx = 120 + offX, gy = 5 + stepBob;
  g.translate(gx, gy);
  g.scale(sc, sc);
  drawGoose(g, ox, oy + bob, 1, { body: bodyColor, bandana, hat, shoes, glasses }, { blink: (t % 4) < 0.15 });
  g.restore();
  const T = (ax, ay) => [gx + sc * ax, gy + sc * ay];
  const anchors = { hat: T(ox + 60, oy + 64 + bob), glasses: T(ox + 55, oy + 64 + bob), scarf: T(ox + 68, oy + 115 + bob), duck: T(ox + 91, oy + 174 + bob), shoes: T(ox + 86, oy + 217) };
  DOLL_NODES.forEach((n) => {
    const a = anchors[n.slot];
    const sel = customTab === n.slot;
    const left = n.x < a[0];
    const ex = left ? n.x + n.r : n.x - n.r;
    g.strokeStyle = sel ? "#58a6ff" : "#484f58"; g.lineWidth = sel ? 3 : 2;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(left ? ex + 30 : ex - 30, n.y);
    g.lineTo(ex, n.y);
    g.stroke();
    g.beginPath(); g.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    g.fillStyle = "#0d1117"; g.fill();
    g.lineWidth = 3; g.strokeStyle = sel ? "#58a6ff" : "#484f58"; g.stroke();
    if (n.slot === "hat") {
      if (hat === "none") { g.fillStyle = "#666"; g.font = "20px monospace"; g.textAlign = "center"; g.fillText("✕", n.x, n.y + 7); }
      else drawHat(g, n.x, n.y + 8, 1.3, hat);
    } else if (n.slot === "scarf") {
      if (!BANDANAS[bandana]) { g.fillStyle = "#666"; g.font = "20px monospace"; g.textAlign = "center"; g.fillText("✕", n.x, n.y + 7); }
      else { g.fillStyle = BANDANAS[bandana]; g.fillRect(n.x - 13, n.y - 7, 26, 12); g.fillRect(n.x + 2, n.y + 4, 8, 10); }
    } else if (n.slot === "duck") {
      g.fillStyle = pal.base; g.fillRect(n.x - 12, n.y - 8, 24, 16);
    } else if (n.slot === "glasses") {
      if (glasses === "none") { g.fillStyle = "#666"; g.font = "20px monospace"; g.textAlign = "center"; g.fillText("✕", n.x, n.y + 7); }
      else drawGlasses(g, n.x, n.y + 6, 1.4, glasses);
    } else {
      const st = shoeFor();
      if (!st) { g.fillStyle = "#666"; g.font = "20px monospace"; g.textAlign = "center"; g.fillText("✕", n.x, n.y + 7); }
      else { g.fillStyle = st.main; g.fillRect(n.x - 12, n.y - 6, 24, 12); g.fillStyle = st.sole; g.fillRect(n.x - 12, n.y + 5, 24, 3); }
    }
    g.fillStyle = sel ? "#fff" : "#888"; g.font = (sel ? "bold " : "") + "13px monospace"; g.textAlign = "center";
    g.fillText(n.label, n.x, n.y + n.r + 14);
    g.fillStyle = sel ? "#ffcc00" : "#666"; g.font = "11px monospace";
    g.fillText(variantName(n.slot), n.x, n.y + n.r + 28);
  });
}
if (doll) doll.addEventListener("click", (e) => {
  try {
    const r = doll.getBoundingClientRect();
    const x = (e.clientX - r.left) * 560 / r.width;
    const y = (e.clientY - r.top) * 340 / r.height;
    for (const n of DOLL_NODES) {
      if (Math.hypot(x - n.x, y - n.y) < n.r + 8) { cycleSlot(n.slot); return; }
    }
    const part = dollPartAt(x, y);
    if (part) cycleSlot(part);
  } catch (err) {}
});

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
const MAX_LEVEL = 5;
const TARGETS = [0, 8, 10, 12, 14, 16];
const ENEMY_SPEED = [0, 122, 134, 148, 158, 168];

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyP" || e.code === "Escape") {
    if (e.code === "Escape" && state === "lobby") { leaveRoom(); showMenu(); return; }
    togglePause(); return;
  }
  if (e.code === "KeyM") { toggleMute(); return; }
  if (e.code === "Minus" || e.code === "NumpadSubtract") { changeVolume(-0.1); return; }
  if (e.code === "Equal" || e.code === "NumpadAdd") { changeVolume(0.1); return; }
  if (state !== "gra") return;
  if (mode === "net-guest") {
    if (e.code === "Space") net.q = true;
    if (e.code === "KeyE") net.e = true;
    return;
  }
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
const TRAP_MAX = 5, TRAP_REGEN = 6;
let trapStock = TRAP_MAX, trapRegen = 0;
let mascotT = 0, mascotPeck = 0, sens = 1, vibOn = true;
let parts = [];
let bandana = "red", hat = "none", nick = "";
const BANDANAS = { none: null, red: "#e63946", blue: "#3a86ff", green: "#38b000", yellow: "#ffbe0b", purple: "#9d4edd" };
let bodyColor = "white";
const BODIES = {
  white: { base: "#ffffff", belly: "#dfe6ee", wing: "#c8d2dd", wing2: "#aeb9c6", eye: "#000000" },
  gray: { base: "#9aa0a6", belly: "#c3c9d1", wing: "#7b8188", wing2: "#5f656d", eye: "#000000" },
  brown: { base: "#8a5a2b", belly: "#b07a3f", wing: "#6e4520", wing2: "#54330f", eye: "#000000" },
  black: { base: "#26262b", belly: "#3d3d45", wing: "#17171b", wing2: "#0c0c0f", eye: "#ffffff" }
};
const BODY_KEYS = ["white", "gray", "brown", "black"];
const BODY_NAMES = { white: "Biała", gray: "Szara", brown: "Brązowa", black: "Czarna" };
const SCARF_NAMES = { none: "Brak", red: "Czerwony", blue: "Niebieski", green: "Zielony", yellow: "Żółty", purple: "Fioletowy" };
const HAT_NAMES = { none: "Brak", cylinder: "Cylinder", beanie: "Czapka", helmet: "Kask" };
const SHOE_NAMES = { none: "Brak", adidasy: "Adidasy", kalosze: "Kalosze" };
const GLASS_NAMES = { none: "Brak", ciemne: "Ciemne", kujon: "Kujon" };
function bodyPal() { return BODIES[bodyColor] || BODIES.white; }
function variantName(slot) {
  if (slot === "duck") return BODY_NAMES[bodyColor] || "";
  if (slot === "scarf") return SCARF_NAMES[bandana] || "";
  if (slot === "hat") return HAT_NAMES[hat] || "";
  if (slot === "shoes") return SHOE_NAMES[shoes] || "";
  return GLASS_NAMES[glasses] || "";
}
const HATS = ["none", "cylinder", "beanie", "helmet"];
const GLASSES = ["none", "ciemne", "kujon"];
let glasses = "none";
function drawGlasses(c, cx, ey, s, style) {
  if (style === "ciemne") {
    c.fillStyle = "#111111";
    c.fillRect(Math.round(cx - 7 * s), Math.round(ey - 2 * s), Math.round(14 * s), Math.round(6 * s));
    c.fillStyle = "#888888";
    c.fillRect(Math.round(cx - 7 * s), Math.round(ey + 3 * s), Math.round(14 * s), Math.round(1 * s));
  } else if (style === "kujon") {
    c.fillStyle = "#dddddd";
    c.fillRect(Math.round(cx - 7 * s), Math.round(ey - 2 * s), Math.round(6 * s), Math.round(6 * s));
    c.fillRect(Math.round(cx + 1 * s), Math.round(ey - 2 * s), Math.round(6 * s), Math.round(6 * s));
    c.fillStyle = "#000000";
    c.fillRect(Math.round(cx - 5 * s), Math.round(ey), Math.round(2 * s), Math.round(2 * s));
    c.fillRect(Math.round(cx + 3 * s), Math.round(ey), Math.round(2 * s), Math.round(2 * s));
  }
}
const SHOES = { none: null, adidasy: { main: "#e63946", sole: "#ffffff" }, kalosze: { main: "#ffbe0b", sole: "#5a3c00" } };
const SHOE_KEYS = ["none", "adidasy", "kalosze"];
let shoes = "none";
function shoeFor() { return SHOES[shoes] || null; }
const mascotPos = { x: 0, y: 0 };
function drawHat(c, cx, top, s, style) {
  if (style === "cylinder") {
    c.fillStyle = "#161616"; c.fillRect(Math.round(cx - 7 * s), Math.round(top - 8 * s), Math.round(14 * s), Math.round(8 * s));
    c.fillRect(Math.round(cx - 10 * s), Math.round(top - 1 * s), Math.round(20 * s), Math.round(2 * s));
    c.fillStyle = "#888"; c.fillRect(Math.round(cx - 7 * s), Math.round(top - 3 * s), Math.round(14 * s), Math.round(2 * s));
  } else if (style === "beanie") {
    c.fillStyle = "#d62828"; c.fillRect(Math.round(cx - 7 * s), Math.round(top - 6 * s), Math.round(14 * s), Math.round(6 * s));
    c.fillStyle = "#fff"; c.fillRect(Math.round(cx - 7 * s), Math.round(top - 1 * s), Math.round(14 * s), Math.round(2 * s));
    c.fillRect(Math.round(cx - 2 * s), Math.round(top - 9 * s), Math.round(4 * s), Math.round(4 * s));
  } else if (style === "helmet") {
    c.fillStyle = "#ffb703"; c.fillRect(Math.round(cx - 8 * s), Math.round(top - 6 * s), Math.round(16 * s), Math.round(6 * s));
    c.fillStyle = "#fb8500"; c.fillRect(Math.round(cx - 8 * s), Math.round(top - 1 * s), Math.round(16 * s), Math.round(2 * s));
    c.fillStyle = "#fff"; c.fillRect(Math.round(cx - 2 * s), Math.round(top - 5 * s), Math.round(4 * s), Math.round(2 * s));
  }
}
function bandanaFor(p) {
  if (p === P2()) {
    const mine = BANDANAS[bandana];
    return mine === BANDANAS.blue ? BANDANAS.red : BANDANAS.blue;
  }
  return BANDANAS[bandana] || null;
}
function lookOf(p) {
  if (p && p.look) return p.look;
  return { body: bodyColor, bandana, hat, shoes, glasses };
}
function myLook() { return { body: bodyColor, bandana, hat, shoes, glasses }; }
function palOf(L) { return BODIES[L.body] || BODIES.white; }
function scarfOf(L) { return (L.bandana && L.bandana !== "none" ? BANDANAS[L.bandana] : null) || null; }
const mouseLook = { x: 0, y: 0 };
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("mousemove", (e) => {
    try {
      const r = mascot.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 3;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      mouseLook.x = dx / len; mouseLook.y = dy / len;
    } catch (err) {}
  });
}

function saveSettings() {
  try { localStorage.setItem("gesi_set", JSON.stringify({ v: volume, fx: volFx, mus: volMusic, s: sens, vib: vibOn, mo: musicOn, b: bandana, h: hat, n: nick, sh: shoes, bd: bodyColor, gl: glasses })); } catch (e) {}
}
function loadSettings() {
  try {
    const raw = localStorage.getItem("gesi_set");
    const s = JSON.parse(raw || "null");
    if (!s) { randomLook(); saveSettings(); return; }
    if (typeof s.v === "number") volume = s.v;
    if (typeof s.fx === "number") volFx = s.fx;
    if (typeof s.mus === "number") volMusic = s.mus;
    if (typeof s.s === "number") sens = s.s;
    if (typeof s.vib === "boolean") vibOn = s.vib;
    if (typeof s.mo === "boolean") musicOn = s.mo;
    if (typeof s.b === "string" && BANDANAS.hasOwnProperty(s.b)) bandana = s.b;
    if (typeof s.h === "string" && HATS.indexOf(s.h) >= 0) hat = s.h;
    if (typeof s.n === "string") nick = s.n.slice(0, 12);
    if (typeof s.sh === "string" && SHOES.hasOwnProperty(s.sh)) shoes = s.sh;
    if (typeof s.bd === "string" && BODIES[s.bd]) bodyColor = s.bd;
    if (typeof s.gl === "string" && GLASSES.indexOf(s.gl) >= 0) glasses = s.gl;
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
const ASSET_V = "v13";
function loadSfx(name) {
  try {
    if (typeof Audio === "undefined") return;
    const a = new Audio("sounds/" + name + ".wav?" + ASSET_V);
    a.preload = "auto";
    SFX[name] = a;
  } catch (e) {}
}
function randomLook() {
  const cols = Object.keys(BANDANAS);
  bandana = cols[Math.floor(Math.random() * cols.length)];
  hat = HATS[Math.floor(Math.random() * HATS.length)];
  shoes = SHOE_KEYS[Math.floor(Math.random() * SHOE_KEYS.length)];
  bodyColor = BODY_KEYS[Math.floor(Math.random() * BODY_KEYS.length)];
  glasses = GLASSES[Math.floor(Math.random() * GLASSES.length)];
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
    musicEl = new Audio("sounds/ambient.wav?" + ASSET_V);
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

// --- rekordy v2: najlepsi gracze (punkty) + najlepsze czasy + życie ---
const REC_KEY = "gesi_rekordy_v2";
let runBugs = 0;
function loadRec() {
  try {
    const r = JSON.parse(localStorage.getItem(REC_KEY) || "null");
    if (r && r.best && r.times && r.life) return r;
  } catch (e) {}
  return { best: {}, times: [], life: { games: 0, wins: 0, bugs: 0, time: 0 } };
}
function dispName() { return (nick || "").trim().slice(0, 12) || "Gęś"; }
// co pobije? liczone PRZED zapisem
function rateRun(win, s, t) {
  const r = loadRec(), nm = dispName();
  return {
    points: s > 0 && s > (r.best[nm] || 0),
    time: win && (r.times.length < 5 || t < r.times[r.times.length - 1].t)
  };
}
function saveResult(win, s, t, bugs) {
  const r = loadRec(), nm = dispName();
  if (s > (r.best[nm] || 0)) r.best[nm] = s;
  if (win) {
    r.times.push({ n: nm, t: Math.round(t * 10) / 10 });
    r.times.sort((a, b) => a.t - b.t);
    r.times = r.times.slice(0, 5);
  }
  r.life.games++;
  if (win) r.life.wins++;
  r.life.bugs += bugs;
  r.life.time += Math.round(t);
  try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) {}
  return r;
}
function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ":" + String(s).padStart(2, "0");
}
function bestHTML() {
  const r = loadRec();
  const names = Object.keys(r.best).sort((a, b) => r.best[b] - r.best[a]);
  let h = "<p><b>TOP5 punkty:</b></p>";
  if (!names.length) h += "<p class='dim'>Brak - zagraj!</p>";
  names.slice(0, 5).forEach((n, i) => { h += "<div>" + (i + 1) + ". " + n + " - <b>" + r.best[n] + " pkt</b></div>"; });
  h += "<p><b>TOP5 czas:</b></p>";
  if (!r.times.length) h += "<p class='dim'>Brak - wygraj grę!</p>";
  r.times.slice(0, 5).forEach((x, i) => { h += "<div>" + (i + 1) + ". " + x.n + " - <b>" + fmtTime(x.t) + "</b></div>"; });
  return h;
}
function statsHTML() {
  const r = loadRec();
  const L = r.life;
  let h = "<p><b>📊 Statystyki</b></p>";
  h += "<div>Gry: <b>" + L.games + "</b> • Wygrane: <b>" + L.wins + "</b></div>";
  h += "<div>Owady łącznie: <b>" + L.bugs + "</b> • Czas w grze: <b>" + fmtTime(L.time) + "</b></div>";
  h += bestHTML();
  return h;
}
function loadRekordy() { // zgodność wsteczna
  const r = loadRec();
  return Object.keys(r.best).map((n) => ({ s: r.best[n], l: MAX_LEVEL, d: "" }));
}
function rekordyHTML() {
  const r = loadRec();
  const names = Object.keys(r.best).sort((a, b) => r.best[b] - r.best[a]).slice(0, 5);
  if (!names.length) return "<p style='opacity:.6'>Brak rekordów - bądź pierwszy!</p>";
  let h = "<p><b>🏆 Rekordy TOP5:</b></p>";
  names.forEach((n, i) => { h += "<div>" + (i + 1) + ". " + n + " - " + r.best[n] + " pkt</div>"; });
  if (r.times.length) h += "<p>⏱ <b>" + r.times[0].n + " - " + fmtTime(r.times[0].t) + "</b></p>";
  return h;
}

// --- ekrany menu ---
function showScreen(id) {
  if (currentScreen() === "scr-custom" && id !== "scr-custom" && state === "menu" && dollExit < 0) {
    dollExit = 0; pendingScreen = id; // najpierw gęś wychodzi
    return;
  }
  doShow(id);
}
function doShow(id) {
  ["scr-main", "scr-multi", "scr-custom", "scr-stats", "scr-settings", "scr-lobby", "scr-msg"].forEach((s) => {
    document.getElementById(s).hidden = (s !== id);
  });
  const rec = document.getElementById("records");
  if (rec) rec.style.display = (id === "scr-main") ? "" : "none";
  const ob = document.getElementById("overlayBox");
  if (ob) ob.classList.toggle("wide", id === "scr-custom");
  if (id === "scr-custom") dollEnterT = 0;
  if (mascot && mascot.style) mascot.style.display = (id === "scr-main" || id === "scr-multi" || id === "scr-settings") ? "" : "none";
}
function showMenu() {
  state = "menu";
  overlay.classList.remove("hidden", "transparent");
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

// --- JEDNA gęś na wszystko. flip = jawne odbicie współrzędnych (bez transform) ---
function drawHatFlip(g, X, Y, S, style, flip) {
  if (!style || style === "none") return;
  drawHatFlipReal(g, X, Y, S, style, flip);
}
function drawHatFlipReal(g, X, Y, S, style, flip) {
  const sv = g.save ? true : false;
  if (sv) g.save();
  // rysujemy symetrycznie wokół środka głowy (60, ~56), więc flip to przesunięcie
  const cx = X + 60 * S;
  if (flip) { g.translate(2 * cx, 0); g.scale(-1, 1); }
  drawHat(g, X + 60 * S, Y + 56 * S, 3 * S, style);
  if (sv) g.restore();
  void cx;
}
function drawGlassesFlip(g, X, Y, S, style, flip) {
  const cx = X + 59 * S;
  if (flip) { g.save(); g.translate(2 * cx, 0); g.scale(-1, 1); }
  drawGlasses(g, cx, Y + 66 * S, 2 * S, style);
  if (flip) g.restore();
}
function drawGoose(g, X, Y, S, L, o) {
  o = o || {};
  L = L || {};
  const pal = (BODIES[L.body] || BODIES.white);
  const MX = (x, w) => o.flip ? 200 - x - w : x;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(X + MX(x, w) * S, Y + y * S, w * S, h * S); };
  const sw = o.legSwing || 0;
  R(53, 202, 12, 14 + sw, "#ff8800");
  R(107, 202, 12, 14 - sw, "#e07b00");
  const sh = (L.shoes && L.shoes !== "none") ? SHOES[L.shoes] : null;
  if (sh) {
    R(51, 212, 28, 8, sh.main); R(99, 212, 28, 8, sh.main);
    R(51, 219, 28, 3, sh.sole); R(99, 219, 28, 3, sh.sole);
  }
  R(133, 148, 26, 12, pal.belly);
  R(127, 138, 20, 12, pal.base);
  const fl = o.flash ? "#ffaaaa" : null;
  R(45, 144, 92, 60, fl || pal.base);
  R(45, 184, 92, 20, fl || pal.belly);
  if (o.flap) R(67, 116, 60, 26, pal.wing);
  else { R(67, 152, 56, 24, pal.wing); R(67, 172, 56, 6, pal.wing2); }
  R(53, 84, 30, 62, fl || pal.base);
  R(75, 84, 8, 62, fl || pal.belly);
  const sc = (L.bandana && L.bandana !== "none") ? BANDANAS[L.bandana] : null;
  if (sc) { R(50, 110, 36, 11, sc); R(75, 120, 8, 10, sc); }
  R(37, 56, 46, 32, fl || pal.base);
  drawHatFlip(g, X, Y, S, L.hat, o.flip);
  const bc = o.beak || "#ff8800";
  R(15, 64, 22, 9, bc);
  if (o.open) R(15, 77, 22, 9, "#e07b00");
  drawGlassesFlip(g, X, Y, S, L.glasses, o.flip);
}

// --- maskotka: gęś pyskiem do przycisków (lewo), oczy za myszką, dziobie ---
function drawMascot(t) {
  if (!mctx) return;
  mctx.clearRect(0, 0, 200, 260);
  const cyc = t % 10;
  const peck = mascotPeck > 0 ? 1 - mascotPeck / 0.55 : 0; // 0→1, uderzenie ~0.6
  const exc = peck > 0 ? Math.sin(Math.min(1, peck) * Math.PI) : 0;
  const kwa = cyc > 9.0 || exc > 0.5;
  const flap = (t % 7) < 0.6;
  let hop = kwa && exc <= 0.5 ? -Math.sin((cyc - 9.0) * Math.PI) * 26 : 0;
  if (exc > 0) hop += -Math.abs(Math.sin(t * 9)) * 10 * exc;
  const bob = Math.sin(t * 2) * 2;
  const lean = -38 * exc; // wypad dziobem do przycisków (zostaje w kadrze)
  const tilt = 0.28 * exc;
  const L = { body: bodyColor, bandana, hat, shoes, glasses };
  mctx.save();
  mctx.translate(100 + lean + mascotPos.x, 150 + mascotPos.y + bob + hop);
  mctx.rotate(tilt);
  mctx.translate(-100, -150);
  drawGoose(mctx, 0, 0, 1, L, {
    blink: (t % 4) < 0.15, flap, open: kwa,
    eyeDX: Math.round(mouseLook.x * 3), eyeDY: Math.round(mouseLook.y * 3)
  });
  mctx.restore();
  if (exc > 0.4) {
    mctx.strokeStyle = "#ffff00"; mctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = 100 + i * 22;
      mctx.beginPath(); mctx.moveTo(44, yy); mctx.lineTo(22, yy); mctx.stroke();
    }
  }
  mctx.fillStyle = "#8a93a0"; mctx.font = "12px monospace"; mctx.textAlign = "center";
  mctx.fillText("Zemsta gęsi", 100, 254);
}

// --- poziomy ---
function mkPlayer(name, x, runKey) {
  return { name, tag: null, x, y: 500, w: 22, h: 22, hp: 100, dir: 1, quackCd: 0, hurtCd: 0, chomp: 0, anim: 0, moving: false, dead: false, runKey };
}
function newGame(m) {
  mode = m;
  players = [mkPlayer("Gęś 1", 80, "ShiftLeft")];
  if (mode === "coop") players.push(mkPlayer("Gęś 2", 150, "ShiftRight"));
  players[0].tag = nick || (mode === "coop" ? "P1" : null);
  if (P2()) P2().tag = "P2";
  runBugs = 0;
  level = 1; score = 0; levelBugs = 0;
  startTime = performance.now();
  elapsed = 0;
  setupLevel();
  state = "gra";
  document.getElementById("hud").style.display = "flex";
  overlay.classList.add("hidden");
  overlay.classList.remove("transparent");
}

function mkEnemy(kind, x, y) {
  if (kind === "boss") return { kind, x, y, w: 42, h: 42, hp: 3, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
  if (kind === "ghost") return { kind, x, y, w: 24, h: 24, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
  return { kind: "sanit", x, y, w: 26, h: 26, scare: 0, stun: 0, tx: x, ty: y, wait: 0 };
}

function setupLevel() {
  traps = [];
  parts = [];
  trapStock = TRAP_MAX; trapRegen = 0;
  exitDoor = { x: 360, y: 16, w: 80, h: 24, open: false };
  players[0].x = 80; players[0].y = 500;
  if (P2()) { P2().x = 150; P2().y = 500; }
  players.forEach((p) => { if (p.dead) { p.dead = false; p.hp = 60; } else p.hp = Math.min(100, p.hp + 25); p.quackCd = 0; });
  levelBugs = 0;
  genLevel(level);
  bugs = [];
  for (let i = 0; i < 5; i++) spawnBug();
  quackFx = 0; shakeT = 0;
  levelMsg = 2.5;
  updateHUD();
}

// losowy układ: ściany omijają start i drzwi, trucizna i wrogowie rosną z poziomem
function clearOf(px, py, pad) {
  if (px < 240 && py > 400) return false;                    // start
  if (px > 300 - pad && px < 500 + pad && py < 140 + pad) return false; // drzwi
  return true;
}
function genLevel(n) {
  for (let a = 0; a < 12; a++) {
    if (attemptGen(n) && pathExists()) return;
  }
  attemptGen(n); // awaryjnie: cokolwiek grywalnego
}
function blockedAt(px, py) {
  for (const wl of walls) {
    if (px > wl.x - 12 && px < wl.x + wl.w + 12 && py > wl.y - 12 && py < wl.y + wl.h + 12) return true;
  }
  for (const p of poisons) {
    if (Math.hypot(px - p.x, py - p.y) < p.r + 14) return true;
  }
  return false;
}
function pathExists() {
  const cols = 40, rows = 30, cell = 20;
  const key = (x, y) => y * cols + x;
  const sx = 4, sy = 25, gx = 20, gy = 2;
  if (blockedAt(sx * cell, sy * cell)) return true; // start i tak czyszczony
  const seen = new Set([key(sx, sy)]);
  const q = [[sx, sy]];
  while (q.length) {
    const [cx, cy] = q.pop();
    if (Math.abs(cx - gx) + Math.abs(cy - gy) < 3) return true;
    const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of nb) {
      if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1 || seen.has(key(nx, ny))) continue;
      if (blockedAt(nx * cell, ny * cell)) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return false;
}
function attemptGen(n) {
  walls = [
    { x: 0, y: 0, w: 800, h: 16 },
    { x: 0, y: 584, w: 800, h: 16 },
    { x: 0, y: 0, w: 16, h: 600 },
    { x: 784, y: 0, w: 16, h: 600 },
  ];
  const segs = 1 + n; // 2..6 ścian
  let guard = 0;
  while (walls.length < 4 + segs && guard++ < 80) {
    const horiz = Math.random() < 0.6;
    const w = horiz ? Math.round(rand(120, 220)) : 20;
    const h = horiz ? 20 : Math.round(rand(100, 180));
    const x = Math.round(rand(60, 720 - w)), y = Math.round(rand(80, 500 - h));
    if (!clearOf(x + w / 2, y + h / 2, 60)) continue;
    let bad = false;
    for (const o of walls.slice(4)) {
      if (Math.hypot(x + w / 2 - (o.x + o.w / 2), y + h / 2 - (o.y + o.h / 2)) < 190) { bad = true; break; }
    }
    if (bad) continue;
    walls.push({ x, y, w, h });
  }
  poisons = [];
  guard = 0;
  while (poisons.length < 2 + n && guard++ < 80) {
    const p = { x: Math.round(rand(80, 720)), y: Math.round(rand(100, 520)), r: Math.round(rand(32, 48)) };
    if (!clearOf(p.x, p.y, p.r + 20)) continue;
    let bad = false;
    for (const o of poisons) {
      if (Math.hypot(p.x - o.x, p.y - o.y) < 100) { bad = true; break; }
    }
    if (bad) continue;
    for (const wl of walls) {
      if (p.x > wl.x - p.r && p.x < wl.x + wl.w + p.r && p.y > wl.y - p.r && p.y < wl.y + wl.h + p.r) { bad = true; break; }
    }
    if (bad) continue;
    poisons.push(p);
  }
  const kinds = n === 1 ? ["sanit"] : n === 2 ? ["sanit", "ghost"] : n === 3 ? ["sanit", "sanit", "ghost"] : n === 4 ? ["sanit", "ghost", "boss"] : ["sanit", "ghost", "ghost", "boss"];
  enemies = kinds.map((k, i) => mkEnemy(k, 420 + (i % 2) * 180, 110 + i * 90));
  return true;
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
  if (!p || state !== "gra" || p.dead || trapStock <= 0 || traps.length >= TRAP_MAX) return;
  trapStock--;
  traps.push({ x: p.x, y: p.y, w: 18, h: 18, life: 25 });
  sndTrap();
}

function togglePause() {
  if (state === "gra") {
    state = "pauza";
    showMsg("PAUZA", "Poziom " + level + "/" + MAX_LEVEL + " (" + (mode === "coop" ? "2 graczy" : mode === "solo" ? "solo" : "online") + "). Odpocznij, gęsi.", "Kontynuuj", true);
    const er = document.getElementById("endRow");
    if (er) er.style.display = "none";
    const bb = document.getElementById("recBanner");
    if (bb) bb.textContent = "";
  } else if (state === "pauza") {
    state = "gra";
    overlay.classList.add("hidden");
    overlay.classList.remove("transparent");
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
  if (mode !== "solo" && P2()) {
    hp2wrap.hidden = false;
    hp2El.textContent = P2().dead ? "☠" : Math.ceil(P2().hp);
  } else hp2wrap.hidden = true;
  bugsEl.textContent = Math.min(levelBugs, targetBugs()) + "/" + targetBugs();
  scoreEl.textContent = score;
  levelEl.textContent = level + "/" + MAX_LEVEL;
  const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60);
  timeEl.textContent = m + ":" + String(s).padStart(2, "0");
}

// interpolacja gościa: gładki ruch między klatkami (render 120 ms za hostem)
function guestInterp() {
  const b = net.buf;
  if (!b || b.length < 2) return;
  const prev = b[b.length - 2], cur = b[b.length - 1];
  const now = performance.now();
  if (now - cur.t > 600) return; // za stare — stój na ostatniej
  const rt = now - 120;
  const span = Math.max(1, cur.t - prev.t);
  const f = Math.max(0, Math.min(1, (rt - prev.t) / span));
  const L = (A, B, arr) => {
    if (!A || !B || A.length !== B.length || B.length !== arr.length) return;
    for (let i = 0; i < arr.length; i++) {
      arr[i].x = A[i].x + (B[i].x - A[i].x) * f;
      arr[i].y = A[i].y + (B[i].y - A[i].y) * f;
    }
  };
  L(prev.players, cur.players, players);
  L(prev.enemies, cur.enemies, enemies);
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
  if (mode === "net-guest") {
    elapsed = (performance.now() - startTime) / 1000;
    sendInput();
    if (score > (net.lastScore || 0)) { sndEat(); net.lastScore = score; }
    guestInterp();
    updateParts(dt);
    updateHUD();
    return;
  }
  if (mode === "net-host" && netCountdown > 0) {
    const before = Math.ceil(netCountdown);
    netCountdown = Math.max(0, netCountdown - dt);
    if (Math.ceil(netCountdown) < before && netCountdown > 0) beep(440, 0.1, "square");
    if (netCountdown === 0) sndLevel();
    elapsed = (performance.now() - startTime) / 1000;
    sendState();
    updateHUD();
    return;
  }
  elapsed = (performance.now() - startTime) / 1000;
  quackFx = Math.max(0, quackFx - dt);
  levelMsg = Math.max(0, levelMsg - dt);
  volMsg = Math.max(0, volMsg - dt);
  shakeT = Math.max(0, shakeT - dt);
  if (trapStock < TRAP_MAX) {
    trapRegen += dt;
    while (trapStock < TRAP_MAX && trapRegen >= TRAP_REGEN) { trapStock++; trapRegen -= TRAP_REGEN; }
  } else trapRegen = 0;

  // --- gracze ---
  const solos = (mode === "solo");
  let dx1 = (keys["KeyA"] ? -1 : 0) + (keys["KeyD"] ? 1 : 0) + (solos && keys["ArrowLeft"] ? -1 : 0) + (solos && keys["ArrowRight"] ? 1 : 0);
  let dy1 = (keys["KeyW"] ? -1 : 0) + (keys["KeyS"] ? 1 : 0) + (solos && keys["ArrowUp"] ? -1 : 0) + (solos && keys["ArrowDown"] ? 1 : 0);
  if (dx1 === 0 && dy1 === 0 && (joy.dx || joy.dy)) { dx1 = joy.dx * sens; dy1 = joy.dy * sens; }
  movePlayer(P1(), dx1, dy1, dt);
  if (P2() && !P2().dead && (mode === "coop" || (mode === "net-host" && net.guest))) {
    if (mode === "net-host" && net.guest) movePlayer(P2(), net.guest.dx, net.guest.dy, dt, net.guest.run);
    else movePlayer(P2(), (keys["ArrowLeft"] ? -1 : 0) + (keys["ArrowRight"] ? 1 : 0), (keys["ArrowUp"] ? -1 : 0) + (keys["ArrowDown"] ? 1 : 0), dt);
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
      const bc = center(bugs[i]);
      if (rectsOverlap(p, bugs[i]) || dist(center(p), bc) < 30) {
        bugs.splice(i, 1);
        levelBugs++;
        runBugs++;
        score += 10;
        p.hp = Math.min(100, p.hp + 6);
        p.chomp = 0.25;
        feather(bc.x, bc.y, 5, ["#c0ff33", "#ffffff"]);
        popup(bc.x, bc.y - 10, "+10", "#c0ff33");
        sndEat();
        if (levelBugs < targetBugs() + 2) spawnBug();
      }
    }
    p.quackCd = Math.max(0, p.quackCd - dt);
    p.hurtCd = Math.max(0, (p.hurtCd || 0) - dt);
    p.chomp = Math.max(0, (p.chomp || 0) - dt);
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
    // wykrywanie utknięcia: mało ruchu mimo pogoni -> objazd
    e.stuckT = (e.stuckT || 0) + dt;
    if (e.stuckT > 0.4) {
      const moved = Math.hypot(ec.x - (e.lx || ec.x), ec.y - (e.ly || ec.y));
      if (moved < 8 && tgt.p && tgt.d < chaseR && e.stun <= 0 && e.scare <= 0 && e.kind !== "ghost") {
        if (!e.detourT || e.detourT <= 0) {
          e.detourSide = (e.detourSide || 1) * -1;
          e.detourT = 1.1;
        }
      }
      e.lx = ec.x; e.ly = ec.y; e.stuckT = 0;
    }
    e.detourT = Math.max(0, (e.detourT || 0) - dt);
    if (e.stun <= 0) {
      if (e.scare > 0 && tgt.p) {
        const pc = center(tgt.p);
        const a = Math.atan2(ec.y - pc.y, ec.x - pc.x);
        mv(Math.cos(a) * 135 * dt, Math.sin(a) * 135 * dt);
      } else if (tgt.p && tgt.d < chaseR) {
        const pc = center(tgt.p);
        let a = Math.atan2(pc.y - ec.y, pc.x - ec.x);
        if (e.detourT > 0) a += (e.detourSide || 1) * 1.1; // łukiem wokół ściany
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
  // separacja wrogów (nie stoją jeden w drugim)
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    const d = Math.hypot(dx, dy), min = (a.w + b.w) / 2;
    if (d > 0.1 && d < min) {
      const push = (min - d) / 2, nx = dx / d, ny = dy / d;
      a.x = Math.max(16, Math.min(W - 16 - a.w, a.x - nx * push));
      a.y = Math.max(16, Math.min(H - 16 - a.h, a.y - ny * push));
      b.x = Math.max(16, Math.min(W - 16 - b.w, b.x + nx * push));
      b.y = Math.max(16, Math.min(H - 16 - b.h, b.y + ny * push));
    }
  }

  for (const p of alivePlayers()) {
    const dc = { x: exitDoor.x + exitDoor.w / 2, y: exitDoor.y + exitDoor.h / 2 };
    if (exitDoor.open && dist(center(p), dc) < 36) {
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
  if (mode === "net-host") sendState();
}

function movePlayer(p, dx, dy, dt, forceRun) {
  if (!p || p.dead) return;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    if (dx !== 0) p.dir = dx > 0 ? 1 : -1;
    p.moving = true;
    p.anim += dt * 11;
  } else p.moving = false;
  const running = (keys[p.runKey] || (p === P1() && touchRun) || forceRun) ? 1.6 : 1.0;
  moveWithWalls(p, dx * 170 * running * dt, dy * 170 * running * dt);
}

// finał: 1-2 te same gęsi co w menu, w ciemnych okularach
function drawEndArt(list) {
  const cv = document.getElementById("endart");
  if (!cv || !cv.getContext) return;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, 300, 170);
  const who = (list && list.length ? list : [{ dead: false }]).slice(0, 2);
  who.forEach((pl, i) => {
    const ox = who.length === 1 ? 95 : 20 + i * 150, oy = 12;
    if (!pl.dead) {
      g.fillStyle = "#ffff00";
      g.fillRect(ox - 14, oy + 30, 4, 12); g.fillRect(ox - 18, oy + 34, 12, 4);
      g.fillRect(ox + 116, oy + 80, 4, 12); g.fillRect(ox + 112, oy + 84, 12, 4);
    }
    g.globalAlpha = pl.dead ? 0.4 : 1;
    const L = Object.assign({}, lookOf(pl), { glasses: "ciemne" });
    drawGoose(g, ox, oy, 0.55, L, {});
    if (pl.dead) {
      g.fillStyle = "#fff"; g.font = "bold 22px monospace"; g.textAlign = "center";
      g.fillText("☠", ox + 55, oy + 140);
    }
    if (pl.tag) {
      g.font = "bold 12px monospace"; g.textAlign = "center";
      const tw = g.measureText(pl.tag).width + 10;
      g.fillStyle = "rgba(0,0,0,0.65)";
      g.fillRect(ox + 55 - tw / 2, oy + 150, tw, 16);
      g.fillStyle = "#fff";
      g.fillText(pl.tag, ox + 55, oy + 162);
    }
    g.globalAlpha = 1;
  });
}
function finishScreen(win, bugsN) {
  const rec = rateRun(win, score, elapsed);
  saveResult(win, score, elapsed, bugsN);
  const er = document.getElementById("endRow");
  if (er) er.style.display = "flex";
  drawEndArt(players);
  const es = document.getElementById("endStats");
  if (es) es.innerHTML = "Poziom: <b>" + level + "/" + MAX_LEVEL + "</b><br>Owady: <b>" + bugsN +
    "</b><br>Punkty: <b>" + score + "</b><br>Czas: <b>" + fmtTime(elapsed) + "</b>";
  const bb = document.getElementById("recBanner");
  if (bb) {
    const t = [];
    if (rec.points) t.push("🏆 NOWY REKORD PUNKTOWY!");
    if (rec.time) t.push("⏱ NOWY REKORD CZASU!");
    bb.textContent = t.join(" ");
  }
  scoreEl.textContent = score;
  return rec;
}

function endGame(win) {
  state = win ? "wygrana" : "przegrana";
  if (mode === "net-host") {
    try { if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify({ t: "over", win, score })); } catch (e) {}
  }
  if (win) {
    const bonus = Math.max(0, 300 - Math.floor(elapsed) * 2);
    score += bonus;
    showMsg("WYGRANA! Zemsta dokonana",
      "Uciekłeś ze Zofiówki (" + MAX_LEVEL + " poziomów).",
      (mode === "net-host" || mode === "net-guest") ? "Do menu" : "Zagraj ponownie", true);
    sndWin();
  } else {
    showMsg("PRZEGRANA (poziom " + level + ")",
      "Złapano cię w Zofiówce.",
      (mode === "net-host" || mode === "net-guest") ? "Do menu" : "Spróbuj ponownie", true);
    sndHurt();
  }
  finishScreen(win, runBugs);
}

function drawEnemy(e) {
  const wob = Math.sin(performance.now() / 180 + e.x * 0.1) * (e.stun > 0 ? 0 : 2);
  ctx.save();
  ctx.translate(0, Math.round(wob));
  drawEnemyBody(e);
  ctx.restore();
}

function drawEnemyBody(e) {
  if (e.kind === "ghost") {
    ctx.globalAlpha = 0.65 + 0.15 * Math.sin(performance.now() / 300);
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
  const hurtBlink = (p.hurtCd || 0) > 0 && Math.floor(performance.now() / 100) % 2 === 0;
  if (p.dead) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#888888";
    ctx.fillRect(px - 8, py - 12, 38, 34);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff"; ctx.font = "12px monospace"; ctx.textAlign = "center";
    ctx.fillText("☠", px + 11, py);
    return;
  }
  const L = lookOf(p);
  const swing = p.moving ? Math.sin(p.anim) * 3 : 0;
  const idle = p.moving ? 0 : Math.sin(performance.now() / 400) * 1;
  drawGoose(ctx, px - 11, py - 35 + idle, 0.22, L, {
    flip: p.dir > 0,
    legSwing: swing,
    open: (p.chomp > 0) || (quackFx > 0 && p === P1()),
    flash: hurtBlink,
    beak: p === P2() ? "#ff4444" : "#ff8800"
  });
  // pasek HP + tag
  ctx.fillStyle = "#000";
  ctx.fillRect(px - 2, py - 30, 26, 4);
  ctx.fillStyle = p.hp > 50 ? "#00ff00" : (p.hp > 25 ? "#ffcc00" : "#ff0000");
  ctx.fillRect(px - 2, py - 30, 26 * (p.hp / 100), 4);
  if (p.tag) {
    ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
    const tw = ctx.measureText(p.tag).width + 8;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(px + 11 - tw / 2, py - 45, tw, 14);
    ctx.fillStyle = "#fff";
    ctx.fillText(p.tag, px + 11, py - 34);
  }
}

function draw() {
  ctx.save();
  if (shakeT > 0) ctx.translate(rand(-4, 4) * shakeT * 3, rand(-4, 4) * shakeT * 3);
  ctx.fillStyle = "#1a1f2b";
  ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = "#151a25";
  for (let y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 2);

  if (state === "lobby") { drawLobby(); ctx.restore(); return; }
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

  // drzwi: framuga + panele + napis pod spodem (nie wychodzi za strefę)
  const dx0 = exitDoor.x, dy0 = exitDoor.y, dw = exitDoor.w, dh = exitDoor.h;
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(dx0 - 5, dy0 - 4, dw + 10, dh + 8);
  ctx.fillStyle = exitDoor.open ? "#00cc6a" : "#7a1f1f";
  ctx.fillRect(dx0, dy0, dw, dh);
  ctx.fillStyle = exitDoor.open ? "#00ff88" : "#a03030";
  ctx.fillRect(dx0 + 4, dy0 + 4, dw - 8, Math.max(2, dh / 2 - 6));
  ctx.fillRect(dx0 + 4, dy0 + dh / 2, dw - 8, Math.max(2, dh / 2 - 6));
  if (exitDoor.open) {
    ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2;
    const pr = 6 + Math.sin(performance.now() / 200) * 3;
    ctx.strokeRect(dx0 - 5 - pr, dy0 - 4 - pr, dw + 10 + pr * 2, dh + 8 + pr * 2);
  } else {
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(dx0 + dw / 2 - 4, dy0 + dh / 2 - 4, 8, 8);
  }
  ctx.font = "11px monospace"; ctx.textAlign = "center";
  if (exitDoor.open) {
    ctx.fillStyle = "#00ff88";
    ctx.fillText("WYJŚCIE", dx0 + dw / 2, dy0 + dh + 24);
  } else {
    ctx.fillStyle = "#ff6666";
    ctx.fillText("ZAMKNIĘTE " + Math.min(levelBugs, targetBugs()) + "/" + targetBugs(), dx0 + dw / 2, dy0 + dh + 24);
  }

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
  if (state === "gra") drawSkills();
  const cdShow = (mode === "net-host" || mode === "net-guest") ? netCountdown : 0;
  if (state === "gra" && cdShow > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffff00"; ctx.font = "bold 72px monospace"; ctx.textAlign = "center";
    ctx.fillText(cdShow > 0.6 ? String(Math.ceil(cdShow - 0.6)) : "START!", W / 2, H / 2);
    ctx.font = "16px monospace"; ctx.fillStyle = "#fff";
    ctx.fillText(mode === "net-host" ? "Host: WASD • Gość: WASD" : "Sterujesz drugą gęsią: WASD", W / 2, H / 2 + 40);
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

// --- pasek skilli: pixel-ikony + cooldown + klawisz ---
function kwaIcon(x, y) {
  // wrzeszcząca gęś: głowa, szeroko otwarty dziób, fale krzyku
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 8, y + 10, 16, 14);
  ctx.fillRect(x + 18, y + 4, 10, 10);
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(x + 26, y + 6, 6, 4);
  ctx.fillRect(x + 26, y + 13, 6, 4);
  ctx.fillStyle = "#000"; ctx.fillRect(x + 21, y + 6, 3, 3);
  ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 2, y + 8); ctx.lineTo(x - 1, y + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 2, y + 16); ctx.lineTo(x - 1, y + 18); ctx.stroke();
}
function trapIcon(x, y) {
  ctx.fillStyle = "#ffcc00"; ctx.fillRect(x + 4, y + 6, 24, 20);
  ctx.fillStyle = "#000";
  ctx.fillRect(x + 7, y + 10, 18, 3);
  ctx.fillRect(x + 7, y + 17, 18, 3);
}
function skillSlot(x, y, icon, frac, key, extra, secs, regen) {
  ctx.fillStyle = "#0d1117"; ctx.fillRect(x, y, 44, 44);
  icon(x + 6, y + 4);
  ctx.strokeStyle = frac > 0 ? "#484f58" : "#58a6ff"; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 43, 43);
  if (frac > 0) { ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(x, y, 44, Math.round(44 * Math.min(1, frac))); }
  if (secs != null && frac > 0) {
    ctx.fillStyle = "#fff"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
    ctx.fillText(secs, x + 22, y + 27);
  }
  if (regen != null && regen < 1) {
    ctx.fillStyle = "#238636";
    ctx.fillRect(x, y + 41, Math.round(44 * regen), 3);
  }
  ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.textAlign = "center";
  ctx.fillText(key, x + 22, y + 56);
  if (extra) {
    ctx.fillStyle = "#ffcc00"; ctx.font = "bold 11px monospace"; ctx.textAlign = "right";
    ctx.fillText(extra, x + 42, y + 12);
  }
}
function drawSkills() {
  const rows = mode === "solo" ? [P1()] : [P1(), P2()];
  const left = trapStock;
  rows.forEach((p, i) => {
    if (!p) return;
    const y = H - 70 - i * 62;
    const tag = mode === "net-guest" ? (p === P2() ? "TY" : "HOST") : (p === P2() ? "P2" : "P1");
    const k1 = (mode !== "solo" && p === P2() && mode !== "net-guest") ? "." : "SPACJA";
    const k2 = (mode !== "solo" && p === P2() && mode !== "net-guest") ? "," : "E";
    ctx.fillStyle = p.dead ? "#555" : "#fff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left";
    ctx.fillText(tag, 12, y + 14);
    const cd = (p.quackCd || 0);
    skillSlot(46, y, kwaIcon, cd / 2, k1, null, cd > 0 ? cd.toFixed(1) : null, null);
    skillSlot(102, y, trapIcon, left > 0 ? 0 : 1, k2, "x" + left, null, left >= TRAP_MAX ? 1 : trapRegen / TRAP_REGEN);
  });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  mascotT += dt;
  mascotPeck = Math.max(0, mascotPeck - dt);
  dollEnterT = Math.min(99, dollEnterT + dt);
  if (dollExit >= 0) {
    dollExit += dt;
    if (dollExit >= 0.65) {
      const p = pendingScreen;
      dollExit = -1; pendingScreen = null;
      if (p) doShow(p);
    }
  }
  if (state === "menu") {
    // gąską w menu sterujesz (WASD / strzałki / joystick)
    let mdx = ((keys["KeyA"] || keys["ArrowLeft"]) ? -1 : 0) + ((keys["KeyD"] || keys["ArrowRight"]) ? 1 : 0);
    let mdy = ((keys["KeyW"] || keys["ArrowUp"]) ? -1 : 0) + ((keys["KeyS"] || keys["ArrowDown"]) ? 1 : 0);
    if (mdx === 0 && mdy === 0 && (joy.dx || joy.dy)) { mdx = joy.dx * 1.4; mdy = joy.dy * 1.4; }
    mascotPos.x = Math.max(-40, Math.min(30, mascotPos.x + mdx * 140 * dt));
    mascotPos.y = Math.max(-60, Math.min(60, mascotPos.y + mdy * 140 * dt));
  }
  if (state === "gra") update(dt);
  else if (state === "lobby") updateLobby(dt);
  draw();
  if (state === "menu" && !overlay.classList.contains("hidden") && customTab !== undefined) {
    try {
      const customOn = !document.getElementById("scr-custom").hidden;
      if (!customOn) drawMascot(mascotT);
      else drawPaperdoll(mascotT);
    } catch (e) {}
  }
  requestAnimationFrame(loop);
}

// --- przyciski menu: guś dziobie przycisk, potem akcja ---
function uiClick(fn) {
  return (ev) => {
    startMusic();
    try { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); } catch (e) {}
    mascotPeck = 0.55;
    setTimeout(() => { try { beep(900, 0.05, "square"); } catch (e) {} }, 300);
    const btn = ev && ev.currentTarget;
    if (btn && btn.classList) {
      btn.classList.remove("pressed");
      void btn.offsetWidth;
      btn.classList.add("pressed");
      setTimeout(() => btn.classList.remove("pressed"), 400);
    }
    setTimeout(fn, 330);
  };
}
document.getElementById("btnSingle").addEventListener("click", uiClick(() => newGame("solo")));
document.getElementById("btnCoop").addEventListener("click", uiClick(() => newGame("coop")));
document.getElementById("btnMulti").addEventListener("click", uiClick(() => { showScreen("scr-multi"); netMsg(""); refreshRooms(); }));
document.getElementById("btnCustom").addEventListener("click", uiClick(() => { customBack = "scr-main"; showScreen("scr-custom"); }));
document.getElementById("btnStats").addEventListener("click", uiClick(() => {
  document.getElementById("statsBox").innerHTML = statsHTML();
  showScreen("scr-stats");
}));
document.getElementById("btnRefresh").addEventListener("click", () => refreshRooms());
document.getElementById("btnRoomPub").addEventListener("click", () => {
  const ws = ensureWs();
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: "create", name: playerName(), priv: false }));
});
document.getElementById("btnRoomPriv").addEventListener("click", () => {
  const ws = ensureWs();
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: "create", name: playerName(), priv: true }));
});
document.getElementById("btnJoin").addEventListener("click", () => {
  const el = document.getElementById("roomCode");
  const code = el && el.value ? el.value.trim().toUpperCase() : "";
  if (!code) { netMsg("Wpisz kod pokoju."); return; }
  joinRoom(code);
});
document.getElementById("btnLeave").addEventListener("click", () => { leaveRoom(); netMsg("Opuszczono pokój."); });
function startNetGame() {
  if (net.names.length < 2) { netMsg("Nikt nie dołączył — poczekaj na gościa."); enterLobby(); return; }
  mode = "net-host";
  players = [mkPlayer("Host", 80, "ShiftLeft"), mkPlayer("Gość", 150, "ShiftRight")];
  players[0].tag = (net.names[0] || "Host").slice(0, 12);
  players[1].tag = (net.names[1] || "Gość").slice(0, 12);
  players.forEach((p) => { p.look = myLook(); });
  level = 1; score = 0; levelBugs = 0; runBugs = 0;
  startTime = performance.now();
  elapsed = 0;
  netCountdown = 3.2;
  try { if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify({ t: "playing", on: true })); } catch (e) {}
  setupLevel();
  state = "gra";
  document.getElementById("hud").style.display = "flex";
  overlay.classList.add("hidden");
  overlay.classList.remove("transparent");
}
document.getElementById("btnNetStart2").addEventListener("click", () => toggleReady());
document.getElementById("btnLeave2").addEventListener("click", uiClick(() => { leaveRoom(); showMenu(); }));
let customBack = "scr-main";
function enterCustomBack() {
  showScreen(customBack);
  if (customBack === "scr-lobby") overlay.classList.add("transparent");
}
document.getElementById("btnLook").addEventListener("click", uiClick(() => { customBack = "scr-lobby"; overlay.classList.remove("transparent"); showScreen("scr-custom"); }));
document.getElementById("btnCustom").addEventListener("click", uiClick(() => { customBack = "scr-main"; showScreen("scr-custom"); }));
document.getElementById("btnSettings").addEventListener("click", uiClick(() => showScreen("scr-settings")));
document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", uiClick(() => { enterCustomBack(); })));
btnStart.addEventListener("click", uiClick(() => {
  if (state === "pauza") { togglePause(); return; }
  if (mode === "net-host" || mode === "net-guest") { leaveRoom(); showMenu(); return; }
  newGame(mode);
}));
document.getElementById("btnQuit").addEventListener("click", uiClick(() => { leaveRoom(); showMenu(); }));
// --- online: lobby + synchronizacja (host symuluje, gość ogląda i steruje) ---
const net = { ws: null, room: null, you: 0, names: [], readyNames: [], priv: false, guest: null, lastState: 0, lastInput: 0, lastScore: 0, buf: [], q: false, e: false };
function wsUrl() {
  try {
    if (typeof location !== "undefined" && location.protocol.indexOf("http") === 0)
      return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/";
  } catch (e) {}
  return null;
}
function netMsg(t) {
  const el = document.getElementById("roomMsg");
  if (el) el.textContent = t;
}
function ensureWs() {
  if (net.ws || typeof WebSocket === "undefined") {
    if (!net.ws) netMsg("Online działa tylko na https://just4.pl");
    return net.ws;
  }
  const url = wsUrl();
  if (!url) { netMsg("Online działa tylko na https://just4.pl"); return null; }
  try {
    net.ws = new WebSocket(url);
  } catch (e) { netMsg("Brak połączenia z serwerem."); net.ws = null; return null; }
  net.ws.onmessage = (ev) => {
    let m = null;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === "rooms") renderRooms(m.rooms || []);
    else if (m.t === "joined") {
      net.room = m.code; net.you = m.you; net.names = m.players || []; net.priv = !!m.priv;
      net.readyNames = [];
      updateRoomUI();
      enterLobby();
    }
    else if (m.t === "players") {
      net.names = m.players || [];
      updateRoomUI();
      if (state === "lobby" && net.names.length > 1 && !players[1]) {
        players[1] = mkPlayer("Gość", 500, "");
        players[1].hp = 100;
      }
      updateLobbyPanel();
    }
    else if (m.t === "readyState") {
      net.readyNames = m.ready || [];
      updateLobbyPanel();
      // host startuje sam, gdy oboje gotowi
      if (state === "lobby" && net.you === 1 && net.names.length > 1 &&
          net.names.every((n) => net.readyNames.indexOf(n) >= 0)) {
        setTimeout(() => { if (state === "lobby") startNetGame(); }, 600);
      }
    }
    else if (m.t === "begin") { netMsg("Gość " + (m.guest || "") + " dołączył! Kliknij Start online."); updateRoomUI(); }
    else if (m.t === "error") netMsg(m.msg || "Błąd.");
    else if (m.t === "left") {
      if (state === "lobby") {
        if (players.length > 1) players.length = 1;
        updateLobbyPanel();
      }
      else if (mode === "net-guest") { net.room = null; showMenu(); netMsg("Host opuścił pokój."); }
      else if (mode === "net-host") { net.guest = null; if (players.length > 1) players.length = 1; popup(400, 300, "Gość wyszedł", "#ffcc00"); }
      else { net.names = net.names.slice(0, 1); updateRoomUI(); }
    }
    else if (m.t === "over" && mode === "net-guest") {
      score = m.score || 0;
      state = m.win ? "wygrana" : "przegrana";
      showMsg(m.win ? "WYGRANA! Zemsta dokonana" : "PRZEGRANA",
        m.win ? "Uciekliście ze Zofiówki!" : "Złapano was w Zofiówce.",
        "Do menu", true);
      finishScreen(m.win, 0);
      if (m.win) sndWin(); else sndHurt();
    }
    else if (m.t === "state") {
      // pierwsza klatka wciąga gościa do gry (tryb ustawia applyState)
      if (mode === "net-guest" || state === "menu" || state === "lobby") applyState(m);
    }
    else if (m.t === "lobbypos" && state === "lobby") lobbyRecv(m);
    else if (m.t === "input" && mode === "net-host") {
      net.guest = { dx: m.dx || 0, dy: m.dy || 0, run: !!m.run };
      if (m.q && P2()) tryQuack(P2());
      if (m.e && P2()) tryTrap(P2());
    }
  };
  net.ws.onclose = () => { net.ws = null; if (state === "menu") netMsg("Rozłączono. Odśwież listę."); };
  return net.ws;
}
function playerName() {
  return (nick || "").trim().slice(0, 16) || "Gęś";
}
function renderRooms(rooms) {
  const box = document.getElementById("roomList");
  if (!box) return;
  if (!rooms.length) { box.innerHTML = "<p class='dim'>Brak publicznych pokoi — utwórz własny.</p>"; return; }
  box.innerHTML = "";
  rooms.forEach((r) => {
    const d = document.createElement("div");
    d.className = "room";
    const s = document.createElement("span");
    s.textContent = r.code + " (" + r.players + "/" + r.max + ")";
    const b = document.createElement("button");
    b.textContent = "Dołącz";
    b.addEventListener("click", () => joinRoom(r.code));
    d.appendChild(s); d.appendChild(b);
    box.appendChild(d);
  });
}
function refreshRooms() {
  const ws = ensureWs();
  if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ t: "list" })); } catch (e) {} return; }
  try {
    if (!document.getElementById("scr-multi").hidden) setTimeout(refreshRooms, 1500);
  } catch (e) {}
}
function joinRoom(code) {
  const ws = ensureWs();
  if (!ws) return;
  const send = () => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: "join", code, name: playerName() })); else setTimeout(send, 300); };
  send();
}
function updateRoomUI() {
  const inRoom = !!net.room;
  document.getElementById("btnLeave").hidden = !inRoom;
  const who = document.getElementById("roomWho");
  if (who) who.innerHTML = inRoom ? "<b>Pokój " + net.room + (net.priv ? " (prywatny)" : "") + ":</b> " + net.names.join(", ") : "";
  updateLobbyPanel();
}

// --- poczekalnia: bieganie przed startem (jak w Among Us) ---
const LOBBY_WALLS = [
  { x: 0, y: 0, w: 800, h: 16 },
  { x: 0, y: 584, w: 800, h: 16 },
  { x: 0, y: 0, w: 16, h: 600 },
  { x: 784, y: 0, w: 16, h: 600 },
  { x: 330, y: 240, w: 140, h: 20 },
  { x: 330, y: 360, w: 140, h: 20 },
];
let lastLobbySend = 0;
function myIdx() { return net.you === 2 ? 1 : 0; }
function enterLobby() {
  state = "lobby";
  mode = "lobby";
  document.getElementById("hud").style.display = "none";
  overlay.classList.remove("hidden");
  overlay.classList.add("transparent");
  players = [mkPlayer(playerName(), 300, "ShiftLeft")];
  players[0].tag = playerName();
  players[0].look = myLook();
  players[0].hp = 100;
  walls = LOBBY_WALLS;
  enemies = []; bugs = []; traps = []; parts = [];
  showScreen("scr-lobby");
  updateLobbyPanel();
}
function updateLobbyPanel() {
  const c = document.getElementById("lobbyCode");
  if (c) c.textContent = net.room ? net.room : "";
  const w = document.getElementById("lobbyWho");
  if (w) {
    w.innerHTML = net.names.length
      ? "W pokoju:<br><b>" + net.names.map((n) => (net.readyNames.indexOf(n) >= 0 ? "✓ " : "") + n).join("<br>") + "</b>"
      : "";
  }
  const st = document.getElementById("btnNetStart2");
  if (st) {
    const inRoom = !!net.room;
    const me = playerName();
    const amReady = net.readyNames.indexOf(me) >= 0;
    const both = net.names.length > 1 && net.names.every((n) => net.readyNames.indexOf(n) >= 0);
    st.hidden = !inRoom;
    st.textContent = both ? "Startujemy…" : (amReady ? "✓ Gotowy! (kliknij, by cofnąć)" : "GOTÓW");
    st.classList.toggle("armed2", amReady);
  }
}
function toggleReady() {
  if (!net.ws || net.ws.readyState !== 1 || !net.room) return;
  const me = playerName();
  const amReady = net.readyNames.indexOf(me) >= 0;
  try { net.ws.send(JSON.stringify({ t: "ready", on: !amReady })); } catch (e) {}
}
function lobbySend() {
  if (!net.ws || net.ws.readyState !== 1 || !net.room) return;
  const now = performance.now();
  if (now - lastLobbySend < 100) return;
  lastLobbySend = now;
  const me = players[myIdx()];
  if (!me) return;
  try {
    net.ws.send(JSON.stringify({ t: "lobbypos", i: myIdx(), x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, moving: me.moving, anim: Math.round(me.anim * 100) / 100, tag: me.tag, look: me.look }));
  } catch (e) {}
}
function lobbyRecv(m) {
  const i = m.i | 0;
  if (i < 0 || i > 1 || i === myIdx()) return;
  if (!players[i]) {
    players[i] = mkPlayer("Gość", 500, "");
    players[i].hp = 100;
  }
  const p = players[i];
  p.x = m.x; p.y = m.y; p.dir = m.dir || 1;
  p.moving = !!m.moving; p.anim = m.anim || 0;
  if (m.tag) p.tag = String(m.tag).slice(0, 12);
  if (m.look) p.look = m.look;
}
function updateLobby(dt) {
  const me = players[myIdx()];
  if (me && !me.dead) {
    let dx = ((keys["KeyA"] || keys["ArrowLeft"]) ? -1 : 0) + ((keys["KeyD"] || keys["ArrowRight"]) ? 1 : 0);
    let dy = ((keys["KeyW"] || keys["ArrowUp"]) ? -1 : 0) + ((keys["KeyS"] || keys["ArrowDown"]) ? 1 : 0);
    if (dx === 0 && dy === 0 && (joy.dx || joy.dy)) { dx = joy.dx; dy = joy.dy; }
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      if (len > 1) { dx /= len; dy /= len; }
      if (dx !== 0) me.dir = dx > 0 ? 1 : -1;
      me.moving = true; me.anim += dt * 11;
      const run = (keys["ShiftLeft"] || keys["ShiftRight"] || touchRun) ? 1.6 : 1.0;
      moveWithWalls(me, dx * 190 * run * dt, dy * 190 * run * dt);
    } else me.moving = false;
    me.look = myLook();
    me.tag = playerName();
  }
  lobbySend();
  updateParts(dt);
}
function drawLobby() {
  ctx.fillStyle = "#141a26";
  ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = "#10141d";
  for (let y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = "#3b4252";
  for (const wl of walls) ctx.fillRect(wl.x, wl.y, wl.w, wl.h);
  // stół na środku
  ctx.fillStyle = "#5a3c00";
  ctx.fillRect(350, 280, 100, 40);
  ctx.fillStyle = "#7a5200";
  ctx.fillRect(350, 280, 100, 8);
  for (const p of players) drawPlayer(p);
  for (const q of parts) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.col;
    ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#fff"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center";
  ctx.fillText("POCZEKALNIA " + (net.room || ""), W / 2, 70);
  ctx.font = "14px monospace"; ctx.fillStyle = "#8a93a0";
  ctx.fillText("Biegaj: WASD / strzałki • wygląd zmienisz przyciskiem", W / 2, 96);
}
function leaveRoom() {
  try {
    if (net.ws && net.ws.readyState === 1) {
      net.ws.send(JSON.stringify({ t: "playing", on: false }));
      net.ws.send(JSON.stringify({ t: "leave" }));
    }
  } catch (e) {}
  net.room = null; net.you = 0; net.names = []; net.readyNames = []; net.guest = null;
  updateRoomUI();
  refreshRooms();
}
function applyState(m) {
  mode = "net-guest";
  level = m.level || 1; score = m.score || 0; levelBugs = m.levelBugs || 0;
  net.lastScore = score;
  if (typeof m.stock === "number") trapStock = m.stock;
  elapsed = m.elapsed || 0;
  exitDoor = m.exitDoor || exitDoor;
  walls = m.walls || []; poisons = m.poisons || [];
  enemies = m.enemies || []; bugs = m.bugs || []; traps = m.traps || [];
  quackFx = m.quackFx || 0; shakeT = m.shakeT || 0;
  players = (m.players || []).map((s, i) => ({ name: i ? "Gość" : "Host", tag: s.tag || null, w: 22, h: 22, dir: s.dir || 1, moving: !!s.moving, anim: s.anim || 0, hurtCd: s.hurtCd || 0, chomp: s.chomp || 0, quackCd: 0, runKey: "", x: s.x, y: s.y, hp: s.hp, dead: !!s.dead }));
  if (typeof m.cd === "number") netCountdown = m.cd;
  net.buf.push({ t: performance.now(), enemies: (m.enemies || []).map((e) => ({ x: e.x, y: e.y })), players: (m.players || []).map((s) => ({ x: s.x, y: s.y })) });
  if (net.buf.length > 3) net.buf.shift();
  if (state !== "gra") {
    state = "gra";
    document.getElementById("hud").style.display = "flex";
    overlay.classList.add("hidden");
  }
  updateHUD();
}
function sendState() {
  if (!net.ws || net.ws.readyState !== 1 || !net.room) return;
  const now = performance.now();
  if (now - net.lastState < 50) return;
  net.lastState = now;
  net.ws.send(JSON.stringify({
    t: "state", level, score, levelBugs, elapsed, quackFx, shakeT, exitDoor, cd: mode === "net-host" ? netCountdown : 0, stock: trapStock,
    walls, poisons, enemies, bugs, traps,
    players: players.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), hp: Math.ceil(p.hp), dead: p.dead, dir: p.dir, tag: p.tag || null, moving: p.moving, anim: Math.round(p.anim * 100) / 100, hurtCd: Math.round((p.hurtCd || 0) * 100) / 100, chomp: Math.round((p.chomp || 0) * 100) / 100 }))
  }));
}
let netCountdown = 0;
function sendInput() {
  if (!net.ws || net.ws.readyState !== 1 || !net.room) return;
  const now = performance.now();
  if (now - net.lastInput < 50) return;
  net.lastInput = now;
  let dx = (keys["KeyA"] || keys["ArrowLeft"] ? -1 : 0) + (keys["KeyD"] || keys["ArrowRight"] ? 1 : 0);
  let dy = (keys["KeyW"] || keys["ArrowUp"] ? -1 : 0) + (keys["KeyS"] || keys["ArrowDown"] ? 1 : 0);
  if (dx === 0 && dy === 0 && (joy.dx || joy.dy)) { dx = joy.dx * sens; dy = joy.dy * sens; }
  net.ws.send(JSON.stringify({ t: "input", dx, dy, run: !!(keys["ShiftLeft"] || keys["ShiftRight"] || touchRun), q: net.q, e: net.e }));
  net.q = false; net.e = false;
}
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
function armWipe(id, fn) {
  const b = document.getElementById(id);
  if (!b) return;
  b.addEventListener("click", () => {
    if (!b.classList.contains("armed")) {
      b.classList.add("armed");
      b.textContent = "Na pewno? Kliknij jeszcze raz";
      setTimeout(() => { b.classList.remove("armed"); b.textContent = b.dataset.label || "Wyczyść"; }, 3000);
      return;
    }
    b.classList.remove("armed");
    b.textContent = b.dataset.label || "Wyczyść";
    fn();
  });
  b.dataset.label = b.textContent;
}
armWipe("btnWipe", () => {
  try { localStorage.removeItem(REC_KEY); } catch (e) {}
  recordsEl.innerHTML = rekordyHTML();
});
armWipe("btnWipe2", () => {
  try { localStorage.removeItem(REC_KEY); } catch (e) {}
  document.getElementById("statsBox").innerHTML = statsHTML();
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
// --- customizacja v2: zakładki + bloki z podglądem ---
let customTab = "duck";
function currentVal(tab) {
  if (tab === "duck") return bodyColor;
  if (tab === "scarf") return bandana;
  if (tab === "hat") return hat;
  if (tab === "glasses") return glasses;
  return shoes;
}
function setVal(tab, v) {
  if (tab === "duck" && BODIES[v]) bodyColor = v;
  else if (tab === "scarf" && BANDANAS.hasOwnProperty(v)) bandana = v;
  else if (tab === "hat" && HATS.indexOf(v) >= 0) hat = v;
  else if (tab === "glasses" && GLASSES.indexOf(v) >= 0) glasses = v;
  else if (tab === "shoes" && SHOES.hasOwnProperty(v)) shoes = v;
  else return;
  saveSettings();
  renderBlocks();
}
function miniDuck(g, pal) {
  g.fillStyle = "#161b22"; g.fillRect(0, 0, 44, 38);
  g.fillStyle = pal.base; g.fillRect(8, 16, 22, 14);
  g.fillRect(24, 6, 10, 12);
  g.fillStyle = "#ff8800"; g.fillRect(32, 10, 6, 4);
  g.fillStyle = pal.eye; g.fillRect(27, 8, 3, 3);
}
function miniNeck(g, col) {
  g.fillStyle = "#161b22"; g.fillRect(0, 0, 44, 38);
  g.fillStyle = "#ffffff"; g.fillRect(14, 4, 16, 22);
  if (col) {
    g.fillStyle = col; g.fillRect(12, 12, 20, 8);
    g.fillRect(24, 19, 6, 8);
  }
}
function miniShoe(g, st) {
  g.fillStyle = "#161b22"; g.fillRect(0, 0, 44, 38);
  g.fillStyle = "#fff"; g.fillRect(16, 2, 12, 16);
  g.fillStyle = "#ff8800"; g.fillRect(16, 18, 12, 8);
  if (st) {
    g.fillStyle = st.main; g.fillRect(14, 18, 16, 10);
    g.fillStyle = st.sole; g.fillRect(14, 27, 16, 3);
  }
}
function renderBlocks() {
  const box = document.getElementById("itemBlocks");
  if (!box || typeof document.createElement !== "function") return;
  box.innerHTML = "";
  const items = [];
  if (customTab === "duck") BODY_KEYS.forEach((k) => items.push([k, (g) => miniDuck(g, BODIES[k])]));
  else if (customTab === "scarf") {
    items.push(["none", null]);
    Object.keys(BANDANAS).forEach((k) => { if (k !== "none") items.push([k, (g) => miniNeck(g, BANDANAS[k])]); });
  }
  else if (customTab === "hat") HATS.forEach((h) => items.push([h, h === "none" ? null : ((g) => drawHat(g, 22, 30, 1.6, h))]));
  else SHOE_KEYS.forEach((k) => items.push([k, k === "none" ? null : ((g) => miniShoe(g, SHOES[k]))]));
  const cur = currentVal(customTab);
  items.forEach(([val, draw]) => {
    const b = document.createElement("button");
    b.className = "block" + (val === cur ? " sel" : "");
    b.dataset.val = val;
    if (draw) {
      const cv = document.createElement("canvas");
      cv.width = 44; cv.height = 38;
      const g = cv.getContext("2d");
      if (g) { g.imageSmoothingEnabled = false; draw(g); }
      b.appendChild(cv);
    } else b.textContent = "✕";
    b.addEventListener("click", () => setVal(customTab, val));
    box.appendChild(b);
  });
}
function setTab(t) {
  customTab = t;
  try {
    document.querySelectorAll("#itemTabs .tab").forEach((el) => el.classList.toggle("sel", el.dataset && el.dataset.tab === t));
  } catch (e) {}
  renderBlocks();
}
function buildPickers() {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;
  try {
    document.querySelectorAll("#itemTabs .tab").forEach((el) => {
      el.addEventListener("click", () => setTab(el.dataset.tab));
    });
  } catch (e) {}
  renderBlocks();
}
function syncPickers() { renderBlocks(); }
document.getElementById("nickInput").addEventListener("input", (e) => {
  nick = e.target.value.trim().slice(0, 12);
  saveSettings();
});
document.getElementById("btnRandom").addEventListener("click", () => {
  const cols = Object.keys(BANDANAS);
  bandana = cols[Math.floor(Math.random() * cols.length)];
  hat = HATS[Math.floor(Math.random() * HATS.length)];
  shoes = SHOE_KEYS[Math.floor(Math.random() * SHOE_KEYS.length)];
  bodyColor = BODY_KEYS[Math.floor(Math.random() * BODY_KEYS.length)];
  glasses = GLASSES[Math.floor(Math.random() * GLASSES.length)];
  syncPickers();
  syncSettingsUI();
  saveSettings();
  sndEat();
});
document.getElementById("btnClearLook").addEventListener("click", () => {
  bandana = "none"; hat = "none"; shoes = "none"; bodyColor = "white"; glasses = "none";
  syncPickers();
  syncSettingsUI();
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
  const bd = document.getElementById("bandana"); if (bd) bd.value = bandana;
  const hs = document.getElementById("hatSel"); if (hs) hs.value = hat;
  const ni = document.getElementById("nickInput"); if (ni && document.activeElement !== ni) ni.value = nick;
  syncPickers();
}

loadSettings();
buildPickers();
syncSettingsUI();
if (typeof window !== "undefined" && typeof WebSocket !== "undefined") {
  setInterval(() => {
    try {
      if (state === "menu" && !document.getElementById("scr-multi").hidden) refreshRooms();
    } catch (e) {}
  }, 4000);
}
setupTouch();
showMenu();
draw();
fitScale();
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", fitScale);
requestAnimationFrame(loop);

// --- skala planszy pod urządzenie: PC większa, telefon dopasowana ---
function fitScale() {
  try {
    if (!canvas.style || typeof document === "undefined" || !document.documentElement) return;
    const touch = document.body.classList.contains("touch");
    const vw = document.documentElement.clientWidth || 800;
    const vh = document.documentElement.clientHeight || 700;
    let s = Math.min((vw - 24) / 800, (vh - 250) / 600);
    if (touch) s = Math.min(Math.max(s, 0.4), 1);
    else s = Math.min(Math.max(s, 0.7), 1.5);
    const w = Math.round(800 * s), h = Math.round(600 * s);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const st = document.getElementById("stage");
    if (st && st.style) st.style.width = w + "px";
    const wr = document.getElementById("wrap");
    if (wr && wr.style) wr.style.width = (w + 40) + "px";
    const tc = document.getElementById("touch");
    if (tc && tc.style) tc.style.width = w + "px";
  } catch (e) {}
}
