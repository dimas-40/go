// PARKSY GO — 소리. 외부 음원 없이 Web Audio로 돌을 깎고, 나무를 두드린다.
// 돌소리는 세 겹이다: 판에 닿는 순간의 마찰(노이즈), 돌 몸체의 울림(저역),
// 그리고 방 안으로 퍼지는 잔향. 흑은 낮고 둔탁하게, 백은 조금 더 밝게.
import { hasVoiceLine, voiceFile } from "./voice-lines.js";

let ctx = null;
let master = null;
let ambient = null;
let reverb = null;
let noiseBuffer = null;
let voiceOn = true;

function ac() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  master = ctx.createGain();
  master.gain.value = 0.62;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 10;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.22;
  master.connect(limiter).connect(ctx.destination);
  // 작은 전시장 잔향 — 돌소리가 판 위에서 한 번 튄다.
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(1.4, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.16;
  reverb.connect(wet).connect(master);
  noiseBuffer = makeNoise(0.18);
  return ctx;
}

function makeNoise(sec) {
  const a = ctx || ac();
  if (!a) return null;
  const len = Math.max(1, Math.floor(a.sampleRate * sec));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function impulse(sec, decay) {
  const a = ctx || ac();
  if (!a) return null;
  const len = Math.floor(a.sampleRate * sec);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function panner(pan) {
  const a = ac();
  if (!a?.createStereoPanner) return null;
  const p = a.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan || 0));
  return p;
}

function output(node, pan, wet = 0.35) {
  const a = ac();
  if (!a) return;
  const p = panner(pan);
  const g = a.createGain();
  g.gain.value = 1;
  if (p) {
    node.connect(p).connect(g);
  } else {
    node.connect(g);
  }
  g.connect(master);
  if (reverb && wet > 0) {
    const send = a.createGain();
    send.gain.value = wet;
    g.connect(send).connect(reverb);
  }
}

export function initAudio() {
  const a = ac();
  if (!a) return;
  if (a.state === "suspended") a.resume().catch(() => {});
  startAmbience();
}

export function startAmbience() {
  const a = ac();
  if (!a || ambient) return;
  const g = a.createGain();
  g.gain.value = 0.0;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 240;
  filter.Q.value = 0.6;
  const o1 = a.createOscillator();
  o1.type = "sine";
  o1.frequency.value = 55;
  const o2 = a.createOscillator();
  o2.type = "sine";
  o2.frequency.value = 82.5;
  const o2g = a.createGain();
  o2g.gain.value = 0.35;
  const lfo = a.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = a.createGain();
  lfoGain.gain.value = 14;
  lfo.connect(lfoGain).connect(filter.frequency);
  o1.connect(filter);
  o2.connect(o2g).connect(filter);
  filter.connect(g).connect(master);
  o1.start();
  o2.start();
  lfo.start();
  g.gain.setTargetAtTime(0.026, a.currentTime, 2.4);
  ambient = { g, o1, o2, lfo };
}

