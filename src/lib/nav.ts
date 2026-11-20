"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type View =
  | "landing"
  | "login"
  | "dashboard"
  | "student"
  | "exam";

export function useRoute() {
  const router = useRouter();
  const params = useSearchParams();

  const view = (params.get("view") as View) || "landing";
  const session = params.get("session") || "";
  const examId = params.get("examId") || "";
  const copyId = params.get("copyId") || "";
  const tab = params.get("tab") || "";

  const go = useCallback(
    (next: View, extra: Record<string, string> = {}) => {
      const sp = new URLSearchParams({ view: next, ...extra });
      router.replace(`/?${sp.toString()}`);
    },
    [router]
  );

  return { view, session, examId, copyId, tab, go };
}
