'use strict';

const gameObj = {
  playersMap: new Map(),
  itemsMap: new Map(),
  airMap: new Map(),
  NPCMap: new Map(),
  addingNPCPlayerNum: 5,
  flyingMissilesMap: new Map(),
  missileAliveFlame: 300,
  missileSpeed: 3,
  missileWidth: 10,
  missileHeight: 10,
  directions: ['left', 'up', 'down', 'right'],
  fieldWidth: 1000,
  fieldHeight: 1000,
  itemTotal: 15,
  airTotal: 10,
  itemRadius: 4,
  airRadius: 6,
  addAirTime: 10,
  submarineImageWidth: 42
};

function init() {
  for (let i = 0; i < gameObj.itemTotal; i++) addItem()
  for (let a = 0; a < gameObj.airTotal; a++) addAir();
}

init(); // 初期化 (サーバー起動時)

const gameTicker = setInterval(() => {
  // NPC の行動選択
  NPCMoveDecision(gameObj.NPCMap);
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));
  // 潜水艦の移動
  movePlayers(playersAndNPCMap);
  // ミサイルの移動
  moveMissile(gameObj.flyingMissilesMap);
  // アイテムの取得チェック
  checkGetItem(playersAndNPCMap, gameObj.itemsMap, gameObj.airMap, gameObj.flyingMissilesMap);
  addNPC();
}, 10);

function NPCMoveDecision(NPCMap) {
  for (let [NPCId, NPCObj] of NPCMap) {
    switch (NPCObj.level) {
      case 1:
        NPCObj.speed = 1;
        if (Math.floor(Math.random() * 100) === 1) {
          NPCObj.direction = gameObj.directions[Math.floor(Math.random() * gameObj.directions.length)];
        }
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 200) === 1) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
      case 2:
        NPCObj.speed = 2;
        if (Math.floor(Math.random() * 50) === 1) {
          NPCObj.direction = gameObj.directions[Math.floor(Math.random() * gameObj.directions.length)];
        }
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 150) === 1) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
      case 3:
        NPCObj.speed = 2.5;
        if (Math.floor(Math.random() * 20) === 1) {
          NPCObj.direction = gameObj.directions[Math.floor(Math.random() * gameObj.directions.length)];
        }
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 100) === 1) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
    }
  }
}

function newConnection(socketId, displayName) {
  const playerX = Math.floor(Math.random() * gameObj.fieldWidth);
  const playerY = Math.floor(Math.random() * gameObj.fieldHeight);
  const playerId = Math.floor(Math.random() * 10 ** 17).toString();
  const playerObj = {
    x: playerX,
    y: playerY,
    playerId: playerId,
    displayName: displayName,
    isAlive: true,
    direction: 'right',
    speed: 1,
    missilesMany: 0,
    airTime: 99,
    aliveTime: { 'clock': 0, 'seconds': 0 },
    deadCount: 0,
    score: 0
  }
  gameObj.playersMap.set(socketId, playerObj);
  const startObj = {
    playerObj: playerObj,
    fieldWidth: gameObj.fieldWidth,
    fieldHeight: gameObj.fieldHeight
  }
  return startObj;
}

function getMapData() {
  const playersArray = [];
  const itemsArray = [];
  const airArray = [];
  const flyingMissilesArray = [];
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));
  for (let [socketId, player] of playersAndNPCMap) {
    const playerDataForSend = [];
    playerDataForSend.push(player.x);
    playerDataForSend.push(player.y);
    playerDataForSend.push(player.playerId);
    playerDataForSend.push(player.displayName);
    playerDataForSend.push(player.score);
    playerDataForSend.push(player.isAlive);
    playerDataForSend.push(player.direction);
    playerDataForSend.push(player.missilesMany);
    playerDataForSend.push(player.airTime);
    playerDataForSend.push(player.deadCount);
    playersArray.push(playerDataForSend);
  }
  for (let [id, item] of gameObj.itemsMap) {
    const itemDataForSend = [];
    itemDataForSend.push(item.x);
    itemDataForSend.push(item.y);
    itemsArray.push(itemDataForSend);
  }
  for (let [id, air] of gameObj.airMap) {
    const airDataForSend = [];
    airDataForSend.push(air.x);
    airDataForSend.push(air.y);
    airArray.push(airDataForSend);
  }
  for (let [id, flyingMissile] of gameObj.flyingMissilesMap) {
    const flyingMissileDataForSend = [];
    flyingMissileDataForSend.push(flyingMissile.x);
    flyingMissileDataForSend.push(flyingMissile.y);
    flyingMissileDataForSend.push(flyingMissile.direction);
    flyingMissileDataForSend.push(flyingMissile.emitPlayerId);
    flyingMissilesArray.push(flyingMissileDataForSend);
  }
  return [playersArray, itemsArray, airArray, flyingMissilesArray];
}

