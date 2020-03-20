'use strict';

import $ from 'jquery';
import io from 'socket.io-client';

const gameObj = {
  radarCanvasWidth: 600,
  radarCanvasHeight: 600,
  scoreCanvasWidth: 300,
  scoreCanvasHeight: 600,
  itemRadius: 4,
  airRadius: 5,
  bomCellPx: 32,
  deg: 0,
  counter: 0,
  rotationDegreeByDirection: {
    'left': 0,
    'up': 270,
    'down': 90,
    'right': 0
  },
  rotationDegreeByFlyingMissileDirection: {
    'left': 270,
    'up': 0,
    'down': 180,
    'right': 90
  },
  myDisplayName: $('#main').attr('data-displayName'),
  myPlayerObj: { x: 500, y: 500, isAlive: false, airTime: 99, firstPlay: true },
  fieldWidth: 1000,
  fieldHeight: 1000,
  playersMap: new Map(),
  itemsMap: new Map(),
  airMap: new Map(),
  flyingMissilesMap: new Map()
};

const socket = io($('#main').attr('data-host'));

function init() {
  // ゲーム用のキャンバス
  const radarCanvas = $('#radar')[0];
  radarCanvas.width = gameObj.radarCanvasWidth;
  radarCanvas.height = gameObj.radarCanvasHeight;
  gameObj.ctxRadar = radarCanvas.getContext('2d');
  // ランキング用のキャンバス
  const scoreCanvas = $('#score')[0];
  scoreCanvas.width = gameObj.scoreCanvasWidth;
  scoreCanvas.height = gameObj.scoreCanvasHeight;
  gameObj.ctxScore = scoreCanvas.getContext('2d');
  // 潜水艦の画像
  gameObj.submarineImage = new Image();
  gameObj.submarineImage.src = '/images/submarine.png';
  // 敵プレイヤーの画像
  gameObj.enemyImage = new Image();
  gameObj.enemyImage.src = '/images/enemy.png';
  // ミサイルの画像
  gameObj.missileImage = new Image();
  gameObj.missileImage.src = '/images/missile.png';
  // 爆発の画像集
  gameObj.bomListImage = new Image();
  gameObj.bomListImage.src = '/images/bomlist.png';
}

init();

function tickerRadar() {
  if (!gameObj.myPlayerObj || !gameObj.playersMap) return;
  gameObj.ctxRadar.clearRect(0, 0, gameObj.radarCanvasWidth, gameObj.radarCanvasHeight);
  if (gameObj.myPlayerObj.isAlive) drawRadar(gameObj.ctxRadar);
  drawMap(gameObj);
  drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
  if (!gameObj.myPlayerObj.isAlive && gameObj.myPlayerObj.deadCount > 60) {
    drawGameOver(gameObj.ctxRadar);
  }
  if (gameObj.myPlayerObj.firstPlay) {
    drawStart(gameObj.ctxRadar);
  }
  gameObj.counter = (gameObj.counter + 0.5) % 10000;
}

function tickerScore() {
  if (!gameObj.myPlayerObj || !gameObj.playersMap) return;
  gameObj.ctxScore.clearRect(0, 0, gameObj.scoreCanvasWidth, gameObj.scoreCanvasHeight);
  drawAirTimer(gameObj.ctxScore, gameObj.myPlayerObj.airTime);
  drawMissiles(gameObj.ctxScore, gameObj.myPlayerObj.missilesMany);
  drawScore(gameObj.ctxScore, gameObj.myPlayerObj.score);
  drawRanking(gameObj.ctxScore, gameObj.playersMap);
}

setInterval(tickerRadar, 10);
setInterval(tickerScore, 100);

function drawRadar(ctxRadar) {
  const x = gameObj.radarCanvasWidth / 2;
  const y = gameObj.radarCanvasHeight / 2;
  const r = gameObj.radarCanvasWidth * 1.5 / 2; // 対角線の長さの半分
  switch (gameObj.myPlayerObj.direction) {
    case 'up':
      gameObj.deg = 270;
      break;
    case 'right':
      gameObj.deg = 0;
      break;
    case 'down':
      gameObj.deg = 90;
      break;
    case 'left':
      gameObj.deg = 180;
      break;
  }
  ctxRadar.save(); // セーブ
  ctxRadar.beginPath();
  ctxRadar.translate(x, y);
  ctxRadar.rotate(getRadian(gameObj.deg));
  ctxRadar.fillStyle = 'rgba(0, 220, 0, 0.3)';
  ctxRadar.arc(0, 0, r, getRadian(15), getRadian(-15), true);
  ctxRadar.lineTo(0, 0);
  ctxRadar.fill();
  ctxRadar.restore(); // 元の設定を取得
}

