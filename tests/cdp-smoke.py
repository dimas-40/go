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
    report("free", ev("""({
      title: document.getElementById('titleScreen')?.className,
      body: document.body.className,
      dash: document.querySelector('.dashboard-card')?.className || null,
      dashBlack: document.getElementById('dashBlack')?.textContent,
      dashWhite: document.getElementById('dashWhite')?.textContent,
      boardStatus: document.getElementById('boardStatus')?.textContent,
      plates: !!document.getElementById('matchHud')
    })"""))

    # 세로 화면(휴대폰)에서 판이 잘리지 않는지.
    send("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
    wait(400)
    ev("window.__parksyGo.fitBoard(0)")
    wait(1200)
    shot("mobile")
    send("Emulation.clearDeviceMetricsOverride")
    wait(400)

    report("errors", errors[:20])
    ws.close()
    return 0 if not any("EXCEPTION" in e for e in errors) else 2


if __name__ == "__main__":
    sys.exit(main())
