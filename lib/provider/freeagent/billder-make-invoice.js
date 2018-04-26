
/*
 * Create an invoice from an AWS call and pass it to FreeAgent.
 */

const billing_data = require('../../billder-fetch-data');
const api = require('../../billder-api-request');

var syslog = require('modern-syslog');
var request = require('request-promise');

module.exports = {

  /*
   * Generate a FreeAgent invoice.
   * @param {Object} account, object containing data about a customer who needs invoicing
   */

  make_invoice(month, config, account) {

    /*
     * Fetch billing data from AWS.
     */
    billing_data.get_billing_data(config, month, account.AWS, true, function(costs) {
      var invoice_items = [];
      var running_total = 0;
      var products = [];
      invoice_item = {
        'description' : 'Your AWS usage for the month ' + month,
        'item_type'   : 'Comment',
      }
      invoice_items.push(invoice_item);

      /*
       * Loop through the returned line items to build our invoice items.
       */

      for (var product in costs.products) {
        cost_rounded = 0;
        if (account.currency == 'USD') {
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
          'price'       : cost_rounded * config.general.costPadding
        }
        running_total += cost_rounded;
        if (account.VAT) {
          invoice_item['sales_tax_rate'] = account.VAT;
        }
        if (config.provider.incomeCategory) {
          invoice_item['category'] = config.provider.oauth.auth.tokenHost + '/v2/categories/' + config.provider.incomeCategory;
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
          'contact'               : config.provider.oauth.auth.tokenHost + '/v2/contacts/' + account.FAC,
          'dated_on'              : n.substr(0,10),
          'payment_terms_in_days' : 30,
          'currency'              : account.currency,
          'invoice_items'         : invoice_items,
          'ec_status'             : 'UK/Non-EC'
        }
      }
      if (account.FAP) {
        invoice['invoice']['project'] = config.provider.oauth.auth.tokenHost + '/v2/projects/' + account.FAP;
      }
      // Handle EU VAT
      if (account.EU) {
        invoice['invoice']['ec_status'] = 'EC Services';
      }
      else {
        invoice['invoice']['ec_status'] = 'UK/Non-EC';
      }
      // Add sales tax, if applicable
      if (account.VAT) {
        invoice['invoice']['involves_sales_tax'] = true;
        invoice['invoice']['sales_tax_value'] = (account.VAT / 100) * running_total;
      }
      // Email options
      if (account.autosend) {
        invoice['invoice']['send_new_invoice_emails'] = true;
      }
      if (account.remind) {
        invoice['invoice']['send_reminder_emails'] = true;
      }
      if (account.thank) {
        invoice['invoice']['send_thank_you_emails'] = true;
      }

      /*
       * Send our invoice to FreeAgent.
       */

      // Nasty workaround to FreeAgent bug: https://api-discuss.freeagent.com/t/asynchronous-invoice-creation-exposes-a-freeagent-api-bug/844
      min = Math.ceil(1000);
      max = Math.floor(20000);
      ms = Math.floor(Math.random() * (max - min)) + min; // The maximum is exclusive and the minimum is inclusive
      console.log('Billder: pausing generation of invoice for %s for %s milliseconds', account.name, ms);
      setTimeout(create_invoice, ms, account, config, invoice);

    })

  }

}

/*
 * Function to create invoice in FreeAgent.
 * Runs after a random pause to avoid FreeAgent bug commented above.
 * @param {Object} account
 * @param {Object} invoice
 */
function create_invoice(account, config, invoice) {
    options = api.build_request_options(config.provider.oauth.auth.tokenHost, '/v2/invoices', '/tmp/fa-access-token.txt', 'POST', invoice);
    request(options)
      .then(function (response) {
        syslog.debug('Billder: service response');
        syslog.debug(response);
        syslog.notice('Billder: invoice for %s (%s) successfully created', account.name, account.FAC);
        console.log('Billder: invoice for %s (%s) successfully created', account.name, account.FAC);
        if (account.autosend) {
          console.log('Billder: emailing invoice to %s (%s)', account.name, account.FAC);
          response_object = JSON.parse(response);
          send_invoice(response_object['invoice']['url']);
        }
    })
    .catch(function (error) {
      syslog.warn('Billder: ERROR - invoice for %s (account contact ID %s) could not be created', account.name, account.FAC);
      syslog.warn(error);
      console.log('Billder: ERROR - invoice for %s (account contact ID %s) could not be created', account.name, account.FAC);
    })
}

/*
 * Function to email a FreeAgent invoice.
 * @param {String} URL of invoice
 */
function send_invoice(invoice_url) {
  // WIP
  // Here is where we need to extract the invoice ID and form the email request
  // See: https://dev.freeagent.com/docs/invoices#email-an-invoice
  console.log('Billder: would have sent an email, but that feature isn\'t ready yet. :)');
}
