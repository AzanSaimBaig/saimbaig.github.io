/* Ice Hockey - Drone View  (HTML5 port of the Java Swing game, Poki-ready) */
(function () {
'use strict';

// =====================================================
// BASIC SETUP
// =====================================================
const W = 1100, H = 700;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let dpr = 1, cw = 0, ch = 0, viewScale = 1, offX = 0, offY = 0;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  viewScale = Math.min(cw / W, ch / H);
  offX = (cw - W * viewScale) / 2;
  offY = (ch - H * viewScale) / 2;
}
window.addEventListener('resize', resize);
resize();

const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
let touchUI = coarse;       // show on-screen controls
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// colour helpers (Java Color(r,g,b,a) with a = 0..255)
function C(r, g, b, a) { return { r: r, g: g, b: b, a: a === undefined ? 255 : a }; }
function rgba(r, g, b, a) {
  if (a === undefined || a >= 255) return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a / 255).toFixed(3) + ')';
}
const css = c => rgba(c.r, c.g, c.b, c.a);
const WHITE = C(255, 255, 255);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// drawing helpers
function rr(x, y, w, h, arc) {
  const r = Math.min(arc / 2, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(x, y, w, h, arc) { rr(x, y, w, h, arc); ctx.fill(); }
function strokeRR(x, y, w, h, arc) { rr(x, y, w, h, arc); ctx.stroke(); }
function fillOval(x, y, w, h) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
function strokeOval(x, y, w, h) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

// =====================================================
// POKI SDK WRAPPER (works without the SDK too, for local testing)
// =====================================================
let adActive = false;
const Poki = {
  ready: false,
  has() { return typeof window.PokiSDK !== 'undefined'; },
  init(cb) {
    if (!Poki.has()) { Poki.ready = false; cb(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; Poki.ready = true; cb(); } };
    try { window.PokiSDK.init().then(go).catch(go); } catch (e) { go(); }
    setTimeout(go, 5000);
  },
  loadingStart() { try { if (Poki.has()) window.PokiSDK.gameLoadingStart(); } catch (e) {} },
  loadingFinished() { try { if (Poki.has()) window.PokiSDK.gameLoadingFinished(); } catch (e) {} },
  gameplayStart() { try { if (Poki.has()) window.PokiSDK.gameplayStart(); } catch (e) {} },
  gameplayStop() { try { if (Poki.has()) window.PokiSDK.gameplayStop(); } catch (e) {} },
  // Ad between matches. Always calls cb() when finished (or immediately if there is no ad).
  commercialBreak(cb) {
    if (!Poki.has() || !Poki.ready) { cb(); return; }
    setAdActive(true);
    const finish = () => { setAdActive(false); cb(); };
    try { Promise.resolve(window.PokiSDK.commercialBreak()).then(finish).catch(finish); }
    catch (e) { finish(); }
  },
  // Rewarded ad (user chooses to watch). cb(true) if the reward must be given.
  rewardedBreak(cb) {
    if (!Poki.has()) { cb(true); return; }   // local testing only
    setAdActive(true);
    try {
      Promise.resolve(window.PokiSDK.rewardedBreak())
        .then(ok => { setAdActive(false); cb(!!ok); })
        .catch(() => { setAdActive(false); cb(false); });
    } catch (e) { setAdActive(false); cb(false); }
  }
};
function setAdActive(v) { adActive = v; clearKeys(); applyMusic(); }

// =====================================================
// AUDIO
// =====================================================
let backgroundMusic = null, goalSfx = null, audioUnlocked = false;
try {
  backgroundMusic = new Audio('background.mp3');
  backgroundMusic.loop = true; backgroundMusic.volume = 0.5; backgroundMusic.preload = 'auto';
  goalSfx = new Audio('ballhit.mp3'); goalSfx.preload = 'auto';
} catch (e) {}

let musicOn = true, sfxOn = true;
function applyMusic() {
  if (!backgroundMusic) return;
  const shouldPlay = musicOn && audioUnlocked && !adActive && !document.hidden;
  try {
    if (shouldPlay) { const p = backgroundMusic.play(); if (p && p.catch) p.catch(() => {}); }
    else backgroundMusic.pause();
  } catch (e) {}
}
function playGoalSound() {
  if (!sfxOn || !goalSfx || adActive) return;
  try { goalSfx.currentTime = 0; const p = goalSfx.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true; applyMusic();
}
document.addEventListener('visibilitychange', applyMusic);

// =====================================================
// GAME STATE
// =====================================================
const MENU = 0, SETTINGS = 1, PLAYING = 2, RESULT = 3, LEVELSEL = 4;
const CAMPAIGN = 0, QUICK = 1, COOP = 2, VERSUS = 3;
let state = MENU, mode = CAMPAIGN;

// Ice rink
const rinkX = 80, rinkY = 70, rinkW = 940, rinkH = 560;

let bluePlayer = null, bluePlayer2 = null, puck = null;
let blueTeam = [], redTeam = [];

const RED_FORMATIONS = [
  [[740, 350], [900, 350], [620, 480], [860, 230]],
  [[800, 280], [800, 420], [650, 350], [900, 350]],
  [[700, 220], [700, 480], [880, 350], [600, 350]]
];
let redStart = RED_FORMATIONS[0];
let puckFriction = 0.985;
let goalHalf = 65;
const blueStartSolo = [[360, 350]];
const blueStartCoop = [[360, 280], [360, 420]];

// keys
let up = false, down = false, left = false, right = false, shoot = false;
let p2up = false, p2down = false, p2left = false, p2right = false, shoot2 = false;
// touch controls
let joyId = null, joyOX = 0, joyOY = 0, joyX = 0, joyY = 0, joyActive = false;
let shootBtnId = null, shootHeld = false;
const SHOOT_BTN = { x: 965, y: 560, r: 68 };

let blueScore = 0, redScore = 0;
let winGoals = 3, loseGoals = 5, enemySpeed = 3.5, enemyCount = 1;

const IDLE_LIMIT_FRAMES = Math.floor(10 * 1000 / 16);
const IDLE_SPEED = 0.15;
let puckIdleFrames = 0;
let lastTouchByRedAI = false;

const MAX_LEVEL = 50;
let level = 1, selectedLevel = 1, unlockedLevel = 1;

let menuIndex = 0, settingsIndex = 0, resultIndex = 0;
let extraEnemies = false, difficulty = 1;
const diffNames = ['EASY', 'NORMAL', 'HARD'];

let resultWin = false, resultTitle = '', resultPrompt = '';
let theme = 0, animTick = 0;
let toastText = '', toastUntil = 0;

// ---------- level system ----------
const LV = window.HDG_LEVELS || { max: 50, get: function (n) { return { name: 'Level ' + n, th: 0, e: 1, orig: 1 }; }, describe: function () { return []; }, isBoss: function () { return false; } };
const LVINFO = [];
function info(n) { return LVINFO[n] || (LVINFO[n] = LV.get(n)); }
let cfg = null;                       // current campaign level definition (null in other modes)
let obstacles = [], movers = [], zones = [], portals = [];
let pucks = [];
let powerups = [], pwTimer = 0;
const eff = { speed: 0, shot: 0, freeze: 0, biggoal: 0 };
const wind = { x: 0, y: 0 };
const streaks = [];
let timeLeft = 0, matchFrames = 0, introFrames = 0;
let particles = [];
let flashText = '', flashColor = '#fff', flashT = 0, puFlash = '', puFlashT = 0, puFlashCol = '#fff';
let starsBest = [], resultStars = 0, resultNewBest = false, levelCursor = 1;
const PU_TYPES = [
  { id: 'speed', col: '#ffd23c', ch: 'S', name: 'SPEED BOOST' },
  { id: 'shot', col: '#ff7a2f', ch: 'P', name: 'POWER SHOT' },
  { id: 'freeze', col: '#6fe3ff', ch: 'F', name: 'FREEZE ENEMIES!' },
  { id: 'biggoal', col: '#7dff8a', ch: 'G', name: 'BIG GOAL' }
];

// Themes: {top, bottom, accent, ice}
const THEMES = [
  [C(15, 20, 45), C(35, 45, 85), C(90, 160, 255), C(225, 245, 255)],
  [C(70, 25, 60), C(200, 90, 60), C(255, 190, 90), C(255, 240, 235)],
  [C(30, 10, 60), C(90, 20, 120), C(255, 80, 220), C(235, 230, 255)],
  [C(10, 40, 30), C(30, 90, 60), C(120, 255, 170), C(228, 250, 240)],
  [C(60, 10, 10), C(150, 40, 20), C(255, 120, 60), C(255, 238, 230)],
  [C(5, 40, 70), C(10, 110, 140), C(80, 230, 255), C(222, 248, 255)],
  [C(50, 40, 10), C(140, 110, 30), C(255, 220, 100), C(255, 248, 225)],
  [C(140, 170, 200), C(210, 230, 245), C(255, 255, 255), C(240, 252, 255)],
  [C(5, 5, 15), C(10, 40, 50), C(0, 255, 200), C(220, 255, 250)],
  [C(40, 10, 70), C(160, 110, 20), C(255, 215, 0), C(255, 250, 235)]
];

// crowd (cached)
const CROWD_N = 480;
const crowdX = [], crowdY = [], crowdAlpha = [], crowdBase = [];
(function initCrowd() {
  const r = mulberry32(20261009);
  const ni = n => Math.floor(r() * n);
  for (let i = 0; i < CROWD_N; i++) {
    const band = ni(4);
    if (band === 0) { crowdX.push(ni(W)); crowdY.push(ni(60)); }
    else if (band === 1) { crowdX.push(ni(W)); crowdY.push(640 + ni(55)); }
    else if (band === 2) { crowdX.push(ni(70)); crowdY.push(ni(H)); }
    else { crowdX.push(1030 + ni(65)); crowdY.push(ni(H)); }
    crowdAlpha.push(70 + ni(120));
    crowdBase.push([ni(256), ni(256), ni(256)]);
  }
})();
const crowdColorCache = {};
function crowdColors(themeIdx) {
  if (crowdColorCache[themeIdx]) return crowdColorCache[themeIdx];
  const t = THEMES[themeIdx], arr = [];
  for (let i = 0; i < CROWD_N; i++) {
    let r, g, b;
    if (i % 3 === 0) { r = t[2].r; g = t[2].g; b = t[2].b; }
    else {
      r = (t[2].r + crowdBase[i][0]) / 2; g = (t[2].g + crowdBase[i][1]) / 2; b = (t[2].b + crowdBase[i][2]) / 2;
    }
    arr.push(rgba(r, g, b, crowdAlpha[i]));
  }
  return (crowdColorCache[themeIdx] = arr);
}

// =====================================================
// SAVE / LOAD
// =====================================================
function loadProgress() {
  try {
    unlockedLevel = clamp(parseInt(localStorage.getItem('hdg_unlocked') || '1', 10) || 1, 1, MAX_LEVEL);
    const st = JSON.parse(localStorage.getItem('hdg_stars') || '[]');
    if (Array.isArray(st)) starsBest = st.map(v => clamp(v | 0, 0, 3));
    const s = JSON.parse(localStorage.getItem('hdg_settings') || 'null');
    if (s) {
      musicOn = s.musicOn !== false; sfxOn = s.sfxOn !== false;
      difficulty = clamp(s.difficulty | 0, 0, 2); extraEnemies = !!s.extraEnemies;
    }
  } catch (e) { unlockedLevel = 1; }
  selectedLevel = unlockedLevel;
}
function saveProgress() { try { localStorage.setItem('hdg_unlocked', String(unlockedLevel)); } catch (e) {} }
function saveStars() { try { localStorage.setItem('hdg_stars', JSON.stringify(starsBest)); } catch (e) {} }
function totalStars() { let t = 0; for (let i = 1; i <= MAX_LEVEL; i++) t += starsBest[i] || 0; return t; }
function saveSettings() {
  try { localStorage.setItem('hdg_settings', JSON.stringify({ musicOn, sfxOn, difficulty, extraEnemies })); } catch (e) {}
}

// =====================================================
// OBJECTS
// =====================================================
function Player(x, y, color, isMain, label) {
  this.x = x; this.y = y; this.sx = x; this.sy = y;
  this.color = color; this.isMain = isMain; this.label = label;
  this.red = false; this.big = false; this.boss = false; this.role = '';
  this.t = 0; this.warn = false; this.dash = false;
}
function playerR(p) { return p.big ? 28 : (p.isMain ? 17 : 15); }
function Puck(x, y) {
  this.x = x; this.y = y; this.vx = 0; this.vy = 0;
  this.lastRed = false; this.idle = 0; this.cd = 0; this.trail = [];
}

function createGame() {
  blueTeam = []; redTeam = []; bluePlayer2 = null;

  const bs = (mode === COOP) ? blueStartCoop : blueStartSolo;
  bluePlayer = new Player(bs[0][0], bs[0][1], C(30, 100, 220), true, '1');
  blueTeam.push(bluePlayer);
  if (mode === COOP) {
    bluePlayer2 = new Player(bs[1][0], bs[1][1], C(30, 190, 230), true, '2');
    blueTeam.push(bluePlayer2);
  }

  const count = Math.max(1, Math.min(enemyCount, redStart.length));
  const redLabel = (mode === VERSUS) ? '2' : '7';
  for (let i = 0; i < count; i++) {
    const p = new Player(redStart[i][0], redStart[i][1], C(210, 45, 55), false, redLabel);
    p.red = true;
    redTeam.push(p);
  }
  if (cfg && cfg.boss && redTeam.length) {          // boss = first red player, bigger + stronger
    const b = redTeam[0];
    b.big = true; b.boss = true; b.label = 'B'; b.color = C(150, 20, 45);
  }
  if (cfg && cfg.gk) {                              // red goalkeeper
    const g = new Player(rinkX + rinkW - 48, rinkY + rinkH / 2, C(150, 35, 45), false, 'G');
    g.red = true; g.role = 'goalie';
    redTeam.push(g);
  }

  // level objects
  obstacles = cfg ? cfg.obsList.map(o => Object.assign({}, o)) : [];
  movers = cfg ? cfg.movList.map(m => Object.assign({}, m, { t: 'c', x: m.x || 0, y: 0 })) : [];
  zones = cfg ? cfg.zonList.map(z => Object.assign({}, z)) : [];
  portals = cfg ? cfg.ptlList.map(p => p.slice()) : [];

  pucks = [];
  if (cfg && cfg.two) { pucks.push(new Puck(550, 262), new Puck(550, 438)); }
  else pucks.push(new Puck(550, 350));
  puck = pucks[0];

  powerups = []; pwTimer = 300;
  eff.speed = eff.shot = eff.freeze = eff.biggoal = 0;
  wind.x = wind.y = 0; streaks.length = 0;
  particles = []; flashT = 0; puFlashT = 0;
  matchFrames = 0;
  timeLeft = (cfg && cfg.timer) ? Math.round(cfg.timer * 1000 / 16) : 0;
  if (movers.length) moveMovers();
}

// =====================================================
// MATCH FLOW
// =====================================================
let gameplayOn = false;
function startGameplay() { if (!gameplayOn) { gameplayOn = true; Poki.gameplayStart(); } }
function stopGameplay() { if (gameplayOn) { gameplayOn = false; Poki.gameplayStop(); } }

function startMatch(m, lvl) {
  mode = m; level = lvl; cfg = null; introFrames = 0;
  blueScore = 0; redScore = 0; enemyCount = 1;
  redStart = RED_FORMATIONS[0]; puckFriction = 0.985; goalHalf = 65;

  if (m === CAMPAIGN) {
    cfg = info(level);
    if (cfg.orig) {
      // levels 1-3: the original rules
      winGoals = 3 + Math.floor((level - 1) / 10);
      loseGoals = Math.max(3, 6 - Math.floor((level - 1) / 12));
      enemySpeed = Math.min(2.2 + level * 0.055, 4.9) + (((level * 7) % 5) - 2) * 0.04;
      theme = (level - 1) % THEMES.length;
      enemyCount = 1 + (level - 1) % 3;
      redStart = RED_FORMATIONS[level % RED_FORMATIONS.length];
      puckFriction = 0.980 + ((level * 3) % 6) * 0.002;
      goalHalf = 65 - (level % 4) * 5;
    } else {
      // levels 4-50: every level has its own rules / mechanics
      winGoals = cfg.win || (3 + Math.floor((level - 1) / 15));
      loseGoals = cfg.lose || Math.max(5, 6 - Math.floor((level - 1) / 20));
      enemySpeed = Math.min(2.2 + level * 0.05, 4.1) + (((level * 7) % 5) - 2) * 0.04;
      theme = cfg.th;
      enemyCount = cfg.e;
      redStart = RED_FORMATIONS[cfg.form !== undefined ? cfg.form : level % RED_FORMATIONS.length];
      puckFriction = 0.980 + ((level * 3) % 6) * 0.002;
      goalHalf = 65 - (level % 4) * 5;
    }
    if (extraEnemies) enemyCount = Math.min(enemyCount + 1, RED_FORMATIONS[0].length);
    introFrames = 140;
  } else if (m === QUICK) {
    winGoals = 7; loseGoals = 4;
    enemySpeed = [4.5, 5.0, 5.5][difficulty];
    enemyCount = [2, 3, 4][difficulty];
    if (extraEnemies) enemyCount = Math.min(enemyCount + 1, RED_FORMATIONS[0].length);
    goalHalf = 58;
    redStart = RED_FORMATIONS[1];
    theme = Math.floor(Math.random() * THEMES.length);
  } else if (m === COOP) {
    winGoals = 7; loseGoals = 7;
    enemySpeed = [2.6, 3.5, 4.3][difficulty];
    enemyCount = extraEnemies ? 3 : 2;
    theme = Math.floor(Math.random() * THEMES.length);
  } else {
    winGoals = 5; loseGoals = 5;
    theme = Math.floor(Math.random() * THEMES.length);
  }

  puckIdleFrames = 0;
  createGame(); clearKeys();
  state = PLAYING;
  startGameplay();
}

// start a match, showing a Poki ad first (menu -> match, result -> next/retry)
function launch(m, lvl) {
  if (adActive) return;
  Poki.commercialBreak(() => startMatch(m, lvl));
}

function endMatch(blueWins, customTitle) {
  resultWin = blueWins; state = RESULT; resultIndex = 0;
  resultStars = 0; resultNewBest = false;
  clearKeys(); stopGameplay();

  if (mode === CAMPAIGN) {
    if (blueWins) {
      if (level < MAX_LEVEL && level + 1 > unlockedLevel) { unlockedLevel = level + 1; saveProgress(); }
      selectedLevel = Math.min(level + 1, MAX_LEVEL);
      resultStars = redScore === 0 ? 3 : (redScore <= Math.floor((loseGoals - 1) / 2) ? 2 : 1);
      if (resultStars > (starsBest[level] || 0)) { starsBest[level] = resultStars; resultNewBest = true; saveStars(); }
      if (level === MAX_LEVEL) {
        resultTitle = 'YOU ARE THE CHAMPION!';
        resultPrompt = 'ENTER = Menu     R = Replay';
      } else {
        resultTitle = 'LEVEL ' + level + ' COMPLETE!';
        resultPrompt = 'ENTER = Next Level     R = Replay     ESC = Menu';
      }
    } else {
      selectedLevel = level;
      resultTitle = customTitle || ('LEVEL ' + level + ' FAILED');
      resultPrompt = 'ENTER / R = Retry' + (level < MAX_LEVEL ? '     S = Skip (watch ad)' : '') + '     ESC = Menu';
    }
  } else if (mode === QUICK) {
    resultTitle = blueWins ? 'YOU WIN!' : 'COMPUTER WINS!';
    resultPrompt = 'ENTER / R = Rematch     ESC = Menu';
  } else if (mode === COOP) {
    resultTitle = blueWins ? 'TEAM BLUE WINS!' : 'COMPUTER WINS!';
    resultPrompt = 'ENTER / R = Rematch     ESC = Menu';
  } else {
    resultTitle = blueWins ? 'PLAYER 1 (BLUE) WINS!' : 'PLAYER 2 (RED) WINS!';
    resultPrompt = 'ENTER / R = Rematch     ESC = Menu';
  }
}

function goToMenu() { stopGameplay(); state = MENU; clearKeys(); }

function clearKeys() {
  up = down = left = right = shoot = false;
  p2up = p2down = p2left = p2right = shoot2 = false;
  joyId = null; joyActive = false; joyX = joyY = 0; shootBtnId = null; shootHeld = false;
}

function twoHumans() { return mode === COOP || mode === VERSUS; }
function player2Object() {
  if (mode === COOP) return bluePlayer2;
  if (mode === VERSUS && redTeam.length) return redTeam[0];
  return null;
}

function showToast(t) { toastText = t; toastUntil = performance.now() + 2500; }

// rewarded ad -> skip failed level
function skipLevel() {
  if (adActive || state !== RESULT || mode !== CAMPAIGN || resultWin || level >= MAX_LEVEL) return;
  Poki.rewardedBreak(ok => {
    if (ok) {
      if (level + 1 > unlockedLevel) { unlockedLevel = level + 1; saveProgress(); }
      selectedLevel = level + 1;
      startMatch(CAMPAIGN, level + 1);
    } else {
      showToast('Ad not available right now. Try again later!');
    }
  });
}

// =====================================================
// GAME LOOP
// =====================================================
function nearestPuck(p) {
  let best = pucks[0], bd = 1e12;
  for (let i = 0; i < pucks.length; i++) {
    const dx = pucks[i].x - p.x, dy = pucks[i].y - p.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = pucks[i]; }
  }
  return best;
}

function goalHalfFor(left) { return left ? goalHalf : goalHalf + (eff.biggoal > 0 ? 40 : 0); }
function inGoalMouth(y, left) {
  const cy = rinkY + rinkH / 2, h = goalHalfFor(left);
  return y > cy - h && y < cy + h;
}

function tick() {
  animTick++;
  if (state === PLAYING && !adActive) updateGame();
  if (particles.length) updateParticles();
  if (flashT > 0) flashT--;
  if (puFlashT > 0) puFlashT--;
}

// ---------- particles / effects ----------
function burst(x, y, col, n) {
  if (particles.length > 320) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, sp = 1.5 + Math.random() * 4.5;
    particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 30 + Math.random() * 35, max: 65, col: col, sz: 3 + Math.random() * 3 });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.x += q.vx; q.y += q.vy; q.vy += 0.07; q.life--;
    if (q.life <= 0) particles.splice(i, 1);
  }
}
function celebrate(blue) {
  const cols = blue ? ['#ffd700', '#ffffff', '#4aa3ff', '#ff6b6b', '#7dff8a'] : ['#ff4d4d', '#ff9a9a', '#8a1c1c'];
  const gx = blue ? rinkX + rinkW + 6 : rinkX - 6, gy = rinkY + rinkH / 2;
  const n = blue ? 5 : 2;
  for (let i = 0; i < n; i++) burst(gx, gy, cols[i % cols.length], blue ? 10 : 8);
  flashText = blue ? 'GOAL!' : 'RED SCORES!';
  flashColor = blue ? '#ffd700' : '#ff5a5a';
  flashT = 70;
}
function updateStreaks() {
  if (!streaks.length) {
    for (let i = 0; i < 28; i++) streaks.push({ x: rinkX + Math.random() * rinkW, y: rinkY + Math.random() * rinkH });
  }
  for (let i = 0; i < streaks.length; i++) {
    const q = streaks[i];
    q.x += wind.x * 150; q.y += wind.y * 150;
    if (q.x < rinkX) q.x += rinkW; if (q.x > rinkX + rinkW) q.x -= rinkW;
    if (q.y < rinkY) q.y += rinkH; if (q.y > rinkY + rinkH) q.y -= rinkH;
  }
}

