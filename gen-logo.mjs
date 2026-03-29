import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";

const font = readFileSync("/tmp/Cairo.ttf");

const W = 220;
const H = 210;

// Map pin — circle center at (cx, pinCY), tip points downward.
// pinCY  = y of the circular "head" of the pin.
// tip is at pinCY + 13*(pinSize/24) below that.
function pinPath(cx, pinCY, pinSize) {
  const s  = pinSize / 24;
  const tx = cx - 12 * s;
  const ty = pinCY - 9 * s;         // put circle center (y=9 in SVG) at pinCY
  return `
    <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${s.toFixed(4)})">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#2E7D32"/>
      <circle cx="12" cy="9" r="3" fill="#FFF3E0"/>
    </g>
  `;
}

// ── Concept ───────────────────────────────────────────────────
//  "سـد"  (seen + tatweel + dal) creates a natural Arabic join.
//  The pin icon sits exactly where ن would be, visually replacing it.
//
//  At font-size 64 (Cairo):
//    baseline          ≈ textY
//    letter body top   ≈ textY − 42
//    noon body center  ≈ textY − 22   ← pin circle goes here
//    noon dot (below)  ≈ textY + 12   ← pin tip goes about here
//
//  Horizontal: noon center in "سـد" (RTL, centered at W/2=110) ≈ x 112
// ─────────────────────────────────────────────────────────────

const fontSize  = 64;
const textY     = 125;          // Arabic text baseline
const pinCX     = 112;          // x center of noon position
const pinCY     = textY - 22;   // y of pin circle (noon body center)
const pinSize   = 58;           // size — fills noon's visual space

// Sanad label y (below pin tip)
const pinTipY   = pinCY + 13 * (pinSize / 24);
const sanadY    = pinTipY + 30;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- Transparent background (no fill) -->

  <!-- "سـد" — seen + tatweel + dal — noon letter removed, pin replaces it -->
  <text
    x="${W / 2}"
    y="${textY}"
    text-anchor="middle"
    font-family="Cairo, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    fill="#2E7D32"
    direction="rtl"
  >سـد</text>

  <!-- Dot above the pin -->
  <circle
    cx="${pinCX}"
    cy="${pinCY - 9 * (pinSize / 24) - 10}"
    r="5.5"
    fill="#2E7D32"
  />

  <!-- Pin icon exactly where ن was -->
  ${pinPath(pinCX, pinCY, pinSize)}

  <!-- Latin sub-name -->
  <text
    x="${W / 2}"
    y="${sanadY}"
    text-anchor="middle"
    font-family="Cairo, sans-serif"
    font-weight="700"
    font-size="17"
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
