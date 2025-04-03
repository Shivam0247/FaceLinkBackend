import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { handelStart, handelDisconnect, getType } from "./lib.js"; // Ensure lib.js is properly converted
import http from "http";

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server is running!");
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let online = 0;
let roomArr = [];

io.on("connection", (socket) => {
  online++;
  io.emit("online", online);

  // On start
  socket.on("start", (cb) => {
    handelStart(roomArr, socket, cb, io);
    console.log("connection", socket.id);
  });

  // On disconnection
  socket.on("disconnect", () => {
    online--;
    io.emit("online", online);
    handelDisconnect(socket.id, roomArr, io);
  });

  /// ------- WebRTC Connection Logic ------

  // On ICE candidate send
  socket.on("ice:send", ({ candidate }) => {
    let type = getType(socket.id, roomArr);
    if (type) {
      if (type.type === "p1" && typeof type.p2id === "string") {
        io.to(type.p2id).emit("ice:reply", { candidate, from: socket.id });
      } else if (type.type === "p2" && typeof type.p1id === "string") {
        io.to(type.p1id).emit("ice:reply", { candidate, from: socket.id });
      }
    }
  });

  // On SDP send
  socket.on("sdp:send", ({ sdp }) => {
    let type = getType(socket.id, roomArr);
    if (type) {
      if (type.type === "p1" && typeof type.p2id === "string") {
        io.to(type.p2id).emit("sdp:reply", { sdp, from: socket.id });
      } else if (type.type === "p2" && typeof type.p1id === "string") {
        io.to(type.p1id).emit("sdp:reply", { sdp, from: socket.id });
      }
    }
  });

  /// --------- Messaging -----------

  // Send message
  socket.on("send-message", (input, type, roomid) => {
    if (type === "p1") type = "You: ";
    else if (type === "p2") type = "Stranger: ";
    socket.to(roomid).emit("get-message", input, type);
  });
});

app.get("/online-users", (req, res) => {
  res.json({ online });
});

server.listen(4000, () => console.log("Server is up, 4000"));
