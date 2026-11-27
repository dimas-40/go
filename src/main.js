// PARKSY GO — 부팅·그래프·대국 컨트롤러
import { ACESFilmicToneMapping, PCFShadowMap, Vector3 } from "three";
import { createGraph } from "./graph.js";
import { GoEngine, BLACK, WHITE, EMPTY, coordName, coordIndex, opponent } from "./go-engine.js";
import { chooseMove, candidateMoves, makeRng } from "./go-ai.js";
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
import { createBoard3D } from "./board3d.js";
import { drawKifu, drawScenario } from "./kifu.js";
import {
  KIFU_CATEGORIES,
  KIFU_DB,
  coordToIndex as dbCoordIndex,
  drawKifuBoard,
  recordById,
} from "./kifu-db.js";
import {
  ALL_SCENES,
  CHAPTERS,
  createSceneEngine,
  firstScene,
  goalLabel,
  isGoalMet,
  nextScene,
  sceneById,
} from "./story.js";
import {
  cancelSound,
  captureSound,
  futureSound,
  ghostSound,
  initAudio,
  listenKorean,
  listenSupported,
  loseSound,
  placeSound,
  selectSound,
  setVoiceEnabled,
  speak,
  speechSupported,
  stoneSound,
  uiSound,
  voiceEnabled,
  winSound,
} from "./audio.js";

const $ = (id) => document.getElementById(id);

// 타이틀 판 위의 전시 기보. 실제 대국 상태와 무관한 한 장면으로,
// 흑과 백이 함께 놓인 목판을 첫 화면에서 보여 준다.
const TITLE_SHOWCASE = (() => {
  const at = (x, y) => y * 19 + x;
  return [
    { idx: at(15, 3), color: BLACK },  // Q16
    { idx: at(15, 15), color: BLACK }, // Q4
    { idx: at(16, 5), color: BLACK },  // R14
    { idx: at(2, 13), color: BLACK },  // C6
    { idx: at(9, 9), color: BLACK },   // K10
    { idx: at(11, 9), color: BLACK },  // M10
    { idx: at(3, 15), color: WHITE },  // D4
    { idx: at(3, 3), color: WHITE },   // D16
    { idx: at(16, 3), color: WHITE },  // R16
    { idx: at(5, 16), color: WHITE },  // F3
    { idx: at(10, 10), color: WHITE }, // L11
    { idx: at(10, 8), color: WHITE },  // L9
  ];
})();
const TITLE_SHOWCASE_LAST = 9 * 19 + 9;

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
  kifuGraph: $("kifuGraph"),
  kifuFloat: $("kifuFloat"),
  kifuFloatPanel: $("kifuFloatPanel"),
  kifuStatus: $("kifuStatus"),
  kifuFloatStatus: $("kifuFloatStatus"),
  kifuToggleBtn: $("kifuToggleBtn"),
  focusBtn: $("focusBtn"),
  scenarioPanel: $("scenarioPanel"),
  scenarioTitle: $("scenarioTitle"),
  scenarioGraph: $("scenarioGraph"),
  scenarioSteps: $("scenarioSteps"),
  scenarioCloseBtn: $("scenarioCloseBtn"),
  scenarioToggleBtn: $("scenarioToggleBtn"),
  graph: $("graph"),
  boardOverlay: $("boardOverlay"),
  boardStatus: $("boardStatus"),
  blackName: $("blackName"),
  whiteName: $("whiteName"),
  blackCaptures: $("blackCaptures"),
  whiteCaptures: $("whiteCaptures"),
  dashBlack: $("dashBlack"),
  dashWhite: $("dashWhite"),
  blackPlate: $("blackPlate"),
  whitePlate: $("whitePlate"),
  medallionStone: $("medallionStone"),
  medallionText: $("medallionText"),
  bootOverlay: $("bootOverlay"),
  bootText: $("bootText"),
  banner: $("banner"),
  askBtn: $("askBtn"),
  futureBtn: $("futureBtn"),
  titleBtn: $("titleBtn"),
  voiceToggleBtn: $("voiceToggleBtn"),
  micBtn: $("micBtn"),
  placePanel: $("placePanel"),
  placeStone: $("placeStone"),
  placeCoord: $("placeCoord"),
  placeConfirmBtn: $("placeConfirmBtn"),
  placeCancelBtn: $("placeCancelBtn"),
  kifuDbCats: $("kifuDbCats"),
  kifuDbList: $("kifuDbList"),
  kifuDbDetail: $("kifuDbDetail"),
  storyHud: $("storyHud"),
  storyChapter: $("storyChapter"),
  storyGoal: $("storyGoal"),
  storyExitBtn: $("storyExitBtn"),
  ghostPanel: $("ghostPanel"),
  ghostText: $("ghostText"),
  ghostNextBtn: $("ghostNextBtn"),
  ghostCloseBtn: $("ghostCloseBtn"),
  futurePanel: $("futurePanel"),
  futureRank: $("futureRank"),
  futureLine: $("futureLine"),
  futureScore: $("futureScore"),
  futurePlayBtn: $("futurePlayBtn"),
  futureCancelBtn: $("futureCancelBtn"),
  titleScreen: $("titleScreen"),
  startStoryBtn: $("startStoryBtn"),
  continueBtn: $("continueBtn"),
  startFreeBtn: $("startFreeBtn"),
  storyComplete: $("storyComplete"),
  completeKicker: $("completeKicker"),
  completeTitle: $("completeTitle"),
  completeText: $("completeText"),
  completeNextBtn: $("completeNextBtn"),
  completeRetryBtn: $("completeRetryBtn"),
  completeTitleBtn: $("completeTitleBtn"),
};

const state = {
  engine: new GoEngine(19, { komi: 6.5 }),
  graph: null,
  board3d: null,
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
  story: null,
  storyComplete: false,
  storyFailed: false,
  pendingNext: null,
  storyScriptIndex: 0,
  storyIntroIndex: 0,
  hintIndex: 0,
  lastPlayResult: null,
  lastPlayWasHuman: false,
  ghostQueue: [],
  ghostTyping: 0,
  ghostTimer: 0,
  futureMode: false,
  future: null,
  futureSet: new Map(),
  futureToken: 0,
  progress: { completed: [] },
  titleVisible: true,
  modeBeforeStory: "ai",
  viewMode: "board",
  focusMode: false,
  kifuOpen: false,
  rightTab: "onto",
  scenarioOpen: true,
  liveCandidates: [],
  liveCandidateKey: "",
  thinkingCandidates: [],
  ghostLine: [],
  pending: null,
  kifuDemo: null,
  kifuRecordId: null,
  kifuDbCat: "all",
  voiceOn: true,
  micRec: null,
  micActive: false,
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

// ══════════════════════════════════════════════════════════
// 《귀신의 한 수》 — 타이틀 · 스토리 · 귀신 · 미래
// ══════════════════════════════════════════════════════════
const PROGRESS_KEY = "parksygo.progress.v1";

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.completed)) state.progress = { completed: p.completed.filter((x) => typeof x === "string") };
  } catch (e) { /* 저장소가 없어도 게임은 돈다 */ }
}

function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ completed: state.progress.completed, updated: new Date().toISOString() }));
  } catch (e) { /* noop */ }
}

function completedScene(id) {
  return state.progress.completed.includes(id);
}

function markCompleted(id) {
  if (!completedScene(id)) state.progress.completed.push(id);
  saveProgress();
  updateContinueButton();
}

function nextUnfinishedScene() {
  return ALL_SCENES.find((s) => !completedScene(s.id)) || null;
}

function updateContinueButton() {
  if (!state.progress.completed.length) {
    els.continueBtn.classList.add("hidden");
    els.continueBtn.textContent = "이어하기";
    return;
  }
  const left = nextUnfinishedScene();
  els.continueBtn.classList.remove("hidden");
  if (!left) {
    els.continueBtn.textContent = "다시 보기";
    return;
  }
  els.continueBtn.textContent = `이어하기 · ${left.no} ${left.title}`;
}

function clearFuture(restyle = true) {
  state.futureToken++;
  state.future = null;
  state.futureSet = new Map();
  els.futurePanel.classList.add("hidden");
  syncBoard3D();
  if (restyle && state.graph) state.graph.restyle();
  renderKifu();
}

function setFutureMode(on) {
  state.futureMode = !!on;
  document.body.classList.toggle("future-mode", state.futureMode);
  els.futureBtn.setAttribute("aria-pressed", state.futureMode ? "true" : "false");
  if (!state.futureMode) {
    clearFuture();
  } else {
    ghostSpeak("어디에 둘지 상상해 봐. 빈 교점을 누르면 세 수 앞을 보여 줄게.");
    futureSound();
  }
}

function resetTransient() {
  state.requestId++;
  state.aiThinking = false;
  state.moveLog = [];
  state.selected = null;
  state.selectedSet = new Set();
  state.lastAI = null;
  state.lastPlayResult = null;
  state.lastPlayWasHuman = false;
  state.influenceMap = null;
  state.influenceInfo = null;
  state.influenceToken++;
  state.territoryOwner = null;
  state.liveCandidates = [];
  state.liveCandidateKey = "";
  state.thinkingCandidates = [];
  state.ghostLine = [];
  state.pending = null;
  state.kifuDemo = null;
  clearFuture(false);
  state.futureMode = false;
  document.body.classList.remove("future-mode");
  els.futureBtn.setAttribute("aria-pressed", "false");
}

