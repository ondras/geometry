var Geometry = OZ.Class();
Geometry.URL = "ws://" + location.hostname + ":8888/geometry";
Geometry.prototype.init = function() {
	this._socket = null;
	this._playing = false;
	this._timer = null;
	this._ts = 0; /* target timestamp */
	this._radius = 80;
	this._canvas = new Canvas(OZ.$("canvas"), 500, this._radius);
	this._players = {};
	
	this._dom = {
		join: OZ.$("join-content"),
		game: OZ.$("game-content"),
		players: OZ.$("players"),
		timer: OZ.$("timer")
	}
	
	OZ.Event.add(OZ.$("leave"), "click", this._clickLeave.bind(this));
	OZ.Event.add(OZ.$("join"), "click", this._clickJoin.bind(this));
	OZ.Event.add(this._canvas, "data-ready", this._dataReady.bind(this));
	
	var color = OZ.$("color");
	var options = color.getElementsByTagName("option");
	for (var i=0;i<options.length;i++) {
		var option = options[i];
		option.style.backgroundColor = option.value;
	}
	color.selectedIndex = Math.floor(Math.random()*options.length);
	
	this._showJoin();
}

Geometry.prototype._message = function(e) {
	var data = JSON.parse(e.data);
	switch (data.type) {
		case "error": 
			this._error(data.error); 
		break;
		case "gameinfo": 
			this._gameInfo(data);
		break;
		case "gameresults": 
			this._gameResults(data);
		break;
	}
}

Geometry.prototype._showJoin = function() {
	this._playing = false;
	this._players = {};
	this._canvas.deleteOldData();
	this._dom.game.style.display = "none";
	this._dom.join.style.display = "";
	OZ.$("url").value = this.constructor.URL;
}

Geometry.prototype._showGame = function() {
	this._playing = true;
	this._dom.join.style.display = "none";
	this._dom.game.style.display = "";
}

Geometry.prototype._send = function(type, data) {
	data.type = type;
	this._socket.send(JSON.stringify(data));
}

Geometry.prototype._error = function(reason) {
	alert(reason);
}

Geometry.prototype._gameInfo = function(data) {
	if (!this._playing) { 
		this._showGame(); 
		this._canvas.listen();
	}

	OZ.$("game-title").innerHTML = "Playing in '" + data.name + "':";
	OZ.DOM.clear(this._dom.players);

	var oldPlayers = {};
	for (var name in this._players) { oldPlayers[name] = true; }
	
	for (var name in data.players) {
		var color = data.players[name];
		delete oldPlayers[name];
		if (!(name in this._players)) { this._players[name] = {score:0, color:color}; }
		
		var text = name + " (" + this._players[name].score + ")";
		
		var li = OZ.DOM.elm("li", {innerHTML:text, color:color});
		this._dom.players.appendChild(li);
	}
	
	for (var name in oldPlayers) { delete this._players[name]; }
	this._timerStop();
	
	var now = parseInt(data.now);
	var ts = parseInt(data.ts);
	this._ts = new Date().getTime() + ts-now;
	this._timer = setInterval(this._timerStep.bind(this), 100);
}

Geometry.prototype._gameResults = function(data) {
	var results = {};
	var count = 0;
	for (var name in data.moves) {
		count++;
		var move = data.moves[name]; 
		
		results[name] = {
			color: this._players[name].color,
			move: move,
			lost: false,
			score: this._canvas.length(move[0])
		}
	}

	for (var id1 in results) {
		for (var id2 in results) {
			var line = results[id1].move[0];
			var center = results[id2].move[1];
			if (this._blocks(line, center)) { 
				results[id1].lost = true;
				results[id1].score = 0;
			}
		}
	}
	if (count > 1) { /* scoring only for >1 players */
		for (var name in results) {
			this._players[name].score += results[name].score;
		}
	}

	this._canvas.showResults(results);
	this._canvas.listen();
}

Geometry.prototype._clickLeave = function(e) {
	this._timerStop();
	this._send("leave", {});
	this._showJoin();
}

Geometry.prototype._clickJoin = function(e) {
	var nick = OZ.$("nick");
	var game = OZ.$("game");
	if (!nick.value) { return nick.focus(); }
	if (!game.value) { return game.focus(); }
	
	nick = nick.value;
	game = game.value;
	var color = OZ.$("color").value;
	var length = OZ.$("length").value;
	var url = OZ.$("url").value;

	this._canvas.setColor(color);
	this._joinData = {name:nick, color:color, game:game, length:length};

	this._socket = new (window.WebSocket || window.MozWebSocket)(url);
	OZ.Event.add(this._socket, "message", this._message.bind(this));
	OZ.Event.add(this._socket, "open", this._open.bind(this));
	OZ.Event.add(this._socket, "error", this._error.bind(this));
}

Geometry.prototype._open = function() {
	this._send("join", this._joinData);
}

Geometry.prototype._error = function() {
	alert("Websocket communication error");
}

Geometry.prototype._timerStep = function() {
	var ts = new Date().getTime();
	var diff = this._ts - ts;
	
	if (diff < 0) {
		this._timerStop();
	} else {
		var sec = Math.round(diff/1000);
		this._dom.timer.innerHTML = sec;
	}
}

Geometry.prototype._timerStop = function() {
	if (this._timer) {
		clearInterval(this._timer);
		this._timer = null;
	}
}

Geometry.prototype._dataReady = function(e) {
	var data = e.target.getData();
	this._send("play", {data:data});
}

/**
 * Is a line blocked by a circle? (intersection)
 */
Geometry.prototype._blocks = function(line, center) {
	var dist = Math.abs(line[0]*center[0] + line[1]*center[1] + line[2]);
	dist /= Math.sqrt(line[0]*line[0] + line[1]*line[1]);
	return dist <= this._radius;
}
