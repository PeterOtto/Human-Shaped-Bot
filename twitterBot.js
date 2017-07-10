//logging that the bot is starting
console.log("The twitter bot is starting");

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

/*-------------------------------------------------------------------------------------------

	This section is for handeling and replaying to people tweeting directly @NotHumanShaped

-------------------------------------------------------------------------------------------*/
//Random greeting to prevent twitter for blocking duplicate tweets
var greetings = ["Hello","Hi","G’day","Howdy","Hey","Ciao","Aloha","Salut","Hej"];
// creates a var called stream, where we store data from the twitter stream
var stream = T.stream("user");
//when we recieve a tweet on the stream send the data to tweetReceived
stream.on("tweet", tweetReceived);

//function for handeling the data that we recive from the tweet
function tweetReceived(eventMsg) {
	// if tweet is send @NotHumanShaped do stuff
	var replyto = eventMsg.in_reply_to_screen_name;
	if (replyto === "NotHumanShaped") {
		var greeting = greetings[Math.floor(Math.random() * greetings.length)];
		//get the user name of the person tweeting us
		var from = eventMsg.user.screen_name;
		//If they have shared their location and a photo we'll continue - or else we'll send them an error.
		if (eventMsg.geo != null && eventMsg.entities.media != null) {
			//save the data
			var text = eventMsg.text;
			var location = eventMsg.geo.coordinates;
			var place = eventMsg.place.bounding_box.coordinates;
			var cityName = eventMsg.place.name;
			var img = eventMsg.entities.media[0].media_url_https;
			saveDataFromTweet(text, from, place, location, cityName, img);
			//reply to the person
			replyToUser(from, "Thanks for sharing that with me, I've add it to our website.");
		}
		
		/*
		This could be done a lot smarter, with setting some flags, but for now we'll just be doing it with if statements instead haha!
		*/

		//check to see if they have shared their location with the bot
		if (eventMsg.geo === null && eventMsg.entities.media) {
			//reply with reminder to set location
			replyToUser(from, greeting + ", you forgot to share your location with me");
		}
		//check to see if they have shared a photo with the bot
		if (!eventMsg.entities.media && eventMsg.geo != null) {
			//reply with reminder to share a photo
			replyToUser(from, greeting + ", you forgot to share a photo width me");
		}
		// If they haven't shared anything - we make the assumption that it's the first time that they write the bot
		if (eventMsg.geo === null && !eventMsg.entities.media) {
			//reply with an intro to the bot
			replyToUser(from, greeting + ", if you see something not human shaped please send me a photo, with a description and your location.");
		}
	}
}

/*-------------------------------------------------------------------------------

	This section is for handeling tweets with the #nothumanshaped and replaying

--------------------------------------------------------------------------------*/

var stream = T.stream('statuses/filter', { track: 'nothumanshaped,humanshapedworld,' })

stream.on('tweet', hashtagFound);
function hashtagFound(tweet) {
	console.log("We got a tweet");
	for (var i = tweet.entities.hashtags.length - 1; i >= 0; i--) {
		// Geocode the hashtags.
		googleMapsClient.geocode({address: tweet.entities.hashtags[i].text},
		function(err, response) {
			if (!err && response.json.status === "OK") {
				console.log("Valid tweet found!")
		  		validTweet(response,tweet);
		  	}
		});
	}
}

function validTweet(response,tweet) {
	console.log("running validTweet function");
	
	var from = tweet.user.screen_name;
	var text = tweet.text;
	var location = [response.json.results[0].geometry.location.lat, response.json.results[0].geometry.location.lng];
	var place = "na";
	var cityName = response.json.results[0].formatted_address;
	var img = tweet.entities.media[0].media_url_https;
	saveDataFromTweet(text, from, place, location, cityName, img);
	console.log("Saveing data");
}

// Here we push the data to firebase
// Eventually we want to store multiple tweets from the same user.
// We also want to store some more info on them, profile pic, link, mail etc for the website
function saveDataFromTweet(text, from, place, location, cityName, img) {
	//here we'll be saving all the data	under users -> their twitter handle
	firebase.database().ref('users/' + from).set({
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