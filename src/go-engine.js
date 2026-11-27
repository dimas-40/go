// PARKSY GO — 바둑 규칙 엔진 (의존성 0)
// 보드: 0=빈점, 1=흑, 2=백. 착수 · 따냄 · 자살 · 패 · 슈퍼코 · 계가 · SGF.
// 그래프 층(src/graph.js)과 AI(src/go-ai.js)가 이 엔진 하나를 공유한다.

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const LETTERS = "ABCDEFGHJKLMNOPQRST"; // 바둑 좌표는 I를 쓰지 않는다

export const opponent = (c) => (c === BLACK ? WHITE : BLACK);

export function coordName(idx, size) {
  if (idx === null || idx === undefined) return "패스";
  const x = idx % size;
  const y = (idx / size) | 0;
  return `${LETTERS[x]}${size - y}`;
}

export function coordIndex(name, size) {
  const m = /^([A-HJ-T])(\d{1,2})$/i.exec(String(name).trim());
  if (!m) return -1;
  const x = LETTERS.indexOf(m[1].toUpperCase());
  const y = size - Number(m[2]);
  if (x < 0 || y < 0 || y >= size) return -1;
  return y * size + x;
}

const NEIGHBOR_CACHE = new Map();
function neighborsFor(size) {
  const hit = NEIGHBOR_CACHE.get(size);
  if (hit) return hit;
  const total = size * size;
  const nbr = new Array(total);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const a = [];
      if (x > 0) a.push(idx - 1);
      if (x + 1 < size) a.push(idx + 1);
      if (y > 0) a.push(idx - size);
      if (y + 1 < size) a.push(idx + size);
      nbr[idx] = a;
    }
  }
  NEIGHBOR_CACHE.set(size, nbr);
  return nbr;
}

export class GoEngine {
  constructor(size = 19, { komi = 6.5, rules = "chinese", superko = true } = {}) {
    if (![9, 13, 19].includes(size)) throw new Error(`unsupported board size: ${size}`);
    this.size = size;
    this.total = size * size;
    this.komi = Number(komi);
    this.rules = rules;
    this.superko = !!superko;
    this.nbr = neighborsFor(size);
    this.reset();
  }

  reset() {
    this.board = new Uint8Array(this.total);
    this.turn = BLACK;
    this.ko = null; // 단순 패: 즉시 재따냄 금지 점
    this.captures = { [BLACK]: 0, [WHITE]: 0 }; // 각 색이 따낸 돌 수
    this.passes = 0;
    this.history = []; // 각 항목 = 착수 직전 상태 + move
    this.hashes = [this._positionKey(BLACK)];
    this.gameOver = false;
    this.result = null;
    this.lastMove = null;
    this.lastMoveColor = null;
    this.moveNumber = 0;
  }

