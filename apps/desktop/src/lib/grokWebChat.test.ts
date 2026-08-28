import { describe, expect, it } from "vitest";
import { HOME_WORKSPACE_TABS } from "../components/home/workspaceTabs";
import { rememberHomeWorkspace, rememberedHomeWorkspace } from "./homeWorkspace";
import { boundsUsable, buildGrokChatAppearanceCss, grokChatWindowLive, roundBounds } from "./grokWebChat";

describe("home workspace memory", () => {
  it("keeps the last tab after leaving home", () => {
    rememberHomeWorkspace("chat");
    expect(rememberedHomeWorkspace()).toBe("chat");
    rememberHomeWorkspace("conversation");
    expect(rememberedHomeWorkspace()).toBe("conversation");
  });
});

describe("home workspace tabs", () => {
  it("places web chat to the left of conversation", () => {
    expect(HOME_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      "chat",
      "conversation",
      "image",
      "video",
      "automations",
    ]);
    expect(HOME_WORKSPACE_TABS[0]?.zh).toBe("聊天");
  });
});

describe("grok web chat bounds", () => {
  it("rounds and rejects tiny hosts", () => {
    expect(roundBounds({ left: 12.6, top: 40.2, width: 800.4, height: 500.9 })).toEqual({
      x: 13,
      y: 40,
      width: 800,
      height: 501,
    });
    expect(boundsUsable({ x: 0, y: 0, width: 20, height: 400 })).toBe(false);
    expect(boundsUsable({ x: 0, y: 0, width: 800, height: 500 })).toBe(true);
  });
});

describe("grok web appearance css", () => {
  it("uses the current app color and font tokens", () => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.setProperty("--color-base", "#112233");
    document.documentElement.style.setProperty("--color-fg", "#eeeeee");
    document.documentElement.style.setProperty("--font-sans", '"PingFang SC", sans-serif');
    document.documentElement.style.setProperty("--grox-prose-size", "16px");
    const appearance = buildGrokChatAppearanceCss();
    expect(appearance.colorScheme).toBe("dark");
    expect(appearance.background).toBe("#112233");
    expect(appearance.css).toContain("#112233");
    expect(appearance.css).toContain("#eeeeee");
    expect(appearance.css).toContain("PingFang SC");
    expect(appearance.css).toContain("16px");
  });

  it("does not keep a live window until the host creates one", () => {
    expect(grokChatWindowLive()).toBe(false);
  });
});
