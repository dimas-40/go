# PARKSY GO — AI 바둑 엔진 개발 계획서

- 작성: 2026-11-27 · `_Claude`
- 현재 라이브: https://dimas-40.github.io/go/
- 저장소: https://github.com/dimas-40/go
- 이 문서는 **계획**입니다. 아래 "실측"과 "조사"를 구분해 표기했습니다.

---

## 0. 결론

가능합니다. 단, 한 덩어리로 만들지 않고 **세 개의 코어**로 나눕니다.

1. **규칙·기보 코어(직접 만든다)** — 착수/따냄/패/계가/SGF. 이미 동작.
2. **수읽기 코어(빌려온다)** — KataGo. 브라우저에서는 KataGo ONNX + ONNX Runtime Web(WebGPU), 필요하면 폰/PC의 네이티브 KataGo를 로컬 사이드카로 붙입니다.
3. **스타일·과외 코어(직접 조합한다)** — KataGo 분석값과 온톨로지 그래프를 사실(fact)로 만들고, 난이도/기풍/해설을 그 위에 얹습니다.

"기보를 학습한 스타일 AI"는 두 갈래입니다.
- **빌려오는 길:** KataGo Human SL 모델의 `humanSLProfile`(급수·연대별 프로 흉내). 현재로선 **네이티브 KataGo 경로**가 확실합니다.
- **직접 만드는 길:** 허가된 기보로 소형 정책망을 미세조정. 데이터 권리와 학습 비용이 관문입니다.

브라우저에서 "Vulkan 로더를 직접 연다"는 표현은 정확하지 않습니다. 브라우저는 **WebGPU → Dawn → Vulkan** 경로를 쓰고, 네이티브 실행기(Termux)에서만 Vulkan을 직접 호출합니다. 이 계획은 두 레인을 분리합니다.

---

## 1. 현재 기준선 (실측)

| 항목 | 값 | 비고 |
|---|---|---|
| 라이브 URL | `https://dimas-40.github.io/go/` | 2026-11-27 200 확인 |
| 온톨로지 격자 | 361 노드 · 684 링크 | 19×19 교점 + 직교 인접 |
| 규칙 테스트 | 11/11 통과 | `node --test tests/go-engine.test.mjs` |
| 헤드리스 Chrome(WebGPU/SwiftShader) | Dawn readback `Instance dropped` | 헤드리스 환경 한정 실패 |
| headed Chrome(Xvfb) | WebGPU 컴퓨트·착수·AI 정상, 콘솔 오류 0 | 영향도 1.1~1.4초(SwiftShader CPU) |
| 라이브 headed 스모크 | WebGPU, K10 착수, AI 응수, 영향도 WebGPU compute, 실패 요청 0 | 2026-11-27 |
| 폰 메모리 게이트 | MemAvailable 1.72 GB, SwapFree 8.8 MB, 판정 fail | 2026-11-27 04:17 UTC 실측 |
| 폰 네이티브 Vulkan 레인 | Termux bionic 실행기 `vkfft` 빌드됨, SPIR-V 4종 | 시스템 Vulkan 로더 → Adreno |
| AI 강도 | 시드 플레이아웃 + 정적 평가 | KataGo 아님. 초급 수준 |

현재 라이브는 "놀이 가능한 온톨로지 바둑판"이지 "강한 바둑 AI"가 아닙니다. 이 계획의 본체는 그 위에 수읽기와 과외를 얹는 일입니다.

---

## 2. 빌려올 수 있는 것 (조사 결과)

### 2.1 수읽기 코어 — KataGo

- 코드: MIT. https://github.com/lightvector/KataGo
- 공식 네트워크: **KataGo Neural Network License** — 사용·수정·재배포·판매 허용, 고지 포함 조건. g170 구형 네트워크는 CC0. Human SL 네트워크도 KataGo-labeled extra network로 이 라이선스에 포함.
  - https://katagotraining.org/network_license/
- Human SL(인간 흉내) 모델: `b18c384nbt-humanv0.bin.gz` (2024-07).
  - `humanSLProfile` 예: `rank_5k`, `rank_3d`, `preaz_5k`, `proyear_2023`, `rank_{흑}_{백}`.
  - `includePolicy`로 `humanPolicy`를 받아 샘플링하는 것이 기본 레시피.
  - https://katagotraining.org/extra_networks/ · https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md
