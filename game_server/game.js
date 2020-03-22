'use strict';

const gameObj = {
  playersMap: new Map(),
  itemsMap: new Map(),
  airMap: new Map(),
  NPCMap: new Map(),
  addingNPCPlayerNum: 12,
  flyingMissilesMap: new Map(),
  missileAliveFlame: 300,
  missileSpeed: 3,
  missileWidth: 10,
  missileHeight: 10,
  directions: ['left', 'up', 'down', 'right'],
  fieldWidth: 1500,
  fieldHeight: 1500,
  itemTotal: 30,
  airTotal: 20,
  itemRadius: 4,
  airRadius: 6,
  addAirTime: 8,
  itemPoint: 4,
  missileDamage: 1000,
  playerImageWidth: 42
};

function init() {
  for (let i = 0; i < gameObj.itemTotal; i++) addItem()
  for (let a = 0; a < gameObj.airTotal; a++) addAir();
}

init(); // 初期化 (サーバー起動時)

const gameTicker = setInterval(() => {
  // NPCの行動選択
  NPCMoveDecision(gameObj.NPCMap);
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));
  // 状態更新
  updateStates(playersAndNPCMap);
  // NPCの移動
  movePlayers(gameObj.NPCMap);
  // ミサイルの移動
  moveMissile(gameObj.flyingMissilesMap);
  // アイテムの取得チェック
  checkGetItem(playersAndNPCMap, gameObj.itemsMap, gameObj.airMap, gameObj.flyingMissilesMap);
  addNPC();
}, 10);

// スコア１位のプレイヤーを取得
function getTopPlayer() {
  let target = null;
  let maxScore = 0;
  const playersAndNPCMap = new Map(Array.from(gameObj.playersMap).concat(Array.from(gameObj.NPCMap)));
  for (let [id, player] of playersAndNPCMap) {
    if (player.score > maxScore) {
      maxScore = player.score;
      target = player;
    }
  }
  return target;
}

// NPCの方向をランダムに選択
function randomDirection(NPCObj) {
  NPCObj.direction = gameObj.directions[Math.floor(Math.random() * gameObj.directions.length)];
}

// NPCから対象物へ接近
function approachToTarget(NPCObj, target) {
  const distanceObj = calcBetweenTwoPoints(NPCObj.x, NPCObj.y, target.x, target.y, gameObj.fieldWidth, gameObj.fieldHeight);
  if (Math.random() < 0.5) {
    if (NPCObj.x + distanceObj.distanceX === target.x) return NPCObj.direction = 'right';
    if (NPCObj.x - distanceObj.distanceX === target.x) return NPCObj.direction = 'left';
    if (NPCObj.x + distanceObj.distanceX === target.x + gameObj.fieldWidth) return NPCObj.direction = 'right';
    if (NPCObj.x - distanceObj.distanceX === target.x - gameObj.fieldWidth) return NPCObj.direction = 'left';
  }
  else {
    if (NPCObj.y + distanceObj.distanceY === target.y) return NPCObj.direction = 'down';
    if (NPCObj.y - distanceObj.distanceY === target.y) return NPCObj.direction = 'up';
    if (NPCObj.y + distanceObj.distanceY === target.y + gameObj.fieldHeight) return NPCObj.direction = 'down';
    if (NPCObj.y - distanceObj.distanceY === target.y - gameObj.fieldHeight) return NPCObj.direction = 'up';
  }
}

// NPCの方向を決定
function decideNPCDirection(NPCObj, target, probability) {
  if (Math.random() < probability) {
    if (!target) return randomDirection(NPCObj);
    if (target.playerId === NPCObj.playerId) return randomDirection(NPCObj);
    randomDirection(NPCObj);
  }
}

// NPCの行動決定
function NPCMoveDecision(NPCMap) {
  const target = getTopPlayer();
  for (let [NPCId, NPCObj] of NPCMap) {
    switch (NPCObj.level) {
      case 1:
        NPCObj.speed = 1;
        decideNPCDirection(NPCObj, target, 0.01);
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 200) === 1) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
      case 2:
        NPCObj.speed = 2;
        decideNPCDirection(NPCObj, target, 0.02);
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 150) === 1) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
      case 3:
        NPCObj.speed = 2.5;
        decideNPCDirection(NPCObj, target, 0.05);
        if (NPCObj.missilesMany > 0 && Math.floor(Math.random() * 100) === 1) {
          missileEmit(NPCObj.playerId, NPCObj.direction);
        }
        break;
    }
  }
}

// ゲームスタート時にクライアントへ初期データを送る
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
    isDamaged: false,
    direction: 'right',
    speed: 1,
    missilesMany: 0,
    airTime: 99,
    aliveTime: { 'clock': 0, 'seconds': 0 },
    deadCount: 0,
    damagedCount: 0,
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

// 定期的にクライアントへデータを送る
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
    playerDataForSend.push(player.isDamaged);
    playerDataForSend.push(player.damagedCount);
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