// ---------- level objects ----------
function moveMovers() {
  for (let i = 0; i < movers.length; i++) {
    const m = movers[i];
    if (m.k === 'v') { m.y = m.cy + m.a * Math.sin(matchFrames * m.sp + m.ph); }
    else {
      const a = matchFrames * m.sp + m.ph;
      m.x = m.cx + m.rad * Math.cos(a); m.y = m.cy + m.rad * Math.sin(a);
    }
  }
}

// circle / rectangle obstacle vs. a circle (x, y, rad). Returns [nx, ny, newX, newY] or null.
function collide(o, x, y, rad) {
  if (o.t === 'c') {
    const dx = x - o.x, dy = y - o.y, min = o.r + rad;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d >= min) return null;
    let nx = 1, ny = 0;
    if (d > 0.001) { nx = dx / d; ny = dy / d; }
    return [nx, ny, o.x + nx * min, o.y + ny * min];
  }
  const cx = clamp(x, o.x, o.x + o.w), cy = clamp(y, o.y, o.y + o.h);
  const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
  if (d >= rad) return null;
  if (d > 0.001) { const nx = dx / d, ny = dy / d; return [nx, ny, cx + nx * rad, cy + ny * rad]; }
  const l = x - o.x, rg = o.x + o.w - x, t = y - o.y, b = o.y + o.h - y, m = Math.min(l, rg, t, b);
  if (m === l) return [-1, 0, o.x - rad, y];
  if (m === rg) return [1, 0, o.x + o.w + rad, y];
  if (m === t) return [0, -1, x, o.y - rad];
  return [0, 1, x, o.y + o.h + rad];
}
function bounce(pk, h) {
  if (!h) return;
  pk.x = h[2]; pk.y = h[3];
  const dot = pk.vx * h[0] + pk.vy * h[1];
  if (dot < 0) { pk.vx -= 1.9 * dot * h[0]; pk.vy -= 1.9 * dot * h[1]; }
}
function playersVsObstacles(list) {
  if (!obstacles.length && !movers.length) return;
  for (let i = 0; i < list.length; i++) {
    const p = list[i], rad = playerR(p);
    for (let k = 0; k < obstacles.length; k++) { const h = collide(obstacles[k], p.x, p.y, rad); if (h) { p.x = h[2]; p.y = h[3]; } }
    for (let k = 0; k < movers.length; k++) { const h = collide(movers[k], p.x, p.y, rad); if (h) { p.x = h[2]; p.y = h[3]; } }
    p.x = clamp(p.x, rinkX + 35, rinkX + rinkW - 35);
    p.y = clamp(p.y, rinkY + 35, rinkY + rinkH - 35);
  }
}
function zoneAt(x, y) {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
  }
  return null;
}
function zoneSpeed(p) {
  if (!zones.length) return 1;
  const z = zoneAt(p.x, p.y);
  return !z ? 1 : (z.k === 'mud' ? 0.55 : 1.3);
}

