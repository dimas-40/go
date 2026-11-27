# PARKSY GO

온톨로지 그래프로 바둑판을 펴고, WebGPU(또는 WebGL2 폴백)로 그리며 두는 바둑 엔진입니다.

- 라이브: **https://dimas-40.github.io/go/**
- 원본 런타임 참고: `dimas-40/lfai-webgl` (그래프 런타임·three r186 벤더링을 이 저장소에 맞게 이식)

## 지금 동작하는 것 (실측)

- 19×19 온톨로지 격자: **361 노드 · 684 인접 링크**. 9×9·13×13은 같은 격자의 중앙 창을 사용.
- 규칙 엔진: 착수·따냄·자충수·단순 패·초패(해시 이력)·패스·두 번 패스 종국·기권·무르기.
- 계가: 중국식(면적)·일본식(집+따냄), 덤 설정.
- SGF 가져오기/내보내기.
- AI: 시드 고정 플레이아웃 + 정적 평가. 난이도 easy/normal/strong/max(시간 예산 450/1200/2600 ms).
- GPU 영향도 맵: 원시 WGSL 컴퓨트 1회 디스패치, CPU 식과 같은 가중치. WebGPU 장치가 없으면 CPU 폴백.
- AI는 Web Worker에서 실행되어 UI를 멈추지 않음.

## 검증 상태

- 엔진 단위 테스트 11개 통과: `node --test tests/go-engine.test.mjs`
- 헤드리스 Chrome(WebGPU/SwiftShader)에서는 Dawn readback이 `Instance dropped`로 실패하는 환경 버그를 실측. **headed Chrome(Xvfb)에서는 WebGPU 컴퓨트·영향도·착수·AI가 정상**, 콘솔 오류 0.
- WebGL2 폴백(`?gl=1`)은 영향도용 WebGPU 컴퓨트를 별도 장치로 연다.
- 실기기(S25 Ultra Adreno 830) 브라우저 실측은 아직 하지 않았습니다.

## 개발 계획

- [AI 바둑 엔진 개발 계획서](docs/DEVELOPMENT-PLAN_Claude.md)

## 실행

```bash
python3 -m http.server 8899
# http://127.0.0.1:8899/
```

GitHub Pages는 `.github/workflows/pages.yml`이 `main` 푸시마다 배포합니다.

## 정직한 표기

- 브라우저에는 네이티브 Vulkan 로더가 없습니다. WebGPU는 Android/Linux에서 **Dawn을 거쳐 Vulkan**을 사용하고, Windows는 D3D12, macOS는 Metal입니다. 이 저장소는 WebGPU 위에서 동작하며 Vulkan API를 직접 호출하지 않습니다.
- AI는 KataGo가 아닙니다. 현재는 플레이아웃 기반의 약한 엔진이며, KataGo 연동은 별도 계획입니다.
- 영향도는 시각화용 근사치이며 형세 판정의 정본이 아닙니다.

## 라이선스

- 이 저장소 코드: MIT (`LICENSE`)
- three.js r186: MIT (`vendor/three/LICENSE`) — `THIRD-PARTY-NOTICES.md` 참고
