import type { ReactNode } from "react";
import type { RevampSectionSnapshot } from "../../../api/revampApplicationApi";
import { AlboASection1 } from "./alboA/AlboASection1";
import { AlboASection2 } from "./alboA/AlboASection2";
import { AlboASection3A } from "./alboA/AlboASection3A";
import { AlboASection3B } from "./alboA/AlboASection3B";
import { AlboASection4 } from "./alboA/AlboASection4";
import { AlboASection5 } from "./alboA/AlboASection5";
import { AlboBSection1 } from "./alboB/AlboBSection1";
import { AlboBSection2 } from "./alboB/AlboBSection2";
import { AlboBSection3 } from "./alboB/AlboBSection3";
import { AlboBSection4 } from "./alboB/AlboBSection4";
import { AlboBSection5 } from "./alboB/AlboBSection5";

type SectionPayload = Record<string, unknown>;

function parsePayload(snap: RevampSectionSnapshot | undefined): SectionPayload | null {
  if (!snap?.payloadJson) return null;
  try {
    const parsed = JSON.parse(snap.payloadJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SectionPayload;
  } catch {
    return null;
  }
  return null;
}

function findSection(sections: RevampSectionSnapshot[], ...keys: string[]): SectionPayload | null {
  for (const key of keys) {
    const snap = sections.find((s) => s.sectionKey === key);
    const payload = parsePayload(snap);
    if (payload) return payload;
  }
  return null;
}

interface ColEntry {
  key: string;
  node: ReactNode;
}

interface Props {
  isAlboB: boolean;
  sections: RevampSectionSnapshot[];
}

export function SupplierProfileView({ isAlboB, sections }: Props) {
  if (sections.length === 0) {
    return <p className="profile-empty">Nessuna sezione compilata disponibile.</p>;
  }

  let entries: ColEntry[];

  if (isAlboB) {
    const s1 = findSection(sections, "S1");
    const s2 = findSection(sections, "S2");
    const s3 = findSection(sections, "S3");
    const s4 = findSection(sections, "S4");
    const s5 = findSection(sections, "S5");
    entries = [
      { key: "s1", node: <AlboBSection1 payload={s1} /> },
      { key: "s2", node: <AlboBSection2 payload={s2} /> },
      { key: "s3", node: <AlboBSection3 payload={s3} /> },
      { key: "s4", node: <AlboBSection4 payload={s4} /> },
      { key: "s5", node: <AlboBSection5 payload={s5} /> },
    ];
  } else {
    const s1  = findSection(sections, "S1");
    const s2  = findSection(sections, "S2");
    const s3a = findSection(sections, "S3A");
    const s3b = findSection(sections, "S3B");
    const s4  = findSection(sections, "S4");
    const s5  = findSection(sections, "S5");
    // S3A and S3B are mutually exclusive; always show whichever applies.
    // If neither has data yet, fall back to S3A as an empty placeholder.
    const s3Node = s3a
      ? <AlboASection3A payload={s3a} />
      : <AlboASection3B payload={s3b} />;
    const s3Key = s3a ? "s3a" : "s3b";
    entries = [
      { key: "s1",  node: <AlboASection1 payload={s1} /> },
      { key: "s2",  node: <AlboASection2 payload={s2} /> },
      { key: s3Key, node: s3Node },
      { key: "s4",  node: <AlboASection4 payload={s4} /> },
      { key: "s5",  node: <AlboASection5 payload={s5} /> },
    ];
  }

  return (
    <div className="supplier-profile-sections">
      {entries.map((entry) => (
        <div key={entry.key} className="profile-section-grid-item">
          {entry.node}
        </div>
      ))}
    </div>
  );
}
