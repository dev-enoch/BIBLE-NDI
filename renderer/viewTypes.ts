// ─── Shared renderer types ────────────────────────────────────────────────────

export type TextAlign = "left" | "center" | "right";

export interface ViewSettings {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number; // 0–100
  bgImage: string | null; // object-URL or null
  bgImageSize: "cover" | "contain" | "fill";
  textAlign: TextAlign;
  showRef: boolean;
  refPosition: "above" | "below";
  bold: boolean;
  shadow: boolean;
}

export interface NdiState {
  channelName: string;
  live: boolean;
}

export const FONTS = [
  "EB Garamond",
  "Playfair Display",
  "Cinzel",
  "Lato",
  "Open Sans",
];

export function makeDefault(
  overrides: Partial<ViewSettings> = {},
): ViewSettings {
  return {
    fontFamily: "EB Garamond",
    fontSize: 52,
    textColor: "#ffffff",
    bgColor: "#000000",
    bgOpacity: 85,
    bgImage: null,
    bgImageSize: "cover",
    textAlign: "center",
    showRef: true,
    refPosition: "below",
    bold: false,
    shadow: true,
    ...overrides,
  };
}

export function makeNdi(channelName: string): NdiState {
  return { channelName, live: false };
}