function startTitle() {
  initAudio();
  state.titleVisible = true;
  state.story = null;
  state.storyComplete = false;
  state.storyFailed = false;
  state.pendingNext = null;
  state.storyScriptIndex = 0;
  state.storyIntroIndex = 0;
  state.hintIndex = 0;
  state.engine = new GoEngine(19, { komi: 6.5, rules: "chinese", superko: true });
  state.mode = "local";
  state.humanColor = BLACK;
  state.scoring = "area";
  resetTransient();
  ghostClose();
  els.storyHud.classList.add("hidden");
  els.storyComplete.classList.add("hidden");
  els.titleScreen.classList.remove("hidden");
  document.body.classList.add("title-mode");
  document.body.classList.remove("story-mode");
  document.body.classList.remove("future-mode");
  updateContinueButton();
  refreshBoardState();
  updateUI();
  setShowcase(false);
  applyViewMode("board", { force: true, fit: false });
  fitTitleBoard(900);
  // 타이틀은 살아 있는 전시장 — 카메라가 아주 천천히 숨을 쉰다.
  const tc = state.graph?.controls?.();
  if (tc) {
    tc.autoRotate = true;
    tc.autoRotateSpeed = 0.18;
  }
  renderScenario();
  renderKifuDb();
}

function startFreeMode() {
  initAudio();
  state.titleVisible = false;
  state.story = null;
  state.storyComplete = false;
  state.storyFailed = false;
  state.pendingNext = null;
  els.titleScreen.classList.add("hidden");
  els.storyHud.classList.add("hidden");
  els.storyComplete.classList.add("hidden");
  ghostClose();
  document.body.classList.remove("title-mode", "story-mode", "future-mode");
  setShowcase(false);
  clearFuture();
  newGame();
  applyViewMode("overlay", { fit: false });
  setRightTab("onto");
  const fc = state.graph?.controls?.();
  if (fc) fc.autoRotate = false;
  renderScenario();
  renderKifuDb();
  showToast("자유 대국입니다. 자리를 고른 뒤 '착수'를 누르세요.");
}

function loadStoryScene(scene) {
  if (!scene) return;
  initAudio();
  state.titleVisible = false;
  state.story = scene;
  state.storyComplete = false;
  state.storyFailed = false;
  state.pendingNext = null;
  state.storyScriptIndex = 0;
  state.storyIntroIndex = 0;
  state.hintIndex = 0;
  state.engine = createSceneEngine(scene);
  state.humanColor = BLACK;
  state.mode = scene.opponent?.kind === "none" ? "local" : "ai";
  state.aiLevel = scene.opponent?.level || "easy";
  state.scoring = "area";
  resetTransient();
  state.story = scene;
  els.sizeSelect.value = String(scene.size);
  els.humanSelect.value = "1";
  els.modeSelect.value = state.mode === "local" ? "local" : "ai";
  els.levelSelect.value = state.aiLevel;
  els.komiInput.value = String(scene.komi ?? 6.5);
  els.scoreSelect.value = "area";
  els.storyChapter.textContent = `${scene.chapter?.no || "제1장"} · ${scene.chapter?.title || ""} — ${scene.no} ${scene.title}`;
  els.storyGoal.textContent = goalLabel(scene);
  els.storyHud.classList.remove("hidden");
  els.titleScreen.classList.add("hidden");
  els.storyComplete.classList.add("hidden");
  document.body.classList.remove("title-mode");
  document.body.classList.add("story-mode");
  document.body.classList.remove("future-mode");
  setShowcase(false);
  refreshBoardState();
  updateUI();
  applyViewMode("overlay", { fit: false });
  fitBoard(820);
  const sc = state.graph?.controls?.();
  if (sc) sc.autoRotate = false;
  state.scenarioOpen = true;
  renderScenario();
  ghostQueue(scene.intro || []);
  if (state.influenceOn) refreshInfluence();
}

function ghostQueue(lines) {
  state.ghostQueue = (lines || []).filter((x) => typeof x === "string" && x.length);
  state.ghostTimer = 0;
  ghostNext();
}

function ghostSpeak(text) {
  state.ghostQueue = [text];
  ghostNext();
}

function ghostNext() {
  const line = state.ghostQueue.shift();
  if (!line) {
    els.ghostNextBtn.classList.add("hidden");
    return;
  }
  els.ghostPanel.classList.remove("hidden");
  els.ghostNextBtn.classList.toggle("hidden", state.ghostQueue.length === 0);
  ghostSound();
  // 귀신의 목소리. 음성 토글이 켜져 있으면 대사와 동시에 읽는다.
  speak(line);
  clearInterval(state.ghostTimer);
  state.ghostTyping++;
  const token = state.ghostTyping;
  const text = line;
  let i = 0;
  els.ghostText.textContent = "";
  els.ghostText.classList.add("typing");
  state.ghostTimer = setInterval(() => {
    if (token !== state.ghostTyping) return clearInterval(state.ghostTimer);
    i += 1;
    els.ghostText.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(state.ghostTimer);
      els.ghostText.classList.remove("typing");
    }
  }, 22);
  if (text.length === 0) els.ghostText.classList.remove("typing");
}

function ghostClose() {
  state.ghostTyping++;
  clearInterval(state.ghostTimer);
  state.ghostQueue = [];
  els.ghostPanel.classList.add("hidden");
}

// ── 음성: 귀신의 목소리(TTS) · 말로 두기(STT) ───────────────────
const SPEECH_LETTERS = {
  에이: "A", 비: "B", 씨: "C", 디: "D", 이: "E", 에프: "F", 지: "G",
  에이치: "H", 제이: "J", 케이: "K", 엘: "L", 엠: "M", 엔: "N", 오: "O",
  피: "P", 큐: "Q", 알: "R", 에스: "S", 티: "T",
};
const SPEECH_NUMBERS = {
  십구: 19, 십팔: 18, 십칠: 17, 십육: 16, 십오: 15, 십사: 14, 십삼: 13,
  십이: 12, 십일: 11, 십: 10, 구: 9, 팔: 8, 칠: 7, 육: 6, 오: 5, 사: 4,
  삼: 3, 이: 2, 일: 1,
};

function spokenLetter(tok) {
  if (/^[A-HJ-T]$/.test(tok)) return tok;
  return SPEECH_LETTERS[tok] || null;
}

function spokenNumber(tok) {
  if (/^\d{1,2}$/.test(tok)) return Number(tok);
  return SPEECH_NUMBERS[tok] ?? null;
}

function spokenCoord(letter, num) {
  if (!letter || !num) return null;
  const coord = `${letter}${num}`;
  const idx = coordIndex(coord, state.engine.size);
  return idx >= 0 ? { idx, coord } : null;
}