// クライアントからプレイヤーデータを受け取る
function playerEmit(socketId, playerData) {
  const player = gameObj.playersMap.get(socketId);
  if (!player) return;
  player.x = playerData[0];
  player.y = playerData[1];
  player.direction = playerData[2];
}

// クライアントからミサイル発射を受け取る
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

// クライアントが切断したときの処理
function disconnect(socketId) {
  gameObj.playersMap.delete(socketId);
}

// ミサイルアイテムの追加
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

// 酸素の追加
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

// プレイヤーの状態を更新
function updateStates(playersMap) {
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
    if (player.isDamaged) {
      if (player.damagedCount < 70) {
        player.damagedCount += 1;
      }
      else {
        player.isDamaged = false;
        player.damagedCount = 0;
      }
    }
    player.aliveTime.clock += 1;
    if (player.aliveTime.clock >= 100) {
      player.aliveTime.clock = 0;
      player.aliveTime.seconds += 1;
      player.airTime -= 1;
      if (player.airTime < 0) {
        player.airTime = 0;
        player.isAlive = false;
      }
      player.score += 2;
    }
  }
}

// プレイヤーの移動
function movePlayers(playersMap) {
  for (let [playerId, player] of playersMap) {
    if (!player.isAlive) continue;
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

// アイテムの取得チェックおよびミサイルの当たり判定
function checkGetItem(playersMap, itemsMap, airMap, flyingMissilesMap) {
  for (let [hashKey, playerObj] of playersMap) {
    if (!playerObj.isAlive) continue;
    // ミサイル (赤丸)
    for (let [itemKey, itemObj] of itemsMap) {
      const distanceObj = calcBetweenTwoPoints(
        playerObj.x, playerObj.y, itemObj.x, itemObj.y, gameObj.fieldWidth, gameObj.fieldHeight
      );
      if (
        distanceObj.distanceX <= (gameObj.playerImageWidth / 2 + gameObj.itemRadius) &&
        distanceObj.distanceY <= (gameObj.playerImageWidth / 2 + gameObj.itemRadius)
      ) {
        gameObj.itemsMap.delete(itemKey);
        playerObj.missilesMany = playerObj.missilesMany >= 6 ? 6 : playerObj.missilesMany + 1;
        playerObj.score += gameObj.itemPoint;
        addItem();
      }
    }
    // 酸素 (青丸)
    for (let [airKey, airObj] of airMap) {
      const distanceObj = calcBetweenTwoPoints(
        playerObj.x, playerObj.y, airObj.x, airObj.y, gameObj.fieldWidth, gameObj.fieldHeight
      );
      if (
        distanceObj.distanceX <= (gameObj.playerImageWidth / 2 + gameObj.airRadius) &&
        distanceObj.distanceY <= (gameObj.playerImageWidth / 2 + gameObj.airRadius)
      ) {
        gameObj.airMap.delete(airKey);
        const airTime = playerObj.airTime += gameObj.addAirTime;
        playerObj.airTime = airTime > 99 ? 99 : airTime;
        playerObj.score += gameObj.itemPoint;
        addAir();
      }
    }
    // 撃ち放たれているミサイル
    for (let [missileId, flyingMissile] of flyingMissilesMap) {
      const distanceObj = calcBetweenTwoPoints(
        playerObj.x, playerObj.y, flyingMissile.x, flyingMissile.y, gameObj.fieldWidth, gameObj.fieldHeight
      );
      if (
        distanceObj.distanceX <= (gameObj.playerImageWidth / 2 + gameObj.missileWidth / 2) &&
        distanceObj.distanceY <= (gameObj.playerImageWidth / 2 + gameObj.missileHeight / 2) &&
        playerObj.playerId !== flyingMissile.emitPlayerId
      ) {
        // スコア更新
        if (playersMap.has(flyingMissile.emitPlayerSocketId)) {
          const emitPlayer = playersMap.get(flyingMissile.emitPlayerSocketId);
          let score = Math.min(playerObj.score, 500);
          score = Math.max(score, 100);
          emitPlayer.score += score;
          playersMap.set(flyingMissile.emitPlayerSocketId, emitPlayer);
        }
        playerObj.score -= gameObj.missileDamage; // ダメージ計算
        // スコア０以下で死亡
        if (playerObj.score <= 0) {
          playerObj.score = 0;
          playerObj.isAlive = false;
        }
        else {
          playerObj.isDamaged = true;
        }
        flyingMissilesMap.delete(missileId); // ミサイル削除
      }
    }
  }
}

// NPCの追加
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
      isDamaged: false,
      deadCount: 0,
      damagedCount: 0,
      direction: 'right',
      speed: 1,
      missilesMany: 0,
      airTime: 99,
      aliveTime: { 'clock': 0, 'seconds': 0 },
      score: 0,
      level: level,
      displayName: `CPU-${id.slice(0, 3)}`,
      playerId: id
    };
    gameObj.NPCMap.set(id, playerObj);
  }
}

// オブジェクト間の距離を計算
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
  playerEmit,
  missileEmit,
  disconnect
};
