const db = require('../db/connection');
const Complaint = require('../models/Complaint');

async function escalateOverdueCases() {
  const { rows } = await db.query(
    `UPDATE complaints
     SET priority = 'high', escalated_at = NOW()
     WHERE status IN ('open', 'in_progress', 'reopened')
       AND due_at < NOW()
       AND escalated_at IS NULL
     RETURNING id`
  );

  for (const complaint of rows) {
    await Complaint.addEvent(
      complaint.id,
      'escalated',
      'SLA deadline passed; case escalated for priority review.'
    );
  }
  return rows.length;
}

async function reopenComplaint(id, reason) {
  const complaint = await Complaint.updateComplaint(id, {
    status: 'reopened',
    resolutionNote: null,
    evidenceUrl: null,
  });
  if (complaint) {
    await Complaint.addEvent(id, 'reopened', reason);
  }
  return complaint;
}

module.exports = { escalateOverdueCases, reopenComplaint };
