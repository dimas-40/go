# PARKSY GO — AI 바둑 엔진 · 스토리 웹 · RVC 성우 개발 계획서 v2

- 작성: 2026-11-27 · `_Claude`
- v1: 수읽기·온톨로지·GPU 계획
- v2: **RVC/성우 레인**과 **모든 화면의 웹페이지화**, **랜딩↔스토리↔대국 연결**을 추가
- 현재 라이브: https://dimas-40.github.io/go/
- 저장소: https://github.com/dimas-40/go
- 이 문서는 **계획**입니다. `실측` / `조사` / `계획`을 구분해 표기합니다.

---

## 0. 결론 (v2)

가능합니다. 단, 한 덩어리로 만들지 않고 **네 개의 코어**와 **세 개의 제품면**으로 나눕니다.

### 네 코어

1. **규칙·기보 코어(직접 만든다)** — 착수/따냄/패/계가/SGF. 이미 동작.
2. **수읽기 코어(빌려온다)** — KataGo ONNX를 브라우저에서, 필요하면 네이티브 KataGo를 사이드카로.
3. **스타일·과외 코어(직접 조합한다)** — 분석값과 온톨로지를 사실(fact)로 만들고, 난이도/기풍/해설을 얹는다.
4. **음성·스토리 코어(직접 만든다)** — 성우 녹음 + Boss RVC + TTS, 그리고 장면/대사/목표를 담는 스토리 DSL.

### 세 제품면

1. **웹사이트** — 랜딩, 스토리, 대국, 복기, 학습, 온톨로지, 설정, 크레딧이 **각각 실제 URL을 가진 페이지**.
2. **게임 앱** — 대국판과 온톨로지 그래프. WebGPU 우선, WebGL2 폴백.
3. **음성** — 고정 대사는 성우/RVC로 **미리 렌더링**, 실시간 과외는 **TTS→RVC 또는 폴백**. 공개 Pages에는 **모델 가중치를 올리지 않는다.**

### v2에서 확정하는 다섯 가지

| 결정 | 내용 |
|---|---|
| 화면 | 모든 화면은 `*.html` 실파일 + 공유 모듈. 상태는 쿼리 파라미터로 URL에 남긴다. |
| 랜딩 | `/`는 랜딩. 현재 게임 화면은 `/play/`로 이동. |
| 스토리 | `/story/` 허브 → `/story/chNN.html` 장 → `/story/chNN/sNN.html` 장면. |
| 연결 | 장면 페이지의 “이 장면을 직접 두기” → `/play/?mode=story&chapter=...&scene=...` → 결과 → 복기/다음 장면. |
| 음성 | 성우 = 스토리 고정 대사. Boss RVC = 과외 선생님. 실시간 RVC는 **ONNX/GPU 스파이크 통과 전까지 기본 아님**. |

> 정직한 한 줄: **미리 렌더링한 목소리는 지금 파이프라인으로 만들 수 있습니다. 실시간으로 문장을 만들어 Boss 목소리로 속삭이는 것은 아직 검증 전입니다.** v2는 이 둘을 분리해, 먼저 되는 것(고정 음성·스토리 웹)으로 제품을 세우고, 실시간은 스파이크로 승격 여부를 결정합니다.

---

## 1. 현재 기준선 (실측)

### 1.1 게임·사이트

| 항목 | 값 | 비고 |
|---|---|---|
| 라이브 URL | `https://dimas-40.github.io/go/` | 2026-11-27 200 확인 |
| 온톨로지 격자 | 361 노드 · 684 링크 | 19×19 교점 + 직교 인접 |
| 규칙 테스트 | 11/11 통과 | `node --test tests/go-engine.test.mjs` |
| 헤드리스 Chrome(WebGPU/SwiftShader) | Dawn readback `Instance dropped` | 헤드리스 환경 한정 실패 |
| headed Chrome(Xvfb) | WebGPU 컴퓨트·착수·AI 정상, 콘솔 오류 0 | 영향도 1.1~1.4초(SwiftShader CPU) |
| 라이브 headed 스모크 | WebGPU, K10 착수, AI 응수, 영향도 WebGPU compute, 실패 요청 0 | 2026-11-27 |
| 폰 메모리 게이트 | MemAvailable 1.72 GB, SwapFree 8.8 MB, 판정 fail | 2026-11-27 04:17 UTC 실측 |
| 현재 화면 수 | 1 | `index.html`이 곧 게임. 랜딩/스토리/복기 분리 없음 |
| 배포 | GitHub Actions → Pages | `.github/workflows/pages.yml` |

현재 라이브는 “놀이 가능한 온톨로지 바둑판”이지 “강한 바둑 AI”도, “스토리 웹”도 아닙니다.

### 1.2 음성 자산·파이프라인

| 항목 | 값 | 비고 |
|---|---|---|
| Boss RVC 모델 | `parksy_rvc_v3.pth` **57,585,774 B** | 2026-09-19 파일 |
| RVC 인덱스 | `parksy_rvc_v3.index` **128,885,819 B** | 합계 **186,471,593 B** |
| 모델 위치(폰) | `/root/rvc_models/parksy_rvc_v3/` | `_staging/rvc_assets/...` 사본도 동일 크기 |
| 학습 이력 | 내레이션 29분 · 500 epoch | `lfai-music/plan-ko-singing.html` 표기 |
| 화자 유사도 | sim **0.8030** | 같은 문서 표기. 가창용 아님 |
| 현재 나레이션 표준 | `parksy_std_v4` | `tools/mcp_tutor/dubstd.py` |
| 표준 체인 | edge-tts(InJoon, -8%) → pyworld F0 → humanizer → RVC(parksy_rvc_v3, key -6) → EQ/웜 → -16 LUFS | 코드 실측 |
| RVC 파라미터 | `index_rate=0.6`, `protect=0.33`, `rms_mix=0.25` | `parksy_std_v4` |
| F0 가드 | 165 Hz 초과 시 실패 | 남성 음역 이탈 방지. 박씨 실측 118~124 Hz |
| 캐시 | 문장+음성+표준 해시 → `.narration_cache` | `mix.py` |
| 랩탑 RVC 실측 | 46.74 s 오디오: Features 23.83 s + F0 37.08 s + Synthesis 217.15 s = **278.06 s** | PyTorch CPU, 4 core. 실시간 아님 |
| 폰 RVC | 2 GB 이상 사용 → LMK 사망 재현 | RVC는 랩탑/외부 GPU로 |
| ONNX INT8 조사치 | ~380 MB, ~72 ms | **기존 조사(수첩 74). 이 저장소에서 재현 전** |
| 실시간 RVC | 네이티브 170 ms, ASIO 90 ms | RVC 공식 README. 브라우저 수치 아님 |

### 1.3 v2의 기준선 판정

- **고정 대사 음성**: 지금도 만들 수 있다. `dubstd.py` + `parksy_rvc_v3`로 문장별 WAV를 뽑고 Opus로 인코딩하면 된다. 단, 랩탑 CPU에서 문장당 수십 초가 걸리므로 **배치·캐시**가 전제.
- **실시간 과외 음성**: 현재 PyTorch CPU 파이프라인으로는 불가능에 가깝다. ONNX INT8/GPU/전용 서비스 중 하나가 필요하고, **아직 실측 전**.
- **웹 화면**: 현재 1장. v2의 절반은 “게임을 웹사이트로 만드는 일”이다.

---

## 2. 빌려올 수 있는 것 (조사)

### 2.1 수읽기 코어 — KataGo

- 코드: MIT. https://github.com/lightvector/KataGo
- 공식 네트워크: **KataGo Neural Network License** — 사용·수정·재배포·판매 허용, 고지 포함. g170 구형은 CC0. Human SL도 포함.
  - https://katagotraining.org/network_license/
- Human SL: `b18c384nbt-humanv0.bin.gz`. `humanSLProfile`(예: `rank_5k`, `pro_2023`)로 급수·연대 흉내.
  - https://katagotraining.org/extra_networks/
