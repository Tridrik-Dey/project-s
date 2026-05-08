export function TagList({ items, color = "blue" }: { items: string[]; color?: "blue" | "green" | "teal" | "orange" }) {
  if (items.length === 0) return <span className="profile-empty-inline">—</span>;
  return (
    <div className="profile-tag-list">
      {items.map((item) => (
        <span key={item} className={`profile-tag tag-${color}`}>{item}</span>
      ))}
    </div>
  );
}
