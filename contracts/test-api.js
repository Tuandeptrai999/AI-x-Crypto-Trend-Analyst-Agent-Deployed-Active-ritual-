const https = require('https');
https.get('https://explorer.ritualfoundation.org/api?module=contract&action=verifysourcecode', (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', d => process.stdout.write(d.toString().slice(0, 100)));
});
