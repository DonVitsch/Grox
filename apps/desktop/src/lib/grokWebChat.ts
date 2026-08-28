/** Embed grok.com as a child webview so everyday chats stay on the website, not in Build missions. */

export const GROK_WEB_URL = "https://grok.com/";
export const GROK_CHAT_LABEL = "grok-chat";
export const CHROME_OVERLAY_EVENT = "grox:chrome-overlay";

export type WebviewBounds = { x: number; y: number; width: number; height: number };

const inTauri = () => "__TAURI_INTERNALS__" in window;

type ChatWebview = {
  show(): Promise<void>;
  hide(): Promise<void>;
  close(): Promise<void>;
  setPosition(position: unknown): Promise<void>;
  setSize(size: unknown): Promise<void>;
};

let webview: ChatWebview | null = null;
let creating: Promise<ChatWebview | null> | null = null;
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

async function ensureWebview(bounds: WebviewBounds): Promise<ChatWebview | null> {
  if (!inTauri()) return null;
  if (webview) return webview;
  if (creating) return creating;
  creating = (async () => {
    const [{ Webview }, { getCurrentWindow }, { LogicalPosition, LogicalSize }] = await Promise.all([
      import("@tauri-apps/api/webview"),
      import("@tauri-apps/api/window"),
      import("@tauri-apps/api/dpi"),
    ]);
    const existing = await Webview.getByLabel(GROK_CHAT_LABEL);
    if (existing) {
      webview = existing as unknown as ChatWebview;
      await existing.setPosition(new LogicalPosition(bounds.x, bounds.y));
      await existing.setSize(new LogicalSize(bounds.width, bounds.height));
      return webview;
    }
    const created = new Webview(getCurrentWindow(), GROK_CHAT_LABEL, {
      url: GROK_WEB_URL,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      focus: true,
      acceptFirstMouse: true,
      zoomHotkeysEnabled: false,
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("grok.com 视图创建超时")), 12_000);
      void created.once("tauri://created", () => {
        window.clearTimeout(timeout);
        resolve();
      });
      void created.once("tauri://error", (event) => {
        window.clearTimeout(timeout);
        reject(event.payload ?? new Error("无法嵌入 grok.com"));
      });
    });
    webview = created as unknown as ChatWebview;
    return webview;
  })();
  try {
    return await creating;
  } finally {
    creating = null;
  }
}

export async function showGrokWebChat(bounds: WebviewBounds): Promise<boolean> {
  if (!boundsUsable(bounds)) {
    await hideGrokWebChat();
    return false;
  }
  const view = await ensureWebview(bounds);
  if (!view) return false;
  const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
  await view.setPosition(new LogicalPosition(bounds.x, bounds.y));
  await view.setSize(new LogicalSize(bounds.width, bounds.height));
  await view.show();
  visible = true;
  return true;
}

export async function hideGrokWebChat(): Promise<void> {
  if (!webview || !visible) return;
  await webview.hide();
  visible = false;
}

export async function destroyGrokWebChat(): Promise<void> {
  const view = webview;
  webview = null;
  visible = false;
  creating = null;
  if (view) await view.close().catch(() => undefined);
}
