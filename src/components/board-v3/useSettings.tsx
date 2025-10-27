import { useEffect, useState } from "react";
import { Settings } from "./SettingsMenu";

const DEFAULT_SETTINGS: Settings = {
  autoFlipBoard: false,
  undoWithMouse: false,
  confirmTurn: true,
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem("settings");
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings] as const;
}
