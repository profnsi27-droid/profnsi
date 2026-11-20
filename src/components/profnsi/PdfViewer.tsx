"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, Download, Loader2 } from "lucide-react";

declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (params: { url: string }) => { promise: Promise<PdfDoc> };
      GlobalWorkerOptions: { workerSrc: string };
    };
  }
}

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}
interface PdfPage {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
}

const PDFJS_VERSION = "3.11.174";
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let loadPromise: Promise<void> | null = null;
function loadPdfJs(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.pdfjsLib) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${PDFJS_BASE}/pdf.min.js`;
    s.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
        resolve();
      } else {
        reject(new Error("pdf.js non chargé"));
      }
    };
    s.onerror = () => reject(new Error("Échec chargement pdf.js"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export function PdfViewer({ url, title }: { url: string; title?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const renderingRef = useRef(false);

  const renderPage = useCallback(async (pageNum: number, sc: number) => {
    if (renderingRef.current) return;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    renderingRef.current = true;
    try {
      const p = await doc.getPage(pageNum);
      const viewport = p.getViewport({ scale: sc });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      // ignore render errors
    } finally {
      renderingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    loadPdfJs()
      .then(() => window.pdfjsLib!.getDocument({ url }).promise)
      .then((doc) => {
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur PDF");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (ready) renderPage(page, scale);
  }, [ready, page, scale, renderPage]);

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false));
    }
  }

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  return (
    <div ref={containerRef} className={`flex flex-col bg-zinc-100 h-full ${fullscreen ? "fixed inset-0 z-50 bg-zinc-100" : ""}`}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-background shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{ready ? `${page} / ${numPages}` : "…"}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <div className="flex-1 truncate px-2 text-xs text-muted-foreground">{title}</div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
        <a href={url} download className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted">
          <Download className="w-4 h-4" />
        </a>
      </div>
      <div className="flex-1 overflow-auto grid place-items-start justify-center p-3">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : !ready ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement du sujet…</div>
        ) : (
          <canvas ref={canvasRef} className="shadow-lg bg-white" />
        )}
      </div>
    </div>
  );
}
