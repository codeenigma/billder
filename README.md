# billder
Fetches billing information from AWS on demand and creates a FreeAgent invoice.

## Pre-requisites

1. You have an AWS account with AWS Organizations enabled
2. You have also enabled 'Receive Billing Reports' under [biling preferences](https://console.aws.amazon.com/billing/home?#/preferences) of your main account
3. You have an IAM user on your main account with access to the S3 bucket containing the billing reports
4. You have a FreeAgent account
5. You have created a user on your FreeAgent account for use by the application
6. You have created and registered an app on the [FreeAgent Developer Portal](https://dev.freeagent.com)
6. You have followed [FreeAgent's OAuth2 Quick Start guide](https://dev.freeagent.com/docs/quick_start) to generate a refresh token

## Installation

1. Clone this repository
2. Install the [latest version of Node](https://nodejs.org/en/download/) for your system (it includes `npm`)
3. In the cloned directory run `npm install` to install the dependencies

## Configuration

You need to create two files:

1. `config.js`
2. `accounts.js`

Both files are ignored by Git. Their contents should be as follows:

### `config.js`

```javascript
/*
 * Gitignored config file containing all our secrets.
 */

module.exports = {
  // AWS config
  'accountId' : 'XXXX-XXXX-XXXX', // the 12 digit AWS account ID for your main account
  'key'       : 'ABCDEFGHIJKLMNOPQRST', // the key belonging to an IAM user with access to billing reports
  'secret'    : 'abCdEFghiJkLmnOPQrSTuvwXyz123456787', // the secret associated with the above key
  'bucket'    : 'my-billing-bucket', // the name of your S3 bucket containing your billing reports
  'region'    : 'eu-west-1', // the region your S3 billing bucket is in
  // General FreeAgent config
  'incomeCategory' : 'XXX', // the three-digit FreeAgent category code, false if not required
  'costPadding' : 1.02, // set to 1 to disable, we pad by 2% because AWS convert to GBP with Visa rate
  // FreeAgent OAuth / API config
  'client': {
    'id': 'abcfdefghijklmnop', // your FreeAgent app OAuth identifier
    'secret': '123ghjk4567jkhabbja' // your FreeAgent app OAuth secret
  },
  'auth': {
    'tokenHost': 'https://api.sandbox.freeagent.com', // the API host
    'tokenPath': '/v2/token_endpoint', // the token endpoint path
  },
  'refresh_token': '12345ABCdeFGhIjKLMn-0987oPQrStuVWXyZ' // refresh token generated when FreeAgent app was authorised
}
```

### `accounts.js`

```javascript
/*
 * Gitignored list of accounts to generate invoices for.
 *
 * Currency codes: https://dev.freeagent.com/docs/currencies
 *
 * AWS: the AWS account number to look up the billing for
 * FAC: the FreeAgent contact number of the same organisation
 * FAP: (optional) the FreeAgent project to assign the invoice to
 * cur: the 3 letter currency code
 * VAT: either false or a decimal for the sales tax rate
 * EU : boolean to say whether organisation is EC area or not
 */

module.exports = {
  'Customer1' : {
    'AWS' : 'XXXX-XXXX-XXXX',
    'FAC' : '40636',
    'FAP' : '4417', // invoice will be placed in this project
    'cur' : 'GBP', // billing in GBP, so we will run a currency conversion
    'VAT' : 20, // customer will be charged 20% VAT
    'EU'  : false // customer is not in the EC
  },
  'Customer2' : {
    'AWS' : 'XXXX-XXXX-XXXX',
    'FAC' : '40635',
    'cur' : 'USD',
    'VAT' : false, // customer will not be charged VAT
    'EU'  : true // invoice will be marked as EC for VAT purposes
  }
}
```

## Roadmap

* Period handling (we don't have enough data in our S3 bucket yet for testing)
* Consider using the Node module for the ECB bank rates - https://www.npmjs.com/package/ecb-exchange-rates
* Base currency configuration
