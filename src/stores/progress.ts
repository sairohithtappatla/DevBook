import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProgressState = {
  completed: Record<string, string[]>; // bookSlug -> stepIds
  lastStep: Record<string, { phaseSlug: string; stepSlug: string }>;
  started: string[]; // book slugs
  toggleStep: (bookSlug: string, stepId: string) => void;
  markLast: (bookSlug: string, phaseSlug: string, stepSlug: string) => void;
  start: (bookSlug: string) => void;
};

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      completed: {},
      lastStep: {},
      started: [],
      toggleStep: (bookSlug, stepId) =>
        set((s) => {
          const cur = s.completed[bookSlug] ?? [];
          const next = cur.includes(stepId)
            ? cur.filter((x) => x !== stepId)
            : [...cur, stepId];
          return {
            completed: { ...s.completed, [bookSlug]: next },
            started: s.started.includes(bookSlug) ? s.started : [...s.started, bookSlug],
          };
        }),
      markLast: (bookSlug, phaseSlug, stepSlug) =>
        set((s) => ({
          lastStep: { ...s.lastStep, [bookSlug]: { phaseSlug, stepSlug } },
          started: s.started.includes(bookSlug) ? s.started : [...s.started, bookSlug],
        })),
      start: (bookSlug) =>
        set((s) => ({
          started: s.started.includes(bookSlug) ? s.started : [...s.started, bookSlug],
        })),
    }),
    { name: "devbook-progress", skipHydration: true },
  ),
);

import { useEffect, useState } from "react";
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    useProgress.persist.rehydrate();
    setH(true);
  }, []);
  return h;
}
