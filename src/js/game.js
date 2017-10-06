/* eslint-env browser */

const Game = function (socket, canvas, mouse) {
  this.paletteBg = ['#848cff', '#88a2ff', '#97bdff', '#a9c9ff', '#c7dcff'];

  this.socket = socket;

  this.canvas = canvas;
  this.canvas.width = window.innerWidth;
  this.canvas.height = window.innerHeight;
  this.ctx = canvas.getContext('2d');

  this.players = {};
  this.myPlayer = new Player();

  this.crumbs = {};

  this.mouse = mouse;

  this.gameState = 'PLAYING';
};

Game.prototype.init = function () {
  const _this = this;
  this.socket = io.connect();

  this.socket.on('playerInfo', (data) => {
    _this.myPlayer = new Player(data.id, data.name, data.type, data.color, data.mass);
    _this.players[data.id] = _this.myPlayer;
    console.log(`Connected with id: ${_this.myPlayer.id}`);
  });

  window.onbeforeunload = () => {
    this.socket.emit('playerLeft', { id: this.myPlayer.id });
  };

  this.socket.emit('currentPlayers');
  this.socket.on('currentPlayers', (data) => {
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      const playerData = data[keys[i]];
      // if (playerData.id === _this.players.id) continue;
      _this.players[playerData.id] = new Player(
        playerData.id,
        playerData.name,
        playerData.type,
        playerData.color,
        playerData.mass);
      _this.players[playerData.id].loc = new Victor(playerData.loc.x, playerData.loc.y);
    }
  });

  this.socket.on('newPlayer', (data) => {
    if (!data) return;
    console.log(`player joined: ${data}`);
    _this.players[data.id] = new Player(data.id, data.name, data.type, data.mass);
  });

  this.socket.on('playerMoved', (data) => {
    if (_this.players[data.id]) _this.players[data.id].loc = data.loc;
  });

  this.socket.on('playerLeft', (data) => {
    delete _this.players[data.id];
  });

  this.socket.on('collided', (data) => {
    if (data.dead) {
      _this.gameState = 'DEAD';
      _this.socket.disconnect();
      // _this.myPlayer = undefined;
    }

    _this.players[data.id].collide(data);
    _this.myPlayer.collide(data);
  });

  this.socket.on('currentCrumbs', (data) => {
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      const crumbData = data[keys[i]];
      // if (crumbData.id === _this.crumbs.id) continue;
      _this.crumbs[crumbData.id] = new Crumb(
        crumbData.id,
        new Victor(crumbData.loc.x, crumbData.loc.y),
        crumbData.mass);
    }
  });

  this.socket.on('crumbAdded', (data) => {
    _this.crumbs[data.id] = new Crumb(data.id, data.loc, data.mass);
  });

  this.socket.on('crumbRemoved', (data) => {
    delete _this.crumbs[data.id];
  });

  this.socket.on('crumbEaten', (data) => {
    _this.players[data.id].mass = data.mass;
  });

  this.canvas.onmousemove = function (e) {
    _this.mouse.handleMove(e);
    _this.socket.emit('moved');
  };

  this.start();
};

Game.prototype.start = function () {
  window.requestAnimationFrame(() => { this.tick(); });
};

Game.prototype.stop = function () {
  window.cancelAnimationFrame();
};

Game.prototype.tick = function () {
  if (this.mouse.loc.distance(this.myPlayer.loc) > 10) {
    this.socket.emit('playerMoved', {
      id: this.myPlayer.id,
      loc: { x: this.myPlayer.loc.x, y: this.myPlayer.loc.y },
    });
    this.myPlayer.move(this.mouse.loc, this.mouse.prevLoc);
  }

  this.checkPlayerCollisions();
  this.checkCrumbPlayerCollisions();
  this.draw();

  // Which browsers is this supported for?
  window.requestAnimationFrame(() => { this.tick(); });
};

/*
 *  GAAAAME LOGIC
 */

Game.prototype.checkPlayerCollisions = function () {
  const keys = Object.keys(this.players);
  for (let i = 0; i < keys.length; i++) {
    if (this.myPlayer.id !== keys[i]) {
      this.myPlayer.checkCollision(this.players[keys[i]], () => {
        this.socket.emit('collision', {
          id: keys[i],
        });
      });
    }
  }
};

Game.prototype.checkCrumbPlayerCollisions = function () {
  const keys = Object.keys(this.crumbs);
  for (let i = 0; i < keys.length; i++) {
    this.myPlayer.checkCollision(this.crumbs[keys[i]], () => {
      this.myPlayer.eat(this.crumbs[keys[i]]);
      this.socket.emit('crumbRemoved', { id: keys[i] });
      this.socket.emit('crumbEaten', { id: this.myPlayer.id, mass: this.myPlayer.mass });
    });
  }
};

/*
 *  CANVAS, DRAWING, ACTION!
 */

// Main draw function
Game.prototype.draw = function () {
  this.clearCanvas();
  this.drawBackground();
  this.drawCrumbs();
  this.drawPlayers();
  if (this.gameState === 'DEAD') this.drawEndGame();
};

// Clear the canvas to an ugly shade of puce
Game.prototype.clearCanvas = function () {
  this.ctx.save();

  this.ctx.fillStyle = this.paletteBg[this.paletteBg.length];
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  this.ctx.restore();
};

// Draw the background
Game.prototype.drawBackground = function () {
  this.ctx.save();

  this.ctx.fillStyle = this.paletteBg[1];
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  this.ctx.restore();
};

// Draw all the players we know about
Game.prototype.drawPlayers = function () {
  const keys = Object.keys(this.players);
  for (let i = 0; i < keys.length; i++) {
    this.players[keys[i]].draw(this.ctx);
  }
};

Game.prototype.drawCrumbs = function () {
  const keys = Object.keys(this.crumbs);
  for (let i = 0; i < keys.length; i++) {
    this.crumbs[keys[i]].draw(this.ctx);
  }
};

Game.prototype.drawEndGame = function () {
  this.ctx.save();

  this.ctx.globalAlpha = 0.5;
  this.ctx.fillStyle = '#000';
  this.ctx.fillRect(0, this.canvas.height / 4, this.canvas.width, this.canvas.height / 2);

  this.ctx.fillStyle = '#FFF';
  this.ctx.font = '50px Arial';
  this.ctx.globalAlpha = 1;
  this.ctx.fillText('You were eaten!', this.canvas.width / 3, (this.canvas.height / 2) - 40);
  this.ctx.font = '30px Arial';
  this.ctx.fillText('Refresh the page to try again.', (this.canvas.width / 3) - 20, (this.canvas.height / 2) + 40);

  this.ctx.restore();
};
