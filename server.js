const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingSocket = null;
const roomOf = new Map(); 

io.on('connection', (socket) => {
  socket.on('findMatch', () => {
    if (waitingSocket && waitingSocket.connected && waitingSocket.id !== socket.id) {
      const room = `room-${waitingSocket.id}-${socket.id}`;
      socket.join(room);
      waitingSocket.join(room);
      roomOf.set(socket.id, { room, opponentId: waitingSocket.id });
      roomOf.set(waitingSocket.id, { room, opponentId: socket.id });

      io.to(waitingSocket.id).emit('matchFound', { room, isP1: true });
      io.to(socket.id).emit('matchFound', { room, isP1: false });
      waitingSocket = null;
    } else {
      waitingSocket = socket;
      socket.emit('waitingForOpponent');
    }
  });

  socket.on('cancelFind', () => {
    if (waitingSocket && waitingSocket.id === socket.id) waitingSocket = null;
  });

  socket.on('boardUpdate', (payload) => {
    const info = roomOf.get(socket.id);
    if (info) socket.to(info.room).emit('opponentBoard', payload);
  });

  socket.on('garbage', (count) => {
    const info = roomOf.get(socket.id);
    if (info) socket.to(info.room).emit('receiveGarbage', count);
  });

  socket.on('gameOver', () => {
    const info = roomOf.get(socket.id);
    if (info) socket.to(info.room).emit('opponentGameOver');
  });

  socket.on('disconnect', () => {
    if (waitingSocket && waitingSocket.id === socket.id) waitingSocket = null;
    const info = roomOf.get(socket.id);
    if (info) {
      socket.to(info.room).emit('opponentLeft');
      roomOf.delete(info.opponentId);
      roomOf.delete(socket.id);
    }
  });
});

// Render 등 대부분의 무료 호스팅은 PORT를 환경변수로 지정해줍니다.
// 0.0.0.0으로 바인딩해야 외부(다른 사람)에서 접속할 수 있습니다.
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tetris server listening on port ${PORT}`);
});