  // ── 해시 · 상태 ─────────────────────────────────────────────
  _positionKey(turn = this.turn) {
    let h = (2166136261 ^ turn) >>> 0;
    for (let i = 0; i < this.total; i++) {
      h ^= this.board[i];
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  _positionKeyOn(board, turn) {
    let h = (2166136261 ^ turn) >>> 0;
    for (let i = 0; i < this.total; i++) {
      h ^= board[i];
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  _snapshot() {
    return {
      board: this.board.slice(),
      turn: this.turn,
      ko: this.ko,
      captures: { ...this.captures },
      passes: this.passes,
      lastMove: this.lastMove,
      lastMoveColor: this.lastMoveColor,
      moveNumber: this.moveNumber,
      gameOver: this.gameOver,
      result: this.result,
      hashLen: this.hashes.length,
      move: null,
    };
  }

  _restore(s) {
    this.board.set(s.board);
    this.turn = s.turn;
    this.ko = s.ko;
    this.captures = { ...s.captures };
    this.passes = s.passes;
    this.lastMove = s.lastMove;
    this.lastMoveColor = s.lastMoveColor;
    this.moveNumber = s.moveNumber;
    this.gameOver = s.gameOver;
    this.result = s.result;
    if (this.hashes.length > s.hashLen) this.hashes.length = s.hashLen;
  }

  // ── 집단 · 활로 ─────────────────────────────────────────────
  _groupAtOn(board, idx) {
    const color = board[idx];
    if (!color) return { color: 0, stones: [], liberties: [] };
    const seen = new Uint8Array(this.total);
    const libSeen = new Uint8Array(this.total);
    const stones = [];
    const liberties = [];
    const stack = [idx];
    seen[idx] = 1;
    while (stack.length) {
      const p = stack.pop();
      stones.push(p);
      for (const q of this.nbr[p]) {
        const v = board[q];
        if (v === EMPTY) {
          if (!libSeen[q]) {
            libSeen[q] = 1;
            liberties.push(q);
          }
        } else if (v === color && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    return { color, stones, liberties };
  }

  groupAt(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.total || !this.board[idx]) return null;
    return this._groupAtOn(this.board, idx);
  }

  groups() {
    const seen = new Uint8Array(this.total);
    const out = [];
    for (let i = 0; i < this.total; i++) {
      if (!this.board[i] || seen[i]) continue;
      const g = this._groupAtOn(this.board, i);
      for (const s of g.stones) seen[s] = 1;
      out.push({ id: out.length + 1, ...g });
    }
    return out;
  }

  // ── 착수 시뮬레이션(보드를 실제로 바꿨다가 호출자가 되돌린다) ──
  _applyOnBoard(board, idx, color) {
    const opp = opponent(color);
    board[idx] = color;
    const captured = [];
    const seen = new Uint8Array(this.total);
    for (const nb of this.nbr[idx]) {
      if (board[nb] !== opp || seen[nb]) continue;
      const g = this._groupAtOn(board, nb);
      for (const s of g.stones) seen[s] = 1;
      if (g.liberties.length === 0) {
        for (const s of g.stones) {
          board[s] = EMPTY;
          captured.push(s);
        }
      }
    }
    const own = this._groupAtOn(board, idx);
    const suicide = own.liberties.length === 0;
    let koPoint = null;
    if (!suicide && captured.length === 1 && own.stones.length === 1 && own.liberties.length === 1) {
      koPoint = captured[0];
    }
    return { ok: !suicide, suicide, captured, own, koPoint };
  }

  // ── 합법성 ──────────────────────────────────────────────────
  isLegal(idx, { avoidEyes = false, fast = false } = {}) {
    if (this.gameOver) return false;
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.total) return false;
    if (this.board[idx] !== EMPTY || idx === this.ko) return false;
    if (avoidEyes && this.isEye(idx, this.turn)) return false;
    const board = this.board.slice();
    const res = this._applyOnBoard(board, idx, this.turn);
    if (!res.ok) return false;
    if (!fast && this.superko) {
      const key = this._positionKeyOn(board, opponent(this.turn));
      if (this.hashes.includes(key)) return false;
    }
    return true;
  }

  legalMoves({ avoidEyes = false, fast = false, nearOnly = false } = {}) {
    const out = [];
    const near = nearOnly ? this._nearEmpty() : null;
    const turn = this.turn;
    for (let idx = 0; idx < this.total; idx++) {
      if (this.board[idx] !== EMPTY || idx === this.ko) continue;
      if (near && !near[idx]) continue;
      if (avoidEyes && this.isEye(idx, turn)) continue;
      const board = this.board.slice();
      const res = this._applyOnBoard(board, idx, turn);
      if (!res.ok) continue;
      if (!fast && this.superko) {
        const key = this._positionKeyOn(board, opponent(turn));
        if (this.hashes.includes(key)) continue;
      }
      out.push(idx);
    }
    return out;
  }

  _nearEmpty() {
    const mark = new Uint8Array(this.total);
    let any = false;
    for (let i = 0; i < this.total; i++) {
      if (!this.board[i]) continue;
      any = true;
      mark[i] = 1;
      for (const q of this.nbr[i]) mark[q] = 1;
    }
    if (!any) mark.fill(1);
    return mark;
  }

  // ── 착수 · 패스 · 기권 · 무르기 ─────────────────────────────
  play(idx, opts = {}) {
    if (this.gameOver) return { ok: false, reason: "game-over" };
    if (idx === null || idx === undefined) return this.pass();
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.total) return { ok: false, reason: "out-of-board" };
    if (this.board[idx] !== EMPTY) return { ok: false, reason: "occupied" };
    if (idx === this.ko) return { ok: false, reason: "ko" };

    const color = this.turn;
    const snap = this._snapshot();
    const res = this._applyOnBoard(this.board, idx, color);
    if (!res.ok) {
      this._restore(snap);
      return { ok: false, reason: "suicide" };
    }
    const nextTurn = opponent(color);
    const key = this._positionKeyOn(this.board, nextTurn);
    if (!opts.fast && this.superko && this.hashes.includes(key)) {
      this._restore(snap);
      return { ok: false, reason: "superko" };
    }

    this.captures[color] += res.captured.length;
    this.turn = nextTurn;
    this.ko = res.koPoint;
    this.passes = 0;
    this.lastMove = idx;
    this.lastMoveColor = color;
    this.moveNumber++;
    this.gameOver = false;
    this.result = null;
    snap.move = { color, idx, pass: false, number: this.moveNumber };
    this.history.push(snap);
    this.hashes.push(key);
    return {
      ok: true,
      color,
      idx,
      captured: res.captured,
      own: res.own,
      ko: this.ko,
      nextTurn: this.turn,
      moveNumber: this.moveNumber,
    };
  }

  pass() {
    if (this.gameOver) return { ok: false, reason: "game-over" };
    const color = this.turn;
    const snap = this._snapshot();
    this.passes++;
    this.turn = opponent(color);
    this.ko = null;
    this.lastMove = null;
    this.lastMoveColor = color;
    this.moveNumber++;
    this.hashes.push(this._positionKey(this.turn));
    snap.move = { color, idx: null, pass: true, number: this.moveNumber };
    this.history.push(snap);
    if (this.passes >= 2) {
      this.gameOver = true;
      this.result = { ...this.score(), reason: "two-pass" };
    }
    return { ok: true, pass: true, color, nextTurn: this.turn, moveNumber: this.moveNumber, gameOver: this.gameOver };
  }

  resign(color = this.turn) {
    if (this.gameOver) return { ok: false, reason: "game-over" };
    const snap = this._snapshot();
    this.gameOver = true;
    const winner = opponent(color);
    const s = this.score();
    this.result = { ...s, winner, loser: color, reason: "resign" };
    snap.move = null;
    this.history.push(snap);
    return { ok: true, winner, loser: color, result: this.result };
  }

  undo() {
    if (!this.history.length) return { ok: false, reason: "empty-history" };
    const snap = this.history.pop();
    this._restore(snap);
    return { ok: true, move: snap.move };
  }

  // ── 빠른 시뮬레이션(AI 플레이아웃 전용 · 기록 없음) ───────────
  cloneFast() {
    const e = new GoEngine(this.size, { komi: this.komi, rules: this.rules, superko: false });
    e.board.set(this.board);
    e.turn = this.turn;
    e.ko = this.ko;
    e.captures = { ...this.captures };
    e.passes = this.passes;
    e.gameOver = this.gameOver;
    e.lastMove = this.lastMove;
    e.lastMoveColor = this.lastMoveColor;
    e.moveNumber = this.moveNumber;
    e.hashes = [];
    return e;
  }

  playFast(idx) {
    if (this.gameOver) return { ok: false, reason: "game-over" };
    if (idx === null || idx === undefined) return this.passFast();
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.total) return { ok: false, reason: "out-of-board" };
    if (this.board[idx] !== EMPTY || idx === this.ko) return { ok: false, reason: "illegal" };
    const color = this.turn;
    const saved = this.board.slice();
    const res = this._applyOnBoard(this.board, idx, color);
    if (!res.ok) {
      this.board.set(saved);
      return { ok: false, reason: "suicide" };
    }
    this.captures[color] += res.captured.length;
    this.turn = opponent(color);
    this.ko = res.koPoint;
    this.passes = 0;
    this.lastMove = idx;
    this.lastMoveColor = color;
    this.moveNumber++;
    return { ok: true, color, idx, captured: res.captured, own: res.own, nextTurn: this.turn, moveNumber: this.moveNumber };
  }

  passFast() {
    if (this.gameOver) return { ok: false, reason: "game-over" };
    const color = this.turn;
    this.passes++;
    this.turn = opponent(color);
    this.ko = null;
    this.lastMove = null;
    this.lastMoveColor = color;
    this.moveNumber++;
    if (this.passes >= 2) this.gameOver = true;
    return { ok: true, pass: true, color, nextTurn: this.turn, gameOver: this.gameOver };
  }

  // ── 눈(eye) ─────────────────────────────────────────────────
  isEye(idx, color = this.turn) {
    if (this.board[idx] !== EMPTY) return false;
    const size = this.size;
    const x = idx % size;
    const y = (idx / size) | 0;
    for (const nb of this.nbr[idx]) if (this.board[nb] !== color) return false;
    let ownDiag = 0;
    let diag = 0;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      diag++;
      if (this.board[ny * size + nx] === color) ownDiag++;
    }
    return ownDiag >= Math.min(3, diag);
  }

  // ── 계가 ────────────────────────────────────────────────────
  territory() {
    const owner = new Int8Array(this.total);
    const seen = new Uint8Array(this.total);
    for (let start = 0; start < this.total; start++) {
      if (this.board[start] !== EMPTY || seen[start]) continue;
      const region = [];
      const stack = [start];
      const border = new Set();
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        region.push(p);
        for (const q of this.nbr[p]) {
          const v = this.board[q];
          if (v === EMPTY) {
            if (!seen[q]) {
              seen[q] = 1;
              stack.push(q);
            }
          } else border.add(v);
        }
      }
      if (border.size === 1) {
        const c = [...border][0];
        for (const p of region) owner[p] = c;
      }
    }
    return owner;
  }

  score(mode = "area") {
    const terr = this.territory();
    let blackStones = 0, whiteStones = 0, blackTerritory = 0, whiteTerritory = 0, neutral = 0;
    for (let i = 0; i < this.total; i++) {
      if (this.board[i] === BLACK) blackStones++;
      else if (this.board[i] === WHITE) whiteStones++;
      else if (terr[i] === BLACK) blackTerritory++;
      else if (terr[i] === WHITE) whiteTerritory++;
      else neutral++;
    }
    const black = mode === "territory"
      ? blackTerritory + this.captures[BLACK]
      : blackStones + blackTerritory;
    const white = mode === "territory"
      ? whiteTerritory + this.captures[WHITE] + this.komi
      : whiteStones + whiteTerritory + this.komi;
    const diff = black - white;
    const winner = Math.abs(diff) < 1e-9 ? 0 : diff > 0 ? BLACK : WHITE;
    return {
      mode,
      black,
      white,
      komi: this.komi,
      diff,
      margin: Math.abs(diff),
      winner,
      blackStones,
      whiteStones,
      blackTerritory,
      whiteTerritory,
      neutral,
      captures: { ...this.captures },
    };
  }

  // ── SGF ─────────────────────────────────────────────────────
  toSGF() {
    const props = [
      "GM[1]",
      "FF[4]",
      "CA[UTF-8]",
      "AP[parksy-go:1]",
      `SZ[${this.size}]`,
      `KM[${this.komi}]`,
      `RU[${this.rules === "chinese" ? "Chinese" : "Japanese"}]`,
    ];
    if (this.result) {
      const r = this.result;
      const w = r.winner === BLACK ? "B" : r.winner === WHITE ? "W" : "0";
      props.push(`RE[${w}${w === "0" ? "" : "+" + (r.margin ?? "")}]`);
    }
    let sgf = `(;${props.join("")}`;
    for (const h of this.history) {
      if (!h.move) continue;
      const { color, idx, pass } = h.move;
      const c = color === BLACK ? "B" : "W";
      if (pass) sgf += `;${c}[]`;
      else {
        const x = idx % this.size;
        const y = (idx / this.size) | 0;
        sgf += `;${c}[${LETTERS[x].toLowerCase()}${LETTERS[y].toLowerCase()}]`;
      }
    }
    return sgf + ")";
  }

  static fromSGF(sgf) {
    const text = String(sgf);
    const size = Number(/SZ\[(\d+)\]/.exec(text)?.[1] || 19);
    const komi = Number(/KM\[([\d.]+)\]/.exec(text)?.[1] || 6.5);
    const rules = /RU\[(Japanese|Korean|AGA)\]/i.test(text) ? "japanese" : "chinese";
    const e = new GoEngine(size, { komi, rules });
    const re = /;([BW])\[([a-s]{0,2})\]/g;
    let m;
    while ((m = re.exec(text))) {
      const color = m[1] === "B" ? BLACK : WHITE;
      if (color !== e.turn) throw new Error(`SGF turn mismatch at move ${e.moveNumber + 1}`);
      const xy = m[2];
      if (!xy || xy === "tt") {
        const r = e.pass();
        if (!r.ok) throw new Error(`SGF pass rejected: ${r.reason}`);
      } else {
        const x = LETTERS.toLowerCase().indexOf(xy[0]);
        const y = LETTERS.toLowerCase().indexOf(xy[1]);
        if (x < 0 || y < 0 || x >= size || y >= size) throw new Error(`SGF bad point: ${xy}`);
        const r = e.play(y * size + x);
        if (!r.ok) throw new Error(`SGF move rejected at ${e.moveNumber + 1}: ${r.reason}`);
      }
    }
    return e;
  }

  // ── 워커 전송용 ──────────────────────────────────────────────
  serialize() {
    return {
      size: this.size,
      board: Array.from(this.board),
      turn: this.turn,
      ko: this.ko,
      captures: { ...this.captures },
      passes: this.passes,
      komi: this.komi,
      rules: this.rules,
      superko: this.superko,
      gameOver: this.gameOver,
      lastMove: this.lastMove,
      lastMoveColor: this.lastMoveColor,
      moveNumber: this.moveNumber,
      hashes: [...this.hashes],
    };
  }

  static fromState(s) {
    const e = new GoEngine(s.size, { komi: s.komi, rules: s.rules, superko: s.superko !== false });
    e.board.set(s.board);
    e.turn = s.turn;
    e.ko = s.ko;
    e.captures = { ...s.captures };
    e.passes = s.passes;
    e.gameOver = s.gameOver;
    e.lastMove = s.lastMove;
    e.lastMoveColor = s.lastMoveColor;
    e.moveNumber = s.moveNumber;
    e.hashes = Array.isArray(s.hashes) ? [...s.hashes] : [e._positionKey(e.turn)];
    return e;
  }
}
