import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Settings } from "./SettingsMenu";

export interface ControlsProps {
  settings: Settings;
  undo: () => void;
  redo: () => void;
  cancel: () => void;
  skip: () => void;
  replay: () => void;
  backward: () => void;
  forward: () => void;
  togglePOV: () => void;
}

export default function useControls({
  settings,
  undo,
  redo,
  cancel,
  skip,
  replay,
  backward,
  forward,
  togglePOV,
}: ControlsProps) {
  useEffect(() => {
    const handleMouseButton = (e: MouseEvent) => {
      if (!settings.undoWithMouse) {
        return;
      }

      // Most browsers go "back" on mouseup, so we'll prevent default on that and return.
      if (e.type === "mouseup") {
        e.preventDefault();
        return;
      }

      // For mousedown on mouse 4 or 5, we want to pervent default and handle the undo or redo.
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();

        if (e.button === 3) {
          undo();
        } else if (e.button === 4) {
          redo();
        }
      }
    };

    window.addEventListener("mousedown", handleMouseButton);
    window.addEventListener("mouseup", handleMouseButton);
    return () => {
      window.removeEventListener("mousedown", handleMouseButton);
      window.removeEventListener("mouseup", handleMouseButton);
    };
  }, [undo, redo, settings.undoWithMouse]);
  useHotkeys(
    "escape",
    (e) => {
      e.preventDefault();
      cancel();
    },
    [cancel]
  );

  useHotkeys(
    "left",
    (e) => {
      e.preventDefault();
      undo();
    },
    [undo]
  );

  useHotkeys(
    "right",
    (e) => {
      e.preventDefault();
      redo();
    },
    [redo]
  );

  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      replay();
    },
    [replay]
  );

  useHotkeys(
    ".",
    (e) => {
      e.preventDefault();
      skip();
    },
    [skip]
  );

  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      skip();
    },
    [skip]
  );

  useHotkeys(
    "up",
    (e) => {
      e.preventDefault();
      backward();
    },
    [backward]
  );

  useHotkeys(
    "down",
    (e) => {
      e.preventDefault();
      forward();
    },
    [forward]
  );

  useHotkeys(
    "x",
    (e) => {
      e.preventDefault();
      togglePOV();
    },
    [togglePOV]
  );

  return {};
}
