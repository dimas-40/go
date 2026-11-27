// PARKSY GO — 바둑 온톨로지를 그래프로 편다.
// 19×19 교점이 노드, 가로·세로 이웃이 링크. 9·13바둑은 중앙 창만 보인다.
// 돌·집단·활로·패·단수·집·영향도는 노드 위에 얹히는 동적 클래스다.

export const GRID = 19;
export const SPACING = 26;
export const CENTER = (GRID - 1) / 2;

const STAR = {
  9: [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]],
  13: [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]],
  19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]],
};

const STAR_KEYS = Object.fromEntries(
  Object.entries(STAR).map(([size, pts]) => [size, new Set(pts.map(([x, y]) => `${x},${y}`))]),
);

export function isStarPoint(size, x, y) {
  return STAR_KEYS[size]?.has(`${x},${y}`) || false;
}

export function starPoints(size) {
  return STAR[size] || [];
}

export function boardWindow(size) {
  const off = (GRID - size) / 2;
  return { off, min: off, max: off + size - 1, size };
}

export function graphIndexForEngine(size, idx) {
  if (idx === null || idx === undefined || idx < 0) return -1;
  const { off } = boardWindow(size);
  const ex = idx % size;
  const ey = (idx / size) | 0;
  return (ey + off) * GRID + (ex + off);
}

export function engineIndexForNode(node, size) {
  const { off } = boardWindow(size);
  const ex = node.gx - off;
  const ey = node.gy - off;
  if (ex < 0 || ey < 0 || ex >= size || ey >= size) return -1;
  return ey * size + ex;
}

export function isNodeOnBoard(node, size) {
  const { off } = boardWindow(size);
  return node.gx >= off && node.gx < off + size && node.gy >= off && node.gy < off + size;
}

/**
 * @returns {{nodes: Array, links: Array, meta: Object}}
 */
export function buildOntologyGraph() {
  const nodes = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const id = `pt-${gx}-${gy}`;
      nodes.push({
        id,
        label: `교점 ${gx},${gy}`,
        gx,
        gy,
        x: (gx - CENTER) * SPACING,
        y: (CENTER - gy) * SPACING,
        z: 0,
        fz: 0,
        val: 1,
        kind: "intersection",
      });
    }
  }
  const links = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const id = gy * GRID + gx;
      if (gx + 1 < GRID) links.push({ source: nodes[id].id, target: nodes[id + 1].id, relation: "adjacent-east" });
      if (gy + 1 < GRID) links.push({ source: nodes[id].id, target: nodes[id + GRID].id, relation: "adjacent-south" });
    }
  }
  return {
    nodes,
    links,
    meta: {
      grid: GRID,
      spacing: SPACING,
      nodeCount: nodes.length,
      linkCount: links.length,
      classes: ONTOLOGY_CLASSES.map((c) => c.id),
    },
  };
}

export const ONTOLOGY_CLASSES = [
  { id: "intersection", label: "교점", color: "#2bd6b0", desc: "바둑판 위 착점 위치. 그래프의 노드." },
  { id: "adjacency", label: "이웃", color: "#1e6f78", desc: "가로·세로로 맞닿은 관계. 그래프의 링크." },
  { id: "black-stone", label: "흑 돌", color: "#4aa8ff", desc: "흑이 놓은 돌." },
  { id: "white-stone", label: "백 돌", color: "#ffcf6a", desc: "백이 놓은 돌." },
  { id: "group", label: "돌집단", color: "#9d7bff", desc: "같은 색으로 이어진 돌의 연결 성분." },
  { id: "liberty", label: "활로", color: "#35d07f", desc: "돌집단이 숨 쉬는 빈 교점." },
  { id: "atari", label: "단수", color: "#ff5a5a", desc: "활로가 하나뿐인 돌집단. 다음 수에 잡힌다." },
  { id: "ko", label: "패", color: "#ff4fd8", desc: "바로 되따냄이 금지된 자리." },
  { id: "territory", label: "집", color: "#e0b070", desc: "한쪽 색만 둘러싼 빈 영역." },
  { id: "influence", label: "영향도", color: "#7de2ff", desc: "돌 배치가 만드는 세력의 세기. GPU 컴퓨트로 계산." },
  { id: "move", label: "수", color: "#ffffff", desc: "한 번의 착수·패스. 순서가 대국 기록이 된다." },
];
