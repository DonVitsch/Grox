import { create } from "zustand";
import {
  applyColorOverrides,
  applyFonts,
  applyUiScale,
  applyCodeScale,
  emptyColorOverrides,
  parseCodeFont,
  parseCodeScale,
  parseColorOverrides,
  parseUiFont,
  parseUiScale,
  sanitizeFontName,
  type CodeFontId,
  type CodeScale,
  type ColorSlotId,
  type SlotColors,
  type ThemeColorOverrides,
  type UiFontId,
  type UiScale,
} from "../lib/appearance";

export type Language = "zh-CN" | "en-US";
export type Theme = "dark" | "light";
/** Content column density: narrow → fill (reading column max-width only). */
export type ContentDensity = "narrow" | "medium" | "wide" | "fill";
/**
 * Transcript font scale only — integer CSS px tiers.
 * Chrome uses uiScale; code blocks use codeScale.
 */
export type FontScale = "sm" | "md" | "lg" | "xl";
export type { UiScale, CodeScale, UiFontId, CodeFontId, ThemeColorOverrides, ColorSlotId };

interface PreferencesState {
  language: Language;
  theme: Theme;
  /** @deprecated kept for migration; use fontScale */
  fontSize: number;
  fontScale: FontScale;
  uiScale: UiScale;
  codeScale: CodeScale;
  /** True until the user sets code size independently. */
  codeScaleFollowsFont: boolean;
  uiFont: UiFontId;
  codeFont: CodeFontId;
  uiFontCustom: string;
  codeFontCustom: string;
  colorOverrides: ThemeColorOverrides;
  fontWeight: number;
  contentDensity: ContentDensity;
  sidebarVisible: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  previewWidth: number;
  setLanguage(language: Language): void;
  setTheme(theme: Theme): void;
  setFontScale(scale: FontScale): void;
  /** Maps legacy numeric offsets to discrete scales. */
  setFontSize(fontSize: number): void;
  setUiScale(scale: UiScale): void;
  setCodeScale(scale: CodeScale): void;
  setUiFont(font: UiFontId): void;
  setCodeFont(font: CodeFontId): void;
  setUiFontCustom(value: string): void;
  setCodeFontCustom(value: string): void;
  setColorSlot(slot: ColorSlotId, value: string | undefined): void;
  setColorPreset(colors: SlotColors): void;
  resetColors(): void;
  resetVisuals(): void;
  setFontWeight(fontWeight: number): void;
  setContentDensity(density: ContentDensity): void;
  toggleSidebar(): void;
  setSidebarVisible(sidebarVisible: boolean, persist?: boolean): void;
  setSidebarWidth(width: number): void;
  setInspectorWidth(width: number): void;
  setPreviewWidth(width: number): void;
}

