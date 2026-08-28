/** Everyday grok.com chats live in a child window so the main ACP window stays a WebviewWindow. */

import { invoke } from "@tauri-apps/api/core";

export const GROK_WEB_URL = "https://grok.com/";
export const GROK_CHAT_LABEL = "grok-chat";
export const CHROME_OVERLAY_EVENT = "grox:chrome-overlay";

export type WebviewBounds = { x: number; y: number; width: number; height: number };

const inTauri = () => "__TAURI_INTERNALS__" in window;

type ChatWindow = {
  show(): Promise<void>;
  hide(): Promise<void>;
  close(): Promise<void>;
  setPosition(position: unknown): Promise<void>;
  setSize(size: unknown): Promise<void>;
  setFocus(): Promise<void>;
};

let chat: ChatWindow | null = null;
let creating: Promise<ChatWindow | null> | null = null;
let visible = false;

export function roundBounds(rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">): WebviewBounds {
  return {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
  };
}

export function boundsUsable(bounds: WebviewBounds): boolean {
  return bounds.width >= 48 && bounds.height >= 48;
}

export function setChromeOverlay(open: boolean) {
  window.dispatchEvent(new CustomEvent(CHROME_OVERLAY_EVENT, { detail: open }));
}

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function buildGrokChatAppearanceCss(): { css: string; colorScheme: "dark" | "light"; background: string } {
  const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const base = cssVar("--color-base", theme === "light" ? "#f8f8f5" : "#060606");
  const panel = cssVar("--color-panel", theme === "light" ? "#f1f1ed" : "#0a0a0a");
  const raise = cssVar("--color-raise", theme === "light" ? "#ffffff" : "#101010");
  const fg = cssVar("--color-fg", theme === "light" ? "#171716" : "#f5f5f5");
  const fg2 = cssVar("--color-fg2", theme === "light" ? "#30302e" : "#d6d6d6");
  const acc = cssVar("--color-acc", theme === "light" ? "#111110" : "#ffffff");
  const sans = cssVar("--font-sans", '"Geist Sans", ui-sans-serif, system-ui, sans-serif');
  const mono = cssVar("--font-mono", '"Geist Mono", ui-monospace, monospace');
  const weight = cssVar("--grox-font-weight", "400");
  const size = cssVar("--grox-prose-size", "14px");
  const leading = cssVar("--grox-prose-leading", "1.5");
  const css = `
html { color-scheme: ${theme}; }
html, body, #__next, #root, main {
  background: ${base} !important;
  background-color: ${base} !important;
  color: ${fg} !important;
  font-family: ${sans} !important;
  font-weight: ${weight} !important;
}
body { font-size: ${size} !important; line-height: ${leading} !important; }
code, pre, kbd, samp { font-family: ${mono} !important; }
p, li, span, label, textarea, input, button {
  font-family: inherit;
}
textarea, input, [contenteditable="true"] {
  color: ${fg} !important;
  background-color: ${raise} !important;
  font-family: ${sans} !important;
  font-size: ${size} !important;
  font-weight: ${weight} !important;
}
[class*="sidebar"], nav, aside { background-color: ${panel} !important; color: ${fg2} !important; }
a { color: ${acc}; }
`.trim();
  return { css, colorScheme: theme, background: base };
}

async function hostToScreen(bounds: WebviewBounds): Promise<WebviewBounds> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const [inner, factor] = await Promise.all([win.innerPosition(), win.scaleFactor()]);
  return {
    x: Math.round(inner.x / factor + bounds.x),
    y: Math.round(inner.y / factor + bounds.y),
    width: bounds.width,
    height: bounds.height,
  };
}

async function ensureWindow(bounds: WebviewBounds): Promise<ChatWindow | null> {
  if (!inTauri()) return null;
  if (chat) return chat;
  if (creating) return creating;
  creating = (async () => {
    await invoke("grok_chat_prepare");
    const [{ WebviewWindow }, { LogicalPosition, LogicalSize }] = await Promise.all([
      import("@tauri-apps/api/webviewWindow"),
      import("@tauri-apps/api/dpi"),
    ]);
    const existing = await WebviewWindow.getByLabel(GROK_CHAT_LABEL);
    if (!existing) throw new Error("无法创建 grok.com 窗口");
    const screen = await hostToScreen(bounds);
    chat = existing as unknown as ChatWindow;
    await existing.setPosition(new LogicalPosition(screen.x, screen.y));
    await existing.setSize(new LogicalSize(screen.width, screen.height));
    void existing.once("tauri://destroyed", () => {
      if (chat === (existing as unknown as ChatWindow)) {
        chat = null;
        visible = false;
      }
    });
    return chat;
  })();
  try {
    return await creating;
  } finally {
    creating = null;
  }
}

export async function applyGrokChatAppearance(): Promise<void> {
  if (!inTauri() || !chat) return;
  const appearance = buildGrokChatAppearanceCss();
  await invoke("grok_chat_apply_theme", {
    css: appearance.css,
    colorScheme: appearance.colorScheme,
  }).catch(() => undefined);
}

export async function showGrokWebChat(bounds: WebviewBounds): Promise<boolean> {
  if (!boundsUsable(bounds)) {
    await hideGrokWebChat();
    return false;
  }
  const view = await ensureWindow(bounds);
  if (!view) return false;
  const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
  const screen = await hostToScreen(bounds);
  await view.setPosition(new LogicalPosition(screen.x, screen.y));
  await view.setSize(new LogicalSize(screen.width, screen.height));
  await view.show();
  visible = true;
  await applyGrokChatAppearance();
  return true;
}

export async function hideGrokWebChat(): Promise<void> {
  if (!chat || !visible) return;
  await chat.hide();
  visible = false;
}

/** The grok.com window stays alive until the Host process exits. */
export function grokChatWindowLive(): boolean {
  return chat !== null;
}

export async function grokChatLoginStatus(): Promise<boolean> {
  if (!inTauri()) return false;
  const status = await invoke<{ loggedIn: boolean }>("grok_chat_login_status");
  return Boolean(status.loggedIn);
}

export async function grokChatBeginBrowserLogin(): Promise<void> {
  if (!inTauri()) {
    window.open(GROK_WEB_URL, "_blank", "noopener,noreferrer");
    return;
  }
  await invoke("grok_chat_begin_browser_login");
}

export async function grokChatSyncBrowserSession(): Promise<{ imported: number; loggedIn: boolean; detail: string }> {
  if (!inTauri()) return { imported: 0, loggedIn: false, detail: "" };
  return invoke("grok_chat_sync_browser_session");
}
