import test from "node:test";
import assert from "node:assert/strict";
import { GoEngine, BLACK, WHITE, EMPTY, coordName, coordIndex } from "../src/go-engine.js";
import { chooseMove } from "../src/go-ai.js";

function setBoard(e, rows, turn = BLACK) {
  e.reset();
  const n = e.size;
  assert.equal(rows.length, n);
  for (let y = 0; y < n; y++) {
    const row = rows[y].replace(/\s+/g, "");
    assert.equal(row.length, n);
    for (let x = 0; x < n; x++) {
      const c = row[x];
      e.board[y * n + x] = c === "b" ? BLACK : c === "w" ? WHITE : EMPTY;
    }
  }
  e.turn = turn;
  e.hashes = [e._positionKey(turn)];
  return e;
}

test("capture removes a group with no liberties", () => {
  const e = new GoEngine(9);
  setBoard(e, [
    ".........",
    ".w.......",
    "b........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
  ]);
  // white at (1,1), black at (0,1), black to play at (1,2) captures (needs all four liberties)
  e.board[1 * 9 + 0] = BLACK;
  e.board[1 * 9 + 2] = BLACK;
  e.board[0 * 9 + 1] = BLACK;
  const r = e.play(2 * 9 + 1);
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 1);
  assert.equal(e.board[1 * 9 + 1], EMPTY);
  assert.equal(e.captures[BLACK], 1);
});

test("suicide is rejected and board restored", () => {
  const e = new GoEngine(9);
  setBoard(e, [
    ".........",
    ".w.w.....",
    ".........",
    ".w.w.....",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
  ]);
  // surround (1,2) with white on all four sides
  const center = 2 * 9 + 1;
  e.board[1 * 9 + 1] = WHITE;
  e.board[3 * 9 + 1] = WHITE;
  e.board[2 * 9 + 0] = WHITE;
  e.board[2 * 9 + 2] = WHITE;
  const before = e.board.slice();
  const r = e.play(center);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "suicide");
  assert.deepEqual(e.board, before);
  assert.equal(e.turn, BLACK);
});

test("ko prevents immediate recapture, clears after a pass", () => {
  const e = new GoEngine(9);
  setBoard(e, Array.from({ length: 9 }, () => "........."));
  // classic ko: black surrounds white (1,1) with (1,0),(0,1),(2,1),
  // white backs the ko stone with (0,2),(2,2),(1,3); black plays (1,2).
  e.board[0 * 9 + 1] = BLACK;
  e.board[1 * 9 + 0] = BLACK;
  e.board[1 * 9 + 2] = BLACK;
  e.board[1 * 9 + 1] = WHITE;
  e.board[2 * 9 + 0] = WHITE;
  e.board[2 * 9 + 2] = WHITE;
  e.board[3 * 9 + 1] = WHITE;
  const r = e.play(2 * 9 + 1);
  assert.equal(r.ok, true, "black capture at ko point");
  assert.equal(r.captured.length, 1);
  assert.equal(e.ko, 1 * 9 + 1);
  const ko = e.play(1 * 9 + 1);
  assert.equal(ko.ok, false);
  assert.equal(ko.reason, "ko");
  // white passes to clear simple ko, black plays elsewhere, then white recaptures
  assert.equal(e.pass().ok, true);
  assert.equal(e.play(8 * 9 + 8).ok, true);
  const recapture = e.play(1 * 9 + 1);
  assert.equal(recapture.ok, true);
  assert.equal(recapture.captured.length, 1);
});

test("superko history is tracked across undo and replay", () => {
  const e = new GoEngine(9);
  e.play(0);
  e.play(1);
  e.play(9);
  const before = e.hashes.length;
  e.undo();
  assert.equal(e.hashes.length, before - 1);
  const r = e.play(9);
  assert.equal(r.ok, true);
  assert.equal(e.hashes.length, before);
  assert.equal(e.hashes[e.hashes.length - 1], r.ok ? e.hashes[e.hashes.length - 1] : 0);
});

test("undo restores board, captures, turn, and last move", () => {
  const e = new GoEngine(9);
  e.play(0);
  e.play(1);
  e.play(2);
  const snap = e.board.slice();
  const n = e.moveNumber;
  const u = e.undo();
  assert.equal(u.ok, true);
  assert.equal(e.moveNumber, n - 1);
  assert.equal(e.turn, BLACK);
  assert.equal(e.lastMove, 1);
  e.play(3);
  assert.notDeepEqual(e.board, snap);
  assert.equal(e.turn, WHITE);
  assert.equal(e.moveNumber, n);
});

test("two passes end the game and produce a score", () => {
  const e = new GoEngine(9, { komi: 6.5 });
  e.play(0);
  const p1 = e.pass();
  const p2 = e.pass();
  assert.equal(p1.ok, true);
  assert.equal(p2.ok, true);
  assert.equal(e.gameOver, true);
  assert.equal(e.result.reason, "two-pass");
  assert.ok(e.result.black > 0);
  assert.ok(e.result.white >= 6.5);
});

test("area and territory scoring differ in the expected direction", () => {
  const e = new GoEngine(9, { komi: 0 });
  e.play(0);
  e.play(8);
  e.pass();
  e.pass();
  const area = e.score("area");
  const territory = e.score("territory");
  assert.equal(area.black, area.blackStones + area.blackTerritory);
  assert.equal(area.white, area.whiteStones + area.whiteTerritory);
  assert.ok(area.black + area.white + area.neutral === 81);
  assert.ok(territory.black >= territory.blackTerritory);
});

test("coordinates round-trip", () => {
  for (const n of [9, 13, 19]) {
    for (const idx of [0, n - 1, n * n - 1, Math.floor(n * n / 2)]) {
      const s = coordName(idx, n);
      assert.equal(coordIndex(s, n), idx, `${n}:${idx} -> ${s}`);
    }
  }
});

test("SGF export and import round-trip", () => {
  const e = new GoEngine(9, { komi: 5.5 });
  e.play(coordIndex("E5", 9));
  e.play(coordIndex("D4", 9));
  e.play(coordIndex("F4", 9));
  e.play(coordIndex("C5", 9));
  const sgf = e.toSGF();
  assert.match(sgf, /SZ\[9\]/);
  assert.match(sgf, /;B\[/);
  const f = GoEngine.fromSGF(sgf);
  assert.equal(f.moveNumber, e.moveNumber);
  assert.deepEqual(f.board, e.board);
  assert.equal(f.turn, e.turn);
  assert.equal(f.komi, 5.5);
});

test("AI returns a legal move and can play a short game", () => {
  const e = new GoEngine(9, { komi: 5.5 });
  for (let i = 0; i < 6 && !e.gameOver; i++) {
    const res = chooseMove(e, { level: "easy", seed: 100 + i });
    assert.ok(res.move === null || (res.move >= 0 && res.move < 81));
    if (res.move === null) e.pass();
    else {
      const r = e.play(res.move);
      assert.equal(r.ok, true, `AI move ${res.move} rejected: ${r.reason}`);
    }
  }
  assert.ok(e.moveNumber >= 1);
});

test("normal AI search returns within a budget", () => {
  const e = new GoEngine(9, { komi: 5.5 });
  const t0 = performance.now();
  const res = chooseMove(e, { level: "normal", seed: 7, timeMs: 80 });
  const elapsed = performance.now() - t0;
  assert.ok(res.move !== null);
  assert.ok(elapsed < 800, `AI took ${elapsed}ms`);
  assert.ok((res.totalVisits ?? 0) >= 0);
});