// ---------- power-ups ----------
function spawnPowerup() {
  for (let tries = 0; tries < 25; tries++) {
    const x = 240 + Math.random() * 620, y = 140 + Math.random() * 420;
    let ok = true;
    for (let i = 0; i < obstacles.length && ok; i++) if (collide(obstacles[i], x, y, 40)) ok = false;
    for (let i = 0; i < movers.length && ok; i++) if (collide(movers[i], x, y, 50)) ok = false;
    for (let i = 0; i < portals.length && ok; i++) {
      const pr = portals[i];
      if (Math.hypot(x - pr[0], y - pr[1]) < 70 || Math.hypot(x - pr[2], y - pr[3]) < 70) ok = false;
    }
    for (let i = 0; i < powerups.length && ok; i++) if (Math.hypot(x - powerups[i].x, y - powerups[i].y) < 80) ok = false;
    if (!ok) continue;
    powerups.push({ x: x, y: y, type: PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)], life: 720 });
    return;
  }
}
function updatePowerups() {
  pwTimer--;
  if (pwTimer <= 0) {
    if (powerups.length < 2) spawnPowerup();
    pwTimer = 420 + Math.floor(Math.random() * 240);
  }
  for (let i = powerups.length - 1; i >= 0; i--) {
    const u = powerups[i];
    u.life--;
    if (u.life <= 0) { powerups.splice(i, 1); continue; }
    for (let k = 0; k < blueTeam.length; k++) {
      const b = blueTeam[k];
      if (Math.hypot(b.x - u.x, b.y - u.y) < playerR(b) + 16) { collectPowerup(u); powerups.splice(i, 1); break; }
    }
  }
}
function collectPowerup(u) {
  const t = u.type;
  if (t.id === 'speed') eff.speed = 420;
  else if (t.id === 'shot') eff.shot = 480;
  else if (t.id === 'freeze') eff.freeze = 210;
  else eff.biggoal = 540;
  puFlash = t.name; puFlashCol = t.col; puFlashT = 80;
  burst(u.x, u.y, t.col, 18);
}

// ---------- main update ----------
function updateGame() {
  if (introFrames > 0) { introFrames--; return; }
  matchFrames++;

  if (cfg) {
    if (cfg.timer) {
      timeLeft--;
      if (timeLeft <= 0) { endMatch(false, 'TIME UP!'); return; }
    }
    if (cfg.wind) {
      wind.x = (cfg.wind.x || 0) * Math.sin(matchFrames * 0.012);
      wind.y = (cfg.wind.y || 0) * Math.cos(matchFrames * 0.012);
      updateStreaks();
    }
    if (movers.length) moveMovers();
    if (cfg.pw) updatePowerups();
  }
  if (eff.speed > 0) eff.speed--;
  if (eff.shot > 0) eff.shot--;
  if (eff.freeze > 0) eff.freeze--;
  if (eff.biggoal > 0) eff.biggoal--;

  const speed = 4.5 * (eff.speed > 0 ? 1.45 : 1);

  // Player 1: touch joystick overrides keys
  let p1dx, p1dy;
  if (joyActive) { p1dx = joyX; p1dy = joyY; }
  else { p1dx = (right ? 1 : 0) - (left ? 1 : 0); p1dy = (down ? 1 : 0) - (up ? 1 : 0); }
  const p1len = Math.sqrt(p1dx * p1dx + p1dy * p1dy);
  if (p1len > 0) {
    const sp = speed * zoneSpeed(bluePlayer);
    bluePlayer.x += p1dx / p1len * sp;
    bluePlayer.y += p1dy / p1len * sp;
  }
  bluePlayer.x = clamp(bluePlayer.x, rinkX + 35, rinkX + rinkW - 35);
  bluePlayer.y = clamp(bluePlayer.y, rinkY + 35, rinkY + rinkH - 35);

  if (shootHeld) shoot = true;
  if (shoot) { shootPuck(bluePlayer); shoot = false; }

  // Player 2 (CO-OP: blue2, VERSUS: red)
  const p2 = player2Object();
  if (p2) {
    const p2dx = (p2right ? 1 : 0) - (p2left ? 1 : 0);
    const p2dy = (p2down ? 1 : 0) - (p2up ? 1 : 0);
    const p2len = Math.sqrt(p2dx * p2dx + p2dy * p2dy);
    if (p2len > 0) { const sp2 = speed * zoneSpeed(p2); p2.x += p2dx / p2len * sp2; p2.y += p2dy / p2len * sp2; }
    p2.x = clamp(p2.x, rinkX + 35, rinkX + rinkW - 35);
    p2.y = clamp(p2.y, rinkY + 35, rinkY + rinkH - 35);
    if (shoot2) { shootPuck(p2); shoot2 = false; }
  }

  for (let i = 0; i < pucks.length; i++) stepPuck(pucks[i]);

  if (mode !== VERSUS) updateRedTeam();

  separate(blueTeam); separate(redTeam);
  playersVsObstacles(blueTeam); playersVsObstacles(redTeam);
  bossPush();
  checkPlayerCollisions();

  // Puck idle handling
  if (mode === COOP) {
    const pk = pucks[0];
    const puckSpeed = Math.sqrt(pk.vx * pk.vx + pk.vy * pk.vy);
    if (puckSpeed < IDLE_SPEED) puckIdleFrames++; else puckIdleFrames = 0;
    if (puckIdleFrames >= IDLE_LIMIT_FRAMES) {
      puckIdleFrames = 0;
      startMatch(mode, level);
      return;
    }
  } else if (cfg) {
    for (let i = 0; i < pucks.length; i++) {
      const pk = pucks[i];
      if (Math.sqrt(pk.vx * pk.vx + pk.vy * pk.vy) < IDLE_SPEED) pk.idle++; else pk.idle = 0;
      if (pk.idle > 600) respawnPuck(pk);        // stuck puck safety
    }
  }

  checkGoal();
}

function stepPuck(pk) {
  if (wind.x || wind.y) { pk.vx += wind.x; pk.vy += wind.y; }
  if (zones.length) {
    const z = zoneAt(pk.x, pk.y);
    if (z) {
      if (z.k === 'mud') { pk.vx *= 0.95; pk.vy *= 0.95; }
      else { pk.vx += z.dx * 0.3; pk.vy += z.dy * 0.3; }
    }
  }
  pk.x += pk.vx; pk.y += pk.vy;
  pk.vx *= puckFriction; pk.vy *= puckFriction;
  const sp = Math.sqrt(pk.vx * pk.vx + pk.vy * pk.vy);
  if (sp > 22) { pk.vx *= 22 / sp; pk.vy *= 22 / sp; }

  if (pk.y < rinkY + 15) { pk.y = rinkY + 15; pk.vy *= -0.8; }
  if (pk.y > rinkY + rinkH - 15) { pk.y = rinkY + rinkH - 15; pk.vy *= -0.8; }

  if (pk.x < rinkX + 15) {
    if (!inGoalMouth(pk.y, true)) { pk.x = rinkX + 15; pk.vx *= -0.8; }
  }
  if (pk.x > rinkX + rinkW - 15) {
    if (!inGoalMouth(pk.y, false)) { pk.x = rinkX + rinkW - 15; pk.vx *= -0.8; }
  }

  for (let i = 0; i < obstacles.length; i++) bounce(pk, collide(obstacles[i], pk.x, pk.y, 15));
  for (let i = 0; i < movers.length; i++) bounce(pk, collide(movers[i], pk.x, pk.y, 15));

  if (portals.length) {
    if (pk.cd > 0) pk.cd--;
    else {
      for (let i = 0; i < portals.length && pk.cd === 0; i++) {
        const pr = portals[i];
        for (let e = 0; e < 2; e++) {
          const ax = e ? pr[2] : pr[0], ay = e ? pr[3] : pr[1], bx = e ? pr[0] : pr[2], by = e ? pr[1] : pr[3];
          if (Math.hypot(pk.x - ax, pk.y - ay) < 24) {
            let s2 = Math.sqrt(pk.vx * pk.vx + pk.vy * pk.vy);
            if (s2 < 4) {                                   // make sure the puck leaves the portal
              if (s2 < 0.01) { pk.vx = 4; pk.vy = 0; } else { pk.vx *= 4 / s2; pk.vy *= 4 / s2; }
              s2 = 4;
            }
            pk.x = clamp(bx + pk.vx / s2 * 36, rinkX + 20, rinkX + rinkW - 20);
            pk.y = clamp(by + pk.vy / s2 * 36, rinkY + 20, rinkY + rinkH - 20);
            pk.cd = 40;
            burst(ax, ay, '#c58bff', 8); burst(pk.x, pk.y, '#7ae8ff', 8);
            break;
          }
        }
      }
    }
  }

  pk.trail.push(pk.x, pk.y);
  if (pk.trail.length > 16) pk.trail.splice(0, 2);
}

