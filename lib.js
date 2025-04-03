import { v4 as uuidv4 } from "uuid";

export function handelStart(roomArr, socket, cb = () => {}, io) {
  if (!socket) return; // Prevent null socket errors

  // Check if there is an available waiting room
  let availableRoom = checkAvailableRoom(socket.id);

  if (availableRoom.is) {
    // Match the new user with the waiting user
    socket.join(availableRoom.roomid);
    cb("p2");
    closeRoom(availableRoom.roomid, socket.id);

    io.to(availableRoom.room.p1.id).emit("remote-socket", socket.id);
    io.to(socket.id).emit("remote-socket", availableRoom.room.p1.id);
    io.to(socket.id).emit("roomid", availableRoom.room.roomid);
  } else {
    // If no available room, create a new one
    let roomid = uuidv4();
    socket.join(roomid);
    roomArr.push({
      roomid,
      isAvailable: true,
      p1: { id: socket.id },
      p2: { id: null },
    });
    cb("p1");
    socket.emit("roomid", roomid);
  }

  /**
   * @desc Mark the room as full and assign p2
   * @param {string} roomid
   * @param {string} socketId
   */
  function closeRoom(roomid, socketId) {
    let room = roomArr.find((room) => room.roomid === roomid);
    if (room) {
      room.isAvailable = false;
      room.p2.id = socketId;
    }
  }

  /**
   * @desc Find an available room or check if the user is already in one
   * @param {string} socketId
   * @returns {Object} { is, roomid, room }
   */
  function checkAvailableRoom(socketId) {
    for (let room of roomArr) {
      if (room.isAvailable) {
        return { is: true, roomid: room.roomid, room };
      }
      if (room.p1.id === socketId || room.p2.id === socketId) {
        return { is: false, roomid: "", room: null };
      }
    }
    return { is: false, roomid: "", room: null };
  }
}

/**
 * @desc handles disconnection event
 */
export function handelDisconnect(disconnectedId, roomArr, io) {
  for (let i = 0; i < roomArr.length; i++) {
    let room = roomArr[i];

    if (room.p1.id === disconnectedId) {
      io.to(room.p2.id).emit("disconnected"); // Notify partner

      if (room.p2.id) {
        // Remove the room and try to match the remaining user
        roomArr.splice(i, 1);
        handelStart(roomArr, io.sockets.sockets.get(room.p2.id), () => {}, io);
      }
    } else if (room.p2.id === disconnectedId) {
      io.to(room.p1.id).emit("disconnected"); // Notify partner

      if (room.p1.id) {
        // Remove the room and try to match the remaining user
        roomArr.splice(i, 1);
        handelStart(roomArr, io.sockets.sockets.get(room.p1.id), () => {}, io);
      }
    }
  }
}

// get type of person (p1 or p2)
export function getType(id, roomArr) {
  for (let i = 0; i < roomArr.length; i++) {
    if (roomArr[i].p1.id == id) {
      return { type: "p1", p2id: roomArr[i].p2.id };
    } else if (roomArr[i].p2.id == id) {
      return { type: "p2", p1id: roomArr[i].p1.id };
    }
  }

  return false;
}
