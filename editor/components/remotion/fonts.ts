/**
 * Register custom fonts for both Next.js (Player preview) and Remotion render.
 * Uses /fonts/ public directory.
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

export function registerFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("__remotion-fonts")) return;

  const style = document.createElement("style");
  style.id = "__remotion-fonts";
  const rules = FONTS.map(
    (f) => `@font-face {
  font-family: '${f.family}';
  src: url('/fonts/${f.file}') format('${f.file.endsWith(".woff2") ? "woff2" : "truetype"}');
  font-weight: ${f.weight ?? 400};
  font-display: block;
}`
  ).join("\n");

  style.textContent = rules;
  document.head.appendChild(style);
}