function drawSubmarine(ctxRadar, myPlayerObj) {
  if (!myPlayerObj.isAlive) {
    drawBom(ctxRadar, gameObj.radarCanvasWidth / 2, gameObj.radarCanvasHeight / 2, myPlayerObj.deadCount);
    return;
  }
  const rotationDegree = gameObj.rotationDegreeByDirection[myPlayerObj.direction];
  ctxRadar.save();
  ctxRadar.translate(gameObj.radarCanvasWidth / 2, gameObj.radarCanvasHeight / 2);
  ctxRadar.rotate(getRadian(rotationDegree));
  if (myPlayerObj.direction === 'left') ctxRadar.scale(-1, 1);
  ctxRadar.drawImage(
    gameObj.submarineImage, -(gameObj.submarineImage.width / 2), -(gameObj.submarineImage.height / 2)
  );
  ctxRadar.restore();
}

function drawBom(ctxRadar, drawX, drawY, deadCount) {
  if (deadCount >= 60) return;
  const drawBomNumber = Math.floor(deadCount / 6);
  const cropX = (drawBomNumber % (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;
  const cropY = Math.floor(drawBomNumber / (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;
  ctxRadar.drawImage(
    gameObj.bomListImage,
    cropX, cropY,
    gameObj.bomCellPx, gameObj.bomCellPx,
    drawX - gameObj.bomCellPx * 4 / 2, drawY - gameObj.bomCellPx * 4 / 2,
    gameObj.bomCellPx * 4, gameObj.bomCellPx * 4
  ); // 画像データ、切り抜き左、切り抜き上、幅、幅、表示x、表示y、幅、幅
}

function drawMissiles(ctxScore, missilesMany) {
  for (let i = 0; i < missilesMany; i++) {
    ctxScore.drawImage(gameObj.missileImage, 50 * i, 80);
  }
}

function drawAirTimer(ctxScore, airTime) {
  ctxScore.fillStyle = "rgb(0, 220, 250)";
  ctxScore.font = 'bold 40px Arial';
  ctxScore.fillText(airTime, 130, 50);
}

function drawScore(ctxScore, score) {
  if (!score) score = 0;
  ctxScore.fillStyle = "rgb(26, 26, 26)";
  ctxScore.font = '28px Arial';
  ctxScore.fillText(`score: ${score}`, 10, 180);
}

function drawRanking(ctxScore, playersMap) {
  const playersArray = [].concat(Array.from(playersMap));
  playersArray.sort((a, b) => (b[1].score - a[1].score));
  ctxScore.fillStyle = "rgb(0, 0, 0)";
  ctxScore.fillRect(0, 220, gameObj.scoreCanvasWidth, 3);
  ctxScore.fillStyle = "rgb(26, 26, 26)";
  ctxScore.font = '20px Arial';
  for (let i = 0; i < 10; i++) {
    if (!playersArray[i]) return;
    const rank = i + 1;
    ctxScore.fillText(
      `${rank}位 ${playersArray[i][1].displayName} : ${playersArray[i][1].score}`,
      10, 230 + (rank * 30)
    );
  }
}

function drawMap(gameObj) {
  // 敵プレイヤーと NPC の描画
  for (let [key, enemyPlayerObj] of gameObj.playersMap) {
    if (key === gameObj.myPlayerObj.playerId) continue; // 自分は描画しない
    const distanceObj = calcBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      enemyPlayerObj.x, enemyPlayerObj.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );
    if (distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2)) {
      if (!enemyPlayerObj.isAlive) {
        drawBom(gameObj.ctxRadar, distanceObj.drawX, distanceObj.drawY, enemyPlayerObj.deadCount);
        continue;
      }
      const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
      const opacity = calcOpacity(degreeDiff);
      const rotationDegree = gameObj.rotationDegreeByDirection[enemyPlayerObj.direction];
      gameObj.ctxRadar.save();
      gameObj.ctxRadar.translate(distanceObj.drawX, distanceObj.drawY);
      gameObj.ctxRadar.rotate(getRadian(rotationDegree));
      if (enemyPlayerObj.direction === 'left') gameObj.ctxRadar.scale(-1, 1);
      gameObj.ctxRadar.globalAlpha = opacity;
      gameObj.ctxRadar.drawImage(
        gameObj.enemyImage, -(gameObj.enemyImage.width / 2), -(gameObj.enemyImage.height / 2)
      );
      gameObj.ctxRadar.restore();
      gameObj.ctxRadar.strokeStyle = `rgba(250, 250, 250, ${opacity})`;
      gameObj.ctxRadar.fillStyle = `rgba(250, 250, 250, ${opacity})`;
      gameObj.ctxRadar.font = '12px Arial';
      gameObj.ctxRadar.fillText(enemyPlayerObj.displayName, distanceObj.drawX, distanceObj.drawY - 30);
    }
  }
  // アイテムの描画
  for (let [key, item] of gameObj.itemsMap) {
    const distanceObj = calcBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      item.x, item.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );
    if (distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2)) {
      const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
      const opacity = calcOpacity(degreeDiff);
      gameObj.ctxRadar.fillStyle = `rgba(255, 165, 0, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, gameObj.itemRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();
    }
  }
  // 空気の描画
  for (let [key, airObj] of gameObj.airMap) {
    const distanceObj = calcBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      airObj.x, airObj.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );
    if (distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2)) {
      const degreeDiff = calcDegreeDiffFromRadar(gameObj.deg, distanceObj.degree);
      const opacity = calcOpacity(degreeDiff);
      gameObj.ctxRadar.fillStyle = `rgba(0, 220, 255, ${opacity})`;
      gameObj.ctxRadar.beginPath();
      gameObj.ctxRadar.arc(distanceObj.drawX, distanceObj.drawY, gameObj.airRadius, 0, Math.PI * 2, true);
      gameObj.ctxRadar.fill();
    }
  }
  // 飛んでいるミサイルの描画
  for (let [missileId, flyingMissile] of gameObj.flyingMissilesMap) {
    const distanceObj = calcBetweenTwoPoints(
      gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
      flyingMissile.x, flyingMissile.y,
      gameObj.fieldWidth, gameObj.fieldHeight,
      gameObj.radarCanvasWidth, gameObj.radarCanvasHeight
    );
    if (
      distanceObj.distanceX <= (gameObj.radarCanvasWidth / 2 + 50) &&
      distanceObj.distanceY <= (gameObj.radarCanvasHeight / 2 + 50)
    ) {
      const rotationDegree = gameObj.rotationDegreeByFlyingMissileDirection[flyingMissile.direction];
      gameObj.ctxRadar.save();
      gameObj.ctxRadar.translate(distanceObj.drawX, distanceObj.drawY);
      gameObj.ctxRadar.rotate(getRadian(rotationDegree));
      gameObj.ctxRadar.drawImage(
        gameObj.missileImage, -gameObj.missileImage.width / 2, -gameObj.missileImage.height / 2
      );
      gameObj.ctxRadar.restore();
    }
  }
}

function drawGameOver(ctxRadar) {
  ctxRadar.font = 'bold 76px arial black';
  ctxRadar.fillStyle = "rgb(0, 220, 250)";
  ctxRadar.fillText('Game Over', 70, 320);
  ctxRadar.strokeStyle = "rgb(0, 0, 0)";
  ctxRadar.lineWidth = 3;
  ctxRadar.strokeText('Game Over', 70, 320);
  ctxRadar.font = 'bold 32px arial black';
  ctxRadar.fillStyle = "rgb(0, 220, 250)";
  ctxRadar.fillText('スペースキーでリスタート！', 100, 400);
}

function drawStart(ctxRadar) {
  ctxRadar.font = 'bold 48px arial black';
  ctxRadar.fillStyle = "rgb(0, 220, 250)";
  ctxRadar.fillText('スペースキーでスタート！', 20, 320);
  ctxRadar.font = 'bold 24px arial black';
  ctxRadar.fillStyle = "rgb(255, 255, 255)";
  ctxRadar.fillText('矢印キー：移動', 40, 400);
  ctxRadar.fillText('スペースキー：ミサイル発射', 40, 440);
  ctxRadar.fillText('青玉：酸素補給', 40, 480);
  ctxRadar.fillText('橙玉：ミサイル補充', 40, 520);
}

function getRadian(kakudo) {
  return kakudo * Math.PI / 180;
}

function calcBetweenTwoPoints(pX, pY, oX, oY, gameWidth, gameHeight, radarCanvasWidth, radarCanvasHeight) {
  let distanceX = 99999999;
  let distanceY = 99999999;
  let drawX = null;
  let drawY = null;
  if (pX <= oX) {
    // 右から
    distanceX = oX - pX;
    drawX = (radarCanvasWidth / 2) + distanceX;
    // 左から
    let tmpDistance = pX + gameWidth - oX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
      drawX = (radarCanvasWidth / 2) - distanceX;
    }
  } else {
    // 右から
    distanceX = pX - oX;
    drawX = (radarCanvasWidth / 2) - distanceX;
    // 左から
    let tmpDistance = oX + gameWidth - pX;
    if (distanceX > tmpDistance) {
      distanceX = tmpDistance;
      drawX = (radarCanvasWidth / 2) + distanceX;
    }
  }
  if (pY <= oY) {
    // 下から
    distanceY = oY - pY;
    drawY = (radarCanvasHeight / 2) + distanceY;
    // 上から
    let tmpDistance = pY + gameHeight - oY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
      drawY = (radarCanvasHeight / 2) - distanceY;
    }
  } else {
    // 上から
    distanceY = pY - oY;
    drawY = (radarCanvasHeight / 2) - distanceY;
    // 下から
    let tmpDistance = oY + gameHeight - pY;
    if (distanceY > tmpDistance) {
      distanceY = tmpDistance;
      drawY = (radarCanvasHeight / 2) + distanceY;
    }
  }
  const degree = calcTwoPointsDegree(drawX, drawY, radarCanvasWidth / 2, radarCanvasHeight / 2);
  return { distanceX, distanceY, drawX, drawY, degree };
}

function calcTwoPointsDegree(x1, y1, x2, y2) {
  const radian = Math.atan2(y2 - y1, x2 - x1);
  const degree = radian * 180 / Math.PI + 180;
  return degree;
}

function calcDegreeDiffFromRadar(degRadar, degItem) {
  let diff = degRadar - degItem;
  if (diff < 0) {
    diff += 360;
  }
  return diff;
}

function calcOpacity(degreeDiff) {
  degreeDiff = Math.abs(180 - degreeDiff);
  return ((degreeDiff / 180) ** 2).toFixed(2);
}

$(window).keydown((event) => {
  if ($('input').is(':focus')) return;
  if (!gameObj.myPlayerObj || !gameObj.myPlayerObj.isAlive) return;
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      sendSpeedUp(socket);
      if (gameObj.myPlayerObj.direction === 'left') break;
      gameObj.myPlayerObj.direction = 'left';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'left');
      break;
    case 'ArrowUp':
      event.preventDefault();
      sendSpeedUp(socket);
      if (gameObj.myPlayerObj.direction === 'up') break;
      gameObj.myPlayerObj.direction = 'up';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'up');
      break;
    case 'ArrowDown':
      event.preventDefault();
      sendSpeedUp(socket);
      if (gameObj.myPlayerObj.direction === 'down') break;
      gameObj.myPlayerObj.direction = 'down';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'down');
      break;
    case 'ArrowRight':
      event.preventDefault();
      sendSpeedUp(socket);
      if (gameObj.myPlayerObj.direction === 'right') break;
      gameObj.myPlayerObj.direction = 'right';
      drawSubmarine(gameObj.ctxRadar, gameObj.myPlayerObj);
      sendChangeDirection(socket, 'right');
      break;
    case ' ':
      event.preventDefault();
      if (gameObj.myPlayerObj.missilesMany <= 0) break;
      sendMissileEmit(socket, gameObj.myPlayerObj.direction);
      break;
  }
});

$(window).keyup((event) => {
  if ($('input').is(':focus')) return;
  if (!gameObj.myPlayerObj || !gameObj.myPlayerObj.isAlive) return;
  switch (event.key) {
    case 'ArrowLeft':
      sendSpeedDown(socket);
      break;
    case 'ArrowUp':
      sendSpeedDown(socket);
      break;
    case 'ArrowDown':
      sendSpeedDown(socket);
      break;
    case 'ArrowRight':
      sendSpeedDown(socket);
      break;
  }
});

$(window).keydown((event) => {
  if ($('input').is(':focus')) return;
  if (gameObj.playersMap.get(gameObj.myPlayerObj.playerId)) return;
  switch (event.key) {
    case ' ':
      event.preventDefault();
      sendStart(socket);
      break;
  }
});

$('#start').click(() => {
  if (gameObj.playersMap.get(gameObj.myPlayerObj.playerId)) return;
  sendStart(socket);
});

function sendChangeDirection(socket, direction) {
  socket.emit('change direction', direction);
}

function sendSpeedUp(socket) {
  socket.emit('speed up');
}

function sendSpeedDown(socket) {
  socket.emit('speed down');
}

function sendMissileEmit(socket, direction) {
  socket.emit('missile emit', direction);
}

function sendStart(socket) {
  let displayName = $('#displayName').val().trim();
  if (!displayName) displayName = '名無しさん';
  $('#displayName').attr('readonly', true);
  $('#displayName').val(displayName);
  $('#start').attr('disabled', true);
  socket.emit('start game', displayName);
}

socket.on('start data', (startObj) => {
  gameObj.myPlayerObj = startObj.playerObj;
  gameObj.fieldWidth = startObj.fieldWidth;
  gameObj.fieldHeight = startObj.fieldHeight;
});

socket.on('map data', (compressed) => {
  const playersArray = compressed[0];
  const itemsArray = compressed[1];
  const airArray = compressed[2];
  const flyingMissilesArray = compressed[3];
  gameObj.playersMap = new Map();
  for (let compressedPlayerData of playersArray) {
    const player = {};
    player.x = compressedPlayerData[0];
    player.y = compressedPlayerData[1];
    player.playerId = compressedPlayerData[2];
    player.displayName = compressedPlayerData[3];
    player.score = compressedPlayerData[4];
    player.isAlive = compressedPlayerData[5];
    player.direction = compressedPlayerData[6];
    player.missilesMany = compressedPlayerData[7];
    player.airTime = compressedPlayerData[8];
    player.deadCount = compressedPlayerData[9];
    gameObj.playersMap.set(player.playerId, player);
    // 自分の情報も更新
    if (player.playerId === gameObj.myPlayerObj.playerId) {
      gameObj.myPlayerObj.x = compressedPlayerData[0];
      gameObj.myPlayerObj.y = compressedPlayerData[1];
      gameObj.myPlayerObj.displayName = compressedPlayerData[3];
      gameObj.myPlayerObj.score = compressedPlayerData[4];
      gameObj.myPlayerObj.isAlive = compressedPlayerData[5];
      gameObj.myPlayerObj.missilesMany = compressedPlayerData[7];
      gameObj.myPlayerObj.airTime = compressedPlayerData[8];
      gameObj.myPlayerObj.deadCount = compressedPlayerData[9];
    }
  }
  gameObj.itemsMap = new Map();
  itemsArray.forEach((compressedItemData, index) => {
    gameObj.itemsMap.set(index, { x: compressedItemData[0], y: compressedItemData[1] });
  });
  gameObj.airMap = new Map();
  airArray.forEach((compressedAirData, index) => {
    gameObj.airMap.set(index, { x: compressedAirData[0], y: compressedAirData[1] });
  });
  gameObj.flyingMissilesMap = new Map();
  flyingMissilesArray.forEach((compressedFlyingMissileData, index) => {
    gameObj.flyingMissilesMap.set(index, {
      x: compressedFlyingMissileData[0],
      y: compressedFlyingMissileData[1],
      direction: compressedFlyingMissileData[2],
      emitPlayerId: compressedFlyingMissileData[3]
    });
  });
});
