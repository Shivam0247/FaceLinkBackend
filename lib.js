import { v4 as uuidv4 } from "uuid";

/**
 * Handles a new connection and attempts to place the socket into a room.
 */
export function handleStart(roomArr, socket, cb = () => {}, io) {
  if (!socket) return;

  // ✅ Check if user is already in a room
  for (let room of roomArr) {
    if (room.p1.id === socket.id || room.p2.id === socket.id) {
      cb(room.p1.id === socket.id ? "p1" : "p2");
      socket.emit("roomid", room.roomid);
      return;
    }
  }

  // 🔍 Look for available room
  let availableRoom = findAvailableRoom(socket.id, roomArr);

  if (availableRoom.is) {
    const room = availableRoom.room;
    room.p2.id = socket.id;
    room.isAvailable = false;

    socket.join(room.roomid);
    cb("p2");

    io.to(room.p1.id).emit("remote-socket", socket.id);
    io.to(socket.id).emit("remote-socket", room.p1.id);
    io.to(socket.id).emit("roomid", room.roomid);
  } else {
    // ❗ No room available, create one
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
}

/**
 * Finds an available room that this socket can join.
 */
function findAvailableRoom(socketId, roomArr) {
  for (let room of roomArr) {
    if (room.isAvailable && room.p1.id !== socketId && room.p2.id === null) {
      return { is: true, roomid: room.roomid, room };
    }
  }
  return { is: false, roomid: "", room: null };
}

/**
 * Handles disconnection and attempts to rematch the remaining user.
 */
export function handleDisconnect(disconnectedId, roomArr, io) {
  for (let i = 0; i < roomArr.length; i++) {
    const room = roomArr[i];

    if (room.p1.id === disconnectedId) {
      if (room.p2.id) {
        io.to(room.p2.id).emit("disconnected");

        const socketP2 = io.sockets.sockets.get(room.p2.id);
        if (socketP2) {
          handleStart(roomArr, socketP2, () => {}, io);
        }
      }

      room.p1.id = null;

      // ✅ Set available if one player remains
      room.isAvailable = !!room.p2.id;
    } else if (room.p2.id === disconnectedId) {
      if (room.p1.id) {
        io.to(room.p1.id).emit("disconnected");

        const socketP1 = io.sockets.sockets.get(room.p1.id);
        if (socketP1) {
          handleStart(roomArr, socketP1, () => {}, io);
        }
      }

      room.p2.id = null;

      // ✅ Set available if one player remains
      room.isAvailable = !!room.p1.id;
    }
  }

  // 🧹 Clean up empty rooms
  for (let i = roomArr.length - 1; i >= 0; i--) {
    const room = roomArr[i];
    if (room.p1.id === null && room.p2.id === null) {
      roomArr.splice(i, 1);
    }
  }

  tryToPairRemainingUsers(roomArr, io);
}

/**
 * Returns the type of player (p1 or p2) and their counterpart’s ID.
 */
export function getType(socketId, roomArr) {
  for (let room of roomArr) {
    if (room.p1.id === socketId) {
      return { type: "p1", p2id: room.p2.id };
    }

    if (room.p2.id === socketId) {
      return { type: "p2", p1id: room.p1.id };
    }
  }

  return false;
}

function tryToPairRemainingUsers(roomArr, io) {
  const availableRooms = roomArr.filter(
    (room) =>
      room.isAvailable &&
      ((room.p1.id && !room.p2.id) || (!room.p1.id && room.p2.id))
  );

  if (availableRooms.length < 2) return;

  // Grab two available rooms
  const [roomA, roomB] = availableRooms;

  const userA = roomA.p1.id || roomA.p2.id;
  const userB = roomB.p1.id || roomB.p2.id;

  if (userA && userB) {
    // Merge into roomA
    roomA.p1.id = userA;
    roomA.p2.id = userB;
    roomA.isAvailable = false;

    // Inform both users
    io.to(userA).emit("remote-socket", userB);
    io.to(userB).emit("remote-socket", userA);
    io.to(userA).emit("roomid", roomA.roomid);
    io.to(userB).emit("roomid", roomA.roomid);

    // Remove roomB from roomArr
    const indexB = roomArr.indexOf(roomB);
    if (indexB > -1) {
      roomArr.splice(indexB, 1);
    }
  }
}