function shootPuck(shooter) {
  const power = (!shooter.red && eff.shot > 0) ? 18 : 12;
  for (let i = 0; i < pucks.length; i++) {
    const pk = pucks[i];
    const dx = pk.x - shooter.x, dy = pk.y - shooter.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 80) {
      if (distance === 0) distance = 1;
      pk.lastRed = (mode !== VERSUS && shooter.red);
      pk.vx = (dx / distance) * power;
      pk.vy = (dy / distance) * power;
    }
  }
}

// red AI: if a wall block is in the way, steer around its nearest free corner
function steerTarget(p, tx, ty) {
  const dx = tx - p.x, dy = ty - p.y, dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 40) return null;
  const m = playerR(p) + 4, steps = Math.ceil(dist / 20);
  let blocker = null;
  for (let i = 1; i <= steps && !blocker; i++) {
    const x = p.x + dx * i / steps, y = p.y + dy * i / steps;
    for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k];
      if (o.t === 'r' && x > o.x - m && x < o.x + o.w + m && y > o.y - m && y < o.y + o.h + m) { blocker = o; break; }
    }
  }
  if (!blocker) return null;
  const o = blocker, mm = m + 8;
  const cs = [[o.x - mm, o.y - mm], [o.x + o.w + mm, o.y - mm], [o.x - mm, o.y + o.h + mm], [o.x + o.w + mm, o.y + o.h + mm]];
  let best = null, bl = 1e9;
  for (let k = 0; k < cs.length; k++) {
    const c = cs[k];
    if (c[0] < rinkX + 36 || c[0] > rinkX + rinkW - 36 || c[1] < rinkY + 36 || c[1] > rinkY + rinkH - 36) continue;
    let bad = false;
    for (let q = 0; q < obstacles.length; q++) {
      const w = obstacles[q];
      if (w !== o && w.t === 'r' && c[0] > w.x - m && c[0] < w.x + w.w + m && c[1] > w.y - m && c[1] < w.y + w.h + m) bad = true;
    }
    if (bad) continue;
    const l = Math.hypot(c[0] - p.x, c[1] - p.y) + Math.hypot(tx - c[0], ty - c[1]);
    if (l < bl) { bl = l; best = c; }
  }
  return best;
}

function moveToward(p, tx, ty, spd) {
  if (p.red && eff.freeze > 0 && mode !== VERSUS) return;       // frozen by power-up
  if (p.red && obstacles.length && p.role !== 'goalie') {
    const wp = steerTarget(p, tx, ty);
    if (wp) { tx = wp[0]; ty = wp[1]; }
  }
  if (zones.length) spd *= zoneSpeed(p);
  const dx = tx - p.x, dy = ty - p.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > 2) { p.x += (dx / distance) * spd; p.y += (dy / distance) * spd; }
  p.x = clamp(p.x, rinkX + 35, rinkX + rinkW - 35);
  p.y = clamp(p.y, rinkY + 35, rinkY + rinkH - 35);
}

function separate(team) {
  for (let a = 0; a < team.length; a++) {
    for (let b = a + 1; b < team.length; b++) {
      const p1 = team[a], p2 = team[b];
      let dx = p2.x - p1.x, dy = p2.y - p1.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 34) {
        if (d === 0) { dx = 1; dy = 0; d = 1; }
        const push = (34 - d) / 2;
        p1.x -= dx / d * push; p1.y -= dy / d * push;
        p2.x += dx / d * push; p2.y += dy / d * push;
        p1.x = clamp(p1.x, rinkX + 35, rinkX + rinkW - 35);
        p1.y = clamp(p1.y, rinkY + 35, rinkY + rinkH - 35);
        p2.x = clamp(p2.x, rinkX + 35, rinkX + rinkW - 35);
        p2.y = clamp(p2.y, rinkY + 35, rinkY + rinkH - 35);
      }
    }
  }
}

function bossPush() {
  for (let i = 0; i < redTeam.length; i++) {
    const e = redTeam[i];
    if (!e.big) continue;
    for (let k = 0; k < blueTeam.length; k++) {
      const b = blueTeam[k], dx = b.x - e.x, dy = b.y - e.y, d = Math.sqrt(dx * dx + dy * dy), min = 28 + 17;
      if (d < min) {
        const n = d || 1;
        b.x = clamp(e.x + dx / n * min, rinkX + 35, rinkX + rinkW - 35);
        b.y = clamp(e.y + dy / n * min, rinkY + 35, rinkY + rinkH - 35);
      }
    }
  }
}

function bossAI(e) {
  e.t++;
  const cyc = 440, ph = e.t % cyc;
  const canDash = !!(cfg && cfg.boss && cfg.boss.dash);
  e.warn = canDash && ph >= cyc - 75 && ph < cyc - 30;
  e.dash = canDash && ph >= cyc - 24;
  if (e.warn) return;                                   // telegraph: boss stops and flashes
  if (e.dash) { moveToward(e, puck.x, puck.y, enemySpeed * 2.0); return; }
  clearPuck(e, enemySpeed * ((cfg && cfg.boss && cfg.boss.speed) || 0.8));
}

function updateRedTeam() {
  const keep = puck;
  const field = [];
  let goalie = null;
  for (let i = 0; i < redTeam.length; i++) {
    if (redTeam[i].role === 'goalie') goalie = redTeam[i]; else field.push(redTeam[i]);
  }
  for (let i = 0; i < field.length; i++) {
    const enemy = field[i];
    puck = nearestPuck(enemy);
    if (enemy.boss) { bossAI(enemy); continue; }
    if (i === 0) {                         // ATTACKER
      clearPuck(enemy, enemySpeed);
    } else if (i === 1) {                  // DEFENDER
      let targetX, targetY;
      if (cfg && !cfg.orig) {              // levels 4-50: hold the line in front of the goal, clear only when the puck is close
        if (puck.x > enemy.x + 12) clearPuck(enemy, enemySpeed * 0.95);                       // puck got behind us: go get it
        else moveToward(enemy, rinkX + rinkW - 110, clamp(puck.y, 250, 450), enemySpeed * 1.05);  // otherwise just block the lane
        continue;
      }
      if (puck.x > rinkX + rinkW * 0.65) { clearPuck(enemy, enemySpeed * 0.9); continue; }
      targetX = rinkX + rinkW - 110;
      targetY = clamp(puck.y, 260, 440);
      moveToward(enemy, targetX, targetY, enemySpeed * 0.9);
    } else if (i === 2) {                  // INTERCEPTOR
      if (puck.x > rinkX + rinkW * 0.7) { clearPuck(enemy, enemySpeed * 0.85); continue; }
      const targetX = clamp(puck.x + 120, rinkX + 300, rinkX + rinkW - 200);
      const targetY = rinkY + rinkH - (puck.y - rinkY);
      moveToward(enemy, targetX, targetY, enemySpeed * 0.85);
    } else {                               // WINGER
      if (puck.x > rinkX + rinkW * 0.7) { clearPuck(enemy, enemySpeed * 0.8); continue; }
      const targetX = clamp(puck.x + 60, rinkX + 200, rinkX + rinkW - 120);
      const targetY = clamp(puck.y + 90, rinkY + 60, rinkY + rinkH - 60);
      moveToward(enemy, targetX, targetY, enemySpeed * 0.8);
    }
  }
  if (goalie) {
    puck = nearestPuck(goalie);
    const cy = rinkY + rinkH / 2, gh = goalHalfFor(false);
    const ty = clamp(puck.y, cy - gh + 14, cy + gh - 14);
    moveToward(goalie, goalie.sx, ty, enemySpeed * 0.85 + 0.6);
  }
  puck = keep;
}

function clearPuck(enemy, spd) {
  const goalX = rinkX - 10, goalY = rinkY + rinkH / 2;
  let ux = puck.x - goalX, uy = puck.y - goalY;
  let len = Math.sqrt(ux * ux + uy * uy);
  if (len === 0) len = 1;
  ux /= len; uy /= len;

  const ex = enemy.x - puck.x, ey = enemy.y - puck.y;
  const dot = ex * ux + ey * uy;
  const cross = ex * uy - ey * ux;
  let targetX, targetY;

  if (dot > 0 && Math.abs(cross) < 25) {
    targetX = puck.x; targetY = puck.y;
  } else if (dot <= 0 && Math.sqrt(ex * ex + ey * ey) < 70) {
    const side = cross >= 0 ? 1 : -1;
    targetX = enemy.x + uy * side * 100 + ux * -20;
    targetY = enemy.y - ux * side * 100 + uy * -20;
  } else {
    targetX = puck.x + ux * 55;
    targetY = puck.y + uy * 55;
  }
  moveToward(enemy, targetX, targetY, spd);
}

function checkPlayerCollisions() {
  const all = blueTeam.concat(redTeam);
  const puckRadius = 15;
  for (let n = 0; n < pucks.length; n++) {
    const pk = pucks[n];
    for (let k = 0; k < all.length; k++) {
      const player = all[k];
      const minDist = playerR(player) + puckRadius;
      let dx = pk.x - player.x, dy = pk.y - player.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDist) {
        if (distance === 0) { dx = 1; dy = 0; distance = 1; }
        const nx = dx / distance, ny = dy / distance;
        pk.x = player.x + nx * minDist;
        pk.y = player.y + ny * minDist;
        const dot = pk.vx * nx + pk.vy * ny;
        if (dot < 0) { pk.vx -= 1.8 * dot * nx; pk.vy -= 1.8 * dot * ny; }
        pk.vx += nx * 0.5; pk.vy += ny * 0.5;
        if (player.dash) { pk.vx += nx * 1.5; pk.vy += ny * 1.5; }
        pk.lastRed = (mode !== VERSUS && player.red);
      }
    }
  }
}

function checkGoal() {
  for (let i = pucks.length - 1; i >= 0; i--) {
    const pk = pucks[i];
    if (pk.x < rinkX - 5 && inGoalMouth(pk.y, true)) {             // BLUE GOAL (red scores)
      redScore++;
      playGoalSound(); celebrate(false);
      if (redScore >= loseGoals) { endMatch(false); return; }
      afterGoal(pk);
    } else if (pk.x > rinkX + rinkW + 5 && inGoalMouth(pk.y, false)) {   // RED GOAL (blue scores)
      if (pk.lastRed) {                                            // no own goals for the computer
        pk.x = rinkX + rinkW - 45;
        pk.vx = -Math.max(Math.abs(pk.vx), 6);
        continue;
      }
      blueScore++;
      playGoalSound(); celebrate(true);
      if (blueScore >= winGoals) { endMatch(true); return; }
      afterGoal(pk);
    }
  }
}

function afterGoal(pk) {
  if (pucks.length === 1) resetPuck(); else respawnPuck(pk);
}

function respawnPuck(pk) {
  const spots = [[550, 262], [550, 438], [550, 350]];
  let best = spots[0], bd = -1;
  for (let i = 0; i < spots.length; i++) {
    let md = 1e9;
    for (let k = 0; k < pucks.length; k++) if (pucks[k] !== pk) md = Math.min(md, Math.hypot(pucks[k].x - spots[i][0], pucks[k].y - spots[i][1]));
    md += Math.random() * 60;
    if (md > bd) { bd = md; best = spots[i]; }
  }
  pk.x = best[0]; pk.y = best[1]; pk.vx = 0; pk.vy = 0;
  pk.idle = 0; pk.lastRed = false; pk.cd = 0; pk.trail = [];
}

function resetPuck() {
  const pk = pucks[0];
  pk.x = rinkX + rinkW / 2; pk.y = rinkY + rinkH / 2;
  pk.vx = 0; pk.vy = 0; pk.idle = 0; pk.lastRed = false; pk.trail = [];
  puckIdleFrames = 0;
  const all = blueTeam.concat(redTeam);
  for (let i = 0; i < all.length; i++) {
    all[i].x = all[i].sx; all[i].y = all[i].sy; all[i].t = 0; all[i].warn = false; all[i].dash = false;
  }
}

