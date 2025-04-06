import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { handleStart, handleDisconnect, getType } from "./lib.js";
import http from "http";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let online = 0;
let roomArr = [];
io.on("connection", (socket) => {
  online++;
  io.emit("online", online);

  socket.on("start", (cb) => {
    handleStart(roomArr, socket, cb, io);
    console.log("connection", socket.id);
    console.log("roomArr", roomArr);
  });

  socket.on("disconnect", () => {
    online--;
    io.emit("online", online);
    handleDisconnect(socket.id, roomArr, io);
    console.log("disconnection");
    console.log("roomArr", roomArr);
  });

  socket.on("ice:send", ({ candidate }) => {
    let type = getType(socket.id, roomArr);
    if (!type) return;
    const target = type.type === "p1" ? type.p2id : type.p1id;
    if (target) io.to(target).emit("ice:reply", { candidate, from: socket.id });
  });

  socket.on("sdp:send", ({ sdp }) => {
    let type = getType(socket.id, roomArr);
    if (!type) return;
    const target = type.type === "p1" ? type.p2id : type.p1id;
    if (target) io.to(target).emit("sdp:reply", { sdp, from: socket.id });
  });

  socket.on("send-message", (input, senderType, roomid) => {
    const prefix = senderType === "p1" ? "You: " : "Stranger: ";
    socket.to(roomid).emit("get-message", `${prefix}${input}`);
  });

  socket.on("video-toggle", ({ isVideoOn }) => {
    const type = getType(socket.id, roomArr);
    const target = type?.type === "p1" ? type?.p2id : type?.p1id;
    if (target) io.to(target).emit("video-toggle", { isVideoOn });
  });
});

app.get("/", (req, res) => res.send("Server is running!"));
app.get("/online-users", (req, res) => res.json({ online }));

server.listen(4000, () => console.log("Server is up on port 4000"));
