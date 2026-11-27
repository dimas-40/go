// PARKSY GO — 작은 소리들. 외부 음원 없이 Web Audio로만 만든다.
// 첫 사용자 제스처 뒤에만 시작한다(브라우저 자동재생 정책).
let ctx = null;
let master = null;
let ambient = null;

function ac() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  return ctx;
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
  filter.frequency.value = 220;
  filter.Q.value = 0.7;
  const o1 = a.createOscillator();
  o1.type = "sine";
  o1.frequency.value = 55;
  const o2 = a.createOscillator();
  o2.type = "sine";
  o2.frequency.value = 82.5;
  const o2g = a.createGain();
  o2g.gain.value = 0.4;
  o1.connect(filter);
  o2.connect(o2g).connect(filter);
  filter.connect(g).connect(master);
  o1.start();
  o2.start();
  g.gain.setTargetAtTime(0.028, a.currentTime, 1.8);
  ambient = { g, o1, o2 };
}

function tone({ freq = 220, freqEnd = 110, dur = 0.16, type = "triangle", gain = 0.07, pan = 0 }) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (a.createStereoPanner) {
    const p = a.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(p);
    node = p;
  }
  node.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function stoneSound() {
  tone({ freq: 340, freqEnd: 150, dur: 0.12, type: "triangle", gain: 0.055, pan: -0.15 });
  tone({ freq: 820, freqEnd: 420, dur: 0.055, type: "sine", gain: 0.025, pan: 0.15 });
}

export function captureSound(count = 1) {
  stoneSound();
  const a = ac();
  if (!a) return;
  const n = Math.min(6, Math.max(1, count));
  for (let i = 0; i < n; i++) {
    setTimeout(() => tone({ freq: 180 + i * 38, freqEnd: 70, dur: 0.2, type: "sawtooth", gain: 0.03, pan: i % 2 ? 0.35 : -0.35 }), i * 34);
  }
}

export function ghostSound() {
  tone({ freq: 660, freqEnd: 440, dur: 0.32, type: "sine", gain: 0.018, pan: 0 });
}

export function winSound() {
  [523.25, 659.25, 783.99].forEach((f, i) => {
    setTimeout(() => tone({ freq: f, freqEnd: f * 0.99, dur: 0.5, type: "sine", gain: 0.035 }), i * 150);
  });
}

export function loseSound() {
  [196, 146.83, 110].forEach((f, i) => {
    setTimeout(() => tone({ freq: f, freqEnd: f * 0.98, dur: 0.55, type: "triangle", gain: 0.03 }), i * 170);
  });
}

export function futureSound() {
  tone({ freq: 880, freqEnd: 1320, dur: 0.18, type: "sine", gain: 0.02, pan: 0.25 });
  setTimeout(() => tone({ freq: 660, freqEnd: 988, dur: 0.22, type: "sine", gain: 0.018, pan: -0.25 }), 90);
}