- 분석 출력: `moveInfos`에 `winrate`,`scoreLead`,`prior`,`pv`,`ownership`,`order` 등. `humanPrior`,`humanPolicy`는 Human SL 사용 시.
- 브라우저 실행 선례: KataGo를 Emscripten/pthreads WASM으로 돌린 사례가 있음. **Cross-Origin-Opener-Policy: same-origin + Cross-Origin-Embedder-Policy: require-corp**가 없으면 엔진이 조용히 죽음. iframe 안에서는 격리가 상속되지 않음.
  - https://github.com/y-ich/KataGo · https://github.com/ghost-go/katago-js
- Android: 공식 APK 없음. 커뮤니티 **BadukAI**가 OpenCL로 동작(스냅드래곤 855+에서 약 10 nodes/s, 첫 실행 OpenCL 튜닝 4~10분). S25 Ultra 실측은 아직 없음.
  - https://aki65.github.io/ · https://github.com/karino2/KataGo

### 2.2 브라우저 신경망 — KataGo ONNX + ONNX Runtime Web

- `kaya-go/katago-onnx`: KataGo 체크포인트 → ONNX 변환 도구. **AGPL-3.0**.
  - https://github.com/kaya-go/katago-onnx
- 변환된 모델: `kaya-go/kaya` (Hugging Face), **MIT** 메타데이터. b28c512 2종.
  - FP32 293,099,607 B · FP16 146,963,282 B · UINT8 75,176,902 B (HF API 실측)
  - 입력: `bin_input [B,22,H,W]`, `global_input [B,19]`
  - 출력: `policy [B,2,moves]`, `value [B,3]`, `ownership`, `scoring`, `futurepos`, `seki`, `scorebelief`
  - https://huggingface.co/kaya-go/kaya
- Kaya 앱 자체는 **AGPL-3.0**. 코드를 복사하면 우리 앱도 AGPL이 됩니다. 모델(MIT)과 런타임만 쓰고, 보드 인코딩·MCTS는 직접 구현하는 쪽이 안전합니다.
- ONNX Runtime Web WebGPU EP: `onnxruntime-web/webgpu`, `executionProviders: ['webgpu']`. Chrome/Edge의 Windows·macOS·Android·ChromeOS 지원. **실험적**이며 FP16 요구사항은 공식 페이지에 명시돼 있지 않음 → 실기기 실측 필요.
  - https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- 선례: Web KaTrain(TensorFlow.js WebGPU/WASM, 저장소 비공개), `@multi-game-engines/adapter-katago`(ONNX, 현재 가짜 스텁 가중치).
  - https://forums.online-go.com/t/web-katrain-browser-based-katrain-clone-with-in-browser-katago-analysis-webgpu-wasm/59096

### 2.3 스타일 연구

- `gostyle`: 기보를 패턴 벡터 → 스타일 벡터로. k-NN/NN, GPL 소프트웨어.
- "Identifying fighting, balanced, and territorial go player styles with deep learning": 70,000 기보, 3분류, 테스트 정확도 82.6%.
- 요약: **감(느낌)이 아니라 측정 가능한 축**이 이미 존재합니다. 다만 "특정 프로의 기풍"을 소수 기보로 재현하는 것은 별개의 어려운 문제입니다.

### 2.4 데이터·정석 (라이선스 주의)

| 데이터 | 상태 | 판단 |
|---|---|---|
| KataGo 공식 네트워크 | KataGo Network License (상업 허용·고지) / g170 CC0 | 사용 가능 |
| Kaya ONNX 모델 | MIT | 사용 가능 |
| GoGoD | 상업 DB, EU sui generis database right 주장 | **허가 전 사용 금지** |
| Kogo's Joseki Dictionary | 무료지만 "상업 배포 금지" | **허가 전 번들 금지** |
| OGS 덤프 | "redistributed with permission"이나 명시 라이선스 없음 | **서면 허가 필요** |
| KGS/u-go.net, WAGC | 라이선스 불명 | 허가 확인 전 보류 |
| HF `kenhktsui/go_pgn_string_v2` | GoGoD 파생 | GoGoD 권리 승계 위험 |

정본 데이터 전략은 **(a) KataGo self-play, (b) 서면 허가받은 OGS/보유 기보, (c) 사용자가 직접 넣은 SGF**입니다. 정석 사전은 권리자 허가 또는 허가된 기보에서 자체 추출합니다.

