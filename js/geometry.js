var Geometry = OZ.Class();

Geometry.prototype.init = function() {
	this._id = Math.random().toString().replace(/\./g, "");
	this._xhr = null;
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

Geometry.prototype._showJoin = function() {
	this._playing = false;
	this._players = {};
	this._canvas.deleteOldData();
	this._dom.game.style.display = "none";
	this._dom.join.style.display = "";
}

Geometry.prototype._showGame = function() {
	this._playing = true;
	this._dom.join.style.display = "none";
	this._dom.game.style.display = "";
}

Geometry.prototype._join = function(nick, color, length, game) {
	this._request("join", {nick:nick, color:color, game:game, length:length});
}

Geometry.prototype._play = function(data) {
	this._request("play", {data:data});
}

Geometry.prototype._results = function() {
	this._request("results", {});
}

Geometry.prototype._request = function(method, data) {
	if (this._xhr) { this._xhr.abort(); }
	var arr = ["id=" + encodeURIComponent(this._id)];
	for (var p in data) { arr.push(p + "=" + encodeURIComponent(data[p])); }
	this._xhr = OZ.Request(method, this._response.bind(this), {method:"post", xml:true, data:arr.join("&")});
}

Geometry.prototype._response = function(xmlDoc, status) {
	this._xhr = null;
	if (status != 200) { return this._error("http/"+status+" FIXME"); }
	if (!xmlDoc) { return this._error("no xml FIXME"); }
	
	var nodes = xmlDoc.documentElement.childNodes;
	if (!nodes.length) { return; }
	
	for (var i=0;i<nodes.length;i++) {
		var node = nodes[i];	
		switch (node.nodeName) {
			case "error": 
				this._error(node.firstChild.nodeValue); 
			break;
			case "gameinfo": 
				this._gameInfo(node);
			break;
			case "gameresults": 
				this._gameResults(node);
			break;
		}
	}
	
}

Geometry.prototype._error = function(reason) {
	alert(reason);
}

Geometry.prototype._gameInfo = function(node) {
	if (!this._playing) { 
		this._showGame(); 
		this._canvas.listen();
	}

	OZ.$("game-title").innerHTML = "Playing in '" + node.getAttribute("name") + "':";
	OZ.DOM.clear(this._dom.players);

	var players = node.getElementsByTagName("player");
	var oldPlayers = {};
	for (var id in this._players) { oldPlayers[id] = true; }
	
	for (var i=0;i<players.length;i++) {
		var player = players[i];
		var id = player.getAttribute("id");
		delete oldPlayers[id];
		if (!(id in this._players)) { this._players[id] = 0; }
		
		var text = player.getAttribute("nick") + " (" + this._players[id] + ")";
		
		var li = OZ.DOM.elm("li", {innerHTML:text, color:player.getAttribute("color")});
		this._dom.players.appendChild(li);
	}
	
	for (var id in oldPlayers) { delete this._players[id]; }
	this._timerStop();
	
	var now = parseInt(node.getAttribute("now"));
	var ts = parseInt(node.getAttribute("ts"));
	var diff = (ts-now) * 1000;
	this._ts = new Date().getTime() + diff;
	this._timer = setInterval(this._timerStep.bind(this), 100);
}

Geometry.prototype._gameResults = function(node) {
	var colors = {};
	var info = node.ownerDocument.getElementsByTagName("gameinfo")[0];
	var players = info.getElementsByTagName("player");
	for (var i=0;i<players.length;i++) {
		var player = players[i];
		var id = player.getAttribute("id");
		if (!(id in this._players)) { this._players[id] = 0; }
		colors[id] = player.getAttribute("color");
	}
	
	var results = {};
	var moves = node.getElementsByTagName("move");
	for (var i=0;i<moves.length;i++) {
		var move = moves[i];
		var data = JSON.parse(move.getAttribute("data")); 
		var id = move.getAttribute("id_player");
		
		results[id] = {
			color: colors[id],
			move: data,
			lost: false,
			score: this._canvas.length(data[0])
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

	if (moves.length > 1) { /* scoring only for >1 players */
		for (var id in results) {
			this._players[id] += results[id].score;
		}
	}

	this._canvas.showResults(results);
	this._canvas.listen();
}

Geometry.prototype._clickLeave = function(e) {
	this._timerStop();
	this._request("leave");
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

	this._canvas.setColor(color);
	this._join(nick, color, length, game);
}

Geometry.prototype._timerStep = function() {
	var ts = new Date().getTime();
	var diff = this._ts - ts;
	
	if (diff < 0) {
		this._timerStop();
		this._results();
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
	this._play(JSON.stringify(data));
}

/**
 * Is a line blocked by a circle? (intersection)
 */
Geometry.prototype._blocks = function(line, center) {
	var dist = Math.abs(line[0]*center[0] + line[1]*center[1] + line[2]);
	dist /= Math.sqrt(line[0]*line[0] + line[1]*line[1]);
	return dist <= this._radius;
}
