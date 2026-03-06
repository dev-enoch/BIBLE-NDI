import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ViewSettings } from "./viewTypes";
import { bgStyle } from "./styleUtils";

// ─── Shared auto-fit hook ─────────────────────────────────────────────────────
//
// Binary-searches the largest font size where the probe's rendered height
// fits inside the outer container. Re-runs on text/settings changes and
// container resizes (ResizeObserver).

function useAutoFit(
  outerRef: React.RefObject<HTMLDivElement | null>,
  probeRef: React.RefObject<HTMLDivElement | null>,
  maxSize: number,
  deps: unknown[],
): number {
  const [fontSize, setFontSize] = useState(maxSize);

  const fit = useCallback(() => {
    const outer = outerRef.current;
    const probe = probeRef.current;
    if (!outer || !probe) return;
    const availH = outer.clientHeight;
    if (availH <= 0) return;
    let lo = 8,
      hi = maxSize,
      best = lo;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      probe.style.fontSize = `${mid}px`;
      if (probe.scrollHeight <= availH) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    probe.style.fontSize = `${best}px`;
    setFontSize(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSize, ...deps]);

  useLayoutEffect(fit, [fit]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return fontSize;
}

// ─── SlateContent component ───────────────────────────────────────────────────

interface SlateProps {
  nativeW: number;
  nativeH: number;
  text: string;
  reference: string;
  st: ViewSettings;
  padV: string;
  padH: string;
}

function SlateContent({
  nativeW,
  nativeH,
  text,
  reference,
  st,
  padV,
  padH,
}: SlateProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);

  const shadow = st.shadow
    ? "0 2px 16px rgba(0,0,0,0.98), 0 1px 4px rgba(0,0,0,0.9)"
    : "none";
  const font = `"${st.fontFamily}", Georgia, serif`;
  const fw = st.bold ? 700 : 400;

  const fontSize = useAutoFit(outerRef, probeRef, st.fontSize, [
    text,
    reference,
    st.showRef,
    st.refPosition,
    st.fontFamily,
    st.bold,
  ]);

  return (
    <div
      style={{
        width: nativeW,
        height: nativeH,
        display: "flex",
        flexDirection: "column",
        padding: `${padV} ${padH}`,
        boxSizing: "border-box",
        ...bgStyle(st),
      }}
    >
      <div
        ref={outerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Invisible probe — mirrors layout for height measurement */}
        <div
          ref={probeRef}
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            visibility: "hidden",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            fontFamily: font,
            fontWeight: fw,
            lineHeight: 1.5,
            fontSize: st.fontSize,
          }}
        >
          {st.showRef && st.refPosition === "above" && (
            <span style={{ fontSize: "0.5em" }}>{reference}</span>
          )}
          <span>{text}</span>
          {st.showRef && st.refPosition === "below" && (
            <span style={{ fontSize: "0.5em" }}>{reference}</span>
          )}
        </div>

        {/* Visible content */}
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
          }}
        >
          {st.showRef && st.refPosition === "above" && (
            <p
              style={{
                fontFamily: font,
                fontSize: fontSize * 0.5,
                fontWeight: fw,
                color: st.textColor,
                textShadow: shadow,
                margin: 0,
                opacity: 0.82,
                letterSpacing: 2,
                textAlign: st.textAlign,
              }}
            >
              {reference}
            </p>
          )}
          <p
            style={{
              fontFamily: font,
              fontSize,
              fontWeight: fw,
              color: st.textColor,
              textShadow: shadow,
              margin: 0,
              lineHeight: 1.5,
              textAlign: st.textAlign,
            }}
          >
            {text}
          </p>
          {st.showRef && st.refPosition === "below" && (
            <p
              style={{
                fontFamily: font,
                fontSize: fontSize * 0.5,
                fontWeight: fw,
                color: st.textColor,
                textShadow: shadow,
                margin: 0,
                opacity: 0.82,
                letterSpacing: 2,
                textAlign: st.textAlign,
              }}
            >
              {reference}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Slate — full-frame view (landscape & portrait) ───────────────────────────

export function renderSlate(
  nativeW: number,
  nativeH: number,
  text: string,
  reference: string,
  st: ViewSettings,
  padV = "64px",
  padH = "80px",
): React.ReactNode {
  return (
    <SlateContent
      nativeW={nativeW}
      nativeH={nativeH}
      text={text}
      reference={reference}
      st={st}
      padV={padV}
      padH={padH}
    />
  );
}

// ─── LowerThirdContent component ─────────────────────────────────────────────

interface LowerThirdProps {
  nativeW: number;
  nativeH: number;
  text: string;
  reference: string;
  st: ViewSettings;
}

function LowerThirdContent({
  nativeW,
  nativeH,
  text,
  reference,
  st,
}: LowerThirdProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);

  const shadow = st.shadow
    ? "0 2px 16px rgba(0,0,0,0.98), 0 1px 4px rgba(0,0,0,0.9)"
    : "none";
  const font = `"${st.fontFamily}", Georgia, serif`;
  const fw = st.bold ? 700 : 400;

  const fontSize = useAutoFit(outerRef, probeRef, st.fontSize, [
    text,
    reference,
    st.showRef,
    st.refPosition,
    st.fontFamily,
    st.bold,
  ]);

  return (
    <div
      style={{
        width: nativeW,
        height: nativeH,
        display: "flex",
        flexDirection: "column",
        padding: "0 60px",
        boxSizing: "border-box",
        ...bgStyle(st),
      }}
    >
      <div
        ref={outerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Probe */}
        <div
          ref={probeRef}
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            visibility: "hidden",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontFamily: font,
            fontWeight: fw,
            lineHeight: 1.4,
            fontSize: st.fontSize,
          }}
        >
          {st.showRef && st.refPosition === "above" && (
            <span style={{ fontSize: "0.52em" }}>{reference}</span>
          )}
          <span>{text}</span>
          {st.showRef && st.refPosition === "below" && (
            <span style={{ fontSize: "0.52em" }}>{reference}</span>
          )}
        </div>

        {/* Visible content */}
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {st.showRef && st.refPosition === "above" && (
            <p
              style={{
                fontFamily: font,
                fontSize: fontSize * 0.52,
                fontWeight: fw,
                color: st.textColor,
                textShadow: shadow,
                margin: 0,
                opacity: 0.82,
                letterSpacing: 2,
                textAlign: st.textAlign,
              }}
            >
              {reference}
            </p>
          )}
          <p
            style={{
              fontFamily: font,
              fontSize,
              fontWeight: fw,
              color: st.textColor,
              textShadow: shadow,
              margin: 0,
              lineHeight: 1.4,
              textAlign: st.textAlign,
            }}
          >
            {text}
          </p>
          {st.showRef && st.refPosition === "below" && (
            <p
              style={{
                fontFamily: font,
                fontSize: fontSize * 0.52,
                fontWeight: fw,
                color: st.textColor,
                textShadow: shadow,
                margin: 0,
                opacity: 0.82,
                letterSpacing: 2,
                textAlign: st.textAlign,
              }}
            >
              {reference}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lower Third ──────────────────────────────────────────────────────────────
// Renders just the bar — no full-frame wrapper. nativeW×nativeH IS the bar.
// Set bgOpacity to 0 for a fully transparent background.

export function renderLowerThird(
  nativeW: number,
  nativeH: number,
  text: string,
  reference: string,
  st: ViewSettings,
): React.ReactNode {
  return (
    <LowerThirdContent
      nativeW={nativeW}
      nativeH={nativeH}
      text={text}
      reference={reference}
      st={st}
    />
  );
}
