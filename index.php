<?php
require_once 'vendor/autoload.php';

use Aws\CostExplorer\CostExplorerClient;
use XeroPHP\Models\Accounting\Invoice;
use XeroPHP\Models\Accounting\InvoiceReminder;
use XeroPHP\Models\Accounting\Invoice\LineItem;
use XeroPHP\Models\Accounting\Contact;
use XeroPHP\Application\PrivateApplication;

//define('DS', DIRECTORY_SEPARATOR);
//define('APP_ROOT', realpath(__DIR__ . DS . '..' . DS));
define('APP_ROOT', realpath(__DIR__));

/**
 * Helper function for quick logging.
 *
 * @param $message string
 * The log message.
 *
 * @param $log_level mixed
 * The system log level for syslog.
 * Set to NULL to not log to syslog.
 **/
function log_output($message, $log_level = LOG_INFO, $to_screen = TRUE) {
  if ($to_screen) {
    echo "Billder: " . $message . "\n";
  }
  if ($log_level) {
    syslog($log_level, "Billder: " . $message);
  }
}


############################################
# SETUP

// Parse incoming cli arguments
if (count($argv) < 2) {
  log_output("Not enough arguments!", LOG_ALERT);
  exit(1);
}
else {
  array_shift($argv);
}

// See if a month was provided and set a default if not.
if (isset($argv[1])) {
  log_output("Received a month to process: " . $argv[1]);
  $target_month = $argv[1];
}
else {
  $month = date('m');
  $year = date('Y');
  if ((string)$month == "01") {
    $month = "12";
    $year = (int)$year - 1;
  }
  else {
    $month = (int)$month -1;
    if (strlen($month) < 2) {
      $month = "0" . (string)$month;
    }
  }
  $target_month = (string)$year . "-" . (string)$month;
  log_output("Did not receive a month to process, using default month: " . $target_month);
}

// Load the config file
$config_path = APP_ROOT . "/" . $argv[0] . ".json";
if ($config_file = fopen($config_path, "r")) {
  $config = json_decode(fread($config_file, filesize($config_path)));
  fclose($config_file);
  log_output("Successfully loaded config file: " . $config_path);
}
else {
  log_output("Could not open file: " . $config_path, LOG_ALERT);
  exit(1);
}

// Load the accounts file
$accounts_path = APP_ROOT . "/" . $config->aws->accountsFile . ".json";
if ($accounts_file = fopen($accounts_path, "r")) {
  $accounts = json_decode(fread($accounts_file, filesize($accounts_path)));
  fclose($accounts_file);
  log_output("Successfully loaded accounts file: " . $accounts_path);
}
else {
  log_output("Could not open file: " . $accounts_path, LOG_ALERT);
  exit(1);
}





################################
# AWS

# Instantiate the CostExplorerClient class with our credentials
$billing = new CostExplorerClient([
  'version'     => 'latest',
  'region'      => $config->aws->region,
  'credentials' => [
    'key'    => $config->aws->key,
    'secret' => $config->aws->secret,
  ],
]);


// Looping through accounts
foreach ($accounts as $client => $data) {

  // Currency look-up
  if ($data->currency != 'USD') {
    $curl = new Curl\Curl();
    $curl->get('https://frankfurter.app/current', array(
      'from' => 'USD',
      'to' => $data->currency,
    ));
    if ($curl->error) {
      log_output("Problem with currency API", LOG_ALERT);
      log_output("API output: " . $curl->error_code, LOG_ALERT);
      exit(1);
    }
    else {
      $currency_data = json_decode($curl->response);
      // Stash exchange rate in the $accounts object
      $accounts->$client->exchange_rate = $currency_data->rates->{$data->currency};
      log_output("Currency for $client set to: " . $currency_data->rates->{$data->currency});
    }
  }
  else {
    $accounts->$client->exchange_rate = 1;
    log_output("Currency for $client already USD, rate set to 1");
  }


  # Get a billing report
  $billing_data = $billing->getCostAndUsage([
    'Filter' => [
      'Dimensions' => [
        'Key' => 'LINKED_ACCOUNT',
        'Values' => [$data->AWS],
      ],
    ],
    'Granularity' => 'MONTHLY',
    'GroupBy' => [
      /**
       * USAGE_TYPE / OPERATION don't show EC2 usage
       * PURCHASE_TYPE shows billing but no breakdown
       * PLATFORM shows only EC2 usage (by EC2 platform type)
       * SERVICE looks like the correct grouping!
       */
      [
        'Key' => 'SERVICE',
        'Type' => 'DIMENSION', // can be TAG or DIMENSION
      ],
    ],
    'Metrics' => array('UnblendedCost'),
    'TimePeriod' => [
      'Start' => $target_month . '-01',
      'End'   => $target_month . "-" . date('t',strtotime($target_month)),
    ],
  ]);
  // Stash billing data in the $accounts object
  $accounts->$client->billing_data = $billing_data['ResultsByTime'][0];
  // Just tot things up and log, for safety
  $total = 0;
  foreach ($billing_data['ResultsByTime'][0]['Groups'] as $subtotals) {
    $total = $total + (float)$subtotals['Metrics']['UnblendedCost']['Amount'];
  }
  log_output("Total to bill from AWS for $client is: $" . round($total, 2));
}





