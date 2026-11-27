// PARKSY GO — AI: 포석 북 + 정적 평가 + 몬테카를로 플레이아웃 (MCTS-lite)
// 완전한 프로 기력은 아니다. 합법수·따냄·활로·눈 회피를 지키는 실전용 엔진.
//
// 2026-11-27 수정: 첫 수가 중앙(K10)으로 가고 이후에도 중앙에 뭉치던 문제를 고친다.
// - 포석 단계에는 화점·3선/4선·상대 돌 접근점만 후보로 둔다(중앙 제외).
// - 정적 평가에서 중앙 보너스를 없애고, 변·귀·간격(과밀 회피)을 본다.
// - 초반 10수는 플레이아웃 대신 포석 북으로 둔다. 이후에만 MCTS를 돌린다.
import { GoEngine, EMPTY, BLACK, WHITE, opponent, coordName } from "./go-engine.js";

const STAR = {
  9: [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]],
  13: [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]],
  19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]],
};

const APPROACH = [
  [2, 1], [1, 2], [2, -1], [-1, 2],
  [-2, 1], [1, -2], [-2, -1], [-1, -2],
  [2, 0], [0, 2], [-2, 0], [0, -2],
];

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const now = () => (globalThis.performance?.now?.() ?? Date.now());

function centerOf(size) {
  const c = (size - 1) >> 1;
  return c * size + c;
}

function stars(size) {
  return STAR[size] || [];
}

function isStar(size, x, y) {
  return stars(size).some(([sx, sy]) => sx === x && sy === y);
}

function lineOf(size, x, y) {
  return Math.min(x, y, size - 1 - x, size - 1 - y) + 1;
}

function cornerDistance(size, x, y) {
  const n = size - 1;
  return Math.min(x + y, n - x + y, x + n - y, n - x + n - y);
}

function centerDistance(size, x, y) {
  const c = (size - 1) / 2;
  return Math.abs(x - c) + Math.abs(y - c);
}

function openingLimit(size) {
  return size === 19 ? 12 : size === 13 ? 8 : 6;
}

function openingPhase(engine) {
  if (engine.moveNumber < 2) return true;
  if (engine.moveNumber >= openingLimit(engine.size)) return false;
  const stones = engine.board.reduce((n, v) => n + (v ? 1 : 0), 0);
  return stones < Math.max(4, openingLimit(engine.size));
}

function nearestStone(engine, x, y) {
  const size = engine.size;
  let best = Infinity;
  let own = 0;
  let opp = 0;
  let ownNear = 0;
  let oppNear = 0;
  for (let i = 0; i < engine.total; i++) {
    const v = engine.board[i];
    if (!v) continue;
    const sx = i % size;
    const sy = (i / size) | 0;
    const d = Math.abs(sx - x) + Math.abs(sy - y);
    if (d < best) best = d;
    if (v === engine.turn) {
      if (d <= 4) own++;
      if (d <= 2) ownNear++;
    } else {
      if (d <= 4) opp++;
      if (d <= 2) oppNear++;
    }
  }
  return { best, own, opp, ownNear, oppNear };
}

// 이 점이 '내 집 안'인가. 4방 이웃 대부분이 내 돌이고, 가까운 곳에 상대가
// 없으면 이미 내 영역이다. AI가 자기 집을 메우며 대국을 망치는 것을 막는다.
function ownTerritoryPoint(engine, idx, color) {
  const size = engine.size;
  if (engine.board[idx] !== EMPTY) return false;
  if (engine.isEye(idx, color)) return true;
  let ownAdj = 0;
  for (const nb of engine.nbr[idx]) {
    if (engine.board[nb] === color) ownAdj++;
  }
  if (ownAdj < 2) return false;
  const x = idx % size;
  const y = (idx / size) | 0;
  let oppDist = Infinity;
  let ownDist = Infinity;
  for (let i = 0; i < engine.total; i++) {
    const v = engine.board[i];
    if (!v) continue;
    const d = Math.abs((i % size) - x) + Math.abs(((i / size) | 0) - y);
    if (v === color) ownDist = Math.min(ownDist, d);
    else oppDist = Math.min(oppDist, d);
  }
  // 상대가 3칸 안에 없고 내 돌이 둘 이상 둘러싸면 자기 집이다.
  return oppDist >= 3 && ownAdj >= 3 && ownDist <= 2;
}

