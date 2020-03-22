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
  myDisplayName: '',
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
  // プレイヤーの画像
  gameObj.playerImage = new Image();
  gameObj.playerImage.src = '/images/player.png';
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
  movePlayer(gameObj.myPlayerObj);
  gameObj.ctxRadar.clearRect(0, 0, gameObj.radarCanvasWidth, gameObj.radarCanvasHeight);
  if (gameObj.myPlayerObj.isAlive) drawRadar(gameObj.ctxRadar);
  drawMap(gameObj);
  drawPlayer(gameObj.ctxRadar, gameObj.myPlayerObj);
  if (!gameObj.myPlayerObj.isAlive && gameObj.myPlayerObj.deadCount > 60) {
    drawGameOver(gameObj.ctxRadar);
  }
  if (gameObj.myPlayerObj.firstPlay) {
    drawStart(gameObj.ctxRadar);
  }
}

function tickerScore() {
  if (!gameObj.myPlayerObj || !gameObj.playersMap) return;
  drawAirTimer(gameObj.myPlayerObj.airTime);
  drawMissiles(gameObj.myPlayerObj.missilesMany);
  drawScore(gameObj.myPlayerObj.score);
  drawRanking(gameObj.playersMap);
  sendPlayerEmit(socket, gameObj.myPlayerObj);
}

setInterval(tickerRadar, 10);
setInterval(tickerScore, 100);

// サーバーへプレイヤーデータを送る
function sendPlayerEmit(socket, player) {
  const playerData = [];
  playerData.push(player.x);
  playerData.push(player.y);
  playerData.push(player.direction);
  socket.emit('update player', playerData);
}

// プレイヤーの移動
function movePlayer(player) {
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

// レーダーの描画
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

// プレイヤーの描画
function drawPlayer(ctxRadar, myPlayerObj) {
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
    gameObj.playerImage, -(gameObj.playerImage.width / 2), -(gameObj.playerImage.height / 2)
  );
  ctxRadar.restore();
  if (myPlayerObj.isDamaged) {
    drawBom(ctxRadar, gameObj.radarCanvasWidth / 2, gameObj.radarCanvasHeight / 2, myPlayerObj.damagedCount);
  }
}

