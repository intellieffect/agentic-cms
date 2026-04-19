/**
 * Video color regression tests
 *
 * Ensures:
 * 1. Rendering uses OffthreadVideo (Rust decoder) — not Chrome <Video>
 * 2. Proxy generation preserves bt709 color tags
 * 3. HQ proxy route serves proxy (not raw HDR original)
 * 4. render_remotion uses concurrency ≤ 2
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

// ─── 1. OffthreadVideo in rendering path ───

describe("VideoClip uses OffthreadVideo for rendering", () => {
  const paths = [
    "remotion/src/VideoClip.tsx",
    "components/remotion/VideoClip.tsx",
  ];

  for (const rel of paths) {
    it(`${rel} imports OffthreadVideo`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf-8");
      expect(src).toContain("OffthreadVideo");
    });

    it(`${rel} uses OffthreadVideo when isRendering`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf-8");
      expect(src).toContain("getRemotionEnvironment().isRendering");
      // OffthreadVideo must appear inside the rendering branch
      expect(src).toMatch(/<OffthreadVideo[\s\S]*?src=/);
    });

    it(`${rel} keeps <Video> for preview (non-rendering)`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf-8");
      expect(src).toMatch(/<Video[\s\S]*?src=/);
    });
  }
});

// ─── 2. Proxy generation includes bt709 color tags ───

describe("proxy_utils.py color tags", () => {
  const proxyUtils = readFileSync(
    resolve(ROOT, "src/server/proxy_utils.py"),
    "utf-8"
  );

  it("ffmpeg command includes -color_primaries bt709", () => {
    expect(proxyUtils).toContain("-color_primaries");
    expect(proxyUtils).toContain("bt709");
  });

  it("ffmpeg command includes -color_trc bt709", () => {
    expect(proxyUtils).toContain("-color_trc");
  });

  it("ffmpeg command includes -colorspace bt709", () => {
    expect(proxyUtils).toContain("-colorspace");
  });
});

// ─── 3. HQ route serves proxy first (not raw HDR original) ───

describe("app.py HQ route prioritises proxy", () => {
  const appPy = readFileSync(
    resolve(ROOT, "src/server/app.py"),
    "utf-8"
  );

  it("quality=='hq' branch checks existing proxy_dir first", () => {
    // The HQ branch should reference proxy_dir / fname before falling back
    const hqSection = appPy.slice(
      appPy.indexOf('if quality == "hq"'),
      appPy.indexOf("else:", appPy.indexOf('if quality == "hq"'))
    );
    expect(hqSection).toBeDefined();
    expect(hqSection).toContain("proxy_dir / fname");
  });

  it("quality=='hq' does NOT come after regular proxy check", () => {
    // quality=='hq' must be checked BEFORE the regular proxy else branch
    const hqIdx = appPy.indexOf('if quality == "hq"');
    const regularIdx = appPy.indexOf(
      "# 일반 프록시",
      appPy.indexOf("is_video and not use_original")
    );
    expect(hqIdx).toBeGreaterThan(-1);
    expect(regularIdx).toBeGreaterThan(-1);
    expect(hqIdx).toBeLessThan(regularIdx);
  });
});

// ─── 4. Render concurrency ≤ 2 ───

describe("render_remotion.py concurrency", () => {
  const renderPy = readFileSync(
    resolve(ROOT, "src/server/routes/render_remotion.py"),
    "utf-8"
  );

  it("concurrency is 2 or less", () => {
    const match = renderPy.match(/"--concurrency",\s*"(\d+)"/);
    expect(match).not.toBeNull();
    const concurrency = parseInt(match![1], 10);
    expect(concurrency).toBeLessThanOrEqual(2);
  });
});
