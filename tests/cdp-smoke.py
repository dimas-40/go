#!/usr/bin/env python3
# PARKSY GO — headed/headless Chrome CDP 스모크 테스트.
# 서버와 Chrome(--remote-debugging-port=9222)이 먼저 떠 있어야 한다.
import base64
import json
import os
import sys
import time
import urllib.request

import websocket

PORT = 9222
errors = []


def get_json(path):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=5) as r:
        return json.loads(r.read().decode())


def main():
    tabs = [t for t in get_json("/json") if t.get("type") == "page"]
    if not tabs:
        print("NO_PAGE")
        return 1
    # SwiftShader에서 재질·그림자 셰이더 컴파일이 수 분 걸린다.
    # 30초 기본값이면 컴파일 중 소켓이 끊겨 거짓 실패가 난다.
    ws = websocket.create_connection(tabs[0]["webSocketDebuggerUrl"], timeout=600)
    seq = 0
    pending = {}

    def send(method, params=None):
        nonlocal seq
        seq += 1
        my = seq
        ws.send(json.dumps({"id": my, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == my:
                return msg
            handle_event(msg)

    def handle_event(msg):
        m = msg.get("method")
        if m == "Runtime.exceptionThrown":
            d = msg.get("params", {}).get("exceptionDetails", {})
            text = d.get("text") or d.get("exception", {}).get("description") or "exception"
            errors.append(f"EXCEPTION: {text}")
        elif m == "Runtime.consoleAPICalled":
            p = msg.get("params", {})
            if p.get("type") in ("error", "warning"):
                args = " ".join(str(a.get("value", a.get("description", ""))) for a in p.get("args", []))
                errors.append(f"CONSOLE {p.get('type')}: {args}")
        elif m == "Log.entryAdded":
            e = msg.get("params", {}).get("entry", {})
            if e.get("level") in ("error", "warning"):
                errors.append(f"LOG {e.get('level')}: {e.get('text')}")

    send("Runtime.enable")
    send("Page.enable")
    send("Network.enable")
    send("Network.setCacheDisabled", {"cacheDisabled": True})
    send("Page.navigate", {"url": os.environ.get("GO_URL", "http://127.0.0.1:8891/?gl=1&v=smoke")})
    time.sleep(1)

    def ev(expr):
        r = send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        res = r.get("result", {})
        if "exceptionDetails" in res:
            return {"__error": res["exceptionDetails"].get("text")}
        return res.get("result", {}).get("value")

    def wait(ms):
        time.sleep(ms / 1000)

    def wait_until(expr, timeout_ms=20000):
        end = time.time() + timeout_ms / 1000
        while time.time() < end:
            if ev(expr) is True:
                return True
            time.sleep(0.25)
        return False

    def report(name, value):
        print(f"CHECK {name}: {json.dumps(value, ensure_ascii=False)[:900]}")

    def shot(name):
        try:
            r = send("Page.captureScreenshot", {"format": "png"})
            data = r.get("result", {}).get("data")
            if not data:
                print("SHOT_FAIL", name)
                return
            os.makedirs("/tmp/go-shots", exist_ok=True)
            path = f"/tmp/go-shots/{name}.png"
            with open(path, "wb") as f:
                f.write(base64.b64decode(data))
            print("SHOT", path)
        except Exception as e:
            print("SHOT_ERR", name, e)

    ready = wait_until("!!window.__parksyGo && document.getElementById('bootOverlay')?.classList.contains('hidden') && !document.getElementById('titleScreen')?.classList.contains('hidden')", timeout_ms=240000)
    report("ready", ready)
    wait(400)
    shot("title")
    report("boot", ev("""({
      title: document.getElementById('titleScreen')?.className,
      boot: document.getElementById('bootOverlay')?.className,
      bootText: document.getElementById('bootText')?.textContent,
      ready: !!window.__parksyGo,
      story: window.__parksyGo?.state?.story?.id || null,
      engine: window.__parksyGo?.state?.engine?.size
    })"""))

    ev("document.getElementById('startStoryBtn').click()")
    wait_until("window.__parksyGo?.state?.story?.id === 'ch01s01'")
    wait(500)
    shot("scene1")
    report("scene1", ev("""({
      story: window.__parksyGo.state.story?.id,
      size: window.__parksyGo.state.engine.size,
      body: document.body.className,
      hud: document.getElementById('storyHud').className,
      ghost: document.getElementById('ghostText').textContent,
      completed: window.__parksyGo.state.storyComplete
    })"""))

    # 온톨로지 그래프가 게임 중에 실제로 보이는지 — 겹침 모드 + 정석 시나리오 + 기보.
    scene1_graph = ev("""({
      view: window.__parksyGo.state.viewMode,
      overlay: document.body.classList.contains('view-overlay'),
      boardVisible: window.__parksyGo.board3d()?.group?.visible,
      scenPanel: document.getElementById('scenarioPanel')?.className,
      scenNodes: document.querySelectorAll('#scenarioGraph [data-idx]').length,
      scenChips: document.querySelectorAll('#scenarioSteps .scenario-chip').length,
      kifuNodes: document.querySelectorAll('#kifuGraph [data-idx]').length,
      kifuStatus: document.getElementById('kifuStatus')?.textContent
    })""")
    report("scene1_graph", scene1_graph)

    # 그래프 단독 보기 — 나무 판이 사라지고 온톨로지만 남는지.
    ev("window.__parksyGo.viewMode('graph')")
    wait(700)
    shot("graph")
    graph_mode = ev("""({
      view: window.__parksyGo.state.viewMode,
      graph: document.body.classList.contains('view-graph'),
      boardVisible: window.__parksyGo.board3d()?.group?.visible,
      kifuNodes: document.querySelectorAll('#kifuGraph [data-idx]').length
    })""")
    report("graph_mode", graph_mode)
    ev("window.__parksyGo.viewMode('overlay')")
    wait(600)

    ev("window.__parksyGo.play('C7')")
    wait_until("window.__parksyGo?.state?.storyComplete === true")
    wait(400)
    shot("modal")
    report("scene1_win", ev("""({
      complete: window.__parksyGo.state.storyComplete,
      modal: document.getElementById('storyComplete').className,
      title: document.getElementById('completeTitle').textContent,
      next: window.__parksyGo.state.pendingNext?.id || null,
      progress: window.__parksyGo.state.progress.completed
    })"""))

    ev("document.getElementById('completeNextBtn').click()")
    wait_until("window.__parksyGo?.state?.story?.id === 'ch01s02'")
    wait(400)
    report("scene2", ev("""({
      story: window.__parksyGo.state.story?.id,
      stones: Array.from(window.__parksyGo.state.engine.board).filter(Boolean).length,
      goal: document.getElementById('storyGoal').textContent
    })"""))

    ev("window.__parksyGo.play('E6')")
    wait_until("window.__parksyGo?.state?.storyComplete === true")
    wait(300)
    report("scene2_win", ev("""({
      complete: window.__parksyGo.state.storyComplete,
      captured: window.__parksyGo.state.moveLog.at(-1)?.captured,
      next: window.__parksyGo.state.pendingNext?.id || null
    })"""))

    ev("document.getElementById('completeNextBtn').click()")
    wait_until("window.__parksyGo?.state?.story?.id === 'ch01s03'")
    wait(300)
    ev("window.__parksyGo.play('D3')")
    wait_until("window.__parksyGo?.state?.storyComplete === true")
    wait(300)
    report("scene3_win", ev("""({
      story: window.__parksyGo.state.story?.id,
      complete: window.__parksyGo.state.storyComplete,
      next: window.__parksyGo.state.pendingNext?.id || null
    })"""))

    ev("document.getElementById('completeNextBtn').click()")
    wait_until("window.__parksyGo?.state?.story?.id === 'ch01s04'")
    wait(400)
    report("scene4", ev("""({
      story: window.__parksyGo.state.story?.id,
      mode: window.__parksyGo.state.mode,
      turn: window.__parksyGo.state.engine.turn
    })"""))

    ev("window.__parksyGo.futureMode(true); window.__parksyGo.preview('E5')")
    wait(1200)
    shot("future")
    report("future", ev("""({
      futureMode: window.__parksyGo.state.futureMode,
      candidate: window.__parksyGo.state.future?.candidate,
      line: window.__parksyGo.state.future?.line?.length,
      panel: document.getElementById('futurePanel').className,
      text: document.getElementById('futureScore').textContent,
      gpu: window.__parksyGo.state.future?.gpu?.backend || null
    })"""))

    ev("window.__parksyGo.confirm()")
    wait(1600)
    report("after_future", ev("""({
      move: window.__parksyGo.state.moveLog.at(-1)?.coord,
      moves: window.__parksyGo.state.moveLog.length,
      aiThinking: window.__parksyGo.state.aiThinking,
      future: window.__parksyGo.state.future
    })"""))

    # 대시보드 / 자유 대국 — 흑·백 돌과 목판이 한 화면에 보이는지.
    ev("document.getElementById('titleBtn').click()")
    wait(900)
    ev("window.__parksyGo.startFree()")
    wait(1400)
    shot("free")
    free = ev("""({
      title: document.getElementById('titleScreen')?.className,
      body: document.body.className,
      dash: document.querySelector('.dashboard-card')?.className || null,
      dashBlack: document.getElementById('dashBlack')?.textContent,
      dashWhite: document.getElementById('dashWhite')?.textContent,
      boardStatus: document.getElementById('boardStatus')?.textContent,
      plates: !!document.getElementById('matchHud'),
      view: window.__parksyGo.state.viewMode,
      tab: window.__parksyGo.state.rightTab,
      kifuNodes: document.querySelectorAll('#kifuGraph [data-idx]').length
    })""")
    report("free", free)

    # AI 첫 후보가 중앙에 몰리지 않는지 — 엔진 좌표로 직접 검사.
    ai_candidates = ev("""(() => {
      const st = window.__parksyGo.state;
      const cands = (st.liveCandidates || []).slice(0, 6);
      const size = st.engine.size;
      const mid = (size - 1) / 2;
      // 9줄에서는 중앙 반경 1, 13줄 이상에서는 2까지만 중앙으로 센다.
      const r = size <= 9 ? 1 : 2;
      const center = cands.filter((c) => {
        const x = c.idx % size, y = Math.floor(c.idx / size);
        return Math.abs(x - mid) <= r && Math.abs(y - mid) <= r;
      }).length;
      return { cands: cands.map((c) => c.coord), center_hits: center, total: cands.length, center_radius: r };
    })()""")
    report("ai_candidates", ai_candidates)

    # 판은 정사각형으로 고정, 자리를 고른 뒤 '착수' 버튼으로 확정.
    square = ev("""(() => {
      const r = document.querySelector('.board-wrap').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(3) };
    })()""")
    report("square_board", square)

    ev("document.getElementById('sizeSelect').value='19'; window.__parksyGo.newGame(); window.__parksyGo.stage('Q16')")
    wait(350)
    staged = ev("""({
      pending: window.__parksyGo.state.pending,
      panel: document.getElementById('placePanel').className,
      coord: document.getElementById('placeCoord').textContent,
      tone: document.getElementById('placeStone').className
    })""")
    report("staged", staged)
    ev("document.getElementById('placeConfirmBtn').click()")
    wait(700)
    confirmed = ev("""(() => {
      const st = window.__parksyGo.state;
      return {
        pending: st.pending,
        last: st.moveLog.at(-1)?.coord || null,
        hasQ16: st.moveLog.some((m) => m.coord === 'Q16'),
        moves: st.moveLog.length,
        panel: document.getElementById('placePanel').className
      };
    })()""")
    report("confirmed", confirmed)

    # 기보 DB — 카테고리·목록·도해·판 위 겹침.
    ev("document.querySelector('[data-tab=\"kifu\"]').click()")
    wait(300)
    kdb = ev("""({
      items: document.querySelectorAll('.kdb-item').length,
      cats: document.querySelectorAll('.kdb-cat').length
    })""")
    report("kdb", kdb)
    ev("document.querySelector('.kdb-item')?.click()")
    wait(500)
    kdb_detail = ev("""({
      stones: document.querySelectorAll('.kdb-board circle').length,
      record: window.__parksyGo.state.kifuRecordId,
      demo: window.__parksyGo.state.kifuDemo?.line?.length || 0
    })""")
    report("kdb_detail", kdb_detail)

    # 세로 화면(휴대폰)에서 판이 잘리지 않는지.
    send("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
    wait(400)
    ev("window.__parksyGo.fitBoard(0)")
    wait(1200)
    shot("mobile")
    send("Emulation.clearDeviceMetricsOverride")
    wait(400)

    # 새 UI 계약 — 그래프가 게임 중에 보이고, AI가 중앙에 몰리지 않는다.
    problems = []
    sg = scene1_graph or {}
    if sg.get("view") != "overlay" or sg.get("overlay") is not True:
        problems.append("story scene did not enter overlay view")
    if sg.get("boardVisible") is not True:
        problems.append("3D board hidden in overlay view")
    if (sg.get("scenNodes") or 0) < 4:
        problems.append("scenario graph missing nodes")
    if (sg.get("kifuNodes") or 0) < 1:
        problems.append("kifu graph missing nodes")
    gm = graph_mode or {}
    if gm.get("view") != "graph" or gm.get("boardVisible") is not False:
        problems.append("graph mode did not hide the 3D board")
    fr = free or {}
    if fr.get("view") != "overlay":
        problems.append("free mode did not enter overlay view")
    if (fr.get("kifuNodes") or 0) < 1:
        problems.append("free mode kifu graph empty")
    ac = ai_candidates or {}
    if (ac.get("total") or 0) < 3:
        problems.append("AI candidates missing")
    if (ac.get("center_hits") or 0) > 0:
        problems.append("AI candidates clustered at center")
    sq = square or {}
    if not sq.get("w") or not sq.get("h") or abs((sq.get("ratio") or 0) - 1) > 0.02:
        problems.append("board is not square")
    stg = staged or {}
    if not stg.get("pending"):
        problems.append("click did not stage a pending stone")
    if "hidden" in (stg.get("panel") or ""):
        problems.append("place panel hidden after staging")
    if (stg.get("coord") or "").strip() != "Q16":
        problems.append("place panel coordinate mismatch")
    cf = confirmed or {}
    if cf.get("pending") is not None:
        problems.append("pending stone not cleared after placebo")
    if not cf.get("hasQ16") or (cf.get("moves") or 0) < 1:
        problems.append("confirmed placement did not reach the engine")
    kd = kdb or {}
    if (kd.get("items") or 0) < 10 or (kd.get("cats") or 0) < 5:
        problems.append("kifu DB list/categories missing")
    kdd = kdb_detail or {}
    if (kdd.get("stones") or 0) < 4:
        problems.append("kifu diagram stones missing")
    if (kdd.get("demo") or 0) < 4:
        problems.append("kifu demo not overlaid on board")
    report("gate", {"ok": not problems, "problems": problems})

    report("errors", errors[:20])
    ws.close()
    return 0 if not any("EXCEPTION" in e for e in errors) and not problems else 2


if __name__ == "__main__":
    sys.exit(main())
