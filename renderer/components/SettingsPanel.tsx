import React, { useRef, useState } from "react";
import { FONTS, type TextAlign, type ViewSettings } from "../viewTypes";

interface Props {
  label: string;
  st: ViewSettings;
  onChange: <K extends keyof ViewSettings>(k: K, v: ViewSettings[K]) => void;
}

const C: Record<string, React.CSSProperties> = {
  wrap: { borderTop: "1px solid #ffffff08" },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    color: "#c8a96eaa",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  body: {
    padding: "2px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  row: { display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" },
  lbl: {
    fontSize: 9,
    color: "#555",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sel: {
    padding: "4px 6px",
    fontSize: 11,
    background: "#1c1c30",
    color: "#f0ece2",
    border: "1px solid #ffffff14",
    borderRadius: 4,
    cursor: "pointer",
    width: "100%",
  },
  slider: { width: "100%", accentColor: "#c8a96e", margin: 0 },
  color: {
    width: 32,
    height: 24,
    padding: 2,
    border: "1px solid #ffffff15",
    borderRadius: 3,
    background: "transparent",
    cursor: "pointer",
  },
  btn: {
    padding: "3px 8px",
    fontSize: 10,
    background: "#1c1c30",
    color: "#777",
    border: "1px solid #ffffff12",
    borderRadius: 3,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnOn: {
    background: "#c8a96e22",
    color: "#c8a96e",
    border: "1px solid #c8a96e55",
  },
};

export default function SettingsPanel({ label, st, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = () => fileRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange("bgImage", URL.createObjectURL(file));
    e.target.value = "";
  };

  return (
    <div style={C.wrap}>
      <button style={C.header} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <span style={{ opacity: 0.4, fontSize: 8 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={C.body}>
          {/* Font */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={C.lbl}>Font</label>
            <select
              style={C.sel}
              value={st.fontFamily}
              onChange={(e) => onChange("fontFamily", e.target.value)}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Font size */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={C.lbl}>Max Size — {st.fontSize}px</label>
            <input
              type="range"
              min={16}
              max={120}
              value={st.fontSize}
              onChange={(e) => onChange("fontSize", Number(e.target.value))}
              style={C.slider}
            />
          </div>

          {/* Colors row */}
          <div style={C.row}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={C.lbl}>Text</label>
              <input
                type="color"
                value={st.textColor}
                style={C.color}
                onChange={(e) => onChange("textColor", e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={C.lbl}>BG</label>
              <input
                type="color"
                value={st.bgColor}
                style={C.color}
                onChange={(e) => onChange("bgColor", e.target.value)}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                flex: 1,
              }}
            >
              <label style={C.lbl}>Opacity — {st.bgOpacity}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={st.bgOpacity}
                onChange={(e) => onChange("bgOpacity", Number(e.target.value))}
                style={C.slider}
              />
            </div>
          </div>

          {/* Image */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={C.lbl}>Background image</label>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={C.btn} onClick={pickImage}>
                {st.bgImage ? "Change…" : "Choose…"}
              </button>
              {st.bgImage && (
                <button
                  style={{ ...C.btn, color: "#e05252" }}
                  onClick={() => onChange("bgImage", null)}
                >
                  Clear
                </button>
              )}
            </div>
            {st.bgImage && (
              <>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["cover", "contain", "fill"] as const).map((s) => (
                    <button
                      key={s}
                      style={{
                        ...C.btn,
                        ...(st.bgImageSize === s ? C.btnOn : {}),
                      }}
                      onClick={() => onChange("bgImageSize", s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 3,
                    background: `url("${st.bgImage}") center/${st.bgImageSize} no-repeat`,
                    border: "1px solid #ffffff10",
                  }}
                />
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onFileChange}
            />
          </div>

          {/* Align / Ref / Style */}
          <div style={C.row}>
            {/* Align */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={C.lbl}>Align</label>
              <div style={{ display: "flex", gap: 2 }}>
                {(["left", "center", "right"] as TextAlign[]).map((a) => (
                  <button
                    key={a}
                    style={{ ...C.btn, ...(st.textAlign === a ? C.btnOn : {}) }}
                    onClick={() => onChange("textAlign", a)}
                  >
                    {a[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={C.lbl}>Ref</label>
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  style={{ ...C.btn, ...(st.showRef ? C.btnOn : {}) }}
                  onClick={() => onChange("showRef", !st.showRef)}
                >
                  {st.showRef ? "on" : "off"}
                </button>
                {st.showRef &&
                  (["above", "below"] as const).map((p) => (
                    <button
                      key={p}
                      style={{
                        ...C.btn,
                        ...(st.refPosition === p ? C.btnOn : {}),
                      }}
                      onClick={() => onChange("refPosition", p)}
                    >
                      {p === "above" ? "↑" : "↓"}
                    </button>
                  ))}
              </div>
            </div>

            {/* Bold / Shadow */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={C.lbl}>Style</label>
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  style={{
                    ...C.btn,
                    ...(st.bold ? C.btnOn : {}),
                    fontWeight: 700,
                  }}
                  onClick={() => onChange("bold", !st.bold)}
                >
                  B
                </button>
                <button
                  style={{ ...C.btn, ...(st.shadow ? C.btnOn : {}) }}
                  onClick={() => onChange("shadow", !st.shadow)}
                >
                  S
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
