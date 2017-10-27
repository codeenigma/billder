
/*
 * Create an invoice from an AWS call and pass it to FreeAgent.
 */

const billing_data = require('./billder-fetch-data');
const accounts = require('../accounts');
const config = require('../config.js');
const api = require('./billder-api-request');

var syslog = require('modern-syslog');
var request = require('request-promise');

/*
 * Generate a FreeAgent invoice.
 * @param {Object} account, object containing data about a customer who needs invoicing
 */
function make_invoice(account) {

  /* 
   * Fetch the current exchange rate.
   * Currency service is: http://fixer.io/
   */
  options = api.build_request_options('http://api.fixer.io', '/latest?base=USD&symbols=' + account.cur, null, 'GET');
  request(options)
    .then(function (response) {
      response_object = JSON.parse(response);
      // Stash the exchange rate in the account object so we don't get it overwritten by asynchronous calls later
      account['exchange_rate'] = response_object.rates[account.cur];

      /*
       * Fetch billing data from AWS.
       */
      billing_data.get_billing_data(account.AWS, true, function(costs) {
        var invoice_items = [];
        var running_total = 0;
        var products = [];
        invoice_item = {
          'description' : 'Your AWS usage',
          'item_type'   : 'Comment',
        }
        invoice_items.push(invoice_item);

        /*
         * Loop through the returned line items to build our invoice items.
         */
        for (var product in costs.products) {
          cost_rounded = 0;
          if (account.cur == 'USD') {
            cost = costs.products[product];
          }
          else {
            cost = costs.products[product] * account.exchange_rate;
          }

          cost_rounded = Math.ceil(cost * 100) / 100;
          invoice_item = {
            'description' : product,
            'item_type'   : 'Services',
            'quantity'    : 1,
            'price'       : cost_rounded * config.costPadding
          }
          running_total += cost_rounded;
          if (account.VAT) {
            invoice_item['sales_tax_rate'] = account.VAT;
          }
          if (config.incomeCategory) {
            invoice_item['category'] = config.auth.tokenHost + '/v2/categories/' + config.incomeCategory;
          }
          invoice_items.push(invoice_item);
        }

        /*
         * Generate the rest of our invoice.
         */
        var d = new Date();
        var n = d.toISOString();

        var invoice = {
          'invoice' : {
            'status'                : 'Draft',
            'contact'               : config.auth.tokenHost + '/v2/contacts/' + account.FAC,
            'dated_on'              : n.substr(0,10),
            'payment_terms_in_days' : 30,
            'currency'              : account.cur,
            'invoice_items'         : invoice_items,
            'ec_status'             : 'UK/Non-EC'
          }
        }
        if (account.FAP) {
          invoice['invoice']['project'] = config.auth.tokenHost + '/v2/projects/' + account.FAP;
        }
        /* Handle EU VAT */
        if (account.EU) {
          invoice['invoice']['ec_status'] = 'EC Services';
        }
        else {
          invoice['invoice']['ec_status'] = 'UK/Non-EC';
        }
        /* Add sales tax, if applicable */
        if (account.VAT) {
          invoice['invoice']['involves_sales_tax'] = true;
          invoice['invoice']['sales_tax_value'] = (account.VAT / 100) * running_total;
        }

        /*
         * Send our invoice to FreeAgent.
         */
        options = api.build_request_options(config.auth.tokenHost, '/v2/invoices', '/tmp/fa-access-token.txt', 'POST', invoice);
        request(options)
          .then(function (response) {
            syslog.debug('Billder: service response');
            syslog.debug(response);
            syslog.notice('Billder: invoice for contact ID %s successfully created', account.FAC);
            console.log('Billder: invoice for contact ID %s successfully created', account.FAC);
        })
        .catch(function (error) {
          syslog.warn('Billder: ERROR - invoice for contact ID %s could not be created', account.FAC);
          syslog.warn(error);
          console.log('Billder: ERROR - failed processing, see syslog for details');
        })

      })


    })
    .catch(function (error) {
      syslog.warn('Billder: ERROR - API call for currency data failed');
      syslog.warn(error);
      console.log('Billder: ERROR - failed processing, see syslog for details');
    })
}


module.exports = {

  /*
   * Cycle through all accounts in ./accounts.js and process invoices.
   */
  make_invoices() {
    for (var account in accounts) {
      // Nasty workaround to FreeAgent bug: https://api-discuss.freeagent.com/t/asynchronous-invoice-creation-exposes-a-freeagent-api-bug/844
      min = Math.ceil(1000);
      max = Math.floor(20000);
      ms = Math.floor(Math.random() * (max - min)) + min; // The maximum is exclusive and the minimum is inclusive
      console.log('Billder: pausing generation of invoice for %s for %s milliseconds', account, ms);
      setTimeout(make_invoice, ms, accounts[account]);
      console.log('Billder: continuing on to make invoice for %s', account);
      // This is all we need normally
      //make_invoice(accounts[account]);
    }
  }

}

