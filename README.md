# billder
Fetches billing information from AWS on demand and creates a FreeAgent invoice. Pull requests welcome, we'd love to support more services.

## Pre-requisites

1. You have an AWS account with AWS Organizations enabled
2. You have also enabled 'Receive Billing Reports' under [biling preferences](https://console.aws.amazon.com/billing/home?#/preferences) of your main account
3. You have an IAM user on your main account with access to the S3 bucket containing the billing reports
4. You have a FreeAgent account
5. You have created a user on your FreeAgent account for use by the application
6. You have created and registered an app on the [FreeAgent Developer Portal](https://dev.freeagent.com)
6. You have followed [FreeAgent's OAuth2 Quick Start guide](https://dev.freeagent.com/docs/quick_start) to generate a refresh token

## Installation

1. Clone this repository (to somewhere sane, probably /opt on a \*nix system)
2. Install the [latest version of Node](https://nodejs.org/en/download/) for your system (it includes `npm`)
3. In the cloned directory run `npm install` to install the dependencies

## Configuration

You need to create two files:

1. `config.js`
2. `accounts.js`

These are the *recommended* filenames for these files and both filenames are ignored by Git. However, you may choose to call them anything and also have multiple sets if config and accounts files for different billing scenarios. See the documentation below for details. In any case, the contents of config and accounts files should be as follows:

### `config.js`

```javascript
/*
 * Gitignored config file containing all our secrets.
 */

module.exports = {
  // AWS config
  'aws' : {
    'accountId'    : 'XXXX-XXXX-XXXX', // the 12 digit AWS account ID for your main account
    'key'          : 'ABCDEFGHIJKLMNOPQRST', // the key belonging to an IAM user with access to billing reports
    'secret'       : 'abCdEFghiJkLmnOPQrSTuvwXyz123456787', // the secret associated with the above key
    'bucket'       : 'my-billing-bucket', // the name of your S3 bucket containing your billing reports
    'region'       : 'eu-west-1', // the region your S3 billing bucket is in
    'accountsFile' : 'accounts' // the filename of the file containing your accounts to bill data (see below)
  },
  // General accountancy settings
  'general' : {
    'costPadding' : 1.02 // set to 1 to disable, we pad by 2% because AWS convert to GBP with Visa rate
  },
  // Provider settings
  'provider' : {
    // Selected accountancy provider (currently only FreeAgent)
    'name' : 'freeagent',
    // Accountancy provider config (will vary depending on provider)
    'incomeCategory' : 'XXX', // the three-digit FreeAgent category code, false if not required
    // FreeAgent OAuth / API config
    'oauth' : {
      'client': {
        'id': 'abcfdefghijklmnop', // your FreeAgent app OAuth identifier
        'secret': '123ghjk4567jkhabbja' // your FreeAgent app OAuth secret
      },
      'auth': {
        'tokenHost': 'https://api.sandbox.freeagent.com', // the API host
        'tokenPath': '/v2/token_endpoint' // the token endpoint path
      },
      'refresh_token': '12345ABCdeFGhIjKLMn-0987oPQrStuVWXyZ' // refresh token generated when FreeAgent app was authorised
    }
  }
}
```

### `accounts.js`

In this example the accounts data file is `accounts.js` because we have specified '`accounts`' as the filename above under our AWS config. If we had placed `foo` in the `accountsFile` option above, this file would be named `foo.js`.

IMPORTANT, if you are generating a bill for a single account that is *not* a part of an AWS Organization (e.g. not consolidated billing) then the `AWS` property below must be `null`.

```javascript
/*
 * Gitignored list of accounts to generate invoices for.
 *
 * Currency codes: https://dev.freeagent.com/docs/currencies
 *
 * AWS      : the AWS account number to bill or null if not an Organizations account
 * FAC      : the FreeAgent contact number of the same organisation
 * FAP      : (optional) the FreeAgent project to assign the invoice to
 * currency : the 3 letter currency code
 * VAT      : either false or a decimal for the sales tax rate
 * EU       : boolean to say whether organisation is EC area or not
 * remind   : boolean to enable reminder emails
 * thank    : boolean to enable thank you emails
 */

module.exports = {
  'Customer1' : {
    'AWS'      : 'XXXX-XXXX-XXXX',
    'FAC'      : '40636',
    'FAP'      : '4417', // invoice will be placed in this project
    'currency' : 'GBP', // billing in GBP, so we will run a currency conversion
    'VAT'      : 20, // customer will be charged 20% VAT
    'EU'       : false, // customer is not in the EC
    'thank'    : true // customer will receive a thank you email on payment
  },
  'Customer2' : {
    'AWS'      : 'XXXX-XXXX-XXXX',
    'FAC'      : '40635',
    'currency' : 'USD',
    'VAT'      : false, // customer will not be charged VAT
    'EU'       : true, // invoice will be marked as EC for VAT purposes
    'remind'   : true // customer will get a reminder email
  }
}
```

## Usage

Once you've installed and configured Billder, the best way to run it is some kind of automated task, either from a continuous integration system (we use Jenkins for orchestration) or in cron on a \*nix server. The command, if you cloned Billder to /opt as suggested above, will look something like this:

```bash
nodejs /opt/billder/index.js config
```

A monthly crontab entry might be to run Billder on the second day of each month (you want to be sure AWS has had time to complete your data) at 01:00AM server time, and it would look like this:

```bash
0 1 2 * *	root	nodejs /opt/billder/index.js config
```

Note the `config` argument passed to our script, this is obligatory and it is the filename of our configuration file. By making it an argument, you can have multiple instances of Billder running for different AWS accounts with different config files. Our example assumes the config file is `config.js` and so we pass `config` as the filename to the script.

Billder also supports being passed a month to generate invoices for in the form of 'YYYY-MM', e.g. `2017-11`. If you do not pass it a month to process, it will automatically use last month, so if you are in November 2017 it will create invoices for October 2017 (`2017-10`) by default. Passing Billder a month to process is as simple as this example, which will process June 2016:

```bash
nodejs /opt/billder/index.js config 2016-06
```

And that's all there is to it!

## Developers

If you wish to add your own accountancy software as a software provider to this base project, you can [create a PR](https://github.com/codeenigma/billder/compare) with (at least) the following two files:

* `lib/provider/PROVIDERNAME/billder-auth.js`
* `lib/provider/PROVIDERNAME/billder-make-invoice.js`

You may also wish to make some tweaks to the abstraction of API calls or the `authenticate()` method, if you require something it doesn't currently support. This is fine, as long as you don't break what's already there and provide sane defaults in your PR.

Note, you can also add elements to `config.js` and `accounts.js` above, but please provide a patch for this README as well if you do.

`PROVIDERNAME` will become the 'provider' element in the 'config' object in `config.js`.

### `billder-auth.js`

Must export an `authenticate()` method. At time of writing this method optionally excepts the input of a flat file where the application can store (a) secret(s). If you need to add more parameters to `authenticate()` you can include that in your PR.

### `billder-make-invoice.js`

Receives the 'account' object and must construct an invoice and submit it to the service provider via their API. To do so it must export a `make_invoice()` method which will do all the heavy lifting in terms of creating and invoice object and submitting it to the provider.

## Roadmap

* Auto-send emails with FreeAgent
* Consider using the Node module for the ECB bank rates - https://www.npmjs.com/package/ecb-exchange-rates
* Base currency configuration
* Other providers!
