
/*
 * Pull together the options to send to 'request'.
 */

module.exports = {

  build_request_options(endpoint='https://api.freeagent.com', path='/v2/company', access_token_file='/tmp/fa-access-token.txt', request_method='POST', data=null) {

    var options = {
      url: endpoint + path,
      followAllRedirects: true,
      method: request_method,
      headers: {
        'User-Agent': 'request',
      }
    }
    if (data) {
      console.log(data);
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

