import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDesktop } from "../../state/store";
import { usePreferences } from "../../state/preferences";
import { useI18n } from "../../lib/i18n";
import {
  applyGrokChatAppearance,
  CHROME_OVERLAY_EVENT,
  GROK_WEB_URL,
  hideGrokWebChat,
  roundBounds,
  showGrokWebChat,
} from "../../lib/grokWebChat";
import { Icon } from "../fx/Icon";
import { WorkspaceTabs, type HomeWorkspaceMode } from "./workspaceTabs";

const inTauri = () => "__TAURI_INTERNALS__" in window;

export function GrokChatStudio({ mode, onChange }: { mode: HomeWorkspaceMode; onChange(mode: HomeWorkspaceMode): void }) {
  const { language } = useI18n();
  const zh = language === "zh-CN";
  const hostRef = useRef<HTMLDivElement>(null);
  const settingsOpen = useDesktop((state) => state.settingsOpen);
  const paletteOpen = useDesktop((state) => state.paletteOpen);
  const accountSetupOpen = useDesktop((state) => state.accountSetupOpen);
  const [transientOverlay, setTransientOverlay] = useState(false);
  const [error, setError] = useState("");
  const [embedded, setEmbedded] = useState(false);
  const overlay = settingsOpen || paletteOpen || accountSetupOpen || transientOverlay;

  useLayoutEffect(() => {
    const previous = usePreferences.getState().sidebarVisible;
    if (previous) usePreferences.getState().setSidebarVisible(false, false);
    return () => {
      if (previous) usePreferences.getState().setSidebarVisible(true, false);
    };
  }, []);

  useEffect(() => {
    const unsub = usePreferences.subscribe(() => {
      void applyGrokChatAppearance();
    });
    return unsub;
  }, []);

  useEffect(() => {
    const onOverlay = (event: Event) => setTransientOverlay(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(CHROME_OVERLAY_EVENT, onOverlay);
    return () => window.removeEventListener(CHROME_OVERLAY_EVENT, onOverlay);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const sync = async () => {
      if (disposed) return;
      if (overlay || !inTauri()) {
        await hideGrokWebChat();
        return;
      }
      const bounds = roundBounds(host.getBoundingClientRect());
      try {
        const ok = await showGrokWebChat(bounds);
        if (!disposed) {
          setEmbedded(ok);
          setError(ok ? "" : "");
        }
      } catch (cause) {
        if (!disposed) {
          setEmbedded(false);
          setError(cause instanceof Error ? cause.message : String(cause));
          await hideGrokWebChat().catch(() => undefined);
        }
      }
    };
    const frame = () => { void sync(); };
    frame();
    const observer = new ResizeObserver(frame);
    observer.observe(host);
    window.addEventListener("resize", frame);
    let unlistenMoved: (() => void) | undefined;
    if (inTauri()) {
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        if (disposed) return;
        void getCurrentWindow().onMoved(frame).then((unlisten) => {
          if (disposed) unlisten();
          else unlistenMoved = unlisten;
        });
      });
    }
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", frame);
      unlistenMoved?.();
      void hideGrokWebChat();
    };
  }, [overlay]);

  const openInBrowser = () => {
    if (inTauri()) void invoke("open_external", { url: GROK_WEB_URL });
    else window.open(GROK_WEB_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-base">
      <div className="home-nebula opacity-40" />
      <WorkspaceTabs mode={mode} onChange={onChange} />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col pt-16">
        <div
          ref={hostRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-base"
        >
          {(!embedded || error || overlay) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <Icon name="globe" size={22} className="text-dim" />
              <p className="max-w-[420px] text-[13px] text-fg2">
                {error
                  ? (zh ? `无法嵌入 grok.com：${error}` : `Could not embed grok.com: ${error}`)
                  : overlay
                    ? (zh ? "设置或面板打开时，网页聊天会暂时让开。" : "Web chat hides while settings or palettes are open.")
                    : (zh
                      ? "这里就是 grok.com。登录一次后，网页上的日常聊天会留在这边，和工作任务分开。"
                      : "This is grok.com. Sign in once; everyday web chats stay here, separate from Build missions.")}
              </p>
              <button
                type="button"
                onClick={openInBrowser}
                className="flex h-8 items-center gap-1.5 rounded-full border border-line2 px-3 text-[12px] text-dim hover:border-line3 hover:text-fg2"
              >
                <Icon name="external" size={11} />
                {zh ? "在浏览器打开 grok.com" : "Open grok.com in a browser"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
