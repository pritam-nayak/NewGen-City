const db = require('../db/connection');

async function listDepartments() {
  const { rows } = await db.query(
    'SELECT id, name, categories FROM departments ORDER BY name'
  );
  return rows;
}

module.exports = { listDepartments };
