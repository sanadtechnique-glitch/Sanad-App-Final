import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";

const font = readFileSync("/tmp/Cairo.ttf");

const W = 220;
const H = 235;

// Map pin (Lucide MapPin 24x24 viewBox).
// The tip of the pin is at the bottom of the 24x24 path (≈ y=22).
// We translate so the tip lands at (cx, cy).
function pinPath(cx, cy, pinSize) {
  const s = pinSize / 24;
  const tx = cx - 12 * s;
  const ty = cy - 22 * s;
  return `
    <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${s.toFixed(4)})">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#2E7D32"/>
      <circle cx="12" cy="9" r="3" fill="#FFF3E0"/>
    </g>
  `;
}

// Layout:
//   Pin: large, tip touches the top of the noon letter
//   Arabic "سـد" (dotless noon): baseline at textY
//   Latin "Sanad": below Arabic text

const pinSize  = 76;          // bigger pin
const pinCX    = W / 2 + 2;  // centered (noon is roughly central in سـد)

// Arabic text baseline — keep in lower half
const textY    = 188;
// Cap-height of Cairo at size 62 ≈ 43px → top of letters ≈ textY - 43 = 145
// We want pin tip just 4px above letter tops → pinTipY ≈ 141
const pinTipY  = 140;

const sanadY   = textY + 26;  // "Sanad" sits just below Arabic text

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- Cream background -->
  <rect x="0" y="0" width="${W}" height="${H}" rx="28" ry="28" fill="#FFF3E0"/>

  <!-- Map pin — tip almost touching top of noon letter -->
  ${pinPath(pinCX, pinTipY, pinSize)}

  <!-- Arabic brand name (dotless noon U+06BA) -->
  <text
    x="${W / 2}"
    y="${textY}"
    text-anchor="middle"
    dominant-baseline="auto"
    font-family="Cairo, sans-serif"
    font-weight="900"
    font-size="62"
    fill="#2E7D32"
    direction="rtl"
  >س&#x06BA;د</text>

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
