
/**
 * Handle refreshing of FreeAgent access tokens.
 */

const simpleOauthModule = require('simple-oauth2');
var syslog = require('modern-syslog');

// Set the configuration settings
const config = require('../config.js');
var credentials = {};
credentials['client'] = config.client;
credentials['auth'] = config.auth;

module.exports = {

  /*
   * Refresh an OAuth access token
   * @param {String} access_token_file, path to file we write the token in
   */
  refresh_oauth_token(access_token_file='/tmp/fa-access-token.txt') {
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
      fs.writeFile(access_token_file, result.token.access_token, function(err) {
        if(err) {
          syslog.warn('Billder: ERROR - could not get a new access token');
          return syslog.warn(err);
          console.log('Billder: ERROR - could not get a new access token');
        }

        syslog.notice("Billder: token %s was saved to disk in file %s", result.token.access_token, access_token_file);
        console.log("Billder: token %s was saved to disk in file %s", result.token.access_token, access_token_file);
      })

    });
  }

}
