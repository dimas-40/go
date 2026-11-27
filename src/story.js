// PARKSY GO — 《귀신의 한 수》 스토리 데이터
// 장면은 "읽기 → 두기 → 되돌아보기"의 계약을 가진다.
// 목표 판정은 엔진 이벤트로만 한다. 대사가 판정하지 않는다.
import { GoEngine, BLACK, WHITE, coordIndex, coordName } from "./go-engine.js";

const P = (at, color) => ({ at, color });

export const CHAPTERS = [
  {
    id: "ch01",
    no: "제1장",
    title: "빈 판",
    subtitle: "첫 수, 그리고 숨",
    scenes: [
      {
        id: "ch01s01",
        no: "1-1",
        title: "첫 수",
        size: 9,
        komi: 6.5,
        turn: BLACK,
        setup: [],
        goal: { type: "play", targets: ["C7", "G7", "C3", "G3"], label: "귀의 별에 첫 수를 둔다" },
        intro: [
          "바둑판은 빈 방이야. 문을 여는 건 첫 수 하나뿐이지.",
          "귀에 두어 봐. 세상의 끝에서 시작하는 거야.",
        ],
        hints: [
          "네가 선 자리에서 가장 가까운 별을 찾아.",
          "C7, G7, C3, G3. 어디든 좋아. 하나를 골라.",
          "별은 방의 기둥이야. 기둥을 세워야 집이 서지.",
        ],
        after: ["좋아. 이제 네가 이 방의 주인이야."],
        opponent: { kind: "scripted", moves: ["G7"] },
        // 그래프 뷰에 띄울 정석 시나리오. 보드의 좌표와 1:1로 대응한다.
        teaching: [
          { at: "C7", color: BLACK, role: "goal", label: "좌상귀" },
          { at: "G7", color: BLACK, role: "goal", label: "우상귀" },
          { at: "C3", color: BLACK, role: "goal", label: "좌하귀" },
          { at: "G3", color: BLACK, role: "goal", label: "우하귀" },
        ],
        next: "ch01s02",
      },
      {
        id: "ch01s02",
        no: "1-2",
        title: "숨",
        size: 9,
        komi: 6.5,
        turn: BLACK,
        setup: [P("D5", BLACK), P("F5", BLACK), P("E4", BLACK), P("E5", WHITE)],
        goal: { type: "capture", label: "숨통을 끊어 흰 돌을 따낸다" },
        intro: [
          "저 흰 돌, 숨을 한 번만 쉬고 있어.",
          "숨통을 끊는 수를 찾아. 돌은 숨이 없으면 사라져.",
        ],
        hints: [
          "흰 돌의 위쪽을 봐. 마지막 구멍이 하나 남았어.",
          "E6. 그 자리가 마지막 숨구멍이야.",
          "따냄은 잔인한 게 아니야. 돌에게 집을 주는 일이지.",
        ],
        after: ["좋아. 이제 돌의 숨을 읽었구나."],
        opponent: { kind: "none" },
        teaching: [
          { at: "D5", color: BLACK, role: "context", label: "흑 벽" },
          { at: "F5", color: BLACK, role: "context", label: "흑 벽" },
          { at: "E4", color: BLACK, role: "context", label: "아래 단" },
          { at: "E5", color: WHITE, role: "context", label: "갇힌 백" },
          { at: "E6", color: BLACK, role: "goal", label: "마지막 숨" },
        ],
        next: "ch01s03",
      },
      {
        id: "ch01s03",
        no: "1-3",
        title: "연결",
        size: 9,
        komi: 6.5,
        turn: BLACK,
        setup: [P("C3", BLACK), P("E3", BLACK), P("D4", WHITE), P("D2", WHITE)],
        goal: { type: "play", targets: ["D3"], label: "두 흑돌을 연결한다" },
        intro: [
          "두 돌이 서로를 부르고 있어. 하지만 사이가 끊겨 있지.",
          "D3에 두면 둘이 손을 잡아. 연결은 힘이야.",
        ],
        hints: [
          "두 흑돌 사이의 빈 자리를 봐.",
          "D3. 그 한 수가 두 돌을 한 몸으로 만들어.",
          "혼자인 돌은 언제나 약해. 연결된 돌은 쉽게 죽지 않아.",
        ],
        after: ["연결은 힘이야. 혼자인 돌은 언제나 약해."],
        opponent: { kind: "none" },
        teaching: [
          { at: "C3", color: BLACK, role: "context", label: "왼쪽 흑" },
          { at: "E3", color: BLACK, role: "context", label: "오른쪽 흑" },
          { at: "D4", color: WHITE, role: "context", label: "위 백" },
          { at: "D2", color: WHITE, role: "context", label: "아래 백" },
          { at: "D3", color: BLACK, role: "goal", label: "연결점" },
        ],
        next: "ch01s04",
      },
      {
        id: "ch01s04",
        no: "1-4",
        title: "마지막 수",
        size: 9,
        komi: 0.5,
        turn: BLACK,
        setup: [],
        goal: { type: "win", label: "귀신 선생과 한 판 — 이겨라" },
        intro: [
          "이제 나와 한 판 두자. 이겨도 되고, 져도 돼.",
          "다만 네 수를 기억해. 그게 네가 가져갈 거야.",
        ],
        hints: [
          "나를 이기려고 서두르지 마. 네 집을 먼저 만들어.",
          "작은 판에서는 한 집이 커. 끝까지 세어 봐.",
          "마지막 수는 언제나 조용해. 그래서 더 무서워.",
        ],
        after: ["…좋은 수였어. 네가 나보다 나아."],
        opponent: { kind: "ai", level: "easy" },
        teaching: [
          { at: "C7", color: BLACK, role: "goal", label: "포석 · 좌상" },
          { at: "G7", color: BLACK, role: "goal", label: "포석 · 우상" },
          { at: "C3", color: BLACK, role: "goal", label: "포석 · 좌하" },
          { at: "G3", color: BLACK, role: "goal", label: "포석 · 우하" },
        ],
        next: null,
      },
    ],
  },
];

