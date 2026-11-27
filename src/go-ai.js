// PARKSY GO — AI: 정적 평가 + 몬테카를로 플레이아웃 (MCTS-lite)
// 완전한 프로 기력은 아니다. 합법수·따냄·활로·눈 회피를 지키는 실전용 엔진.
import { GoEngine, EMPTY, BLACK, WHITE, opponent, coordName } from "./go-engine.js";

const STAR = {
  9: [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]],
  13: [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]],
  19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]],
};

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

function staticEval(engine, idx, rng) {
  const color = engine.turn;
  const opp = opponent(color);
  const sim = engine.cloneFast();
  const res = sim.playFast(idx);
  if (!res.ok) return null;
  const own = sim.groupAt(idx);
  if (!own) return null;
  const size = engine.size;
  const x = idx % size;
  const y = (idx / size) | 0;
  let s = res.captured.length * 30;
  s += Math.min(own.liberties.length, 6) * 2.2;
  if (own.liberties.length === 1) s -= 32;
  else if (own.liberties.length === 2) s -= 5;
  // 인접 상대 집단의 활로를 줄이는가
  const seen = new Set();
  for (const nb of sim.nbr[idx]) {
    if (sim.board[nb] !== opp) continue;
    const og = sim.groupAt(nb);
    if (!og) continue;
    const key = og.stones[0];
    if (seen.has(key)) continue;
    seen.add(key);
    if (og.liberties.length === 1) s += 9;
    else if (og.liberties.length === 2) s += 2.5;
  }
  // 마지막 수 근처 · 중앙 · 변
  if (engine.lastMove != null) {
    const lx = engine.lastMove % size;
    const ly = (engine.lastMove / size) | 0;
    const d = Math.abs(x - lx) + Math.abs(y - ly);
    if (d === 1) s += 1.8;
    else if (d === 2) s += 0.8;
  }
  const c = (size - 1) / 2;
  s += Math.max(0, 1 - (Math.abs(x - c) + Math.abs(y - c)) / (size * 1.1)) * 1.8;
  if (x === 0 || y === 0 || x === size - 1 || y === size - 1) s -= 1.6;
  let emptyN = 0;
  for (const nb of sim.nbr[idx]) if (sim.board[nb] === EMPTY) emptyN++;
  s += emptyN * 0.35;
  s += rng() * 0.9;
  return { score: s, captured: res.captured.length, liberties: own.liberties.length, stone: idx };
}

export function candidateMoves(engine, rng = Math.random) {
  const color = engine.turn;
  const size = engine.size;
  const near = engine._nearEmpty();
  const stars = STAR[size] || [];
  const candidates = new Set();
  if (engine.moveNumber === 0) {
    candidates.add(centerOf(size));
  } else {
    for (let idx = 0; idx < engine.total; idx++) {
      if (near[idx]) candidates.add(idx);
    }
    for (const [x, y] of stars) candidates.add(y * size + x);
    // 초반에는 중앙도 후보
    if (engine.moveNumber < 6) candidates.add(centerOf(size));
  }
  const out = [];
  for (const idx of candidates) {
    if (engine.board[idx] !== EMPTY || idx === engine.ko) continue;
    if (engine.isEye(idx, color)) continue;
    const ev = staticEval(engine, idx, rng);
    if (ev) out.push(ev);
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function pickPlayoutMove(engine, rng) {
  const empties = [];
  for (let i = 0; i < engine.total; i++) {
    if (engine.board[i] !== EMPTY || i === engine.ko) continue;
    if (engine.isEye(i, engine.turn)) continue;
    empties.push(i);
  }
  if (!empties.length) return -1;
  const tries = Math.min(empties.length, 12);
  const start = (rng() * empties.length) | 0;
  for (let k = 0; k < tries; k++) {
    const idx = empties[(start + k * 37) % empties.length];
    const r = engine.playFast(idx);
    if (r.ok) return idx;
  }
  // 마지막으로 전체를 한 번 훑는다(작은 보드 · 후반)
  if (empties.length > tries) {
    for (const idx of empties) {
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

/**
 * @param {GoEngine} engine
 * @param {{level?: string, seed?: number, timeMs?: number, maxPlayouts?: number}} opts
 */
export function chooseMove(engine, opts = {}) {
  const level = opts.level || "normal";
  const rng = makeRng(opts.seed ?? ((Date.now() ^ (engine.moveNumber * 2654435761)) >>> 0));
  if (engine.gameOver) return { move: null, reason: "game-over", level };
  if (engine.moveNumber === 0) {
    const idx = centerOf(engine.size);
    return {
      move: idx,
      reason: "opening",
      level,
      candidates: [{ idx, score: 1, visits: 0, wins: 0 }],
      visits: 0,
      elapsed: 0,
    };
  }
  let candidates = candidateMoves(engine, rng);
  if (!candidates.length) {
    const legal = engine.legalMoves({ fast: true });
    if (!legal.length) return { move: null, reason: "no-legal-move", level };
    const idx = legal[(rng() * legal.length) | 0];
    return { move: idx, reason: "fallback-legal", level, candidates: [], visits: 0, elapsed: 0 };
  }
  const top = pickTop(candidates, level);
  if (level === "easy") {
    const k = Math.min(3, top.length);
    const pick = top[(rng() * k) | 0];
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
