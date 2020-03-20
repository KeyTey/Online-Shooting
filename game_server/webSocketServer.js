function createWebSocketServer(io, game) {
  const rootIo = io.of('/');
  rootIo.on('connection', (socket) => {
    socket.on('start game', (displayName) => {
      const startObj = game.newConnection(socket.id, displayName);
      socket.emit('start data', startObj);
    });
    socket.on('change direction', (direction) => {
      game.updatePlayerDirection(socket.id, direction);
    });
    socket.on('speed up', () => {
      game.updateSpeedUp(socket.id);
    });
    socket.on('speed down', () => {
      game.updateSpeedDown(socket.id);
    });
    socket.on('missile emit', (direction) => {
      game.missileEmit(socket.id, direction);
    });
    socket.on('disconnect', () => {
      game.disconnect(socket.id);
    });
  });
  const socketTicker = setInterval(() => {
    rootIo.volatile.emit('map data', game.getMapData()); // 全員に送信
  }, 30);
}

module.exports = {
  createWebSocketServer
}