// =====================================================
// MENUS
// =====================================================
const MENU_Y = 185, MENU_STEP = 60;

function getMenuItems() {
  const items = [
    { id: 'play', label: 'PLAY' },
    { id: 'levels', label: 'LEVEL SELECT' },
    { id: 'quick', label: 'PLAY VS COMPUTER (HARD)' }
  ];
  if (!coarse) {
    items.push({ id: 'coop', label: '2 PLAYER (CO-OP)' });
    items.push({ id: 'versus', label: '2 PLAYER (VERSUS)' });
  }
  items.push({ id: 'settings', label: 'SETTINGS' });
  return items;
}

function activateMenu() {
  const items = getMenuItems();
  const it = items[clamp(menuIndex, 0, items.length - 1)];
  switch (it.id) {
    case 'play': launch(CAMPAIGN, selectedLevel); break;
    case 'levels': state = LEVELSEL; levelCursor = clamp(selectedLevel, 1, MAX_LEVEL); break;
    case 'quick': launch(QUICK, 1); break;
    case 'coop': launch(COOP, 1); break;
    case 'versus': launch(VERSUS, 1); break;
    case 'settings': state = SETTINGS; settingsIndex = 0; break;
  }
}

function changeSetting(delta, enter) {
  switch (settingsIndex) {
    case 0: musicOn = !musicOn; applyMusic(); break;
    case 1: sfxOn = !sfxOn; break;
    case 2: difficulty = (difficulty + delta + 3) % 3; break;
    case 3: extraEnemies = !extraEnemies; break;
    case 4: if (enter) goToMenu(); break;
  }
  saveSettings();
}

function resultButtons() {
  const b = [];
  let primary;
  if (mode === CAMPAIGN && resultWin) primary = level < MAX_LEVEL ? 'NEXT LEVEL' : 'MAIN MENU';
  else if (mode === CAMPAIGN) primary = 'RETRY';
  else primary = 'REMATCH';
  b.push({ id: 'primary', label: primary });
  if (mode === CAMPAIGN && !resultWin && level < MAX_LEVEL) b.push({ id: 'skip', label: 'WATCH AD: SKIP LEVEL' });
  if (mode === CAMPAIGN) b.push({ id: 'levels', label: 'LEVEL SELECT' });
  if (!(mode === CAMPAIGN && resultWin && level >= MAX_LEVEL)) b.push({ id: 'menu', label: 'MAIN MENU' });
  for (let i = 0; i < b.length; i++) b[i].y = 425 + i * 60;
  return b;
}

function handleResultKey(code) {
  if (code === 'KeyR') { launch(mode, level); return; }
  if (code === 'KeyS') { skipLevel(); return; }
  if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
    if (mode === CAMPAIGN && resultWin) {
      if (level < MAX_LEVEL) launch(CAMPAIGN, level + 1); else goToMenu();
    } else {
      launch(mode, level);
    }
  }
}

// =====================================================
// INPUT - KEYBOARD
// =====================================================
function setMoveKey(code, pressed) {
  const two = twoHumans();
  switch (code) {
    case 'KeyW': up = pressed; break;
    case 'KeyS': down = pressed; break;
    case 'KeyA': left = pressed; break;
    case 'KeyD': right = pressed; break;
    case 'ArrowUp': if (two) p2up = pressed; else up = pressed; break;
    case 'ArrowDown': if (two) p2down = pressed; else down = pressed; break;
    case 'ArrowLeft': if (two) p2left = pressed; else left = pressed; break;
    case 'ArrowRight': if (two) p2right = pressed; else right = pressed; break;
  }
}

function onKeyDown(code) {
  if (code === 'Escape') {
    if (state !== MENU) goToMenu();
    return;
  }
  if (state === MENU) {
    const n = getMenuItems().length;
    switch (code) {
      case 'ArrowUp': case 'KeyW': menuIndex = (menuIndex + n - 1) % n; break;
      case 'ArrowDown': case 'KeyS': menuIndex = (menuIndex + 1) % n; break;
      case 'ArrowLeft': case 'KeyA': if (menuIndex === 0) selectedLevel = Math.max(1, selectedLevel - 1); break;
      case 'ArrowRight': case 'KeyD': if (menuIndex === 0) selectedLevel = Math.min(unlockedLevel, selectedLevel + 1); break;
      case 'Enter': case 'NumpadEnter': case 'Space': activateMenu(); break;
    }
  } else if (state === LEVELSEL) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': levelCursor = Math.max(1, levelCursor - 1); break;
      case 'ArrowRight': case 'KeyD': levelCursor = Math.min(MAX_LEVEL, levelCursor + 1); break;
      case 'ArrowUp': case 'KeyW': levelCursor = Math.max(1, levelCursor - 10); break;
      case 'ArrowDown': case 'KeyS': levelCursor = Math.min(MAX_LEVEL, levelCursor + 10); break;
      case 'Enter': case 'NumpadEnter': case 'Space':
        if (levelCursor <= unlockedLevel) { selectedLevel = levelCursor; launch(CAMPAIGN, levelCursor); }
        break;
    }
  } else if (state === SETTINGS) {
    switch (code) {
      case 'ArrowUp': case 'KeyW': settingsIndex = (settingsIndex + 4) % 5; break;
      case 'ArrowDown': case 'KeyS': settingsIndex = (settingsIndex + 1) % 5; break;
      case 'ArrowLeft': case 'KeyA': changeSetting(-1, false); break;
      case 'ArrowRight': case 'KeyD': changeSetting(1, false); break;
      case 'Enter': case 'NumpadEnter': case 'Space': changeSetting(1, true); break;
    }
  } else if (state === PLAYING) {
    setMoveKey(code, true);
    if (introFrames > 0 && (code === 'Space' || code === 'Enter' || code === 'NumpadEnter')) { introFrames = 0; return; }
    switch (code) {
      case 'Space': shoot = true; break;
      case 'Enter': case 'NumpadEnter': if (twoHumans()) shoot2 = true; break;
      case 'KeyR': startMatch(mode, level); break;
    }
  } else if (state === RESULT) {
    handleResultKey(code);
  }
}

window.addEventListener('keydown', function (e) {
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
      e.code === 'Space' || e.code === 'Enter') e.preventDefault();
  touchUI = false;
  unlockAudio();
  if (adActive) return;
  onKeyDown(e.code);
});
window.addEventListener('keyup', function (e) {
  if (adActive) return;
  setMoveKey(e.code, false);
});
window.addEventListener('blur', clearKeys);

// =====================================================
// INPUT - MOUSE / TOUCH
// =====================================================
function toGameX(cx) { return (cx - offX) / viewScale; }
function toGameY(cy) { return (cy - offY) / viewScale; }

function buttonAt(mx, my, firstY, step, count) {
  const bw = 460, bh = 52, bx = (W - bw) / 2;
  if (mx < bx || mx > bx + bw) return -1;
  for (let i = 0; i < count; i++) {
    const y = firstY + i * step;
    if (my >= y && my <= y + bh) return i;
  }
  return -1;
}

// small in-game buttons (top right)
const BTN_RESTART = { x: 800, y: 18, w: 130, h: 34 };
const BTN_MENU = { x: 945, y: 18, w: 130, h: 34 };
function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

const BTN_BACK = { x: 450, y: 646, w: 200, h: 38 };
const LS = { x0: 95, y0: 92, cw: 82, ch: 86, gx: 9, gy: 10 };
function levelCellAt(mx, my) {
  const col = Math.floor((mx - LS.x0) / (LS.cw + LS.gx)), row = Math.floor((my - LS.y0) / (LS.ch + LS.gy));
  if (col < 0 || col > 9 || row < 0 || row > 4) return -1;
  const x = LS.x0 + col * (LS.cw + LS.gx), y = LS.y0 + row * (LS.ch + LS.gy);
  if (mx > x + LS.cw || my > y + LS.ch) return -1;
  return row * 10 + col + 1;
}

function handleMouseMove(mx, my) {
  let idx = -1;
  if (state === MENU) {
    const items = getMenuItems();
    idx = buttonAt(mx, my, MENU_Y, MENU_STEP, items.length);
    if (idx >= 0) menuIndex = idx;
  } else if (state === SETTINGS) {
    idx = buttonAt(mx, my, 190, 74, 5);
    if (idx >= 0) settingsIndex = idx;
  } else if (state === LEVELSEL) {
    const lv = levelCellAt(mx, my);
    if (lv > 0) { levelCursor = lv; idx = 0; }
    else if (inRect(BTN_BACK, mx, my)) idx = 0;
  } else if (state === RESULT) {
    const bs = resultButtons();
    for (let i = 0; i < bs.length; i++) {
      if (buttonAt(mx, my, bs[i].y, 1, 1) === 0) { idx = i; resultIndex = i; }
    }
  } else if (state === PLAYING) {
    if (inRect(BTN_RESTART, mx, my) || inRect(BTN_MENU, mx, my)) idx = 0;
  }
  canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
}

function handleMouseClick(mx, my) {
  const bw = 460, bx = (W - bw) / 2;
  if (state === MENU) {
    const items = getMenuItems();
    const idx = buttonAt(mx, my, MENU_Y, MENU_STEP, items.length);
    if (idx < 0) return;
    menuIndex = idx;
    if (items[idx].id === 'play' && mx < bx + 100) selectedLevel = Math.max(1, selectedLevel - 1);
    else if (items[idx].id === 'play' && mx > bx + bw - 100) selectedLevel = Math.min(unlockedLevel, selectedLevel + 1);
    else activateMenu();
  } else if (state === SETTINGS) {
    const idx = buttonAt(mx, my, 190, 74, 5);
    if (idx < 0) return;
    settingsIndex = idx;
    if (idx === 2) changeSetting(mx < W / 2 ? -1 : 1, false);
    else changeSetting(1, true);
  } else if (state === LEVELSEL) {
    const lv = levelCellAt(mx, my);
    if (lv > 0) {
      levelCursor = lv;
      if (lv <= unlockedLevel) { selectedLevel = lv; launch(CAMPAIGN, lv); }
    } else if (inRect(BTN_BACK, mx, my)) goToMenu();
  } else if (state === RESULT) {
    const bs = resultButtons();
    for (let i = 0; i < bs.length; i++) {
      if (buttonAt(mx, my, bs[i].y, 1, 1) === 0) {
        if (bs[i].id === 'primary') handleResultKey('Enter');
        else if (bs[i].id === 'skip') skipLevel();
        else if (bs[i].id === 'levels') { state = LEVELSEL; levelCursor = clamp(selectedLevel, 1, MAX_LEVEL); }
        else goToMenu();
        return;
      }
    }
  }
}

canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('wheel', e => e.preventDefault(), { passive: false });

canvas.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  try { window.focus(); canvas.focus(); } catch (er) {}
  unlockAudio();
  if (adActive) return;
  const isMouse = e.pointerType === 'mouse';
  if (isMouse && e.button !== 0) return;
  if (!isMouse) touchUI = true;
  const gx = toGameX(e.clientX), gy = toGameY(e.clientY);

  if (state === PLAYING) {
    if (inRect(BTN_MENU, gx, gy)) { goToMenu(); return; }
    if (inRect(BTN_RESTART, gx, gy)) { startMatch(mode, level); return; }
    if (introFrames > 0) { introFrames = 0; return; }
    if (!isMouse) {
      try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
      const dx = gx - SHOOT_BTN.x, dy = gy - SHOOT_BTN.y;
      if (dx * dx + dy * dy <= (SHOOT_BTN.r + 25) * (SHOOT_BTN.r + 25)) {
        shootBtnId = e.pointerId; shootHeld = true; shoot = true;
      } else if (joyId === null && gx < W * 0.6) {
        joyId = e.pointerId; joyOX = gx; joyOY = gy; joyX = 0; joyY = 0; joyActive = false;
      }
    }
  } else {
    handleMouseMove(gx, gy);
    handleMouseClick(gx, gy);
  }
});

