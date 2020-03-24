
const SERVER_PORT = 8000
const PUBLISHER_KEY = process.env.AUTH_TOKEN

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

var fs = require('fs')
var http = require('http')

var express = require('express')
var app = express()

var server = http.createServer(app)
var io = require('socket.io').listen(server)

var redis = require('redis')
var ioredis = require('socket.io-redis')

io.adapter(ioredis({host: "redis", port: 6379}))


// Create client for the subscriber
var subscriber = redis.createClient("redis://redis:6379")

// Create a client for the publisher
var publisher = redis.createClient("redis://redis:6379")

subscriber.on('error', function (error) {
    console.log('An error occured: ' + error)
})

subscriber.on('subscribe', function (channel, count) {
    console.log('Subscribing to Redis channel: ' + channel + ' - Subscribers: ' + count)
})

// Whenever a message is received on channels to which we subscribe
subscriber.on('message', function (channel, payload) {
    console.log('Message received: ', channel, payload)

		// Send the mssage to clients
    io.sockets.in(channel).emit("messages.new", payload)
})



// Listener: Care for websocket connections
io.sockets.on('connection', function (socket) {
    console.log('Client connected..');

    socket.on('client-subscribe', function (data) {
        console.log('Subscribe to ' +  data)
        subscriber.subscribe(data)
        socket.join(data)
    })

    socket.on('disconnect', function () {
    	var ip = socket.handshake.address;
        console.log('Client disconnected ')
    })

})


// We will also implement a simple publisher to accept messages
// via HTTP and publish them
var bodyParser = require('body-parser');
app.use(bodyParser.json());

// Handle errors (invalid JSON)
// https://stackoverflow.com/questions/41693607/nodejs-express-validating-request-json-payload-on-server-to-check-json-is-not
app.use(function(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.log("Received bad JSON");
    res.status(500).send('JSON parse error');
  }
  next(err);
});

// Handle incoming requests
app.post('/in', function (req, res) {

  // https://stackoverflow.com/questions/23271250/how-do-i-check-content-type-using-expressjs/46018920
  var contype = req.headers['content-type'];
  if(!contype || contype.indexOf('application/json') !== 0) {
    return res.status(400).send("Bad Request. Content-Type must be application/json");
  }

  var authkey = req.get('X-Auth-Token');
  var body    = req.body;

  if(authkey == PUBLISHER_KEY) {
    console.log("Publishing payload: " + body.payload);
  	publisher.publish(body.channel, body.payload);
    res.send("Accepted");
  } else {
		res.send("Auth failed");
	}

});

// Listen for clients
server.listen(SERVER_PORT, function () {
    console.log('Listening on port ' + SERVER_PORT + ' Auth key: ', PUBLISHER_KEY);
})
