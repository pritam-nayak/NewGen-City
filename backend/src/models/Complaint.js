const db = require('../db/connection');

const complaintColumns = `
  c.id, c.title, c.description, c.category, c.location, c.status, c.priority,
  c.department_id, d.name AS department, c.duplicate_of, c.evidence_url,
  c.resolution_note, c.latitude, c.longitude, c.created_at, c.due_at,
  c.resolved_at, c.escalated_at
`;

async function createComplaint(data) {
  const { rows } = await db.query(
    `INSERT INTO complaints
      (title, description, category, location, department_id, duplicate_of, due_at, priority, latitude, longitude, reporter_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 * INTERVAL '1 hour'), $8, $9, $10, $11)
     RETURNING id, title, description, category, location, status, priority,
       department_id, duplicate_of, evidence_url, resolution_note, latitude,
       longitude, created_at, due_at, resolved_at, escalated_at`,
    [
      data.title,
      data.description,
      data.category,
      data.location,
      data.departmentId,
      data.duplicateOf,
      data.slaHours,
      data.priority || 'normal',
      data.latitude ?? null,
      data.longitude ?? null,
      data.reporterUserId ?? null,
    ]
  );
  return rows[0];
}

async function listComplaints(status, reporterUserId) {
  const params = [];
  const filters = [];
  if (status) {
    params.push(status);
    filters.push(`c.status = $${params.length}`);
  }
  if (reporterUserId) {
    params.push(reporterUserId);
    filters.push(`c.reporter_user_id = $${params.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT ${complaintColumns},
       COALESCE(
         json_agg(json_build_object(
           'type', e.event_type, 'details', e.details, 'createdAt', e.created_at
         ) ORDER BY e.created_at) FILTER (WHERE e.id IS NOT NULL),
         '[]'
       ) AS timeline
     FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN complaint_events e ON e.complaint_id = c.id
     ${where}
     GROUP BY c.id, d.name
     ORDER BY c.created_at DESC`,
    params
  );
  return rows;
}

async function listMyComplaints(reporterUserId) {
  return listComplaints(null, reporterUserId);
}

async function findComplaintById(id) {
  const { rows } = await db.query(
    `SELECT ${complaintColumns},
       COALESCE(
         json_agg(json_build_object(
           'type', e.event_type, 'details', e.details, 'createdAt', e.created_at
         ) ORDER BY e.created_at) FILTER (WHERE e.id IS NOT NULL),
         '[]'
       ) AS timeline
     FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN complaint_events e ON e.complaint_id = c.id
     WHERE c.id = $1
     GROUP BY c.id, d.name`,
    [id]
  );
  return rows[0] || null;
}

async function findActiveDuplicate(category, title) {
  const normalizedTitle = title.trim().toLowerCase();
  const { rows } = await db.query(
    `SELECT id FROM complaints
     WHERE category = $1
       AND LOWER(TRIM(title)) = $2
       AND status IN ('open', 'in_progress', 'reopened')
     ORDER BY created_at DESC
     LIMIT 1`,
    [category, normalizedTitle]
  );
  return rows[0] || null;
}

async function addEvent(complaintId, type, details) {
  await db.query(
    `INSERT INTO complaint_events (complaint_id, event_type, details)
     VALUES ($1, $2, $3)`,
    [complaintId, type, details]
  );
}

async function updateComplaint(id, updates) {
  const { rows } = await db.query(
    `UPDATE complaints
     SET status = COALESCE($2, status),
         department_id = COALESCE($3, department_id),
         evidence_url = COALESCE($4, evidence_url),
         resolution_note = COALESCE($5, resolution_note),
         resolved_at = CASE
           WHEN $2 = 'resolved' THEN NOW()
           WHEN $2 IN ('open', 'in_progress', 'reopened') THEN NULL
           ELSE resolved_at
         END
     WHERE id = $1
     RETURNING *`,
    [
      id,
      updates.status || null,
      updates.departmentId || null,
      updates.evidenceUrl || null,
      updates.resolutionNote || null,
    ]
  );
  return rows[0] || null;
}

async function getOverview() {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status IN ('open', 'reopened'))::int AS open,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       COUNT(*) FILTER (
         WHERE status IN ('open', 'in_progress', 'reopened') AND due_at < NOW()
       )::int AS overdue
     FROM complaints`
  );
  return rows[0];
}

async function getActiveCategoryCounts() {
  const { rows } = await db.query(
    `SELECT category, COUNT(*)::int AS count
     FROM complaints
     WHERE status IN ('open', 'in_progress', 'reopened')
     GROUP BY category`
  );
  return Object.fromEntries(rows.map((row) => [row.category, row.count]));
}

module.exports = {
  addEvent,
  createComplaint,
  findActiveDuplicate,
  findComplaintById,
  getOverview,
  getActiveCategoryCounts,
  listComplaints,
  listMyComplaints,
  updateComplaint,
};
