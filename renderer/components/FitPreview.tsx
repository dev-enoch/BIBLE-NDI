import React, { useEffect, useRef, useState } from "react";

interface FitPreviewProps {
  nativeW: number;
  nativeH: number;
  children: () => React.ReactNode;
}

/**
 * Scales a fixed-size canvas to fill its flex container without overflow.
 * Uses ResizeObserver for live responsiveness.
 */
export default function FitPreview({
  nativeW,
  nativeH,
  children,
}: FitPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / nativeW, height / nativeH));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [nativeW, nativeH]);

  const sw = Math.round(nativeW * scale);
  const sh = Math.round(nativeH * scale);

  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: sw,
          height: sh,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
          borderRadius: 5,
          border: "1px solid #ffffff12",
          boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            width: nativeW,
            height: nativeH,
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {children()}
        </div>
      </div>
    </div>
  );
}