###########################
# XERO

$xero_config = [
  'oauth' => [
    'callback'        => 'http://localhost/', // not really needed for a private app
    'consumer_key'    => $config->provider->oauth->client->key,    // get from Xero developer portal
    'consumer_secret' => $config->provider->oauth->client->secret, // get from Xero developer portal
    'rsa_private_key' => 'file://' . APP_ROOT . '/' . $config->provider->oauth->client->rsaKey, // self-signed - upload public part to Xero developer portal
  ],
  //'curl' => [
  //  CURLOPT_USERAGENT   => 'xero-php sample app',
  //  CURLOPT_CAINFO => __DIR__ . '/certs/ca-bundle.crt',
  //],
];

// Instantiate our application
log_output("Connecting to Xero");
$xero = new PrivateApplication($xero_config);

// Looping through accounts
foreach ($accounts as $client => $data) {

  // Build our line items
  // @TODO: there does not yet seem to be any way to add a line item to a project via the API
  // I have raised a ticket with Xero to find out
  log_output("Building line items for $client");
  $line_items = array();
  foreach ($data->billing_data['Groups'] as $aws_item) {
    $line_item = new LineItem($xero);
    // Do any currency calculation
    $line_item_value = round((float)$aws_item['Metrics']['UnblendedCost']['Amount'], 2);
    // If we're not including tax, zero that line so it gets ignored
    // @TODO: this would be better if we can filter it in the AWS call
    // See https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_Expression.html
    if (!(bool)$config->general->includeTax && $aws_item['Keys'][0] == 'Tax') {
      $line_item_value = 0;
    }
    // No need to create empty lines
    if ($line_item_value > 0) {
      // Convert the currency if necessary
      if ($data->exchange_rate != 1) {
        $line_item_value = $line_item_value * $data->exchange_rate;
      }
      // Handling VAT
      // See https://developer.xero.com/documentation/api/types#TaxTypes
      $tax_type = 'CAPEXOUTPUT2'; // default to 20% VAT on sales
      // @TODO: needs reviewing in light of Brexit
      if ($data->EU == TRUE) {
        $tax_type = 'ECZROUTPUTSERVICES'; // no VAT on EU services
        log_output("$client is in the EU and provided a VAT number, no VAT to be charged");
      }
      elseif ($data->VAT == FALSE) {
        $tax_type = 'NONE'; // customer VAT exempt (e.g. US-based businesses or UN body)
        log_output("$client is VAT exempt");
      }
      else {
        $line_item_value = $line_item_value * $data->VAT; // customer needs VAT adding to line item
      }
      // We cannot setTaxType if our incomeCategory assumes VAT
      // @TODO: we ought to check the tax settings of the AccountCode in config.json and react accordingly.
      if ($tax_type != 'CAPEXOUTPUT2') {
        $line_item->setTaxType($tax_type);
      }
      // Build the rest of the line item
      $line_item->setDescription($aws_item['Keys'][0])
          ->setQuantity(1)
          ->setAccountCode($config->provider->incomeCategory)
          ->setUnitAmount($line_item_value * $config->general->costPadding);
      $line_items[] = $line_item;
    }
  }

  // Build our invoice
  log_output("Building invoice for $client");
  $invoice = new Invoice($xero);
  // Load our contact
  $contact = $xero->loadByGUID(Contact::class, $data->contact);
  // Add our line items
  foreach ($line_items as $line_item) {
    $invoice->addLineItem($line_item);
  }
  // Optionally set a purchase order number
  if (isset($data->PO)) {
    $invoice->setReference($data->PO);
    log_output("Purchase order found and set to: $data->PO");
  }
  $invoice->setType('ACCREC')
      ->setCurrencyCode($data->currency)
      ->setLineAmountType('Exclusive')
      ->setDueDate(\DateTime::createFromFormat('Y-m-d', date('Y-m-d', strtotime("+30 days"))))
      ->setContact($contact);

  // Save the invoice
  $invoice->save();
  log_output("Invoice saved for $client with ID: " . $invoice->getInvoiceID());
}
