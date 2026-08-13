const playButton = document.getElementById("playButton");

const PADDLE_WIDTH = 90;
const PADDLE_HEIGHT = 190;
const BALL_SIZE = 92;
const EDGE_MARGIN = 80;
const PLAYER_SPEED = 720;
const AI_SPEED = 560;
const AI_DEADZONE = 32;
const AI_FOLLOW_RESPONSE = 8;
const BALL_SPEED_X = 520;
const BALL_SPEED_Y = 360;
const MAX_DT = 0.05;

let rafId = 0;
let lastTimestamp = 0;
let running = false;
let playerDirection = 0;
let score = { player: 0, ai: 0 };
let windows = null;
let state = null;
let lastRenderPositions = null;

function popupFeatures(width, height, x, y) {
  return [
    "popup=yes",
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "scrollbars=no",
    "resizable=no",
    `width=${Math.round(width)}`,
    `height=${Math.round(height)}`,
    `left=${Math.round(x)}`,
    `top=${Math.round(y)}`,
    `screenX=${Math.round(x)}`,
    `screenY=${Math.round(y)}`,
  ].join(",");
}

function openPopup(url, name, width, height, x, y) {
  return window.open(url, name, popupFeatures(width, height, x, y));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function play() {
  stopGame();

  const sample = openPopup("./popups/sample.html", "popupPongSample", 260, 140, screenX + 40, screenY + 40);
  if (!sample) {
    playButton.textContent = "Enable popups, then click Play";
    return;
  }

  const bounds = {
    width: screen.availWidth || screen.width,
    height: screen.availHeight || screen.height,
    left: screen.availLeft || 0,
    top: screen.availTop || 0,
  };
  const midY = bounds.top + bounds.height / 2;

  sample.resizeTo(PADDLE_WIDTH, PADDLE_HEIGHT);
  sample.moveTo(bounds.left + EDGE_MARGIN, midY - PADDLE_HEIGHT / 2);

  windows = {
    player: sample,
    ai: openPopup("./popups/ai.html", "popupPongAi", PADDLE_WIDTH, PADDLE_HEIGHT, bounds.left + bounds.width - EDGE_MARGIN - PADDLE_WIDTH, midY - PADDLE_HEIGHT / 2),
    ball: openPopup("./popups/ball.html", "popupPongBall", BALL_SIZE, BALL_SIZE, bounds.left + bounds.width / 2 - BALL_SIZE / 2, midY - BALL_SIZE / 2),
  };

  if (!windows.ai || !windows.ball) {
    closeWindows();
    playButton.textContent = "Allow all popups, then click Play";
    return;
  }

  windows.player.location.replace("./popups/player.html");
  lastRenderPositions = null;
  state = {
    bounds,
    playerY: midY - PADDLE_HEIGHT / 2,
    aiY: midY - PADDLE_HEIGHT / 2,
    ballX: bounds.left + bounds.width / 2 - BALL_SIZE / 2,
    ballY: midY - BALL_SIZE / 2,
    ballVX: BALL_SPEED_X * (Math.random() > 0.5 ? 1 : -1),
    ballVY: BALL_SPEED_Y * (Math.random() > 0.5 ? 1 : -1),
  };

  running = true;
  playButton.textContent = "Play";
  lastTimestamp = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stopGame() {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function closeWindows() {
  if (!windows) return;
  for (const child of Object.values(windows)) {
    if (child && !child.closed) child.close();
  }
  windows = null;
}

function tick(timestamp) {
  if (!running || !windows || windows.player.closed || windows.ai.closed || windows.ball.closed) {
    stopGame();
    return;
  }

  const dt = Math.min((timestamp - lastTimestamp) / 1000, MAX_DT);
  lastTimestamp = timestamp;
  update(dt);
  render();
  rafId = requestAnimationFrame(tick);
}

function update(dt) {
  const { bounds } = state;
  const minY = bounds.top;
  const maxY = bounds.top + bounds.height - PADDLE_HEIGHT;

  state.playerY = clamp(state.playerY + playerDirection * PLAYER_SPEED * dt, minY, maxY);

  const ballCenter = state.ballY + BALL_SIZE / 2;
  const aiTargetY = ballCenter - PADDLE_HEIGHT / 2;
  const aiOffset = aiTargetY - state.aiY;

  if (Math.abs(aiOffset) > AI_DEADZONE) {
    const aiStep = clamp(aiOffset * AI_FOLLOW_RESPONSE * dt, -AI_SPEED * dt, AI_SPEED * dt);
    state.aiY = clamp(state.aiY + aiStep, minY, maxY);
  }

  state.ballX += state.ballVX * dt;
  state.ballY += state.ballVY * dt;

  if (state.ballY <= bounds.top || state.ballY + BALL_SIZE >= bounds.top + bounds.height) {
    state.ballY = clamp(state.ballY, bounds.top, bounds.top + bounds.height - BALL_SIZE);
    state.ballVY *= -1;
  }

  bounceFromPaddle("player");
  bounceFromPaddle("ai");

  if (state.ballX + BALL_SIZE < bounds.left) {
    score.ai += 1;
    resetBall(1);
  } else if (state.ballX > bounds.left + bounds.width) {
    score.player += 1;
    resetBall(-1);
  }
}

function bounceFromPaddle(side) {
  const isPlayer = side === "player";
  const paddleX = isPlayer ? state.bounds.left + EDGE_MARGIN : state.bounds.left + state.bounds.width - EDGE_MARGIN - PADDLE_WIDTH;
  const paddleY = isPlayer ? state.playerY : state.aiY;
  const ballRight = state.ballX + BALL_SIZE;
  const paddleRight = paddleX + PADDLE_WIDTH;
  const overlapsX = state.ballX < paddleRight && ballRight > paddleX;
  const overlapsY = state.ballY < paddleY + PADDLE_HEIGHT && state.ballY + BALL_SIZE > paddleY;

  if (!overlapsX || !overlapsY) return;
  if (isPlayer && state.ballVX >= 0) return;
  if (!isPlayer && state.ballVX <= 0) return;

  const paddleCenter = paddleY + PADDLE_HEIGHT / 2;
  const ballCenter = state.ballY + BALL_SIZE / 2;
  const hitOffset = (ballCenter - paddleCenter) / (PADDLE_HEIGHT / 2);
  state.ballVX = Math.abs(state.ballVX) * (isPlayer ? 1.04 : -1.04);
  state.ballVY = clamp(hitOffset, -1, 1) * 520;
  state.ballX = isPlayer ? paddleRight : paddleX - BALL_SIZE;
}

function resetBall(direction) {
  state.ballX = state.bounds.left + state.bounds.width / 2 - BALL_SIZE / 2;
  state.ballY = state.bounds.top + state.bounds.height / 2 - BALL_SIZE / 2;
  state.ballVX = BALL_SPEED_X * direction;
  state.ballVY = BALL_SPEED_Y * (Math.random() > 0.5 ? 1 : -1);
  document.title = `Popup Pong ${score.player}-${score.ai}`;
}

function moveWindow(windowRef, key, x, y) {
  const nextX = Math.round(x);
  const nextY = Math.round(y);
  const previous = lastRenderPositions?.[key];

  if (previous && previous.x === nextX && previous.y === nextY) return;

  windowRef.moveTo(nextX, nextY);
  lastRenderPositions = {
    ...lastRenderPositions,
    [key]: { x: nextX, y: nextY },
  };
}

function render() {
  const aiX = state.bounds.left + state.bounds.width - EDGE_MARGIN - PADDLE_WIDTH;
  moveWindow(windows.player, "player", state.bounds.left + EDGE_MARGIN, state.playerY);
  moveWindow(windows.ai, "ai", aiX, state.aiY);
  moveWindow(windows.ball, "ball", state.ballX, state.ballY);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") playerDirection = -1;
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") playerDirection = 1;
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if ((key === "arrowup" || key === "w") && playerDirection < 0) playerDirection = 0;
  if ((key === "arrowdown" || key === "s") && playerDirection > 0) playerDirection = 0;
});

window.addEventListener("beforeunload", closeWindows);
playButton.addEventListener("click", play);

window.addEventListener("message",e=>{
 if(!e.data||e.data.type!=="key")return;
 const k=e.data.key.toLowerCase();
 if(e.data.down){
  if(k==="w"||k==="arrowup")playerDirection=-1;
  if(k==="s"||k==="arrowdown")playerDirection=1;
 }else{
  if((k==="w"||k==="arrowup")&&playerDirection<0)playerDirection=0;
  if((k==="s"||k==="arrowdown")&&playerDirection>0)playerDirection=0;
 }
});