- 분석 출력: `moveInfos`의 `winrate`, `scoreLead`, `prior`, `pv`, `ownership`, `humanPrior`, `humanPolicy`.
- 브라우저 선례: Emscripten/pthreads WASM. **COOP/COEP 없으면 조용히 죽음**, iframe에는 격리 상속 안 됨.
  - https://github.com/y-ich/KataGo · https://github.com/ghost-go/katago-js
- Android: 공식 APK 없음. 커뮤니티 **BadukAI** OpenCL(스냅드래곤 855+ 약 10 nodes/s, 첫 튜닝 4~10분). S25 Ultra 실측 없음.
  - https://aki65.github.io/ · https://github.com/karino2/KataGo

### 2.2 브라우저 신경망 — KataGo ONNX + ONNX Runtime Web

- `kaya-go/katago-onnx`: KataGo → ONNX 변환. **AGPL-3.0**.
- `kaya-go/kaya`: 변환된 모델, **MIT** 메타데이터.
  - FP32 293,099,607 B · FP16 146,963,282 B · UINT8 75,176,902 B (HF API 실측)
  - 입력 `bin_input [B,22,H,W]`, `global_input [B,19]`
  - 출력 `policy`, `value`, `ownership`, `scoring`, `futurepos`, `seki`, `scorebelief`
  - https://huggingface.co/kaya-go/kaya
- Kaya 앱은 **AGPL-3.0**. 모델(MIT)과 런타임만 쓰고, 보드 인코딩·MCTS는 직접 구현.
- ONNX Runtime Web WebGPU EP: `onnxruntime-web/webgpu`, `executionProviders:['webgpu']`. Chrome/Edge Windows·macOS·Android·ChromeOS. **실험적**, FP16 요구는 문서에 미명시 → 실기기 실측 필요.
  - https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- 선례: Web KaTrain(TF.js WebGPU/WASM, 저장소 비공개), `@multi-game-engines/adapter-katago`(가짜 스텁).

### 2.3 스타일 연구

- `gostyle`: 기보 → 패턴 벡터 → 스타일 벡터, k-NN/NN.
- “Identifying fighting, balanced, and territorial go player styles with deep learning”: 70,000 기보, 3분류, 테스트 정확도 82.6%.
- **감이 아니라 측정 가능한 축**이 존재. 단, “특정 프로 기풍”을 소수 기보로 재현하는 것은 별개.

### 2.4 데이터·정석 (라이선스 주의)

| 데이터 | 상태 | 판단 |
|---|---|---|
| KataGo 공식 네트워크 | KataGo Network License / g170 CC0 | 사용 가능 |
| Kaya ONNX 모델 | MIT | 사용 가능 |
| GoGoD | 상업 DB, EU sui generis DB right 주장 | **허가 전 금지** |
| Kogo's Joseki Dictionary | 무료, 상업 배포 금지 | **허가 전 번들 금지** |
| OGS 덤프 | “redistributed with permission”, 명시 라이선스 없음 | **서면 허가 필요** |
| KGS/u-go.net, WAGC | 라이선스 불명 | 허가 확인 전 보류 |
| HF `kenhktsui/go_pgn_string_v2` | GoGoD 파생 | 권리 승계 위험 |

정본 데이터 전략: **(a) KataGo self-play, (b) 서면 허가 OGS/보유 기보, (c) 사용자 SGF**. 정석 사전은 허가 후 자체 추출.

### 2.5 음성 — RVC

- RVC 코드: **MIT**. https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
- RVC는 **TTS가 아니라 음성→음성 변환**이다. 문장을 만들려면 TTS가 먼저 필요하다.
- 공식 실시간 수치: **end-to-end 170 ms**, ASIO 사용 시 **90 ms**. 네이티브 GUI 기준이며 브라우저 수치가 아니다.
- `rvc-onnx-web` (npm, **MIT**): `.pth` → ONNX 변환을 브라우저/Node에서 수행. **변환기**이지 완성된 브라우저 추론 런타임은 아니다. npm 1.0.0, 유지보수 활발하지 않음.
  - https://www.npmjs.com/package/rvc-onnx-web
- `TigreGotico/voiceclonnx-rvc` (HF): ContentVec 91 MB + RMVPE 94 MB INT8 사전 빌드. RVC 추론용.
  - https://huggingface.co/TigreGotico/voiceclonnx-rvc
- `vconnx`: RVC ONNX 추론 라이브러리.
- `OpenVoiceChanger`: RVC/ONNX + **서버 측** FastAPI + 브라우저 AudioWorklet/WebSocket. 실시간 파이프라인 선례지만 추론은 서버.
  - https://github.com/sioaeko/OpenVoiceChanger
- **완전한 브라우저 WebGPU RVC 파이프라인은 확인되지 않았다.** 있는 것은 (a) pth→ONNX 변환, (b) 서버 추론 + 브라우저 AudioWorklet, (c) 네이티브 실시간이다. 이 계획은 이 셋을 섞지 않는다.

### 2.6 음성 — TTS

| 후보 | 한국어 | 복제 | 형식 | 판단 |
|---|---|---|---|---|
| edge-tts `ko-KR-InJoonNeural` | ✅ | ❌ | 네트워크 | 현재 `parksy_std_v4` 표준. **공개·상업 배포 전 약관 확인 필요** |
| Web Speech API | 기기 의존 | ❌ | 브라우저 내장 | 즉시 폴백. 음성·오프라인 보장 없음 |
| NeuTTS Nano | ✅ (조사) | ✅ | GGUF | 오픈 TTS 대안. 폰 CPU 검증 필요 |
| Sherpa-ONNX Kokoro | ⚠️ 확인 필요 | ❌ | ONNX | 한국어 지원 확인 전 보류 |
| GPT-SoVITS | ✅ | ✅ | PyTorch | 471초/3.5초로 폐기 |

- Web Speech API는 **기기 기본 합성기**를 쓰며, 음성 목록·오프라인 동작이 브라우저/기기마다 다르다. “항상 한국어 Boss 목소리” 보장이 아니다.
- 공개 사이트의 주 음성은 **미리 렌더링한 파일**이어야 한다. 브라우저 TTS는 폴백이다.

### 2.7 음성 — 성우(사람)

- 성우는 **연기·발음·호흡**을 담당한다. RVC는 음색을 바꾸지만 연기를 만들지는 않는다.
- 스토리 고정 대사는 성우가 낫다. 과외 선생님의 “내 AI” 정체성은 Boss RVC가 낫다.
- 성우 녹음을 RVC로 변환하려면 **계약에 AI 변환·파생물·2차 사용 조항**이 있어야 한다. 없으면 성우 본인 목소리로만 쓴다.
- 성우 이름·크레딧·사용 범위(게임/마케팅/유료 강의)를 문서화한다.

### 2.8 웹사이트 — GitHub Pages 제약

- 공개 사이트 최대 **1 GB**, 월 **100 GB** 소프트 대역폭, 빌드 **10회/시간** 소프트 제한(Actions 배포는 예외).
  - https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- 서버 사이드 라우팅·리다이렉트 없음. **실제 파일 경로**로 페이지를 만들어야 한다.
- 커스텀 404는 `404.html`로 가능. 정적 호스팅이므로 없는 경로는 404.
- HTTPS 고정. 공개 HTTPS 페이지에서 `http://127.0.0.1` RVC 서비스로 직접 붙는 것은 혼합 콘텐츠/Private Network Access 제약이 있다.
- 캐시 헤더를 직접 제어하기 어렵다 → **파일명 해시**로 캐시 무효화.

---

## 3. 제품 구조 (v2)

