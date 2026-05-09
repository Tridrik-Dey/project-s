import { useMemo } from "react";
import { loadRevampFcrEditSession } from "../utils/revampFcrEditSession";

export interface FcrEditMode {
  active: boolean;
  fcrId: string | null;
  activeGroup: string | null;
  /** Returns true if the given group key should be LOCKED (disabled) */
  isLocked: (groupKey: string) => boolean;
}

export function useFcrEditMode(): FcrEditMode {
  const session = useMemo(() => loadRevampFcrEditSession(), []);

  if (!session) {
    return { active: false, fcrId: null, activeGroup: null, isLocked: () => false };
  }

  return {
    active: true,
    fcrId: session.fcrId,
    activeGroup: session.sectionKey,
    isLocked: (groupKey: string) => groupKey !== session.sectionKey,
  };
}
