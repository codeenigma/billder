
/*
 * Use the 'aws-billing' package to get billing data for a specific account.
 */

module.exports = {

  /*
   * Get billing data for a specific account.
   * @param {Object} config, configuration data
   * @param {String} month
   * @param {String} linkedAccountId
   * @param {Boolean} withoutTaxes
   * @return {Object} AWS costs for provided linkedAccountId
   */
  get_billing_data(config, month, linkedAccountId, withoutTaxes, callback) {
    var billing = require('aws-billing')(config.aws.accountId, config.aws.key, config.aws.secret, config.aws.bucket, config.aws.region, month, linkedAccountId, withoutTaxes);
    billing(function (err, costs) {
      return callback(costs);
    });
  }

}

