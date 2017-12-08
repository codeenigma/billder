
/*
 * Prepare an account object and pass it to the accounting provider that generates invoices.
 */

const accounts = require('../accounts');
const config = require('../config');
const api = require('./billder-api-request');

var provider_path = './provider/' + config.provider.name + '/';
const make_provider_invoice = require(provider_path + 'billder-make-invoice');

var syslog = require('modern-syslog');
var request = require('request-promise');

/*
 * Carry out some basic preparation before handing back the to the invoicing provider for processing.
 * @param {String} month, 'YYYY-MM' string for target month for this invoice
 * @param {Object} account, object containing data about a customer who needs invoicing
 */
function make_invoice(month, account) {

  /* 
   * Fetch the current exchange rate.
   * Currency service is: http://fixer.io/
   */
  options = api.build_request_options('http://api.fixer.io', '/latest?base=USD&symbols=' + account.currency, null, 'GET');
  request(options)
    .then(function (response) {
      response_object = JSON.parse(response);
      // Stash the exchange rate in the account object so we don't get it overwritten by asynchronous calls later
      account['exchange_rate'] = response_object.rates[account.currency];
      // Send the account data to our provider-specific invoice building function
      make_provider_invoice.make_invoice(month, account);

    })
    .catch(function (error) {
      syslog.warn('Billder: ERROR - API call for currency data failed');
      syslog.warn(error);
      console.log('Billder: ERROR - failed processing, see syslog for details');
    })
}


module.exports = {

  /*
   * Cycle through all accounts in ./accounts.js and trigger invoice processing.
   * @param {String} month, 'YYYY-MM' string for target month for these invoices
   */
  make_invoices(month) {
    for (var account in accounts) {
      // Pass in customer name so we have it available for convenience
      accounts[account]['name'] = account;
      make_invoice(month, accounts[account]);
    }
  }

}