// "디 십육", "디사", "D16", "오 오"(O5)를 모두 읽는다.
// '이'(E/2), '오'(O/5)처럼 글자와 숫자가 겹치는 말은 자리(앞=글자, 뒤=숫자)로 가른다.
function parseSpokenCoord(text) {
  const tokens = String(text || "")
    .toUpperCase()
    .replace(/[.,!?~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!tokens.length) return null;

  for (let i = 0; i < tokens.length - 1; i++) {
    const hit = spokenCoord(spokenLetter(tokens[i]), spokenNumber(tokens[i + 1]));
    if (hit) return hit;
  }

  const letters = Object.entries(SPEECH_LETTERS).sort((a, b) => b[0].length - a[0].length);
  for (const tok of tokens) {
    for (const [k, v] of letters) {
      if (!tok.startsWith(k)) continue;
      const hit = spokenCoord(v, spokenNumber(tok.slice(k.length)));
      if (hit) return hit;
    }
    const m = /^([A-HJ-T])(\d{1,2})$/.exec(tok);
    if (m) {
      const hit = spokenCoord(m[1], Number(m[2]));
      if (hit) return hit;
    }
  }
  return null;
}

function updateVoiceButtons() {
  if (els.voiceToggleBtn) {
    els.voiceToggleBtn.textContent = state.voiceOn ? "음성 ON" : "음성 OFF";
    els.voiceToggleBtn.setAttribute("aria-pressed", state.voiceOn ? "true" : "false");
    els.voiceToggleBtn.title = speechSupported()
      ? "귀신의 대사를 한국어 음성으로 읽습니다."
      : "이 브라우저에는 음성 합성이 없습니다.";
  }
  if (els.micBtn) {
    els.micBtn.setAttribute("aria-pressed", state.micActive ? "true" : "false");
    els.micBtn.textContent = state.micActive ? "듣는 중…" : "말하기";
    els.micBtn.title = listenSupported()
      ? "말로 두기 — '디 사', '착수', '패스', '무르기'"
      : "이 브라우저는 음성 인식을 지원하지 않습니다.";
  }
}

function toggleVoice() {
  state.voiceOn = !state.voiceOn;
  setVoiceEnabled(state.voiceOn);
  updateVoiceButtons();
  if (state.voiceOn) speak("귀신의 목소리를 켰습니다.");
  else showToast("귀신의 목소리를 껐습니다.");
}

function handleVoiceCommand(text) {
  const raw = String(text || "").trim();
  if (!raw) return;
  const t = raw.replace(/\s+/g, "");
  showToast(`들은 말 · ${raw}`);
  if (/착수|놓아|둬|두어/.test(t)) {
    if (state.pending) confirmPending();
    else if (!isHumanTurn()) showToast("지금은 내 차례가 아닙니다.", true);
    else showToast("먼저 판에서 자리를 고르세요.", true);
    return;
  }
  if (/패스/.test(t)) {
    passTurn();
    return;
  }
  if (/무르기|되돌/.test(t)) {
    undoMove();
    return;
  }
  if (/힌트|귀신|도와/.test(t)) {
    askHint();
    return;
  }
  if (/취소|지워|없애/.test(t)) {
    cancelSound();
    clearSelection();
    return;
  }
  if (/새대국|새로|리셋/.test(t)) {
    newGame();
    return;
  }
  const coord = parseSpokenCoord(raw);
  if (coord) {
    if (!isHumanTurn()) {
      showToast("지금은 내 차례가 아닙니다.", true);
      return;
    }
    selectEmpty(coord.idx);
    speak(`${coord.coord} 자리입니다. 착수라고 말하거나 착수 버튼을 누르세요.`);
    return;
  }
  showToast("알아듣지 못했습니다. '디 사', '착수', '패스'처럼 말해 주세요.", true);
}

function startMic() {
  if (!listenSupported()) {
    showToast("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome에서 열어 주세요.", true);
    return;
  }
  if (state.micActive) {
    state.micRec?.stop?.();
    return;
  }
  initAudio();
  state.micActive = true;
  updateVoiceButtons();
  showToast("듣고 있습니다 — '디 사' → '착수'");
  state.micRec = listenKorean({
    onResult: (text) => {
      state.micRec = null;
      handleVoiceCommand(text);
    },
    onError: (err) => {
      state.micActive = false;
      updateVoiceButtons();
      showToast(`음성 인식 오류 · ${err}`, true);
    },
    onEnd: () => {
      state.micActive = false;
      state.micRec = null;
      updateVoiceButtons();
    },
  });
  if (!state.micRec) {
    state.micActive = false;
    updateVoiceButtons();
  }
}

function buildGhostLine(max = 3) {
  const e = state.engine;
  if (e.gameOver) return [];
  const sim = e.cloneFast();
  const rng = makeRng(((Date.now() ^ 0x9e3779b9) ^ (e.moveNumber * 2654435761)) >>> 0);
  const line = [];
  for (let p = 0; p < max; p++) {
    const cands = candidateMoves(sim, rng);
    let idx = cands.length ? cands[0].stone : null;
    if (idx === null) {
      const legal = sim.legalMoves({ fast: true });
      idx = legal.length ? legal[0] : null;
    }
    if (idx === null) break;
    const color = sim.turn;
    const r = sim.playFast(idx);
    if (!r.ok) break;
    line.push({ idx, color, n: p + 1, coord: coordName(idx, e.size) });
  }
  return line;
}

function askHint() {
  if (!state.story) {
    const line = buildGhostLine(3);
    if (line.length) {
      state.ghostLine = line;
      renderKifu();
      if (state.graph) state.graph.restyle();
      const c = line[0];
      ghostSpeak(`지금은 ${c.coord} 부근이 좋아 보여. 기보 그래프에 내가 읽은 세 수를 그려 뒀어.`);
    } else {
      ghostSpeak("지금은 둘 곳이 마땅치 않아. 패스도 한 수야.");
    }
    return;
  }
  const goals = scenarioSteps().filter((s) => s.role === "goal" || s.role === "choice");
  if (goals.length) {
    state.ghostLine = goals.slice(0, 3).map((s, i) => ({ idx: s.idx, color: s.color, n: i + 1, coord: s.coord }));
    renderKifu();
    if (state.graph) state.graph.restyle();
  }
  const hints = state.story.hints || [];
  if (!hints.length) return ghostSpeak("이 장면에는 더 말해 줄 게 없어. 네 직감을 믿어.");
  const idx = Math.min(state.hintIndex, hints.length - 1);
  state.hintIndex = Math.min(state.hintIndex + 1, hints.length);
  ghostSpeak(hints[idx]);
}

function finishStory(success) {
  if (!state.story || state.storyComplete || state.storyFailed) return;
  state.requestId++;
  state.aiThinking = false;
  const scene = state.story;
  state.futureMode = false;
  document.body.classList.remove("future-mode");
  clearFuture();
  if (success) {
    state.storyComplete = true;
    state.storyFailed = false;
    markCompleted(scene.id);
    state.pendingNext = nextScene(scene.id);
    winSound();
    const line = scene.after?.[0] || "좋은 수였어.";
    ghostSpeak(line);
    els.completeKicker.textContent = "장면 완료";
    els.completeTitle.textContent = `${scene.no} · ${scene.title}`;
    els.completeText.textContent = state.pendingNext
      ? `${line} 다음 장면에서 한 걸음 더 가 보자.`
      : `${line} 제1장이 끝났어. 이제 자유 대국에서도 같은 눈을 써 봐.`;
    els.completeNextBtn.classList.remove("hidden");
    els.completeNextBtn.textContent = state.pendingNext ? "다음 장면" : "자유 대국으로";
    els.completeRetryBtn.classList.add("hidden");
    els.completeTitleBtn.classList.remove("hidden");
  } else {
    state.storyComplete = false;
    state.storyFailed = true;
    state.pendingNext = null;
    loseSound();
    ghostSpeak("아직이야. 마지막 수를 기억해. 다시 두면 돼.");
    els.completeKicker.textContent = "패배";
    els.completeTitle.textContent = "아직, 끝이 아니야";
    els.completeText.textContent = "귀신은 지는 법도 가르쳐. 방금 만든 네 집과 잃은 집을 떠올려 봐. 같은 판을 다시 둘 수 있어.";
    els.completeNextBtn.classList.add("hidden");
    els.completeRetryBtn.classList.remove("hidden");
    els.completeTitleBtn.classList.remove("hidden");
  }
  els.storyComplete.classList.remove("hidden");
  updateUI();
}

function checkStoryGoal() {
  if (!state.story || state.storyComplete || state.storyFailed) return false;
  const scene = state.story;
  const e = state.engine;
  if (scene.goal?.type === "win") {
    if (!e.gameOver) return false;
    finishStory(e.result?.winner === state.humanColor);
    return true;
  }
  if (state.lastPlayWasHuman && isGoalMet(scene, e, state.lastPlayResult, state.humanColor)) {
    finishStory(true);
    return true;
  }
  if (e.gameOver) {
    finishStory(e.result?.winner === state.humanColor);
    return true;
  }
  return false;
}

function pickHeuristicMove(e) {
  const rng = makeRng((e.moveNumber * 2654435761 ^ 0x85ebca6b) >>> 0);
  const cands = candidateMoves(e, rng);
  if (cands.length) return cands[0].stone;
  const legal = e.legalMoves({ fast: true });
  return legal.length ? legal[0] : null;
}

function previewFuture(idx) {
  const e = state.engine;
  if (!isHumanTurn()) return showToast("지금은 네 차례가 아닙니다.", true);
  if (e.board[idx] !== EMPTY) return showToast("빈 교점을 골라 주세요.", true);
  if (!e.isLegal(idx, { fast: false })) return showToast("그 자리에는 둘 수 없습니다.", true);
  const color = e.turn;
  const sim = e.cloneFast();
  const r = sim.playFast(idx);
  if (!r.ok) return showToast("그 자리에는 둘 수 없습니다.", true);
  const line = [{ idx, color, n: 1 }];
  const rng = makeRng((idx * 2654435761 ^ e.moveNumber) >>> 0);
  for (let p = 0; p < 2; p++) {
    const candidates = candidateMoves(sim, rng);
    let move = candidates.length ? candidates[0].stone : null;
    if (move === null) {
      const legal = sim.legalMoves({ fast: true });
      move = legal.length ? legal[0] : null;
    }
    if (move === null) break;
    const c = sim.turn;
    const rr = sim.playFast(move);
    if (!rr.ok) break;
    line.push({ idx: move, color: c, n: p + 2 });
  }
  const before = e.score("area");
  const after = sim.score("area");
  const rng2 = makeRng((e.moveNumber * 2246822519 ^ 0x27d4eb2f) >>> 0);
  const cands = candidateMoves(e, rng2);
  const rank = cands.findIndex((c) => c.stone === idx) + 1;
  const token = ++state.futureToken;
  state.future = { candidate: idx, line, before, after, rank, total: cands.length, gpu: null };
  state.futureSet = new Map(line.map((m) => [m.idx, m.color]));
  syncBoard3D();
  renderFuturePanel();
  renderKifu();
  if (state.graph) state.graph.restyle();
  futureSound();
  if (state.influence) {
    state.influence.run(e.board, e.size, { idx, color }).then((info) => {
      if (token !== state.futureToken || !state.future) return;
      state.future.gpu = info;
      renderFuturePanel();
      renderGpuFacts();
    }).catch(() => {});
  }
}

function diffLabel(d) {
  const v = Number(d) || 0;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

function renderFuturePanel() {
  const f = state.future;
  if (!f) {
    els.futurePanel.classList.add("hidden");
    return;
  }
  const e = state.engine;
  els.futurePanel.classList.remove("hidden");
  els.futureRank.textContent = f.rank > 0 ? `추천 ${f.rank}/${f.total}` : "후보 밖";
  els.futureLine.innerHTML = f.line
    .map((m) => `<span class="mv ${m.color === BLACK ? "black" : "white"}"><i></i>${m.n}. <b>${coordName(m.idx, e.size)}</b></span>`)
    .join("");
  const delta = f.after.diff - f.before.diff;
  const humanAfter = state.humanColor === BLACK ? f.after.diff : -f.after.diff;
  const humanBefore = state.humanColor === BLACK ? f.before.diff : -f.before.diff;
  const gpu = f.gpu ? `${f.gpu.backend} · ${f.gpu.ms} ms` : "계산 중…";
  els.futureScore.innerHTML =
    `지금 형세 <b>${diffLabel(humanBefore)}</b> → 세 수 뒤 <b>${diffLabel(humanAfter)}</b><br>` +
    `변화 <b>${diffLabel(state.humanColor === BLACK ? delta : -delta)}</b> · GPU 영향도 <span>${gpu}</span>`;
}

function confirmFuture() {
  if (!state.future) return;
  const idx = state.future.candidate;
  setFutureMode(false);
  playHuman(idx, { confirmed: true });
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

function panForIdx(idx) {
  const size = state.engine.size;
  const x = idx % size;
  return ((x / Math.max(1, size - 1)) * 2 - 1) * 0.45;
}

function syncBoard3D() {
  if (!state.board3d) return;
  const e = state.engine;
  state.board3d.sync({
    board: e.board,
    size: e.size,
    lastMove: e.lastMove,
    selected: state.selected?.idx ?? null,
    pending: state.pending,
    future: state.future,
    kifuDemo: state.kifuDemo,
    showcase: state.titleVisible ? TITLE_SHOWCASE : null,
    showcaseLast: state.titleVisible ? TITLE_SHOWCASE_LAST : null,
  });
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
  syncBoard3D();
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
  const mode = effectiveViewMode();
  const has3d = !!state.board3d && mode !== "graph";
  const fm = state.future?.line?.find((m) => m.idx === idx);
  if (fm) {
    const ghostBlack = fm.color === BLACK;
    const isCandidate = state.future?.candidate === idx;
    if (has3d) {
      // 미래 수는 3D 반투명 돌로 그린다. 겹침 모드에서는 온톨로지 링도 함께 보인다.
      if (mode === "overlay") {
        return isCandidate
          ? { color: "#eafff8", alpha: 0.9, size: 11, hot: true }
          : { color: ghostBlack ? "#7de2ff" : "#ffb7e8", alpha: 0.34, size: 8, hot: false };
      }
      return isCandidate
        ? { color: "#eafff8", alpha: 0.32, size: 7.5, hot: true }
        : { color: "#7de2ff", alpha: 0, size: 0, hot: false };
    }
    return {
      color: isCandidate ? "#ffffff" : ghostBlack ? "#7de2ff" : "#ffb7e8",
      alpha: isCandidate ? 0.98 : 0.78,
      size: isCandidate ? 8.2 : 15.5,
      hot: isCandidate,
    };
  }
  let color = "#2bd6b0";
  let alpha = 0.2;
  let sizePx = 3.2;

  if (stone === BLACK) {
    color = selected ? "#a8d4ff" : last ? "#bfe1ff" : "#4aa8ff";
    if (mode === "overlay") {
      return { color, alpha: selected ? 0.65 : atari ? 0.55 : 0.3, size: selected ? 22 : atari ? 24 : last ? 17 : 12.5, hot: atari };
    }
    alpha = 0.95;
    sizePx = selected ? 21.5 : last ? 20 : 17.5;
    if (has3d) {
      return atari
        ? { color: "#ff5a5a", alpha: 0.5, size: 27, hot: true }
        : { color, alpha: 0, size: 0, hot: false };
    }
    return { color, alpha, size: sizePx, hot: atari };
  }
  if (stone === WHITE) {
    color = selected ? "#ffe9b8" : last ? "#ffe9b8" : "#ffcf6a";
    if (mode === "overlay") {
      return { color, alpha: selected ? 0.65 : atari ? 0.55 : 0.3, size: selected ? 22 : atari ? 24 : last ? 17 : 12.5, hot: atari };
    }
    alpha = 0.95;
    sizePx = selected ? 21.5 : last ? 20 : 17.5;
    if (has3d) {
      return atari
        ? { color: "#ff5a5a", alpha: 0.5, size: 27, hot: true }
        : { color, alpha: 0, size: 0, hot: false };
    }
    return { color, alpha, size: sizePx, hot: atari };
  }

  // 빈 교점
  const star = isStarPoint(size, x, y);
  if (star) {
    color = "#3cb9a6";
    alpha = mode === "overlay" ? 0.22 : 0.38;
    sizePx = mode === "overlay" ? 3 : 4.4;
  }
  const terr = state.territoryOn && state.territoryOwner ? state.territoryOwner[idx] : 0;
  let infShown = false;
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
      infShown = true;
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
  // AI·귀신의 후보 — 온톨로지 위에 '생각하는 점'으로 떠오른다.
  const cand = mode === "board" ? null : candidateAt(idx);
  if (cand) {
    const rank = cand.rank ?? 0;
    color = state.aiThinking ? "#9d7bff" : "#7df5d4";
    alpha = 0.95 - rank * 0.09;
    sizePx = 8.5 - rank * 0.85;
    if (e.ko === idx) color = "#ff4fd8";
    return { color, alpha, size: sizePx, hot: rank === 0 };
  }
  if (e.ko === idx) {
    color = "#ff4fd8";
    alpha = 0.95;
    sizePx = 6.6;
  }
  if (selected) {
    color = "#ffffff";
    alpha = 0.95;
    sizePx = 5.6;
  }
  if (mode === "overlay" && !(selected || e.ko === idx || terr || infShown || star)) {
    return { color, alpha: 0, size: 0, hot: false };
  }
  if (has3d && !(selected || e.ko === idx || terr || infShown || cand)) {
    return { color, alpha: 0, size: 0, hot: false };
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
  const fm = state.future?.line?.find((m) => m.idx === idx);
  if (fm) text += ` · <span style='color:#c9b8ff'>미래 ${fm.n}수 ${fm.color === BLACK ? "흑" : "백"}</span>`;
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
    const cand = candidateAt(idx);
    if (cand) text += ` · <span style='color:#7df5d4'>후보 ${(cand.rank ?? 0) + 1}위 (${cand.score ?? "—"})</span>`;
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
    return { visible: true, color: "#2bd6b0", alpha: 0.5, width: 0.45, particles: 0 };
  }
  const mode = effectiveViewMode();
  if (mode === "overlay") {
    // 판 위에 격자 온톨로지를 아주 옅게 깐다. 돌집단 선만 실제로 읽힌다.
    return { visible: true, color: "#1fb9a4", alpha: 0.05, width: 0.08, particles: 0 };
  }
  if (mode === "graph") {
    return { visible: true, color: "#1fb9a4", alpha: aStone || bStone ? 0.26 : 0.16, width: 0.2, particles: 0 };
  }
  if (state.board3d) return { visible: false, color: "#2bd6b0", alpha: 0, width: 0, particles: 0 };
  return { visible: true, color: "#1fb9a4", alpha: 0.3, width: 0.2, particles: 0 };
}

function setShowcase(on) {
  const c = state.graph?.controls?.();
  if (!c) return;
  c.autoRotate = !!on;
  c.autoRotateSpeed = 0.32;
}

// ── 보기 모드: 판 / 겹침 / 그래프
// 겹침(overlay)은 나무 판 위에 온톨로지 링크와 돌 노드를 얹는다.
// 그래프(graph)는 판을 잠시 숨기고 361노드 온톨로지를 그대로 보여 준다.
function effectiveViewMode() {
  if (state.titleVisible) return "board";
  return state.viewMode || "overlay";
}

function applyViewMode(mode, opts = {}) {
  let next = ["board", "overlay", "graph"].includes(mode) ? mode : "overlay";
  if (state.titleVisible && !opts.force) next = "board";
  state.viewMode = next;
  document.body.classList.toggle("view-board", next === "board");
  document.body.classList.toggle("view-overlay", next === "overlay");
  document.body.classList.toggle("view-graph", next === "graph");
  if (state.board3d?.group) state.board3d.group.visible = next !== "graph";
  if (state.graph?.setDepthTest) state.graph.setDepthTest(next === "overlay");
  for (const b of document.querySelectorAll(".stage-btn[data-view]")) {
    b.classList.toggle("is-on", b.dataset.view === next);
    b.setAttribute("aria-pressed", b.dataset.view === next ? "true" : "false");
  }
  if (state.graph) state.graph.restyle();
  renderKifu();
  if (opts.fit !== false) {
    if (next === "graph") fitGraph(opts.ms ?? 700);
    else fitBoard(opts.ms ?? 700);
  }
}

function fitGraph(ms = 700) {
  if (!state.graph) return;
  state.graph.resize();
  state.graph.zoomToFit(ms, 110, (n) => isNodeOnBoard(n, state.engine.size));
  const c = state.graph.controls?.();
  if (c) c.autoRotate = false;
}

function setFocusMode(on) {
  state.focusMode = !!on;
  document.body.classList.toggle("focus-mode", state.focusMode);
  els.focusBtn.setAttribute("aria-pressed", state.focusMode ? "true" : "false");
  setTimeout(() => {
    if (effectiveViewMode() === "graph") fitGraph(500);
    else fitBoard(500);
  }, 30);
}

function setKifuOpen(on) {
  state.kifuOpen = !!on;
  els.kifuFloatPanel.classList.toggle("hidden", !state.kifuOpen);
  els.kifuToggleBtn.setAttribute("aria-pressed", state.kifuOpen ? "true" : "false");
  if (state.kifuOpen) renderKifu();
}

function setRightTab(name) {
  state.rightTab = ["onto", "kifu", "ai"].includes(name) ? name : "onto";
  for (const b of document.querySelectorAll(".right-tab")) b.classList.toggle("is-on", b.dataset.tab === state.rightTab);
  for (const p of document.querySelectorAll(".right-pane")) p.classList.toggle("is-on", p.dataset.pane === state.rightTab);
}

function activeCandidates() {
  if (state.aiThinking && state.thinkingCandidates.length) return state.thinkingCandidates;
  if (isHumanTurn() && state.liveCandidates.length) return state.liveCandidates;
  if (Array.isArray(state.lastAI?.candidates) && state.lastAI.candidates.length) return state.lastAI.candidates;
  return [];
}

function candidateAt(idx) {
  const list = activeCandidates();
  for (let i = 0; i < list.length && i < 5; i++) {
    if (list[i].idx === idx) return { ...list[i], rank: i };
  }
  return null;
}

function refreshLiveCandidates() {
  const e = state.engine;
  if (state.titleVisible || e.gameOver || !isHumanTurn()) {
    state.liveCandidates = [];
    state.liveCandidateKey = "";
    return;
  }
  const key = `${e.size}:${e.moveNumber}:${e.turn}:${e.hashes?.[e.hashes.length - 1] ?? 0}`;
  if (key === state.liveCandidateKey) return;
  state.liveCandidateKey = key;
  try {
    const rng = makeRng((e.moveNumber * 2654435761 ^ 0x1f123bb5) >>> 0);
    const list = candidateMoves(e, rng).slice(0, 6).map((c, i) => ({
      idx: c.stone,
      coord: c.coord || coordName(c.stone, e.size),
      score: +c.score.toFixed(2),
      liberties: c.liberties,
      captured: c.captured,
      color: e.turn,
      rank: i,
    }));
    state.liveCandidates = list;
  } catch (err) {
    state.liveCandidates = [];
  }
}

function scenarioSteps() {
  const scene = state.story;
  if (!scene) return [];
  const size = state.engine.size;
  return (scene.teaching || []).map((t) => ({
    ...t,
    idx: coordIndex(t.at, size),
    coord: t.at,
  })).filter((t) => t.idx >= 0);
}

function renderKifu() {
  if (!els.kifuGraph) return;
  const opts = {
    moves: state.moveLog,
    future: state.future,
    ghost: state.ghostLine,
    ai: activeCandidates(),
    teaching: scenarioSteps().filter((s) => s.role === "goal" || s.role === "choice"),
    engine: state.engine,
    size: state.engine.size,
  };
  drawKifu(els.kifuGraph, opts);
  if (state.kifuOpen && els.kifuFloat) drawKifu(els.kifuFloat, opts);
  const f = state.future?.line?.length ? ` · 미래 ${state.future.line.length}수` : "";
  const g = state.ghostLine.length ? ` · 귀신 ${state.ghostLine.length}수` : "";
  const txt = `${state.moveLog.length}수${f}${g}`;
  if (els.kifuStatus) els.kifuStatus.textContent = txt;
  if (els.kifuFloatStatus) els.kifuFloatStatus.textContent = txt;
}

function renderScenario() {
  if (!els.scenarioPanel) return;
  const show = !!state.story && state.scenarioOpen;
  els.scenarioPanel.classList.toggle("hidden", !show);
  els.scenarioToggleBtn?.setAttribute("aria-pressed", show ? "true" : "false");
  if (!show) return;
  const scene = state.story;
  const steps = scenarioSteps();
  if (els.scenarioTitle) els.scenarioTitle.textContent = `${scene.no} · ${scene.title}`;
  drawScenario(els.scenarioGraph, {
    steps,
    engine: state.engine,
    size: state.engine.size,
    turn: state.engine.turn,
    moves: state.moveLog,
  });
  if (els.scenarioSteps) {
    const focus = steps.filter((s) => s.role === "goal" || s.role === "choice");
    els.scenarioSteps.innerHTML = focus.map((s) => {
      const played = state.moveLog.some((m) => m.coord === s.coord);
      const onBoard = state.engine.board[s.idx] === s.color;
      const stateText = played || onBoard ? "이미 둠" : "목표";
      return `<button type="button" class="scenario-chip ${played || onBoard ? "done" : ""}" data-idx="${s.idx}" data-coord="${s.coord}">` +
        `<i class="${s.color === WHITE ? "w" : "b"}"></i><b>${s.coord}</b><span>${s.label || stateText}</span></button>`;
    }).join("");
  }
}

// ── 기보 데이터베이스 — 온톨로지 분류 · 판 위 도해 ─────────────────
function renderKifuDb() {
  if (!els.kifuDbList) return;
  const cat = state.kifuDbCat || "all";
  if (els.kifuDbCats) {
    els.kifuDbCats.innerHTML = KIFU_CATEGORIES.map((c) => {
      const n = c.id === "all" ? KIFU_DB.length : KIFU_DB.filter((r) => r.category === c.id).length;
      return `<button type="button" class="kdb-cat ${c.id === cat ? "is-on" : ""}" data-cat="${c.id}">${c.label}<span>${n}</span></button>`;
    }).join("");
  }
  const records = cat === "all" ? KIFU_DB : KIFU_DB.filter((r) => r.category === cat);
  els.kifuDbList.innerHTML = records.map((r) => {
    const catLabel = KIFU_CATEGORIES.find((c) => c.id === r.category)?.label || r.category;
    return `<button type="button" class="kdb-item ${r.id === state.kifuRecordId ? "is-on" : ""}" data-record="${r.id}">` +
      `<span class="kdb-cat-tag">${catLabel}</span>` +
      `<b>${r.title}</b>` +
      `<em>${r.concepts.slice(0, 3).join(" · ")}</em>` +
      `</button>`;
  }).join("") || `<p class="muted">기록이 없습니다.</p>`;

  const rec = recordById(state.kifuRecordId);
  if (!els.kifuDbDetail) return;
  if (!rec) {
    els.kifuDbDetail.className = "kdb-detail muted";
    els.kifuDbDetail.textContent = "기보를 고르면 판 위에 착수 형태로 겹쳐 보여 줍니다.";
    return;
  }
  els.kifuDbDetail.className = "kdb-detail";
  els.kifuDbDetail.innerHTML =
    `<div class="kdb-preview"></div>` +
    `<div class="kdb-info">` +
      `<b>${rec.title}</b><span>${rec.subtitle}</span>` +
      `<div class="kdb-tags">${rec.concepts.map((c) => `<i>${c}</i>`).join("")}</div>` +
      `<p>${rec.note}</p>` +
      `<div class="kdb-rel">${rec.relations.map((r) => `<em>${r.from} → ${r.to} <small>${r.rel}</small></em>`).join("")}</div>` +
      `<div class="kdb-actions"><button id="kifuDemoBtn" class="btn small primary" type="button">판에 겹쳐 보기</button>` +
      `<button id="kifuDemoClearBtn" class="btn small" type="button">도해 지우기</button></div>` +
    `</div>`;
  const host = els.kifuDbDetail.querySelector(".kdb-preview");
  if (host) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "kdb-board");
    host.append(svg);
    drawKifuBoard(svg, rec, 19);
  }
  els.kifuDbDetail.querySelector("#kifuDemoBtn")?.addEventListener("click", () => previewKifuRecord(rec.id));
  els.kifuDbDetail.querySelector("#kifuDemoClearBtn")?.addEventListener("click", () => clearKifuDemo());
}

function previewKifuRecord(id) {
  const rec = recordById(id);
  if (!rec) return;
  state.kifuRecordId = id;
  if (state.engine.size !== 19) {
    state.kifuDemo = null;
    syncBoard3D();
    renderKifuDb();
    showToast("이 도해는 19줄 판에서 겹쳐 볼 수 있습니다.", true);
    return;
  }
  const line = rec.moves.slice(0, 6).map((mv, i) => ({
    idx: dbCoordIndex(mv.coord, 19),
    coord: mv.coord,
    color: mv.color,
    n: i + 1,
  })).filter((m) => m.idx >= 0);
  state.kifuDemo = { recordId: id, title: rec.title, line };
  state.selected = null;
  state.pending = null;
  renderPlacePanel();
  clearFuture(false);
  syncBoard3D();
  renderKifuDb();
  if (state.graph) state.graph.restyle();
  if (state.viewMode === "graph") applyViewMode("overlay", { ms: 420 });
  showToast(`${rec.title} · ${line.length}수를 판 위에 앉혔습니다.`);
  speak(`${rec.title}. ${rec.subtitle}`);
}

function clearKifuDemo() {
  state.kifuDemo = null;
  syncBoard3D();
  renderKifuDb();
  showToast("도해를 지웠습니다.");
}

function onGraphPanelPick(ev) {
  const g = ev.target.closest?.("[data-idx]");
  if (!g) return;
  const idx = Number(g.dataset.idx);
  if (!Number.isInteger(idx) || idx < 0) return;
  if (state.engine.board[idx] !== EMPTY) selectStone(idx);
  else if (state.futureMode) previewFuture(idx);
  else selectEmpty(idx);
  const coord = g.dataset.coord || coordName(idx, state.engine.size);
  showToast(`${coord} · ${state.engine.board[idx] === BLACK ? "흑" : state.engine.board[idx] === WHITE ? "백" : "빈 교점"}`);
}

function fitBoard(ms = 700) {
  if (!state.graph) return;
  const size = state.engine.size;
  const r = els.graph.getBoundingClientRect();
  const aspect = (r.width || 1) / (r.height || 1);
  const half = state.board3d?.halfFor(size) ?? ((size - 1) * SPACING) / 2 + SPACING * 0.9;
  const fovDeg = state.graph.camera?.()?.fov || 42;
  const fov = (fovDeg * Math.PI) / 180;
  // 자유 대국은 옆 패널과 함께 보이므로 판을 조금 더 크게 채운다.
  const fit = state.story || state.titleVisible ? 1.36 : 1.24;
  let dist = (half * fit) / Math.tan(fov / 2);
  if (aspect < 1) dist *= 1 / Math.max(aspect, 0.66);
  dist += 30;
  state.graph.resize();
  // 3/4 시점. 왼쪽 모서리와 앞 두께가 함께 보여 '판 위에 놓인 나무'로 읽힌다.
  state.graph.cameraPosition(
    { x: -dist * 0.18, y: -dist * 0.3, z: dist * 0.95 },
    { x: 0, y: -30, z: -6 },
    ms,
  );
  updateBoardOverlay();
}

// 타이틀 전용 히어로 시점. 상판이 아니라 판의 두께와 옆면까지 보이도록
// 낮게 앉혀, 나무 한 덩어리 위에 놓인 돌이라는 인상을 만든다.
function fitTitleBoard(ms = 900) {
  if (!state.graph) return;
  const size = state.engine.size;
  const r = els.graph.getBoundingClientRect();
  const aspect = (r.width || 1) / (r.height || 1);
  const half = state.board3d?.halfFor(size) ?? ((size - 1) * SPACING) / 2 + SPACING * 0.9;
  const fovDeg = state.graph.camera?.()?.fov || 42;
  const fov = (fovDeg * Math.PI) / 180;
  let dist = (half * 1.62) / Math.tan(fov / 2);
  if (aspect < 1) dist *= 1 / Math.max(aspect, 0.66);
  dist += 40;
  state.graph.resize();
  state.graph.cameraPosition(
    { x: -dist * 0.3, y: -dist * 0.52, z: dist * 0.7 },
    { x: -half * 0.3, y: -half * 0.08, z: -8 },
    ms,
  );
}

// 그래프 캔버스와 같은 카메라로 바둑판 격자를 SVG에 투영한다.
// WebGPU/WebGL 양쪽에서 보드가 '점'이 아니라 '판'으로 읽히게 하는 최소 장치.
const SVG_NS = "http://www.w3.org/2000/svg";
let overlaySize = 0;
let overlayDefs = [];
let overlayFrame = null;
const overlayV = new Vector3();

function ensureBoardOverlay() {
  const size = state.engine.size;
  if (overlaySize === size || !els.boardOverlay) return;
  overlaySize = size;
  els.boardOverlay.replaceChildren();
  overlayDefs = [];
  overlayFrame = document.createElementNS(SVG_NS, "rect");
  overlayFrame.setAttribute("class", "frame");
  overlayFrame.setAttribute("fill", "none");
  overlayFrame.setAttribute("stroke", "rgba(224,176,112,0.32)");
  overlayFrame.setAttribute("stroke-width", "1.4");
  els.boardOverlay.append(overlayFrame);

  const add = (ax, ay, bx, by, frame) => {
    const line = document.createElementNS(SVG_NS, "line");
    if (frame) line.setAttribute("class", "frame");
    els.boardOverlay.append(line);
    overlayDefs.push({
      line,
      a: graphIndexForEngine(size, ay * size + ax),
      b: graphIndexForEngine(size, by * size + bx),
    });
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size - 1; x++) add(x, y, x + 1, y, y === 0 || y === size - 1);
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size - 1; y++) add(x, y, x, y + 1, x === 0 || x === size - 1);
  }
}

