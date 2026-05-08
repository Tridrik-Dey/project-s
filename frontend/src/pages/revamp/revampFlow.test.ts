import { areRequiredSectionsComplete, getMissingRequiredSections, resolvePostRegisterPath, resolveSection3Key, resolveStepGuardRedirect } from "./revampFlow";
import type { RevampSectionSnapshot } from "../../api/revampApplicationApi";

function section(
  sectionKey: string,
  completed: boolean,
  payloadJson = "{}"
): RevampSectionSnapshot {
  return {
    id: `${sectionKey}-id`,
    applicationId: "app-1",
    sectionKey,
    sectionVersion: 1,
    completed,
    payloadJson,
    updatedAt: "2026-01-01T00:00:00"
  };
}

describe("revampFlow", () => {
  it("resolves Section 3 branch to S3A for ALBO_A docente/formatore", () => {
    const sections = [
      section("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" }))
    ];
    expect(resolveSection3Key("ALBO_A", sections)).toBe("S3A");
  });

  it("resolves Section 3 branch to S3 for ALBO_B", () => {
    expect(resolveSection3Key("ALBO_B", [])).toBe("S3");
  });

  it("enforces recap submit gating with required sections complete", () => {
    const sections = [
      section("S1", true),
      section("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" })),
      section("S3A", true),
      section("S4", true),
      section("S5", true)
    ];
    expect(areRequiredSectionsComplete("ALBO_A", sections)).toBe(true);

    const missingS5 = sections.filter((s) => s.sectionKey !== "S5");
    expect(areRequiredSectionsComplete("ALBO_A", missingS5)).toBe(false);
    expect(getMissingRequiredSections("ALBO_A", missingS5)).toEqual(["S5"]);
  });

  it("requires backend-completed sections for ALBO_B submit gating", () => {
    const sections = [
      section("S1", true),
      section("S2", true),
      section("S3", false),
      section("S4", true),
      section("S5", true)
    ];
    expect(areRequiredSectionsComplete("ALBO_B", sections)).toBe(false);
    expect(getMissingRequiredSections("ALBO_B", sections)).toEqual(["S3"]);
  });

  it("computes register bootstrap destination path", () => {
    expect(resolvePostRegisterPath(null, true)).toBe("/apply");
    expect(resolvePostRegisterPath(null, false)).toBe("/apply");
    expect(resolvePostRegisterPath("app-1", true)).toBe("/application/app-1/step/1");
  });

  it("resolves guard redirect to first incomplete wizard step", () => {
    const sections = [
      section("S1", true),
      section("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" })),
      section("S3A", false),
      section("S4", false),
      section("S5", false)
    ];
    expect(resolveStepGuardRedirect("app-1", "ALBO_A", sections, "step4")).toBe("/application/app-1/step/3");
    expect(resolveStepGuardRedirect("app-1", "ALBO_A", sections, "recap")).toBe("/application/app-1/step/3");
  });
});
