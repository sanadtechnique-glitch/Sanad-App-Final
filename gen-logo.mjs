import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";

const font = readFileSync("/tmp/Cairo.ttf");

const W = 220;
const H = 220;

// Map pin path (Lucide MapPin, viewBox 0 0 24 24)
// Scaled up: pinSize controls how large the pin appears
function pinPath(cx, cy, pinSize) {
  const s = pinSize / 24;
  // Translate so the pin tip is at (cx, cy), pin center top at (cx, cy - pinSize)
  const tx = cx - 12 * s;
  const ty = cy - 22 * s;
  return `
    <g transform="translate(${tx}, ${ty}) scale(${s})">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#2E7D32"/>
      <circle cx="12" cy="9" r="2.8" fill="#FFF3E0"/>
    </g>
  `;
}

// Logo layout:
// - cream rounded-rect background
// - big map pin centered at top area
// - "سند" Arabic text centered below the pin
// - "Sanad" Latin text at the bottom

const pinSize = 52;        // was ~24 before, now much bigger
const pinCX = W / 2;
const pinTipY = 108;       // tip of pin y position
const pinTopY = pinTipY - pinSize; // top of pin circle

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face {
        font-family: 'Cairo';
        src: url('data:font/truetype;base64,FONTDATA');
      }
    </style>
  </defs>

  <!-- Cream background -->
  <rect x="0" y="0" width="${W}" height="${H}" rx="28" ry="28" fill="#FFF3E0"/>

  <!-- Large map pin centered -->
  ${pinPath(pinCX, pinTipY, pinSize)}

  <!-- Arabic "سند" below pin -->
  <text
    x="${W / 2}"
    y="${pinTipY + 52}"
    text-anchor="middle"
    font-family="Cairo, sans-serif"
    font-weight="900"
    font-size="58"
    fill="#2E7D32"
    direction="rtl"
  >س&#x06BA;د</text>

  <!-- Latin "Sanad" at bottom -->
  <text
    x="${W / 2}"
    y="${pinTipY + 86}"
    text-anchor="middle"
    font-family="Cairo, sans-serif"
    font-weight="700"
    font-size="20"
    fill="#2E7D32"
    letter-spacing="3"
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

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

writeFileSync("artifacts/digital-city/public/logo.png", pngBuffer);
console.log("Logo generated: artifacts/digital-city/public/logo.png");
console.log(`Size: ${pngBuffer.length} bytes`);