function localProfile(engine, idx, color) {
  const size = engine.size;
  const x = idx % size;
  const y = (idx / size) | 0;
  let ownAdj = 0;
  let oppAdj = 0;
  let ownDist = Infinity;
  let oppDist = Infinity;
  for (const nb of engine.nbr[idx]) {
    if (engine.board[nb] === color) ownAdj++;
    else if (engine.board[nb] && engine.board[nb] !== color) oppAdj++;
  }
  for (let i = 0; i < engine.total; i++) {
    const v = engine.board[i];
    if (!v) continue;
    const d = Math.abs((i % size) - x) + Math.abs(((i / size) | 0) - y);
    if (v === color) ownDist = Math.min(ownDist, d);
    else oppDist = Math.min(oppDist, d);
  }
  return { ownAdj, oppAdj, ownDist, oppDist };
}

function addCandidate(set, engine, idx, color = engine.turn) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= engine.total) return;
  if (engine.board[idx] !== EMPTY || idx === engine.ko) return;
  if (engine.isEye(idx, color)) return;
  set.add(idx);
}

/**
 * 후보 생성. 포석 단계에서는 중앙을 아예 후보에서 뺀다.
 * 중반 이후에는 돌 주변 2칸 + 3·4선 + 화점을 섞어, 국지전과 큰 자리를 함께 본다.
 */
function buildCandidates(engine) {
  const size = engine.size;
  const opening = openingPhase(engine);
  const set = new Set();
  const last = engine.lastMove;

  if (opening) {
    // 1) 빈 귀의 화점. 19로에서 중앙 화점(9,9)은 초반에 두지 않는다.
    for (const [x, y] of stars(size)) {
      if (size === 19 && x === 9 && y === 9) continue;
      addCandidate(set, engine, y * size + x);
    }
    // 2) 3선·4선의 귀 주변. 화점이 막혔을 때 자연스러운 다음 자리.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (lineOf(size, x, y) !== 3 && lineOf(size, x, y) !== 4) continue;
        if (cornerDistance(size, x, y) > 7) continue;
        addCandidate(set, engine, y * size + x);
      }
    }
    // 3) 상대 돌에 붙는 접근점. 상대가 귀를 차지하면 그 옆에서 겨룬다.
    for (let i = 0; i < engine.total; i++) {
      if (!engine.board[i] || engine.board[i] === engine.turn) continue;
      const x = i % size;
      const y = (i / size) | 0;
      if (cornerDistance(size, x, y) > 7) continue;
      for (const [dx, dy] of APPROACH) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (lineOf(size, nx, ny) > 4) continue;
        addCandidate(set, engine, ny * size + nx);
      }
    }
    // 4) 마지막 수 주변의 벌림. 포석에서도 상대를 따라가는 폭은 좁게 둔다.
    if (last !== null && last !== undefined) {
      const lx = last % size;
      const ly = (last / size) | 0;
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
        const nx = lx + dx;
        const ny = ly + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        addCandidate(set, engine, ny * size + nx);
      }
    }
  } else {
    // 돌 주변 2칸. _nearEmpty()는 1칸만 보므로 한 겹 더 넓힌다.
    for (let i = 0; i < engine.total; i++) {
      if (!engine.board[i]) continue;
      const sx = i % size;
      const sy = (i / size) | 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          const nx = sx + dx;
          const ny = sy + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          addCandidate(set, engine, ny * size + nx);
        }
      }
    }
    // 큰 자리: 화점과 3·4선. 중반에도 중앙만 보지 않게 한다.
    for (const [x, y] of stars(size)) addCandidate(set, engine, y * size + x);
    if (engine.moveNumber < size * size * 0.55) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (lineOf(size, x, y) === 3 || lineOf(size, x, y) === 4) {
            addCandidate(set, engine, y * size + x);
          }
        }
      }
    }
    // 9로는 공간이 좁으므로 빈 곳을 모두 후보로 둔다(평가 비용이 작다).
    if (size === 9 || engine.total - engine.moveNumber < 90) {
      for (let idx = 0; idx < engine.total; idx++) addCandidate(set, engine, idx);
    }
  }

  // 후보가 너무 적으면 합법수 전체로 넓힌다. 중앙 금지는 포석에서만 유지.
  if (set.size < 4) {
    for (let idx = 0; idx < engine.total; idx++) {
      if (!opening || centerDistance(size, idx % size, (idx / size) | 0) > size * 0.28) {
        addCandidate(set, engine, idx);
      }
    }
  }
  return { set, opening };
}

