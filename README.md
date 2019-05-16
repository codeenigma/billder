# billder
Fetches billing information from AWS on demand and creates a Xero invoice. Pull requests welcome, we'd love to support more services. At the moment it makes extensive use of the open source community managed [xero-php](https://github.com/calcinai/xero-php) SDK for PHP as well as the [AWS SDK for PHP 3.x](https://docs.aws.amazon.com/aws-sdk-php/v3/api/) to query the AWS Cost Explorer.

## Pre-requisites

1. You have an AWS account with AWS Organizations enabled
2. You have also enabled the AWS Cost Explorer
3. You have an IAM user on your main account with [access to the Cost Explorer API](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/billing-permissions-ref.html#example-policy-ce-api)
4. You have a Xero account
5. You have created a user on your Xero account for use by the application
6. You have [created a key pair for a Xero app](https://developer.xero.com/documentation/api-guides/create-publicprivate-key)
7. You have created and registered a private app on the [Xero Developer Portal](https://developer.xero.com/myapps)

## Installation

1. Clone this repository (to somewhere sane, probably /opt on a \*nix system)
2. Install PHP for your system (make sure you also have the cURL extension)
3. Install [composer](https://getcomposer.org/) for PHP
3. In the cloned directory run `composer install` to install the dependencies

## Configuration

You need to create two files:

1. `config.json`
2. `accounts.json`

These are the *recommended* filenames for these files and both filenames are ignored by Git. However, you may choose to call them anything and also have multiple sets if config and accounts files for different billing scenarios. See the documentation below for details. In any case, the contents of config and accounts files should be as follows:

### `config.json`

```javascript
/*
 * Gitignored config JSON file containing all our secrets.
 * Note, you need to remove this doc block and the inline comments if you use this as a template.
 */

{
  'aws' : {
    'key'          : 'ABCDEFGHIJKLMNOPQRST', // the key belonging to an IAM user with access to billing reports
    'secret'       : 'abCdEFghiJkLmnOPQrSTuvwXyz123456787', // the secret associated with the above key
    'region'       : 'eu-west-1', // the region your S3 billing bucket is in
    'accountsFile' : 'accounts' // the filename of the file containing your accounts to bill data (see below)
  },
  // General accountancy settings
  'general' : {
    'costPadding' : 1.02, // set to 1 to disable, we pad by 2% because AWS convert to GBP with Visa rate
    'includeTax'  : false, // flag for if we should include sales tax in rebilling or not
    'defaultReference' : 'AWS rebilling' // optional default reference to add to all invoices without a PO (see below for PO support)
  },
  // Provider settings
  'provider' : {
    'name' : 'xero', // Selected accountancy provider (currently only FreeAgent)
    'incomeCategory' : 'XXX', // the Xero accounting category code, remove if not required
    'trackingCategory' : 'Department', // optional tracking category - if you provide one, you must also provide the option to use:
    'trackingCategoryOption' : 'Systems', // optional tracking option to apply to line items
    'oauth' : {
      'client': {
        'id': 'abcfdefghijklmnop', // your FreeAgent app OAuth identifier
        'secret': '123ghjk4567jkhabbja', // your FreeAgent app OAuth secret
        'rsaKey': 'keyfilename.pem' // filename of your private key, assumes repo / app root is location
      }
    }
  }
}
```

### `accounts.json`

In this example the accounts data file is `accounts.json` because we have specified '`accounts`' as the filename above under our AWS config. If we had placed `foo` in the `accountsFile` option above, this file would be named `foo.json`.

```javascript
/*
 * Gitignored list of accounts to generate invoices for.
 *
 * Xero uses ISO currency codes: https://www.xe.com/iso4217.php
 *
 * AWS      : the AWS account number to bill or null if not an Organizations account
 * contact  : the Xero GUID of the contact record for the same organisation
 * currency : the 3 letter ISO currency code
 * VAT      : either false or a decimal for the sales tax rate, e.g. 1.2 for 20%
 * EU       : boolean to say whether organisation is EC area or not
 * PO       : optional Purchase Order number to be included as a reference
 *
 * Note, you need to remove this doc block and the inline comments if you use this as a template.
 */

{
  'Customer1' : {
    'AWS'      : 'XXXXXXXXXXXX',
    'contact'  : '1abc234a-b56c-123a-1a23-423b9729e7a9',
    'currency' : 'GBP', // billing in GBP, so we will run a currency conversion
    'VAT'      : 1.2, // customer will be charged 20% VAT
    'EU'       : false, // customer is not in the EC
    'PO'       : '12345678' // customer provided PO number
  },
  'Customer2' : {
    'AWS'      : 'XXXXXXXXiXXXX',
    'contact'  : '2def567x-b56c-123a-1a23-423b9729e7a9',
    'currency' : 'USD',
    'VAT'      : false, // customer will not be charged VAT
    'EU'       : true // invoice items will be marked as EC for VAT purposes
  }
}
```

## Usage

Once you've installed and configured Billder, the best way to run it is some kind of automated task, either from a continuous integration system (we use Jenkins for orchestration) or in cron on a \*nix server. The command, if you cloned Billder to /opt as suggested above, will look something like this:

```bash
php -f /opt/billder/index.php config
```

A monthly crontab entry might be to run Billder on the second day of each month (you want to be sure AWS has had time to complete your data) at 01:00AM server time, and it would look like this:

```bash
0 1 2 * *	root	php -f /opt/billder/index.php config
```

Note the `config` argument passed to our script, this is obligatory and it is the filename of our configuration file. By making it an argument, you can have multiple instances of Billder running for different AWS accounts with different config files. Our example assumes the config file is `config.json` and so we pass `config` as the filename to the script.

Billder also supports being passed a month to generate invoices for in the form of 'YYYY-MM', e.g. `2017-11`. If you do not pass it a month to process, it will automatically use last month, so if you are in November 2017 it will create invoices for October 2017 (`2017-10`) by default. Passing Billder a month to process is as simple as this example, which will process June 2016:

```bash
php -f /opt/billder/index.php config 2016-06
```

And that's all there is to it!

## Developers

If you wish to add your own accountancy software as a software provider to this base project, you can [create a PR](https://github.com/codeenigma/billder/compare). The structure for multiple providers is not yet decided, this is not yet 'proper' object oriented PHP code, when it is we'll provide some classes you can extend and override.

Note, you can also add elements to `config.json` and `accounts.json` above, but please provide a patch for this README as well if you do.

`PROVIDERNAME` will become the 'provider' element in the 'config' object in `config.json`.

## Roadmap

* Add a note to Xero invoices
* Assign line items to projects automatically (request raised with Xero about this, not currently supported by the API)
* Base currency configuration
* Other providers!
