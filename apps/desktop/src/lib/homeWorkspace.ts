import type { HomeWorkspaceMode } from "../components/home/workspaceTabs";

let lastHomeWorkspace: HomeWorkspaceMode = "conversation";

export function rememberedHomeWorkspace(): HomeWorkspaceMode {
  return lastHomeWorkspace;
}

export function rememberHomeWorkspace(mode: HomeWorkspaceMode) {
  lastHomeWorkspace = mode;
}