function projectBoardNode(node, cam, rect) {
  overlayV.set(node.x || 0, node.y || 0, node.z || 0).project(cam);
  return {
    x: (overlayV.x * 0.5 + 0.5) * rect.width,
    y: (-overlayV.y * 0.5 + 0.5) * rect.height,
  };
}

function updateBoardOverlay() {
  if (state.board3d) return;
  if (!state.graph || !state.ontology || !els.boardOverlay) return;
  ensureBoardOverlay();
  if (!overlayDefs.length) return;
  const cam = state.graph.camera();
  const rect = els.graph.getBoundingClientRect();
  if (!cam || rect.width < 2 || rect.height < 2) return;
  cam.updateMatrixWorld();
  if (cam.updateProjectionMatrix) cam.updateProjectionMatrix();
  const nodes = state.graph.graphData?.().nodes || state.ontology.nodes;
  for (const d of overlayDefs) {
    const a = nodes[d.a], b = nodes[d.b];
    if (!a || !b) continue;
    const pa = projectBoardNode(a, cam, rect);
    const pb = projectBoardNode(b, cam, rect);
    d.line.setAttribute("x1", pa.x.toFixed(2));
    d.line.setAttribute("y1", pa.y.toFixed(2));
    d.line.setAttribute("x2", pb.x.toFixed(2));
    d.line.setAttribute("y2", pb.y.toFixed(2));
  }
  const size = state.engine.size;
  const corners = [0, size - 1, size * (size - 1), size * size - 1]
    .map((idx) => nodes[graphIndexForEngine(size, idx)])
    .filter(Boolean)
    .map((n) => projectBoardNode(n, cam, rect));
  if (corners.length && overlayFrame) {
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    overlayFrame.setAttribute("x", Math.min(...xs).toFixed(2));
    overlayFrame.setAttribute("y", Math.min(...ys).toFixed(2));
    overlayFrame.setAttribute("width", (Math.max(...xs) - Math.min(...xs)).toFixed(2));
    overlayFrame.setAttribute("height", (Math.max(...ys) - Math.min(...ys)).toFixed(2));
  }
}

