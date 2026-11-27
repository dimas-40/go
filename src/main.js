// PARKSY GO — 부팅·그래프·대국 컨트롤러
import { createGraph } from "./graph.js";
import { GoEngine, BLACK, WHITE, EMPTY, coordName, opponent } from "./go-engine.js";
import { chooseMove } from "./go-ai.js";
import {
  buildOntologyGraph,
  boardWindow,
  engineIndexForNode,
  graphIndexForEngine,
  isNodeOnBoard,
  isStarPoint,
  ONTOLOGY_CLASSES,
  SPACING,
} from "./go-ontology.js";
import { loadVulkanDevice, describeLoader } from "./vulkan-loader.js";
import { createInfluence } from "./gpu-influence.js";

const $ = (id) => document.getElementById(id);

const els = {
  backendBadge: $("backendBadge"),
  adapterBadge: $("adapterBadge"),
  fpsBadge: $("fpsBadge"),
  sizeSelect: $("sizeSelect"),
  humanSelect: $("humanSelect"),
  modeSelect: $("modeSelect"),
  levelSelect: $("levelSelect"),
  komiInput: $("komiInput"),
  scoreSelect: $("scoreSelect"),
  newGameBtn: $("newGameBtn"),
  passBtn: $("passBtn"),
  undoBtn: $("undoBtn"),
  resignBtn: $("resignBtn"),
  fitBtn: $("fitBtn"),
  influenceBtn: $("influenceBtn"),
  territoryBtn: $("territoryBtn"),
  exportBtn: $("exportBtn"),
  importInput: $("importInput"),
  turnDot: $("turnDot"),
  turnText: $("turnText"),
  moveNo: $("moveNo"),
  scoreBox: $("scoreBox"),
  aiStatus: $("aiStatus"),
  ontologyFacts: $("ontologyFacts"),
  groupFacts: $("groupFacts"),
  aiFacts: $("aiFacts"),
  moveLog: $("moveLog"),
  gpuFacts: $("gpuFacts"),
  graph: $("graph"),
  bootOverlay: $("bootOverlay"),
  bootText: $("bootText"),
  banner: $("banner"),
};

const state = {
  engine: new GoEngine(19, { komi: 6.5 }),
  graph: null,
  ontology: null,
  loader: null,
  influence: null,
  influenceMap: null,
  influenceInfo: null,
  influenceOn: false,
  influenceToken: 0,
  territoryOn: false,
  territoryOwner: null,
  humanColor: BLACK,
  mode: "ai",
  aiLevel: "normal",
  scoring: "area",
  aiThinking: false,
  requestId: 0,
  worker: null,
  moveLog: [],
  selected: null,
  selectedSet: new Set(),
  groups: [],
  stoneGroup: new Map(),
  atariStones: new Set(),
  legalCount: 0,
  lastAI: null,
  booted: false,
  toastTimer: 0,
};

const COLOR_NAME = { 1: "흑", 2: "백", 0: "무승부" };
const REASON_NAME = {
  ko: "패",
  suicide: "자살수",
  superko: "삼패",
  occupied: "이미 돌이 있음",
  "out-of-board": "판 밖",
  "game-over": "대국 종료",
  "no-legal-move": "둘 수 있는 수 없음",
  "fallback-legal": "대체 합법수",
};

function showToast(message, bad = false) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.toggle("bad", !!bad);
  t.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

