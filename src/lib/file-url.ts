// Utilitaire pur (client-safe) pour résoudre une référence de fichier
// en URL d'accès, quel que soit le backend de stockage :
//  - URL distante (Vercel Blob) -> renvoyée telle quelle.
//  - chemin local -> /api/file?path=...
export function fileUrl(ref: string | null | undefined): string {
  if (!ref) return "";
  if (/^https?:\/\//i.test(ref)) return ref;
  return `/api/file?path=${encodeURIComponent(ref)}`;
}

export function isRemoteRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}