function updatePlayerDirection(socketId, direction) {
  const playerObj = gameObj.playersMap.get(socketId);
  playerObj.direction = direction;
}

function updateSpeedUp(socketId) {
  const playerObj = gameObj.playersMap.get(socketId);
  playerObj.speed = 2;
}

function updateSpeedDown(socketId) {
  const playerObj = gameObj.playersMap.get(socketId);
  playerObj.speed = 1;
}

function missileEmit(socketId, direction) {
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));
  if (!playersAndNPCMap.has(socketId)) return;
  let emitPlayerObj = playersAndNPCMap.get(socketId);
  if (emitPlayerObj.missilesMany <= 0) return; // ミサイル不足
  if (!emitPlayerObj.isAlive) return; // 死亡
  emitPlayerObj.missilesMany -= 1;
  const missileId = Math.floor(Math.random() * 10 ** 17).toString();
  const missileObj = {
    emitPlayerId: emitPlayerObj.playerId,
    emitPlayerSocketId: socketId,
    x: emitPlayerObj.x,
    y: emitPlayerObj.y,
    aliveFlame: gameObj.missileAliveFlame,
    direction: direction,
    id: missileId
  };
  gameObj.flyingMissilesMap.set(missileId, missileObj);
}

function disconnect(socketId) {
  gameObj.playersMap.delete(socketId);
}

function addItem() {
  const itemX = Math.floor(Math.random() * gameObj.fieldWidth);
  const itemY = Math.floor(Math.random() * gameObj.fieldHeight);
  const itemKey = `${itemX},${itemY}`;
  // アイテムの位置が被ってしまった場合
  if (gameObj.itemsMap.has(itemKey)) {
    return addItem(); // 作り直し
  }
  const itemObj = {
    x: itemX,
    y: itemY,
  };
  gameObj.itemsMap.set(itemKey, itemObj);
}

function addAir() {
  const airX = Math.floor(Math.random() * gameObj.fieldWidth);
  const airY = Math.floor(Math.random() * gameObj.fieldHeight);
  const airKey = `${airX},${airY}`;
  // アイテムの位置が被ってしまった場合
  if (gameObj.airMap.has(airKey)) {
    return addAir(); // 作り直し
  }
  const airObj = {
    x: airX,
    y: airY,
  };
  gameObj.airMap.set(airKey, airObj);
}

// 潜水艦の移動
function movePlayers(playersMap) {
  for (let [playerId, player] of playersMap) {
    if (!player.isAlive) {
      if (player.deadCount < 70) {
        player.deadCount += 1;
      }
      else {
        gameObj.playersMap.delete(playerId);
        gameObj.NPCMap.delete(playerId);
      }
      continue;
    }
    switch (player.direction) {
      case 'left':
        player.x -= player.speed;
        break;
      case 'up':
        player.y -= player.speed;
        break;
      case 'down':
        player.y += player.speed;
        break;
      case 'right':
        player.x += player.speed;
        break;
    }
    if (player.x > gameObj.fieldWidth) player.x -= gameObj.fieldWidth;
    if (player.x < 0) player.x += gameObj.fieldWidth;
    if (player.y < 0) player.y += gameObj.fieldHeight;
    if (player.y > gameObj.fieldHeight) player.y -= gameObj.fieldHeight;
    player.aliveTime.clock += 1;
    if (player.aliveTime.clock >= 100) {
      player.aliveTime.clock = 0;
      player.aliveTime.seconds += 1;
      player.airTime -= 1;
      if (player.airTime < 0) {
        player.airTime = 0;
        player.isAlive = false;
      }
      player.score += 1;
    }
  }
}

// ミサイルの移動
function moveMissile(flyingMissilesMap) {
  for (let [missileId, flyingMissile] of flyingMissilesMap) {
    if (flyingMissile.aliveFlame === 0) {
      flyingMissilesMap.delete(missileId);
      continue;
    }
    flyingMissile.aliveFlame -= 1;
    switch (flyingMissile.direction) {
      case 'left':
        flyingMissile.x -= gameObj.missileSpeed;
        break;
      case 'up':
        flyingMissile.y -= gameObj.missileSpeed;
        break;
      case 'down':
        flyingMissile.y += gameObj.missileSpeed;
        break;
      case 'right':
        flyingMissile.x += gameObj.missileSpeed;
        break;
    }
    if (flyingMissile.x > gameObj.fieldWidth) flyingMissile.x -= gameObj.fieldWidth;
    if (flyingMissile.x < 0) flyingMissile.x += gameObj.fieldWidth;
    if (flyingMissile.y < 0) flyingMissile.y += gameObj.fieldHeight;
    if (flyingMissile.y > gameObj.fieldHeight) flyingMissile.y -= gameObj.fieldHeight;
  }
}