function selectStone(idx) {
  const g = state.stoneGroup.get(idx);
  if (!g) return;
  state.selected = { type: "stone", idx, group: g };
  state.selectedSet = new Set(g.stones);
  state.pending = null;
  renderPlacePanel();
  renderGroupFacts();
  syncBoard3D();
  if (state.graph) state.graph.restyle();
}

// 빈 교점을 고르면 곧바로 두지 않는다. 그 자리에 돌을 앉혀 보여 주고,
// '착수' 버튼을 눌렀을 때 돌소리와 함께 실제로 둔다. 다른 바둑 앱의 결.
function selectEmpty(idx) {
  state.selected = { type: "empty", idx };
  state.selectedSet = new Set([idx]);
  const e = state.engine;
  const canStage = !isGameOver() && isHumanTurn() && e.board[idx] === EMPTY
    && !state.futureMode && e.isLegal(idx, { fast: false });
  state.pending = canStage ? { idx, color: e.turn } : null;
  if (canStage) {
    state.kifuDemo = null;
    selectSound(panForIdx(idx));
  }
  renderPlacePanel();
  renderGroupFacts();
  syncBoard3D();
  if (state.graph) state.graph.restyle();
}

function clearSelection() {
  state.selected = null;
  state.selectedSet = new Set();
  state.pending = null;
  renderPlacePanel();
  renderGroupFacts();
  syncBoard3D();
  if (state.graph) state.graph.restyle();
}

