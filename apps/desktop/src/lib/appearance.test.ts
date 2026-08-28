import { describe, expect, it } from "vitest";
import {
  applyColorOverrides,
  applyFonts,
  applyVisuals,
  emptyColorOverrides,
  fontStack,
  isHexColor,
  parseCodeFont,
  parseColorOverrides,
  parseUiFont,
  parseUiScale,
  sanitizeFontName,
} from "./appearance";

describe("appearance parsers", () => {
  it("accepts discrete ui scales", () => {
    expect(parseUiScale("sm")).toBe("sm");
    expect(parseUiScale("xlarge")).toBe("xl");
    expect(parseUiScale("nope")).toBe("md");
  });

  it("falls back unknown fonts to geist", () => {
    expect(parseUiFont("pingfang")).toBe("pingfang");
    expect(parseUiFont("comic-sans")).toBe("geist");
    expect(parseCodeFont("jetbrains")).toBe("jetbrains");
    expect(parseCodeFont("")).toBe("geist");
  });

  it("sanitizes custom font names", () => {
    expect(sanitizeFontName('JetBrains Mono"; } body {')).toBe("JetBrains Mono  body");
    expect(sanitizeFontName("LXGW WenKai")).toBe("LXGW WenKai");
    expect(sanitizeFontName("苹方-简")).toBe("苹方-简");
  });

  it("puts a custom family first in the stack", () => {
    expect(fontStack("ui", "geist", "PingFang SC")).toMatch(/^"PingFang SC",/);
    expect(fontStack("code", "sf", "")).toMatch(/SF Mono/);
  });

  it("only keeps #rrggbb color overrides", () => {
    expect(isHexColor("#aabbcc")).toBe(true);
    expect(isHexColor("#fff")).toBe(false);
    const parsed = parseColorOverrides(JSON.stringify({
      dark: { base: "#112233", acc: "red", fg: "#FFFFFF" },
      light: { panel: "#not" },
    }));
    expect(parsed.dark).toEqual({ base: "#112233", fg: "#ffffff" });
    expect(parsed.light).toEqual({});
  });
});

describe("appearance apply", () => {
  it("writes scale, font, and color tokens onto documentElement", () => {
    applyVisuals({
      uiScale: "lg",
      codeScale: "xl",
      uiFont: "song",
      codeFont: "jetbrains",
      uiFontCustom: "",
      codeFontCustom: "Sarasa Mono SC",
      theme: "dark",
      colorOverrides: {
        dark: { base: "#101820", acc: "#89b4fa" },
        light: {},
      },
    });
    const root = document.documentElement;
    expect(root.dataset.ui).toBe("lg");
    expect(root.dataset.code).toBe("xl");
    expect(root.dataset.customAcc).toBe("1");
    expect(root.style.getPropertyValue("--color-base")).toBe("#101820");
    expect(root.style.getPropertyValue("--color-acc")).toBe("#89b4fa");
    expect(root.style.getPropertyValue("--font-mono")).toMatch(/^"Sarasa Mono SC"/);
    expect(root.style.getPropertyValue("--font-sans")).toMatch(/Songti SC/);
  });

  it("clears color overrides when a theme has none", () => {
    applyColorOverrides("dark", { dark: { fg: "#abcdef" }, light: {} });
    expect(document.documentElement.style.getPropertyValue("--color-fg")).toBe("#abcdef");
    applyColorOverrides("dark", emptyColorOverrides());
    expect(document.documentElement.style.getPropertyValue("--color-fg")).toBe("");
    expect(document.documentElement.dataset.customFg).toBe("0");
  });

  it("applies custom UI font without touching mono until asked", () => {
    applyFonts("system", "geist", "Inter", "");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toMatch(/^"Inter"/);
    expect(document.documentElement.style.getPropertyValue("--font-mono")).toMatch(/Geist Mono/);
  });
});
