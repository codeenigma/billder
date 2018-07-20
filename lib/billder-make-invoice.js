
/*
 * Prepare an account object and pass it to the accounting provider that generates invoices.
 */

const api = require('./billder-api-request');

var syslog = require('modern-syslog');
var request = require('request-promise');

/*
 * Carry out some basic preparation before handing back the to the invoicing provider for processing.
 * @param {String} month, 'YYYY-MM' string for target month for this invoice
 * @param {Object} config, configuration data
 * @param {Object} account, object containing data about a customer who needs invoicing
 */
function make_invoice(month, config, account) {

  /*
   * Fetch the current exchange rate.
   * Currency service is: http://fixer.io/
   */
  options = api.build_request_options('https://frankfurter.app', '/current?from=USD&to=' + account.currency, null, 'GET');
  request(options)
    .then(function (response) {
      response_object = JSON.parse(response);
      // Stash the exchange rate in the account object so we don't get it overwritten by asynchronous calls later
      account['exchange_rate'] = response_object.rates[account.currency];
      // Load provider from config file
      var provider_path = './provider/' + config.provider.name + '/';
      var make_provider_invoice = require(provider_path + 'billder-make-invoice');
      // Send the account data to our provider-specific invoice building function
      make_provider_invoice.make_invoice(month, config, account);

    })
    .catch(function (error) {
      syslog.warn('Billder: ERROR - API call for currency data failed');
      syslog.warn(error);
      console.log('Billder: ERROR - failed processing, see syslog for details');
      process.exit(1);
    })
}


module.exports = {

  /*
   * Cycle through all accounts in ./accounts.js and trigger invoice processing.
   * @param {String} month, 'YYYY-MM' string for target month for these invoices
   * @param {Object} config, configuration data
   */
  make_invoices(month, config) {
    // Load the accounts data
    var accounts = require('../' + config.aws.accountsFile);
    // Loop through accounts
    for (var account in accounts) {
      // Pass in customer name so we have it available for convenience
      accounts[account]['name'] = account;
      make_invoice(month, config, accounts[account]);
    }
  }

}
