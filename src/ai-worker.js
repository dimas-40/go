// PARKSY GO — AI 워커. UI 스레드를 멈추지 않고 플레이아웃을 돌린다.
import { GoEngine } from "./go-engine.js";
import { chooseMove } from "./go-ai.js";

self.onmessage = (ev) => {
  const { id, state, opts } = ev.data || {};
  try {
    const engine = GoEngine.fromState(state);
    const result = chooseMove(engine, opts || {});
    self.postMessage({ id, ok: true, result });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e?.message || e) });
  }
};
