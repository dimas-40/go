// PARKSY GO — 기보·시나리오를 '그래프'로 그린다.
// 대국 기록은 수순 그래프, 귀신의 티칭 장면은 정석 시나리오 그래프가 된다.
// 외부 라이브러리 없이 SVG만 쓴다. 3D 그래프(WebGPU)와 같은 온톨로지 언어를
// 2D 패널에서 읽을 수 있게 하는 것이 목적이다.

const NS = "http://www.w3.org/2000/svg";
const BLACK = 1;
const WHITE = 2;

function el(name, attrs = {}, text = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  if (text !== null) node.textContent = text;
  return node;
}

function clear(svg) {
  if (svg) svg.replaceChildren();
}

function moveCoord(m, size) {
  if (!m) return "—";
  if (m.pass || m.idx === null || m.idx === undefined) return "패스";
  if (m.coord) return m.coord;
  const x = m.idx % size;
  const y = (m.idx / size) | 0;
  return `${"ABCDEFGHJKLMNOPQRST"[x]}${size - y}`;
}

function stoneClass(color) {
  return color === BLACK ? "black" : "white";
}

function shortLabel(text, max = 12) {
  const s = String(text || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function edge(svg, x1, y1, x2, y2, cls, dash = null) {
  const line = el("line", { x1, y1, x2, y2, class: cls });
  if (dash) line.setAttribute("stroke-dasharray", dash);
  svg.append(line);
  return line;
}

function node(svg, x, y, r, cls, label = null, title = null, attrs = {}) {
  const g = el("g", { class: `kn ${cls}`, ...attrs });
  g.append(el("circle", { cx: x, cy: y, r, class: "kn-dot" }));
  if (label !== null) g.append(el("text", { x, y: y + 3.2, class: "kn-label" }, label));
  if (title) g.append(el("title", {}, title));
  svg.append(g);
  return g;
}

/**
 * 대국 기록 + 미래/귀신/AI 후보를 한 장의 수순 그래프로 그린다.
 * @param {SVGElement} svg
 * @param {{
 *   moves: Array, future: any, ghost: Array, ai: Array, teaching: Array,
 *   engine: any, size: number, onPick?: Function
 * }} opts
 */
export function drawKifu(svg, opts = {}) {
  if (!svg) return;
  clear(svg);
  const size = opts.size || opts.engine?.size || 19;
  const moves = (opts.moves || []).filter((m) => m && !m.pass);
  const future = opts.future?.line || [];
  const ghost = (opts.ghost || []).filter((m) => m && m.idx !== null && m.idx !== undefined);
  const ai = (opts.ai || []).filter((m) => m && m.idx !== null && m.idx !== undefined);
  const teaching = (opts.teaching || []).filter((m) => m && m.idx !== null && m.idx !== undefined);

  const W = 320;
  const H = 178;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // 바탕 그리드 — 그래프가 놓이는 좌표계를 보여 준다.
  const bg = el("g", { class: "kifu-bg" });
  for (let x = 20; x < W; x += 28) bg.append(el("line", { x1: x, y1: 8, x2: x, y2: 120, class: "kifu-grid" }));
  for (let y = 20; y < 122; y += 24) bg.append(el("line", { x1: 8, y1: y, x2: W - 8, y2: y, class: "kifu-grid" }));
  svg.append(bg);

  // 실제 수순: 12칸씩 3줄, 뱀처럼 이어 붙인다.
  const maxNodes = 36;
  const shown = moves.slice(-maxNodes);
  const truncated = moves.length - shown.length;
  const cols = 12;
  const x0 = 28;
  const y0 = 34;
  const dx = 24;
  const dy = 34;
  const positions = [];
  for (let i = 0; i < shown.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const leftToRight = row % 2 === 0;
    const x = leftToRight ? x0 + col * dx : x0 + (cols - 1 - col) * dx;
    const y = y0 + row * dy;
    positions.push({ x, y });
  }

  // 수순 선
  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1];
    const b = positions[i];
    if (Math.abs(a.y - b.y) > 1) {
      // 줄이 바뀌면 짧은 꺾은선
      edge(svg, a.x, a.y, b.x, b.y, "kifu-edge kifu-wrap");
    } else {
      edge(svg, a.x, a.y, b.x, b.y, "kifu-edge");
    }
  }

  if (truncated > 0) {
    const first = positions[0] || { x: x0, y: y0 };
    svg.append(el("text", { x: first.x - 14, y: first.y + 3, class: "kifu-ellipsis" }, `+${truncated}`));
  }

  // 실제 수 노드
  shown.forEach((m, i) => {
    const p = positions[i];
    const last = i === shown.length - 1;
    const label = String(m.number ?? i + 1);
    const g = node(
      svg,
      p.x,
      p.y,
      last ? 7.4 : 5.8,
      `kifu-move ${stoneClass(m.color)}${last ? " is-last" : ""}`,
      label,
      `${m.number ?? i + 1}수 · ${m.coord || moveCoord(m, size)} · ${m.color === BLACK ? "흑" : "백"}${m.captured ? ` · 따냄 ${m.captured}` : ""}`,
      { "data-idx": m.idx, "data-coord": m.coord || moveCoord(m, size), "data-kind": "move" },
    );
    if (last) g.append(el("circle", { cx: p.x, cy: p.y, r: 11.5, class: "kifu-pulse" }));
  });

  if (!shown.length) {
    svg.append(el("text", { x: W / 2, y: 54, class: "kifu-empty" }, "아직 수순이 없습니다"));
    svg.append(el("text", { x: W / 2, y: 72, class: "kifu-empty small" }, "첫 수를 두면 여기에 기보 그래프가 자랍니다"));
  }

  const lastPos = positions[positions.length - 1] || { x: x0, y: y0 };

  // 미래 시뮬레이션 가지 — 보라색 점선
  if (future.length) {
    let px = lastPos.x;
    let py = 112;
    edge(svg, lastPos.x, lastPos.y, px, py, "kifu-edge future", "3 4");
    future.forEach((m, i) => {
      const x = 28 + i * 78;
      const y = 132;
      if (i > 0) edge(svg, px, py, x, y, "kifu-edge future", "3 4");
      const label = `${i + 1}.${m.coord || moveCoord(m, size)}`;
      node(svg, x, y, 7, `kifu-future ${stoneClass(m.color)}`, String(i + 1), `미래 ${i + 1}수 · ${m.coord || moveCoord(m, size)}`, {
        "data-idx": m.idx,
        "data-coord": m.coord || moveCoord(m, size),
        "data-kind": "future",
      });
      svg.append(el("text", { x, y: y + 18, class: "kifu-caption" }, label));
      px = x;
      py = y;
    });
  } else if (ghost.length) {
    // 귀신의 티칭 가지 — 금빛 점선
    let px = lastPos.x;
    let py = 112;
    edge(svg, lastPos.x, lastPos.y, px, py, "kifu-edge ghost", "2 4");
    ghost.slice(0, 3).forEach((m, i) => {
      const x = 54 + i * 92;
      const y = 132;
      if (i > 0) edge(svg, px, py, x, y, "kifu-edge ghost", "2 4");
      node(svg, x, y, 7.5, `kifu-ghost ${stoneClass(m.color)}`, m.n ?? i + 1, `귀신의 읽기 ${i + 1} · ${m.coord || moveCoord(m, size)}`, {
        "data-idx": m.idx,
        "data-coord": m.coord || moveCoord(m, size),
        "data-kind": "ghost",
      });
      svg.append(el("text", { x, y: y + 18, class: "kifu-caption ghost" }, m.coord || moveCoord(m, size)));
      px = x;
      py = y;
    });
  } else if (teaching.length) {
    // 이야기 장면의 목표 후보 — 시나리오 패널이 없을 때의 요약 가지
    let px = lastPos.x;
    for (let i = 0; i < Math.min(teaching.length, 3); i++) {
      const m = teaching[i];
      const x = 54 + i * 92;
      const y = 132;
      edge(svg, px, 112, x, y, "kifu-edge teaching", "2 4");
      node(svg, x, y, 7.5, `kifu-teaching ${stoneClass(m.color)}`, i + 1, `티칭 ${i + 1} · ${m.coord}`, {
        "data-idx": m.idx,
        "data-coord": m.coord,
        "data-kind": "teaching",
      });
      svg.append(el("text", { x, y: y + 18, class: "kifu-caption teaching" }, m.coord));
      px = x;
    }
  }

  // AI 후보 — 마지막 수 옆에 작은 heat 점으로 붙인다. 수순을 가리지 않는다.
  if (ai.length) {
    const top = ai.slice(0, 5);
    const startX = 206;
    const y = 14;
    svg.append(el("text", { x: startX - 6, y: y + 3, class: "kifu-ai-label" }, "AI"));
    top.forEach((c, i) => {
      const x = startX + i * 20;
      const r = 2.5 + Math.max(0, Math.min(1, (c.score || 0) / Math.max(1, top[0].score || 1))) * 3.4;
      node(svg, x, y, r, `kifu-ai ${stoneClass(c.color || 0)}`, null, `AI 후보 ${c.coord || moveCoord(c, size)} · ${c.winRate !== undefined ? (c.winRate * 100).toFixed(1) + "%" : "평가 " + (c.score ?? "—")}`, {
        "data-idx": c.idx,
        "data-coord": c.coord || moveCoord(c, size),
        "data-kind": "ai",
      });
    });
  }

  // 범례
  const legend = el("g", { class: "kifu-legend-svg" });
  legend.append(el("circle", { cx: 20, cy: 168, r: 3.5, class: "swatch black" }));
  legend.append(el("text", { x: 28, y: 171, class: "kifu-legend-text" }, "흑"));
  legend.append(el("circle", { cx: 48, cy: 168, r: 3.5, class: "swatch white" }));
  legend.append(el("text", { x: 56, y: 171, class: "kifu-legend-text" }, "백"));
  legend.append(el("line", { x1: 78, y1: 168, x2: 96, y2: 168, class: "kifu-edge future", "stroke-dasharray": "3 4" }));
  legend.append(el("text", { x: 100, y: 171, class: "kifu-legend-text" }, "미래"));
  legend.append(el("line", { x1: 136, y1: 168, x2: 154, y2: 168, class: "kifu-edge ghost", "stroke-dasharray": "2 4" }));
  legend.append(el("text", { x: 158, y: 171, class: "kifu-legend-text" }, "귀신"));
  svg.append(legend);
}