// 짧은 나무/돌 클릭. freq는 몸통 울림, noiseFreq는 표면 마찰.
function stoneClick({ color = 1, pan = 0, gain = 1 } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const black = color !== 2;
  // 손맛이 매번 같지 않도록 아주 조금씩 음정을 흔든다.
  const jitter = 0.972 + Math.random() * 0.056;
  const body = (black ? 176 : 238) * jitter;
  const bodyEnd = (black ? 92 : 132) * jitter;
  const surface = (black ? 1650 : 2350) * jitter;
  const level = black ? 0.55 : 0.5;

  // 1) 판에 닿는 마찰 — 아주 짧은 대역 노이즈.
  if (noiseBuffer) {
    const src = a.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(surface, t);
    bp.frequency.exponentialRampToValueAtTime(surface * 0.62, t + 0.012);
    bp.Q.value = 1.4;
    const ng = a.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.19 * level * gain, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    src.connect(bp).connect(ng);
    output(ng, pan, 0.18);
    src.start(t);
    src.stop(t + 0.2);
  }

  // 2) 돌 몸통의 짧은 울림.
  const o = a.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(body, t);
  o.frequency.exponentialRampToValueAtTime(bodyEnd, t + 0.11);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.15 * level * gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g);
  output(g, pan, 0.42);
  o.start(t);
  o.stop(t + 0.19);

  // 3) 돌이 판을 때리는 딱 — 아주 높은 순간음.
  const tick = a.createOscillator();
  tick.type = "sine";
  tick.frequency.setValueAtTime(black ? 880 : 1180, t);
  tick.frequency.exponentialRampToValueAtTime(black ? 520 : 720, t + 0.028);
  const tg = a.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.035 * gain, t + 0.001);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  tick.connect(tg);
  output(tg, pan, 0.2);
  tick.start(t);
  tick.stop(t + 0.06);

  // 4) 나무 판이 받아 주는 낮은 울림 — 돌소리 밑에 깔리는 '통'.
  const wood = a.createOscillator();
  wood.type = "sine";
  wood.frequency.setValueAtTime(74 * jitter, t);
  wood.frequency.exponentialRampToValueAtTime(51 * jitter, t + 0.085);
  const wg = a.createGain();
  wg.gain.setValueAtTime(0.0001, t);
  wg.gain.exponentialRampToValueAtTime(0.05 * level * gain, t + 0.003);
  wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  wood.connect(wg);
  output(wg, pan, 0.5);
  wood.start(t);
  wood.stop(t + 0.15);

  // 5) 판 위를 타고 가는 잔결 — 6ms 뒤 아주 약한 반사.
  if (noiseBuffer) {
    const t2 = t + 0.006;
    const src2 = a.createBufferSource();
    src2.buffer = noiseBuffer;
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2600;
    const g2 = a.createGain();
    g2.gain.setValueAtTime(0.0001, t2);
    g2.gain.exponentialRampToValueAtTime(0.028 * level * gain, t2 + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.03);
    src2.connect(hp).connect(g2);
    output(g2, pan * -0.6, 0.3);
    src2.start(t2);
    src2.stop(t2 + 0.08);
  }
}

export function stoneSound(color = 1, pan = 0) {
  stoneClick({ color, pan, gain: 1 });
}

// 착수 버튼을 눌렀을 때 — 돌이 놓이기 전의 '결심' 소리.
export function placeSound(color = 1, pan = 0) {
  stoneClick({ color, pan, gain: 0.85 });
  setTimeout(() => stoneClick({ color, pan: -pan * 0.4, gain: 0.28 }), 24);
}

export function selectSound(pan = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.08);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g);
  output(g, pan, 0.1);
  o.start(t);
  o.stop(t + 0.12);
}

export function cancelSound(pan = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.12);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.025, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g);
  output(g, pan, 0.1);
  o.start(t);
  o.stop(t + 0.16);
}

export function captureSound(count = 1) {
  const a = ac();
  if (!a) return;
  const n = Math.min(6, Math.max(1, count));
  for (let i = 0; i < n; i++) {
    setTimeout(() => stoneClick({ color: i % 2 ? 2 : 1, pan: i % 2 ? 0.32 : -0.32, gain: 0.66 }), i * 42);
  }
  setTimeout(() => stoneClick({ color: 1, pan: 0, gain: 0.9 }), 30);
}

export function ghostSound() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  [660, 990].forEach((f, i) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t + i * 0.04);
    o.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.36 + i * 0.04);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.014, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g);
    output(g, i ? -0.2 : 0.2, 0.55);
    o.start(t + i * 0.04);
    o.stop(t + 0.48 + i * 0.04);
  });
}

export function winSound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    setTimeout(() => {
      const a = ac();
      if (!a) return;
      const t = a.currentTime;
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.028, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
      o.connect(g);
      output(g, 0, 0.5);
      o.start(t);
      o.stop(t + 0.66);
    }, i * 150);
  });
}

export function loseSound() {
  [220, 164.81, 110].forEach((f, i) => {
    setTimeout(() => {
      const a = ac();
      if (!a) return;
      const t = a.currentTime;
      const o = a.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.96, t + 0.55);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.025, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g);
      output(g, 0, 0.45);
      o.start(t);
      o.stop(t + 0.64);
    }, i * 180);
  });
}