```
┌────────────────────────────────────────────────────────────────────┐
│  웹사이트 (정적, GitHub Pages)                                      │
│  /                랜딩                                              │
│  /story/          스토리 허브 → 장 → 장면                            │
│  /play/           대국 (자유/스토리/퍼즐)                            │
│  /review/         복기·분석                                          │
│  /learn/          규칙·계가·입문                                     │
│  /ontology/       온톨로지·정석·개념 그래프                           │
│  /settings/       음성·난이도·기풍·접근성                            │
│  /progress/       진행·기보 보관함                                   │
│  /credits/        라이선스·성우·RVC·AI 고지                          │
│  /404.html        길 잃은 화면                                       │
├────────────────────────────────────────────────────────────────────┤
│  게임 앱 (WebGPU 우선 / WebGL2 폴백)                                │
│   · 온톨로지 그래프 뷰, 착수/따냄/패/계가/SGF                         │
│   · 과외 패널, 후보 수, 소유권, 승률, 정석 이탈                       │
├────────────────────────────────────────────────────────────────────┤
│  수읽기·스타일 코어                                                  │
│   · KataGo ONNX(WebGPU/WASM) 또는 네이티브 사이드카                   │
│   · Human SL(네이티브), 난이도 사다리, 기풍 축                        │
├────────────────────────────────────────────────────────────────────┤
│  음성 코어 (빌드 타임 + 선택적 런타임)                               │
│   · 성우 WAV → 정규화 → Opus                                        │
│   · TTS → RVC(parksy_std_v4) → Opus  (고정 대사, 배치)               │
│   · 실시간: TTS → RVC ONNX/서비스 (스파이크 후 결정)                 │
│   · 폴백: 브라우저 TTS + 자막                                        │
├────────────────────────────────────────────────────────────────────┤
│  스토리·진행 저장소                                                  │
│   · chapter/scene JSON + SGF + audio manifest                       │
│   · localStorage 진행/설정, IndexedDB 기보                           │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. 화면 지도 — 모든 화면이 웹페이지

### 4.1 원칙

1. **화면마다 URL이 있다.** 새로고침·뒤로가기·공유·북마크가 모두 동작한다.
2. **실제 파일 또는 실제 파일 + 쿼리**만 쓴다. `/play/story/1` 같은 서버 라우팅은 쓰지 않는다.
3. **정적 HTML에 핵심 텍스트가 있다.** JS가 없어도 랜딩/스토리/크레딧은 읽힌다.
4. **게임 상태도 URL에 남긴다.** `?panel=settings`, `?panel=tutor`, `?result=1`처럼 패널/결과도 공유 가능.
5. **랜딩/스토리에는 WebGPU를 띄우지 않는다.** 미리보기는 정적 이미지(SVG/WebP). WebGPU 컨텍스트는 대국/복기에서만.
6. **모바일 우선.** 세로 화면에서 대국판이 먼저, 패널은 시트.
7. **404에도 길이 있다.** 스토리/대국/설정 링크.

### 4.2 URL·파일 지도

| URL | 파일 | 화면 | 핵심 데이터 | 주요 CTA |
|---|---|---|---|---|
| `/` | `index.html` | 랜딩 | 최근 장, 진행률, 음성 설정 | 이야기 시작 · 바로 두기 · 이어하기 |
| `/story/` | `story/index.html` | 스토리 허브 | 장 목록, 잠금, 예상 시간 | 장 열기 |
| `/story/ch01.html` | `story/ch01.html` | 장 소개 | 시놉시스, 장면 목록, 음성 | 장면 열기 · 이 장 처음부터 |
| `/story/ch01/s01.html` | `story/ch01/s01.html` | 장면 | SGF, 대사, 목표, 보드 미리보기 | 이 장면을 직접 두기 · 다음 장면 |
| `/play/` | `play/index.html` | 자유 대국 | 판 크기, 난이도, 기풍, 덤 | 대국 시작 |
| `/play/?mode=story&chapter=ch01&scene=s01` | 같은 파일 | 스토리 대국 | 장면 SGF, 목표, 힌트 | 힌트 · 결과 |
| `/play/?mode=puzzle&id=...` | 같은 파일 | 퍼즐 | 문제 SGF, 정답 조건 | 확인 |
| `/play/?panel=settings` | 같은 파일 | 설정 패널 | 음성/난이도/기풍 | 적용 |
| `/play/?panel=tutor` | 같은 파일 | 과외 기록 | 사실 카드, 음성 | 재생 · 복기 |
| `/play/?result=1` | 같은 파일 | 결과 | 승패, 주요 수, 사실 | 복기 · 다음 장면 · 스토리로 |
| `/review/` | `review/index.html` | 복기 허브 | 최근 기보, SGF 불러오기 | 기보 열기 |
| `/review/?game=<id>` | 같은 파일 | 복기 | 수순, 승률, 소유권, 과외 | 저장 · 공유 · 스토리로 |
| `/learn/` | `learn/index.html` | 학습 허브 | 규칙/계가/용어 | 단원 열기 |
| `/learn/rules.html` | `learn/rules.html` | 규칙 | 착수·따냄·패 | 연습 |
| `/learn/scoring.html` | `learn/scoring.html` | 계가 | 중국/일본식 | 예제 |
| `/ontology/` | `ontology/index.html` | 온톨로지 탐색 | 노드 검색, 그래프 | 노드 열기 |
| `/ontology/node.html?uri=...` | `ontology/node.html` | 개념/정석 노드 | 정의, 예시 국면, 관련 장면 | 장면에서 보기 · 대국에 두기 |
| `/settings/` | `settings/index.html` | 설정 | 음성, 난이도, 기풍, 접근성 | 저장 · 음성 테스트 |
| `/progress/` | `progress/index.html` | 진행/보관함 | 완료 장면, 기보, 설정 | 이어하기 · 내보내기 |
| `/credits/` | `credits/index.html` | 크레딧/라이선스 | 엔진, three.js, KataGo, 성우, RVC, AI 고지 | 원문 링크 |
| `/404.html` | `404.html` | 길 잃음 | 추천 링크 | 랜딩 · 스토리 · 대국 |

> “모든 게임 화면”은 `?panel=`, `?result=1`, `?mode=`로 **각각 고유 URL**을 갖는다. 모달도 URL이 없으면 화면으로 인정하지 않는다.

### 4.3 공유 모듈

| 모듈 | 책임 |
|---|---|
| `src/site/shell.js` | 헤더/푸터/브레드크럼, 모바일 내비, 현재 위치 표시 |
| `src/site/router.js` | 쿼리 파라미터 읽기/쓰기, `history.pushState`, 뒤로가기 복원 |
| `src/site/progress.js` | `localStorage` 진행/설정, 스키마 버전, 마이그레이션 |
| `src/site/story.js` | chapter/scene JSON 로드, 다음/이전, 목표 판정 |
| `src/site/voice.js` | 오디오 매니페스트, 재생, 캡션, 폴백 TTS, 사용자 제스처 잠금 해제 |
| `src/site/audio-cache.js` | 클라이언트 캐시(캐시 API/IndexedDB), 해시 검증 |
| `src/game/*` | 현재 엔진/그래프/AI/영향도 모듈을 `play/`에서 사용 |
| `styles/site.css` | 랜딩/스토리/문서용 디자인 토큰 |
| `styles/game.css` | 대국/복기용 HUD. 현재 `styles.css`를 분리 |

### 4.4 랜딩 ↔ 스토리 ↔ 대국 연결

```
랜딩(/)
  ├─ [이야기 시작] ─────────────→ 스토리 허브(/story/)
  │                                 └─ 장(/story/ch01.html)
  │                                      └─ 장면(/story/ch01/s01.html)
  │                                           └─ [이 장면을 직접 두기]
  │                                                ↓
  │                              대국(/play/?mode=story&chapter=ch01&scene=s01)
  │                                                ↓ 결과
  │                              결과(?result=1) ──→ 복기(/review/?game=...)
  │                                       │                 │
  │                                       │                 └─ [스토리로]
  │                                       └─ [다음 장면] → /story/ch01/s02.html
  ├─ [바로 두기] ───────────────→ 대국(/play/?mode=free)
  └─ [이어하기] ───────────────→ 마지막 장면 또는 마지막 대국
```

**진행 저장**

```json
{
  "schema": "parksygo.progress.v1",
  "last": { "kind": "story", "chapter": "ch01", "scene": "s03" },
  "chapters": {
    "ch01": { "completed": ["s01", "s02"], "startedAt": "2026-11-27T...", "best": {} }
  },
  "settings": {
    "voice": "on", "voiceRole": "tutor", "captions": true,
    "difficulty": "beginner", "style": "balanced", "reducedMotion": false
  },
  "games": ["local-game-id-1"]
}
```

- 저장소는 `localStorage`(진행/설정) + `IndexedDB`(기보). 계정 없음.
- 스키마 버전이 다르면 읽기 전용으로 두고 마이그레이션. 깨진 JSON은 백업 후 초기화.
- 서버 전송 없음. “진행도 수집” 같은 분석은 넣지 않는다.

**장면 → 대국 계약**

- 장면 페이지는 다음을 제공한다:
  - 초기 국면 SGF
  - 목표(`goal`)
  - 힌트 목록과 표시 조건
  - 상대 수 스크립트(선택)
  - 대사/음성 클립 ID
  - 연결 개념/정석 노드
- 대국 페이지는 `chapter`/`scene`을 읽어 SGF를 로드하고, 장면 목표를 HUD에 표시한다.
- 목표 달성/실패/이탈 이벤트를 `storyRuntime`에 보낸다.
- 결과 화면은 “다음 장면” URL을 계산한다. 다음 장면이 잠겨 있으면 조건을 보여준다.
- 직접 URL로 들어와도 동작한다. 진행 저장이 없으면 해당 장면부터 시작.

**이탈(정석 밖) 처리**

- 장면이 특정 정석/국면을 가르치는 경우, `deviatesFrom` 이벤트를 발생시킨다.
- “이 장면은 교본에서 벗어났습니다. 자유 대국으로 계속할 수 있습니다.”를 보여주고,
  - [계속 두기] → 자유 대국
  - [되돌리기] → 장면 초기 국면
  - [온톨로지 보기] → 해당 정석 노드
- 스토리 목표가 “특정 수”가 아니라 “개념 달성”이면 이탈해도 완료 가능.

### 4.5 스토리 DSL

```json
{
  "schema": "parksy.story.v1",
  "id": "ch01",
  "title": "첫 수",
  "board": 9,
  "entry": "s01",
  "summary": "빈 판에 돌 하나를 놓는 법.",
  "scenes": [
    {
      "id": "s01",
      "title": "빈 판",
      "page": "s01.html",
      "position": "positions/s01.sgf",
      "focus": ["E5"],
      "narration": [
        {
          "id": "ch01.s01.n1",
          "speaker": "narrator",
          "text": "바둑판은 집을 짓는 땅입니다.",
          "audio": "audio/ch01.s01.n1.opus",
          "caption": "바둑판은 집을 짓는 땅입니다."
        }
      ],
      "goal": { "type": "play", "target": "E5", "tolerance": 0 },
      "hints": [
        { "afterMoves": 2, "speaker": "tutor", "text": "가운데보다 귀가 먼저입니다.", "audio": "audio/ch01.s01.h1.opus" }
      ],
      "opponent": { "kind": "scripted", "moves": ["D4"] },
      "ontology": ["concept:corner", "concept:first-move"],
      "next": "s02"
    }
  ]
}
```

- `speaker`: `narrator`(성우) / `tutor`(Boss RVC) / `character:<id>` / `fallback`.
- `goal`: `play`, `capture`, `live-group`, `score-lead`, `concept`, `free`.
- `opponent`: `ai` 또는 `scripted`. 스크립트 수는 “이 장면의 재현”용.
- `next`: 다음 장면 ID. 마지막이면 `null`.
- `page`는 빌드가 실제 HTML을 생성할 때 쓴다.

**빌드 검증(CI)**

1. 모든 `position` SGF가 파싱되고 합법 수순인가.
2. 모든 `next`/`page`/`audio` 참조가 존재하는가.
3. 모든 대사에 `caption`이 있는가.
4. 모든 오디오가 매니페스트에 있고 해시·길이·LUFS가 기록됐는가.
5. 깨진 내부 링크 0.
6. 공개 페이로드에 `.pth`/`.index`/원본 성우 WAV가 없는가.
7. `sitemap.xml`, canonical, JSON-LD 생성.

### 4.6 정적 빌드

- `scripts/build_site.py`가 `story/*.json`, `positions/*.sgf`, `audio/manifest.json`을 읽어
  - `story/chNN.html`, `story/chNN/sNN.html`
  - `sitemap.xml`, `robots.txt`, `llms.txt`
  - 정적 보드 미리보기 `assets/thumbs/...webp` (SGF에서 생성)
  - 깨진 링크/누락 자산 리포트
- 템플릿은 `templates/site/*.html`. 공통 `<head>`에 canonical, OG, JSON-LD.
- 게임 앱은 빌드 없이 ES 모듈로 동작. 스토리 페이지만 빌드 산출물.
- `play/`, `review/`, `ontology/node.html` 같은 동적 화면은 정적 셸 + JS. 핵심 텍스트/제목/설명은 HTML에 넣는다.

### 4.7 SEO·접근성

- 스토리 장/장면은 **색인 대상**. 본문 텍스트, 대사 스크립트, 학습 목표를 HTML에 둔다.
- 대국/복기의 상태 URL은 `noindex,follow`. 랜딩/스토리/학습/온톨로지 노드는 index.
- canonical: 장/장면은 자기 URL. 쿼리 상태는 기본 페이지 canonical.
- JSON-LD: `VideoGame`, `LearningResource`, `BreadcrumbList`, `Person`(제작자).
- 자막은 항상. 음성 끄기/속도/볼륨. 키보드만으로 착수·메뉴·다음 장면.
- `prefers-reduced-motion`에서 그래프 애니메이션·블룸 최소화.
- 색 대비, 포커스 링, 터치 타깃 44px.
- 404 페이지는 정적 링크 3개 이상.

### 4.8 GitHub Pages 제약 대응

| 제약 | 대응 |
|---|---|
| 1 GB 사이트 | 오디오는 장면별 lazy load, Opus 48~64 kbps, 총량 예산 관리 |
| 100 GB/월 | 장면 단위 캐시, 첫 페이지 경량화, 불필요한 선로딩 금지 |
| 서버 라우팅 없음 | 실제 디렉터리/파일, 쿼리 파라미터 |
| 캐시 헤더 제어 어려움 | `?v=<hash>` 또는 해시 파일명 |
| HTTPS | 로컬 RVC 서비스는 공개 기본 경로가 아님. 개발 모드에서만 |
| 빌드 10회/시간 | Actions 배포는 예외. 그래도 빌드 1회로 끝내기 |

---

## 5. 음성·성우 아키텍처

### 5.1 역할 분담

| 역할 | 목소리 | 쓰임 | 제작 |
|---|---|---|---|
| `narrator` | 성우(사람) | 랜딩 인트로, 장 intro/outro, 스토리 내레이션 | 스튜디오 녹음 |
| `character:*` | 성우(사람) | 등장인물 대사 | 스튜디오 녹음 |
| `tutor` | **Boss RVC** (`parksy_rvc_v3`) | 과외 선생님·힌트·복기 코멘트 | TTS→RVC 배치, 일부 실시간 |
| `fallback` | 브라우저 TTS | 음성 파일 없음/재생 실패/저사양 | 런타임 |

- **왜 둘인가:** 성우는 연기를 만들고, RVC는 음색을 만든다. 과외 선생님은 “내 AI”의 일관된 목소리가 중요하고, 스토리는 연기 품질이 중요하다.
- 성우 녹음을 Boss RVC로 바꾸는 “성우 연기 + 박씨 음색” 변형은 **계약에 AI 변환 조항이 있을 때만** 만든다. 없으면 성우 목소리 그대로 쓴다.

### 5.2 두 개의 음성 레인

```
[고정 레인 — 빌드 타임]
대본(JSON)
  ├─ narrator/character → 성우 녹음 → 정규화 → Opus
  └─ tutor → edge-tts → pyworld F0 → humanizer → RVC(parksy_rvc_v3)
              → EQ/웜 → -16 LUFS → Opus
  → audio/manifest.json → Pages

[실시간 레인 — 선택]
사실(fact) → 한국어 템플릿 → TTS → RVC(ONNX/서비스) → Web Audio
  └─ 실패/미지원 → 브라우저 TTS + 자막
```

**핵심 원칙:** 실시간 레인은 고정 레인의 **대체가 아니라 보충**이다. 길 안내·짧은 힌트는 고정 클립/조각으로, 처음 보는 조합만 실시간.

### 5.3 고정 레인 상세

**성우 녹음 규격**

- 48 kHz / 24-bit WAV, mono, 무압축, -18 dBFS 평균, 피크 -6 dBFS 이하.
- 건조 녹음(dry). 리버브/노이즈게이트/피치 흔들기 금지.
- 문장별 2테이크, 실패 테이크도 보관. 발음 지침서(바둑 용어: 패, 집, 활로, 정석, Q10 등).
- 30분 세션 = 스토리 1장 + 랜딩 + 시스템 안내 정도. 장면 추가 시 추가 세션.

**후처리**

- 약한 노이즈 정리, Highpass 90 Hz, 400 Hz -1.5 dB, 3 kHz +1.5 dB, Compressor.
- loudnorm `I=-16 LUFS`, `TP=-1.5 dBTP`, 48 kHz.
- Opus: 보이스 모노 48 kbps, 필요 시 64 kbps. 음악/앰비언스는 별도 스테레오.
- 파일명에 해시: `ch01.s01.n1.<hash>.opus`.

**Boss RVC 고정 레인**

- 표준은 `parksy_std_v4`를 그대로 쓴다. 새 표준을 만들지 않는다.
- 체인: `edge-tts ko-KR-InJoonNeural(-8%)` → pyworld F0 → humanizer(broadcast) → RVC `parksy_rvc_v3` key `-6`, `index_rate 0.6`, `protect 0.33`, `rms_mix 0.25` → EQ/웜 → `-16 LUFS`.
- F0 가드: 165 Hz 초과 시 실패. 목표 118~124 Hz.
- 캐시 키: `text|voice|standard_id`. 같은 문장은 재렌더 금지.
- 렌더는 랩탑/외부 GPU. 폰은 렌더하지 않는다(LMK).
- 랩탑 PyTorch CPU 실측 46.74 s 오디오 = 278.06 s. **문장 배치에는 충분하지만 실시간에는 부족.**

**오디오 매니페스트**

```json
{
  "schema": "parksy.audio.v1",
  "voices": {
    "narrator": { "kind": "human", "credit": "성우 이름", "license": "계약 ID" },
    "tutor": { "kind": "rvc", "model": "parksy_rvc_v3", "standard": "parksy_std_v4" },
    "fallback": { "kind": "browser-tts" }
  },
  "clips": [
    {
      "id": "ch01.s01.n1",
      "src": "audio/ch01.s01.n1.6f2a.opus",
      "sha256": "...",
      "duration": 3.84,
      "sampleRate": 48000,
      "channels": 1,
      "lufs": -16.0,
      "truePeak": -1.5,
      "speaker": "narrator",
      "textHash": "...",
      "aiGenerated": false
    }
  ]
}
```

- `aiGenerated: true`인 클립은 크레딧/플레이어에 “AI 음성” 고지.
- 매니페스트에 없는 클립은 재생하지 않는다. 대신 자막 + 폴백.

### 5.4 실시간 레인 상세

**후보와 판정**

| 레인 | 방식 | 현재 판정 |
|---|---|---|
| L0 | 브라우저 SpeechSynthesis | 즉시 가능. Boss 음색 아님. 기기 의존. **폴백 기본** |
| L1 | 고정 문장/구절 조각 조합 | 미리 렌더링한 Boss 음성. 실시간 추론 없음. **1차 기본** |
| L2 | 로컬 RVC 서비스(랩탑/폰) | 기존 `ivc_server.py`는 loopback+토큰. 공개 HTTPS Pages에서 직접 호출은 PNA/혼합 콘텐츠 제약. **개발/설치 모드 한정** |
| L3 | 브라우저 ONNX RVC | `.pth`→ONNX 변환은 가능. 완전한 WebGPU RVC 런타임은 미확인. 모델 메모리 큼. **스파이크 후 결정** |
| L4 | 원격 GPU RVC 서비스 | 지연·비용·상시 서버 필요. **이번 계획 범위 밖** |

**L1 — 문장 조각 조합(권장 1차)**

- 과외 문장을 “고정 구절 + 슬롯”으로 분해한다.
  - 고정: “지금 좌변 약한 돌이 잡히기 직전입니다.”, “이 수가 승률을 올립니다.”, “조금 더 지켜보세요.”
  - 슬롯: 좌표(361), 퍼센트(0~100), 흑/백, “좋습니다/나쁩니다”, “한 집/두 집”.
- 각 조각을 Boss RVC로 미리 렌더링하고, Web Audio로 순서대로 재생한다.
- 장점: 실시간 추론 없음, 오프라인, Pages 친화적.
- 단점: 억양이 기계적으로 들릴 수 있음. **품질 게이트**에서 탈락하면 L0/L3로.
- 한국어 바둑 용어 발음이 TTS마다 다르므로, 좌표/용어 조각은 사람이 검수한다.

**L3 — ONNX RVC 스파이크**

- `parksy_rvc_v3.pth` + `.index`를 ONNX로 변환하고 INT8 양자화.
- 측정:
  - 모델 크기(목표 < 400 MB)
  - 3초 발화 변환 지연(랩탑 CPU, 폰 WASM, 폰 WebGPU)
  - 메모리 피크(폰 LMK)
  - 품질: F0, 화자 유사도, ASR, 사람 청취
- 통과 조건: 폰에서 3초 발화를 **1초 이내**에 변환하고 LMK 0회, 품질이 L1보다 나음.
- 실패 시: L1 고정. 실시간 Boss 목소리는 “설치형/데스크톱 모드”로만.

**지연 예산(목표, 실측 전)**

| 단계 | 목표 |
|---|---|
| 사실 생성(엔진 분석) | 300 ms 이내 |
| 문장 템플릿 | 10 ms |
| TTS (L3) | 300~800 ms |
| RVC (L3) | 100~300 ms |
| 재생 시작 | 100 ms |
| 합계 | 1초 내외. **미달 시 “생각 중” 표시** |

- L1은 사실 생성 + 조각 선택 + 즉시 재생이므로 300 ms 이내 가능.
- L0은 기기 TTS 호출 지연에 의존.

### 5.5 화면별 음성

| 화면 | 음성 | 기본 |
|---|---|---|
| 랜딩 | 성우 인트로 15초, “소리로 듣기” 버튼 | 꺼짐(자동재생 금지) |
| 스토리 장면 | 성우 내레이션 + 캐릭터 | 페이지 진입 후 사용자 제스처에 따라 |
| 대국 | 과외 힌트(Boss RVC 조각/고정) | 첫 착수 후 켜짐, 설정에서 끄기 |
| 결과 | 짧은 요약(성우 또는 과외) | 꺼짐 |
| 복기 | 과외 코멘트 | 버튼 재생 |
| 설정 | 음성 테스트 | 버튼 |
| 크레딧 | 없음 | — |

- 자동재생은 브라우저 정책상 금지. 첫 클릭/터치 후 오디오 컨텍스트를 연다.
- 재생 중 화면 전환 시 정지. `visibilitychange`에서 일시정지.
- 이어폰 권장 문구. “속삭임”은 볼륨이 아니라 **가까운 마이크 톤**으로 만든다(과도한 리미팅 금지).

### 5.6 녹음·음성 권리 (필수 게이트)

1. **성우 서면 계약**: 사용 범위(게임/랜딩/마케팅/유료 강의), 매체, 기간, 지역, 2차 편집, AI 변환/RVC, 크레딧, 대금.
2. **Boss 본인 동의**: RVC 모델 학습·사용·공개 음성 클립 배포 범위. 모델 가중치 공개 여부.
3. **제3자 목소리 금지**: 타인 목소리 모델을 허가 없이 만들지 않는다.
4. **AI 고지**: AI 생성 음성은 크레딧과 플레이어에 표시. EU AI Act 제50조(2026-08-02 적용)의 투명성 의무를 참고하되, 최종 범위는 법률 검토.
   - https://artificialintelligenceact.eu/article/50/
5. **TTS 약관**: 현재 `edge-tts`는 Microsoft 서비스다. 공개·상업 배포 전 약관을 확인하고, 필요하면 오픈 TTS(NeuTTS 등)로 교체 가능한 **voice provider 슬롯**을 둔다.
6. **모델 보안**: `.pth`는 pickle이다. 신뢰한 모델만 로드. 공개 저장소에 올리지 않는다.
7. **공개 범위**: 음성 클립은 공개 Pages에 올라간다. 계약이 “비공개”면 해당 클립은 공개 빌드에서 제외하거나 사이트를 비공개로 전환해야 한다.

### 5.7 모델·자산 보관

| 자산 | 위치 | 공개 |
|---|---|---|
| `parksy_rvc_v3.pth` / `.index` | 랩탑 `~/rvc_models/...`, 폰 `_staging` | **절대 공개 금지** |
| 성우 원본 WAV | 랩탑/외장, 암호화 백업 | **비공개** |
| 렌더된 Opus 클립 | `go/assets/audio/...` | 공개(계약 범위 내) |
| 매니페스트 | `go/assets/audio/manifest.json` | 공개 |
| 대본 JSON | `go/story/...` | 공개(스토리 공개 시) |
| RVC 변환 로그 | `_staging` | 비공개 |

- `.gitignore`: `*.pth`, `*.index`, `*.onnx`(공개 모델 예외는 명시 경로만), `*.wav` 원본, `_staging/`, `voice_raw/`.
- CI: 공개 페이로드에서 금지 확장자/대용량 파일을 검사하고 실패시킨다.

---

## 6. 스토리·게임 연결 상세

### 6.1 장면의 세 가지 상태

1. **읽기** — 장면 페이지. 대사/음성/보드 미리보기/목표 설명.
2. **두기** — 대국 페이지. 장면 SGF 로드, 목표 HUD, 힌트.
3. **되돌아보기** — 결과/복기. 주요 수, 사실 카드, 다음 장면.

각 상태는 URL이 다르고, 서로 링크된다. “스토리로 돌아가기”가 막다른 길이 되지 않는다.

### 6.2 목표 유형

| 유형 | 판정 | 예 |
|---|---|---|
| `play` | 특정 좌표에 착수 | 첫 수를 귀에 둔다 |
| `capture` | N수 내 따냄 | 단수 친 돌을 잡는다 |
| `live-group` | 집단이 살아남음 | 두 눈을 만든다 |
| `score-lead` | 계가 리드 | 5집 이상 앞선다 |
| `concept` | 온톨로지 이벤트 | “활로를 늘린다” |
| `free` | 자유 대국 | 연습 |

- 목표는 엔진 이벤트(착수, 따냄, 패스, 종국)에서 계산한다. LLM이 판정하지 않는다.
- 목표 달성 시 음성/카드/다음 장면 CTA.
- 실패해도 벌하지 않는다. “다시” 또는 “자유 대국”을 제공.

### 6.3 스토리 트리거

- `onEnterScene`, `onMove`, `onCapture`, `onAtari`, `onPass`, `onResign`, `onGoal`, `onDeviation`.
- 트리거는 선언적 JSON. 코드 수정 없이 장면 추가.
- 과외 문장은 사실(fact)과 트리거를 입력으로 템플릿이 만든다.
- LLM을 쓰더라도 **사실 JSON 밖의 수치/좌표를 말하지 않도록** 검증한다.

### 6.4 온톨로지와 스토리

- 장면은 개념/정석 노드를 참조한다: `concept:corner`, `joseki:...`, `shape:...`.
- 장면 완료 시 해당 노드에 “예시 장면” 엣지가 생긴다.
- 온톨로지 노드 페이지에는 “이 개념이 나오는 장면” 목록.
- 정석 이탈 시 `deviatesFrom` 엣지 + 대안 노드.
- 정석 데이터는 허가된 것만. 허가 전에는 self-play/자체 제작 예시.

### 6.5 결과·복기 연결

- 결과 화면은 `?result=1`로 URL 고정.
- “복기” → `/review/?game=<id>` (IndexedDB).
- 복기의 “이 장면으로” → 장면 페이지.
- 복기의 “다음 장면” → 다음 장면 페이지.
- 기보 공유는 SGF 다운로드/복사. 서버 업로드 없음.
- 공유 URL만으로 다른 기기에서 기보를 열려면 SGF를 URL에 넣는 옵션(길이 제한) 또는 파일 첨부. 1차는 파일.

---

## 7. 수읽기 코어 (v1 유지)

### 7.1 A안 — 브라우저 ONNX (1차)

- 모델: `kaya-go/kaya` b28c512 FP16(147 MB) / UINT8(75 MB). 폰은 UINT8 우선.
- 장기적으로 b6c96/b10c128 소형 ONNX를 직접 export.
- 보드 인코딩: KataGo 22평면 + 전역 19특징. `katago-onnx`/Kaya 코드를 복사하지 않고 문서 대조로 독립 구현(AGPL 회피).
- 추론: `onnxruntime-web/webgpu`, Worker 배치. `policy`(362), `value`, `ownership`.
- MCTS: 직접 구현. 방문 1~800. 폰 50~200부터.
- 폴백: WASM. COOP/COEP 없으면 단일 스레드.
- **1차 목표:** S25 브라우저에서 로드 s, 추론 ms, 방문/초를 숫자로 확정.

### 7.2 B안 — 네이티브 KataGo 사이드카

- Termux/랩탑 KataGo + Human SL → localhost WebSocket/HTTP.
- Human SL이 난이도/기풍의 가장 확실한 경로.
- 리스크: Android 공식 배포 없음, OpenCL 빌드, 첫 튜닝 4~10분, 발열·메모리. S25 실측 전 미확정.
- 브라우저 단독 배포 우선. 사이드카는 “설치형 파워 모드”.

### 7.3 Human SL ONNX

- KataGo ONNX 메타데이터에 `metaEncoderVersion=1` 표기가 있으나, Human SL 체크포인트 → ONNX 공식 도구는 확인되지 않음.
- 1차는 네이티브 한정. export는 별도 스파이크.

### 7.4 스타일 미세조정

- KataGo 학습 코드(TensorFlow 1.15)로 허가 기보 미세조정 → ONNX.
- 학습은 폰에서 하지 않는다. 랩탑/클라우드.
- 게이트: 승률 손실 한도, 스타일 분류 정확도, 사람 검수.

---

## 8. 난이도·기풍·온톨로지·GPU (v1 유지)

### 8.1 난이도

| 단계 | 네이티브(Human SL) | 브라우저(대체) |
|---|---|---|
| 입문 20k~15k | `rank_20k`~`rank_15k`, 소수 방문 | top-5 샘플링, 온도 높음, 큰 실수 허용 |
| 초급 10k~5k | `rank_10k`~`rank_5k` | 방문 10~50, 온도 1.2, 눈/사활 실수 일부 |
| 중급 1k~3d | `rank_1k`~`rank_3d` | 방문 100~300, 온도 1.0 |
| 상급 4d~9d | `rank_4d`~`rank_9d` + 탐색 강화 | 방문 400~800, 온도 낮춤 |
| 최강 | 일반 KataGo + 충분한 방문 | 브라우저 한계 명시 |

- **“9d”라고 쓰지 않는다.** 실측 캘리브레이션 전에는 “레벨”.
- 파라미터: `rootPolicyTemperature`, top-k, `playoutDoublingAdvantage`, 실수 주입률.

### 8.2 기풍

- 축: 전투형 / 균형형 / 실리형.
- 1차: 기보 특징(전투 발생률, 3선/4선 비율, 중앙 사용률, 집 크기 분산) 측정.
- 2차: 착수 선택에 반영.
- 3차: 특정 기사/기보군 미세조정은 데이터 허가+비용+품질 게이트 후.
- 특정 창작물의 고유 표현 복제 금지.

### 8.3 온톨로지 스키마

```
Node: Intersection | Stone | Group | Liberty | Eye | Territory
      Position | Move | JosekiNode | Concept | Comment | StyleProfile
      Scene | Chapter | VoiceLine
Edge: adjacent | belongsTo | libertyOf | atariOf | captures
      transitionsTo | answers | threatens | defends
      similarTo | exemplifies | deviatesFrom
      appearsIn (Concept→Scene) | spokenBy (VoiceLine→Speaker)
```

- 정적: 361/684 + 집단/활로/눈/집.
- 동적: 국면 노드, 수 엣지, PV 트리.
- 저장: JSON + IndexedDB. 국면 해시로 중복 제거. 커지면 SQLite/WASM.
- 그래프 뷰: TSL 컴퓨트(반발/스프링), 유사도/클러스터링 WGSL.
- “정석 이후 전개”는 정적 그림이 아니라 **후보 수 그래프 + 소유권/승률 레이어**.

### 8.4 GPU·Vulkan

- 웹: `WebGPURenderer` + TSL, MSAA, bloom, 인스턴싱, 원시 WGSL. ONNX WebGPU EP.
- 폴백: WebGL2 + CPU/별도 WebGPU 컴퓨트, ONNX WASM.
- 폰 네이티브: Termux bionic → 시스템 Vulkan 로더 → Adreno. `vkfft` 실행기/SPIR-V 빌드 실측.
- KataGo 네이티브는 OpenCL이지 Vulkan이 아니다. 두 사실을 섞지 않는다.
- 브라우저 WebGPU는 Android에서 Dawn→Vulkan을 쓰지만 페이지가 Vulkan API를 직접 호출하지 않는다.
- **스토리/랜딩에서는 WebGPU 컨텍스트를 만들지 않는다.** 썸네일은 정적 이미지.

---

## 9. 라이선스·데이터 원칙 (v2 확장)

1. KataGo 코드 MIT, 네트워크 KataGo Network License(고지). 출처 표기.
2. Kaya ONNX 모델 MIT. Kaya 앱/`katago-onnx` AGPL → 코드 복사 금지.
3. GoGoD/KJD/출처 불명 SGF는 허가 전 사용·재배포 금지.
4. OGS는 서면 허가 범위 문서화. 허가 전 self-play/사용자 SGF만.
5. 데이터셋 카드에 출처·라이선스·전처리·한계.
6. RVC 코드 MIT. **모델 가중치·목소리 권리는 별개**.
7. 성우 계약: 사용 범위·AI 변환·크레딧·기간·지역·대금.
8. TTS 약관: edge-tts 공개/상업 사용 전 확인. 오픈 TTS 교체 슬롯.
9. AI 음성 고지: 크레딧 + 플레이어. EU AI Act 제50조 참고, 법률 검토.
10. 공개 저장소에 모델 가중치·원본 성우 WAV·학습 로그 금지.
11. 스토리 텍스트·일러스트·음악도 라이선스 카드. “직접 만든 것”과 “빌려온 것” 분리.
12. 정석/기보 예시는 허가 또는 self-play. 해설 문장은 자체 작성.

---

## 10. 마일스톤 (v2)

기간은 **1인 기준**, 외부 성우 녹음·GPU 학습 대기 제외.

| 단계 | 기간 | 산출물 | 통과 기준 |
|---|---|---|---|
| **M0 (완료)** | — | 라이브 온톨로지 바둑판, 규칙/SGF, 영향도 | 11/11 테스트, 라이브 200, headed WebGPU 정상 |
| **M1 사이트 골격** | 1~2주 | 랜딩/스토리 허브/플레이 분리, 공유 내비, 404, URL 규약 | 모든 화면 새로고침 200, 뒤로가기 복원, 깨진 링크 0 |
| **M2 스토리 수직 슬라이스** | 2~3주 | 스토리 DSL, 1장 5장면, 정적 미리보기, 장면→대국→결과→복기 | 1장 완주, 직접 URL 진입, 진행 저장/복원, 목표 판정 |
| **M3 수읽기 ONNX** | 1~2주 | ONNX Worker, 정책/가치/소유권, 난이도 3단 | S25 추론 ms·방문/초 실측, 한 수 1초 내(목표) |
| **M4 성우·RVC 팩** | 2~3주 | 성우 1세션, 1장 내레이션, 과외 문장 100개, 매니페스트, 오디오 플레이어 | 누락 0, LUFS/피크/F0 게이트, 자막 100%, 모바일 재생 |
| **M5 과외·실시간 음성 스파이크** | 2주 | 사실 계약, 템플릿, 과외 패널, L1 조각 조합, L3 ONNX 측정 | 사실 오류 0(표본), L1 재생, L3 go/no-go 수치 |
| **M6 온톨로지·정석** | 2~3주 | 정석/개념 노드, 이탈 감지, 유사 국면, 노드 페이지 | 허가 데이터, 검색 표본, 장면↔노드 링크 |
| **M7 스타일·난이도** | 2~3주 | 스타일 축, 난이도 캘리브레이션, Human SL 스파이크 | 기준 엔진 대국표, 라벨은 측정 후 |
| **M8 폰 성능·PWA** | 2주 | Vulkan/ONNX 성능, 오프라인, 접근성, 문서 | LMK 0, 벤치 재현, Lighthouse/axe |

총 **12~18주** 예상. 핵심 경로는 **M1 → M2 → M4 → M5**이고, M3는 병렬.

**가장 먼저 보여줄 것:** M2+M4의 “1장 스토리 + 성우 내레이션 + Boss RVC 과외”를 공개 Pages에 올린다. 엔진이 약해도 제품이 성립하는지 먼저 확인한다.

---

## 11. 검증 지표

### 11.1 사이트

- 모든 화면 URL 새로고침 200, 뒤로/앞으로 복원.
- 내부 링크 깨짐 0, 404 페이지 링크 3개 이상.
- 랜딩 초기 전송량(JS+CSS+이미지) < 300 KB (음성 제외).
- 스토리 장면 오디오 lazy load, 장면당 < 2 MB.
- Lighthouse 모바일 Performance/Accessibility/SEO 각 90 목표(측정 후 조정).
- axe critical 0.
- 사이트 총량 < 1 GB, 월 100 GB 추정 이내.

### 11.2 스토리

- 1장 5장면 완주율(수동 테스트).
- 장면→대국→결과→다음 장면 링크 100% 동작.
- 직접 URL 진입/공유/복원 100%.
- 목표 판정 표본 100% (엔진 이벤트 기준).
- 자막 100%, 음성 끄기 100%.

### 11.3 음성

- 매니페스트 누락 0, 참조 깨짐 0.
- LUFS -16 ±1, true peak ≤ -1.5 dBTP.
- F0 가드 위반 0 (Boss RVC 165 Hz 초과).
- 한국어 ASR 단어 정확도 표본(목표 95%+, 측정 후).
- 오디오 시작 지연(캐시 후) < 300 ms, 첫 재생 < 1 s.
- L1 조각 조합 품질 A/B: 기계적이면 폐기.
- L3 ONNX: 모델 크기, 3초 변환 ms, 메모리, LMK 0, 품질.
- 실시간 지연: 사실→재생 p50/p95. 미달 시 “생각 중” 표시.

### 11.4 엔진

- 모델 로드 s, 추론 ms/수, 방문/초, FPS, 메모리 피크, 발열.
- GNU Go 레벨, 이전 빌드 대비 승률, 사람 테스트.
- 스타일 3축 분류 정확도(연구 82.6%는 참고), 착수 분포 변화.
- 과외 사실 인용 정확도, 잘못된 수치 0.

---

## 12. 위험과 완화 (v2)

| 위험 | 완화 |
|---|---|
| 실시간 RVC가 CPU에서 느림 | 고정 L1 우선, L3 ONNX/GPU 스파이크, 폴백 TTS |
| 폰 LMK | RVC 렌더는 랩탑/GPU, 폰은 재생·검수만 |
| ONNX WebGPU 실험적 | WASM 폴백, 모델 축소, 실기기 측정 |
| b28 모델 75~147 MB | UINT8/소형 b6·b10, memgate, Worker 종료 |
| Human SL ONNX 미확인 | 네이티브 한정, export 스파이크 |
| KataGo Android OpenCL 난항 | BadukAI 선례 조사, 실패 시 랩탑 사이드카 |
| 성우 권리/AI 변환 | 서면 계약, 범위 문서화, 조항 없으면 변환 금지 |
| Boss 목소리 무단 사용 | 본인 동의, 모델 비공개, 클립 범위 제한 |
| edge-tts 약관 | 공개 전 확인, 오픈 TTS 교체 슬롯 |
| 모델 가중치 유출 | `.gitignore`, CI 검사, 공개 페이로드 스캔 |
| 공개 사이트에 성우 원본 | Opus 클립만 공개, 원본 WAV 비공개 |
| 사이트 범위 폭발 | M1/M2 수직 슬라이스, 화면 목록 고정 |
| 정적 라우팅/404 | 실파일+쿼리, 404 페이지, 링크 검사 |
| SEO 중복/빈 페이지 | 장면 실제 텍스트, canonical, sitemap, noindex 규칙 |
| 오디오 용량 | Opus 48~64k, lazy, 조각 재사용, 예산 |
| 자동재생 차단 | 사용자 제스처 후 재생, “소리 켜기” 버튼 |
| 음성-자막 싱크 | Web Audio clock, 클립 시작 오프셋 측정 |
| 스토리-게임 상태 불일치 | URL 상태 + 진행 스키마 + 장면 진입 검증 |
| 랜딩 WebGPU 다중 컨텍스트 | 정적 썸네일, 게임에서만 컨텍스트 |
| “9d” 과장 | 캘리브레이션 전 레벨 표기 |
| LLM 환각 | 사실 JSON 고정, 수치/좌표 검증, 템플릿 우선 |
| 데이터 라이선스 | 허가 전 금지, self-play 우선, 카드 |

---

## 13. 즉시 다음 스파이크 (아직 시작 안 함)

Boss 지시가 있을 때만 시작한다. 각 스파이크는 성공/실패와 숫자를 이 문서에 추가한다.

1. **화면 골격 프로토타입** — `/`, `/story/`, `/story/ch01.html`, `/story/ch01/s01.html`, `/play/`, `/review/`, `/settings/`, `/credits/`, `/404.html`. 랜딩/스토리는 WebGPU 없이. 측정: 새로고침/뒤로가기/깨진 링크/전송량.
2. **장면 페이지 + 오디오 1개** — 성우 대사 1개 또는 Boss RVC 1개를 Opus로. S25에서 시작 지연/용량 측정.
3. **과외 문장 20개 배치 렌더** — `parksy_std_v4`로 생성. 측정: 문장당 시간, F0, LUFS, ASR, 캐시.
4. **L1 조각 조합 실험** — 좌표/퍼센트/고정 구절. 품질 A/B. 기계적이면 폐기.
5. **RVC → ONNX INT8 변환** — `parksy_rvc_v3`로. 측정: 크기, 랩탑 CPU/WASM/폰 WebGPU 3초 변환 ms, 메모리, 품질.
6. **로컬 RVC 서비스 공개 페이지 연결** — `ivc_server.py`의 PNA/CORS/혼합 콘텐츠. 공개 기본이 아님을 확인.
7. **성우 샘플 세션** — 2분 대본, 계약 체크리스트, RVC 변환 동의 범위 확인.
8. **스토리 DSL 검증기** — 1장 5장면 SGF, 목표/힌트/다음 장면, 빌드 실패 조건.
9. **장면→대국 이벤트 파일럿** — `goal` 판정, 결과 URL, 다음 장면 연결.
10. **다중 페이지 SEO** — canonical/JSON-LD/sitemap/404, Lighthouse.
11. **음성 폴백** — Web Speech + 자막, 자동재생 잠금 해제, 재생 실패 처리.
12. **CI 자산 게이트** — 금지 확장자/대용량/누락 링크/매니페스트 검사.

우선순위: **1 → 2 → 3 → 4 → 8 → 9 → 10 → 11**, RVC ONNX(5)는 병렬 스파이크. 5가 실패해도 1~4, 8~11로 제품은 성립한다.

---

## 14. 이번 주에 하지 않을 것

- RVC 모델·성우 원본 WAV를 공개 저장소에 커밋.
- 실시간 RVC가 된다고 가정한 UI/약속.
- 모든 화면을 하나의 SPA에 숨기고 URL을 안 남기는 구현.
- 랜딩/스토리에서 WebGPU 컨텍스트를 여러 개 띄우는 구현.
- 자동재생 음성.
- GoGoD/KJD 데이터 번들.
- Human SL을 브라우저에서 된다고 가정한 UI.
- “9d” 등 미측정 급수 표기.
- LLM이 직접 수를 고르거나 수치를 말하게 하는 구조.
- 성우 계약 없이 AI 변환물 배포.
- 폰에서 RVC 학습/대형 추론.
- 폰에서 `find /` 전체 스캔, `pkill -f`.

---

## 15. 참고 링크

### 엔진·데이터

- KataGo: https://github.com/lightvector/KataGo
- KataGo 분석 엔진: https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md
- KataGo 네트워크 라이선스: https://katagotraining.org/network_license/
- Human SL 네트워크: https://katagotraining.org/extra_networks/
- Kaya ONNX 모델: https://huggingface.co/kaya-go/kaya
- KataGo→ONNX 도구(AGPL): https://github.com/kaya-go/katago-onnx
- ONNX Runtime Web WebGPU: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- KataGo 브라우저 WASM 선례: https://github.com/y-ich/KataGo
- Web KaTrain 논의: https://forums.online-go.com/t/web-katrain-browser-based-katrain-clone-with-in-browser-katago-analysis-webgpu-wasm/59096
- BadukAI: https://aki65.github.io/
- Android KataGo 포크: https://github.com/karino2/KataGo
- WebLLM: https://webllm.mlc.ai/
- GoGoD: https://gogodonline.co.uk/
- Kogo's Joseki Dictionary: https://waterfire.us/joseki.htm
- OGS 덤프 논의: https://forums.online-go.com/t/can-we-get-an-sgf-database-dump/38837
- 스타일 분류 연구(요약): https://dtic.dimensions.ai/details/publication/pub.1194028659

### 음성

- RVC (MIT): https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
- RVC ONNX 변환 npm (MIT): https://www.npmjs.com/package/rvc-onnx-web
- RVC ONNX 사전 빌드: https://huggingface.co/TigreGotico/voiceclonnx-rvc
- OpenVoiceChanger(서버 추론 + AudioWorklet): https://github.com/sioaeko/OpenVoiceChanger
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- NeuTTS Nano: https://www.neuphonic.com/models/neutts-nano
- Sherpa-ONNX: https://github.com/k2-fsa/sherpa-onnx
- 한국어 RVC 모델 참고: https://voice-models.com
- EU AI Act 제50조: https://artificialintelligenceact.eu/article/50/

### 내부 실측 문서

- `_notebook/74-tts-rvc-lightweight-solution_Claude.md` — 경량 TTS+RVC, ONNX INT8 조사치
- `lfai-music/docs/handoff/CODER-RUNBOOK-2026-11-14_Claude.md` — RVC 모델 크기/런타임
- `lfai-music/docs/architecture/LIMITS-2026-11-15-termux-lmk-memory_Claude.md` — 폰 RVC LMK, 랩탑 실측
- `parksy-image/tools/mcp_tutor/dubstd.py` — `parksy_std_v4` 표준 체인
- `parksy-image/tools/mcp_tutor/mix.py` — 나레이션 캐시
- `parksy-image/tools/mcp_tutor/BUILD_SPEC.md` — F0 가드/보이스 규격
- `lfai-music/plan-ko-singing.html` — RVC v3 학습 이력/유사도

### 웹

- GitHub Pages 제한: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub Pages 커스텀 404: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