function renderPlacePanel() {
  if (!els.placePanel) return;
  const p = state.pending;
  els.placePanel.classList.toggle("hidden", !p);
  if (!p) return;
  if (els.placeCoord) els.placeCoord.textContent = coordName(p.idx, state.engine.size);
  if (els.placeStone) {
    els.placeStone.classList.toggle("black", p.color === BLACK);
    els.placeStone.classList.toggle("white", p.color === WHITE);
  }
  const who = p.color === BLACK ? "흑" : "백";
  els.placeCoord?.setAttribute("title", `${who} ${coordName(p.idx, state.engine.size)}`);
}

function confirmPending() {
  const p = state.pending;
  if (!p) return;
  if (!isHumanTurn()) {
    showToast("지금은 내 차례가 아닙니다.", true);
    return;
  }
  const idx = p.idx;
  state.pending = null;
  renderPlacePanel();
  playHuman(idx, { confirmed: true });
}

function logPlay(res, silent = false) {
  state.moveLog.push({
    number: res.moveNumber,
    color: res.color,
    idx: res.idx,
    pass: false,
    coord: coordName(res.idx, state.engine.size),
    captured: res.captured.length,
  });
  if (silent) return;
  if (res.captured.length) captureSound(res.captured.length);
  else stoneSound(res.color, panForIdx(res.idx));
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

function playHuman(idx, opts = {}) {
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
  state.lastPlayResult = res;
  state.lastPlayWasHuman = true;
  state.pending = null;
  state.kifuDemo = null;
  renderPlacePanel();
  clearFuture(false);
  logPlay(res, true);
  // 실제로 돌이 판에 닿는 순간의 소리. 버튼으로 둔 수는 나무를 한 번 더 두드린다.
  if (opts.confirmed) placeSound(res.color, panForIdx(idx));
  else stoneSound(res.color, panForIdx(idx));
  if (res.captured.length) captureSound(res.captured.length);
  afterMove();
}

function afterMove() {
  state.selected = null;
  state.selectedSet = new Set();
  state.pending = null;
  state.ghostLine = [];
  state.thinkingCandidates = [];
  state.liveCandidates = [];
  state.liveCandidateKey = "";
  state.kifuDemo = null;
  renderPlacePanel();
  clearFuture(false);
  refreshBoardState();
  const e = state.engine;
  if (state.graph && e.lastMove !== null && e.lastMove !== undefined) {
    const n = state.ontology.nodes[graphIndexForEngine(e.size, e.lastMove)];
    if (n) state.graph.fire(n);
  }
  updateUI();
  if (state.influenceOn) refreshInfluence();
  if (state.story) {
    if (checkStoryGoal()) return;
  }
  if (!e.gameOver) setTimeout(() => maybeAI(), 140);
}

function maybeAI() {
  const e = state.engine;
  if (!state.booted || state.aiThinking || e.gameOver || state.mode !== "ai") return;
  if (e.turn !== aiColor()) return;
  state.aiThinking = true;
  try {
    const rng = makeRng(((Date.now() ^ (e.moveNumber * 2654435761)) >>> 0));
    state.thinkingCandidates = candidateMoves(e, rng).slice(0, 6).map((c, i) => ({
      idx: c.stone,
      coord: c.coord || coordName(c.stone, e.size),
      score: +c.score.toFixed(2),
      liberties: c.liberties,
      captured: c.captured,
      color: e.turn,
      rank: i,
    }));
  } catch (err) {
    state.thinkingCandidates = [];
  }
  const id = ++state.requestId;

  // 스토리 장면의 상대는 대본대로 둔다. 대본이 막히면 AI로 넘어간다.
  if (state.story?.opponent?.kind === "scripted") {
    updateUI();
    setTimeout(() => {
      if (id !== state.requestId || !state.story || state.engine !== e || e.gameOver) {
        state.aiThinking = false;
        updateUI();
        return;
      }
      const script = state.story.opponent.moves || [];
      let res = null;
      for (let k = state.storyScriptIndex; k < script.length; k++) {
        const idx = coordIndex(script[k], e.size);
        if (idx >= 0 && e.board[idx] === EMPTY && e.isLegal(idx, { fast: false })) {
          state.storyScriptIndex = k + 1;
          res = e.play(idx);
          break;
        }
      }
      if (!res || !res.ok) {
        const fallback = pickHeuristicMove(e);
        if (fallback !== null) res = e.play(fallback);
      }
      state.aiThinking = false;
      if (res?.ok) {
        state.lastPlayResult = res;
        state.lastPlayWasHuman = false;
        state.lastAI = { reason: "scripted", elapsed: 0 };
        logPlay(res);
      }
      afterMove();
    }, 520);
    return;
  }

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
    state.lastPlayResult = res.ok ? res : null;
    state.lastPlayWasHuman = false;
    afterMove();
    return;
  }
  const res = e.play(result.move);
  if (!res.ok) {
    // 상태가 바뀌었거나 엔진이 거부한 경우 — 같은 상태에서 합법수로 대체
    const legal = e.legalMoves({ fast: true });
    let altRes = null;
    if (legal.length) {
      const alt = e.play(legal[0]);
      if (alt.ok) { logPlay(alt); altRes = alt; }
    } else {
      const p = e.pass();
      if (p.ok) logPass(p);
    }
    state.lastAI = result;
    state.lastPlayResult = altRes;
    state.lastPlayWasHuman = false;
    showToast(`AI 수가 거부되어 대체했습니다 (${REASON_NAME[res.reason] || res.reason})`, true);
    afterMove();
    return;
  }
  logPlay(res);
  state.lastAI = result;
  state.lastPlayResult = res;
  state.lastPlayWasHuman = false;
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
  state.lastPlayResult = res;
  state.lastPlayWasHuman = true;
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
  state.lastPlayResult = res;
  state.lastPlayWasHuman = true;
  updateUI();
  if (state.influenceOn) refreshInfluence();
  if (state.story && !state.storyComplete && !state.storyFailed) checkStoryGoal();
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
  state.story = null;
  state.storyComplete = false;
  state.storyFailed = false;
  state.pendingNext = null;
  state.titleVisible = false;
  state.hintIndex = 0;
  resetTransient();
  els.storyHud.classList.add("hidden");
  els.storyComplete.classList.add("hidden");
  els.titleScreen.classList.add("hidden");
  els.ghostPanel.classList.add("hidden");
  document.body.classList.remove("title-mode", "story-mode");
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

function renderMatchHUD() {
  const e = state.engine;
  const human = state.humanColor;
  const story = state.story;
  if (els.dashBlack) {
    els.dashBlack.textContent = String(e.captures?.[BLACK] ?? 0);
    els.dashWhite.textContent = String(e.captures?.[WHITE] ?? 0);
  }
  if (els.blackName) {
    els.blackName.textContent = story
      ? human === BLACK ? "나 · 흑" : "묵 · 흑"
      : "흑";
    els.whiteName.textContent = story
      ? human === WHITE ? "나 · 백" : "묵 · 백"
      : "백";
    els.blackCaptures.textContent = String(e.captures?.[BLACK] ?? 0);
    els.whiteCaptures.textContent = String(e.captures?.[WHITE] ?? 0);
    els.blackPlate?.classList.toggle("active", !e.gameOver && e.turn === BLACK);
    els.whitePlate?.classList.toggle("active", !e.gameOver && e.turn === WHITE);
    els.blackPlate?.classList.toggle("mine", state.mode === "ai" && human === BLACK);
    els.whitePlate?.classList.toggle("mine", state.mode === "ai" && human === WHITE);
    if (els.boardStatus) {
      const last = e.lastMove !== null && e.lastMove !== undefined ? coordName(e.lastMove, e.size) : "—";
      const head = story ? `${story.chapter?.no || "제1장"} · ${story.no}` : "자유 대국";
      els.boardStatus.textContent = `${head} · ${e.size}줄 · ${e.moveNumber}수 · 최근 ${last}`;
    }
    if (els.medallionStone) {
      els.medallionStone.className = `medallion-stone ${e.turn === WHITE ? "white" : "black"}`;
      els.medallionText.textContent = e.gameOver
        ? "終"
        : state.aiThinking
          ? "읽는 중"
          : isHumanTurn()
            ? "착수"
            : "묵…";
    }
    document.body.classList.toggle("ai-turn", !e.gameOver && !isHumanTurn() && state.mode === "ai");
  }
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
  els.futureBtn.setAttribute("aria-pressed", state.futureMode ? "true" : "false");
  els.askBtn.disabled = state.titleVisible;
  els.futureBtn.disabled = state.titleVisible || !state.story && state.engine.gameOver;
  refreshLiveCandidates();
  if (state.story) {
    els.storyGoal.textContent = goalLabel(state.story);
    els.storyChapter.textContent = `${state.story.chapter?.no || "제1장"} · ${state.story.chapter?.title || ""} — ${state.story.no} ${state.story.title}`;
  }
  renderMatchHUD();
  renderScore();
  renderOntology();
  renderGroupFacts();
  renderAIFacts();
  renderMoves();
  renderKifu();
  renderScenario();
  renderGpuFacts();
  renderPlacePanel();
  syncBoard3D();
  if (state.graph) state.graph.restyle();
  if (e.gameOver) renderEndBanner();
  else showBanner("");
  els.aiStatus.textContent = state.story
    ? state.storyComplete
      ? "장면 완료 — 귀신이 고개를 끄덕였습니다."
      : state.aiThinking
        ? "묵이 수를 읽는 중…"
        : isHumanTurn()
          ? "묵이 지켜보고 있습니다."
          : "묵의 차례입니다."
    : state.aiThinking
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
  const live = state.aiThinking ? state.thinkingCandidates : (isHumanTurn() ? state.liveCandidates : []);
  if (state.aiThinking) {
    els.aiFacts.className = "facts";
    els.aiFacts.innerHTML = kv("상태", `수 읽는 중 · ${state.aiLevel}`) + kv("엔진", "포석 서 + 정적 평가 + 플레이아웃");
    if (state.thinkingCandidates.length) {
      els.aiFacts.innerHTML += `<h3>읽는 후보</h3>`;
      for (const c of state.thinkingCandidates.slice(0, 5)) {
        els.aiFacts.innerHTML += kv(c.coord || coordName(c.idx, state.engine.size), `평가 ${c.score ?? "—"}`);
      }
    }
    return;
  }
  if (live.length) {
    els.aiFacts.className = "facts";
    els.aiFacts.innerHTML = kv("차례", isHumanTurn() ? "내 차례 · 후보" : "AI") + kv("엔진", "포석 서 + 정적 평가");
    els.aiFacts.innerHTML += `<h3>지금 좋아 보이는 곳</h3>`;
    for (const c of live.slice(0, 5)) {
      const extra = c.captured ? `따냄 ${c.captured} · 활로 ${c.liberties}` : `활로 ${c.liberties}`;
      els.aiFacts.innerHTML += kv(c.coord || coordName(c.idx, state.engine.size), extra);
    }
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
  if (state.future?.gpu) {
    html += kv("미래 GPU", `${state.future.gpu.backend} · ${state.future.gpu.ms} ms`);
    html += kv("미래 후보", coordName(state.future.candidate, state.engine.size));
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
    const renderer = g.renderer();
    if (renderer) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
    }
    state.board3d = createBoard3D(g.scene(), {
      renderer,
      spacing: SPACING,
      size: state.engine.size,
    });
    g.onFrame((dt, now) => state.board3d?.update(dt, now));
    els.boardOverlay.style.display = "none";
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
    syncBoard3D();

    g.onNodeClick((n) => {
      if (state.titleVisible) return;
      const ctx = nodeContext(n);
      if (!ctx) return;
      if (state.engine.board[ctx.idx] !== EMPTY) {
        selectStone(ctx.idx);
        return;
      }
      if (state.futureMode) {
        previewFuture(ctx.idx);
        return;
      }
      if (isGameOver()) return selectEmpty(ctx.idx);
      if (state.mode === "ai" && (state.aiThinking || state.engine.turn !== state.humanColor)) {
        selectEmpty(ctx.idx);
        showToast("AI 차례입니다.", true);
        return;
      }
      // 자리를 먼저 고른다. 실제 착수는 '착수' 버튼(또는 Enter)에서.
      if (state.engine.board[ctx.idx] === EMPTY && !state.engine.isLegal(ctx.idx, { fast: false })) {
        showToast("그 자리에는 둘 수 없습니다.", true);
        selectEmpty(ctx.idx);
        return;
      }
      selectEmpty(ctx.idx);
      if (state.pending) showToast(`${coordName(ctx.idx, state.engine.size)} · '착수'를 누르면 돌이 놓입니다.`);
    });
    g.onBackgroundClick(() => {
      clearSelection();
      clearFuture();
      if (state.kifuDemo) {
        state.kifuDemo = null;
        syncBoard3D();
      }
    });

    state.booted = true;
    els.backendBadge.textContent = g.backend === "WebGPU" ? "WebGPU" : "WebGL2";
    els.backendBadge.className = `chip ${g.backend === "WebGPU" ? "" : "warn"}`;
    els.backendBadge.title = loader.ok
      ? `${loader.gpuBackend} · ${describeLoader(loader)}`
      : loader.reason || "WebGL2 폴백";

    loadProgress();
    startTitle();
    els.bootOverlay.classList.add("hidden");
    setInterval(() => {
      if (!state.graph) return;
      const st = state.graph.stats();
      els.fpsBadge.textContent = `${st.fps || 0} FPS`;
      els.fpsBadge.classList.toggle("dim", !st.fps);
    }, 1000);
    if (!state.board3d) {
      setInterval(updateBoardOverlay, 120);
      updateBoardOverlay();
    }
    window.__parksyGo = {
      engine: () => state.engine,
      graph: () => state.graph,
      board3d: () => state.board3d,
      state,
      newGame,
      startTitle,
      startStory: () => loadStoryScene(firstScene()),
      loadScene: (id) => loadStoryScene(sceneById(id)),
      startFree: startFreeMode,
      scenes: ALL_SCENES,
      play: (coord) => playHuman(coordIndex(coord, state.engine.size)),
      stage: (coord) => selectEmpty(coordIndex(coord, state.engine.size)),
      placePending: confirmPending,
      preview: (coord) => previewFuture(coordIndex(coord, state.engine.size)),
      confirm: confirmFuture,
      futureMode: setFutureMode,
      ask: askHint,
      fitBoard,
      fitTitleBoard,
      viewMode: (m) => applyViewMode(m, { ms: 400 }),
      fitGraph,
      kifu: () => renderKifu(),
      scenario: () => renderScenario(),
      setKifuOpen,
      setFocusMode,
      setRightTab,
    };
  } catch (e) {
    console.error(e);
    els.bootText.textContent = `부팅 실패: ${e.message}`;
    showBanner(`부팅 실패: ${e.message}`, true);
    els.bootOverlay.classList.remove("hidden");
  }
}

// ── UI 이벤트
els.newGameBtn.addEventListener("click", () => newGame());
els.placeConfirmBtn?.addEventListener("click", () => {
  initAudio();
  confirmPending();
});
els.placeCancelBtn?.addEventListener("click", () => {
  cancelSound();
  clearSelection();
});
els.voiceToggleBtn?.addEventListener("click", () => toggleVoice());
els.micBtn?.addEventListener("click", () => startMic());
els.kifuDbCats?.addEventListener("click", (ev) => {
  const b = ev.target.closest?.("[data-cat]");
  if (!b) return;
  state.kifuDbCat = b.dataset.cat;
  uiSound();
  renderKifuDb();
});
els.kifuDbList?.addEventListener("click", (ev) => {
  const b = ev.target.closest?.("[data-record]");
  if (!b) return;
  uiSound();
  previewKifuRecord(b.dataset.record);
});
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

// ── 게임 UI
els.titleBtn.addEventListener("click", () => startTitle());
els.storyExitBtn.addEventListener("click", () => startTitle());
els.startStoryBtn.addEventListener("click", () => loadStoryScene(firstScene()));
els.continueBtn.addEventListener("click", () => {
  const scene = nextUnfinishedScene() || firstScene();
  loadStoryScene(scene);
});
els.startFreeBtn.addEventListener("click", () => startFreeMode());
els.askBtn.addEventListener("click", () => askHint());
els.futureBtn.addEventListener("click", () => setFutureMode(!state.futureMode));
els.futurePlayBtn.addEventListener("click", () => confirmFuture());
els.futureCancelBtn.addEventListener("click", () => setFutureMode(false));
els.ghostNextBtn.addEventListener("click", () => ghostNext());
els.ghostCloseBtn.addEventListener("click", () => ghostClose());
els.completeNextBtn.addEventListener("click", () => {
  if (state.pendingNext) loadStoryScene(state.pendingNext);
  else startFreeMode();
});
els.completeRetryBtn.addEventListener("click", () => {
  if (state.story) loadStoryScene(state.story);
});
els.completeTitleBtn.addEventListener("click", () => startTitle());

// ── 그래프·기보 UI
for (const b of document.querySelectorAll(".stage-btn[data-view]")) {
  b.addEventListener("click", () => applyViewMode(b.dataset.view, { ms: 520 }));
}
for (const b of document.querySelectorAll(".right-tab")) {
  b.addEventListener("click", () => setRightTab(b.dataset.tab));
}
els.kifuToggleBtn?.addEventListener("click", () => setKifuOpen(!state.kifuOpen));
els.focusBtn?.addEventListener("click", () => setFocusMode(!state.focusMode));
els.kifuGraph?.addEventListener("click", onGraphPanelPick);
els.kifuFloat?.addEventListener("click", onGraphPanelPick);
els.scenarioGraph?.addEventListener("click", onGraphPanelPick);
els.scenarioSteps?.addEventListener("click", onGraphPanelPick);
els.scenarioCloseBtn?.addEventListener("click", () => {
  state.scenarioOpen = false;
  renderScenario();
});
els.scenarioToggleBtn?.addEventListener("click", () => {
  state.scenarioOpen = !state.scenarioOpen;
  renderScenario();
});
document.addEventListener("pointerdown", () => initAudio(), { once: true });
updateVoiceButtons();
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && state.pending) {
    ev.preventDefault();
    initAudio();
    confirmPending();
    return;
  }
  if (ev.key === "Escape") {
    if (state.pending) {
      state.pending = null;
      cancelSound();
      renderPlacePanel();
      syncBoard3D();
      return;
    }
    if (state.futureMode) setFutureMode(false);
    else if (!els.ghostPanel.classList.contains("hidden")) ghostClose();
  }
});

// 창 크기 변경 시 카메라를 강제로 되돌리지 않되, 캔버스는 따라가게 한다.
window.addEventListener("resize", () => {
  if (state.graph) state.graph.resize();
  updateBoardOverlay();
});

boot();