### 2.5 과외 선생님(속삭임) 레인

- 사실 생성은 KataGo 분석 + 온톨로지가 담당하고, 문장은 템플릿이 우선입니다.
- 목소리는 Web Speech API(ko-KR, 헤드폰) 또는 폰 TTS. 화면 밖에서 "속삭임"이 필요하면 기존 Axis 오버레이(`axis_narrator`) + ADB/Shizuku 레인을 씁니다. **ADB는 브라우저 게임의 실시간 채널이 아니라 오버레이 전달 수단**입니다.
- LLM을 붙일 경우 WebLLM/MLC(WebGPU, 0.5B~2B)이 후보지만 모바일에서 1GB+ 모델은 LMK 위험이 큽니다. 1차는 템플릿, 2차는 소형 LLM 실험으로 둡니다.
  - https://webllm.mlc.ai/

---

## 3. 제품 구조

```
┌─────────────────────────────────────────────────────────────┐
│ UI: 온톨로지 그래프 뷰 (three.js WebGPURenderer + WGSL)       │
│   · 교점/돌/집단/활로/영향도/정석 분기/후보 수 그래프          │
│   · 착수·무르기·SGF·계가·과외 패널·속삭임                     │
├─────────────────────────────────────────────────────────────┤
│ 규칙·기보 코어 (우리 것)                                      │
│   · GoEngine: 착수/따냄/패/초패/계가/SGF                       │
├─────────────────────────────────────────────────────────────┤
│ 수읽기 코어 (Worker)                                          │
│   · A안: onnxruntime-web + KataGo ONNX (WebGPU/WASM)          │
│   · B안: 네이티브 KataGo 사이드카 (localhost WebSocket)        │
│   · 공통: 후보 수·승률·집 차이·소유권·PV → 사실 JSON           │
├─────────────────────────────────────────────────────────────┤
│ 스타일·난이도 코어                                            │
│   · 급수 사다리 · 정책 온도/방문수 · 실수 주입                 │
│   · Human SL 프로필(네이티브) · 기풍 축(측정 후 명명)          │
├─────────────────────────────────────────────────────────────┤
│ 과외 코어                                                     │
│   · 사실 → 우선순위 → 한국어 코멘트 → TTS/Axis 오버레이       │
├─────────────────────────────────────────────────────────────┤
│ 온톨로지 그래프 저장소                                        │
│   · 정적: 교점·집단·활로·정석 노드·개념                      │
│   · 동적: 국면 노드·수 전이·PV·유사 국면                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 수읽기 코어 상세

### 4.1 A안 — 브라우저 ONNX (1차)

- 모델: `kaya-go/kaya`의 b28c512 FP16(147 MB) 또는 UINT8(75 MB). 폰 메모리를 고려해 **UINT8 우선**, 데스크톱은 FP16.
- 장기적으로는 b28 전체보다 **b10/b6급 소형 ONNX를 직접 export**해 폰에서 돌리는 쪽이 현실적입니다. KataGo `python/modelconfigs.py`에 b6c96/b10c128 구성이 있습니다.
- 보드 인코딩: KataGo의 22개 이진 평면 + 전역 19특징. `katago-onnx`/Kaya의 인코딩을 **복사하지 않고**, KataGo 문서와 대조해 독립 구현합니다(AGPL 회피).
- 추론: `onnxruntime-web/webgpu`, Web Worker에서 배치 추론. 출력 `policy`(362), `value`, `ownership`을 MCTS에 사용.
- MCTS: 우리 Worker에 구현. 방문수 예산은 1(느낌표)~800. 폰에서는 50~200부터.
- 실패 시: `wasm` EP 폴백. 단 WASM 스레드는 COOP/COEP 필요 → Pages 헤더를 못 바꾸면 단일 스레드로.

**1차 목표:** "KataGo ONNX가 S25 브라우저에서 한 수에 몇 ms, 몇 방문/초인가"를 숫자로 확정. 이 숫자가 전체 설계를 좌우합니다.

### 4.2 B안 — 네이티브 KataGo 사이드카 (Human SL·강한 분석)

- 폰 Termux(또는 랩탑)에서 KataGo 바이너리 + Human SL 모델 실행 → localhost WebSocket/HTTP로 분석 JSON 전달.
- Human SL은 `humanSLProfile`로 급수·연대 프로 흉내가 가능하므로, **"난이도 조절 + 기풍"의 가장 확실한 경로**입니다.
- 현실 리스크: Android용 공식 배포 없음, OpenCL 백엔드 빌드 필요, 첫 실행 튜닝 4~10분(선례), 발열·메모리. S25 Adreno 830에서 실측 전까지 **미확정**.
- 브라우저 단독 배포(URL 하나)를 우선하고, 사이드카는 "설치형 파워 모드"로 둡니다.

### 4.3 Human SL을 ONNX로?

- KataGo ONNX 메타데이터에 `katago.metaEncoderVersion = 1`(human-style, `InputMeta` 입력) 표기가 존재하지만, **Human SL 체크포인트를 ONNX로 내보내는 공식·검증된 도구는 확인되지 않았습니다.**
- 따라서 1차 계획에서 Human SL은 네이티브 경로로 한정합니다. ONNX export는 별도 스파이크로 두고, 성공하면 브라우저로 승격합니다.

### 4.4 스타일 미세조정

- KataGo 공식 학습 코드는 TensorFlow 1.15 기반 `python/train.py`.
- 허가된 기보로 소형 정책망을 미세조정하고, `export_model.py` → ONNX 변환.
- 학습은 폰에서 하지 않습니다(메모리·발열). 랩탑/클라우드.
- 평가 게이트: 기존 대비 승률 손실 한도, 스타일 분류 정확도, 사람 검수.

---

## 5. 난이도와 기풍

### 5.1 급수 사다리

| 단계 | 네이티브(Human SL) | 브라우저(대체) |
|---|---|---|
| 입문 20k~15k | `rank_20k`~`rank_15k`, 소수 방문 | 후보 수 top-5 샘플링, 온도 높음, 큰 실수 허용 |
| 초급 10k~5k | `rank_10k`~`rank_5k` | 방문 10~50, 온도 1.2, 눈/사활 실수 일부 |
| 중급 1k~3d | `rank_1k`~`rank_3d` | 방문 100~300, 온도 1.0 |
| 상급 4d~9d | `rank_4d`~`rank_9d` + 탐색 강화 | 방문 400~800, 온도 낮춤 |
| 최강 | 일반 KataGo 네트워크 + 충분한 방문 | 브라우저 한계 명시 |

- 파라미터: `rootPolicyTemperature`, top-k 샘플링, `playoutDoublingAdvantage`(접바둑), 실수 주입률.
- **"9d"라고 쓰지 않습니다.** 실측 캘리브레이션 전에는 "레벨"로 표기하고, 기준 엔진과의 대국 결과로만 급수를 붙입니다.

### 5.2 기풍(style)

- 연구 축: **전투형 / 균형형 / 실리형**.
- 1차: 기보에서 특징(전투 발생률, 3선/4선 비율, 중앙 사용률, 집 크기 분산)을 뽑아 축을 측정.
- 2차: 축을 착수 선택에 반영(전투 수 우선, 실리 수 우선, 균형).
- 3차: 특정 기사/기보군 미세조정은 **데이터 허가 + 학습 비용 + 품질 게이트**를 통과할 때만.
- "표절 세탁"이 되지 않도록, 특정 창작물의 고유 표현을 복제하는 용도는 금지합니다. 공개 기보의 통계적 학습은 별도 검토.

---

## 6. 온톨로지 그래프

### 6.1 스키마

```
Node: Intersection | Stone | Group | Liberty | Eye | Territory
      Position | Move | JosekiNode | Concept | Comment | StyleProfile
