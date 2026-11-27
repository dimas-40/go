// PARKSY GO — 성우 대사 목록.
// 박씨 RVC(parksy_rvc_v3)로 미리 렌더해 둔 음성 파일과 대사를 1:1로 묶는다.
// 브라우저에서는 이 목록에 있는 대사만 녹음본을 재생하고, 나머지는 브라우저 음성으로 읽는다.
import { ALL_SCENES } from "./story.js";

// 화면 조작 안내처럼 귀신이 직접 말하는 짧은 문장.
const UI_LINES = [
  "귀신의 목소리를 켰습니다.",
  "자유 대국입니다. 자리를 고른 뒤 착수 버튼을 누르세요.",
  "먼저 판에서 자리를 고르세요.",
  "지금은 내 차례가 아닙니다.",
  "그 자리에는 둘 수 없습니다.",
];

export const VOICE_LINES = Array.from(new Set([
  ...ALL_SCENES.flatMap((sc) => [
    ...(sc.intro || []),
    ...(sc.hints || []),
    ...(sc.after || []),
  ]),
  ...UI_LINES,
].map((t) => String(t).replace(/\s+/g, " ").trim()).filter(Boolean)));

// 같은 대사는 같은 파일 이름을 갖도록 FNV-1a 해시를 쓴다.
export function voiceKey(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function voiceFile(text) {
  return `./assets/voice/${voiceKey(text)}.mp3`;
}

const LOOKUP = new Map(VOICE_LINES.map((t) => [t.replace(/\s+/g, " ").trim(), t]));

export function hasVoiceLine(text) {
  return LOOKUP.has(String(text || "").replace(/\s+/g, " ").trim());
}