const numberPreference = (key: string, fallback: number) => {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const dimensionPersistTimers = new Map<string, number>();
const persistDimension = (key: string, value: number) => {
  const pending = dimensionPersistTimers.get(key);
  if (pending !== undefined) window.clearTimeout(pending);
  dimensionPersistTimers.set(key, window.setTimeout(() => {
    localStorage.setItem(key, String(value));
    dimensionPersistTimers.delete(key);
  }, 180));
};

const clampFontWeight = (value: number) => Math.min(700, Math.max(400, Math.round(value / 25) * 25));

const parseContentDensity = (value: string | null): ContentDensity => {
  if (value === "narrow" || value === "medium" || value === "wide" || value === "fill") return value;
  // Legacy aliases (xwide was the previous "更宽" tier)
  if (value === "full" || value === "xl" || value === "wider" || value === "xwide") return "fill";
  return "medium";
};

const FONT_SCALES: FontScale[] = ["sm", "md", "lg", "xl"];

export function parseFontScale(value: string | null): FontScale {
  if (value === "sm" || value === "md" || value === "lg" || value === "xl") return value;
  // Legacy string labels
  if (value === "compact" || value === "smaller") return "sm";
  if (value === "comfortable" || value === "default") return "md";
  if (value === "large" || value === "larger") return "lg";
  if (value === "xlarge") return "xl";
  // Legacy numeric offsets (px increase, including fractions)
  const n = Number(value);
  if (Number.isFinite(n)) {
    if (n <= -0.5) return "sm";
    if (n <= 0.75) return "md";
    if (n <= 2.25) return "lg";
    return "xl";
  }
  return "md";
}

/** Stable integer rank for UI “active” checks against old number consumers. */
export function fontScaleToRank(scale: FontScale): number {
  return FONT_SCALES.indexOf(scale);
}

function applyFontScale(scale: FontScale) {
  document.documentElement.dataset.font = scale;
  // Clear legacy offset so no chrome rule can re-introduce sub-pixel sizes.
  document.documentElement.style.removeProperty("--grox-font-increase");
}

const initialLanguage: Language =
  localStorage.getItem("grox.language") === "en-US" ? "en-US" : "zh-CN";
const initialTheme: Theme = localStorage.getItem("grox.theme") === "light" ? "light" : "dark";

const initialFontScale = (() => {
  // Prefer new key; fall back to legacy grox.fontSize.
  const fromNew = localStorage.getItem("grox.fontScale");
  if (fromNew) return parseFontScale(fromNew);
  return parseFontScale(localStorage.getItem("grox.fontSize"));
})();

const storedCodeScale = localStorage.getItem("grox.codeScale");
const initialCodeScaleFollowsFont = storedCodeScale === null;
const initialCodeScale = initialCodeScaleFollowsFont ? initialFontScale : parseCodeScale(storedCodeScale);
const initialUiScale = parseUiScale(localStorage.getItem("grox.uiScale"));
const initialUiFont = parseUiFont(localStorage.getItem("grox.uiFont"));
const initialCodeFont = parseCodeFont(localStorage.getItem("grox.codeFont"));
const initialUiFontCustom = sanitizeFontName(localStorage.getItem("grox.uiFontCustom") ?? "");
const initialCodeFontCustom = sanitizeFontName(localStorage.getItem("grox.codeFontCustom") ?? "");
const initialColorOverrides = parseColorOverrides(localStorage.getItem("grox.colorOverrides"));

const initialFontWeight = (() => {
  const value = localStorage.getItem("grox.fontWeight");
  if (value === "regular") return 400;
  if (value === "strong") return 600;
  if (value === "medium") return 500;
  const parsed = Number(value);
  // Prefer 400 for crisp rendering at small UI sizes; 500 often looks soft.
  return Number.isFinite(parsed) ? clampFontWeight(parsed) : 400;
})();
const initialContentDensity = parseContentDensity(localStorage.getItem("grox.contentDensity"));

const persistColors = (overrides: ThemeColorOverrides) => {
  localStorage.setItem("grox.colorOverrides", JSON.stringify(overrides));
};

const persistFonts = (uiFont: UiFontId, codeFont: CodeFontId, uiCustom: string, codeCustom: string) => {
  localStorage.setItem("grox.uiFont", uiFont);
  localStorage.setItem("grox.codeFont", codeFont);
  localStorage.setItem("grox.uiFontCustom", uiCustom);
  localStorage.setItem("grox.codeFontCustom", codeCustom);
  applyFonts(uiFont, codeFont, uiCustom, codeCustom);
};

document.documentElement.dataset.theme = initialTheme;
document.documentElement.dataset.density = initialContentDensity;
document.documentElement.lang = initialLanguage;
applyFontScale(initialFontScale);
applyUiScale(initialUiScale);
applyCodeScale(initialCodeScale);
applyFonts(initialUiFont, initialCodeFont, initialUiFontCustom, initialCodeFontCustom);
applyColorOverrides(initialTheme, initialColorOverrides);
document.documentElement.style.setProperty("--grox-font-weight", String(initialFontWeight));
// One-shot: persist discrete scale if user still has fractional legacy value.
if (!localStorage.getItem("grox.fontScale")) {
  localStorage.setItem("grox.fontScale", initialFontScale);
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  language: initialLanguage,
  theme: initialTheme,
  fontSize: fontScaleToRank(initialFontScale),
  fontScale: initialFontScale,
  uiScale: initialUiScale,
  codeScale: initialCodeScale,
  codeScaleFollowsFont: initialCodeScaleFollowsFont,
  uiFont: initialUiFont,
  codeFont: initialCodeFont,
  uiFontCustom: initialUiFontCustom,
  codeFontCustom: initialCodeFontCustom,
  colorOverrides: initialColorOverrides,
  fontWeight: initialFontWeight,
  contentDensity: initialContentDensity,
  sidebarVisible: localStorage.getItem("grox.sidebarVisible") !== "0",
  sidebarWidth: Math.min(380, Math.max(210, numberPreference("grox.sidebarWidth", 252))),
  inspectorWidth: Math.min(540, Math.max(260, numberPreference("grox.inspectorWidth", 312))),
  previewWidth: Math.min(760, Math.max(340, numberPreference("grox.previewWidth", 460))),
  setLanguage(language) {
    localStorage.setItem("grox.language", language);
    document.documentElement.lang = language;
    set({ language });
  },
  setTheme(theme) {
    localStorage.setItem("grox.theme", theme);
    document.documentElement.dataset.theme = theme;
    applyColorOverrides(theme, get().colorOverrides);
    set({ theme });
  },
  setFontScale(scale) {
    const value = parseFontScale(scale);
    localStorage.setItem("grox.fontScale", value);
    localStorage.setItem("grox.fontSize", value); // keep legacy key in sync as label
    applyFontScale(value);
    const follow = get().codeScaleFollowsFont;
    if (follow) applyCodeScale(value);
    set({
      fontScale: value,
      fontSize: fontScaleToRank(value),
      ...(follow ? { codeScale: value } : {}),
    });
  },
  setFontSize(fontSize) {
    // Accept old numeric API → discrete scale.
    get().setFontScale(parseFontScale(String(fontSize)));
  },
  setUiScale(scale) {
    const value = parseUiScale(scale);
    localStorage.setItem("grox.uiScale", value);
    applyUiScale(value);
    set({ uiScale: value });
  },
  setCodeScale(scale) {
    const value = parseCodeScale(scale);
    localStorage.setItem("grox.codeScale", value);
    applyCodeScale(value);
    set({ codeScale: value, codeScaleFollowsFont: false });
  },
  setUiFont(font) {
    const uiFont = parseUiFont(font);
    persistFonts(uiFont, get().codeFont, get().uiFontCustom, get().codeFontCustom);
    set({ uiFont });
  },
  setCodeFont(font) {
    const codeFont = parseCodeFont(font);
    persistFonts(get().uiFont, codeFont, get().uiFontCustom, get().codeFontCustom);
    set({ codeFont });
  },
  setUiFontCustom(value) {
    const uiFontCustom = sanitizeFontName(value);
    persistFonts(get().uiFont, get().codeFont, uiFontCustom, get().codeFontCustom);
    set({ uiFontCustom });
  },
  setCodeFontCustom(value) {
    const codeFontCustom = sanitizeFontName(value);
    persistFonts(get().uiFont, get().codeFont, get().uiFontCustom, codeFontCustom);
    set({ codeFontCustom });
  },
  setColorSlot(slot, value) {
    const theme = get().theme;
    const next: ThemeColorOverrides = {
      dark: { ...get().colorOverrides.dark },
      light: { ...get().colorOverrides.light },
    };
    if (value && /^#([0-9a-fA-F]{6})$/.test(value)) next[theme][slot] = value.toLowerCase();
    else delete next[theme][slot];
    persistColors(next);
    applyColorOverrides(theme, next);
    set({ colorOverrides: next });
  },
  setColorPreset(colors) {
    const theme = get().theme;
    const next: ThemeColorOverrides = {
      dark: { ...get().colorOverrides.dark },
      light: { ...get().colorOverrides.light },
    };
    next[theme] = { ...colors };
    persistColors(next);
    applyColorOverrides(theme, next);
    set({ colorOverrides: next });
  },
  resetColors() {
    const theme = get().theme;
    const next: ThemeColorOverrides = {
      dark: { ...get().colorOverrides.dark },
      light: { ...get().colorOverrides.light },
    };
    next[theme] = {};
    persistColors(next);
    applyColorOverrides(theme, next);
    set({ colorOverrides: next });
  },
  resetVisuals() {
    localStorage.removeItem("grox.uiScale");
    localStorage.removeItem("grox.codeScale");
    localStorage.removeItem("grox.uiFont");
    localStorage.removeItem("grox.codeFont");
    localStorage.removeItem("grox.uiFontCustom");
    localStorage.removeItem("grox.codeFontCustom");
    localStorage.removeItem("grox.colorOverrides");
    const fontScale = get().fontScale;
    applyUiScale("md");
    applyCodeScale(fontScale);
    applyFonts("geist", "geist", "", "");
    applyColorOverrides(get().theme, emptyColorOverrides());
    set({
      uiScale: "md",
      codeScale: fontScale,
      codeScaleFollowsFont: true,
      uiFont: "geist",
      codeFont: "geist",
      uiFontCustom: "",
      codeFontCustom: "",
      colorOverrides: emptyColorOverrides(),
    });
  },
  setFontWeight(fontWeight) {
    const value = clampFontWeight(fontWeight);
    localStorage.setItem("grox.fontWeight", String(value));
    document.documentElement.style.setProperty("--grox-font-weight", String(value));
    set({ fontWeight: value });
  },
  setContentDensity(density) {
    const value = parseContentDensity(density);
    localStorage.setItem("grox.contentDensity", value);
    document.documentElement.dataset.density = value;
    set({ contentDensity: value });
  },
  toggleSidebar() {
    set((state) => {
      const sidebarVisible = !state.sidebarVisible;
      localStorage.setItem("grox.sidebarVisible", sidebarVisible ? "1" : "0");
      return { sidebarVisible };
    });
  },
  setSidebarVisible(sidebarVisible, persist = true) {
    if (persist) localStorage.setItem("grox.sidebarVisible", sidebarVisible ? "1" : "0");
    set({ sidebarVisible });
  },
  setSidebarWidth(sidebarWidth) {
    const width = Math.min(380, Math.max(210, sidebarWidth));
    persistDimension("grox.sidebarWidth", width);
    set({ sidebarWidth: width });
  },
  setInspectorWidth(inspectorWidth) {
    const width = Math.min(540, Math.max(260, inspectorWidth));
    persistDimension("grox.inspectorWidth", width);
    set({ inspectorWidth: width });
  },
  setPreviewWidth(previewWidth) {
    const width = Math.min(760, Math.max(340, previewWidth));
    persistDimension("grox.previewWidth", width);
    set({ previewWidth: width });
  },
}));
