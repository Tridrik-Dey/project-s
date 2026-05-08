import type { RevampSectionSnapshot } from "../../api/revampApplicationApi";

export type RevampGuardTarget = "step2" | "step3" | "step4" | "step5" | "recap";

export function resolveSection3Key(
  registryType: string,
  sections: RevampSectionSnapshot[]
): "S3" | "S3A" | "S3B" {
  if (registryType !== "ALBO_A") return "S3";
  const s2 = sections.find((section) => section.sectionKey === "S2");
  if (!s2?.payloadJson) return "S3B";
  try {
    const payload = JSON.parse(s2.payloadJson) as { professionalType?: string };
    return payload.professionalType === "DOCENTE_FORMATORE" ? "S3A" : "S3B";
  } catch {
    return "S3B";
  }
}

export function areRequiredSectionsComplete(
  registryType: string,
  sections: RevampSectionSnapshot[]
): boolean {
  return getMissingRequiredSections(registryType, sections).length === 0;
}

export function getMissingRequiredSections(
  registryType: string,
  sections: RevampSectionSnapshot[]
): string[] {
  const completed = new Set(
    sections.filter((section) => section.completed).map((section) => section.sectionKey)
  );
  const section3Key = resolveSection3Key(registryType, sections);
  return ["S1", "S2", section3Key, "S4", "S5"].filter((sectionKey) => !completed.has(sectionKey));
}

function isCompleted(sectionKey: string, sections: RevampSectionSnapshot[]): boolean {
  return Boolean(sections.find((section) => section.sectionKey === sectionKey)?.completed);
}

export function resolveStepGuardRedirect(
  applicationId: string,
  registryType: string,
  sections: RevampSectionSnapshot[],
  target: RevampGuardTarget
): string | null {
  const s3Key = resolveSection3Key(registryType, sections);

  if (!isCompleted("S1", sections)) return `/application/${applicationId}/step/1`;
  if (target === "step2") return null;

  if (!isCompleted("S2", sections)) return `/application/${applicationId}/step/2`;
  if (target === "step3") return null;

  if (!isCompleted(s3Key, sections)) return `/application/${applicationId}/step/3`;
  if (target === "step4") return null;

  if (!isCompleted("S4", sections)) return `/application/${applicationId}/step/4`;
  if (target === "step5") return null;

  if (!isCompleted("S5", sections)) return `/application/${applicationId}/step/5`;
  return null;
}

export function resolvePostRegisterPath(
  draftId: string | null,
  onboardingReady: boolean
): string {
  if (!onboardingReady || !draftId) return "/apply";
  return `/application/${draftId}/step/1`;
}
