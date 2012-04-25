var Canvas = OZ.Class();

Canvas.prototype.init = function(node, radius) {
	this._size = [500, 500];
	node.width = this._size[0];
	node.height = this._size[1];
	this._radius = radius;

	this._ctx = node.getContext("2d");
	this._ctx.font = "50px georgia";
	this._ctx.textAlign = "center";
	this._ctx.textBaseline = "middle";

	this._data = [];
	this._cursor = null;
	this._color = "";
	this._results = null;
	this._oldData = [];
	
	this._instructions = OZ.$("instructions");
	this._ec = [];
}

Canvas.prototype.setColor = function(color) {
	this._color = color;
}

Canvas.prototype.showResults = function(results) {
	this._results = results;
	this._redraw();
	setTimeout(this._hideResults.bind(this), 5000);
}

Canvas.prototype.deleteOldData = function() {
	this._oldData = [];
}

/**
 * Listen for three clicks
 */
Canvas.prototype.listen = function() {
	if (this._ec.length) { return; }
	this._instructions.innerHTML = "Create your triangle by clicking three times into the canvas.";
	this._data = [];
	this._ctx.canvas.style.cursor = "crosshair";
	this._redraw();
	this._ec.push(OZ.Event.add(this._ctx.canvas, "mousemove", this._mouseMove.bind(this)));
	this._ec.push(OZ.Event.add(this._ctx.canvas, "mouseover", this._mouseOver.bind(this)));
	this._ec.push(OZ.Event.add(this._ctx.canvas, "mouseout", this._mouseOut.bind(this)));
	this._ec.push(OZ.Event.add(this._ctx.canvas, "click", this._click.bind(this)));
}

Canvas.prototype.getData = function() {
	return this._data;
}

Canvas.prototype._redraw = function() {
	this._ctx.clearRect(0, 0, this._size[0], this._size[1]);
	
	this._drawOldData();
	this._drawResults();
	
	if (this._data.length > 1) {
		this._ctx.strokeStyle = this._color;
		this._ctx.lineWidth = 2;
		this._ctx.beginPath();
		this._ctx.moveTo(this._data[0][0], this._data[0][1]);
		for (var i=0;i<this._data.length-1;i++) {
			var next = this._data[(i+1) % this._data.length];
			this._ctx.lineTo(next[0], next[1]);
		}
		this._ctx.closePath();
		this._ctx.stroke();
	}


	this._ctx.fillStyle = this._color;
	this._ctx.strokeStyle = "black";
	for (var i=0;i<this._data.length;i++) {
		this._circle(this._data[i]);
	}
	
	if (this._cursor) {
		this._ctx.globalAlpha = 0.5;
		this._circle(this._cursor);
		this._ctx.globalAlpha = 1;
	}
}

Canvas.prototype._mouseOver = function(e) {
	this._mouseMove(e);
}

Canvas.prototype._mouseOut = function(e) {
	this._cursor = null;
	this._redraw();
}

Canvas.prototype._mouseMove = function(e) {
	this._cursor = this._eventToCoords(e);
	this._redraw();
}

Canvas.prototype._click = function(e) {
	var coords = this._eventToCoords(e);
	for (var i=0;i<this._data.length;i++) {
		if (coords[0] == this._data[i][0] && coords[1] == this._data[i][1]) { return; } /* duplicate click */
	}
	this._data.push(coords);
	this._cursor = null;
	this._redraw();
	if (this._data.length == 3) {
		this._instructions.innerHTML = "Wait until the end of the round to see the scores!";
		this._ctx.canvas.style.cursor = "";
		while (this._ec.length) { OZ.Event.remove(this._ec.pop()); }
		this.dispatch("data-ready");
	}
}

Canvas.prototype._eventToCoords = function(e) {
	var pos = OZ.DOM.pos(this._ctx.canvas);
	pos[0] += this._ctx.canvas.clientLeft;
	pos[1] += this._ctx.canvas.clientTop;
	return [e.clientX - pos[0], e.clientY - pos[1]];
}

Canvas.prototype._drawResults = function() {
	if (!this._results) { return; }
	
	for (var id in this._results) {
		var result = this._results[id];
		var x = 0;
		var y = 0;
		
		for (var i=0;i<result.move.length;i++) {
			var p1 = result.move[i];
			var p2 = result.move[(i+1) % result.move.length];
			
			x += p1[0];
			y += p1[1];
			
			this._ctx.strokeStyle = (result.lost[i] ? "gray" : result.color);
			this._ctx.beginPath();
			this._ctx.moveTo(p1[0], p1[1]);
			this._ctx.lineTo(p2[0], p2[1]);
			this._ctx.closePath();
			this._ctx.stroke();
		}
		
		x /= result.move.length;
		y /= result.move.length;
		this._ctx.fillStyle = result.color;
		this._ctx.strokeStyle = "black";
		this._ctx.fillText(result.score, x, y);
		this._ctx.strokeText(result.score, x, y);
		
	}
	
	this._ctx.beginPath();
	for (var i=0;i<this._results.length;i++) {
		var results = this._results[i];
		this._ctx.moveTo(results[0][0], results[0][1]);
		for (var i=0;i<results.length-1;i++) {
			var next = results[(i+1) % results.length];
			this._ctx.lineTo(next[0], next[1]);
		}
	}
	
	this._ctx.closePath();
	this._ctx.stroke();
}

Canvas.prototype._drawOldData = function() {
	this._ctx.shadowBlur = 6;
	this._ctx.shadowColor = "#444";
	this._ctx.strokeStyle = "#ccc";
	this._ctx.beginPath();

	for (var i=0;i<this._oldData.length;i++) {
		var data = this._oldData[i];
		var p1 = data[0];
		this._ctx.moveTo(p1[0], p1[1]);
		for (var j=0;j<data.length;j++) {
			var p2 = data[(j+1) % data.length];
			this._ctx.lineTo(p2[0], p2[1]);
		}
	}
	
	this._ctx.closePath();
	this._ctx.stroke();

	this._ctx.shadowBlur = 0;
	this._ctx.shadowColor = "transparent";
}

Canvas.prototype._circle = function(pos) {
	this._ctx.beginPath();
	this._ctx.arc(pos[0], pos[1], 5, 0, 2*Math.PI, true);
	this._ctx.closePath();
	this._ctx.stroke();
	this._ctx.fill();
}

Canvas.prototype._hideResults = function() {
	for (var id in this._results) {
		var move = this._results[id].move;
		this._oldData.push(move);
	}
	this._results = null;
	this._redraw();
}
