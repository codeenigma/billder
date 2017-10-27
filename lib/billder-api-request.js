
/*
 * Some small helpers for making API requests.
 */

var syslog = require('modern-syslog');

module.exports = {
  /*
   * Pull together the options to sent to 'request'.
   * @param {String} host
   * @param {String} path, to intended service call
   * @param {String} access_token_file, location on disk for access token stored in file
   * @param {String} request_method
   * @param {Object} data, either an object request will transform to JSON or null
   * @return {Object} options object to be passed directly to request for an API call
   */
  build_request_options(host='https://api.freeagent.com', path='/v2/company', access_token_file='/tmp/fa-access-token.txt', request_method='POST', data=null) {

    var options = {
      url: host + path,
      followAllRedirects: true,
      method: request_method,
      headers: {
        'User-Agent': 'request',
      }
    }
    if (data) {
      syslog.debug('Billder: Object posted to API');
      syslog.debug(data);
      options.json = data;
      options.headers['Accept'] = 'application/json';
      options.headers['Content-Type'] = 'application/json';
    }
    if (access_token_file) {
      var fs = require('fs')
      var access_token = fs.readFileSync(access_token_file).toString();
      options.auth = {
        'bearer': access_token
      };
    }

    return options;
  }

}

