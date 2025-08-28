const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];

// 全国市町村データ（JSON）をロード
// cities1700.json 例: [{name:"東京",lat:35.68,lon:139.76},...]
const cityData = JSON.parse(fs.readFileSync("cities1700.json","utf8"));

// 強震モニタ WebSocket
const kmoni = new WebSocket("wss://www.kmoni.bosai.go.jp/websocket");

// メッセージ受信
kmoni.on("message", (msg)=>{
  const raw = JSON.parse(msg.toString());
  const lat = raw.lat || 0;
  const lon = raw.lon || 0;
  const mag = raw.mag || 0;
  const pga = raw.pga || 0;
  const pgaSurface = raw.pgaSurface || 0;
  const records = raw.records || [{value:0}];

  // 市町村震度・AI予測震度
  const shindoCities = cityData.map(c=>{
    const dist = Math.sqrt(Math.pow(c.lat-lat,2)+Math.pow(c.lon-lon,2));
    const shindo = Math.max(0, Math.round(mag - dist*1.5));
    return {name:c.name, shindo, lat:c.lat, lon:c.lon};
  });
  const aiShindo = shindoCities.map(c=>({name:c.name, shindo:Math.max(0, c.shindo+1)}));

  // 揺れ範囲□
  const box = {lat1:lat-0.5, lon1:lon-0.5, lat2:lat+0.5, lon2:lon+0.5};

  const data = {lat, lon, mag, pga, pgaSurface, records, shindoCities, aiShindo, box};

  clients.forEach(ws=>{if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data));});
});

// クライアント接続
wss.on("connection", ws=>{
  clients.push(ws);
  ws.on("close", ()=>clients=clients.filter(c=>c!==ws));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log("中継サーバ起動:",PORT));