canvas.addEventListener('pointermove', function (e) {
  const gx = toGameX(e.clientX), gy = toGameY(e.clientY);
  if (joyId !== null && e.pointerId === joyId) {
    const dx = gx - joyOX, dy = gy - joyOY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 14) { joyActive = true; joyX = dx / len; joyY = dy / len; }
    else { joyActive = false; joyX = joyY = 0; }
    // drag the base along if the finger goes far (floating stick)
    if (len > 70) { joyOX += dx / len * (len - 70); joyOY += dy / len * (len - 70); }
    return;
  }
  if (e.pointerType === 'mouse' && !adActive) handleMouseMove(gx, gy);
});

function pointerEnd(e) {
  if (joyId !== null && e.pointerId === joyId) { joyId = null; joyActive = false; joyX = joyY = 0; }
  if (shootBtnId !== null && e.pointerId === shootBtnId) { shootBtnId = null; shootHeld = false; }
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);

// =====================================================
// DRAWING
// =====================================================
function drawCentered(text, y, font, color) {
  ctx.font = font; ctx.fillStyle = css(color); ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y);
  ctx.textAlign = 'left';
}

function drawButton(text, y, selected, accent) {
  const bw = 460, bh = 52, bx = (W - bw) / 2;
  if (selected) {
    ctx.fillStyle = rgba(accent.r, accent.g, accent.b, 70);
    fillRR(bx - 6, y - 6, bw + 12, bh + 12, 26);
    ctx.fillStyle = rgba(15, 18, 25, 240);
  } else {
    ctx.fillStyle = rgba(15, 18, 25, 190);
  }
  fillRR(bx, y, bw, bh, 20);
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? css(accent) : rgba(255, 255, 255, 90);
  strokeRR(bx, y, bw, bh, 20);
  drawCentered(text, y + 35, 'bold 24px Arial', selected ? WHITE : C(200, 205, 215));
}

function drawArenaBackground(themeIdx, tick) {
  const t = THEMES[themeIdx];
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, css(t[0])); grd.addColorStop(1, css(t[1]));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // moving spotlights
  for (let k = 0; k < 4; k++) {
    const x0 = 150 + k * 270;
    const sway = 60 * Math.sin(tick * 0.02 + k * 1.7);
    const alpha = 22 + 14 * Math.sin(tick * 0.03 + k);
    ctx.fillStyle = rgba(t[2].r, t[2].g, t[2].b, alpha);
    ctx.beginPath();
    ctx.moveTo(x0 - 18, 0); ctx.lineTo(x0 + 18, 0);
    ctx.lineTo(x0 + sway + 150, H); ctx.lineTo(x0 + sway - 150, H);
    ctx.closePath(); ctx.fill();
  }

  // crowd
  const cols = crowdColors(themeIdx);
  for (let i = 0; i < CROWD_N; i++) {
    const bob = 2 * Math.sin(tick * 0.1 + i);
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.arc(crowdX[i] + 3.5, crowdY[i] + bob + 3.5, 3.5, 0, 6.2832); ctx.fill();
  }
}

function drawMenu() {
  drawArenaBackground(0, animTick);
  const accent = THEMES[0][2];

  // bouncing puck
  const px = W / 2 + 420 * Math.sin(animTick * 0.015);
  const py = 665 + 12 * Math.sin(animTick * 0.06);
  ctx.fillStyle = rgba(0, 0, 0, 90); fillOval(px - 17, py + 8, 38, 14);
  ctx.fillStyle = '#000'; fillOval(px - 15, py - 15, 30, 30);
  ctx.strokeStyle = rgba(255, 255, 255, 80); ctx.lineWidth = 1; strokeOval(px - 15, py - 15, 30, 30);

  drawCentered('ICE HOCKEY', 120, 'bold 80px Arial', C(0, 0, 0, 120));
  drawCentered('ICE HOCKEY', 116, 'bold 80px Arial', WHITE);
  drawCentered('DRONE VIEW', 160, 'bold 32px Arial', accent);

  const items = getMenuItems();
  for (let i = 0; i < items.length; i++) {
    let text = items[i].label;
    if (items[i].id === 'play') text = 'PLAY   <  LEVEL ' + selectedLevel + ' / ' + MAX_LEVEL + '  >';
    drawButton(text, MENU_Y + i * MENU_STEP, i === menuIndex, accent);
  }

  if (coarse) {
    drawCentered('Tap a button     Tap  <  or  >  on PLAY to change level', 590, '15px Arial', C(210, 215, 225));
    drawCentered('Levels unlocked: ' + unlockedLevel + ' / ' + MAX_LEVEL + '      Stars: ' + totalStars() + ' / ' + (MAX_LEVEL * 3), 618, '15px Arial', C(255, 215, 0));
  } else {
    drawCentered('SOLO: WASD or ARROWS = move,  SPACE = shoot,  R = restart', 572, '15px Arial', C(210, 215, 225));
    drawCentered('UP / DOWN = Select     LEFT / RIGHT = Change Level     ENTER = OK     (or use the MOUSE)', 596, '15px Arial', C(210, 215, 225));
    drawCentered('CO-OP: P1 = WASD + SPACE, P2 = ARROWS + ENTER (both on BLUE team vs computer)', 620, '14px Arial', C(160, 170, 190));
    drawCentered('Levels unlocked: ' + unlockedLevel + ' / ' + MAX_LEVEL + '      Stars: ' + totalStars() + ' / ' + (MAX_LEVEL * 3), 644, '15px Arial', C(255, 215, 0));
  }
}

function drawStar(cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = (i % 2) ? r * 0.45 : r;
    const x = cx + Math.cos(a) * rr2, y = cy + Math.sin(a) * rr2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function drawLock(cx, cy) {
  ctx.fillStyle = rgba(170, 175, 190, 220); fillRR(cx - 9, cy - 3, 18, 14, 6);
  ctx.strokeStyle = rgba(170, 175, 190, 220); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy - 3, 6, Math.PI, 0); ctx.stroke();
}

function drawLevelSelect() {
  drawArenaBackground(0, animTick);
  drawCentered('SELECT LEVEL', 58, 'bold 44px Arial', WHITE);
  ctx.font = 'bold 20px Arial'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd700';
  ctx.fillText('STARS  ' + totalStars() + ' / ' + (MAX_LEVEL * 3), 1005, 52);
  ctx.textAlign = 'left';

  for (let n = 1; n <= MAX_LEVEL; n++) {
    const col = (n - 1) % 10, row = Math.floor((n - 1) / 10);
    const x = LS.x0 + col * (LS.cw + LS.gx), y = LS.y0 + row * (LS.ch + LS.gy);
    const d = info(n), unlocked = n <= unlockedLevel, boss = !!d.boss, accent = THEMES[d.th][2];
    ctx.fillStyle = unlocked ? rgba(15, 18, 25, 220) : rgba(15, 18, 25, 150);
    fillRR(x, y, LS.cw, LS.ch, 16);
    ctx.lineWidth = n === levelCursor ? 4 : 2;
    ctx.strokeStyle = n === levelCursor ? '#ffffff' : (boss ? rgba(255, 70, 80) : (unlocked ? css(accent) : rgba(255, 255, 255, 50)));
    strokeRR(x, y, LS.cw, LS.ch, 16);
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px Arial'; ctx.fillStyle = unlocked ? '#fff' : rgba(255, 255, 255, 90);
    ctx.fillText(String(n), x + LS.cw / 2, y + 42);
    if (boss) { ctx.font = 'bold 11px Arial'; ctx.fillStyle = rgba(255, 90, 100); ctx.fillText('BOSS', x + LS.cw / 2, y + 17); }
    ctx.textAlign = 'left';
    if (unlocked) {
      for (let k = 0; k < 3; k++) drawStar(x + LS.cw / 2 + (k - 1) * 22, y + LS.ch - 20, 9, k < (starsBest[n] || 0) ? '#ffd700' : rgba(255, 255, 255, 60));
    } else drawLock(x + LS.cw / 2, y + LS.ch - 24);
  }

  const d = info(levelCursor);
  drawCentered('LEVEL ' + levelCursor + '  -  ' + d.name, 598, 'bold 24px Arial', d.boss ? C(255, 100, 110) : WHITE);
  const tips = levelCursor <= unlockedLevel ? LV.describe(d).join('   |   ') : 'Locked - win level ' + (unlockedLevel) + ' to unlock';
  drawCentered(tips, 626, '16px Arial', C(200, 208, 222));
  drawSmallButton(BTN_BACK, 'BACK');
}

function drawSettings() {
  drawArenaBackground(0, animTick);
  const accent = THEMES[0][2];
  drawCentered('SETTINGS', 130, 'bold 64px Arial', WHITE);
  const items = [
    'MUSIC:  ' + (musicOn ? 'ON' : 'OFF'),
    'SOUND EFFECTS:  ' + (sfxOn ? 'ON' : 'OFF'),
    'COMPUTER:  ' + diffNames[difficulty],
    'EXTRA ENEMIES:  ' + (extraEnemies ? 'ON' : 'OFF'),
    'BACK'
  ];
  for (let i = 0; i < items.length; i++) drawButton(items[i], 190 + i * 74, i === settingsIndex, accent);
  if (!coarse) {
    drawCentered('UP / DOWN = Select     LEFT / RIGHT / ENTER = Change     ESC = Back     (or use the MOUSE)', 610, '15px Arial', C(210, 215, 225));
  }
  drawCentered('Extra enemies: +1 red (max 4) in campaign and VS Computer. CO-OP = 3 reds.', 635, '14px Arial', C(160, 170, 190));
}

function drawResult() {
  ctx.fillStyle = rgba(0, 0, 0, 190); ctx.fillRect(0, 0, W, H);
  let accent;
  if (mode === VERSUS) accent = resultWin ? C(80, 150, 255) : C(240, 70, 80);
  else accent = resultWin ? C(255, 215, 0) : C(240, 70, 80);

  drawCentered(resultTitle, 235, 'bold 56px Arial', accent);
  drawCentered('BLUE ' + blueScore + '  -  ' + redScore + ' RED', 292, 'bold 30px Arial', WHITE);
  if (mode === CAMPAIGN && resultWin) {
    for (let k = 0; k < 3; k++) {
      drawStar(W / 2 + (k - 1) * 66, 346, 26, k < resultStars ? '#ffd700' : rgba(255, 255, 255, 55));
    }
    if (resultNewBest) { ctx.font = 'bold 18px Arial'; ctx.fillStyle = '#ffd700'; ctx.textAlign = 'left'; ctx.fillText('NEW BEST!', W / 2 + 120, 353); }
  }
  if (!coarse) drawCentered(resultPrompt, 412, 'bold 16px Arial', C(220, 225, 235));

  const bs = resultButtons();
  for (let i = 0; i < bs.length; i++) drawButton(bs[i].label, bs[i].y, i === resultIndex, accent);
  if (performance.now() < toastUntil) drawCentered(toastText, 685, 'bold 18px Arial', C(255, 210, 120));
}

