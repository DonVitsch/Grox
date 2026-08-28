import { describe, expect, it } from "vitest";
import { HOME_WORKSPACE_TABS } from "../components/home/workspaceTabs";
import { boundsUsable, roundBounds } from "./grokWebChat";

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
