const cron = require('node-cron');
const { monitorSLAs } = require('../agents/slaMonitor');

function startSlaCron() {
  return cron.schedule('*/5 * * * *', () => {
    monitorSLAs().catch((error) => {
      console.error('SLA monitor failed:', error);
    });
  });
}

module.exports = { startSlaCron };
