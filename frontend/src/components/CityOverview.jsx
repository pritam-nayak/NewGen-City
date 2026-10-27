const metrics = [
  ['total', 'Total reports'],
  ['open', 'Needs attention'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['overdue', 'Past SLA'],
];

export default function CityOverview({ overview }) {
  return (
    <section className="overview" aria-label="City service overview">
      {metrics.map(([key, label]) => (
        <article className={`metric metric-${key}`} key={key}>
          <span>{label}</span>
          <strong>{overview?.[key] ?? '—'}</strong>
        </article>
      ))}
    </section>
  );
}
