import { invoke } from "@tauri-apps/api/core";

/** The small, explicit application list shown next to the changelog button. */
export type OpenApplication = "default" | "Cursor" | "Finder" | "Terminal" | "Ghostty" | "Xcode";

export const DEFAULT_OPEN_APPLICATION_KEY = "grox.defaultOpenApplication";

export const OPEN_APPLICATIONS: readonly OpenApplication[] = [
  "default",
  "Cursor",
  "Finder",
  "Terminal",
  "Ghostty",
  "Xcode",
];

export function getDefaultOpenApplication(): OpenApplication {
  const saved = localStorage.getItem(DEFAULT_OPEN_APPLICATION_KEY);
  return OPEN_APPLICATIONS.includes(saved as OpenApplication)
    ? saved as OpenApplication
    : "default";
}

export function setDefaultOpenApplication(application: OpenApplication): void {
  localStorage.setItem(DEFAULT_OPEN_APPLICATION_KEY, application);
  window.dispatchEvent(new CustomEvent("grox:default-open-application", { detail: application }));
}

/** Open a workspace file with the user's selected application. */
export async function openFileWithConfiguredApplication(cwd: string, path: string): Promise<void> {
  const application = getDefaultOpenApplication();
  if (application === "default") {
    await invoke("open_file_with_default", { cwd, path });
    return;
  }
  await invoke("open_file_with_application", { cwd, path, application });
}
