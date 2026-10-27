import { useState } from 'react';
import { createComplaint } from '../api/complaints.js';

const categories = [
  ['roads', 'Roads & potholes'],
  ['traffic', 'Traffic'],
  ['water', 'Water supply / leakage'],
  ['sanitation', 'Safai / garbage'],
  ['sewage', 'Sewage overflow / blockage'],
  ['drainage', 'Drainage'],
  ['parks', 'Parks'],
  ['streetlights', 'Streetlights'],
  ['safety', 'Public safety / CCTV concern'],
  ['pollution', 'Air pollution / AQI'],
  ['health', 'Public health'],
  ['weather', 'Weather / flooding'],
  ['electricity', 'Electricity / power'],
  ['other', 'Other'],
];

export default function ReportForm({ onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [gpsMessage, setGpsMessage] = useState('');

  function pinReportLocation() {
    setGpsMessage('');
    if (!navigator.geolocation) {
      setGpsMessage('This browser does not support GPS location.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((previous) => ({
          ...previous,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        setGpsMessage('Exact GPS pin added. It will be shown on the city map.');
      },
      (locationError) => {
        setGpsMessage(
          locationError.code === locationError.PERMISSION_DENIED
            ? 'Location permission was denied. You can still add a street or landmark.'
            : 'Could not get GPS location. You can still add a street or landmark.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await createComplaint(form);
      setMessage(
        result.duplicate
          ? `This looks like an existing report (${result.complaintId}). We linked you to it.`
          : `Case reference ${result.id} · ${result.category} · ${result.automation?.department || result.department} assigned · ${result.automation?.slaHours || 'Standard'}h response target.`,
      );
      if (!result.duplicate) {
        setForm({ title: '', description: '', category: '', location: '' });
        onCreated();
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="report-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CITIZEN PORTAL</p>
          <h2 id="report-title">Report an issue</h2>
        </div>
        <span className="heading-icon" aria-hidden="true">＋</span>
      </div>
      <form className="report-form" onSubmit={handleSubmit}>
        <div className="automation-note">
          <span className="automation-spark">✳</span>
          <span><strong>Smart triage is on</strong><small>Our automation agent routes and prioritizes your report.</small></span>
        </div>
        <label>
          Short title
          <input
            required
            maxLength="120"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="e.g. Pothole near Central Park"
          />
        </label>
        <label>
          Category <span className="optional-label">Optional · auto-detected if skipped</span>
          <select
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            <option value="">Let smart triage choose</option>
            {categories.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Location
          <input
            required
            maxLength="200"
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
            placeholder="Street, neighborhood, or landmark"
          />
          <button type="button" className="location-pin-button" onClick={pinReportLocation}>
            {form.latitude ? '✓ Exact GPS location pinned' : '＋ Pin exact location with GPS'}
          </button>
          <small className="location-privacy">Optional. GPS is used only to place this report on the city map.</small>
          {gpsMessage && <span className="gps-message" role="status">{gpsMessage}</span>}
        </label>
        <label>
          What happened?
          <textarea
            required
            maxLength="2000"
            rows="4"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Add details that will help the city team resolve it."
          />
        </label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        {message && <p className="form-message success" role="status">{message}</p>}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </section>
  );
}
