#!/usr/bin/env v8cgi

var GS = require("./server").GS;

var Server = require("websocket").Server;
var ws = new Server("0.0.0.0", 8888);
ws.addApplication(new GS(ws));
ws.run();
