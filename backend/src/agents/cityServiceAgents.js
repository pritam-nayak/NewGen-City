const serviceDefinitions = [
  {
    id: 'garbage',
    name: 'Garbage & safai agent',
    category: 'sanitation',
    source: 'Active citizen reports',
    capability: 'Classifies waste complaints and routes them to Water & Sanitation.',
  },
  {
    id: 'weather',
    name: 'Weather & flood agent',
    category: 'weather',
    source: 'Open-Meteo forecast',
    capability: 'Shows current conditions and a three-day forecast; flood reports are routed for review.',
  },
  {
    id: 'water',
    name: 'Water network agent',
    category: 'water',
    source: 'Active citizen reports · no TDS sensor feed',
    capability: 'Tracks reported leaks and supply issues. TDS readings require a connected water-quality sensor.',
  },
  {
    id: 'electricity',
    name: 'Power outage agent',
    category: 'electricity',
    source: 'Active citizen reports · no utility outage feed',
    capability: 'Tracks reported outages and electrical hazards; grid-wide outage data is not connected.',
  },
  {
    id: 'traffic',
    name: 'Traffic & mobility agent',
    category: 'traffic',
    source: 'Active citizen reports · no live traffic feed',
    capability: 'Tracks jam and signal reports. Live rerouting and charger availability need a traffic/EV provider.',
  },
  {
    id: 'pollution',
    name: 'Air quality agent',
    category: 'pollution',
    source: 'Open-Meteo air-quality model',
    capability: 'Shows provider AQI and particulate estimates; these are not city-owned monitoring sensors.',
  },
  {
    id: 'sewage',
    name: 'Sewage & drainage agent',
    categories: ['sewage', 'drainage'],
    source: 'Active citizen reports',
    capability: 'Separately routes sewer overflow and blockage reports to Water & Sanitation.',
  },
  {
    id: 'health',
    name: 'Public health agent',
    category: 'health',
    source: 'Active citizen reports · no clinic alert feed',
    capability: 'Tracks health-service concerns. Medical alerts require a verified health-department feed.',
  },
];

function buildCityServiceAgents(reports = {}, conditions = {}) {
  return serviceDefinitions.map((definition) => {
    const liveCondition = definition.id === 'weather'
      ? conditions.weather
      : definition.id === 'pollution'
        ? conditions.airQuality
        : null;
    const connected = liveCondition?.status === 'live';

    return {
      ...definition,
      status: liveCondition
        ? connected ? 'live' : 'unavailable'
        : 'report-monitor',
      activeReports: (definition.categories || [definition.category])
        .reduce((total, category) => total + (reports[category] ?? 0), 0),
      ...(liveCondition?.error ? { error: liveCondition.error } : {}),
    };
  });
}

module.exports = { buildCityServiceAgents };
