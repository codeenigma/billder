
/*
 * Trigger the invoicing process with this script.
 */

const config = require('./config');
var provider_path = './lib/provider/' + config.provider + '/';
const invoices = require('./lib/billder-make-invoice');
const auth = require(provider_path + 'billder-auth');
var syslog = require('modern-syslog');

/*
 * Because we expect to run this monthly, we'll assume our
 * access token has expired and get a new one.
 */
syslog.notice('Billder: authenticating with %s', config.provider);
console.log('Billder: authenticating with %s', config.provider);

auth.authenticate();

/*
 * Now we have a fresh access token we can make invoices!
 */
syslog.notice('Billder: starting invoicing run');
console.log('Billder: starting invoicing run');

invoices.make_invoices();

