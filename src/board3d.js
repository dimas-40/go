// PARKSY GO — 3D 바둑판.
// 나무 결이 흐르는 두꺼운 기와(榧) 판, 황동 인레이, 실제로 눌린 듯한 흑·백 돌,
// 마지막 수의 붉은 점과 금빛 고리. WebGPU/WebGL2 공통 three.js 물리 머티리얼 위에서 돈다.
import * as THREE from "three";

const BLACK = 1;
const WHITE = 2;
const STONE_R = 11.2;
const STONE_Z = 2.02;
const GRID_Z = -1.31;
const BOARD_TOP = -1.5;

const STAR = {
  9: [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]],
  13: [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]],
  19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]],
};

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 나무 결: 긴 결 + 미세 섬유 + 옹이. 색 지도와 요철 지도를 함께 만들어
// 돌빛이 결을 따라 흐르게 한다. 캔버스 두 장을 GPU 텍스처로 올린다.
function makeWoodTextures() {
  const S = 1024;
  const c = document.createElement("canvas");
  const b = document.createElement("canvas");
  c.width = c.height = S;
  b.width = b.height = S;
  const ctx = c.getContext("2d");
  const bctx = b.getContext("2d");
  const rnd = rand(20261127);

  // 기와(榧) 빛: 꿀색 등판에 붉은 갈색 결.
  const base = ctx.createLinearGradient(0, 0, S, S);
  base.addColorStop(0, "#d4a05f");
  base.addColorStop(0.3, "#bd8443");
  base.addColorStop(0.62, "#a2662e");
  base.addColorStop(1, "#7b4b1e");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = "#7c7c7c";
  bctx.fillRect(0, 0, S, S);

  // 판 전체의 큰 명암 흐름 — 결이 한 방향으로 흐르는 느낌.
  for (let i = 0; i < 22; i++) {
    const x = rnd() * S;
    const w = 24 + rnd() * 96;
    const tone = rnd() > 0.5 ? 255 : 0;
    const alpha = 0.015 + rnd() * 0.032;
    ctx.strokeStyle = `rgba(${tone},${tone * 0.78 | 0},${tone * 0.5 | 0},${alpha})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, -40);
    ctx.bezierCurveTo(x + 18, S * 0.33, x - 28, S * 0.66, x + 8, S + 40);
    ctx.stroke();
  }

  // 넓은 결 띠 — 색은 어둡게, 요철은 움푹.
  for (let i = 0; i < 110; i++) {
    const x = rnd() * S;
    const amp = 9 + rnd() * 24;
    const freq = 0.006 + rnd() * 0.012;
    const phase = rnd() * Math.PI * 2;
    const dark = 66 + (rnd() * 40) | 0;
    const a = 0.05 + rnd() * 0.12;
    ctx.beginPath();
    bctx.beginPath();
    for (let y = -20; y <= S + 20; y += 8) {
      const px = x + Math.sin(y * freq + phase) * amp + Math.sin(y * 0.0017 + phase * 2) * 18;
      if (y === -20) { ctx.moveTo(px, y); bctx.moveTo(px, y); }
      else { ctx.lineTo(px, y); bctx.lineTo(px, y); }
    }
    ctx.strokeStyle = `rgba(${dark},${dark * 0.54 | 0},${dark * 0.24 | 0},${a})`;
    ctx.lineWidth = 0.9 + rnd() * 3.8;
    ctx.stroke();
    bctx.strokeStyle = `rgba(0,0,0,${a * 0.62})`;
    bctx.lineWidth = ctx.lineWidth;
    bctx.stroke();
  }

  // 가는 섬유 — 색과 요철을 동시에.
  for (let i = 0; i < 760; i++) {
    const x = rnd() * S;
    const amp = 2 + rnd() * 8;
    const freq = 0.012 + rnd() * 0.03;
    const phase = rnd() * Math.PI * 2;
    ctx.beginPath();
    bctx.beginPath();
    for (let y = -10; y <= S + 10; y += 12) {
      const px = x + Math.sin(y * freq + phase) * amp;
      if (y === -10) { ctx.moveTo(px, y); bctx.moveTo(px, y); }
      else { ctx.lineTo(px, y); bctx.lineTo(px, y); }
    }
    const a = 0.04 + rnd() * 0.1;
    ctx.strokeStyle = `rgba(66,35,12,${a})`;
    ctx.lineWidth = 0.5 + rnd() * 1.25;
    ctx.stroke();
    bctx.strokeStyle = `rgba(0,0,0,${a * 0.8})`;
    bctx.lineWidth = ctx.lineWidth;
    bctx.stroke();
  }

  // 기공(작은 점)
  for (let i = 0; i < 2600; i++) {
    const px = rnd() * S;
    const py = rnd() * S;
    const rx = 0.5 + rnd() * 1.8;
    const ry = 0.5 + rnd() * 4.2;
    ctx.fillStyle = `rgba(${54 + (rnd() * 28) | 0},${30 + (rnd() * 18) | 0},${12 + (rnd() * 10) | 0},${0.07 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    bctx.fillStyle = "rgba(0,0,0,0.16)";
    bctx.beginPath();
    bctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    bctx.fill();
  }

  // 옹이 세 곳 — 나이테가 판을 가로지르는 가장 큰 결.
  for (let k = 0; k < 3; k++) {
    const cx = 130 + rnd() * 760;
    const cy = 130 + rnd() * 760;
    for (let i = 1; i < 18; i++) {
      const rx = i * (2.2 + rnd() * 1.5);
      const ry = i * (1.1 + rnd() * 0.9);
      const rot = 0.4 + rnd() * 0.5;
      const a = 0.14 - i * 0.0055;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(58,28,8,${a})`;
      ctx.lineWidth = 0.7 + rnd() * 1.5;
      ctx.stroke();
      bctx.beginPath();
      bctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      bctx.strokeStyle = `rgba(0,0,0,${a * 0.9})`;
      bctx.lineWidth = ctx.lineWidth;
      bctx.stroke();
    }
  }

  // 가장자리 비네트 + 광택 — 판 가운데가 살짝 밝고 네 귀가 가라앉는다.
  const vig = ctx.createRadialGradient(S * 0.46, S * 0.4, S * 0.12, S * 0.5, S * 0.5, S * 0.82);
  vig.addColorStop(0, "rgba(255,226,176,0.14)");
  vig.addColorStop(0.55, "rgba(255,214,154,0.02)");
  vig.addColorStop(1, "rgba(24,10,2,0.52)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  const sheen = ctx.createLinearGradient(0, 0, S, S);
  sheen.addColorStop(0, "rgba(255,246,224,0.1)");
  sheen.addColorStop(0.32, "rgba(255,255,255,0)");
  sheen.addColorStop(0.68, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(255,232,186,0.05)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, S, S);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.needsUpdate = true;
  const bump = new THREE.CanvasTexture(b);
  bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping;
  bump.needsUpdate = true;
  return { map, bump };
}

function makeTableTexture() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#050506";
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.04, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, "#18120c");
  g.addColorStop(0.38, "#0c0907");
  g.addColorStop(1, "#020304");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // 미세한 펠트/가죽 요철
  const rnd = rand(77);
  for (let i = 0; i < 12000; i++) {
    ctx.fillStyle = `rgba(255,214,170,${0.008 + rnd() * 0.014})`;
    ctx.fillRect(rnd() * S, rnd() * S, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 돌 밑에 깔리는 부드러운 접촉 그림자. 방향광 그림자가 약한 환경에서도
// 돌이 판 위에 '놓여 있다'는 감각을 만든다.
function makeShadowTexture() {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.04, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0.9)");
  g.addColorStop(0.5, "rgba(0,0,0,0.72)");
  g.addColorStop(0.8, "rgba(0,0,0,0.34)");
  g.addColorStop(0.94, "rgba(0,0,0,0.1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function starPoints(size) {
  return STAR[size] || [];
}

export function createBoard3D(scene, opts = {}) {
  const spacing = opts.spacing || 26;
  const renderer = opts.renderer;
  const root = new THREE.Group();
  root.name = "parksy-board3d";
  scene.add(root);

  const maxAniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  const woodBase = makeWoodTextures();
  woodBase.map.anisotropy = maxAniso;
  woodBase.bump.anisotropy = maxAniso;

  // ── 조명: 따뜻한 키 + 차가운 림. 돌의 광택과 판의 결을 살린다.
  //    판이 하얗게 타지 않도록 키를 낮추고, 요철·광택으로 입체를 만든다.
  const hemi = new THREE.HemisphereLight(0xffe6bc, 0x0a0d16, 0.42);
  const key = new THREE.DirectionalLight(0xffd2a0, 1.5);
  key.position.set(-220, -190, 420);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -420;
  key.shadow.camera.right = 420;
  key.shadow.camera.top = 420;
  key.shadow.camera.bottom = -420;
  key.shadow.camera.near = 40;
  key.shadow.camera.far = 1200;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 1.2;
  const rim = new THREE.DirectionalLight(0x7ba7ff, 0.62);
  rim.position.set(280, 200, 260);
  const front = new THREE.DirectionalLight(0xffc48a, 0.9);
  front.position.set(-120, -330, 260);
  const warm = new THREE.PointLight(0xffb067, 28, 1200, 2);
  warm.position.set(0, -40, 360);
  const spot = new THREE.SpotLight(0xffe3b8, 62, 1200, Math.PI / 4.6, 0.7, 1.4);
  spot.position.set(30, -60, 520);
  spot.target.position.set(0, 0, 0);
  root.add(hemi, key, key.target, rim, front, warm, spot, spot.target);

  // ── 테이블: 검은 가죽 위에 판이 놓인 느낌. 그림자를 받는다.
  const tableGeo = new THREE.PlaneGeometry(2400, 2400);
  const tableMat = new THREE.MeshStandardMaterial({
    map: makeTableTexture(),
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0.0,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.z = -46;
  table.receiveShadow = true;
  root.add(table);

  // 공용 재질
  const blackMat = new THREE.MeshPhysicalMaterial({
    color: 0x05060a,
    roughness: 0.26,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    reflectivity: 0.6,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4ecdb,
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.22,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xffe4bb),
    sheenRoughness: 0.6,
  });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x3c2010, roughness: 0.55, metalness: 0.06 });
  const gridMat = new THREE.MeshStandardMaterial({ color: 0x24140a, roughness: 0.7, metalness: 0.0 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd8ab61,
    roughness: 0.32,
    metalness: 0.55,
    emissive: 0x2a1a06,
    emissiveIntensity: 0.4,
  });
  const shadowTex = makeShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.78,
    toneMapped: false,
  });
  const stoneGeo = new THREE.SphereGeometry(1, 32, 20);
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);

  const boardGroup = new THREE.Group();
  root.add(boardGroup);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xe8bd78,
    emissive: 0xb87a24,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.75,
  });
  const dotMat = new THREE.MeshStandardMaterial({
    color: 0xff6154,
    emissive: 0xff3324,
    emissiveIntensity: 1.7,
    roughness: 0.4,
  });
  const selectMat = new THREE.MeshStandardMaterial({
    color: 0x8df6df,
    emissive: 0x24cdb0,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.5,
  });
  const lastRing = new THREE.Mesh(new THREE.TorusGeometry(STONE_R * 1.18, 0.8, 10, 64), ringMat);
  lastRing.castShadow = false;
  const lastDot = new THREE.Mesh(new THREE.SphereGeometry(2.7, 16, 12), dotMat);
  const selectRing = new THREE.Mesh(new THREE.TorusGeometry(STONE_R * 1.32, 0.58, 10, 64), selectMat);
  root.add(lastRing, lastDot, selectRing);

  // 미래의 돌은 형체가 남아야 한다. 발광을 낮춰 블룸이 돌을 삼키지 않게.
  const ghostMats = {
    [BLACK]: new THREE.MeshPhysicalMaterial({
      color: 0x4c6f9c, emissive: 0x122c4a, emissiveIntensity: 0.18,
      roughness: 0.4, metalness: 0.12, transparent: true, opacity: 0.46, depthWrite: false,
    }),
    [WHITE]: new THREE.MeshPhysicalMaterial({
      color: 0xf0dcae, emissive: 0x6d4a18, emissiveIntensity: 0.16,
      roughness: 0.4, metalness: 0.04, transparent: true, opacity: 0.46, depthWrite: false,
    }),
    candidate: new THREE.MeshPhysicalMaterial({
      color: 0xf3ffe9, emissive: 0x2f9b80, emissiveIntensity: 0.42,
      roughness: 0.3, metalness: 0.08, transparent: true, opacity: 0.66, depthWrite: false,
    }),
  };
  const ghostStones = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(stoneGeo, ghostMats[BLACK]);
    m.scale.set(STONE_R * 0.92, STONE_R * 0.92, STONE_R * 0.32);
    m.visible = false;
    m.castShadow = false;
    root.add(m);
    ghostStones.push(m);
  }

  let size = 0;
  let boardW = 0;
  let total = 0;
  let blackMesh = null;
  let whiteMesh = null;
  let shadowMesh = null;
  let disposableAssets = [];
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let lastIdx = null;
  let selectedIdx = null;
  let ghostLine = [];
  let ghostCandidate = null;

  function halfFor(s) {
    // 실제 바둑판처럼 격자 밖 여백은 한두 칸. 나무 결이 보일 만큼만 남긴다.
    return ((s - 1) * spacing) / 2 + (s >= 13 ? 54 : 46);
  }

  function worldX(idx, s) {
    const center = (s - 1) / 2;
    return ((idx % s) - center) * spacing;
  }
  function worldY(idx, s) {
    const center = (s - 1) / 2;
    return (center - ((idx / s) | 0)) * spacing;
  }

  function clearBoardGroup() {
    for (const child of boardGroup.children) {
      if (child.geometry && child.geometry !== stoneGeo && child.geometry !== shadowGeo && child.geometry !== unitBox) child.geometry.dispose();
    }
    boardGroup.clear();
    blackMesh = null;
    whiteMesh = null;
    shadowMesh = null;
    disposableAssets.forEach((x) => x?.dispose?.());
    disposableAssets = [];
  }

  function build(s) {
    if (s === size) return;
    clearBoardGroup();
    size = s;
    total = s * s;
    boardW = halfFor(s) * 2;
    const pad = (boardW - (s - 1) * spacing) / 2;

    // 나무 판: 모서리를 깎은 두꺼운 슬래브
    const tex = woodBase.map.clone();
    const bumpTex = woodBase.bump.clone();
    for (const t of [tex, bumpTex]) {
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(1 / boardW, 1 / boardW);
      t.offset.set(0.5, 0.5);
      t.anisotropy = maxAniso;
    }
    const topMat = new THREE.MeshPhysicalMaterial({
      map: tex,
      bumpMap: bumpTex,
      bumpScale: 0.42,
      color: 0xffffff,
      roughness: 0.46,
      metalness: 0.0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.24,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xffe7c2),
      sheenRoughness: 0.65,
    });
    // 측면도 같은 나무결을 어둡게 이어 붙인다. 단색 판때기 느낌을 지운다.
    const edgeMat = sideMat.clone();
    edgeMat.map = tex;
    edgeMat.color.set(0x82552f);
    edgeMat.roughness = 0.62;
    disposableAssets.push(topMat, edgeMat, tex, bumpTex);

    const shape = roundedRectShape(boardW, boardW, 13);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 26,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 5.0,
      bevelThickness: 3.6,
      curveSegments: 20,
    });
    geo.translate(0, 0, -(26 + 3.6) + BOARD_TOP);
    const board = new THREE.Mesh(geo, [topMat, edgeMat]);
    board.castShadow = true;
    board.receiveShadow = true;
    boardGroup.add(board);

    // 황동 테두리(판 가장자리 인레이)
    const trim = 2.4;
    const trimY = boardW / 2 - 5.4;
    const trimGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let k = 0; k < 4; k++) {
      const bar = new THREE.Mesh(trimGeo, brassMat);
      if (k < 2) bar.scale.set(boardW - 10, trim, 0.9);
      else bar.scale.set(trim, boardW - 10, 0.9);
      bar.position.set(k < 2 ? 0 : (k === 2 ? -trimY : trimY), k < 2 ? (k === 0 ? -trimY : trimY) : 0, BOARD_TOP + 0.12);
      bar.castShadow = false;
      boardGroup.add(bar);
    }

    // 격자: 얇은 각기둥을 인스턴싱해 3D로 새긴다. 판에 닿게 눌러 앉힌다.
    const gridLen = (s - 1) * spacing + 1.8;
    const gridGeo = new THREE.BoxGeometry(1, 1, 1);
    const gridMesh = new THREE.InstancedMesh(gridGeo, gridMat, s * 2);
    gridMesh.castShadow = false;
    gridMesh.receiveShadow = true;
    let gi = 0;
    for (let i = 0; i < s; i++) {
      const p = (i - (s - 1) / 2) * spacing;
      const edge = i === 0 || i === s - 1;
      const t = edge ? 1.8 : 0.95;
      matrix.compose(pos.set(0, p, GRID_Z), quat.identity(), scale.set(gridLen, t, 0.38));
      gridMesh.setMatrixAt(gi++, matrix);
      matrix.compose(pos.set(p, 0, GRID_Z), quat.identity(), scale.set(t, gridLen, 0.38));
      gridMesh.setMatrixAt(gi++, matrix);
    }
    gridMesh.instanceMatrix.needsUpdate = true;
    boardGroup.add(gridMesh);

    // 화점
    const stars = starPoints(s);
    if (stars.length) {
      const starGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.42, 20);
      const starMesh = new THREE.InstancedMesh(starGeo, gridMat, stars.length);
      starMesh.castShadow = false;
      starMesh.receiveShadow = true;
      stars.forEach(([x, y], i) => {
        matrix.compose(
          pos.set((x - (s - 1) / 2) * spacing, ((s - 1) / 2 - y) * spacing, GRID_Z + 0.24),
          quat.identity(),
          scale.set(1, 1, 1),
        );
        starMesh.setMatrixAt(i, matrix);
      });
      starMesh.instanceMatrix.needsUpdate = true;
      boardGroup.add(starMesh);
    }

    blackMesh = new THREE.InstancedMesh(stoneGeo, blackMat, total);
    whiteMesh = new THREE.InstancedMesh(stoneGeo, whiteMat, total);
    for (const m of [blackMesh, whiteMesh]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      boardGroup.add(m);
    }

    shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, total);
    shadowMesh.frustumCulled = false;
    shadowMesh.renderOrder = 2;
    shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    shadowMesh.count = 0;
    boardGroup.add(shadowMesh);

    // 판 크기가 바뀌면 오버레이 위치도 갱신
    lastRing.visible = false;
    lastDot.visible = false;
    selectRing.visible = false;
    lastIdx = null;
    selectedIdx = null;
  }

  function placeStone(mesh, slot, idx) {
    const x = worldX(idx, size);
    const y = worldY(idx, size);
    matrix.compose(pos.set(x, y, STONE_Z), quat.identity(), scale.set(STONE_R, STONE_R, STONE_R * 0.335));
    mesh.setMatrixAt(slot, matrix);
  }

  function placeShadow(slot, idx) {
    const x = worldX(idx, size);
    const y = worldY(idx, size);
    // 빛은 왼쪽 아래에서 온다. 그림자는 오른쪽 위로 살짝 밀린다.
    // PlaneGeometry(1,1)의 scale은 지름이다. 돌 지름의 1.6배까지 깔아야
    // 돌 밖으로 떨어지는 접촉 그림자가 보인다.
    matrix.compose(
      pos.set(x + STONE_R * 0.34, y + STONE_R * 0.46, BOARD_TOP + 0.28),
      quat.identity(),
      scale.set(STONE_R * 3.35, STONE_R * 3.05, 1),
    );
    shadowMesh.setMatrixAt(slot, matrix);
  }

  function sync(data = {}) {
    const s = data.size || size;
    if (s !== size) build(s);
    const board = data.board || [];
    lastIdx = Number.isInteger(data.lastMove) ? data.lastMove : null;
    selectedIdx = Number.isInteger(data.selected) ? data.selected : null;

    // 타이틀용 전시 기보. 실제 대국판(board)을 건드리지 않고 돌만 얹는다.
    const showcase = Array.isArray(data.showcase) ? data.showcase : [];
    const showcaseLast = Number.isInteger(data.showcaseLast) ? data.showcaseLast : null;
    const entries = [];
    for (let i = 0; i < total; i++) {
      const c = board[i];
      if (c === BLACK || c === WHITE) entries.push([i, c]);
    }
    for (const s of showcase) {
      const idx = s?.idx;
      const c = s?.color;
      if (!Number.isInteger(idx) || idx < 0 || idx >= total) continue;
      if (board[idx]) continue;
      if (c !== BLACK && c !== WHITE) continue;
      if (entries.some(([j]) => j === idx)) continue;
      entries.push([idx, c]);
    }

    if (blackMesh && whiteMesh) {
      let bi = 0;
      let wi = 0;
      let si = 0;
      for (const [i, c] of entries) {
        if (c === BLACK) {
          if (bi < total) placeStone(blackMesh, bi++, i);
        } else if (c === WHITE) {
          if (wi < total) placeStone(whiteMesh, wi++, i);
        }
        if (si < total) placeShadow(si++, i);
      }
      blackMesh.count = bi;
      whiteMesh.count = wi;
      blackMesh.instanceMatrix.needsUpdate = true;
      whiteMesh.instanceMatrix.needsUpdate = true;
      if (shadowMesh) {
        shadowMesh.count = si;
        shadowMesh.instanceMatrix.needsUpdate = true;
      }
    }

    // 마지막 수: 붉은 점 + 금빛 고리. 전시 기보도 마지막 한 점을 가질 수 있다.
    const lastBoardIdx =
      lastIdx !== null && (board[lastIdx] === BLACK || board[lastIdx] === WHITE) ? lastIdx : null;
    const hasShowLast =
      showcaseLast !== null && showcase.some((s) => s?.idx === showcaseLast);
    const markerIdx = lastBoardIdx ?? (hasShowLast ? showcaseLast : null);
    lastRing.visible = markerIdx !== null;
    lastDot.visible = markerIdx !== null;
    if (markerIdx !== null) {
      const x = worldX(markerIdx, size);
      const y = worldY(markerIdx, size);
      lastRing.position.set(x, y, STONE_Z + STONE_R * 0.3);
      lastDot.position.set(x, y, STONE_Z + STONE_R * 0.36 + 0.2);
    }

    // 선택한 교점 — 빈 교점이면 판 위, 돌이면 돌 아래둘레에 앉힌다.
    selectRing.visible = selectedIdx !== null;
    if (selectedIdx !== null) {
      selectRing.position.set(worldX(selectedIdx, size), worldY(selectedIdx, size), GRID_Z + 0.32);
    }

    // 미래 세 수: 반투명 돌 + 후보 고리
    ghostLine = Array.isArray(data.future?.line) ? data.future.line : [];
    ghostCandidate = Number.isInteger(data.future?.candidate) ? data.future.candidate : null;
    ghostStones.forEach((m, i) => {
      const mv = ghostLine[i];
      if (!mv) {
        m.visible = false;
        return;
      }
      m.visible = true;
      const candidate = mv.idx === ghostCandidate;
      m.material = candidate ? ghostMats.candidate : ghostMats[mv.color === BLACK ? BLACK : WHITE];
      const lift = 1.5 + i * 0.85;
      m.position.set(worldX(mv.idx, size), worldY(mv.idx, size), STONE_Z + lift);
      const sc = candidate ? 1.05 : 0.9;
      m.scale.set(STONE_R * sc, STONE_R * sc, STONE_R * 0.32);
      m.userData.baseZ = STONE_Z + lift;
    });
  }

  let t0 = 0;
  function update(dt, now) {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    if (lastDot.visible) lastDot.scale.setScalar(1 + Math.sin(t * 4.2) * 0.11);
    if (lastRing.visible) {
      lastRing.rotation.z = t * 0.32;
      lastRing.scale.setScalar(1 + Math.sin(t * 2.2) * 0.018);
    }
    if (selectRing.visible) {
      selectRing.rotation.z = -t * 0.45;
      selectRing.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
    }
    for (const m of ghostStones) {
      if (!m.visible) continue;
      const base = m.userData.baseZ || 4;
      m.position.z = base + Math.sin(t * 2.6 + m.position.x * 0.01) * 0.55;
    }
  }

  function setSize(s) {
    if (s !== size) build(s);
  }

  function dispose() {
    clearBoardGroup();
    root.removeFromParent();
    woodBase.map.dispose();
    woodBase.bump.dispose();
    tableGeo.dispose();
    tableMat.map?.dispose();
    tableMat.dispose();
    stoneGeo.dispose();
    shadowGeo.dispose();
    shadowMat.dispose();
    shadowTex.dispose();
    unitBox.dispose();
    blackMat.dispose();
    whiteMat.dispose();
    sideMat.dispose();
    gridMat.dispose();
    brassMat.dispose();
    ringMat.dispose();
    dotMat.dispose();
    selectMat.dispose();
    Object.values(ghostMats).forEach((m) => m.dispose());
  }

  // 초기 크기
  build(opts.size || 19);

  return { group: root, build, setSize, sync, update, dispose, halfFor, worldX, worldY, get size() { return size; } };
}
