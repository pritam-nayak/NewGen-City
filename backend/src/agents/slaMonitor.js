const { escalateOverdueCases } = require('./escalationAgent');

async function monitorSLAs() {
  const escalatedCount = await escalateOverdueCases();
  if (escalatedCount > 0) {
    console.info(`SLA monitor escalated ${escalatedCount} overdue case(s).`);
  }
  return escalatedCount;
}

module.exports = { monitorSLAs };
