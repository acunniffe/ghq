import { useHotkeys } from "react-hotkeys-hook";

export interface ControlsProps {
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
  undo,
  redo,
  cancel,
  skip,
  replay,
  backward,
  forward,
  togglePOV,
}: ControlsProps) {
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