function staticEval(engine, idx, rng, opening, atariOwn = [], atariOpp = []) {
  const color = engine.turn;
  const opp = opponent(color);
  const size = engine.size;
  const x = idx % size;
  const y = (idx / size) | 0;
  const profile = localProfile(engine, idx, color);
  const sim = engine.cloneFast();
  const res = sim.playFast(idx);
  if (!res.ok) return null;
  const own = sim.groupAt(idx);
  if (!own) return null;

  let s = res.captured.length * 30;
  s += Math.min(own.liberties.length, 6) * 2.3;
  if (own.liberties.length === 1) s -= 58;
  else if (own.liberties.length === 2) s -= 4.5;

  // 단수당한 내 집단을 살리는 수 — 판 전체에서 가장 급한 수다.
  let saves = 0;
  for (const g of atariOwn) {
    if (!g.stones.some((st) => sim.nbr[idx].includes(st))) continue;
    const after = sim.groupAt(g.stones[0]);
    if (after && after.liberties.length > 1) saves++;
  }
  if (saves) s += 14 * saves;
  // 잡을 수 있는 상대 집단이 있는데 딴 데 두면 감점.
  const capturesAtari = atariOpp.some((g) => res.captured.some((c) => g.stones.includes(c)));
  if (capturesAtari) s += 10;
  if (atariOwn.length && !saves && !capturesAtari) s -= 9;

  // 자기 집 안을 메우는 수 — 눈이 아닐지라도 대국을 망친다.
  const territoryish = !opening && ownTerritoryPoint(engine, idx, color);
  if (territoryish) {
    s -= 7.5;
  } else if (!opening) {
    if (profile.oppDist >= 3 && profile.ownAdj >= 2) s -= 3.8 + (profile.ownAdj - 2) * 2.4;
    if (profile.oppDist >= 4 && profile.ownDist >= 2) s -= 2.2;
  }

  // 상대 진영에서 멀리 떨어진 '엉뚱한' 수. 단, 초반의 큰 자리는 허용.
  if (!opening && engine.moveNumber > 8 && profile.oppDist >= 5 && profile.ownDist >= 3) s -= 3.2;

  // 인접 상대 집단의 활로를 줄이는가 · 끊는가
  const seen = new Set();
  let oppGroups = 0;
  for (const nb of sim.nbr[idx]) {
    if (sim.board[nb] !== opp) continue;
    const og = sim.groupAt(nb);
    if (!og) continue;
    const key = og.stones[0];
    if (seen.has(key)) continue;
    seen.add(key);
    oppGroups++;
    if (og.liberties.length === 1) s += 10;
    else if (og.liberties.length === 2) s += 2.8;
    if (og.liberties.length === 1) s += 0.5;
  }
  if (oppGroups >= 2) s += 1.6; // 양쪽 상대 집단 사이를 끊는 수

  // 연결: 같은 색 이웃과 이어지는가
  let ownAdj = 0;
  for (const nb of sim.nbr[idx]) if (sim.board[nb] === color) ownAdj++;
  s += ownAdj * (opening ? 0.45 : 1.15);
  if (ownAdj === 0 && own.liberties.length === 1) s -= 2.0;

  const line = lineOf(size, x, y);
  if (line === 1) s -= opening ? 3.8 : 2.2;
  else if (line === 2) s -= opening ? 0.9 : 0.35;
  else if (line === 3 || line === 4) s += opening ? 1.35 : 0.8;
  else s += 0.15;

  const cd = cornerDistance(size, x, y);
  const center = centerDistance(size, x, y);
  if (opening) {
    // 빈 귀를 먼저 차지하고, 중앙은 뒤로 미룬다.
    s += Math.max(0, 7 - cd) * 0.62;
    s -= Math.max(0, 1 - center / (size * 0.62)) * 0.9;
  } else {
    s += Math.max(0, 5 - cd) * 0.18;
    // 중반 이후에도 중앙 과밀은 피한다.
    if (engine.moveNumber < size * 1.6) {
      s -= Math.max(0, 1 - center / (size * 0.5)) * 0.35;
    }
  }

  // 간격: 초반에는 돌과 2~5칸 떨어지는 것이 자연스럽다. 붙어서 뭉치면 감점.
  const near = nearestStone(engine, x, y);
  if (Number.isFinite(near.best)) {
    if (opening) {
      s += Math.min(near.best, 6) * 0.62;
      if (near.best <= 1) s -= 1.8;
      if (near.ownNear >= 2) s -= 0.7;
    } else {
      if (near.best <= 2) s += 0.85;
      else if (near.best <= 4) s += 0.35;
      if (near.ownNear >= 3) s -= 0.4;
    }
  }

  // 마지막 수 추종은 중반 이후에만, 약하게.
  if (engine.moveNumber >= 10 && engine.lastMove !== null && engine.lastMove !== undefined) {
    const lx = engine.lastMove % size;
    const ly = (engine.lastMove / size) | 0;
    const d = Math.abs(x - lx) + Math.abs(y - ly);
    if (d === 1) s += 1.15;
    else if (d === 2) s += 0.45;
  }

  let emptyN = 0;
  for (const nb of sim.nbr[idx]) if (sim.board[nb] === EMPTY) emptyN++;
  s += emptyN * 0.3;
  s += rng() * 0.8;
  return {
    score: s,
    captured: res.captured.length,
    liberties: own.liberties.length,
    stone: idx,
    territoryish,
  };
}

