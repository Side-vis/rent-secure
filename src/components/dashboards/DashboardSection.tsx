type DashboardSectionProps = {
  title: string;
  description: string;
  items: string[];
};

export default function DashboardSection({
  title,
  description,
  items,
}: DashboardSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <ul className="mt-4 grid gap-2 text-sm text-slate-200">
        {items.map((item) => (
          <li key={item} className="rounded-2xl border border-slate-800 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