function drawIceRink(iceColor) {
  ctx.fillStyle = rgba(0, 0, 0, 80); fillRR(rinkX + 8, rinkY + 10, rinkW, rinkH, 40);
  ctx.fillStyle = css(iceColor); fillRR(rinkX, rinkY, rinkW, rinkH, 40);
  ctx.lineWidth = 5; ctx.strokeStyle = rgba(180, 205, 220); strokeRR(rinkX, rinkY, rinkW, rinkH, 40);

  ctx.strokeStyle = rgba(210, 45, 55); ctx.lineWidth = 4;
  line(rinkX + rinkW / 2, rinkY, rinkX + rinkW / 2, rinkY + rinkH);

  ctx.strokeStyle = rgba(40, 100, 210);
  const leftBlue = rinkX + 250, rightBlue = rinkX + rinkW - 250;
  line(leftBlue, rinkY, leftBlue, rinkY + rinkH);
  line(rightBlue, rinkY, rightBlue, rinkY + rinkH);

  ctx.lineWidth = 4; ctx.strokeStyle = rgba(40, 100, 210);
  strokeOval(rinkX + rinkW / 2 - 70, rinkY + rinkH / 2 - 70, 140, 140);

  ctx.fillStyle = rgba(210, 45, 55);
  fillOval(rinkX + rinkW / 2 - 7, rinkY + rinkH / 2 - 7, 14, 14);

  drawFaceoffCircle(rinkX + 170, rinkY + 160);
  drawFaceoffCircle(rinkX + 170, rinkY + rinkH - 160);
  drawFaceoffCircle(rinkX + rinkW - 170, rinkY + 160);
  drawFaceoffCircle(rinkX + rinkW - 170, rinkY + rinkH - 160);
}

function drawFaceoffCircle(x, y) {
  ctx.strokeStyle = rgba(210, 45, 55); ctx.fillStyle = rgba(210, 45, 55); ctx.lineWidth = 3;
  strokeOval(x - 50, y - 50, 100, 100);
  fillOval(x - 5, y - 5, 10, 10);
}

function drawGoals() {
  const cy = rinkY + rinkH / 2;
  const hl = goalHalfFor(true), hr = goalHalfFor(false);
  ctx.fillStyle = rgba(220, 60, 70);
  ctx.fillRect(rinkX - 18, cy - hl, 18, hl * 2);
  ctx.fillStyle = eff.biggoal > 0 ? rgba(90, 235, 120) : rgba(220, 60, 70);
  ctx.fillRect(rinkX + rinkW, cy - hr, 18, hr * 2);

  ctx.strokeStyle = rgba(255, 255, 255, 150); ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const yl = cy - hl + 5 + i * (hl * 2 - 10) / 6, yr = cy - hr + 5 + i * (hr * 2 - 10) / 6;
    line(rinkX - 18, yl, rinkX, yl);
    line(rinkX + rinkW, yr, rinkX + rinkW + 18, yr);
  }
}

function drawZones() {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (z.k === 'mud') {
      ctx.fillStyle = rgba(120, 85, 50, 120); fillRR(z.x, z.y, z.w, z.h, 30);
      ctx.fillStyle = rgba(80, 55, 30, 90);
      for (let k = 0; k < 9; k++) {
        const bx = z.x + 12 + ((k * 97) % Math.max(1, z.w - 50)), by = z.y + 10 + ((k * 53) % Math.max(1, z.h - 34));
        fillOval(bx, by, 28, 16);
      }
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(90, 60, 30, 170); strokeRR(z.x, z.y, z.w, z.h, 30);
    } else {
      ctx.fillStyle = rgba(255, 200, 40, 55); fillRR(z.x, z.y, z.w, z.h, 20);
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(255, 190, 30, 160); strokeRR(z.x, z.y, z.w, z.h, 20);
      ctx.lineWidth = 4; ctx.strokeStyle = rgba(255, 170, 0, 200);
      const cyy = z.y + z.h / 2, off = (animTick * 1.6) % 50;
      for (let x0 = 0; x0 < z.w; x0 += 50) {
        let xx = z.x + ((x0 + off) % z.w);
        if (z.dx < 0) xx = z.x + z.w - ((x0 + off) % z.w);
        if (xx < z.x + 8 || xx > z.x + z.w - 8) continue;
        ctx.beginPath(); ctx.moveTo(xx - 7 * z.dx, cyy - 13); ctx.lineTo(xx + 7 * z.dx, cyy); ctx.lineTo(xx - 7 * z.dx, cyy + 13); ctx.stroke();
      }
    }
  }
}

function drawObstacles() {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.t === 'c') {
      ctx.fillStyle = rgba(0, 0, 0, 60); fillOval(o.x - o.r + 4, o.y - o.r + 6, o.r * 2, o.r * 2);
      ctx.fillStyle = '#2c3a5e'; fillOval(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      ctx.fillStyle = '#41557f'; fillOval(o.x - o.r + 5, o.y - o.r + 5, o.r * 2 - 10, o.r * 2 - 10);
      ctx.lineWidth = 3; ctx.strokeStyle = '#7f9fe0'; strokeOval(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    } else {
      ctx.fillStyle = rgba(0, 0, 0, 60); fillRR(o.x + 4, o.y + 6, o.w, o.h, 10);
      ctx.fillStyle = '#2c3a5e'; fillRR(o.x, o.y, o.w, o.h, 10);
      ctx.fillStyle = '#41557f'; fillRR(o.x + 4, o.y + 4, o.w - 8, o.h - 8, 6);
      ctx.lineWidth = 3; ctx.strokeStyle = '#7f9fe0'; strokeRR(o.x, o.y, o.w, o.h, 10);
    }
  }
  for (let i = 0; i < movers.length; i++) {
    const m = movers[i], pulse = 3 * Math.sin(animTick * 0.15 + i);
    ctx.fillStyle = rgba(255, 150, 40, 60); fillOval(m.x - m.r - 6 - pulse, m.y - m.r - 6 - pulse, (m.r + 6 + pulse) * 2, (m.r + 6 + pulse) * 2);
    ctx.fillStyle = '#c4552b'; fillOval(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    ctx.fillStyle = '#ff8c42'; fillOval(m.x - m.r + 6, m.y - m.r + 6, m.r * 2 - 12, m.r * 2 - 12);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffd08a'; strokeOval(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
  }
}

function drawPortals() {
  const cols = [[170, 90, 255], [60, 220, 240]];
  for (let i = 0; i < portals.length; i++) {
    const col = cols[i % 2], pr = portals[i];
    for (let e = 0; e < 2; e++) {
      const x = e ? pr[2] : pr[0], y = e ? pr[3] : pr[1];
      ctx.fillStyle = rgba(col[0], col[1], col[2], 120); fillOval(x - 26, y - 26, 52, 52);
      ctx.lineWidth = 5; ctx.strokeStyle = rgba(col[0], col[1], col[2], 230);
      ctx.setLineDash([9, 7]); ctx.lineDashOffset = -animTick * (e ? -0.9 : 0.9);
      strokeOval(x - 26, y - 26, 52, 52);
      ctx.lineDashOffset = animTick * (e ? -0.9 : 0.9);
      strokeOval(x - 15, y - 15, 30, 30);
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
  }
}

function drawPowerups() {
  for (let i = 0; i < powerups.length; i++) {
    const u = powerups[i];
    if (u.life < 150 && Math.floor(u.life / 8) % 2 === 0) continue;       // blink before it vanishes
    const pulse = 2.5 * Math.sin(animTick * 0.12 + i * 2);
    ctx.fillStyle = u.type.col; ctx.globalAlpha = 0.28; fillOval(u.x - 24 - pulse, u.y - 24 - pulse, 48 + pulse * 2, 48 + pulse * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = u.type.col; fillOval(u.x - 16, u.y - 16, 32, 32);
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; strokeOval(u.x - 16, u.y - 16, 32, 32);
    ctx.font = 'bold 19px Arial'; ctx.fillStyle = '#1b2230'; ctx.textAlign = 'center';
    ctx.fillText(u.type.ch, u.x, u.y + 7); ctx.textAlign = 'left';
  }
}

function drawWind() {
  if (!cfg || !cfg.wind) return;
  ctx.strokeStyle = rgba(120, 160, 205, 110); ctx.lineWidth = 2;
  const sx = wind.x * 150, sy = wind.y * 150, len = 5;
  for (let i = 0; i < streaks.length; i++) {
    const q = streaks[i];
    line(q.x, q.y, q.x - sx * len, q.y - sy * len);
  }
}

function drawPlayer(p) {
  const size = p.big ? 56 : (p.isMain ? 34 : 30);
  const frozen = p.red && eff.freeze > 0 && mode !== VERSUS;

  if (p.boss) {                                    // aura + telegraph ring
    ctx.fillStyle = rgba(255, 40, 60, p.dash ? 90 : 40); fillOval(p.x - size / 2 - 8, p.y - size / 2 - 8, size + 16, size + 16);
    if (p.warn) {
      const k = animTick % 18;
      ctx.lineWidth = 4; ctx.strokeStyle = rgba(255, 70, 70, 230 - k * 10);
      strokeOval(p.x - size / 2 - k * 2, p.y - size / 2 - k * 2, size + k * 4, size + k * 4);
    }
  }
  ctx.fillStyle = rgba(0, 0, 0, 50); fillOval(p.x - size / 2 + 4, p.y - size / 2 + 5, size, size);
  ctx.fillStyle = css(p.color); fillOval(p.x - size / 2, p.y - size / 2, size, size);

  if (p.boss) {                                    // horns
    ctx.fillStyle = '#e8b53a'; ctx.strokeStyle = '#5a3a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - 20, p.y - 14); ctx.lineTo(p.x - 27, p.y - 38); ctx.lineTo(p.x - 7, p.y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x + 20, p.y - 14); ctx.lineTo(p.x + 27, p.y - 38); ctx.lineTo(p.x + 7, p.y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // helmet (top half)
  ctx.fillStyle = rgba(35, 35, 40);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - size / 2 + size / 4, size / 2, size / 4, 0, Math.PI, Math.PI * 2);
  ctx.closePath(); ctx.fill();

  if (p.role === 'goalie') { ctx.lineWidth = 3; ctx.strokeStyle = rgba(255, 215, 0, 220); strokeOval(p.x - size / 2, p.y - size / 2, size, size); }

  if (frozen) {
    ctx.fillStyle = rgba(140, 230, 255, 130); fillOval(p.x - size / 2 - 2, p.y - size / 2 - 2, size + 4, size + 4);
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(230, 250, 255, 220); strokeOval(p.x - size / 2 - 2, p.y - size / 2 - 2, size + 4, size + 4);
  }

  ctx.fillStyle = '#fff'; ctx.font = p.big ? 'bold 22px Arial' : 'bold 12px Arial'; ctx.textAlign = 'left';
  ctx.fillText(p.label, p.x - (p.big ? 7 : 4), p.y + (p.big ? 8 : 5));
}

function drawPuck(pk) {
  const sp = Math.sqrt(pk.vx * pk.vx + pk.vy * pk.vy);
  if (sp > 3 && pk.trail.length > 2) {
    for (let i = 0; i < pk.trail.length; i += 2) {
      const f = i / pk.trail.length;
      ctx.fillStyle = rgba(20, 20, 30, 20 + f * 60);
      const rr2 = 4 + f * 9;
      fillOval(pk.trail[i] - rr2, pk.trail[i + 1] - rr2, rr2 * 2, rr2 * 2);
    }
  }
  const size = 30, r = size / 2;
  ctx.fillStyle = rgba(0, 0, 0, 80);
  fillOval(pk.x - r - 1, pk.y - r / 2 + 3, size + 4, size * 3 / 5);
  ctx.fillStyle = '#000';
  fillOval(pk.x - r, pk.y - r, size, size);
}

function drawParticles() {
  for (let i = 0; i < particles.length; i++) {
    const q = particles[i];
    ctx.globalAlpha = Math.min(1, q.life / 25);
    ctx.fillStyle = q.col; ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz);
  }
  ctx.globalAlpha = 1;
}

let darkCv = null;
function drawDark() {
  if (!darkCv) { darkCv = document.createElement('canvas'); darkCv.width = W; darkCv.height = H; }
  const g = darkCv.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,6,0.88)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  const holes = [];
  for (let i = 0; i < blueTeam.length; i++) holes.push([blueTeam[i].x, blueTeam[i].y, 150]);
  for (let i = 0; i < pucks.length; i++) holes.push([pucks[i].x, pucks[i].y, 130]);
  for (let i = 0; i < powerups.length; i++) holes.push([powerups[i].x, powerups[i].y, 70]);
  holes.push([rinkX, rinkY + rinkH / 2, 90]); holes.push([rinkX + rinkW, rinkY + rinkH / 2, 90]);
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i], gr = g.createRadialGradient(h[0], h[1], 18, h[0], h[1], h[2]);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(h[0], h[1], h[2], 0, 6.2832); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(darkCv, 0, 0);
}

