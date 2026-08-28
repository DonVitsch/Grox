/** Visual appearance: chrome scale, code type, fonts, and color overrides. */

export type UiScale = "sm" | "md" | "lg" | "xl";
export type CodeScale = "sm" | "md" | "lg" | "xl";

export type UiFontId = "geist" | "system" | "pingfang" | "song" | "kai" | "serif";
export type CodeFontId = "geist" | "system" | "sf" | "cascadia" | "jetbrains" | "fira" | "iosevka" | "source";

export type ColorSlotId = "base" | "void" | "panel" | "raise" | "high" | "codeBg" | "fg" | "acc";

export type SlotColors = Partial<Record<ColorSlotId, string>>;

export interface ThemeColorOverrides {
  dark: SlotColors;
  light: SlotColors;
}

export const UI_SCALES: UiScale[] = ["sm", "md", "lg", "xl"];
export const CODE_SCALES: CodeScale[] = ["sm", "md", "lg", "xl"];

export const UI_FONTS: { id: UiFontId; css: string; zh: string; en: string }[] = [
  { id: "geist", zh: "Geist", en: "Geist", css: '"Geist Sans", ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { id: "system", zh: "系统默认", en: "System", css: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
  { id: "pingfang", zh: "苹方 / 雅黑", en: "PingFang / YaHei", css: '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", ui-sans-serif, sans-serif' },
  { id: "song", zh: "宋体", en: "Songti", css: '"Songti SC", "Noto Serif SC", "STSong", SimSun, ui-serif, serif' },
  { id: "kai", zh: "楷体", en: "Kaiti", css: '"Kaiti SC", STKaiti, KaiTi, "Noto Serif SC", ui-serif, serif' },
  { id: "serif", zh: "衬线", en: "Serif", css: 'ui-serif, "New York", "Iowan Old Style", "Songti SC", Georgia, serif' },
];

export const CODE_FONTS: { id: CodeFontId; css: string; zh: string; en: string }[] = [
  { id: "geist", zh: "Geist Mono", en: "Geist Mono", css: '"Geist Mono", ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace' },
  { id: "system", zh: "系统等宽", en: "System Mono", css: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace' },
  { id: "sf", zh: "SF Mono", en: "SF Mono", css: '"SF Mono", Menlo, Monaco, ui-monospace, monospace' },
  { id: "cascadia", zh: "Cascadia", en: "Cascadia", css: '"Cascadia Code", "Cascadia Mono", Consolas, ui-monospace, monospace' },
  { id: "jetbrains", zh: "JetBrains Mono", en: "JetBrains Mono", css: '"JetBrains Mono", "JetBrainsMono Nerd Font", ui-monospace, monospace' },
  { id: "fira", zh: "Fira Code", en: "Fira Code", css: '"Fira Code", "Fira Mono", ui-monospace, monospace' },
  { id: "iosevka", zh: "Iosevka", en: "Iosevka", css: 'Iosevka, "Iosevka Term", ui-monospace, monospace' },
  { id: "source", zh: "Source Code Pro", en: "Source Code Pro", css: '"Source Code Pro", ui-monospace, monospace' },
];

export const COLOR_SLOTS: { id: ColorSlotId; cssVar: string; zh: string; en: string }[] = [
  { id: "base", cssVar: "--color-base", zh: "背景", en: "Background" },
  { id: "void", cssVar: "--color-void", zh: "窗口底色", en: "Window" },
  { id: "panel", cssVar: "--color-panel", zh: "侧栏 / 面板", en: "Panel" },
  { id: "raise", cssVar: "--color-raise", zh: "卡片", en: "Cards" },
  { id: "high", cssVar: "--color-high", zh: "悬停 / 高亮底", en: "Raised" },
  { id: "codeBg", cssVar: "--color-code-bg", zh: "代码背景", en: "Code background" },
  { id: "fg", cssVar: "--color-fg", zh: "文字颜色", en: "Text" },
  { id: "acc", cssVar: "--color-acc", zh: "强调色", en: "Accent" },
];

export const THEME_DEFAULT_COLORS: Record<"dark" | "light", Record<ColorSlotId, string>> = {
  dark: {
    base: "#060606",
    void: "#000000",
    panel: "#0a0a0a",
    raise: "#101010",
    high: "#181818",
    codeBg: "#000000",
    fg: "#f5f5f5",
    acc: "#ffffff",
  },
  light: {
    base: "#f8f8f5",
    void: "#ecece8",
    panel: "#f1f1ed",
    raise: "#ffffff",
    high: "#e9e9e4",
    codeBg: "#ecece8",
    fg: "#171716",
    acc: "#111110",
  },
};

export const COLOR_PRESETS: { id: string; zh: string; en: string; colors: SlotColors }[] = [
  { id: "default", zh: "主题默认", en: "Theme default", colors: {} },
  {
    id: "slate",
    zh: "石板蓝",
    en: "Slate",
    colors: { base: "#0b1220", void: "#070b14", panel: "#10182a", raise: "#162036", high: "#1c2a44", codeBg: "#0a101c", fg: "#e8eefc", acc: "#8bb4ff" },
  },
  {
    id: "forest",
    zh: "墨绿",
    en: "Forest",
    colors: { base: "#0c120e", void: "#070a08", panel: "#111814", raise: "#17211c", high: "#1d2a24", codeBg: "#0a100c", fg: "#e7f0ea", acc: "#9ece6a" },
  },
  {
    id: "ember",
    zh: "暖暮",
    en: "Ember",
    colors: { base: "#140c0c", void: "#0c0707", panel: "#1b1212", raise: "#241818", high: "#2c1e1e", codeBg: "#120a0a", fg: "#f3ece8", acc: "#ffb4a2" },
  },
  {
    id: "paper",
    zh: "暖纸",
    en: "Paper",
    colors: { base: "#f4efe6", void: "#ebe4d8", panel: "#efe9de", raise: "#fffaf2", high: "#e6ded0", codeBg: "#efe8dc", fg: "#1f1a14", acc: "#3d2c1e" },
  },
  {
    id: "contrast",
    zh: "高对比",
    en: "High contrast",
    colors: { base: "#000000", void: "#000000", panel: "#050505", raise: "#111111", high: "#1a1a1a", codeBg: "#000000", fg: "#ffffff", acc: "#ffffff" },
  },
];

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

export function parseUiScale(value: string | null): UiScale {
  if (value === "sm" || value === "md" || value === "lg" || value === "xl") return value;
  if (value === "compact" || value === "smaller") return "sm";
  if (value === "large" || value === "larger") return "lg";
  if (value === "xlarge") return "xl";
  return "md";
}

export function parseCodeScale(value: string | null): CodeScale {
  return parseUiScale(value);
}

export function parseUiFont(value: string | null): UiFontId {
  return UI_FONTS.some((font) => font.id === value) ? (value as UiFontId) : "geist";
}

export function parseCodeFont(value: string | null): CodeFontId {
  return CODE_FONTS.some((font) => font.id === value) ? (value as CodeFontId) : "geist";
}

/** Allow CJK, ASCII, spaces, hyphen — strip quotes and CSS metacharacters. */
export function sanitizeFontName(value: string): string {
  return value.replace(/[^a-zA-Z0-9 \u4e00-\u9fff_-]/g, "").trim().slice(0, 64);
}

export function fontStack(kind: "ui" | "code", id: string, custom: string): string {
  const catalog = kind === "ui" ? UI_FONTS : CODE_FONTS;
  const found = catalog.find((font) => font.id === id) ?? catalog[0];
  const name = sanitizeFontName(custom);
  return name ? `"${name}", ${found.css}` : found.css;
}

export function emptyColorOverrides(): ThemeColorOverrides {
  return { dark: {}, light: {} };
}

export function parseColorOverrides(raw: string | null): ThemeColorOverrides {
  const empty = emptyColorOverrides();
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeColorOverrides>;
    return {
      dark: sanitizeSlotColors(parsed.dark),
      light: sanitizeSlotColors(parsed.light),
    };
  } catch {
    return empty;
  }
}

function sanitizeSlotColors(value: unknown): SlotColors {
  if (!value || typeof value !== "object") return {};
  const next: SlotColors = {};
  for (const slot of COLOR_SLOTS) {
    const color = (value as Record<string, unknown>)[slot.id];
    if (typeof color === "string" && isHexColor(color)) next[slot.id] = color.toLowerCase();
  }
  return next;
}

export function slotValue(theme: "dark" | "light", overrides: ThemeColorOverrides, slot: ColorSlotId): string | undefined {
  return overrides[theme][slot];
}

export function resolvedSlot(theme: "dark" | "light", overrides: ThemeColorOverrides, slot: ColorSlotId): string {
  return slotValue(theme, overrides, slot) ?? THEME_DEFAULT_COLORS[theme][slot];
}

export function applyUiScale(scale: UiScale) {
  document.documentElement.dataset.ui = scale;
}

export function applyCodeScale(scale: CodeScale) {
  document.documentElement.dataset.code = scale;
}

export function applyFonts(uiFont: UiFontId, codeFont: CodeFontId, uiCustom: string, codeCustom: string) {
  const root = document.documentElement.style;
  root.setProperty("--font-sans", fontStack("ui", uiFont, uiCustom));
  root.setProperty("--font-mono", fontStack("code", codeFont, codeCustom));
}

export function applyColorOverrides(theme: "dark" | "light", overrides: ThemeColorOverrides) {
  const root = document.documentElement;
  const current = overrides[theme] ?? {};
  for (const slot of COLOR_SLOTS) {
    const value = current[slot.id];
    if (value && isHexColor(value)) root.style.setProperty(slot.cssVar, value);
    else root.style.removeProperty(slot.cssVar);
  }
  root.dataset.customAcc = current.acc ? "1" : "0";
  root.dataset.customFg = current.fg ? "1" : "0";
}

export function applyVisuals(input: {
  uiScale: UiScale;
  codeScale: CodeScale;
  uiFont: UiFontId;
  codeFont: CodeFontId;
  uiFontCustom: string;
  codeFontCustom: string;
  theme: "dark" | "light";
  colorOverrides: ThemeColorOverrides;
}) {
  applyUiScale(input.uiScale);
  applyCodeScale(input.codeScale);
  applyFonts(input.uiFont, input.codeFont, input.uiFontCustom, input.codeFontCustom);
  applyColorOverrides(input.theme, input.colorOverrides);
}
