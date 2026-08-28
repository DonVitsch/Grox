import { useI18n } from "../../lib/i18n";
import { Icon } from "../fx/Icon";

export const HOME_WORKSPACE_TABS = [
  { id: "chat", zh: "聊天", en: "WEB", icon: "chat" },
  { id: "conversation", zh: "对话", en: "CHAT", icon: "command" },
  { id: "image", zh: "图片", en: "IMAGE", icon: "layers" },
  { id: "video", zh: "视频", en: "VIDEO", icon: "play" },
  { id: "automations", zh: "已安排", en: "SCHEDULED", icon: "clock" },
] as const;

export type HomeWorkspaceMode = typeof HOME_WORKSPACE_TABS[number]["id"];

export function WorkspaceTabs({ mode, onChange }: { mode: HomeWorkspaceMode; onChange(mode: HomeWorkspaceMode): void }) {
  const { language } = useI18n();
  const zh = language === "zh-CN";
  return (
    <div role="tablist" aria-label={zh ? "工作台类型" : "Workspace type"} className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line2 bg-panel/90 p-1 shadow-lg backdrop-blur animate-mission-in" style={{ animationDelay: "0.02s" }}>
      {HOME_WORKSPACE_TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={mode === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex h-8 items-center gap-1.5 rounded-full px-4 text-[12px] transition-colors ${mode === tab.id ? "bg-acc text-base" : "text-dim hover:bg-high hover:text-fg2"}`}
        >
          <Icon name={tab.icon} size={11} />
          {zh ? tab.zh : tab.en}
        </button>
      ))}
    </div>
  );
}
