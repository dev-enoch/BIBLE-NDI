import type React from "react";
import type { ViewSettings } from "./viewTypes";

export function hexAlpha(hex: string, pct: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${pct / 100})`;
}

export function bgStyle(st: ViewSettings): React.CSSProperties {
  if (st.bgImage) {
    return {
      backgroundImage: `linear-gradient(${hexAlpha(st.bgColor, st.bgOpacity)},${hexAlpha(st.bgColor, st.bgOpacity)}), url("${st.bgImage}")`,
      backgroundSize: `auto, ${st.bgImageSize}`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { background: hexAlpha(st.bgColor, st.bgOpacity) };
}

export function cleanText(t: string): string {
  return t.replace(/^[¶\s]+/, "").trim();
}
