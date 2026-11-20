import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileUrl, isRemoteRef } from "@/lib/file-url";

export { fileUrl };

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

/** Mode Vercel Blob actif si le token est configuré. Sinon stockage local. */
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Écrit un buffer et retourne une "référence" utilisable partout :
 *  - en mode Blob : retourne l'URL publique du blob (https://...).
 *  - en mode local : retourne un chemin relatif "sous-dossier/fichier.ext".
 */
export async function saveFile(
  subdir: string,
  ext: string,
  data: Buffer
): Promise<string> {
  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const filename = `${subdir}/${crypto.randomUUID()}.${ext.replace(/^\./, "")}`;
    const blob = await put(filename, data, {
      access: "public",
      addRandomSuffix: false,
    });
    return blob.url;
  }
  const dir = path.join(STORAGE_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext.replace(/^\./, "")}`;
  const full = path.join(dir, name);
  await fs.writeFile(full, data);
  return `${subdir}/${name}`;
}

/** Récupère le buffer d'une référence (URL distante ou chemin local). */
export async function readBuffer(ref: string): Promise<Buffer | null> {
  if (isRemoteRef(ref)) {
    try {
      const r = await fetch(ref);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch {
      return null;
    }
  }
  const full = resolveFile(ref);
  if (!full) return null;
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}

/** Chemin absolu local d'un fichier (uniquement pour les refs locales). */
export function resolveFile(relPath: string): string | null {
  if (isRemoteRef(relPath)) return null;
  const full = path.resolve(STORAGE_ROOT, relPath);
  if (!full.startsWith(STORAGE_ROOT)) return null; // anti-traversée
  return full;
}

export function isBlobMode(): boolean {
  return USE_BLOB;
}

export function guessMime(ref: string): string {
  const ext = path.extname(ref).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}