// 爆発の描画
function drawBom(ctxRadar, drawX, drawY, count) {
  if (count >= 60) return;
  const drawBomNumber = Math.floor(count / 6);
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

// ミサイルの表示
function drawMissiles(missilesMany) {
  $('#missiles').empty();
  for (let i = 0; i < missilesMany; i++) {
    $('#missiles').append('<img src="/images/missile.png">');
  }
}

// 酸素タイマーの表示
function drawAirTimer(airTime) {
  $('#air-time').text(airTime);
}

// スコアの表示
function drawScore(score) {
  if (!gameObj.myPlayerObj.isAlive) return;
  if (!score) score = 0;
  $('#score').text(score);
}

// ランキングの表示
function drawRanking(playersMap) {
  const playersArray = [].concat(Array.from(playersMap));
  playersArray.sort((a, b) => (b[1].score - a[1].score));
  $('#ranking').empty();
  for (let i = 0; i < 8; i++) {
    if (!playersArray[i]) return;
    const rank = i + 1;
    let score = playersArray[i][1].score;
    if (score > 99999) score = 'MAX☆';
    $('#ranking').append(`<tr id="${rank}">
      <td>${rank}位</td>
      <td>${playersArray[i][1].displayName}</td>
      <td>${score}</td>
    </tr>`);
    if (gameObj.myPlayerObj.playerId === playersArray[i][0]) {
      $('#ranking').find(`#${rank}`).css('color', '#DD0000');
    }
  }
}

// マップの描画
function drawMap(gameObj) {
  // 敵プレイヤーとNPCの描画
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
      if (enemyPlayerObj.isDamaged) {
        drawBom(gameObj.ctxRadar, distanceObj.drawX, distanceObj.drawY, enemyPlayerObj.damagedCount);
      }
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

// ゲームオーバーの描画
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

// スタートメッセージの描画
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

// オブジェクト間の距離を計算
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

// 二点間の角度を計算
function calcTwoPointsDegree(x1, y1, x2, y2) {
  const radian = Math.atan2(y2 - y1, x2 - x1);
  const degree = radian * 180 / Math.PI + 180;
  return degree;
}

// レーダーとアイテムとの角度差を計算
function calcDegreeDiffFromRadar(degRadar, degItem) {
  let diff = degRadar - degItem;
  if (diff < 0) diff += 360;
  return diff;
}

// 角度差から透明度を計算
function calcOpacity(degreeDiff) {
  degreeDiff = Math.abs(180 - degreeDiff);
  return ((degreeDiff / 180) ** 2).toFixed(2);
}

// 移動およびミサイル発射を検出
$(window).keydown((event) => {
  if ($('input').is(':focus')) return;
  if (!gameObj.myPlayerObj || !gameObj.myPlayerObj.isAlive) return;
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      gameObj.myPlayerObj.speed = 2;
      if (gameObj.myPlayerObj.direction === 'left') break;
      gameObj.myPlayerObj.direction = 'left';
      break;
    case 'ArrowUp':
      event.preventDefault();
      gameObj.myPlayerObj.speed = 2;
      if (gameObj.myPlayerObj.direction === 'up') break;
      gameObj.myPlayerObj.direction = 'up';
      break;
    case 'ArrowDown':
      event.preventDefault();
      gameObj.myPlayerObj.speed = 2;
      if (gameObj.myPlayerObj.direction === 'down') break;
      gameObj.myPlayerObj.direction = 'down';
      break;
    case 'ArrowRight':
      event.preventDefault();
      gameObj.myPlayerObj.speed = 2;
      if (gameObj.myPlayerObj.direction === 'right') break;
      gameObj.myPlayerObj.direction = 'right';
      break;
    case ' ':
      event.preventDefault();
      if (gameObj.myPlayerObj.missilesMany <= 0) break;
      socket.emit('missile emit', gameObj.myPlayerObj.direction);
      break;
  }
});

// 押しっぱなし解除
$(window).keyup((event) => {
  if ($('input').is(':focus')) return;
  if (!gameObj.myPlayerObj || !gameObj.myPlayerObj.isAlive) return;
  switch (event.key) {
    case 'ArrowLeft':
      gameObj.myPlayerObj.speed = 1;
      break;
    case 'ArrowUp':
      gameObj.myPlayerObj.speed = 1;
      break;
    case 'ArrowDown':
      gameObj.myPlayerObj.speed = 1;
      break;
    case 'ArrowRight':
      gameObj.myPlayerObj.speed = 1;
      break;
  }
});

// スタートを検出
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

// スタートを検出
$('#start').click(() => {
  if (gameObj.playersMap.get(gameObj.myPlayerObj.playerId)) return;
  sendStart(socket);
});

// サーバーへスタートの合図を送る
function sendStart(socket) {
  let displayName = $('#displayName').val().trim();
  if (!displayName) displayName = '名無しさん';
  $('#displayName').attr('readonly', true);
  $('#displayName').val(displayName);
  $('#start').attr('disabled', true);
  socket.emit('start game', displayName);
}

// スタート時にサーバーからデータを受け取る
socket.on('start data', (startObj) => {
  gameObj.myPlayerObj = startObj.playerObj;
  gameObj.fieldWidth = startObj.fieldWidth;
  gameObj.fieldHeight = startObj.fieldHeight;
});

// 定期的にサーバーからデータを受け取る
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
    player.isDamaged = compressedPlayerData[10];
    player.damagedCount = compressedPlayerData[11];
    gameObj.playersMap.set(player.playerId, player);
    // 自分の情報も更新
    if (player.playerId === gameObj.myPlayerObj.playerId) {
      gameObj.myPlayerObj.score = compressedPlayerData[4];
      gameObj.myPlayerObj.isAlive = compressedPlayerData[5];
      gameObj.myPlayerObj.missilesMany = compressedPlayerData[7];
      gameObj.myPlayerObj.airTime = compressedPlayerData[8];
      gameObj.myPlayerObj.deadCount = compressedPlayerData[9];
      gameObj.myPlayerObj.isDamaged = compressedPlayerData[10];
      gameObj.myPlayerObj.damagedCount = compressedPlayerData[11];
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
