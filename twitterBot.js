console.log("The twitter bot is starting");

var Twit = require('twit')
var config = require('./config')

var T = new Twit(config);

T.post('statuses/update', { status: 'hello world!' }, function(err, data, response) {
  console.log(data)
})