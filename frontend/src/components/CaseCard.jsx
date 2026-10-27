import { useState } from 'react';

function prettyStatus(status) {
  return status.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CaseCard({ complaint, onUpdate }) {
  const canResolve = complaint.status !== 'resolved';
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const isOverdue = complaint.due_at
    && new Date(complaint.due_at).getTime() < Date.now()
    && complaint.status !== 'resolved';

  return (
    <article className="case-card">
      <div className="case-topline">
        <span className={`status status-${complaint.status}`}>{prettyStatus(complaint.status)}</span>
        {complaint.priority === 'high' && <span className="priority">Escalated</span>}
        {isOverdue && <span className="priority overdue-badge">SLA overdue</span>}
        <span className="case-category">{complaint.category.replace('_', ' ')}</span>
        <time>{new Date(complaint.created_at).toLocaleDateString()}</time>
      </div>
      <h3>{complaint.title}</h3>
      <p className="case-description">{complaint.description}</p>
      <div className="case-meta">
        <span>{complaint.location}</span>
        <span>Assigned · {complaint.department || 'Unassigned'}</span>
        <span>Due {new Date(complaint.due_at).toLocaleDateString()}</span>
      </div>
      {complaint.timeline?.length > 0 && (
        <details className="timeline">
          <summary>Case timeline ({complaint.timeline.length})</summary>
          <ol>
            {complaint.timeline.map((event, index) => (
              <li key={`${event.createdAt}-${index}`}>
                <strong>{event.type}</strong> — {event.details}
                <time>{new Date(event.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        </details>
      )}
      {onUpdate && (
        <div className="case-actions">
          {complaint.status === 'open' && (
            <button
              className="button secondary"
              onClick={() => onUpdate(complaint.id, { status: 'in_progress' })}
            >
              Start work
            </button>
          )}
          {canResolve && (
            <button
              className="button primary"
              onClick={() => setResolutionOpen(!resolutionOpen)}
            >
              {resolutionOpen ? 'Cancel resolution' : 'Resolve case'}
            </button>
          )}
          {complaint.status === 'resolved' && (
            <button
              className="button secondary"
              onClick={() => onUpdate(complaint.id, {
                status: 'reopened',
                resolutionNote: 'Case reopened for additional city-team review.',
              })}
            >
              Reopen case
            </button>
          )}
        </div>
      )}
      {resolutionOpen && onUpdate && (
        <form
          className="resolution-form"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate(complaint.id, { status: 'resolved', resolutionNote });
            setResolutionOpen(false);
            setResolutionNote('');
          }}
        >
          <label>
            Resolution summary
            <textarea
              required
              minLength="8"
              maxLength="500"
              rows="2"
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="Describe the work completed for this resident."
            />
          </label>
          <button className="button primary" disabled={resolutionNote.trim().length < 8}>
            Confirm resolution
          </button>
        </form>
      )}
    </article>
  );
}
