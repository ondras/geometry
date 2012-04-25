var Geometry = OZ.Class();

Geometry.prototype.init = function() {
	this._id = Math.random().toString().replace(/\./g, "");
	this._xhr = null;
	this._playing = false;
	this._timer = null;
	this._ts = 0; /* target timestamp */
	this._radius = 50;
	this._canvas = new Canvas(OZ.$("canvas"), this._radius);
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
	var ids = [];
	var moves = node.getElementsByTagName("move");
	for (var i=0;i<moves.length;i++) {
		var move = moves[i];
		var data = JSON.parse(move.getAttribute("data")); 
		var id = move.getAttribute("id_player");
		ids.push(id);
		
		results[id] = {
			color: colors[id],
			move: data,
			lost: [],
			score: 0
		}
		
		for (var j=0;j<data.length;j++) { results[id].lost.push(false); }
	}
	
	while (ids.length) {
		var id1 = ids.pop();
		for (var i=0;i<ids.length;i++) {
			var id2 = ids[i];
			this._computeScore(results, id1, id2);
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
 * Compute score comparing intersections of two sets of lines
 */
Geometry.prototype._computeScore = function(results, id1, id2) {
	var data1 = results[id1].move;
	var data2 = results[id2].move;
	
	var count1 = {};
	var count2 = {};
	
	for (var i=0;i<data1.length;i++) {
		count1[i] = 0; /* reset intersections for first player */
		for (var j=0;j<data2.length;j++) {
			if (!i) {count2[j] = 0; } /* reset intersections for second player */
			
			var line1 = [data1[i], data1[(i+1) % data1.length]];
			var line2 = [data2[j], data2[(j+1) % data2.length]];
			var intersects = this._doLinesIntersect(line1, line2);
			if (intersects) {
				count1[i]++;
				count2[j]++;
			}
		}
	}
	
	for (var num in count1) { /* one point for every >1 intersections of enemy line */
		if (count1[num] > 1) { 
			results[id1].lost[parseInt(num)] = true;
			results[id2].score++;
			this._players[id2]++;
		}
	}

	for (var num in count2) { /* one point for every >1 intersections of enemy line */
		if (count2[num] > 1) { 
			results[id2].lost[parseInt(num)] = true;
			results[id1].score++;
			this._players[id1]++;
		}
	}
}

/**
 * @returns {bool}
 */
Geometry.prototype._doLinesIntersect = function(line1, line2) {
	var L1 = [1, 1, 0];
	var L2 = [1, 1, 0];

	if (line1[0][0] == line1[1][0]) { L1[1] = 0; } else { L1[1] = (line1[0][0] - line1[1][0]) / (line1[1][1] - line1[0][1]); }
	L1[2] = -(L1[0]*line1[0][0] + L1[1]*line1[0][1]);
	
	if (line2[0][0] == line2[1][0]) { L2[1] = 0; } else { L2[1] = (line2[0][0] - line2[1][0]) / (line2[1][1] - line2[0][1]); }
	L2[2] = -(L2[0]*line2[0][0] + L2[1]*line2[0][1]);
	
	var x1 = L1[0]*line2[0][0] + L1[1]*line2[0][1] + L1[2];
	var x2 = L1[0]*line2[1][0] + L1[1]*line2[1][1] + L1[2];
	if (x1 * x2 >= 0) { return false; }
	
	var x1 = L2[0]*line1[0][0] + L2[1]*line1[0][1] + L2[2];
	var x2 = L2[0]*line1[1][0] + L2[1]*line1[1][1] + L2[2];
	if (x1 * x2 >= 0) { return false; }

	return true;
}
