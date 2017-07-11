//logging that the bot is starting
console.log("The twitter bot has started");
console.log("---------------------------");
console.log("Ver. 0.1 by PeterOK");
console.log("");

/* ----- IMPORTING AND SETTING UP NODE MODULES ----- */

// importing twit node module
var Twit = require('twit')
// importing the firebase node module
var firebase = require('firebase');
//importing the config file for the twitter api
var twitterConfig = require('./config/twitterConfig.js');
//importing the config file for the firebase db
var firebaseConfig = require('./config/firebaseConfig.js');
//sets up a new instence of Twit called T
var T = new Twit(twitterConfig);
//setting up a new instance of firebase, called app - for now
var app = firebase.initializeApp(firebaseConfig);
// Get a reference to the database service
var database = firebase.database();
//setting up access to the google maps API
var googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyBbiaUFvlp2Skd7m4qm6FdBv0611rJbf-o'
});

/* ----- SETTING UP THE TWO STREAMS THAT LISTENS FOR HASHTAGS AND FOR TWEETS @NOTHUMANSHAPED ----- */

// opens up a stream that recieves data about the the twitter user
var twitterStream = T.stream("user");
//when we recieve a tweet on the stream send the data to tweetReceived
twitterStream.on("tweet", tweetReceived);
// opens up a stream that fires everytime somebody tweets a certain hashtag
var hashtagStream = T.stream('statuses/filter', { track: 'nothumanshaped,humanshapedworld,' })
hashtagStream.on('tweet', hashtagFound);

/* -----  THIS IS WEHERE WE PUT ALL THE DIFFERENT VARIABLES ----- */

//Random greeting to prevent twitter for blocking duplicate tweets
var greetings = ["Hello","Hi","G’day","Howdy","Hey","Ciao","Aloha","Salut","Hej"];
//booleans to test if it's a valid tweet
var botMentionted = false;
var botTweetedAt = false;
var botTagged = false;
var locationFound = false;
var hasImage = false;
var locatioTagged = true;
//info from tweets
var replyto;
var from;
var text;
var location;
var cityName;
var img;
//profile data
var name;
var url;
var profilePic;

/* -----  THIS SECTION IS FOR RECIEVING THE DATA AND CHECKING IF ALL THE DATA THAT WE'LL NEED IS THERE ----- */
//function for handeling the data that we recive from the tweet
function tweetReceived(eventMsg) {
	if (eventMsg.user.screen_name != "NotHumanShaped") {
		// if tweet is send @NotHumanShaped do stuff
		replyto = eventMsg.in_reply_to_screen_name;
		text = eventMsg.text;
		for (var i = eventMsg.entities.user_mentions.length - 1; i >= 0; i--) {
			if (eventMsg.entities.user_mentions[i].screen_name === "NotHumanShaped" || replyto === "NotHumanShaped" || from) {
				from = eventMsg.user.screen_name;
				botMentionted = true;

				if (eventMsg.geo != null) {
					locationFound = true;
					location = eventMsg.geo.coordinates;
					cityName = eventMsg.place.name;
				}

				if (eventMsg.place != null && eventMsg.geo == null) {
					locationFound = true;
					cityName = eventMsg.place.name;
					var tmpLng = 0;
					var tmpLat = 0;

					for (var k = 0; k < 4; k++) {
						tmpLng = eventMsg.place.bounding_box.coordinates[0][k][0] + tmpLng;
						tmpLat = eventMsg.place.bounding_box.coordinates[0][k][1] + tmpLat;
						location = [tmpLat/4, tmpLng/4];
					}
				}

				if (eventMsg.entities.media) {
					hasImage = true;
					img = eventMsg.entities.media[0].media_url_https;
				}
			}
		}

		if (typeof from != 'undefined'  && typeof text != 'undefined' && typeof location != 'undefined' && typeof cityName != 'undefined' && typeof img != 'undefined') {
			validTweet(eventMsg);
		} else {
			if (!locatioTagged) {
				invalidTweet();
			}
		}
	}
}

function hashtagFound(tweet) {
	botTagged = true;

	if (tweet.extended_entities.media) {
		hasImage = true;
		img = tweet.extended_entities.media[0].media_url_https;
	}

	for (var i = tweet.entities.hashtags.length - 1; i >= 0; i--) {
		// Geocode the hashtags.
		googleMapsClient.geocode({address: tweet.entities.hashtags[i].text},
		function(err, response) {
			if (!err && response.json.status === "OK" && !locationFound) {
				locationFound = true;
				location = [response.json.results[0].geometry.location.lat, response.json.results[0].geometry.location.lng];
				cityName = response.json.results[0].formatted_address;
				if (locationFound) {
					from = tweet.user.screen_name;
					tweetReceived(tweet);
				}
			} else {
				locatioTagged = false;
			}
		});
	}
}

function validTweet(eventMsg) {
	name = eventMsg.user.name;
	url = eventMsg.user.url;
	profilePic = eventMsg.user.profile_image_url_https;
	saveDataFromTweet();
	replyToUser(from, "Thanks for sharing that with me, I've add it to our website.");
}

function invalidTweet() {
	console.log("Invalid tweet recieved");
	var greeting = greetings[Math.floor(Math.random() * greetings.length)];
	if (!location && img) {
		replyToUser(from, greeting + ", looks like you forgot to share your location with me, either turn geo location on or tag the place.");
	}

	if (!img && location) {
		replyToUser(from, greeting + ", looks like you forgot to share a photo width me");
	}

	if (!img && !location) {
		replyToUser(from, greeting + ", have you see something not human shaped if so please send me a photo, with a description and your location.");
	}
}

/* -----  HERE WE PUSH EVERYTHING TO THE DATABASE ----- */
// Eventually we want to store multiple tweets from the same user.
// We also want to store some more info on them, profile pic, link, mail etc for the website
function saveDataFromTweet() {
	//here we'll be saving all the data	under users -> their twitter handle
	firebase.database().ref('users/' + from).set({
		"name": name,
		"user name": from,
		"url": url,
		"profile Picture": profilePic,
		"text": text,
		"img": img,
		"location" : {
	        "lat" : location[0],
	        "lng" : location[1]
      	},
		"city": cityName
  	});
	console.log("data saved");
}

function replyToUser(tweetTo, messageToTweet) {
	//setting everything to false
	botMentionted = false;
	botTweetedAt = false;
	botTagged = false;
	locationFound = false;
	hasImage = false;
	locatioTagged = true;
	// Here we'll be replying to people tweeting at us (the bot)
	console.log("preparing tweet");
	//putting togheter what'll be in the tweet
	var newTweet = "@" + tweetTo + " " + messageToTweet;
	//formatting it so twit and twitter understands it, hint JSON ;)
	var tweetToSend = {
		status: newTweet
	}
	//Logging it, just for fun
	console.log("Sending tweet");
	//posting the tweet
	T.post("statuses/update", tweetToSend, tweeted);
	//callacks to see if it worked or not
	function tweeted(err, data, response) {
		if (err) {
			console.log("Something went wrong!")
			console.log(data);
			console.log(response);
		} else {
			console.log("It worked!")
		}
	}
}