export function candidateMoves(engine, rng = Math.random) {
  const color = engine.turn;
  const { set, opening } = buildCandidates(engine);
  // 판 전체의 급한 곳 — 단수당한 내 집단, 잡을 수 있는 상대 집단.
  const groups = engine.groups();
  const atariOwn = groups.filter((g) => g.color === color && g.liberties.length === 1);
  const atariOpp = groups.filter((g) => g.color === opponent(color) && g.liberties.length === 1);
  const out = [];
  for (const idx of set) {
    if (engine.board[idx] !== EMPTY || idx === engine.ko) continue;
    if (engine.isEye(idx, color)) continue;
    const ev = staticEval(engine, idx, rng, opening, atariOwn, atariOpp);
    if (ev) out.push(ev);
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function pickPlayoutMove(engine, rng) {
  const empties = [];
  const useful = [];
  for (let i = 0; i < engine.total; i++) {
    if (engine.board[i] !== EMPTY || i === engine.ko) continue;
    if (engine.isEye(i, engine.turn)) continue;
    empties.push(i);
    if (!ownTerritoryPoint(engine, i, engine.turn)) useful.push(i);
  }
  // 플레이아웃도 자기 집을 메우지 않는다. 영역은 비워 두어야 계가가 맞는다.
  const pool = useful.length ? useful : empties;
  if (!pool.length) return -1;
  const tries = Math.min(pool.length, 14);
  const start = (rng() * pool.length) | 0;
  for (let k = 0; k < tries; k++) {
    const idx = pool[(start + k * 37) % pool.length];
    const r = engine.playFast(idx);
    if (r.ok) return idx;
  }
  // 마지막으로 전체를 한 번 훑는다(작은 보드 · 후반)
  if (pool.length > tries) {
    for (const idx of pool) {
      const r = engine.playFast(idx);
      if (r.ok) return idx;
    }
  }
  return -1;
}

function rollout(engine, rng, maxMoves) {
  let passes = 0;
  for (let m = 0; m < maxMoves && !engine.gameOver; m++) {
    const idx = pickPlayoutMove(engine, rng);
    if (idx < 0) {
      engine.passFast();
      passes++;
      if (engine.gameOver) break;
      continue;
    }
    passes = 0;
  }
  return engine.score("area");
}

function pickTop(candidates, level) {
  const k = level === "easy" ? 4 : level === "normal" ? 8 : level === "strong" ? 10 : 12;
  return candidates.slice(0, k);
}

function openingChoice(cands, rng, level) {
  const n = Math.min(cands.length, level === "easy" ? 6 : 4);
  if (n <= 1) return cands[0];
  const topScore = cands[0].score || 0;
  const pool = cands.slice(0, n).filter((c) => topScore - (c.score || 0) < 2.4);
  return pool[(rng() * pool.length) | 0] || cands[0];
}

/**
 * @param {GoEngine} engine
 * @param {{level?: string, seed?: number, timeMs?: number, maxPlayouts?: number}} opts
 */
export function chooseMove(engine, opts = {}) {
  const level = opts.level || "normal";
  const rng = makeRng(opts.seed ?? ((Date.now() ^ (engine.moveNumber * 2654435761)) >>> 0));
  if (engine.gameOver) return { move: null, reason: "game-over", level };

  // 포석: 중앙을 버리고 귀·변의 큰 자리부터. 플레이아웃 없이 빠르게 둔다.
  if (openingPhase(engine) || engine.moveNumber === 0) {
    const cands = candidateMoves(engine, rng);
    if (cands.length) {
      const pick = openingChoice(cands, rng, level);
      return {
        move: pick.stone,
        reason: engine.moveNumber === 0 ? "opening-book" : "opening",
        level,
        candidates: cands.slice(0, 6).map((c, i) => ({
          idx: c.stone,
          coord: coordName(c.stone, engine.size),
          score: +c.score.toFixed(2),
          visits: 0,
          wins: 0,
          winRate: 0,
          liberties: c.liberties,
          best: i === 0,
        })),
        visits: 0,
        totalVisits: 0,
        elapsed: 0,
      };
    }
  }

  let candidates = candidateMoves(engine, rng);
  // 이미 내 집 안인 곳은 후보에서 먼저 뺀다. 상대가 3칸 안에 없는데
  // 내 돌만 둘러싸고 있으면, 그곳은 두어도 판이 바뀌지 않는 자리다.
  const outsideOwn = candidates.filter((c) => !c.territoryish);
  if (outsideOwn.length >= 6) candidates = outsideOwn;
  if (!candidates.length) {
    const legal = engine.legalMoves({ fast: true });
    if (!legal.length) return { move: null, reason: "no-legal-move", level };
    const idx = legal[(rng() * legal.length) | 0];
    return { move: idx, reason: "fallback-legal", level, candidates: [], visits: 0, elapsed: 0 };
  }
  const top = pickTop(candidates, level);
  if (level === "easy") {
    // 쉬움도 자기 집을 메우지는 않는다. 후보가 전부 집 안이면 그때만 그대로 쓴다.
    const safe = top.filter((c) => !c.territoryish);
    const pool = safe.length ? safe : top;
    const k = Math.min(3, pool.length);
    const pick = pool[(rng() * k) | 0];
    return {
      move: pick.stone,
      reason: "heuristic",
      level,
      candidates: top.map((c, i) => ({ idx: c.stone, score: c.score, visits: 0, wins: 0, best: i === 0 })),
      visits: 0,
      elapsed: 0,
    };
  }

  const budget = opts.timeMs ?? ({ normal: 450, strong: 1200, max: 2600 }[level] ?? 450);
  const maxPlayouts = opts.maxPlayouts ?? 20000;
  const maxMoves = Math.min(engine.total * 2, 520);
  const stats = top.map((c) => ({ ...c, visits: 0, wins: 0, sum: 0 }));
  const t0 = now();
  let plays = 0;
  outer: while (now() - t0 < budget && plays < maxPlayouts) {
    for (const st of stats) {
      if (now() - t0 >= budget || plays >= maxPlayouts) break outer;
      const sim = engine.cloneFast();
      const r = sim.playFast(st.stone);
      if (!r.ok) {
        st.illegal = true;
        continue;
      }
      const sc = rollout(sim, rng, maxMoves);
      const root = engine.turn;
      const win = sc.winner === root ? 1 : sc.winner === 0 ? 0.5 : 0;
      const diff = (sc.black - sc.white) * (root === BLACK ? 1 : -1);
      st.visits++;
      st.wins += win;
      st.sum += diff;
      plays++;
    }
  }

  let best = null;
  let bestValue = -Infinity;
  for (const st of stats) {
    if (!st.visits) continue;
    const winRate = st.wins / st.visits;
    const avgDiff = st.sum / st.visits;
    const value = winRate + 0.02 * Math.tanh(avgDiff / 10) + st.score * 0.0006;
    st.winRate = winRate;
    st.avgDiff = avgDiff;
    if (value > bestValue) {
      bestValue = value;
      best = st;
    }
  }
  if (!best) {
    best = top[0];
    best.winRate = 0;
    best.visits = 0;
  }
  const result = {
    move: best.stone,
    reason: "playout",
    level,
    winRate: best.winRate ?? 0,
    visits: best.visits ?? 0,
    totalVisits: plays,
    elapsed: Math.round(now() - t0),
    candidates: stats
      .slice()
      .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || b.score - a.score)
      .map((c) => ({
        idx: c.stone,
        coord: coordName(c.stone, engine.size),
        score: +c.score.toFixed(2),
        visits: c.visits,
        wins: c.wins,
        winRate: c.visits ? +(c.wins / c.visits).toFixed(3) : 0,
        liberties: c.liberties,
      })),
  };
  return result;
}