function fmtTime(frames) {
  const sec = Math.max(0, Math.ceil(frames * 16 / 1000)), m = Math.floor(sec / 60), ss = sec % 60;
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

function drawScoreboard() {
  ctx.fillStyle = rgba(15, 18, 25, 230); fillRR(410, 15, 280, 45, 15);
  ctx.font = 'bold 22px Arial'; ctx.textAlign = 'left';
  ctx.fillStyle = rgba(70, 140, 255); ctx.fillText('BLUE ' + blueScore, 435, 45);
  ctx.fillStyle = '#fff'; ctx.fillText(' - ', 535, 45);
  ctx.fillStyle = rgba(240, 70, 80); ctx.fillText(redScore + ' RED', 575, 45);

  ctx.font = 'bold 15px Arial'; ctx.fillStyle = '#fff';
  const small = '13px Arial';
  if (mode === CAMPAIGN) {
    const title = (cfg && cfg.boss) ? 'BOSS: ' + cfg.boss.name : (cfg ? cfg.name : '');
    ctx.fillText('LEVEL ' + level + ' - ' + title, 90, 28);
    ctx.font = small;
    ctx.fillText('Score ' + winGoals + ' to win  |  Computer needs ' + loseGoals + '  |  Enemies: ' + enemyCount, 90, 48);
  } else if (mode === QUICK) {
    ctx.fillText('VS COMPUTER  -  HARD MODE', 90, 28);
    ctx.font = small;
    ctx.fillText('First to ' + winGoals + '  |  ' + diffNames[difficulty] + '  |  Enemies: ' + enemyCount, 90, 48);
  } else if (mode === COOP) {
    ctx.fillText('2 PLAYER CO-OP', 90, 28);
    ctx.font = small;
    ctx.fillText('First to ' + winGoals + '  |  ' + diffNames[difficulty] + '  |  Enemies: ' + enemyCount, 90, 48);
  } else {
    ctx.fillText('2 PLAYER VERSUS', 90, 28);
    ctx.font = small;
    ctx.fillText('First to ' + winGoals + ' goals wins', 90, 48);
  }

  // timer chip (time attack)
  if (cfg && cfg.timer) {
    const low = timeLeft * 16 < 10000;
    ctx.fillStyle = rgba(15, 18, 25, 235); fillRR(495, 64, 110, 30, 14);
    ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = (low && Math.floor(animTick / 15) % 2 === 0) ? '#ff5a5a' : '#fff';
    ctx.fillText(fmtTime(timeLeft), 550, 86);
    ctx.textAlign = 'left';
  }

  // active power-up chips + wind chip (bottom left)
  const chips = [];
  if (eff.speed > 0) chips.push(['SPEED ' + Math.ceil(eff.speed / 62.5) + 's', '#ffd23c']);
  if (eff.shot > 0) chips.push(['POWER SHOT ' + Math.ceil(eff.shot / 62.5) + 's', '#ff7a2f']);
  if (eff.freeze > 0) chips.push(['FREEZE ' + Math.ceil(eff.freeze / 62.5) + 's', '#6fe3ff']);
  if (eff.biggoal > 0) chips.push(['BIG GOAL ' + Math.ceil(eff.biggoal / 62.5) + 's', '#7dff8a']);
  if (cfg && cfg.wind) {
    const ax = wind.x > 0.004 ? '\u2192' : (wind.x < -0.004 ? '\u2190' : ''), ay = wind.y > 0.004 ? '\u2193' : (wind.y < -0.004 ? '\u2191' : '');
    chips.push(['WIND ' + ax + ay, '#9cc4ff']);
  }
  let cx = 90;
  ctx.font = 'bold 14px Arial';
  for (let i = 0; i < chips.length; i++) {
    const w = ctx.measureText(chips[i][0]).width + 22;
    ctx.fillStyle = rgba(15, 18, 25, 235); fillRR(cx, 646, w, 28, 14);
    ctx.lineWidth = 2; ctx.strokeStyle = chips[i][1]; strokeRR(cx, 646, w, 28, 14);
    ctx.fillStyle = '#fff'; ctx.fillText(chips[i][0], cx + 11, 665);
    cx += w + 8;
  }

  // RESTART / MENU buttons
  drawSmallButton(BTN_RESTART, 'RESTART');
  drawSmallButton(BTN_MENU, 'MENU');
}

function drawFlashes() {
  if (flashT > 0) {
    ctx.save();
    ctx.translate(W / 2, H / 2 - 20);
    const sc = 1 + Math.max(0, flashT - 52) * 0.025;
    ctx.scale(sc, sc);
    ctx.globalAlpha = Math.min(1, flashT / 18);
    ctx.font = 'bold 88px Arial'; ctx.textAlign = 'center';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(flashText, 0, 0);
    ctx.fillStyle = flashColor; ctx.fillText(flashText, 0, 0);
    ctx.restore(); ctx.textAlign = 'left';
  }
  if (puFlashT > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, puFlashT / 20);
    ctx.font = 'bold 34px Arial'; ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(puFlash, W / 2, 140);
    ctx.fillStyle = puFlashCol; ctx.fillText(puFlash, W / 2, 140);
    ctx.restore(); ctx.textAlign = 'left';
  }
}

function drawIntro() {
  if (introFrames <= 0 || !cfg) return;
  const a = Math.max(0, Math.min(1, (140 - introFrames) / 12, introFrames / 15));
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 235, W, 230);
  const accent = cfg.boss ? C(255, 90, 100) : THEMES[cfg.th][2];
  ctx.fillStyle = css(accent); ctx.fillRect(0, 235, W, 4); ctx.fillRect(0, 461, W, 4);
  drawCentered('LEVEL ' + level, 285, 'bold 28px Arial', accent);
  drawCentered(cfg.boss ? 'BOSS: ' + cfg.boss.name : cfg.name.toUpperCase(), 350, 'bold 58px Arial', WHITE);
  drawCentered(LV.describe(cfg).join('   \u2022   '), 395, '20px Arial', C(215, 222, 235));
  drawCentered(coarse ? 'Tap to start' : 'Press SPACE to start', 438, '15px Arial', C(160, 170, 190));
  ctx.restore();
}

function drawSmallButton(r, text) {
  ctx.fillStyle = rgba(15, 18, 25, 200); fillRR(r.x, r.y, r.w, r.h, 14);
  ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(255, 255, 255, 110); strokeRR(r.x, r.y, r.w, r.h, 14);
  ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(text, r.x + r.w / 2, r.y + 22);
  ctx.textAlign = 'left';
}

function drawTouchControls() {
  // joystick (dark blue so it stays visible on the light ice)
  ctx.lineWidth = 4;
  if (joyId !== null) {
    ctx.strokeStyle = rgba(20, 50, 120, 190); strokeOval(joyOX - 70, joyOY - 70, 140, 140);
    ctx.fillStyle = rgba(20, 50, 120, 50); fillOval(joyOX - 70, joyOY - 70, 140, 140);
    const kx = joyOX + (joyActive ? joyX * 55 : 0), ky = joyOY + (joyActive ? joyY * 55 : 0);
    ctx.fillStyle = rgba(20, 50, 120, 170); fillOval(kx - 30, ky - 30, 60, 60);
  } else {
    ctx.strokeStyle = rgba(20, 50, 120, 130); strokeOval(90, 490, 140, 140);
    ctx.fillStyle = rgba(20, 50, 120, 35); fillOval(90, 490, 140, 140);
    ctx.font = 'bold 18px Arial'; ctx.fillStyle = rgba(20, 50, 120, 200); ctx.textAlign = 'center';
    ctx.fillText('MOVE', 160, 566); ctx.textAlign = 'left';
  }
  // shoot button
  const s = SHOOT_BTN;
  ctx.fillStyle = shootHeld ? rgba(255, 90, 90, 220) : rgba(215, 45, 55, 190);
  fillOval(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  ctx.strokeStyle = rgba(255, 255, 255, 220); strokeOval(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText('SHOOT', s.x, s.y + 8); ctx.textAlign = 'left';
}

function render() {
  // clear the whole canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#191e26';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // fit the game to the window (letterboxed)
  ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * offX, dpr * offY);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.textBaseline = 'alphabetic'; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';

  if (state === MENU) drawMenu();
  else if (state === SETTINGS) drawSettings();
  else if (state === LEVELSEL) drawLevelSelect();
  else {
    drawArenaBackground(theme, animTick);
    drawIceRink(THEMES[theme][3]);
    drawZones();
    drawGoals();
    drawPortals();
    drawWind();
    drawObstacles();
    drawPowerups();
    for (let i = 0; i < blueTeam.length; i++) drawPlayer(blueTeam[i]);
    for (let i = 0; i < redTeam.length; i++) drawPlayer(redTeam[i]);
    for (let i = 0; i < pucks.length; i++) drawPuck(pucks[i]);
    drawParticles();
    if (cfg && cfg.dark && state === PLAYING) drawDark();
    drawScoreboard();
    if (state === PLAYING) { drawFlashes(); drawIntro(); }
    if (state === PLAYING && touchUI && introFrames <= 0) drawTouchControls();
    if (state === RESULT) drawResult();
  }
  ctx.restore();
}

// =====================================================
// MAIN LOOP (fixed 16 ms logic step, like the Java Timer)
// =====================================================
const STEP = 16;
let lastT = 0, acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!lastT) lastT = t;
  let dt = t - lastT; lastT = t;
  if (dt > 100) dt = 100;
  acc += dt;
  while (acc >= STEP) { tick(); acc -= STEP; }
  render();
}

// =====================================================
// START
// =====================================================
loadProgress();
createGame();
Poki.loadingStart();
Poki.init(function () { Poki.loadingFinished(); });
requestAnimationFrame(frame);

// tiny debug hook, only active when the page is opened with #test
if (window.location && window.location.hash === '#test') {
  window.__hdg = {
    start: function (n) { unlockedLevel = MAX_LEVEL; startMatch(CAMPAIGN, n); },
    tick: function () { tick(); },
    keys: function (u, d, l, r, s) { up = u; down = d; left = l; right = r; if (s) shoot = true; },
    snap: function () {
      return { state: state, blueScore: blueScore, redScore: redScore, level: level, win: winGoals, lose: loseGoals,
        intro: introFrames, stars: resultStars, timeLeft: timeLeft, title: resultTitle,
        blue: { x: bluePlayer.x, y: bluePlayer.y },
        pucks: pucks.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy })),
        reds: redTeam.map(p => ({ x: p.x, y: p.y, role: p.role, boss: p.boss })), pu: powerups.length };
    },
    probe: function (x, y, ang) {
      const pk = pucks[0]; pk.x = x; pk.y = y; pk.vx = Math.cos(ang) * 12; pk.vy = Math.sin(ang) * 12; pk.cd = 0; pk.trail = [];
      wind.x = 0; wind.y = 0;
      for (let i = 0; i < 500; i++) {
        stepPuck(pk);
        if (pk.x > rinkX + rinkW + 5 && inGoalMouth(pk.y, false)) return 1;
        if (pk.x < rinkX - 5) return 0;
      }
      return 0;
    },
    blocked: function (x, y) {
      for (const o of obstacles) if (collide(o, x, y, 17)) return true;
      return false;
    },
    setState: function (st) { state = st; }
  };
}

})();
