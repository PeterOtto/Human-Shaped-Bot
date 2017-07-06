console.log("The twitter bot is starting");

// importing twit node module
var Twit = require('twit')
// importing the firebase node module
var firebase = require('firebase');
//importing the config file for the twitter api
var twitterConfig = require('./twitterConfig');
//importing the config file for the firebase db
var firebaseConfig = require('./firebaseConfig');
//sets up a new instence of Twit called T
var T = new Twit(twitterConfig);
//setting up a new instance of firebase, called app - for now
var app = firebase.initializeApp(firebaseConfig);
// creates a var called stream, where we store data from the twitter stream
var stream = T.stream("user");
//when we recieve a tweet on the stream send the data to tweetReceived
stream.on("tweet", tweetReceived)
// Get a reference to the database service
var database = firebase.database();
//Random greeting to prevent twitter for blocking duplicate tweets
var greetings = ["Hello","Hi","G’day","Howdy","Hey","Ciao","Aloha","Salut","Hej"];

//function for handeling the data that we recive from the tweet
function tweetReceived(eventMsg) {
	// if tweet is send @NotHumanShaped do stuff
	var replyto = eventMsg.in_reply_to_screen_name;
	if (replyto === "NotHumanShaped") {
		var greeting = greetings[Math.floor(Math.random() * greetings.length)];
		//get the user name of the person tweeting us
		var from = eventMsg.user.screen_name;
		if (eventMsg.geo != null && eventMsg.entities.media != null) {
			//save the data
			var text = eventMsg.text;
			var location = eventMsg.geo.coordinates;
			var place = eventMsg.place.bounding_box.coordinates;
			var cityName = eventMsg.place.name;
			var img = eventMsg.entities.media[0].media_url_https;
			console.log(img);
			saveDataFromTweet(text, from, place, location, cityName, img);
			//reply to the person
			replyToUser(from, "Thanks for sharing that with me, I've add it to our website.");
		}

		if (eventMsg.geo === null && eventMsg.entities.media) {
			replyToUser(from, greeting + ", you forgot to share your location with me");
		}

		if (!eventMsg.entities.media && eventMsg.geo != null) {
			replyToUser(from, greeting + ", you forgot to share a photo width me");
		}
		
		if (eventMsg.geo === null && !eventMsg.entities.media) {
			replyToUser(from, greeting + ", if you see something not human shaped please send me a photo, with a description and your location.");
		}
	}
}

function saveDataFromTweet(text, from, place, location, cityName, img) {
	//here we'll be saving all the data	
	firebase.database().ref('users/' + from).set({
		"text": text,
		"img": img,
		"location" : {
	        "lat" : location[0],
	        "lng" : location[1]
      	},
		"city": cityName
  	});
}

function replyToUser(tweetTo, messageToTweet) {
	// Here we'll be replying to people tweeting at us (the bot)
	console.log("preparing tweet");
	var newTweet = "@" + tweetTo + " " + messageToTweet;

	var tweetToSend = {
		status: newTweet
	}
	console.log("Sending tweet");
	T.post("statuses/update", tweetToSend, tweeted);

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