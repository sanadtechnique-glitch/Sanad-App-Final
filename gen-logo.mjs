import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";

const font = readFileSync("/tmp/Cairo.ttf");

const W = 220;
const H = 230;

// Map pin (Lucide 24×24 viewBox).
// pinCenterY  = y of the circle (the "dot" part at the top of the pin).
// The tip extends downward below pinCenterY.
function pinPath(cx, pinCenterY, pinSize) {
  const s = pinSize / 24;
  // In the 24×24 path the circle center is at y=9, tip at y≈22.
  // We place the circle center at pinCenterY:
  //   transform y = pinCenterY - 9*s
  const tx = cx - 12 * s;
  const ty = pinCenterY - 9 * s;
  return `
    <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${s.toFixed(4)})">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#2E7D32"/>
      <circle cx="12" cy="9" r="3" fill="#FFF3E0"/>
    </g>
  `;
}

// ── Layout ────────────────────────────────────────────────
// Text "سـد" is in the UPPER area.
// The map pin sits BELOW the noon letter exactly where its dot used to be.
//
// At font-size 64, Cairo:
//   baseline  ≈ textY
//   cap-top   ≈ textY − 44
//   dot below noon ≈ textY + 14   (noon dot is ~14 px below baseline)
//
// Noon letter (ن, middle of سـد in RTL display):
//   Word width at 64px ≈ 120 px, centered at W/2=110
//   RTL order:  س (right) → ن (middle) → د (left)
//   ن center x  ≈ 110 + 10 = 120  (noon sits right-of-center)

const fontSize   = 64;
const textY      = 130;           // Arabic text baseline
const dotX       = 120;           // x center of noon letter's dot
const dotY       = textY + 16;    // y of where noon dot would be

const pinSize    = 60;            // large but proportional — circle ≈ 15 px radius
const sanadY     = dotY + (pinSize * 13 / 24) + 22;  // below pin tip

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- Cream background -->
  <rect x="0" y="0" width="${W}" height="${H}" rx="28" ry="28" fill="#FFF3E0"/>

  <!-- Arabic brand name (dotless noon U+06BA) — dot removed, pin below -->
  <text
    x="${W / 2}"
    y="${textY}"
    text-anchor="middle"
    font-family="Cairo, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    fill="#2E7D32"
    direction="rtl"
  >س&#x06BA;د</text>

  <!-- Map pin replacing the noon dot -->
  ${pinPath(dotX, dotY, pinSize)}

  <!-- Latin sub-name -->
  <text
    x="${W / 2}"
    y="${sanadY}"
    text-anchor="middle"
    font-family="Cairo, sans-serif"
    font-weight="700"
    font-size="18"
    fill="#2E7D32"
    letter-spacing="4"
  >Sanad</text>
</svg>`;

const resvg = new Resvg(svg, {
  font: {
    fontBuffers: [font],
    loadSystemFonts: false,
    defaultFontFamily: "Cairo",
  },
  fitTo: { mode: "width", value: W },
});

const png = resvg.render().asPng();
writeFileSync("artifacts/digital-city/public/logo.png", png);
console.log(`Logo saved — ${png.length} bytes`);
