"use client";
import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Maximize2, Loader2, Terminal } from "lucide-react";

declare global {
  interface Window {
    loadPyodide?: (config?: { indexURL: string }) => Promise<PyodideInstance>;
    __pyodidePromise?: Promise<PyodideInstance>;
  }
}

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
}

const PYODIDE_VERSION = "0.26.2";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function loadPyodideScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.loadPyodide) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-pyodide]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("pyodide script error")));
      return;
    }
    const s = document.createElement("script");
    s.src = `${PYODIDE_URL}pyodide.js`;
    s.dataset.pyodide = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Échec chargement Pyodide"));
    document.head.appendChild(s);
  });
}

async function getPyodide(): Promise<PyodideInstance> {
  if (window.__pyodidePromise) return window.__pyodidePromise;
  window.__pyodidePromise = (async () => {
    await loadPyodideScript();
    if (!window.loadPyodide) throw new Error("Pyodide indisponible");
    const py = await window.loadPyodide({ indexURL: PYODIDE_URL });
    return py;
  })();
  return window.__pyodidePromise;
}

export function PythonCell({
  code,
  output,
  onChange,
  onRun,
}: {
  code: string;
  output?: string;
  onChange: (code: string, output?: string) => void;
  onRun?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [enlarged, setEnlarged] = useState(false);

  async function run() {
    setRunning(true);
    setStatus("Initialisation de l'environnement Python…");
    let captured = "";
    try {
      const py = await getPyodide();
      setStatus("Exécution du code…");
      py.setStdout({ batched: (s) => { captured += s; } });
      py.setStderr({ batched: (s) => { captured += s; } });
      await py.runPythonAsync(code || "");
      const out = captured.replace(/\n$/, "");
      onChange(code, out + (out ? "\n[exécution terminée]" : "[exécution terminée — aucune sortie]"));
      setStatus("");
      onRun?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onChange(code, captured + (captured ? "\n" : "") + `Erreur : ${msg}`);
      setStatus("");
      onRun?.();
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    onChange("", "");
  }

  return (
    <div className={`rounded-lg border bg-background flex flex-col ${enlarged ? "fixed inset-4 z-50" : ""}`}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-zinc-900 rounded-t-lg">
        <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono">
          <Terminal className="w-3.5 h-3.5" /> Python · Pyodide
          {running && <span className="text-zinc-400 ml-1">— {status}</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800" onClick={run} disabled={running}>
            {running ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />} Exécuter
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => setEnlarged((v) => !v)}>
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="h-56">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={(v) => onChange(v || "", output)}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
        />
      </div>
      <div className="border-t bg-zinc-950 text-zinc-200 text-xs font-mono p-2 max-h-32 overflow-auto whitespace-pre-wrap">
        {output || <span className="text-zinc-500">Console de résultats — cliquez sur « Exécuter ».</span>}
      </div>
    </div>
  );
}
