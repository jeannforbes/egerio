const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT);

app.get('/', (req, res) => { res.sendFile(`${__dirname}/index.html`); });

app.get('/style.css', (req, res) => { res.sendFile(`${__dirname}/css/style.css`); });

app.get('/victor.js', (req, res) => { res.sendFile(`${__dirname}/lib/victor-1.1.0/build/victor.min.js`); });

app.get('/main.js', (req, res) => { res.sendFile(`${__dirname}/js/main.js`); });
app.get('/game.js', (req, res) => { res.sendFile(`${__dirname}/js/game.js`); });
app.get('/mouse.js', (req, res) => { res.sendFile(`${__dirname}/js/mouse.js`); });
app.get('/player.js', (req, res) => { res.sendFile(`${__dirname}/js/player.js`); });
app.get('/crumb.js', (req, res) => { res.sendFile(`${__dirname}/js/crumb.js`); });

// Starting CONSTs

const NAMES = ['scrapple', 'balrug', 'ewe', 'pandini', 'fuchs'];
const MASS = 25;

// What does the server need to track?

const players = {};
const crumbs = {};
const clients = [];

const palettePlayer = ['red', 'green', 'yellow', 'orange'];

/* 
 *  HELPER FUNCTIONS 
 */

const getRandom = arr => arr[parseInt(Math.random() * arr.length, 10)];

const removeCrumb = (id) => {
  delete crumbs[id];
  io.emit('crumbRemoved', { id });
};

const addCrumb = () => {
  const id = Date.now();
  const crumb = {
    id,
    loc: { x: (Math.random() * 500), y: (Math.random() * 600) },
    mass: parseInt(Math.random() * 5, 10) + 2,
  };
  crumbs[id] = crumb;
  setTimeout(() => { removeCrumb(id); }, (10000 * Math.random()) + 1000);

  io.emit('crumbAdded', crumb);
};

/*
 *  WEBSOCKETS, BABY!
 */

io.on('connect', (socket) => {
  // Assign the new player an id
  const newPlayer = {
    name: getRandom(NAMES), // name
    id: socket.id,
    type: 0, // type
    joined: Date.now(),
    lastTimeoutCheck: Date.now(),
    loc: { x: 0, y: 0 },
    color: palettePlayer[parseInt(Math.random() * palettePlayer.length, 10)],
    mass: MASS,
  };
  players[newPlayer.id] = newPlayer;
  socket.emit('playerInfo', newPlayer); // let the new player know their info
  io.emit('newPlayer', newPlayer); // let everyone know there's a new player
  io.emit('currentCrumbs', crumbs);

  // Add a new client
  clients[newPlayer.id] = socket;

  // Update player location on move
  socket.on('playerMoved', (data) => {
    if (!players[data.id]) return;

    if (data.loc) players[data.id].loc = { x: data.loc.x, y: data.loc.y };
    else players[data.id].loc = { x: 0, y: 0 };
    io.emit('playerMoved', data);
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', { id: socket.id });
  });

  socket.on('collision', (data) => {
    /*
         *  We will need some collision checking here to prevent cheating
         */

    // Check that these clients exist
    if (!clients[data.id] || !clients[socket.id]) return;

    const p1 = players[socket.id];
    const p2 = players[data.id];

    if (p1.mass < p2.mass) {
      clients[socket.id].emit('collided', { id: data.id, dead: true });
      clients[data.id].emit('collided', {
        id: socket.id,
        dead: false,
        mass: p1.mass,
      });
    } else if (p1.mass > p2.mass) {
      clients[socket.id].emit('collided', {
        id: data.id,
        dead: false,
        mass: p2.mass,
      });
      clients[data.id].emit('collided', { id: socket.id, dead: true });
    }
  });

  socket.on('crumbRemoved', (data) => {
    delete crumbs[data.id];
    if (data.playerId && data.playerMass) players[data.playerId].mass = data.playerMass;
    io.emit('crumbRemoved', data);
  });

  socket.on('currentCrumbs', () => {
    socket.emit('currentCrumbs', crumbs);
  });

  // Returns the list of current players when requested
  socket.on('currentPlayers', () => {
    socket.emit('currentPlayers', players);
  });

  socket.on('crumbEaten', (data) => {
    players[data.id].mass = data.mass;
    socket.emit('crumbEaten', data);
  });

  // Add some crumbs for a new player
  addCrumb();
  addCrumb();
  addCrumb();
  addCrumb();
});

setInterval(addCrumb, 2000);
