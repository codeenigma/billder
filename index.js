
/*
 * Trigger the invoicing process with this script.
 */

const invoices = require('./lib/billder-make-invoice');
const auth = require('./lib/billder-freeagent-auth');
var syslog = require('modern-syslog');

/*
 * Because we expect to run this monthly, we'll assume our
 * access token has expired and get a new one.
 */
syslog.notice('Billder: refreshing OAuth access token');
console.log('Billder: refreshing OAuth access token');

auth.refresh_oauth_token();

/*
 * Now we have a fresh access token we can make invoices!
 */
syslog.notice('Billder: starting invoicing run');
console.log('Billder: starting invoicing run');

invoices.make_invoices();

