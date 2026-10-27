import CaseCard from './CaseCard.jsx';

export default function OpsConsole({ complaints, onUpdate, error }) {
  return (
    <section className="panel ops-panel" aria-labelledby="ops-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">DEPARTMENT STAFF</p>
          <h2 id="ops-title">Operations queue</h2>
        </div>
        <span className="queue-count">{complaints.length} cases</span>
      </div>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {complaints.length ? (
        <div className="case-list">
          {complaints.map((complaint) => (
            <CaseCard
              key={complaint.id}
              complaint={complaint}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">✓</span>
          <p>No reports yet. New citizen reports will appear here.</p>
        </div>
      )}
    </section>
  );
}
