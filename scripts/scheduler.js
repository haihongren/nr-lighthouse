const nrLighthouse = require('./lighthousePrototype');
const cron = require('node-cron');

cron.schedule('*/30 * * * *', () => {
  console.log(`cron run at ${new Date().toLocaleString()}`);
  nrLighthouse.run();
}, {
  timezone: 'Etc/UTC'
});
