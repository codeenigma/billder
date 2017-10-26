
/*
 * Create an invoice from an AWS call and pass it to FreeAgent.
 */

const billing_data = require('./billder-fetch-data');
const accounts = require('../accounts');
const api = require('./billder-api-request');

var request = require('request-promise');

/*
 * Generate a FreeAgent invoice.
 */
function make_invoice(account) {

  /* 
   * Fetch the current exchange rate.
   * We add 2% to protect ourselves from nasty bank rates!
   * Currency service is: http://fixer.io/
   */
  options = api.build_request_options(endpoint='http://api.fixer.io', path='/latest?base=USD&symbols=' + account.cur, access_token_file=null, request_method='GET');
  request(options)
    .then(function (response) {
      response_object = JSON.parse(response);
      exchange_rate = response_object.rates[account.cur] * 1.02;
      // Stash the exchange rate in the account object so we don't get it overwritten by asynchronous calls later
      account['exchange_rate'] = exchange_rate;

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
          products[product] = cost_rounded;
          invoice_item = {
            'description' : product,
            'item_type'   : 'Services',
            'quantity'    : 1,
            'price'       : cost_rounded,
          }
          running_total += cost_rounded;
          if (account.VAT) {
            invoice_item['sales_tax_rate'] = account.VAT;
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
            'contact'               : 'https://api.sandbox.freeagent.com/v2/contacts/' + account.FAC,
            'dated_on'              : n.substr(0,10),
            'payment_terms_in_days' : 30,
            'currency'              : account.cur,
            'invoice_items'         : invoice_items,
            'ec_status'             : 'UK/Non-EC'
          }
        }
        if (account.FAP) {
          invoice['invoice']['project'] = 'https://api.sandbox.freeagent.com/v2/projects/' + account.FAP;
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
        options = api.build_request_options(endpoint='https://api.sandbox.freeagent.com',path='/v2/invoices', access_token_file='/tmp/fa-access-token.txt', request_method='POST', data=invoice);
        request(options)
          .then(function (response) {
            console.log(response);
        })

      })


    })
    .catch(function (error) {
      console.log(error);
    })
}

module.exports = {

  make_invoices() {
    for (var account in accounts) {
      make_invoice(accounts[account]);
      console.log(account, accounts[account]);
    }
  }
}

