/* Level definitions for Ice Hockey - Drone View.
   Levels 1-3 keep the original rules. Levels 4-50 each get their own twist. */
(function () {
'use strict';

const c = (x, y, r) => ({ t: 'c', x: x, y: y, r: r });                 // round pillar
const r = (x, y, w, h) => ({ t: 'r', x: x, y: y, w: w, h: h });         // wall block
const mud = (x, y, w, h) => ({ k: 'mud', x: x, y: y, w: w, h: h });      // slows players + puck
const boost = (x, y, w, h, dx, dy) => ({ k: 'boost', x: x, y: y, w: w, h: h, dx: dx, dy: dy }); // pushes puck

// ---------- layouts ----------
const OBS = {
  pillar1:    [c(770, 350, 34)],
  triad:      [c(720, 270, 24), c(720, 430, 24), c(830, 350, 24)],
  gate:       [c(650, 305, 24), c(650, 395, 24)],
  centerwall: [r(615, 70, 30, 110), r(615, 250, 30, 200), r(615, 520, 30, 110)],
  posts:      [c(165, 350, 16), c(935, 350, 16)],
  zigzag:     [r(430, 70, 24, 290), r(676, 340, 24, 290)],
  maze:       [r(300, 70, 22, 230), r(500, 330, 22, 300), r(700, 70, 22, 300), r(880, 400, 22, 230)]
};
const MOV = {
  sweep2: [
    { k: 'v', x: 450, cy: 350, a: 190, sp: 0.022, ph: 0, r: 22 },
    { k: 'v', x: 650, cy: 350, a: 190, sp: 0.022, ph: Math.PI, r: 22 }
  ],
  orbit: [
    { k: 'o', cx: 550, cy: 350, rad: 180, sp: 0.018, ph: 1.0, r: 22 },
    { k: 'o', cx: 550, cy: 350, rad: 180, sp: 0.018, ph: 1.0 + Math.PI, r: 22 }
  ]
};
const ZON = {
  mudwings:   [mud(300, 70, 400, 110), mud(400, 520, 400, 110)],
  mudcenter:  [mud(430, 250, 240, 200)],
  boostlanes: [boost(300, 150, 500, 60, 1, 0), boost(300, 490, 500, 60, -1, 0)]
};
const PTL = {
  one: [[300, 170, 800, 530]],
  two: [[300, 170, 800, 530], [300, 530, 800, 170]]
};

// D(name, theme, enemies, extras)
function D(name, th, e, o) { return Object.assign({ name: name, th: th, e: e }, o || {}); }

const defs = [null,
  // ---- World 1: ROOKIE RINK (original rules) ----
  D('Rookie Rink', 0, 1, { orig: 1 }),
  D('Double Team', 1, 2, { orig: 1 }),
  D('Triple Threat', 2, 3, { orig: 1 }),

  // ---- World 2: BUMPER BAY ----
  D('First Pillar', 5, 1, { obs: 'pillar1' }),
  D('Triangle Guard', 5, 2, { obs: 'triad' }),
  D('Power Up!', 1, 1, { pw: 1 }),
  D('The Wall', 1, 2, { obs: 'centerwall', form: 0 }),
  D('Sweepers', 2, 2, { mov: 'sweep2', form: 0 }),
  D('The Gate', 2, 2, { obs: 'gate', pw: 1 }),
  D('ICE BEAR', 7, 1, { obs: 'triad', pw: 1, win: 4, lose: 6, boss: { name: 'ICE BEAR', speed: 0.5, dash: 1 } }),

  // ---- World 3: SLUSH ZONE ----
  D('Goalie Time', 3, 1, { gk: 1 }),
  D('Mud Wings', 3, 2, { zon: 'mudwings' }),
  D('Speed Lanes', 3, 2, { zon: 'boostlanes', pw: 1 }),
  D('Beat The Clock', 6, 2, { timer: 75, win: 3 }),
  D('Fortress', 6, 2, { obs: 'posts', gk: 1 }),
  D('Windy City', 6, 2, { wind: { x: 0.035, y: 0 } }),
  D('Zigzag', 4, 2, { obs: 'zigzag', form: 0, pw: 1 }),
  D('Mud & Goalie', 4, 3, { zon: 'mudcenter', gk: 1 }),
  D('Crosswind', 4, 2, { wind: { x: 0, y: 0.04 }, obs: 'triad', pw: 1 }),
  D('THE WALL', 9, 1, { gk: 1, pw: 1, win: 4, lose: 6, boss: { name: 'THE WALL', speed: 0.6, dash: 1 } }),

  // ---- World 4: CHAOS ARENA ----
  D('Double Trouble', 2, 2, { two: 1 }),
  D('Portal Panic', 2, 2, { ptl: 'one' }),
  D('Time Attack', 8, 3, { timer: 100, win: 4 }),
  D('Orbit', 8, 2, { mov: 'orbit', pw: 1 }),
  D('Pucks & Goalie', 8, 2, { two: 1, gk: 1 }),
  D('Maze Runner', 2, 2, { obs: 'maze', form: 1, pw: 1 }),
  D('Gale Force', 8, 3, { wind: { x: 0.05, y: 0 }, obs: 'gate' }),
  D('Portal Wall', 2, 3, { ptl: 'two', obs: 'centerwall', form: 0 }),
  D('Mud Madness', 2, 3, { zon: 'mudcenter', gk: 1, pw: 1 }),
  D('STORM KING', 4, 2, { wind: { x: 0.03, y: 0.03 }, pw: 1, win: 5, lose: 6, boss: { name: 'STORM KING', speed: 0.66, dash: 1 } }),

  // ---- World 5: CYBER STORM ----
  D('Lights Out', 8, 2, { dark: 1 }),
  D('Dark Pillars', 8, 2, { dark: 1, obs: 'triad' }),
  D('Sweep & Goalie', 8, 3, { mov: 'sweep2', gk: 1 }),
  D('Speed Run', 8, 3, { timer: 80, win: 4, zon: 'boostlanes', pw: 1 }),
  D('Puck Storm', 2, 2, { two: 1, obs: 'gate', pw: 1 }),
  D('Phantom Portals', 8, 2, { ptl: 'two', dark: 1 }),
  D('Blizzard', 7, 3, { wind: { x: 0.04, y: 0.03 }, zon: 'mudwings' }),
  D('Zigzag Pro', 7, 3, { obs: 'zigzag', form: 0, gk: 1, two: 1 }),
  D('Orbit Storm', 7, 3, { mov: 'orbit', wind: { x: 0.03, y: 0 }, pw: 1 }),
  D('PHANTOM', 8, 1, { dark: 1, pw: 1, win: 5, lose: 6, boss: { name: 'PHANTOM', speed: 0.68, dash: 1 } }),

  // ---- World 6: CHAMPIONS ----
  D('Grand Opening', 9, 3, { obs: 'maze', form: 1, gk: 1 }),
  D('Full House', 9, 4, { obs: 'triad' }),
  D('Time Bomb', 9, 3, { timer: 90, win: 4, two: 1 }),
  D('Portal Fortress', 6, 3, { ptl: 'one', obs: 'posts', gk: 1 }),
  D('Gauntlet', 6, 3, { obs: 'zigzag', form: 0, mov: 'orbit', pw: 1 }),
  D('Black Ice', 8, 3, { dark: 1, wind: { x: 0.03, y: 0 }, gk: 1 }),
  D('Chaos Theory', 2, 4, { two: 1, ptl: 'one', wind: { x: 0.025, y: 0.025 }, pw: 1 }),
  D('Last Stand', 4, 4, { obs: 'maze', form: 1, gk: 1, zon: 'mudwings' }),
  D('Almost There', 9, 4, { mov: 'sweep2', ptl: 'one', gk: 1, two: 1, pw: 1 }),
  D('THE CHAMPION', 9, 3, { gk: 1, obs: 'posts', wind: { x: 0, y: 0.03 }, pw: 1, win: 5, lose: 5,
      boss: { name: 'THE CHAMPION', speed: 0.75, dash: 1 } })
];

const copy = a => a.map(o => Object.assign({}, o));

window.HDG_LEVELS = {
  max: 50,
  get: function (n) {
    const d = defs[Math.max(1, Math.min(50, n))];
    const out = Object.assign({}, d);
    if (!d.orig && out.form === undefined) out.form = 0;      // defender starts in front of the goal
    out.obsList = d.obs ? copy(OBS[d.obs]) : [];
    out.movList = d.mov ? copy(MOV[d.mov]) : [];
    out.zonList = d.zon ? copy(ZON[d.zon]) : [];
    out.ptlList = d.ptl ? PTL[d.ptl].map(p => p.slice()) : [];
    return out;
  },
  isBoss: function (n) { return !!(defs[n] && defs[n].boss); },
  // short tips shown on the level intro banner and in level select
  describe: function (d) {
    const t = [];
    if (d.boss) t.push('BOSS FIGHT - it dashes at the puck!');
    if (d.two) t.push('TWO PUCKS');
    if (d.timer) t.push('TIME ATTACK: ' + d.timer + 's');
    if (d.gk) t.push('Goalkeeper');
    if (d.dark) t.push('Lights out');
    if (d.wind) t.push('Windy ice');
    if (d.ptl) t.push('Portals');
    if (d.obs || d.mov) t.push('Obstacles');
    if (d.zon) t.push(d.zon === 'boostlanes' ? 'Boost lanes' : 'Mud patches');
    if (d.pw) t.push('Power-ups');
    if (!t.length) t.push(d.e + (d.e > 1 ? ' enemies' : ' enemy'));
    return t;
  }
};
})();
