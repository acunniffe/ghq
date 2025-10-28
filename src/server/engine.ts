import { loadPyodide } from "pyodide";
import path from "path";
import { readFile } from "fs/promises";
import { GameEngine } from "@/game/engine-v2";

export async function loadV2Engine(): Promise<GameEngine> {
  let pyodide = await loadPyodide();

  const engineCode = await readFile(
    path.join(__dirname, "../../public/engine.py"),
    "utf8"
  );
  pyodide.FS.writeFile("engine.py", new TextEncoder().encode(engineCode));
  return pyodide.pyimport("engine");
}
