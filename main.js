var net = require('net');
var JsonSocket = require('json-socket');
request = require('request-json');
var client = request.createClient('http://127.0.0.1:7076/');

var port = 7077;
var server = net.createServer();

server.listen(port);

var clients = [];

server.on('connection', function(socket) {
    socket = new JsonSocket(socket);
	clients.push(socket);
    socket.on('message', function(r) {
		if (r.requestType == "getBlocksCount") {
			var data = {
			  "action": "block_count"
			};
			client.post('/', data, function(err, res, body) {
			  broadcastMessage({type: "BlocksCount", count: body.count});
			});
		}
    });
	socket.on('error', () => console.log('socket error'));
});

function broadcastMessage(message) {
    clients.forEach(function (cli) {
      cli.sendMessage(message);
    });
    console.log(message);
}

function updateBlocks() {
	var data = {
	  "action": "block_count"
	};
	client.post('/', data, function(err, res, body) {
		broadcastMessage({type: "BlocksCount", count: body.count});
	});
}
setInterval(updateBlocks, 500);

console.log("RaiLightServer is listening in port 7077.");