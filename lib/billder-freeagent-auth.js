
/**
 * Handle refreshing of FreeAgent access tokens.
 */

const simpleOauthModule = require('simple-oauth2');

// Set the configuration settings
const config = require('../config.js');
var credentials = {};
credentials['client'] = config.client;
credentials['auth'] = config.auth;

// Initialize the OAuth2 Library
const oauth2 = simpleOauthModule.create(credentials);

// Sample of a JSON access token (you got it through previous steps)
var tokenObject = {};
tokenObject['refresh_token'] = config.refresh_token;

// Create the access token wrapper
let refreshToken = oauth2.accessToken.create(tokenObject);

// Callbacks
refreshToken.refresh((error, result) => {

  var fs = require('fs');
  fs.writeFile("/tmp/fa-access-token.txt", result.token.access_token, function(err) {
    if(err) {
      return console.log(err);
    }

    console.log("Token %s was saved to disk.", result.token.access_token);
  })

});
