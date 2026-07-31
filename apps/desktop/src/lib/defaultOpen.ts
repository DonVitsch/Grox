import { invoke } from "@tauri-apps/api/core";

/**
 * An application discovered from the host's installed application registry.
 * The stable id is persisted; the native bundle path is used only when
 * launching the selected app.
 */
export interface OpenApplicationOption {
  id: string;
  name: string;
  bundlePath?: string;
  iconDataUrl?: string;
  isDefault?: boolean;
}

export const DEFAULT_OPEN_APPLICATION_KEY = "grox.defaultOpenApplication";
export const DEFAULT_OPEN_APPLICATION: OpenApplicationOption = {
  id: "default",
  name: "System default",
  isDefault: true,
};

let availableApplications: OpenApplicationOption[] = [DEFAULT_OPEN_APPLICATION];

function normalizeApplications(value: unknown): OpenApplicationOption[] {
  if (!Array.isArray(value)) return [DEFAULT_OPEN_APPLICATION];
  const seen = new Set<string>(["default"]);
  const result = [DEFAULT_OPEN_APPLICATION];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const name = typeof candidate.name === "string" ? candidate.name : "";
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      name,
      ...(typeof candidate.bundlePath === "string" ? { bundlePath: candidate.bundlePath } : {}),
      ...(typeof candidate.iconDataUrl === "string" ? { iconDataUrl: candidate.iconDataUrl } : {}),
    });
  }
  return result;
}

function readSavedApplication(): { id?: string; name?: string; bundlePath?: string } | null {
  const raw = localStorage.getItem(DEFAULT_OPEN_APPLICATION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const value = parsed as Record<string, unknown>;
      return {
        ...(typeof value.id === "string" ? { id: value.id } : {}),
        ...(typeof value.name === "string" ? { name: value.name } : {}),
        ...(typeof value.bundlePath === "string" ? { bundlePath: value.bundlePath } : {}),
      };
    }
  } catch {
    // Versions before dynamic discovery stored only the application label.
    return { name: raw };
  }
  return null;
}

function resolveApplication(saved: { id?: string; name?: string; bundlePath?: string } | null): OpenApplicationOption {
  if (!saved) return DEFAULT_OPEN_APPLICATION;
  const match = availableApplications.find((item) =>
    (saved.id && item.id === saved.id)
    || (saved.bundlePath && item.bundlePath === saved.bundlePath)
    || (saved.name && item.name === saved.name)
    || (saved.name === "default" && item.isDefault),
  );
  return match ?? DEFAULT_OPEN_APPLICATION;
}

export function getAvailableOpenApplications(): OpenApplicationOption[] {
  return availableApplications;
}

export function getDefaultOpenApplication(): OpenApplicationOption {
  return resolveApplication(readSavedApplication());
}

/** Ask the native shell to enumerate installed editor/terminal applications. */
export async function refreshOpenApplications(): Promise<OpenApplicationOption[]> {
  try {
    const discovered = await invoke<unknown[]>("list_open_applications");
    availableApplications = normalizeApplications(discovered);
  } catch {
    // Browser preview and non-macOS builds still have a usable system default.
    availableApplications = [DEFAULT_OPEN_APPLICATION];
  }
  window.dispatchEvent(new CustomEvent("grox:open-applications", { detail: availableApplications }));
  return availableApplications;
}

export function setDefaultOpenApplication(application: OpenApplicationOption): void {
  localStorage.setItem(DEFAULT_OPEN_APPLICATION_KEY, JSON.stringify({
    id: application.id,
    name: application.name,
    ...(application.bundlePath ? { bundlePath: application.bundlePath } : {}),
  }));
  window.dispatchEvent(new CustomEvent("grox:default-open-application", { detail: application }));
}

/** Open a workspace file with the selected application. */
export async function openFileWithConfiguredApplication(cwd: string, path: string): Promise<void> {
  const application = getDefaultOpenApplication();
  if (application.isDefault || !application.bundlePath) {
    await invoke("open_file_with_default", { cwd, path });
    return;
  }
  await invoke("open_file_with_application", {
    cwd,
    path,
    application: application.bundlePath,
  });
}
