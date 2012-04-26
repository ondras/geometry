#!/usr/bin/env v8cgi

var GS = function(ws) {
	this._ws = ws;
	this._games = {}; /* game structures */
	this._moves = {}; /* client to move mapping */
}

GS.prototype.path = "/geometry";

GS.prototype.onmessage = function(client, data) {
	data = JSON.parse(data);
	var type = data.type;
	system.stdout.writeLine("[message] " + type + " from " + client);
	
	switch (type) {
		case "join":
			this._join(client, data);
		break;
		case "leave":
			this._leave(client);
		break;
		case "play":
			this._play(client, data);
		break;
	}
}

GS.prototype.ondisconnect = function(client, code, message) {
	this._leave(client);
}

GS.prototype.onidle = function() {
	var ts = Date.now();
	for (var name in this._games) {
		var game = this._games[name];
		if (ts > game.ts) { /* finish round */
			this._gameResults(name);
			game.ts = ts + 1000*game.length;
			this._gameInfo(name);
		}
	}
}

GS.prototype._debug = function(str) {
	system.stdout.writeLine(str);
}

GS.prototype._join = function(client, data) {
	var game = data.game;
	var name = data.name;
	
	if (game in this._games) { /* check name */
		if (name in this._games[game].players) {
			this._send(client, "error", {error:"Duplicate player name"});
			return;
		}
	} else {
		this._debug("[join] creating game " + game);
		this._games[game] = {
			ts: Date.now() + 1000*data.length,
			players: {},
			length: data.length
		}
	}
	
	var g = this._games[game];
	g.players[name] = {
		client: client,
		color: data.color
	}
	
	this._gameInfo(game);
}

GS.prototype._leave = function(client) {
	this._debug("[leave] removing "+client);
	for (var name in this._games) { /* delete from game */
		var players = this._games[name].players;

		for (var playerName in players) {
			var playerData = players[playerName];
			if (playerData.client == client) {
				delete players[playerName]; 
				var count = 0;
				for (var playerName in players) { count++; }
				if (!count) {  /* empty game */
					this._debug("[leave] removing empty game " + name);
					delete this._games[name]; 
				}
			}
		}
	}
	
	if (client in this._moves) { delete this._moves[client]; } /* delete from moves */
}

GS.prototype._send = function(client, type, data) {
	data.type = type;
	data = JSON.stringify(data);
	this._ws.send(client, data);
}

GS.prototype._gameInfo = function(gameName) {
	var game = this._games[gameName];
	var data = {name:gameName, players:{}, now:Date.now(), ts:game.ts};
	
	var clients = [];
	
	for (var name in game.players) {
		var player = game.players[name];
		data.players[name] = player.color;
		clients.push(player.client);
	}
	
	for (var i=0;i<clients.length;i++) {
		var client = clients[i];
		this._send(client, "gameinfo", data);
	}
}

GS.prototype._gameResults = function(gameName) {
	this._debug("[gameResults] finishing round in " + gameName);
	var game = this._games[gameName];
	var data = {moves:{}};
	
	var clients = [];
	
	for (var name in game.players) {
		var player = game.players[name];
		var client = player.client;
		clients.push(client);
		
		if (client in this._moves) {
			data.moves[name] = this._moves[client];
			delete this._moves[client];
		}
	}
	
	for (var i=0;i<clients.length;i++) {
		var client = clients[i];
		this._send(client, "gameresults", data);
	}
}

GS.prototype._play = function(client, data) {
	this._debug("[play] client " + client + " plays " + JSON.stringify(data));
	if (client in this._moves) { return; } /* already played */
	this._moves[client] = data.data;
}


var Server = require("websocket").Server;
var ws = new Server("0.0.0.0", 8888);
ws.addApplication(new GS(ws));
ws.run();
