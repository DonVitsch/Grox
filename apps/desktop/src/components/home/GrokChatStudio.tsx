import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDesktop } from "../../state/store";
import { usePreferences } from "../../state/preferences";
import { useI18n } from "../../lib/i18n";
import {
  applyGrokChatAppearance,
  CHROME_OVERLAY_EVENT,
  grokChatBeginBrowserLogin,
  grokChatLoginStatus,
  grokChatSyncBrowserSession,
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
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDetail, setSyncDetail] = useState("");
  const [awaitingBrowser, setAwaitingBrowser] = useState(false);
  const overlay = settingsOpen || paletteOpen || accountSetupOpen || transientOverlay;
  const waitingForLogin = loggedIn === false;

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
    if (!inTauri()) {
      setLoggedIn(false);
      return;
    }
    let cancelled = false;
    void grokChatLoginStatus()
      .then((ready) => { if (!cancelled) setLoggedIn(ready); })
      .catch(() => { if (!cancelled) setLoggedIn(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!inTauri()) return;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen<string>("grok-chat-external-auth", () => {
        setLoggedIn(false);
        setSyncDetail(zh ? "Google 登录已改到系统浏览器。完成后再点同步。" : "Google sign-in opened in your browser. Sync when you are done.");
      }).then((fn) => { unlisten = fn; });
    });
    return () => unlisten?.();
  }, [zh]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const sync = async () => {
      if (disposed) return;
      if (overlay || !inTauri() || waitingForLogin) {
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
    window.addEventListener("grox:main-visible", frame);
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
      window.removeEventListener("grox:main-visible", frame);
      unlistenMoved?.();
      void hideGrokWebChat();
    };
  }, [overlay, waitingForLogin]);

  const openBrowserLogin = async () => {
    setAwaitingBrowser(true);
    setSyncDetail(zh ? "已打开默认浏览器。用 Google 登录 grok.com，完成后再点同步。" : "Default browser opened. Sign in to grok.com with Google, then sync.");
    try {
      await grokChatBeginBrowserLogin();
    } catch (cause) {
      setSyncDetail(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const syncSession = async () => {
    setSyncing(true);
    try {
      const result = await grokChatSyncBrowserSession();
      setSyncDetail(result.detail);
      setLoggedIn(result.loggedIn);
      if (result.loggedIn) setAwaitingBrowser(false);
    } catch (cause) {
      setSyncDetail(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!waitingForLogin || !awaitingBrowser) return;
    const timer = window.setInterval(() => { void syncSession(); }, 4000);
    return () => window.clearInterval(timer);
  }, [waitingForLogin, awaitingBrowser]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-base">
      <div className="home-nebula opacity-40" />
      <WorkspaceTabs mode={mode} onChange={onChange} />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col pt-16">
        <div
          ref={hostRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-base"
        >
          {(waitingForLogin || !embedded || error || overlay) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <Icon name="globe" size={22} className="text-dim" />
              {waitingForLogin ? (
                <>
                  <p className="max-w-[460px] text-[15px] font-medium text-fg">
                    {zh ? "用系统浏览器登录 grok.com" : "Sign in to grok.com in your browser"}
                  </p>
                  <p className="max-w-[460px] text-[13px] leading-relaxed text-fg2">
                    {zh
                      ? "内嵌窗口没有 Google 登录，也不会带上浏览器里已有的账号。点下面会打开默认浏览器，支持 Google。登录成功后回到这里同步，聊天记录就会进 App。"
                      : "The embedded view cannot use Google sign-in or your saved browser accounts. Open your default browser, sign in, then sync the session back into Grox."}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openBrowserLogin()}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-acc px-4 text-[12px] text-base"
                    >
                      <Icon name="external" size={12} />
                      {zh ? "打开默认浏览器登录" : "Open default browser"}
                    </button>
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={() => void syncSession()}
                      className="flex h-9 items-center gap-1.5 rounded-full border border-line2 px-4 text-[12px] text-fg2 hover:border-line3 hover:text-fg disabled:opacity-40"
                    >
                      {syncing ? (zh ? "正在同步…" : "Syncing…") : (zh ? "我已登录，同步到 App" : "I'm signed in, sync")}
                    </button>
                  </div>
                  {syncDetail && <p className="max-w-[460px] text-[12px] leading-relaxed text-mute">{syncDetail}</p>}
                </>
              ) : (
                <>
                  <p className="max-w-[420px] text-[13px] text-fg2">
                    {error
                      ? (zh ? `无法嵌入 grok.com：${error}` : `Could not embed grok.com: ${error}`)
                      : overlay
                        ? (zh ? "设置或面板打开时，网页聊天会暂时让开。" : "Web chat hides while settings or palettes are open.")
                        : (zh ? "正在打开 grok.com…" : "Opening grok.com…")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
