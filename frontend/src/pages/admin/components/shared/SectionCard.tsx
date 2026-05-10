import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  accent?: "blue" | "green" | "teal" | "orange" | "purple";
  layout?: "default" | "wide";
  density?: "default" | "compact";
  children: ReactNode;
}

export function SectionCard({ icon, title, accent = "blue", layout = "default", density = "default", children }: SectionCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`panel profile-section-card accent-${accent}${layout === "wide" ? " is-wide" : ""}${density === "compact" ? " is-compact" : ""}${open ? " is-open" : " is-collapsed"}`}>
      <button
        type="button"
        className="profile-section-header"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="profile-section-icon">{icon}</span>
        <h4 className="profile-section-title">{title}</h4>
        <span className="profile-section-toggle" aria-hidden="true">
          <ChevronDown size={17} />
        </span>
      </button>
      <div className="profile-section-collapsible">
        <div className="profile-section-body">{children}</div>
      </div>
    </div>
  );
}

export function ProfileSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="profile-subsection">
      <p className="profile-subsection-title">{title}</p>
      {children}
    </div>
  );
}
