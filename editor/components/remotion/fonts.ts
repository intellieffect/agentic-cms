/**
 * Register custom fonts for the Player preview (Next.js context).
 * Uses FontFace API per Remotion best-practice — `document.fonts` ready promise gives
 * deterministic font availability before Player starts rendering.
 *
 * The Remotion render path uses `editor/remotion/src/fonts.ts`, which wraps the same
 * loads with `delayRender` / `continueRender` so the renderer waits for fonts.
 */

const FONTS: Array<{ family: string; file: string; weight?: number }> = [
  { family: "BMDOHYEON", file: "BMDOHYEON.ttf" },
  { family: "BMHANNAPro", file: "BMHANNAPro.ttf" },
  { family: "BMJUA", file: "BMJUA.ttf" },
  { family: "Cafe24 Ssurround", file: "Cafe24Ssurround.ttf", weight: 700 },
  { family: "Cafe24 Ssurround Air", file: "Cafe24SsurroundAir.ttf", weight: 300 },
  { family: "Caveat", file: "Caveat-Regular.ttf" },
  { family: "Coming Soon", file: "ComingSoon-Regular.ttf" },
  { family: "CookieRun", file: "CookieRun-Bold.ttf", weight: 700 },
  { family: "GmarketSans", file: "GmarketSansBold.ttf", weight: 700 },
  { family: "Indie Flower", file: "IndieFlower-Regular.ttf" },
  { family: "Jalnan", file: "Jalnan.ttf" },
  { family: "MaruBuri", file: "MaruBuri-Bold.ttf", weight: 700 },
  { family: "Paperlogy", file: "Paperlogy-ExtraBold.ttf", weight: 800 },
  { family: "SUITE", file: "SUITE-Bold.ttf", weight: 700 },
  { family: "LINESeedKR", file: "LINESeedKR-Bold.woff2", weight: 700 },
];

let registered = false;

export function registerFonts(): void {
  if (typeof document === "undefined") return;
  if (registered) return;
  registered = true;

  for (const f of FONTS) {
    const url = `/fonts/${f.file}`;
    const format = f.file.endsWith(".woff2") ? "woff2" : "truetype";
    const font = new FontFace(f.family, `url('${url}') format('${format}')`, {
      weight: String(f.weight ?? 400),
      display: "block",
    });
    font
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch((err) => console.warn(`[fonts] failed to load ${f.family}:`, err));
  }
}
