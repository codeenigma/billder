
/*
 * Trigger the invoicing process with this script.
 */

const invoices = require('./lib/billder-make-invoice');
const auth = require('./lib/billder-freeagent-auth');
var syslog = require('modern-syslog');

syslog.notice('Billder: refreshing OAuth access token');
console.log('Billder: refreshing OAuth access token');

auth.refresh_oauth_token();

syslog.notice('Billder: starting invoicing run');
console.log('Billder: starting invoicing run');

invoices.make_invoices();

