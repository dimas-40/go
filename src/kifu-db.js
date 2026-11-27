// PARKSY GO — 기보 데이터베이스.
// 온톨로지의 언어(교점·돌·활로·집·영향도·수)로 분류한 포석·정석·수법 도해.
// 각 기록은 좌표와 개념 관계를 함께 갖고, 판 위에 '착수 형태'로 겹쳐 볼 수 있다.
const NS = "http://www.w3.org/2000/svg";
const COLS = "ABCDEFGHJKLMNOPQRST";
const BLACK = 1;
const WHITE = 2;

export const KIFU_CATEGORIES = [
  { id: "all", label: "전체" },
  { id: "fuseki", label: "포석" },
  { id: "joseki", label: "정석" },
  { id: "tesuji", label: "수법" },
  { id: "life", label: "사활" },
];

export const KIFU_DB = [
  {
    id: "fuseki-four-star",
    category: "fuseki",
    title: "사귀 화점 포석",
    subtitle: "네 귀를 나눠 갖는 가장 오래된 균형",
    level: "입문",
    moves: [
      { coord: "Q16", color: BLACK, note: "우상귀 화점" },
      { coord: "D4", color: WHITE, note: "좌하귀 화점" },
      { coord: "Q4", color: BLACK, note: "우하귀 화점" },
      { coord: "D16", color: WHITE, note: "좌상귀 화점" },
    ],
    concepts: ["귀", "변", "확장", "균형"],
    relations: [
      { from: "귀", to: "변", rel: "확장" },
      { from: "수", to: "영향도", rel: "만든다" },
    ],
    note: "네 귀를 먼저 나눠 가진 뒤 변으로 넓힌다. 초반의 기준선.",
  },
  {
    id: "fuseki-chinese",
    category: "fuseki",
    title: "중국식 포석",
    subtitle: "한쪽 변을 크게 깔고 중앙으로 키운다",
    level: "중급",
    moves: [
      { coord: "Q4", color: BLACK, note: "우하귀 화점" },
      { coord: "D16", color: WHITE, note: "좌상귀 화점" },
      { coord: "D14", color: BLACK, note: "낮은 중국식" },
      { coord: "R16", color: WHITE, note: "우상귀 걸침" },
    ],
    concepts: ["변", "세력", "중앙", "영향도"],
    relations: [
      { from: "변", to: "중앙", rel: "키운다" },
      { from: "세력", to: "영향도", rel: "계산한다" },
    ],
    note: "변을 넓게 깔아 중앙 세력으로 바꾸는 포석. 실리의 균형을 나중에 맞춘다.",
  },
  {
    id: "fuseki-sanrensei",
    category: "fuseki",
    title: "삼연성 포석",
    subtitle: "한 변에 별 셋을 나란히",
    level: "중급",
    moves: [
      { coord: "Q4", color: BLACK, note: "우하귀 화점" },
      { coord: "D4", color: WHITE, note: "좌하귀 화점" },
      { coord: "Q10", color: BLACK, note: "우변 중앙 화점" },
      { coord: "D16", color: WHITE, note: "좌상귀 화점" },
      { coord: "Q16", color: BLACK, note: "우상귀 화점" },
    ],
    concepts: ["변", "세력", "중앙", "영향도"],
    relations: [
      { from: "변", to: "세력", rel: "쌓는다" },
      { from: "세력", to: "집", rel: "기대한다" },
    ],
    note: "한 변을 별 셋으로 받쳐 큰 세력을 만든다. 상대는 침입과 삭감으로 맞선다.",
  },
  {
    id: "fuseki-kobayashi",
    category: "fuseki",
    title: "고바야시 포석",
    subtitle: "실리와 세력을 비트는 현대 포석",
    level: "고급",
    moves: [
      { coord: "Q4", color: BLACK, note: "우하귀 화점" },
      { coord: "D16", color: WHITE, note: "좌상귀 화점" },
      { coord: "D14", color: BLACK, note: "낮은 중국식" },
      { coord: "R16", color: WHITE, note: "우상귀 걸침" },
      { coord: "O17", color: BLACK, note: "우상변 협공" },
    ],
    concepts: ["실리", "세력", "협공", "영향도"],
    relations: [
      { from: "실리", to: "세력", rel: "맞바꾼다" },
      { from: "협공", to: "영향도", rel: "압박한다" },
    ],
    note: "한쪽은 실리, 다른 쪽은 세력을 가져가는 현대적 균형. 협공의 타이밍이 핵심.",
  },
  {
    id: "joseki-34-knight",
    category: "joseki",
    title: "3·4 걸침 · 한칸 뜀",
    subtitle: "귀의 3·4에 상대가 걸쳐 오는 기본형",
    level: "입문",
    moves: [
      { coord: "D4", color: BLACK, note: "3·4 귀" },
      { coord: "F3", color: WHITE, note: "걸침" },
      { coord: "D6", color: BLACK, note: "한칸 뜀" },
      { coord: "C6", color: WHITE, note: "변으로 벌림" },
    ],
    concepts: ["귀", "걸침", "활로", "연결"],
    relations: [
      { from: "걸침", to: "활로", rel: "줄인다" },
      { from: "뜀", to: "연결", rel: "유지한다" },
    ],
    note: "귀를 지키면서 변으로 나아가는 기본 정석. 돌의 활로를 세는 습관이 먼저다.",
  },
  {
    id: "joseki-33-invasion",
    category: "joseki",
    title: "4·4 삼삼 침입",
    subtitle: "화점 아래 3·3으로 파고드는 실리형",
    level: "중급",
    moves: [
      { coord: "Q4", color: BLACK, note: "4·4 화점" },
      { coord: "P3", color: WHITE, note: "3·3 침입" },
      { coord: "R3", color: BLACK, note: "막는 수" },
      { coord: "O3", color: WHITE, note: "변으로 벌림" },
      { coord: "Q3", color: BLACK, note: "귀를 지킨다" },
      { coord: "P2", color: WHITE, note: "실리를 확보" },
    ],
    concepts: ["귀", "실리", "활로", "집"],
    relations: [
      { from: "침입", to: "집", rel: "빼앗는다" },
      { from: "막음", to: "영향도", rel: "세운다" },
    ],
    note: "상대 화점 아래로 파고들어 실리를 챙기는 정석. 바깥 세력과의 교환이 갈린다.",
  },
  {
    id: "joseki-one-space",
    category: "joseki",
    title: "한칸 굳힘",
    subtitle: "귀를 단단히 굳히고 변을 노린다",
    level: "입문",
    moves: [
      { coord: "D4", color: BLACK, note: "3·4 귀" },
      { coord: "F3", color: WHITE, note: "걸침" },
      { coord: "D6", color: BLACK, note: "한칸 뜀" },
      { coord: "D8", color: BLACK, note: "한칸 굳힘" },
    ],
    concepts: ["귀", "집", "연결", "활로"],
    relations: [
      { from: "굳힘", to: "집", rel: "만든다" },
      { from: "연결", to: "활로", rel: "늘린다" },
    ],
    note: "귀의 실리를 확정하고 변으로 나아갈 발판을 만든다. 연결의 가치가 큰 형태.",
  },
  {
    id: "tesuji-shicho",
    category: "tesuji",
    title: "촉촉수",
    subtitle: "한 줄로 몰아 끝까지 잡는 수법",
    level: "중급",
    moves: [
      { coord: "E5", color: BLACK, note: "단수" },
      { coord: "F5", color: WHITE, note: "도망" },
      { coord: "E6", color: BLACK, note: "다시 단수" },
      { coord: "F4", color: WHITE, note: "계속 도망" },
      { coord: "E4", color: BLACK, note: "방향을 튼다" },
      { coord: "G4", color: WHITE, note: "탈출 시도" },
    ],
    concepts: ["단수", "활로", "영향도", "수"],
    relations: [
      { from: "단수", to: "활로", rel: "하나로 만든다" },
      { from: "방향", to: "영향도", rel: "판을 쓴다" },
    ],
    note: "상대를 한 방향으로 몰아 판 끝까지 따라가는 수법. 방향과 주변 돌이 생명이다.",
  },
  {
    id: "tesuji-geta",
    category: "tesuji",
    title: "씌움(게타)",
    subtitle: "도망가는 돌의 앞을 막아 잡는다",
    level: "중급",
    moves: [
      { coord: "F5", color: BLACK, note: "상대 돌 단수" },
      { coord: "G5", color: WHITE, note: "도망" },
      { coord: "F6", color: BLACK, note: "한칸 씌움" },
      { coord: "H6", color: WHITE, note: "탈출 시도" },
      { coord: "G6", color: BLACK, note: "망을 좁힌다" },
    ],
    concepts: ["단수", "활로", "수", "영향도"],
    relations: [
      { from: "씌움", to: "활로", rel: "막는다" },
      { from: "망", to: "집", rel: "만든다" },
    ],
    note: "단수만으로는 놓칠 돌을, 한 칸 멀리서 막아 잡는 수법. 주변 돌의 도움이 필요하다.",
  },
  {
    id: "life-two-eyes",
    category: "life",
    title: "귀의 눈 두 개",
    subtitle: "살기 위한 최소 조건",
    level: "입문",
    moves: [
      { coord: "C3", color: BLACK, note: "눈 만들기" },
      { coord: "D3", color: WHITE, note: "막는 수" },
      { coord: "C4", color: BLACK, note: "두 번째 눈" },
      { coord: "B3", color: WHITE, note: "삭감" },
      { coord: "B4", color: BLACK, note: "살고 있다" },
    ],
    concepts: ["집", "활로", "사활", "수"],
    relations: [
      { from: "집", to: "활로", rel: "숨을 준다" },
      { from: "눈", to: "사활", rel: "결정한다" },
    ],
    note: "안쪽에 눈 두 개가 있으면 잡히지 않는다. 사활은 집과 활로의 문제다.",
  },
];