Edge: adjacent | belongsTo | libertyOf | atariOf | captures
      transitionsTo | answers | threatens | defends
      similarTo (유사 국면) | exemplifies (개념 예시) | deviatesFrom (정석 이탈)
```

- 정적 그래프: 현재 361/684. 여기에 집단·활로·눈·집을 동적 클래스로.
- 동적 그래프: 각 국면을 노드로, 수를 엣지로. KataGo PV를 펼치면 "후보 수 트리"가 그래프가 됩니다.
- 정석 노드: 정석 사전(허가 후) 또는 허가 기보에서 추출. 이탈 감지 시 `deviatesFrom` 엣지 + 유사 기보 검색.
- 저장: 1차는 JSON + IndexedDB. 국면 해시(우리 초패 해시 재사용)로 중복 제거. 규모가 커지면 SQLite/WASM 또는 서버 그래프 DB.

### 6.2 GPU

- 그래프 배치: 현재 TSL 컴퓨트(반발·스프링). 유사도 검색/클러스터링은 WGSL 컴퓨트로.
- 후보 수·영향도·소유권 히트맵: 이미지 텍스처 또는 인스턴스 노드 색으로.
- "정석 이후 전개 이미지"는 정적 그림이 아니라 **후보 수 그래프 + 소유권/승률 레이어**로 표현합니다.

---

## 7. 과외 선생님 (속삭임)

### 7.1 사실 계약

```json
{
  "turn": 42,
  "winrate": 0.47,
  "scoreLead": -1.8,
  "topMoves": [
    {"move":"Q10","visits":180,"winrate":0.49,"scoreLead":0.2,"pv":["Q10","R11"],"tags":["sente","cut"]}
  ],
  "ownership": [0],
  "concepts": ["atari","weakGroup","josekiDeviation"],
  "urgency": 0.72
}
```

### 7.2 문장 생성

- 1차: 규칙 템플릿. 예) "지금 좌변 약한 돌이 잡히기 직전입니다. Q10으로 잇는 수가 승률 +2.8%p입니다."
- 2차: LLM은 **사실 JSON을 벗어나지 않도록** 시스템 프롬프트 + 검증(수·좌표·수치 인용 검사).
- 금지: LLM이 수치를 새로 만들기, 엔진에 없는 정석 이름 단정.

### 7.3 전달

- MVP: 게임 페이지 우측 패널 + 선택적 TTS(헤드폰).
- 폰 밖: Axis 오버레이 + `axis_narrator`, ADB/Shizuku는 전달 레인. 게임이 백그라운드여도 "귀신"처럼 보이게.
- 지연 예산: 분석 300ms 이내 + 문장 50ms + TTS 200ms. 분석이 길면 "생각 중" 상태를 정직하게 표시.

---

## 8. GPU·Vulkan 두 레인

### 8.1 웹 레인 (1차)

- `WebGPURenderer` + TSL, MSAA, bloom, 인스턴싱, 원시 WGSL 컴퓨트.
- ONNX Runtime Web `webgpu` EP로 정책/가치/소유권 추론.
- **측정 항목:** 어댑터, 한 수 추론 ms, 방문/초, 모델 로드 시간, 메모리, FPS.
- 폴백: WebGL2 렌더 + CPU/별도 WebGPU 컴퓨트(현재 구현), ONNX는 WASM.

### 8.2 네이티브 폰 레인 (2차)

- Termux bionic 실행기 → 시스템 Vulkan 로더 → Adreno. 현재 `vkfft` 실행기와 SPIR-V 셰이더가 빌드되어 있음(실측).
- 용도: 커스텀 컴퓨트(영향도·유사도·그래프 레이아웃)와, 필요하면 신경망 커널.
- KataGo 네이티브는 **Vulkan이 아니라 OpenCL 백엔드**입니다. 두 사실을 섞지 않습니다.
- 브라우저 WebGPU는 Android에서 Dawn을 거쳐 Vulkan을 쓰지만, 페이지가 Vulkan API를 직접 호출하는 것은 아닙니다.

---

## 9. 라이선스·데이터 원칙

1. KataGo 코드 MIT, 네트워크는 KataGo Network License(고지 포함). 출처 표기.
2. Kaya ONNX 모델 MIT. Kaya 앱/`katago-onnx`는 AGPL → **코드 복사 금지**, 모델·인터페이스만 참고.
3. GoGoD·KJD·출처 불명 SGF는 허가 전 사용·재배포 금지.
4. OGS는 서면 허가를 받고, 받은 범위를 문서화. 허가 전에는 self-play·사용자 SGF만.
5. 데이터셋 카드에 출처·라이선스·전처리·한계를 기록.
6. 학습 결과 모델도 라이선스 상속을 검토.

---

## 10. 마일스톤

| 단계 | 기간(1인 기준) | 산출물 | 통과 기준 |
|---|---|---|---|
| **M0 (완료)** | — | 라이브 온톨로지 바둑판, 규칙/SGF, 영향도 | 11/11 테스트, 라이브 200, headed WebGPU 정상 |
| **M1** | 1~2주 | ONNX 수읽기 Worker, 정책/가치/소유권 표시, 난이도 3단 | S25에서 추론 ms·방문/초 실측, 한 수 1초 내(목표) |
| **M2** | 1~2주 | 과외 패널·템플릿·TTS, 복기 모드 | 사실 정확도 표본 검수 100%, 지연 예산 충족 |
| **M3** | 2~3주 | 정석/국면 온톨로지, 이탈 감지, 유사 국면, 그래프 뷰 | 허가 데이터로 그래프 구축, 검색 정확도 표본 검증 |
| **M4** | 2~3주 | 스타일 축·난이도 캘리브레이션, Human SL 네이티브 스파이크 | 기준 엔진 대국 결과표, 스타일 라벨은 측정 후 |
| **M5** | 2주 | 폰 Vulkan/OpenCL 성능 레인, 패키징 | 폰에서 방문/초·발열·메모리 실측, LMK 0회 |
| **M6** | 1~2주 | 오프라인/PWA, 접근성, 문서, 배포 | 재현 가능한 벤치마크, 라이선스 고지 완료 |

총 **8~12주** 예상. M1의 실측 숫자가 나쁘면 M4/M5 계획을 줄이고 브라우저 경량 모드로 전환합니다.

---

## 11. 검증 지표

- **성능:** 모델 로드 s, 추론 ms/수, 방문/초, FPS, 메모리 피크, 발열.
- **강도:** GNU Go 레벨, 이전 빌드 대비 승률, 사람 테스트(급수 라벨은 실측 후).
- **스타일:** 3축 분류 정확도(연구 기준 82.6%는 참고치), 스타일 파라미터가 실제 착수 분포를 바꾸는지.
- **과외:** 사실 인용 정확도, 잘못된 수치 0건, 지연.
- **온톨로지:** 노드/엣지 수, 정석 이탈 감지 표본, 유사 국면 검색 품질.
- **안정성:** LMK 0회, 콘솔 오류 0, WebGL 폴백 동작.

---

## 12. 위험과 완화

| 위험 | 완화 |
|---|---|
| ONNX WebGPU EP 실험적 | WASM 폴백, 모델 축소, 실기기 실측 후 결정 |
| b28 모델 75~147MB, 폰 LMK | UINT8/소형 b6·b10, memgate, Worker 종료 정책 |
| Human SL ONNX 미확인 | 네이티브 사이드카로 한정, export 스파이크 별도 |
| KataGo Android OpenCL 빌드 난항 | BadukAI/karino2 선례 조사, 실패 시 랩탑 사이드카 |
| 헤드리스 WebGPU readback 버그 | headed/실기기 검증, 테스트 문서화 |
| 데이터 라이선스 | 허가 전 금지, self-play 우선, 출처 카드 |
| LLM 환각 | 사실 JSON 고정, 수치·좌표 검증, 템플릿 우선 |
| 스타일이 강도를 망침 | 승률 손실 한도, A/B 대국 |
| "9d" 과장 | 캘리브레이션 전 레벨 표기 |

---

## 13. 즉시 다음 스파이크 (아직 시작 안 함)

1. **S25 실기기에서 b28 UINT8/FP16 ONNX 로드·추론 벤치마크** (Chrome for Android / Samsung Internet). 측정: 로드 s, 추론 ms, 방문/초, 메모리.
2. **b6c96/b10c128 ONNX export** 후 같은 벤치마크. 폰 기본 모델 후보 결정.
3. **Termux KataGo OpenCL 빌드** + Human SL 모델 로드. 측정: nodes/s, 첫 튜닝 시간, 발열.
4. **OGS 서면 허가** 및 데이터 카드 초안.
5. **Human SL ONNX export 가능성** 확인(`metaEncoderVersion=1`, `InputMeta`).
6. **Axis 오버레이 속삭임 파일럿**: `axis_narrator`로 한 줄 코멘트 표시.

각 스파이크는 성공/실패와 숫자를 이 문서에 추가합니다.

---

## 14. 참고 링크

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

---

## 15. 이번 주에 하지 않을 것

- GoGoD/KJD 데이터 번들.
- Human SL을 브라우저에서 된다고 가정한 UI.
- "9d" 등 미측정 급수 표기.
- LLM이 직접 수를 고르게 하는 구조.
