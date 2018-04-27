
/**
 * Handle refreshing of FreeAgent access tokens.
 */

const simpleOauthModule = require('simple-oauth2');
var syslog = require('modern-syslog');

module.exports = {

  /*
   * 'authenticate()' is an abstract name. In the context of FreeAgent
   * we are referring to the refresh of an OAuth access token.
   * @param {Object} config, configuration data
   * @param {String} access_token_file, path to file we write the token in
   */
  authenticate(config, access_token_file='/tmp/fa-access-token.txt') {
    // Set the configuration settings
    var credentials = {};
    credentials['client'] = config.provider.oauth.client;
    credentials['auth'] = config.provider.oauth.auth;

    syslog.notice('Billder: refreshing OAuth access token');
    console.log('Billder: refreshing OAuth access token');

    // Initialize the OAuth2 Library
    const oauth2 = simpleOauthModule.create(credentials);

    // Sample of a JSON access token (you got it through previous steps)
    var tokenObject = {};
    tokenObject['refresh_token'] = config.provider.oauth.refresh_token;

    // Create the access token wrapper
    let refreshToken = oauth2.accessToken.create(tokenObject);

    // Callbacks
    refreshToken.refresh((error, result) => {

      var fs = require('fs');
      fs.writeFile(access_token_file, result.token.access_token, function(err) {
        if(err) {
          console.log('Billder: ERROR - could not get a new access token');
          syslog.warn('Billder: ERROR - could not get a new access token');
          syslog.warn(err);
          process.exit(1);
        }

        syslog.notice("Billder: token %s was saved to disk in file %s", result.token.access_token, access_token_file);
        console.log("Billder: token %s was saved to disk in file %s", result.token.access_token, access_token_file);
      })

    });
  }

}