function checkGetItem(playersMap, itemsMap, airMap, flyingMissilesMap) {
  for (let [hashKey, playerObj] of playersMap) {
    if (!playerObj.isAlive) continue;
    // アイテムのミサイル (赤丸)
    for (let [itemKey, itemObj] of itemsMap) {
      const distanceObj = calcBetweenTwoPoints(
        playerObj.x, playerObj.y, itemObj.x, itemObj.y, gameObj.fieldWidth, gameObj.fieldHeight
      );
      if (
        distanceObj.distanceX <= (gameObj.submarineImageWidth / 2 + gameObj.itemRadius) &&
        distanceObj.distanceY <= (gameObj.submarineImageWidth / 2 + gameObj.itemRadius)
      ) {
        gameObj.itemsMap.delete(itemKey);
        playerObj.missilesMany = playerObj.missilesMany >= 6 ? 6 : playerObj.missilesMany + 1;
        addItem();
      }
    }
    // アイテムの空気 (青丸)
    for (let [airKey, airObj] of airMap) {
      const distanceObj = calcBetweenTwoPoints(
        playerObj.x, playerObj.y, airObj.x, airObj.y, gameObj.fieldWidth, gameObj.fieldHeight
      );
      if (
        distanceObj.distanceX <= (gameObj.submarineImageWidth / 2 + gameObj.airRadius) &&
        distanceObj.distanceY <= (gameObj.submarineImageWidth / 2 + gameObj.airRadius)
      ) {
        gameObj.airMap.delete(airKey);
        const airTime = playerObj.airTime += gameObj.addAirTime;
        playerObj.airTime = airTime > 99 ? 99 : airTime;
        addAir();
      }
    }
    // 撃ち放たれているミサイル
    for (let [missileId, flyingMissile] of flyingMissilesMap) {
      const distanceObj = calcBetweenTwoPoints(
        playerObj.x, playerObj.y, flyingMissile.x, flyingMissile.y, gameObj.fieldWidth, gameObj.fieldHeight
      );
      if (
        distanceObj.distanceX <= (gameObj.submarineImageWidth / 2 + gameObj.missileWidth / 2) &&
        distanceObj.distanceY <= (gameObj.submarineImageWidth / 2 + gameObj.missileHeight / 2) &&
        playerObj.playerId !== flyingMissile.emitPlayerId
      ) {
        playerObj.isAlive = false;
        flyingMissilesMap.delete(missileId); // ミサイル（魚雷）の削除
      }
    }
  }
}

function addNPC() {
  if (gameObj.playersMap.size + gameObj.NPCMap.size >= gameObj.addingNPCPlayerNum) return;
  const addMany = gameObj.addingNPCPlayerNum - gameObj.playersMap.size - gameObj.NPCMap.size;
  for (let i = 0; i < addMany; i++) {
    const playerX = Math.floor(Math.random() * gameObj.fieldWidth);
    const playerY = Math.floor(Math.random() * gameObj.fieldHeight);
    const level = Math.floor(Math.random() * 3) + 1;
    const id = Math.floor(Math.random() * 10 ** 17).toString();
    const playerObj = {
      x: playerX,
      y: playerY,
      isAlive: true,
      deadCount: 0,
      direction: 'right',
      speed: 1,
      missilesMany: 0,
      airTime: 99,
      aliveTime: { 'clock': 0, 'seconds': 0 },
      score: 0,
      level: level,
      displayName: 'NPC',
      playerId: id
    };
    gameObj.NPCMap.set(id, playerObj);
  }
}

function calcBetweenTwoPoints(pX, pY, oX, oY, gameWidth, gameHeight) {
  let distanceX = 99999999;
  let distanceY = 99999999;
  if (pX <= oX) {
    // 右から
    distanceX = oX - pX;
    // 左から
    let tmpDistance = pX + gameWidth - oX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
    }
  } else {
    // 右から
    distanceX = pX - oX;
    // 左から
    let tmpDistance = oX + gameWidth - pX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
    }
  }
  if (pY <= oY) {
    // 下から
    distanceY = oY - pY;
    // 上から
    let tmpDistance = pY + gameHeight - oY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
    }
  } else {
    // 上から
    distanceY = pY - oY;
    // 下から
    let tmpDistance = oY + gameHeight - pY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
    }
  }
  return { distanceX, distanceY };
}

module.exports = {
  newConnection,
  getMapData,
  updatePlayerDirection,
  updateSpeedUp,
  updateSpeedDown,
  missileEmit,
  disconnect
};
