//Set variables
var net = require('net');
var JsonSocket = require('json-socket');
request = require('request-json');
var BigNumber = require('bignumber.js');
var clients = [];
var blocks;

//Settings
var port = 7077;
var rai_node_ip = "127.0.0.1";
var rai_node_port = "7076";

//Create server
var server = net.createServer();
server.listen(port);

//Create connection to rai_node
var raid = request.createClient('http://'+rai_node_ip+':'+rai_node_port);

//Handle connection
server.on('connection', function(socket) {
    socket = new JsonSocket(socket);
	clients.push(socket);
	//Handle request
    socket.on('message', function(r) {
		//If request = getBlocksCount
		if (r.requestType == "getBlocksCount") {
			var data = {"action": "block_count"};
			raid.post('/', data, function(err, res, body) {
			  socket.sendMessage({type: "BlocksCount", count: body.count});
			});
		}
		//If request = getBalance
		if (r.requestType == "getBalance") {
			var data = {"action": "account_balance","account": r.address};
			raid.post('/', data, function(err, res, body) {
			  balance = new BigNumber(body.balance).plus(body.pending);
			  socket.sendMessage({type: "Balance", balance: balance});
			});
		}
		//If request = getInfo
		if (r.requestType == "getInfo") {
			var data = {"action": "account_info", "account": r.address, "representative": "true", "weight": "true", "pending": "true"}
			raid.post('/', data, function(err, res, body) {
			  socket.sendMessage({type: "Info", balance: body.balance, pending: body.pending, block_count: body.block_count, representative: body.representative});
			});
		}
		if (r.requestType == "getPendingBlocks") {
			if (typeof r.threshold == 'undefined') { r.threshold = 1000000000000000000; }
			if (typeof r.source == 'undefined') { r.source = true; }
			var data = {"action": "accounts_pending", "accounts": r.addresses, "threshold": r.threshold, "source": r.source}
			raid.post('/', data, function(err, res, body) {
			  socket.sendMessage({type: "PendingBlocks", blocks: body.blocks});
			  console.log(body);
			});
		}
		
		if (r.requestType == "processBlock") {
			var data = {"action": "process", "block": r.block}
			console.log(data);
			raid.post('/', data, function(err, res, body) {
			  if (typeof body.error == 'undefined') {
			    socket.sendMessage({type: "processResponse", status: true, hash: body.hash});
			  } else {
				socket.sendMessage({type: "processResponse", status: false});
			  }
			  console.log(body);
			});
		}
		
    });
	socket.on('error', function(){});
});

function broadcast(message) {
    clients.forEach(function (cli) {
      cli.sendMessage(message);
    });
}

function updateBlocks() {
	var data = {"action": "block_count"};
	raid.post('/', data, function(err, res, body) {
		if (blocks != body.count) {
			broadcast({type: "BlocksCount", count: body.count});
			blocks = body.count;
		}
	});
}
setInterval(updateBlocks, 250);

console.log("RaiLightServer is listening in port 7077.");