export const ALL_SCENES = CHAPTERS.flatMap((ch) => ch.scenes.map((sc) => ({ ...sc, chapter: ch })));

export function sceneById(id) {
  return ALL_SCENES.find((s) => s.id === id) || null;
}

export function firstScene() {
  return ALL_SCENES[0];
}

export function nextScene(id) {
  const scene = sceneById(id);
  return scene?.next ? sceneById(scene.next) : null;
}

export function createSceneEngine(scene) {
  const e = new GoEngine(scene.size, { komi: scene.komi ?? 6.5, rules: "chinese", superko: true });
  e.board.fill(0);
  for (const stone of scene.setup || []) {
    const idx = coordIndex(stone.at, scene.size);
    if (idx < 0) throw new Error(`bad setup point: ${stone.at}`);
    e.board[idx] = stone.color;
  }
  e.turn = scene.turn ?? BLACK;
  e.ko = null;
  e.captures = { [BLACK]: 0, [WHITE]: 0 };
  e.passes = 0;
  e.history = [];
  e.hashes = [e._positionKey(e.turn)];
  e.gameOver = false;
  e.result = null;
  e.lastMove = null;
  e.lastMoveColor = null;
  e.moveNumber = 0;
  return e;
}

export function goalLabel(scene) {
  return scene?.goal?.label || "자유 대국";
}

function groupHas(e, idx, points) {
  const g = e.groupAt(idx);
  if (!g) return false;
  const set = new Set(g.stones);
  return points.every((p) => {
    const i = coordIndex(p, e.size);
    return i >= 0 && set.has(i);
  });
}

export function isGoalMet(scene, engine, result, humanColor = BLACK) {
  const goal = scene?.goal;
  if (!goal) return false;
  if (goal.type === "win") {
    return !!engine.gameOver && engine.result?.winner === humanColor;
  }
  if (goal.type === "capture") {
    if (!result || result.color !== humanColor) return false;
    if (!result.captured?.length) return false;
    if (goal.targets?.length) {
      const target = coordIndex(goal.targets[0], engine.size);
      return result.captured.includes(target);
    }
    return true;
  }
  if (goal.type === "play") {
    if (!result || result.color !== humanColor || result.idx === null || result.idx === undefined) return false;
    const targets = (goal.targets || []).map((p) => coordIndex(p, engine.size));
    return targets.includes(result.idx);
  }
  if (goal.type === "connect") {
    if (!result || result.color !== humanColor) return false;
    return groupHas(engine, result.idx, goal.points || []);
  }
  if (goal.type === "free") return false;
  return false;
}

export function sceneMoves(scene) {
  return (scene?.opponent?.moves || []).map((p) => ({ coord: p, idx: coordIndex(p, scene.size) }));
}

export function describeGoal(scene) {
  return `${scene.no} · ${scene.title} — ${goalLabel(scene)}`;
}
