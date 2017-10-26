
/*
 * Use the 'aws-billing' package to get billing data for a specific account.
 */

var config = require('../config');

module.exports = {

  /*
   * Get billing data for a specific account.
   * @param {String} linkedAccountId
   * @param {Boolean} withoutTaxes
   * @return {Object} AWS costs for provided linkedAccountId
   */
  get_billing_data(linkedAccountId, withoutTaxes, callback) {
    var billing = require('aws-billing')(config.accountId, config.key, config.secret, config.bucket, config.region, linkedAccountId, withoutTaxes);
    billing(function (err, costs) {
      return callback(costs);
    });
  }

}