export function futureSound() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  [880, 1320, 1760].forEach((f, i) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t + i * 0.05);
    o.frequency.exponentialRampToValueAtTime(f * 0.94, t + 0.28);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.009, t + 0.02 + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3 + i * 0.05);
    o.connect(g);
    output(g, i % 2 ? -0.3 : 0.3, 0.6);
    o.start(t + i * 0.05);
    o.stop(t + 0.36 + i * 0.05);
  });
}

export function uiSound() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(720, t);
  o.frequency.exponentialRampToValueAtTime(560, t + 0.045);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.016, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
  o.connect(g);
  output(g, 0, 0.12);
  o.start(t);
  o.stop(t + 0.07);
}

// ── AI 성우: 브라우저 TTS(한국어) ──────────────────────────────
// RVC 음색은 서버/사전 렌더가 필요하므로, 게임 안에서는 즉시 동작하는
// 한국어 음성으로 귀신의 말을 읽는다. 음색 파일이 오면 이 함수만 교체한다.
let currentUtterance = null;

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function setVoiceEnabled(on) {
  voiceOn = !!on;
  if (!voiceOn) stopSpeaking();
}

export function voiceEnabled() {
  return voiceOn;
}

let recordedAudio = null;

// 박씨 RVC로 미리 렌더한 대사. 파일이 없거나 재생이 막히면 브라우저 음성으로 넘어간다.
function speakRecorded(text, opts) {
  if (!hasVoiceLine(text)) return false;
  try {
    if (!recordedAudio) recordedAudio = new Audio();
    recordedAudio.pause();
    recordedAudio.src = voiceFile(text);
    recordedAudio.volume = Math.max(0, Math.min(1, opts.volume ?? 0.95));
    recordedAudio.onerror = () => {
      recordedAudio = null;
      speakBrowser(text, opts);
    };
    const p = recordedAudio.play();
    if (p && p.catch) p.catch(() => speakBrowser(text, opts));
    return true;
  } catch (err) {
    return false;
  }
}

function speakBrowser(text, opts = {}) {
  if (!speechSupported() || !text) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, " ").trim());
    u.lang = "ko-KR";
    u.rate = opts.rate ?? 0.94;
    u.pitch = opts.pitch ?? 0.82;
    u.volume = opts.volume ?? 0.9;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const ko = voices.find((v) => /ko(-|_)?KR/i.test(v.lang) && /male|남|M|Yuna|Google/i.test(v.name))
      || voices.find((v) => /ko(-|_)?KR/i.test(v.lang));
    if (ko) u.voice = ko;
    currentUtterance = u;
    window.speechSynthesis.speak(u);
    return true;
  } catch (err) {
    return false;
  }
}

export function speak(text, opts = {}) {
  if (!voiceOn || !text) return false;
  try {
    window.speechSynthesis?.cancel?.();
  } catch (err) {
    /* noop */
  }
  if (speakRecorded(text, opts)) return true;
  return speakBrowser(text, opts);
}

export function stopSpeaking() {
  try {
    if (recordedAudio) {
      recordedAudio.pause();
      recordedAudio.currentTime = 0;
    }
  } catch (err) {
    /* noop */
  }
  try {
    window.speechSynthesis?.cancel?.();
  } catch (err) {
    /* noop */
  }
  currentUtterance = null;
}

// ── STT: 한국어 음성 명령 ──────────────────────────────────────
// "착수", "패스", "무르기", "힌트", "큐 십육" 같은 말을 알아듣는다.
export function listenSupported() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function listenKorean({ onResult, onEnd, onError } = {}) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    onError?.("이 브라우저는 음성 인식을 지원하지 않습니다.");
    return null;
  }
  try {
    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const text = ev.results?.[0]?.[0]?.transcript || "";
      onResult?.(text.trim());
    };
    rec.onerror = (ev) => onError?.(ev.error || "speech-error");
    rec.onend = () => onEnd?.();
    rec.start();
    return rec;
  } catch (err) {
    onError?.(err.message || String(err));
    return null;
  }
}

export function disposeAudio() {
  stopSpeaking();
  ambient?.o1?.stop?.();
  ambient?.o2?.stop?.();
  ambient?.lfo?.stop?.();
  ctx?.close?.().catch?.(() => {});
  ctx = null;
  ambient = null;
}