export function recordById(id) {
  return KIFU_DB.find((r) => r.id === id) || null;
}

export function coordToIndex(coord, size = 19) {
  if (!coord) return -1;
  const m = /^([A-HJ-T])(\d{1,2})$/i.exec(String(coord).trim().toUpperCase());
  if (!m) return -1;
  const x = COLS.indexOf(m[1]);
  const y = size - Number(m[2]);
  if (x < 0 || y < 0 || y >= size) return -1;
  return y * size + x;
}

function el(name, attrs = {}, text = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  if (text !== null) node.textContent = text;
  return node;
}

/**
 * 작은 판 도해. 수순 번호를 돌 위에 새겨 '착수'로 읽히게 한다.
 */
export function drawKifuBoard(svg, record, size = 19) {
  if (!svg || !record) return;
  svg.replaceChildren();
  const W = 244;
  const H = 244;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const pad = 22;
  const gap = (W - pad * 2) / (size - 1);
  const at = (i) => ({ x: pad + (i % size) * gap, y: pad + ((i / size) | 0) * gap });

  const bg = el("rect", { x: 0, y: 0, width: W, height: H, rx: 10, fill: "rgba(20,14,8,0.55)" });
  svg.append(bg);
  for (let i = 0; i < size; i++) {
    const p = pad + i * gap;
    svg.append(el("line", { x1: pad, y1: p, x2: W - pad, y2: p, stroke: "rgba(200,161,94,0.18)", "stroke-width": 0.7 }));
    svg.append(el("line", { x1: p, y1: pad, x2: p, y2: H - pad, stroke: "rgba(200,161,94,0.18)", "stroke-width": 0.7 }));
  }
  const stars = size === 19
    ? [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]]
    : size === 13 ? [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]] : [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]];
  for (const [x, y] of stars) {
    const p = at(y * size + x);
    svg.append(el("circle", { cx: p.x, cy: p.y, r: 1.8, fill: "rgba(224,176,112,0.65)" }));
  }

  record.moves.forEach((mv, i) => {
    const idx = coordToIndex(mv.coord, size);
    if (idx < 0) return;
    const p = at(idx);
    const black = mv.color === BLACK;
    const r = gap * 0.46;
    svg.append(el("circle", {
      cx: p.x, cy: p.y, r,
      fill: black ? "#10141b" : "#f2ead7",
      stroke: black ? "rgba(122,178,255,0.55)" : "rgba(255,240,210,0.8)",
      "stroke-width": 0.9,
    }));
    svg.append(el("text", {
      x: p.x, y: p.y + r * 0.34, "text-anchor": "middle",
      "font-family": "SFMono-Regular, Roboto Mono, monospace",
      "font-size": Math.max(5, r * 0.95), "font-weight": 700,
      fill: black ? "#ffe9bd" : "#3a2a13",
    }, String(i + 1)));
  });
  svg.append(el("text", {
    x: W / 2, y: H - 6, "text-anchor": "middle",
    "font-size": 8, fill: "rgba(196,176,146,0.65)",
  }, `${size}줄 · 수순 ${record.moves.length}수 · 개념 도해`));
}
