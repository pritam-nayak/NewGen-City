const db = require('../db/connection');

const categoryRules = {
  roads: { department: 'Roads & Transport', slaHours: 72 },
  traffic: { department: 'Roads & Transport', slaHours: 24 },
  water: { department: 'Water & Sanitation', slaHours: 24 },
  sanitation: { department: 'Water & Sanitation', slaHours: 48 },
  drainage: { department: 'Water & Sanitation', slaHours: 24 },
  sewage: { department: 'Water & Sanitation', slaHours: 12 },
  parks: { department: 'Parks & Public Spaces', slaHours: 72 },
  streetlights: { department: 'Parks & Public Spaces', slaHours: 48 },
  safety: { department: 'Public Safety', slaHours: 12 },
  pollution: { department: 'Environment & Air Quality', slaHours: 24 },
  health: { department: 'Public Health', slaHours: 12 },
  electricity: { department: 'Utilities & Power', slaHours: 24 },
  weather: { department: 'Weather & Disaster Response', slaHours: 6 },
  other: { department: 'Public Safety', slaHours: 72 },
};

async function routeComplaint(category) {
  const rule = categoryRules[category] || categoryRules.other;
  const { rows } = await db.query(
    'SELECT id, name FROM departments WHERE name = $1',
    [rule.department]
  );
  if (!rows[0]) {
    throw new Error(`Routing department not found: ${rule.department}`);
  }
  return { departmentId: rows[0].id, department: rows[0].name, slaHours: rule.slaHours };
}

module.exports = { routeComplaint };
