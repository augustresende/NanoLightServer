//Set variables
var net = require('net');
var JsonSocket = require('json-socket');
request = require('request-json');
var BigNumber = require('bignumber.js');
var clients = [];
var blocks;
var clientsbal = [];

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
		// If request = getBlocksCount
		if (r.requestType == "getBlocksCount") {
			var data = {"action": "block_count"};
			raid.post('/', data, function(err, res, body) {
			  socket.sendMessage({type: "BlocksCount", count: body.count});
			});
		}
		// If request = getBalance
		if (r.requestType == "getBalance") {
			var data = {"action": "account_balance","account": r.address};
			raid.post('/', data, function(err, res, body) {
			  balance = new BigNumber(body.balance).plus(body.pending);
			  socket.sendMessage({type: "Balance", balance: balance});
			});
		}
		// If request = getInfo
		if (r.requestType == "getInfo") {
			var data = {"action": "account_info", "account": r.address, "representative": "true", "weight": "true", "pending": "true"}
			raid.post('/', data, function(err, res, body) {
			  socket.sendMessage({type: "Info", balance: body.balance, pending: body.pending, block_count: body.block_count, representative: body.representative});
			});
		}
		// If request = getHistory
		if (r.requestType == "getHistory") {
			var data = {"action": "account_history", "account": r.address, "count": r.count}
			raid.post('/', data, function(err, res, body) {
			  socket.sendMessage({type: "History", history: body.history});
			});
		}
		// If request = getChain
		if (r.requestType == "getChain") {
			//console.log(r);
			var data = {"action": "account_history", "account": r.address, "count": r.count}
			raid.post('/', data, function(err, res, body) {
			  var hashes = [];
			  if(body.history.length > 0){   
				body.history.forEach(function(val, key){
				  hashes.push(val.hash);
				});
				var data = {"action": "blocks_info", "hashes": hashes}
				raid.post('/', data, function(err, res, body) {
				  socket.sendMessage({type: "Chain", blocks: body.blocks});
				});
			  } else {
				  socket.sendMessage({type: "Chain", blocks: false});
			  }
			});
		}
		// If request = getPendingBlocks
		if (r.requestType == "getPendingBlocks") {
			if (typeof r.threshold == 'undefined') { r.threshold = 1000000000000000000; }
			if (typeof r.source == 'undefined') { r.source = true; }
			var data = {"action": "accounts_pending", "accounts": r.addresses, "threshold": r.threshold, "source": r.source}
			raid.post('/', data, function(err, res, body) {
			  socket.sendMessage({type: "PendingBlocks", blocks: body.blocks});
			});
		}
		// If request = processBlock
		if (r.requestType == "processBlock") {
			console.log("processing a block");
			var data = {"action": "process", "block": r.block}
			console.log(data);
			raid.post('/', data, function(err, res, body) {
			  if (typeof body.error == 'undefined') {
			    socket.sendMessage({type: "processResponse", status: true, hash: body.hash});
				console.log("sucess");
			  } else {
				socket.sendMessage({type: "processResponse", status: false});
				console.log(body.error);
			  }
			});
		}
		// If request = registerAddresses
		if (r.requestType == "registerAddresses") {
			if (r.addresses) {
				console.log("registered");
				updateAddresses(socket, r.addresses);
			}

		}
		
    });
	socket.on('error', function(){
		clients.pop(socket);
		clientsbal[socket] = false;
		console.log("down");
		
	});
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
			if (typeof body.count == 'undefined') { body.count = 0; }
			broadcast({type: "BlocksCount", count: body.count});
			blocks = body.count;
		}
	});
}
setInterval(updateBlocks, 250);

function updateAddresses(socket, addresses) {
  var data = {"action": "accounts_balances","accounts": addresses};
	raid.post('/', data, function(err, res, body) {
	  
		for(let address in body['balances']){
			if (typeof clientsbal[socket] == 'undefined') { clientsbal[socket] = []; }
			balance = new BigNumber(body['balances'][address]['balance']).plus(body['balances'][address]['pending']);
			if (clientsbal[socket][address] != balance.toNumber()) {
				clientsbal[socket][address] = balance.toNumber();
				socket.sendMessage({type: "balanceUpdate", address: address, balance:balance});
			}
			
		}
		if (clientsbal[socket] === false) {
			for(let address in body['balances']){
				delete clientsbal[socket][address];
			}
			delete clientsbal[socket];
			return;
		}
		setTimeout(function(){updateAddresses(socket, addresses);}, 250);
		
	});

};

console.log("RaiLightServer is listening in port 7077.");