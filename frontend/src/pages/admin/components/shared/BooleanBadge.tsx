import { CheckCircle2, XCircle } from "lucide-react";

type BoolItem = { label: string; value: boolean | null | undefined; optional?: boolean };

export function BooleanChecklist({ items }: { items: BoolItem[] }) {
  return (
    <ul className="profile-bool-list">
      {items.map((item) => {
        const yes = item.value === true;
        const missing = item.value == null;
        return (
          <li key={item.label} className={`profile-bool-item ${yes ? "bool-yes" : missing ? "bool-missing" : "bool-no"}`}>
            {yes
              ? <CheckCircle2 className="bool-icon h-4 w-4" />
              : <XCircle className="bool-icon h-4 w-4" />}
            <span>{item.label}</span>
            {item.optional ? <span className="bool-optional">(opzionale)</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
