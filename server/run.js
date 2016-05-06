#!/usr/bin/env node

var GS = require("./server").GS;

var Server = require("./ws-proxy").Server;
var ws = new Server("0.0.0.0", 8888);
ws.addApplication(new GS(ws));
ws.run();
