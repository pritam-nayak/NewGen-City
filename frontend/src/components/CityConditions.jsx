const statusLabels = {
  live: 'Live estimate',
  'report-monitor': 'Report agent',
  unavailable: 'Unavailable',
};

function formatForecast(weather) {
  if (!weather?.forecast?.length) return 'Three-day forecast unavailable';
  return weather.forecast.map((day) => {
    const date = new Date(`${day.date}T12:00:00`);
    const label = date.toLocaleDateString('en-IN', { weekday: 'short' });
    return `${label} ${day.minimumC}°–${day.maximumC}° · rain ${day.precipitationProbabilityPercent}%`;
  }).join(' · ');
}

function agentReading(agent, conditions) {
  const reports = agent.activeReports ?? 0;
  switch (agent.id) {
    case 'weather': {
      const current = conditions?.weather;
      return {
        value: current?.temperatureC ?? '—',
        unit: current ? '°C' : '',
        detail: current
          ? `${current.condition} · ${formatForecast(current)}`
          : 'Current observation and forecast unavailable.',
      };
    }
    case 'pollution': {
      const air = conditions?.airQuality;
      return {
        value: air?.usAqi ?? '—',
        unit: air ? 'US AQI' : '',
        detail: air
          ? `${air.label} · PM2.5 ${air.pm25} · PM10 ${air.pm10} μg/m³`
          : 'AQI provider estimate unavailable.',
      };
    }
    case 'water':
      return {
        value: '—',
        unit: 'TDS',
        detail: `No live TDS sensor feed · ${reports} active water reports.`,
      };
    case 'electricity':
      return { value: reports, unit: 'open reports', detail: 'No utility grid outage feed is connected.' };
    case 'traffic':
      return { value: reports, unit: 'open reports', detail: 'No live congestion, smart-routing, or charger-availability feed.' };
    case 'health':
      return { value: reports, unit: 'open reports', detail: 'No verified clinic or public-health alert feed is connected.' };
    case 'sewage':
      return { value: reports, unit: 'open reports', detail: 'Overflow and blockage reports route to Water & Sanitation.' };
    default:
      return { value: reports, unit: 'open reports', detail: 'Resident waste and safai reports route to Water & Sanitation.' };
  }
}

function AgentCard({ agent, conditions, loading, onReport }) {
  const reading = agentReading(agent, conditions);
  const isUnavailable = agent.status === 'unavailable';
  const isLive = agent.status === 'live';
  return (
    <article className="condition-card">
      <div className="condition-topline">
        <span>{agent.id.replace('-', ' ').toUpperCase()} AGENT</span>
        <span className={`condition-live${isUnavailable ? ' unavailable' : ''}${isLive ? '' : ' report-mode'}`}>
          <i />{statusLabels[agent.status] || 'Report agent'}
        </span>
      </div>
      <h3 title={agent.name}>{agent.name}</h3>
      <div className="condition-reading">
        {loading && !conditions ? '—' : reading.value}
        {reading.unit && <small>{reading.unit}</small>}
      </div>
      <p className="condition-detail">{reading.detail}</p>
      <p className="agent-source">{agent.source}</p>
      <button className="agent-report-button" type="button" onClick={onReport}>Report an issue</button>
    </article>
  );
}

export default function CityConditions({ conditions, loading, error, onRefresh, onReport }) {
  const agents = conditions?.agents || [];
  return (
    <section className="conditions-section" aria-label="City service agents">
      <div className="conditions-heading">
        <div><p className="eyebrow">SONIPAT SERVICE AGENTS</p><h2>Live city signals &amp; issue monitors</h2></div>
        <button className="text-button conditions-refresh" onClick={onRefresh}>Refresh live data</button>
      </div>
      {conditions?.status === 'partial' && (
        <p className="condition-notice">One live data source is unavailable. Showing available provider readings only.</p>
      )}
      {error && conditions && (
        <p className="condition-notice">Could not refresh right now; the last successful provider reading is still shown.</p>
      )}
      {conditions && (
        <div className="conditions-grid">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              conditions={conditions}
              loading={loading}
              onReport={onReport}
            />
          ))}
        </div>
      )}
      <p className="conditions-source">
        Weather and air quality are Open-Meteo provider/model estimates, not city-owned sensors. Other agents monitor citizen reports; TDS, grid outages, live traffic, EV availability, and clinic feeds are not connected.
        {conditions?.updatedAt && ` Provider updated ${new Date(conditions.updatedAt).toLocaleString('en-IN')}.`}
      </p>
    </section>
  );
}
