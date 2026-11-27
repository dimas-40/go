// PARKSY GO — 영향도 맵 (원시 WGSL 컴퓨트)
// 같은 WebGPU device에서 돌린다. 모든 교점이 모든 돌을 한 번에 훑어
// 1/(1+0.18·d²) 가중치로 흑(+)/백(−) 영향도를 만든다. 361² = 130k회라 한 디스패치로 끝난다.
// WebGL2 폴백에서는 같은 식을 CPU로 계산한다(값 동일).

const WGSL = /* wgsl */ `
struct Params { n: u32, size: u32, pad0: u32, pad1: u32 };
@group(0) @binding(0) var<storage, read> board: array<u32>;
@group(0) @binding(1) var<storage, read_write> outv: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.n) { return; }
  let n = params.n;
  let s = params.size;
  let x = f32(i % s);
  let y = f32(i / s);
  var v = 0.0;
  for (var j = 0u; j < n; j = j + 1u) {
    let b = board[j];
    if (b == 0u) { continue; }
    let dx = x - f32(j % s);
    let dy = y - f32(j / s);
    let w = 1.0 / (1.0 + 0.18 * (dx * dx + dy * dy));
    if (b == 1u) { v = v + w; } else { v = v - w; }
  }
  let own = board[i];
  if (own == 1u) { v = v + 8.0; } else if (own == 2u) { v = v - 8.0; }
  outv[i] = clamp(v, -32.0, 32.0);
}
`;

function cpuInfluence(board, size) {
  const n = size * size;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % size, y = (i / size) | 0;
    let v = 0;
    for (let j = 0; j < n; j++) {
      const b = board[j];
      if (!b) continue;
      const dx = x - (j % size), dy = y - ((j / size) | 0);
      const w = 1 / (1 + 0.18 * (dx * dx + dy * dy));
      v += b === 1 ? w : -w;
    }
    if (board[i] === 1) v += 8;
    else if (board[i] === 2) v -= 8;
    out[i] = Math.max(-32, Math.min(32, v));
  }
  return out;
}

export class GpuInfluence {
  constructor(device) {
    this.device = device || null;
    this.pipeline = null;
    this.cache = null;
    this.chain = Promise.resolve();
    this.ok = false;
    this.error = null;
    if (this.device) {
      try {
        const module = this.device.createShaderModule({ code: WGSL, label: "parksy-go-influence" });
        this.pipeline = this.device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "main" } });
        this.ok = true;
      } catch (e) {
        this.error = String(e?.message || e);
      }
    }
  }

  _ensure(size) {
    if (this.cache && this.cache.size === size) return this.cache;
    if (this.cache) {
      for (const b of this.cache.buffers) {
        try { b.destroy(); } catch (e) { /* noop */ }
      }
    }
    const n = size * size;
    const d = this.device;
    const boardBuf = d.createBuffer({ size: n * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, label: "go-board" });
    const outBuf = d.createBuffer({ size: n * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, label: "go-influence-out" });
    const readBuf = d.createBuffer({ size: n * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, label: "go-influence-read" });
    const uniformBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label: "go-influence-params" });
    const bindGroup = d.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: boardBuf } },
        { binding: 1, resource: { buffer: outBuf } },
        { binding: 2, resource: { buffer: uniformBuf } },
      ],
    });
    this.cache = { size, boardBuf, outBuf, readBuf, uniformBuf, bindGroup, buffers: [boardBuf, outBuf, readBuf, uniformBuf] };
    return this.cache;
  }

  _runGpu(board, size, extra) {
    const n = size * size;
    const c = this._ensure(size);
    const u32 = new Uint32Array(n);
    for (let i = 0; i < n; i++) u32[i] = board[i];
    if (extra && extra.idx >= 0 && extra.idx < n) u32[extra.idx] = extra.color;
    this.device.queue.writeBuffer(c.boardBuf, 0, u32);
    this.device.queue.writeBuffer(c.uniformBuf, 0, new Uint32Array([n, size, 0, 0]));
    const enc = this.device.createCommandEncoder({ label: "go-influence-pass" });
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, c.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(n / 64));
    pass.end();
    enc.copyBufferToBuffer(c.outBuf, 0, c.readBuf, 0, n * 4);
    this.device.queue.submit([enc.finish()]);
    return c.readBuf.mapAsync(GPUMapMode.READ).then(() => {
      const values = new Float32Array(c.readBuf.getMappedRange().slice(0));
      c.readBuf.unmap();
      return values;
    });
  }

  /**
   * @param {Uint8Array} board
   * @param {number} size
   * @param {{idx:number,color:number}=} extra 가상의 한 수를 얹은 판으로 계산
   * @returns {Promise<{values: Float32Array, ms: number, backend: string, dispatch: number}>}
   */
  run(board, size, extra = null) {
    const p = this.chain.then(async () => {
      const t0 = performance.now();
      if (this.ok) {
        try {
          const values = await this._runGpu(board, size, extra);
          return { values, ms: +(performance.now() - t0).toFixed(2), backend: "WebGPU compute", dispatch: Math.ceil((size * size) / 64) };
        } catch (e) {
          this.error = String(e?.message || e);
          this.ok = false;
        }
      }
      let cpuBoard = board;
      if (extra && extra.idx >= 0 && extra.idx < board.length) {
        cpuBoard = board.slice();
        cpuBoard[extra.idx] = extra.color;
      }
      const values = cpuInfluence(cpuBoard, size);
      return { values, ms: +(performance.now() - t0).toFixed(2), backend: "CPU fallback", dispatch: 0 };
    });
    this.chain = p.catch(() => {});
    return p;
  }

  destroy() {
    if (this.cache) {
      for (const b of this.cache.buffers) {
        try { b.destroy(); } catch (e) { /* noop */ }
      }
      this.cache = null;
    }
  }
}

export async function createInfluence(device) {
  return new GpuInfluence(device);
}
