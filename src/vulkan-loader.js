// PARKSY GO — WebGPU 장치 로더
// 브라우저에는 네이티브 Vulkan 로더가 없다. WebGPU(Dawn)가 Android/Linux에서
// 내부적으로 Vulkan 백엔드를 쓴다. 여기서는 코어 어댑터를 먼저 요청하고,
// 지원 기능·한도를 최대한으로 잡은 device를 만들어 그래프·연산이 같은 장치를 쓰게 한다.

const HIGH_LIMIT_KEYS = [
  "maxBufferSize",
  "maxStorageBufferBindingSize",
  "maxComputeWorkgroupStorageSize",
  "maxComputeInvocationsPerWorkgroup",
  "maxComputeWorkgroupsPerDimension",
];

function platformName() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const platform = (typeof navigator !== "undefined" && navigator.userAgentData?.platform) || "";
  if (/Android/i.test(ua) || /Android/i.test(platform)) return "Android";
  if (/Windows/i.test(ua) || /Win/i.test(platform)) return "Windows";
  if (/Mac|iPhone|iPad/i.test(ua) || /macOS/i.test(platform)) return "macOS";
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return "Linux";
  return platform || "unknown";
}

export function inferGraphicsBackend(info = {}, platform = platformName()) {
  const desc = `${info.description || ""} ${info.vendor || ""} ${info.architecture || ""}`.toLowerCase();
  if (info.isFallbackAdapter || /swiftshader|lavapipe|llvmpipe|software/.test(desc)) return "SwiftShader (Vulkan, 소프트웨어)";
  if (platform === "Windows") return "D3D12 (Dawn)";
  if (platform === "macOS") return "Metal (Dawn)";
  return "Vulkan (Dawn)";
}

async function readAdapterInfo(adapter) {
  try {
    if (adapter.info) return { ...adapter.info };
    if (typeof adapter.requestAdapterInfo === "function") return { ...(await adapter.requestAdapterInfo()) };
  } catch (e) {
    /* 정보 API가 없는 브라우저도 있다 */
  }
  return {};
}

function curatedLimits(limits) {
  const out = {};
  for (const key of HIGH_LIMIT_KEYS) {
    if (typeof limits?.[key] === "number") out[key] = limits[key];
  }
  return out;
}

/**
 * WebGPU 어댑터·장치를 연다. 실패해도 예외를 던지지 않고 WebGL2 폴백 정보를 돌려준다.
 * @param {{onLost?: (info:any)=>void}} [opts]
 */
function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function loadVulkanDevice(opts = {}) {
  const platform = platformName();
  const gpu = typeof navigator !== "undefined" ? navigator.gpu : null;
  if (!gpu) {
    return {
      ok: false,
      backend: "WebGL2",
      gpuBackend: null,
      platform,
      reason: "navigator.gpu 없음 — WebGL2로 폴백",
    };
  }

  let adapter = null;
  const attempts = [
    { powerPreference: "high-performance", featureLevel: "core" },
    { powerPreference: "high-performance" },
    {},
  ];
  for (const request of attempts) {
    try {
      adapter = await withTimeout(gpu.requestAdapter(request), 900);
    } catch (e) {
      adapter = null;
    }
    if (adapter) break;
  }
  if (!adapter) {
    return {
      ok: false,
      backend: "WebGL2",
      gpuBackend: "WebGPU 어댑터 없음",
      platform,
      reason: "requestAdapter 실패 — WebGL2로 폴백",
    };
  }

  const info = await readAdapterInfo(adapter);
  info.isFallbackAdapter = !!adapter.isFallbackAdapter;
  const features = Array.from(adapter.features || []);
  const limits = { ...(adapter.limits || {}) };
  const requiredLimits = curatedLimits(limits);

  const requestDevice = async () => {
    try {
      return await withTimeout(adapter.requestDevice({ requiredFeatures: features, requiredLimits }), 1500);
    } catch (e) {
      try {
        return await withTimeout(adapter.requestDevice({ requiredFeatures: features }), 1200);
      } catch (e2) {
        try {
          return await withTimeout(adapter.requestDevice(), 1200);
        } catch (e3) {
          return null;
        }
      }
    }
  };

  // probeOnly: 이미 다른 렌더러(WebGPU)가 장치를 연 경우 두 번째 device를 만들지 않는다.
  // SwiftShader/Dawn에서 어댑터 두 개를 동시에 열면 인스턴스가 흔들리는 사례가 실측됐다.
  if (opts.probeOnly) {
    return {
      ok: true,
      platform,
      adapter,
      device: null,
      info,
      features,
      limits,
      requiredLimits,
      gpuBackend: inferGraphicsBackend(info, platform),
      backend: "WebGPU",
      isFallbackAdapter: !!adapter.isFallbackAdapter,
      timestampQuery: features.includes("timestamp-query"),
      lost: Promise.resolve(null),
      probe: true,
      ensureDevice: async () => {
        const device = await requestDevice();
        return device;
      },
    };
  }

  let device = await requestDevice();
  if (!device) {
    return {
      ok: false,
      backend: "WebGL2",
      gpuBackend: "WebGPU 장치 없음",
      platform,
      adapter,
      info,
      reason: "requestDevice 실패 — WebGL2로 폴백",
    };
  }

  const lost = new Promise((resolve) => {
    device.lost.then((lostInfo) => {
      const detail = { reason: lostInfo?.reason, message: lostInfo?.message || "" };
      try {
        opts.onLost?.(detail);
      } catch (e) {
        /* noop */
      }
      resolve(detail);
    });
  });

  return {
    ok: true,
    platform,
    adapter,
    device,
    info,
    features,
    limits,
    requiredLimits,
    gpuBackend: inferGraphicsBackend(info, platform),
    backend: "WebGPU",
    isFallbackAdapter: !!adapter.isFallbackAdapter,
    timestampQuery: features.includes("timestamp-query"),
    lost,
  };
}

export function describeLoader(loader) {
  if (!loader) return "WebGPU 로더 없음";
  if (!loader.ok) return loader.reason || "WebGL2 폴백";
  const i = loader.info || {};
  const name = [i.vendor, i.architecture, i.device || i.description].filter(Boolean).join(" · ") || "GPU 정보 없음";
  return `${loader.gpuBackend} · ${name}`;
}
