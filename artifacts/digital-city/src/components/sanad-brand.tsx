import React from "react";

/**
 * Renders "سند" with the noon letter replaced by a map-pin icon + dot above.
 *
 * Strategy:
 *  - Use Arabic presentation-form glyphs:
 *      ﺳ  U+FEB3  SEEN INITIAL FORM
 *      ﺪ  U+FEAA  DAL  FINAL  FORM
 *    so each letter keeps the correct contextual shape even as a standalone element.
 *  - Place an inline SVG between them that draws:
 *      • a dot above (noon's dot)
 *      • the map-pin body (replaces noon's body)
 *      • a thin horizontal connector at joining-stroke height
 *        to bridge the gap between the two letters visually.
 *
 * Props
 *  color      – fill / text colour (default #1A4D1F)
 *  innerColor – colour of the pin's inner circle (default white; match button/card bg)
 *  className  – extra classes for the outer <span>
 *  style      – extra inline styles for the outer <span>
 */

interface SanadBrandProps {
  color?: string;
  innerColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SanadBrand({
  color = "#1A4D1F",
  innerColor = "white",
  className,
  style,
}: SanadBrandProps) {
  return (
    <span
      dir="rtl"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "'Cairo','Tajawal',sans-serif",
        fontWeight: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        color,
        ...style,
      }}
    >
      {/* ﺳ — SEEN INITIAL FORM (connects on its left in RTL) */}
      <span style={{ letterSpacing: 0 }}>&#xFEB3;</span>

      {/* Pin SVG — replaces noon letter */}
      <svg
        viewBox="0 0 24 38"
        aria-hidden="true"
        style={{
          display: "inline-block",
          // Scale with the surrounding font: width ≈ 0.44em, height ≈ 1.6em
          width: "0.44em",
          height: "1.6em",
          // Shift down so the pin tip aligns with the Arabic baseline
          verticalAlign: "-0.55em",
          overflow: "visible",
          flexShrink: 0,
          fill: color,
        }}
      >
        {/* Dot above — replaces noon's dot */}
        <circle cx="12" cy="2.5" r="2.6" fill={color} />

        {/* Horizontal joining-stroke connector (Arabic baseline bridge) */}
        <rect x="0" y="29" width="24" height="2.2" rx="1.1" fill={color} />

        {/* Map-pin body */}
        <path
          d="M12 8C8.13 8 5 11.13 5 15c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={color}
        />

        {/* Inner circle (hollow centre of pin head) */}
        <circle cx="12" cy="15" r="2.8" fill={innerColor} />
      </svg>

      {/* ﺪ — DAL FINAL FORM (connects on its right in RTL) */}
      <span style={{ letterSpacing: 0 }}>&#xFEAA;</span>
    </span>
  );
}
