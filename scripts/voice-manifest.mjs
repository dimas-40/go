// 성우 대사 → 파일 이름 목록. 랩탑에서 이 JSON을 읽어 RVC로 렌더한다.
import { VOICE_LINES, voiceKey } from "../src/voice-lines.js";

const rows = VOICE_LINES.map((text) => ({
  key: voiceKey(text),
  file: `${voiceKey(text)}.mp3`,
  text,
}));
process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
