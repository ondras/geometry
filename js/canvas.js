var Canvas = OZ.Class();

Canvas.prototype.init = function(node, size, radius) {
	this._size = [size, size];
	node.width = this._size[0];
	node.height = this._size[1];
	this._radius = radius;

	this._ctx = node.getContext("2d");
	this._ctx.font = "50px georgia";
	this._ctx.textAlign = "center";
	this._ctx.textBaseline = "middle";

	this._data = []; /* [coords, coords, coords] */
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
	this._data = [];
	this._instructions.innerHTML = "Click anywhere in the canvas to begin your line.";
	this._ctx.canvas.style.cursor = "crosshair";
	this._redraw();
	this._ec.push(OZ.Event.add(this._ctx.canvas, "mousemove", this._mouseMove.bind(this)));
	this._ec.push(OZ.Event.add(this._ctx.canvas, "mouseover", this._mouseOver.bind(this)));
	this._ec.push(OZ.Event.add(this._ctx.canvas, "mouseout", this._mouseOut.bind(this)));
	this._ec.push(OZ.Event.add(this._ctx.canvas, "click", this._click.bind(this)));
}

Canvas.prototype.getData = function() {
	return [this._pointsToLine(this._data[0], this._data[1]), this._data[2]];
}

Canvas.prototype._redraw = function() {
	this._ctx.clearRect(0, 0, this._size[0], this._size[1]);

	this._drawOldData();
	this._drawResults();
	this._drawData();
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
	this._redraw();
	this._cursor = null;
	
	switch (this._data.length) {
		case 1:
			this._instructions.innerHTML = "Click anywhere in the canvas to complete your line.";
		break;
		case 2:
			this._instructions.innerHTML = "Place your circle to disrupt enemy lines.";
		break;
		case 3:
			this._instructions.innerHTML = "Wait until the end of the round to see the scores!";
			this._ctx.canvas.style.cursor = "";
			while (this._ec.length) { OZ.Event.remove(this._ec.pop()); }
			this.dispatch("data-ready");
		break;
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
	
	/* lines */
	for (var id in this._results) {
		var result = this._results[id];
		var line = result.move[0];
		this._ctx.strokeStyle = (result.lost ? "gray" : result.color);
		this._line(line);
	}

	/* circles */
	for (var id in this._results) {
		var result = this._results[id];
		var center = result.move[1];
		this._ctx.fillStyle = result.color;
		this._circle(center);
	}
	
	/* scores */
	this._ctx.lineWidth = 1;
	for (var id in this._results) {
		var result = this._results[id];
		var line = result.move[0];
		var points = this._lineToPoints(line);
		var score = result.score;
		
		var x = (points[0][0] + points[1][0])/2;
		var y = (points[0][1] + points[1][1])/2;
		this._ctx.fillStyle = result.color;
		this._ctx.strokeStyle = "black";
		this._ctx.fillText(result.score, x, y);
		this._ctx.strokeText(result.score, x, y);
	}

}

Canvas.prototype._drawOldData = function() {
	this._ctx.shadowBlur = 6;
	this._ctx.globalAlpha = 0.5;
	this._ctx.shadowColor = "#444";
	this._ctx.strokeStyle = "#aaa";
	this._ctx.fillStyle = "#aaa";

	for (var i=0;i<this._oldData.length;i++) { this._line(this._oldData[i][0]); }
	for (var i=0;i<this._oldData.length;i++) { this._circle(this._oldData[i][1]); }

	this._ctx.globalAlpha = 1;
	this._ctx.shadowBlur = 0;
	this._ctx.shadowColor = "transparent";
}

Canvas.prototype._drawData = function() {
	if (!this._data.length) { return; }
	this._ctx.strokeStyle = this._color;
	this._ctx.fillStyle = this._color;
	
	/* find line to be drawn */
	var p1 = this._data[0];
	if (this._data.length == 1) { /* one point given */
		if (!this._cursor) { return; }
		var p2 = this._cursor;
		if (p1[0] == p2[0] && p1[1] == p2[1]) { return; } /* cursor at same position */
		this._ctx.globalAlpha = 0.5;
	} else {
		var p2 = this._data[1];
	}
	var line = this._pointsToLine(p1, p2);
	
	/* draw line */
	this._line(line);
	this._ctx.globalAlpha = 1;
	
	/* find circle to be drawn */
	if (this._data.length == 1) { return; }
	if (this._data.length == 2) { 
		if (!this._cursor) { return; }
		var circle = this._cursor;
		this._ctx.globalAlpha = 0.5;
	} else {
		var circle = this._data[2];
	}
	
	/* draw circle */
	this._circle(circle);
	this._ctx.globalAlpha = 1;
}
	
Canvas.prototype._circle = function(pos) {
	this._ctx.beginPath();
	this._ctx.arc(pos[0], pos[1], this._radius, 0, 2*Math.PI, true);
	this._ctx.closePath();
	this._ctx.fill();
}

Canvas.prototype._line = function(line) {
	this._ctx.lineWidth = 2;
	var points = this._lineToPoints(line);
	this._ctx.beginPath();
	this._ctx.moveTo(points[0][0], points[0][1]);
	this._ctx.lineTo(points[1][0], points[1][1]);
	this._ctx.closePath();
	this._ctx.stroke();
}

Canvas.prototype._hideResults = function() {
	for (var id in this._results) {
		var move = this._results[id].move;
		this._oldData.push(move);
		if (this._oldData.length > 10) { this._oldData.shift(); }
	}
	this._results = null;
	this._redraw();
}

/**
 * Convert two points to general line equation
 */
Canvas.prototype._pointsToLine = function(p1, p2) {
	var line = [1, 1, 0];

	if (p1[0] == p2[0]) {
		line[1] = 0; 
	} else if (p1[1] == p2[1]) {
		line[0] = 0; 
	} else {
		line[1] = (p1[0] - p2[0]) / (p2[1] - p1[1]); 
	}
	line[2] = -(line[0]*p1[0] + line[1]*p1[1]);
	
	return line;
}

/**
 * Convert general line equation to two points intersecting the canvas
 */
Canvas.prototype._lineToPoints = function(line) {
	var result = [];
	
	/* left edge: x = 0 */
	if (line[1]) { 
		var y = -line[2]/line[1];
		if (y >= 0 && y <= this._size[1]) { result.push([0, y]); }
	}
	
	/* right edge: x = this._size[0] */
	if (line[1]) {
		var y = -(line[2] + line[0]*this._size[0]) / line[1];
		if (y >= 0 && y <= this._size[1]) { result.push([this._size[0], y]); }
	}
	
	/* top edge: y = 0 */
	if (line[0]) {
		var x = -line[2]/line[0];
		if (x >= 0 && x <= this._size[0]) { result.push([x, 0]); }
	}

	/* bottom edge: y = this._size[1] */
	if (line[0]) {
		var x = -(line[2] + line[1]*this._size[1]) / line[0];
		if (x >= 0 && x <= this._size[0]) { result.push([x, this._size[1]]); }
	}
	
	return result;
}

Canvas.prototype.length = function(line) {
	var points = this._lineToPoints(line);
	var p1 = points[0];
	var p2 = points[1];
	var dx = p1[0]-p2[0];
	var dy = p1[1]-p2[1];
	return Math.round(Math.sqrt(dx*dx+dy*dy)/10); /* 1 point for every 10 pixels */
}