function showBanner(html, bad = false) {
  if (!html) {
    els.banner.classList.add("hidden");
    return;
  }
  els.banner.innerHTML = html;
  els.banner.classList.toggle("bad", !!bad);
  els.banner.classList.remove("hidden");
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function pct(v) {
  return Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
}

function isGameOver() {
  return !!state.engine.gameOver;
}

function isHumanTurn() {
  if (isGameOver()) return false;
  return state.mode === "local" || state.engine.turn === state.humanColor;
}

function aiColor() {
  return opponent(state.humanColor);
}

function refreshBoardState() {
  const e = state.engine;
  state.groups = e.groups();
  state.stoneGroup = new Map();
  state.atariStones = new Set();
  for (const g of state.groups) {
    for (const s of g.stones) state.stoneGroup.set(s, g);
    if (g.liberties.length === 1) for (const s of g.stones) state.atariStones.add(s);
  }
  state.territoryOwner = state.territoryOn ? e.territory() : null;
  state.legalCount = e.gameOver ? 0 : e.legalMoves({ fast: true }).length;
  state.selectedSet = new Set(state.selected?.group?.stones || []);
}

function nodeContext(n) {
  const size = state.engine.size;
  if (!isNodeOnBoard(n, size)) return null;
  const idx = engineIndexForNode(n, size);
  if (idx < 0) return null;
  return { idx, stone: state.engine.board[idx] };
}

function nodeStyle(n) {
  const ctx = nodeContext(n);
  if (!ctx) return null;
  const { idx, stone } = ctx;
  const e = state.engine;
  const size = e.size;
  const x = idx % size;
  const y = (idx / size) | 0;
  const selected = state.selectedSet.has(idx);
  const last = e.lastMove === idx;
  const atari = state.atariStones.has(idx);
  let color = "#2bd6b0";
  let alpha = 0.2;
  let sizePx = 3.2;

  if (stone === BLACK) {
    color = selected ? "#a8d4ff" : last ? "#bfe1ff" : "#4aa8ff";
    alpha = 0.95;
    sizePx = selected ? 21.5 : last ? 20 : 17.5;
    return { color, alpha, size: sizePx, hot: atari };
  }
  if (stone === WHITE) {
    color = selected ? "#ffe9b8" : last ? "#ffe9b8" : "#ffcf6a";
    alpha = 0.95;
    sizePx = selected ? 21.5 : last ? 20 : 17.5;
    return { color, alpha, size: sizePx, hot: atari };
  }

  // 빈 교점
  const star = isStarPoint(size, x, y);
  if (star) {
    color = "#3cb9a6";
    alpha = 0.38;
    sizePx = 4.4;
  }
  const terr = state.territoryOn && state.territoryOwner ? state.territoryOwner[idx] : 0;
  if (terr === BLACK) {
    color = "#5c8fc9";
    alpha = 0.4;
    sizePx = 4.6;
  } else if (terr === WHITE) {
    color = "#c9a06a";
    alpha = 0.4;
    sizePx = 4.6;
  }
  if (state.influenceOn && state.influenceMap) {
    const inf = state.influenceMap[idx] || 0;
    const t = Math.sign(inf) * Math.tanh(Math.sqrt(Math.abs(inf)) / 1.2);
    if (Math.abs(t) > 0.012) {
      color = t > 0 ? "#4aa8ff" : "#ffcf6a";
      alpha = 0.1 + 0.4 * Math.abs(t);
      sizePx = 2.6 + 3.8 * Math.abs(t);
      if (terr) {
        color = terr === BLACK ? "#5c8fc9" : "#c9a06a";
        alpha = Math.max(alpha, 0.4);
        sizePx = Math.max(sizePx, 4.6);
      }
    }
  }
  if (e.ko === idx) {
    color = "#ff4fd8";
    alpha = 0.95;
    sizePx = 6.6;
  }
  if (star && !e.ko && !state.selected) {
    // 화점은 기본값 유지
  }
  if (selected) {
    color = "#ffffff";
    alpha = 0.95;
    sizePx = 5.6;
  }
  return { color, alpha, size: sizePx, hot: false };
}

function nodeLabel(n) {
  const ctx = nodeContext(n);
  if (!ctx) return "";
  const { idx } = ctx;
  const e = state.engine;
  const size = e.size;
  const c = e.board[idx];
  const coord = coordName(idx, size);
  let text = `<b>${coord}</b>`;
  if (c === BLACK) text += " · 흑";
  else if (c === WHITE) text += " · 백";
  else text += " · 빈 교점";
  if (c) {
    const g = state.stoneGroup.get(idx);
    if (g) {
      text += ` · 돌 ${g.stones.length} · 활로 ${g.liberties.length}`;
      if (g.liberties.length === 1) text += " · <span style='color:#ff6b78'>단수</span>";
    }
  } else {
    const x = idx % size;
    const y = (idx / size) | 0;
    if (isStarPoint(size, x, y)) text += " · 화점";
    if (e.ko === idx) text += " · <span style='color:#ff4fd8'>패</span>";
    const terr = state.territoryOn && state.territoryOwner ? state.territoryOwner[idx] : 0;
    if (terr) text += ` · ${COLOR_NAME[terr]} 집`;
    if (state.influenceOn && state.influenceMap) {
      const v = state.influenceMap[idx] || 0;
      text += ` · 영향 ${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
    }
  }
  return text;
}

function linkStyle(l) {
  const a = nodeContext(l.source);
  const b = nodeContext(l.target);
  if (!a || !b) return { visible: false, color: "#2bd6b0", alpha: 0, width: 0, particles: 0 };
  const e = state.engine;
  const aStone = e.board[a.idx];
  const bStone = e.board[b.idx];
  const selected =
    state.selectedSet.has(a.idx) && state.selectedSet.has(b.idx) && aStone === bStone && aStone !== EMPTY;
  if (selected) return { visible: true, color: "#d6fff4", alpha: 0.85, width: 2.2, particles: 1.2 };
  if (aStone && bStone && aStone === bStone) {
    return {
      visible: true,
      color: aStone === BLACK ? "#4aa8ff" : "#ffcf6a",
      alpha: 0.46,
      width: 0.9,
      particles: 0.7,
    };
  }
  if ((e.lastMove === a.idx || e.lastMove === b.idx) && aStone + bStone > 0) {
    return { visible: true, color: "#2bd6b0", alpha: 0.45, width: 0.5, particles: 0 };
  }
  return { visible: true, color: "#1fb9a4", alpha: 0.3, width: 0.2, particles: 0 };
}

function fitBoard(ms = 700) {
  if (!state.graph) return;
  const size = state.engine.size;
  const r = els.graph.getBoundingClientRect();
  const aspect = (r.width || 1) / (r.height || 1);
  const half = ((size - 1) * SPACING) / 2 + SPACING * 0.9;
  const fovDeg = state.graph.camera?.()?.fov || 42;
  const fov = (fovDeg * Math.PI) / 180;
  let dist = half / Math.tan(fov / 2);
  if (aspect < 1) dist *= 1.12;
  dist += 40;
  state.graph.resize();
  state.graph.cameraPosition({ x: 0, y: 0, z: dist }, { x: 0, y: 0, z: 0 }, ms);
}

function selectStone(idx) {
  const g = state.stoneGroup.get(idx);
  if (!g) return;
  state.selected = { type: "stone", idx, group: g };
  state.selectedSet = new Set(g.stones);
  renderGroupFacts();
  if (state.graph) state.graph.restyle();
}

function selectEmpty(idx) {
  state.selected = { type: "empty", idx };
  state.selectedSet = new Set([idx]);
  renderGroupFacts();
  if (state.graph) state.graph.restyle();
}

function clearSelection() {
  state.selected = null;
  state.selectedSet = new Set();
  renderGroupFacts();
  if (state.graph) state.graph.restyle();
}

function logPlay(res) {
  state.moveLog.push({
    number: res.moveNumber,
    color: res.color,
    idx: res.idx,
    pass: false,
    coord: coordName(res.idx, state.engine.size),
    captured: res.captured.length,
  });
}

function logPass(res) {
  state.moveLog.push({
    number: res.moveNumber,
    color: res.color,
    idx: null,
    pass: true,
    coord: "패스",
    captured: 0,
  });
}

function playHuman(idx) {
  const e = state.engine;
  if (isGameOver()) return showToast("대국이 끝났습니다. 새 대국을 누르세요.", true);
  if (state.mode === "ai" && state.aiThinking) return showToast("AI가 생각 중입니다.", true);
  if (state.mode === "ai" && e.turn !== state.humanColor) return showToast("AI 차례입니다.", true);
  const res = e.play(idx);
  if (!res.ok) {
    showToast(`둘 수 없습니다 — ${REASON_NAME[res.reason] || res.reason}`, true);
    selectEmpty(idx);
    return;
  }
  state.requestId++;
  logPlay(res);
  afterMove();
}

function afterMove() {
  state.selected = null;
  state.selectedSet = new Set();
  refreshBoardState();
  const e = state.engine;
  if (state.graph && e.lastMove !== null && e.lastMove !== undefined) {
    const n = state.ontology.nodes[graphIndexForEngine(e.size, e.lastMove)];
    if (n) state.graph.fire(n);
  }
  updateUI();
  if (state.influenceOn) refreshInfluence();
  if (!e.gameOver) setTimeout(() => maybeAI(), 140);
}

function maybeAI() {
  const e = state.engine;
  if (!state.booted || state.aiThinking || e.gameOver || state.mode !== "ai") return;
  if (e.turn !== aiColor()) return;
  state.aiThinking = true;
  const id = ++state.requestId;
  const snapshot = e.serialize();
  const opts = { level: state.aiLevel, seed: (Date.now() ^ (e.moveNumber * 2654435761)) >>> 0 };
  updateUI();
  if (state.worker) {
    state.worker.postMessage({ id, state: snapshot, opts });
  } else {
    setTimeout(() => {
      let result;
      try {
        result = chooseMove(GoEngine.fromState(snapshot), opts);
      } catch (err) {
        result = { move: null, reason: "error", error: String(err?.message || err) };
      }
      applyAIResult(id, result);
    }, 30);
  }
}

function applyAIResult(id, result) {
  if (id !== state.requestId) return;
  state.aiThinking = false;
  const e = state.engine;
  if (!result || result.reason === "error") {
    showToast(`AI 오류: ${result?.error || "알 수 없음"}`, true);
    updateUI();
    return;
  }
  if (e.gameOver) {
    updateUI();
    return;
  }
  if (result.move === null || result.move === undefined) {
    if (result.reason === "game-over") {
      updateUI();
      return;
    }
    const res = e.pass();
    if (res.ok) logPass(res);
    state.lastAI = result;
    afterMove();
    return;
  }
  const res = e.play(result.move);
  if (!res.ok) {
    // 상태가 바뀌었거나 엔진이 거부한 경우 — 같은 상태에서 합법수로 대체
    const legal = e.legalMoves({ fast: true });
    if (legal.length) {
      const alt = e.play(legal[0]);
      if (alt.ok) logPlay(alt);
    } else {
      const p = e.pass();
      if (p.ok) logPass(p);
    }
    state.lastAI = result;
    showToast(`AI 수가 거부되어 대체했습니다 (${REASON_NAME[res.reason] || res.reason})`, true);
    afterMove();
    return;
  }
  logPlay(res);
  state.lastAI = result;
  afterMove();
}

function undoMove() {
  const e = state.engine;
  if (!e.history.length) return;
  state.requestId++;
  state.aiThinking = false;
  state.lastAI = null;
  let steps = 0;
  while (e.history.length && steps < 8) {
    const snap = e.history[e.history.length - 1];
    const moved = !!snap.move;
    const u = e.undo();
    if (!u.ok) break;
    if (moved) state.moveLog.pop();
    steps++;
    if (state.mode !== "ai") break;
    if (e.turn === state.humanColor) break;
  }
  state.selected = null;
  state.selectedSet = new Set();
  refreshBoardState();
  updateUI();
  if (state.influenceOn) refreshInfluence();
  showBanner("");
}

function canUndo() {
  const e = state.engine;
  if (!e.history.length) return false;
  const last = e.history[e.history.length - 1];
  if (!last?.move) return false; // 기권 스냅샷은 되돌릴 수 없다
  if (state.mode !== "ai") return !state.aiThinking;
  return !state.aiThinking && e.history.some((h) => h.move && h.move.color === state.humanColor);
}

function passTurn() {
  const e = state.engine;
  if (isGameOver()) return showToast("대국이 끝났습니다.", true);
  if (state.mode === "ai" && e.turn !== state.humanColor) return showToast("AI 차례입니다.", true);
  const res = e.pass();
  if (!res.ok) return showToast(REASON_NAME[res.reason] || res.reason, true);
  state.requestId++;
  logPass(res);
  afterMove();
}

function resignGame() {
  const e = state.engine;
  if (isGameOver()) return;
  const color = state.mode === "ai" ? state.humanColor : e.turn;
  const res = e.resign(color);
  if (!res.ok) return;
  state.requestId++;
  state.aiThinking = false;
  state.selected = null;
  state.selectedSet = new Set();
  updateUI();
  if (state.influenceOn) refreshInfluence();
}

function newGame() {
  const size = Number(els.sizeSelect.value) || 19;
  const komi = Math.max(0, Math.min(15, Number(els.komiInput.value) || 0));
  const human = Number(els.humanSelect.value) === WHITE ? WHITE : BLACK;
  const mode = els.modeSelect.value === "local" ? "local" : "ai";
  state.engine = new GoEngine(size, { komi, rules: "chinese", superko: true });
  state.humanColor = human;
  state.mode = mode;
  state.aiLevel = els.levelSelect.value || "normal";
  state.scoring = els.scoreSelect.value === "territory" ? "territory" : "area";
  state.requestId++;
  state.aiThinking = false;
  state.moveLog = [];
  state.selected = null;
  state.selectedSet = new Set();
  state.lastAI = null;
  state.influenceMap = null;
  state.influenceInfo = null;
  state.influenceToken++;
  state.territoryOwner = null;
  refreshBoardState();
  updateUI();
  showBanner("");
  fitBoard(750);
  if (state.influenceOn) refreshInfluence();
  if (state.mode === "ai" && state.engine.turn === aiColor()) setTimeout(() => maybeAI(), 260);
}

async function refreshInfluence() {
  const token = ++state.influenceToken;
  if (!state.influenceOn || !state.influence) {
    state.influenceMap = null;
    state.influenceInfo = null;
    if (state.graph) state.graph.restyle();
    renderGpuFacts();
    return;
  }
  const e = state.engine;
  renderGpuFacts("영향도 계산 중…");
  const info = await state.influence.run(e.board, e.size);
  if (token !== state.influenceToken) return;
  state.influenceMap = info.values;
  state.influenceInfo = info;
  if (state.graph) state.graph.restyle();
  renderGpuFacts();
}

function updateUI() {
  const e = state.engine;
  els.turnDot.className = `dot ${e.turn === WHITE ? "white" : "black"}`;
  els.turnText.textContent = e.gameOver
    ? "대국 종료"
    : `${COLOR_NAME[e.turn]} 차례${state.mode === "ai" && e.turn === aiColor() ? " (AI)" : ""}`;
  els.moveNo.textContent = `${e.moveNumber}수`;
  els.passBtn.disabled = !isHumanTurn() || state.aiThinking;
  els.resignBtn.disabled = e.gameOver || state.aiThinking || (state.mode === "ai" && e.turn !== state.humanColor);
  els.undoBtn.disabled = !canUndo();
  els.influenceBtn.setAttribute("aria-pressed", state.influenceOn ? "true" : "false");
  els.territoryBtn.setAttribute("aria-pressed", state.territoryOn ? "true" : "false");
  renderScore();
  renderOntology();
  renderGroupFacts();
  renderAIFacts();
  renderMoves();
  renderGpuFacts();
  if (state.graph) state.graph.restyle();
  if (e.gameOver) renderEndBanner();
  else showBanner("");
  els.aiStatus.textContent = state.aiThinking
    ? `AI가 플레이아웃을 돌리는 중 · ${state.aiLevel}`
    : state.mode === "local"
      ? "사람 vs 사람"
      : e.gameOver
        ? "대국 종료"
        : isHumanTurn()
          ? "내 차례입니다."
          : "AI 차례입니다.";
}

function renderScore() {
  const e = state.engine;
  const s = e.score(state.scoring);
  const modeName = state.scoring === "territory" ? "일본식 집계" : "중국식 면적";
  let html = "";
  html += `<div class="score-line"><span class="b">흑</span><b>${s.black.toFixed(1)}</b></div>`;
  html += `<div class="score-line"><span class="w">백</span><b>${s.white.toFixed(1)}</b></div>`;
  html += `<div class="score-line"><span class="muted">차이</span><b>${s.diff > 0 ? "+" : ""}${s.diff.toFixed(1)}</b></div>`;
  html += `<div class="score-line"><span class="muted">${modeName} · 덤 ${s.komi}</span><span class="muted">따냄 B${s.captures[BLACK]} / W${s.captures[WHITE]}</span></div>`;
  if (e.gameOver && e.result) {
    const winner = e.result.winner;
    const reason = e.result.reason || "종료";
    const wname = winner === 0 ? "무승부" : `${COLOR_NAME[winner]} 승`;
    const detail = reason === "resign" ? `${COLOR_NAME[e.result.loser]} 기권` : `${Math.abs(s.diff).toFixed(1)}집 차`;
    html += `<div class="score-winner">${wname} · ${detail}</div>`;
  }
  els.scoreBox.innerHTML = html;
}

function renderEndBanner() {
  const e = state.engine;
  if (!e.gameOver) return showBanner("");
  const r = e.result || e.score(state.scoring);
  const winner = r.winner;
  const reason = r.reason || "종료";
  const wname = winner === 0 ? "무승부" : `${COLOR_NAME[winner]} 승`;
  let detail;
  if (reason === "resign") detail = `${COLOR_NAME[r.loser]} 기권`;
  else if (reason === "two-pass") detail = `${Math.abs((r.diff ?? e.score(state.scoring).diff)).toFixed(1)}집 차`;
  else detail = reason;
  showBanner(`${wname} — ${detail} · 새 대국을 누르세요.`);
}

function kv(label, value) {
  return `<div class="kv"><span>${label}</span><span>${value}</span></div>`;
}

function legendRow(label, color, value) {
  return `<div class="legend"><i style="background:${color}"></i>${label}<em>${value}</em></div>`;
}

function renderOntology() {
  const e = state.engine;
  const size = e.size;
  const total = size * size;
  const links = 2 * size * (size - 1);
  const black = e.board.reduce((a, v) => a + (v === BLACK ? 1 : 0), 0);
  const white = e.board.reduce((a, v) => a + (v === WHITE ? 1 : 0), 0);
  const atariGroups = state.groups.filter((g) => g.liberties.length === 1).length;
  const libs = state.groups.reduce((a, g) => a + g.liberties.length, 0);
  const terr = state.territoryOwner || e.territory();
  let terrCount = 0;
  for (let i = 0; i < e.total; i++) if (terr[i]) terrCount++;
  const hash = e.hashes.length ? e.hashes[e.hashes.length - 1] : 0;
  let html = "";
  html += kv("그래프", `${total} 노드 · ${links} 링크`);
  html += kv("판", `${size} × ${size} · 창 ${boardWindow(size).min + 1}–${boardWindow(size).max + 1}`);
  html += kv("돌", `흑 ${black} · 백 ${white}`);
  html += kv("돌집단", `${state.groups.length}`);
  html += kv("단수 집단", `${atariGroups}`);
  html += kv("활로 합", `${libs}`);
  html += kv("패", e.ko === null || e.ko === undefined ? "없음" : coordName(e.ko, size));
  html += kv("집", `${terrCount} 교점`);
  html += kv("합법수", `${state.legalCount}`);
  html += kv("상태 해시", `0x${(hash >>> 0).toString(16).padStart(8, "0")}`);
  html += `<h3>클래스</h3>`;
  html += legendRow("교점", "#2bd6b0", total);
  html += legendRow("흑 돌", "#4aa8ff", black);
  html += legendRow("백 돌", "#ffcf6a", white);
  html += legendRow("돌집단", "#9d7bff", state.groups.length);
  html += legendRow("단수", "#ff5a5a", atariGroups);
  html += legendRow("집", "#e0b070", terrCount);
  html += legendRow("영향도", "#7de2ff", state.influenceOn ? "ON" : "OFF");
  html += legendRow("수", "#ffffff", e.moveNumber);
  els.ontologyFacts.innerHTML = html;
}

function renderGroupFacts() {
  const e = state.engine;
  if (!state.selected) {
    els.groupFacts.className = "facts muted";
    els.groupFacts.textContent = "돌을 클릭하세요.";
    return;
  }
  els.groupFacts.className = "facts";
  if (state.selected.type === "empty") {
    const idx = state.selected.idx;
    const coord = coordName(idx, e.size);
    const terr = state.territoryOwner ? state.territoryOwner[idx] : 0;
    const inf = state.influenceOn && state.influenceMap ? state.influenceMap[idx] : null;
    let html = kv("교점", coord);
    html += kv("상태", "빈 교점");
    html += kv("합법", e.gameOver ? "—" : e.isLegal(idx, { fast: true }) ? "가능" : "불가");
    html += kv("집", terr ? `${COLOR_NAME[terr]} 집` : "중립");
    if (inf !== null) html += kv("영향도", `${inf >= 0 ? "+" : ""}${inf.toFixed(2)}`);
    if (e.ko === idx) html += kv("패", "바로 되따냄 금지");
    els.groupFacts.innerHTML = html;
    return;
  }
  const g = state.selected.group;
  if (!g) {
    els.groupFacts.className = "facts muted";
    els.groupFacts.textContent = "돌을 클릭하세요.";
    return;
  }
  const stones = g.stones
    .slice(0, 18)
    .map((s) => coordName(s, e.size))
    .join(", ");
  const libs = g.liberties
    .slice(0, 18)
    .map((s) => coordName(s, e.size))
    .join(", ");
  let html = kv("색", COLOR_NAME[g.color]);
  html += kv("돌 수", `${g.stones.length}`);
  html += kv("활로", `${g.liberties.length}${g.liberties.length === 1 ? " · 단수" : ""}`);
  html += kv("돌", `${stones}${g.stones.length > 18 ? " …" : ""}`);
  html += kv("활로 위치", `${libs}${g.liberties.length > 18 ? " …" : ""}`);
  els.groupFacts.innerHTML = html;
}

function renderAIFacts() {
  const res = state.lastAI;
  if (state.aiThinking) {
    els.aiFacts.className = "facts";
    els.aiFacts.innerHTML = kv("상태", `계산 중 · ${state.aiLevel}`) + kv("엔진", "플레이아웃 + 정적 평가");
    return;
  }
  if (!res) {
    els.aiFacts.className = "facts muted";
    els.aiFacts.textContent = state.mode === "local" ? "사람 vs 사람 대국입니다." : isGameOver() ? "대국이 끝났습니다." : "사람 차례입니다.";
    return;
  }
  els.aiFacts.className = "facts";
  let html = "";
  html += kv("이유", res.reason === "playout" ? "플레이아웃" : res.reason === "heuristic" ? "정적 평가" : res.reason === "opening" ? "포석" : res.reason || "—");
  if (res.visits !== undefined) html += kv("방문", `${res.visits}${res.totalVisits !== undefined ? ` / ${res.totalVisits}` : ""}`);
  if (res.winRate !== undefined) html += kv("승률", pct(res.winRate));
  if (res.elapsed !== undefined) html += kv("시간", `${res.elapsed} ms`);
  if (Array.isArray(res.candidates) && res.candidates.length) {
    html += `<h3>상위 후보</h3>`;
    for (const c of res.candidates.slice(0, 5)) {
      const coord = c.coord || coordName(c.idx, state.engine.size);
      const extra = c.visits ? `${pct(c.winRate)} · ${c.visits}회` : `평가 ${c.score ?? "—"}`;
      html += kv(coord, extra);
    }
  }
  els.aiFacts.innerHTML = html;
}

function renderMoves() {
  if (!state.moveLog.length) {
    els.moveLog.innerHTML = `<li class="empty">아직 둔 수가 없습니다.</li>`;
    return;
  }
  const size = state.engine.size;
  const html = state.moveLog
    .map((m) => {
      const c = m.color === BLACK ? "b" : "w";
      const coord = m.pass ? "패스" : m.coord || coordName(m.idx, size);
      const cap = m.captured ? `<span class="cap">따냄 ${m.captured}</span>` : "";
      return `<li><span class="n">${m.number}</span><span class="c ${c}">${m.color === BLACK ? "흑" : "백"}</span><span>${coord}</span>${cap}</li>`;
    })
    .join("");
  els.moveLog.innerHTML = html;
  els.moveLog.scrollTop = els.moveLog.scrollHeight;
}

function renderGpuFacts(prefix) {
  if (!state.graph) {
    els.gpuFacts.textContent = "그래프 부팅 중…";
    return;
  }
  const loader = state.loader;
  const st = state.graph.stats();
  let html = "";
  if (prefix) html += kv("상태", prefix);
  html += kv("렌더러", st.backend);
  html += kv("GPU 경로", loader?.ok ? loader.gpuBackend : "WebGL2 폴백");
  if (loader?.ok) {
    const i = loader.info || {};
    const name = [i.vendor, i.architecture, i.device || i.description].filter(Boolean).join(" · ") || "렌더러 장치 사용";
    html += kv("어댑터", name.length > 42 ? name.slice(0, 42) + "…" : name);
    if (loader.features?.length || loader.limits?.maxBufferSize) {
      html += kv("기능", `${loader.features.length}개${loader.timestampQuery ? " · timestamp-query" : ""}`);
      html += kv("maxBuffer", fmtBytes(loader.limits.maxBufferSize));
      html += kv("maxStorage", fmtBytes(loader.limits.maxStorageBufferBindingSize));
    }
  } else {
    html += kv("장치", "navigator.gpu 없음/실패");
    html += kv("사유", loader?.reason || "—");
  }
  html += kv("그래프", `${st.nodes} 노드 · ${st.links} 링크`);
  html += kv("그리기", `${st.calls ?? "—"} calls · ${st.fps} FPS`);
  if (state.influenceInfo) {
    html += kv("영향도", `${state.influenceInfo.backend} · ${state.influenceInfo.ms} ms`);
    html += kv("디스패치", `${state.influenceInfo.dispatch} workgroup`);
  } else {
    html += kv("영향도", state.influenceOn ? "계산 대기" : "꺼짐");
  }
  html += kv("Vulkan 표기", "Android/Linux는 Dawn→Vulkan, Windows는 D3D12, macOS는 Metal");
  els.gpuFacts.innerHTML = html;
}

async function exportSGF() {
  try {
    const sgf = state.engine.toSGF();
    const blob = new Blob([sgf], { type: "application/x-go-sgf" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = URL.createObjectURL(blob);
    a.download = `parksy-go-${state.engine.size}x${state.engine.size}-${stamp}.sgf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast("SGF를 내보냈습니다.");
  } catch (e) {
    showToast(`SGF 내보내기 실패: ${e.message}`, true);
  }
}

async function importSGF(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const e = GoEngine.fromSGF(text);
    if (![9, 13, 19].includes(e.size)) {
      showToast(`지원하지 않는 판 크기입니다: ${e.size} (9/13/19만)`, true);
      return;
    }
    state.requestId++;
    state.aiThinking = false;
    state.engine = e;
    state.moveLog = (e.history || [])
      .filter((h) => h.move)
      .map((h) => ({
        number: h.move.number,
        color: h.move.color,
        idx: h.move.idx,
        pass: !!h.move.pass,
        coord: h.move.pass ? "패스" : coordName(h.move.idx, e.size),
        captured: 0,
      }));
    state.humanColor = Number(els.humanSelect.value) === WHITE ? WHITE : BLACK;
    state.mode = els.modeSelect.value === "local" ? "local" : "ai";
    state.selected = null;
    state.selectedSet = new Set();
    state.lastAI = null;
    state.influenceMap = null;
    state.influenceInfo = null;
    state.influenceToken++;
    els.sizeSelect.value = String(e.size);
    els.komiInput.value = String(e.komi);
    refreshBoardState();
    updateUI();
    fitBoard(650);
    if (state.influenceOn) refreshInfluence();
    if (state.mode === "ai" && e.turn === aiColor() && !e.gameOver) setTimeout(() => maybeAI(), 220);
    showToast("SGF를 불러왔습니다.");
  } catch (err) {
    showToast(`SGF 불러오기 실패: ${err.message}`, true);
  } finally {
    els.importInput.value = "";
  }
}

function setupWorker() {
  try {
    const w = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
    w.onmessage = (ev) => {
      const d = ev.data || {};
      if (d.id !== state.requestId) return;
      if (!d.ok) {
        state.aiThinking = false;
        showToast(`AI 워커 오류: ${d.error} — 메인 스레드로 재시도`, true);
        state.worker = null;
        updateUI();
        setTimeout(() => maybeAI(), 120);
        return;
      }
      applyAIResult(d.id, d.result);
    };
    w.onerror = () => {
      state.worker = null;
      state.aiThinking = false;
      showToast("AI 워커를 사용할 수 없어 메인 스레드로 전환합니다.", true);
      updateUI();
      setTimeout(() => maybeAI(), 120);
    };
    state.worker = w;
  } catch (e) {
    state.worker = null;
  }
}

function setupGraph(data) {
  const base = {
    low: false,
    samples: 4,
    powerPreference: "high-performance",
    pixelRatio: Math.min(devicePixelRatio || 1, 2),
    zoom: true,
    pan: true,
    autoRotate: false,
    minDistance: 60,
    maxDistance: 5000,
  };
  return createGraph(els.graph, data, base).catch(async (err) => {
    console.warn("WebGPU 그래프 초기화 실패, WebGL2로 재시도:", err);
    els.graph.replaceChildren();
    const g = await createGraph(els.graph, data, { ...base, forceWebGL: true, samples: 0 });
    g._fallbackReason = String(err?.message || err);
    return g;
  });
}

function syntheticWebGpuLoader() {
  const platform = /Android/i.test(navigator.userAgent) ? "Android"
    : /Windows/i.test(navigator.userAgent) ? "Windows"
    : /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "macOS"
    : /Linux/i.test(navigator.userAgent) ? "Linux" : "unknown";
  const gpuBackend = platform === "Windows" ? "D3D12 (Dawn)"
    : platform === "macOS" ? "Metal (Dawn)"
    : "WebGPU (Dawn → Vulkan)";
  return {
    ok: true, probe: true, backend: "WebGPU", gpuBackend, platform,
    adapter: null, device: null, info: {}, features: [], limits: {},
    timestampQuery: false, reason: null, lost: Promise.resolve(null),
  };
}

async function boot() {
  try {
    setupWorker();

    // 렌더러를 먼저 만든다. WebGPU 경로에서는 두 번째 어댑터·장치를 열지 않는다
    // (SwiftShader/Dawn에서 어댑터를 겹쳐 열면 인스턴스가 흔들리는 것을 실측).
    const data = buildOntologyGraph();
    state.ontology = data;
    els.bootText.textContent = "온톨로지 그래프(19×19 교점) · WebGPU 장치를 여는 중…";
    state.graph = await setupGraph(data);

    const g = state.graph;
    let loader;
    if (g.backend === "WebGPU") {
      loader = syntheticWebGpuLoader();
    } else {
      els.bootText.textContent = "WebGL2 폴백 · 영향도용 WebGPU 장치를 여는 중…";
      loader = await loadVulkanDevice({
        onLost: (info) => {
          showToast(`GPU 장치 상실: ${info.reason || "unknown"}`, true);
        },
      });
    }
    state.loader = loader;
    els.adapterBadge.textContent = loader.ok ? loader.gpuBackend : "WebGL2 폴백";
    els.adapterBadge.title = describeLoader(loader);
    els.adapterBadge.className = `chip ${loader.ok ? "" : "warn"}`;

    const computeDevice = g.backend === "WebGPU" ? g.device() : (loader.ok ? loader.device : null);
    state.influence = await createInfluence(computeDevice);
    g.U.rep.value = 0;
    g.U.spring.value = 0;
    g.U.shapeK.value = 0;
    g.U.fireRate.value = 0.0006;
    g.controls().autoRotate = false;

    g.nodeVisibility((n) => isNodeOnBoard(n, state.engine.size));
    g.nodeColor((n) => nodeStyle(n)?.color || "#2bd6b0");
    g.nodeAlpha((n) => nodeStyle(n)?.alpha ?? 0);
    g.nodeSize((n) => nodeStyle(n)?.size ?? 0);
    g.nodeHot((n) => (nodeStyle(n)?.hot ? 1 : 0));
    g.nodeVal(() => 1);
    g.nodeLabel((n) => nodeLabel(n));

    g.linkVisibility((l) => linkStyle(l).visible);
    g.linkColor((l) => linkStyle(l).color);
    g.linkAlpha((l) => linkStyle(l).alpha);
    g.linkWidth((l) => linkStyle(l).width);
    g.linkDirectionalParticles((l) => linkStyle(l).particles);

    g.onNodeClick((n) => {
      const ctx = nodeContext(n);
      if (!ctx) return;
      if (state.engine.board[ctx.idx] !== EMPTY) {
        selectStone(ctx.idx);
        return;
      }
      if (isGameOver()) return selectEmpty(ctx.idx);
      if (state.mode === "ai" && (state.aiThinking || state.engine.turn !== state.humanColor)) {
        selectEmpty(ctx.idx);
        showToast("AI 차례입니다.", true);
        return;
      }
      playHuman(ctx.idx);
    });
    g.onBackgroundClick(() => clearSelection());

    state.booted = true;
    els.backendBadge.textContent = g.backend === "WebGPU" ? "WebGPU" : "WebGL2";
    els.backendBadge.className = `chip ${g.backend === "WebGPU" ? "" : "warn"}`;
    els.backendBadge.title = loader.ok
      ? `${loader.gpuBackend} · ${describeLoader(loader)}`
      : loader.reason || "WebGL2 폴백";

    newGame();
    els.bootOverlay.classList.add("hidden");
    setInterval(() => {
      if (!state.graph) return;
      const st = state.graph.stats();
      els.fpsBadge.textContent = `${st.fps || 0} FPS`;
      els.fpsBadge.classList.toggle("dim", !st.fps);
    }, 1000);
    window.__parksyGo = { engine: () => state.engine, graph: () => state.graph, state, newGame };
  } catch (e) {
    console.error(e);
    els.bootText.textContent = `부팅 실패: ${e.message}`;
    showBanner(`부팅 실패: ${e.message}`, true);
    els.bootOverlay.classList.remove("hidden");
  }
}

// ── UI 이벤트
els.newGameBtn.addEventListener("click", () => newGame());
els.passBtn.addEventListener("click", () => passTurn());
els.undoBtn.addEventListener("click", () => undoMove());
els.resignBtn.addEventListener("click", () => resignGame());
els.fitBtn.addEventListener("click", () => fitBoard(650));
els.exportBtn.addEventListener("click", () => exportSGF());
els.importInput.addEventListener("change", (e) => importSGF(e.target.files?.[0]));
els.modeSelect.addEventListener("change", () => {
  state.mode = els.modeSelect.value === "local" ? "local" : "ai";
  state.requestId++;
  state.aiThinking = false;
  updateUI();
  if (state.mode === "ai" && state.engine.turn === aiColor() && !state.engine.gameOver) setTimeout(() => maybeAI(), 120);
});
els.humanSelect.addEventListener("change", () => {
  state.humanColor = Number(els.humanSelect.value) === WHITE ? WHITE : BLACK;
  state.requestId++;
  state.aiThinking = false;
  updateUI();
  if (state.mode === "ai" && state.engine.turn === aiColor() && !state.engine.gameOver) setTimeout(() => maybeAI(), 120);
});
els.levelSelect.addEventListener("change", () => {
  state.aiLevel = els.levelSelect.value || "normal";
  updateUI();
});
els.scoreSelect.addEventListener("change", () => {
  state.scoring = els.scoreSelect.value === "territory" ? "territory" : "area";
  updateUI();
});
els.influenceBtn.addEventListener("click", async () => {
  state.influenceOn = !state.influenceOn;
  await refreshInfluence();
  updateUI();
});
els.territoryBtn.addEventListener("click", () => {
  state.territoryOn = !state.territoryOn;
  state.territoryOwner = state.territoryOn ? state.engine.territory() : null;
  updateUI();
});

// 창 크기 변경 시 카메라를 강제로 되돌리지 않되, 캔버스는 따라가게 한다.
window.addEventListener("resize", () => {
  if (state.graph) state.graph.resize();
});

boot();
