"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { api } from "@/lib/api";
import { fileUrl } from "@/lib/file-url";
import type { ExerciseDef } from "@/lib/types";

// --- Cellule texte ---
export function TextCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={5}
      placeholder="Saisissez votre réponse… (mise en forme libre, formules et symboles acceptés)"
      className="resize-y"
    />
  );
}

// --- Cellule image ---
export function ImageCell({
  session,
  images,
  onChange,
}: {
  session: string;
  images: { path: string; caption?: string }[];
  onChange: (imgs: { path: string; caption?: string }[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const res = await api.studentUploadImage(session, file);
      if (res.error) throw new Error(res.error);
      onChange([...images, { path: res.path, caption: "" }]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import échoué");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <div key={i} className="border rounded-md p-2 w-44">
            <img src={fileUrl(img.path)} alt="" className="w-full h-28 object-contain bg-muted/30 rounded" />
            <Input
              value={img.caption || ""}
              onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
              placeholder="Légende…"
              className="h-7 mt-1 text-xs"
            />
            <Button size="sm" variant="ghost" className="text-destructive h-7 mt-1" onClick={() => onChange(images.filter((_, j) => j !== i))}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Retirer
            </Button>
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-44 h-36 border-2 border-dashed rounded-md grid place-items-center text-muted-foreground hover:bg-muted/30 text-xs"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5 mb-1" /> Ajouter une image</>}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}

// --- Cellule QCM ---
export function QcmCell({
  options,
  selected,
  onChange,
}: {
  options: { id: string; label: string; correct?: boolean }[];
  selected: string[];
  onChange: (sel: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="space-y-1.5">
      {options.map((o) => (
        <label
          key={o.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
            selected.includes(o.id) ? "border-teal-600 bg-teal-50" : "hover:bg-muted/40"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(o.id)}
            onChange={() => toggle(o.id)}
            className="w-4 h-4"
          />
          <span className="text-sm">{o.label || "(option sans libellé)"}</span>
        </label>
      ))}
      {options.length === 0 && <div className="text-xs text-muted-foreground">Aucune option définie.</div>}
    </div>
  );
}

// --- Cellule tableau ---
export function TableCell({
  columns,
  rows,
  data,
  onChange,
}: {
  columns: string[];
  rows: number;
  data: string[][];
  onChange: (data: string[][]) => void;
}) {
  const colCount = Math.max(1, columns.length);
  const rowCount = Math.max(1, rows || 3);
  const table: string[][] =
    data.length === rowCount && data[0]?.length === colCount
      ? data
      : Array.from({ length: rowCount }, () => Array(colCount).fill(""));

  function set(i: number, j: number, v: string) {
    onChange(table.map((r, ii) => (ii === i ? r.map((c, jj) => (jj === j ? v : c)) : r)));
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm w-full">
        {columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((c, j) => (
                <th key={j} className="border bg-muted px-2 py-1 text-left font-medium text-xs">{c}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border p-0">
                  <input
                    value={cell}
                    onChange={(e) => set(i, j, e.target.value)}
                    className="w-full px-2 py-1 bg-transparent outline-none focus:bg-teal-50"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
