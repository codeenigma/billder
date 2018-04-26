
/*
 * Trigger the invoicing process with this script.
 */

// Load logging and requirements for argument parsing
var syslog = require('modern-syslog');
var now = new Date();
var pad = require('pad');

// Process CLI arguments
var args = process.argv.slice(2);
if (!args[0]) {
  syslog.notice('Billder: No config file presented, bailing!');
  console.log('Billder: No config file presented, bailing!');
  process.exit(1);
}

// Get the month to process from the CLI
if (args[1]) {
  var month = args[1];
  syslog.notice('Billder: we received a month to process: %s', month);
  console.log('Billder: we received a month to process: %s', month);
}
else {
  // getMonth() gives us month number - 1 so January is 0
  if (now.getMonth() == 0) {
    var year = now.getFullYear() - 1;
    var lastMonth = 12;
  }
  else {
    var year = now.getFullYear();
    var lastMonth = pad(2, now.getMonth(), '0');
  }
  // Defaults to last month
  var month = year + '-' + lastMonth;

  syslog.notice('Billder: we did not receive a month to process, defaulting to last month: %s', month);
  console.log('Billder: we did not receive a month to process, defaulting to last month: %s', month);
}

// The config filename has been passed in from the CLI
const config = require('./' + args[0]);
var provider_path = './lib/provider/' + config.provider.name + '/';
const invoices = require('./lib/billder-make-invoice');
const auth = require(provider_path + 'billder-auth');

/*
 * Because we expect to run this monthly, we'll assume our
 * access token has expired and get a new one.
 */
syslog.notice('Billder: authenticating with %s', config.provider.name);
console.log('Billder: authenticating with %s', config.provider.name);

auth.authenticate(config);

/*
 * Now we have a fresh access token we can make invoices!
 */
syslog.notice('Billder: starting invoicing run');
console.log('Billder: starting invoicing run');

invoices.make_invoices(month, config);