/**
 * 이야기 장면의 정석/티칭 시나리오를 그래프로 그린다.
 * 현 위치(중심)에서 목표·응수·맥락 돌이 뻗어 나가는 별자리 형태.
 */
export function drawScenario(svg, opts = {}) {
  if (!svg) return;
  clear(svg);
  const W = 320;
  const H = 166;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const steps = (opts.steps || []).filter(Boolean);
  const engine = opts.engine;
  const size = opts.size || engine?.size || 9;
  const cx = 160;
  const cy = 82;

  // 배경 별자리
  const bg = el("g", { class: "scenario-bg" });
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    bg.append(el("circle", { cx: cx + Math.cos(ang) * 92, cy: cy + Math.sin(ang) * 56, r: 0.9, class: "scenario-star" }));
  }
  svg.append(bg);

  const done = new Set();
  if (engine) {
    for (let i = 0; i < engine.total; i++) {
      if (engine.board[i]) done.add(i);
    }
  }
  const played = new Set((opts.moves || []).map((m) => m.coord));

  // 역할별 자리
  const roles = { context: [], choice: [], response: [], goal: [], next: [] };
  for (const s of steps) {
    const role = s.role || "choice";
    (roles[role] || roles.choice).push(s);
  }

  const focus = roles.goal.length ? roles.goal : roles.choice;
  const place = new Map();
  const placeGroup = (list, baseX, baseY, gap, dir = 1) => {
    const n = list.length;
    list.forEach((s, i) => {
      const off = (i - (n - 1) / 2) * gap;
      place.set(s, { x: baseX, y: baseY + off * dir });
    });
  };
  // 맥락 돌이 없으면 네 귀퉁이처럼 별자리로 배치한다. 빈 판의 포석 장면이
  // 단순한 목록이 아니라 '판의 네 방향'으로 읽히게.
  if (!roles.context.length && focus.length && focus.length <= 4) {
    const angles = focus.length === 1 ? [-90]
      : focus.length === 2 ? [-135, -45]
      : focus.length === 3 ? [-135, 0, 135]
      : [-135, -45, 45, 135];
    focus.forEach((s, i) => {
      const a = (angles[i] ?? -135) * (Math.PI / 180);
      place.set(s, { x: cx + Math.cos(a) * 90, y: cy + Math.sin(a) * 50 });
    });
  } else {
    placeGroup(roles.context, 66, 82, 26);
    placeGroup(roles.choice, 168, 82, 27);
    placeGroup(roles.goal, 168, 82, 27);
    placeGroup(roles.response, 262, 62, 34);
    placeGroup(roles.next, 262, 112, 26);
  }

  // 중심(현재)
  const centerColor = opts.turn === WHITE ? "white" : "black";
  node(svg, cx, cy, 10, `scenario-now ${centerColor}`, "今", "현재 국면", { "data-kind": "root" });
  svg.append(el("text", { x: cx, y: cy + 25, class: "scenario-root-label" }, "현재"));

  // 맥락 돌은 흐린 점선으로 중앙과 잇는다.
  for (const s of roles.context) {
    const p = place.get(s);
    edge(svg, cx, cy, p.x, p.y, "scenario-edge context", "2 4");
    drawScenarioNode(svg, s, p.x, p.y, {
      muted: true,
      onBoard: engine ? engine.board[s.idx] : 0,
      played: played.has(s.coord),
    });
  }

  // 목표/후보: 중앙에서 금빛 선
  for (const s of focus) {
    const p = place.get(s);
    edge(svg, cx, cy, p.x, p.y, "scenario-edge goal");
    drawScenarioNode(svg, s, p.x, p.y, {
      active: !played.has(s.coord),
      onBoard: engine ? engine.board[s.idx] : 0,
      played: played.has(s.coord),
      focus: true,
    });
  }

  // 응수/다음: 목표에서 이어진다.
  const from = focus[0];
  const fp = from ? place.get(from) : { x: cx, y: cy };
  for (const s of [...roles.response, ...roles.next]) {
    const p = place.get(s);
    if (!p) continue;
    edge(svg, fp.x, fp.y, p.x, p.y, "scenario-edge response", "4 4");
    drawScenarioNode(svg, s, p.x, p.y, {
      onBoard: engine ? engine.board[s.idx] : 0,
      played: played.has(s.coord),
    });
  }

  if (!steps.length) {
    svg.append(el("text", { x: W / 2, y: H / 2 - 4, class: "kifu-empty" }, "이 장면의 시나리오가 없습니다"));
  }

  svg.append(el("text", { x: 14, y: 158, class: "scenario-foot" }, "● 목표  ○ 응수  ┈ 맥락  · 노드를 누르면 판에서 봅니다"));
}

function drawScenarioNode(svg, s, x, y, meta = {}) {
  const cls = [
    "scenario-node",
    s.color === WHITE ? "white" : "black",
    meta.focus ? "focus" : "",
    meta.played ? "played" : "",
    meta.muted ? "muted" : "",
    meta.active ? "active" : "",
  ].filter(Boolean).join(" ");
  const g = el("g", {
    class: cls,
    "data-idx": s.idx,
    "data-coord": s.coord,
    "data-kind": "scenario",
  });
  g.append(el("circle", { cx: x, cy: y, r: meta.focus ? 9 : 7, class: "scenario-dot" }));
  g.append(el("text", { x, y: y + 3.2, class: "scenario-node-label" }, s.coord || "?"));
  if (s.label) {
    g.append(el("text", { x, y: y + (meta.focus ? 22 : 20), class: "scenario-node-caption" }, shortLabel(s.label, 10)));
  }
  g.append(el("title", {}, `${s.coord || "?"} · ${s.label || "티칭"}${meta.played ? " · 이미 둠" : ""}`));
  svg.append(g);
  if (meta.active) {
    g.append(el("circle", { cx: x, cy: y, r: meta.focus ? 15 : 12, class: "scenario-pulse" }));
  }
  return g;
}
