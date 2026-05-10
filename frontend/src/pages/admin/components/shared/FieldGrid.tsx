type FieldDef = { label: string; value: string | null | undefined };

export function FieldGrid({ fields, cols = 2, compact = false }: { fields: FieldDef[]; cols?: 2 | 3; compact?: boolean }) {
  const visible = fields.filter((f) => f.value && f.value.trim() !== "");
  if (visible.length === 0) return <p className="profile-empty">Nessun dato disponibile.</p>;
  return (
    <div className={`profile-field-grid cols-${cols}${compact ? " is-compact" : ""}`}>
      {visible.map((f) => (
        <div key={f.label} className="profile-field-row">
          <span className="profile-field-label">{f.label}</span>
          <span className="profile-field-value">{f.value}</span>
        </div>
      ))}
    </div>
  );
}
