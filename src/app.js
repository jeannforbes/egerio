var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var victor = require('victor');
var crypto = require('crypto');

const PORT = process.env.PORT || 3000;

server.listen(PORT);

app.get('/', function(req, res){ res.sendFile(__dirname + '/index.html'); });

app.get('/style.css', function(req, res){ res.sendFile(__dirname + '/css/style.css'); });

app.get('/victor.js', function(req, res){ res.sendFile(__dirname + '/lib/victor-1.1.0/build/victor.min.js'); });

app.get('/main.js', function(req, res){ res.sendFile(__dirname + '/js/main.js'); });
app.get('/game.js', function(req, res){ res.sendFile(__dirname + '/js/game.js'); });
app.get('/mouse.js', function(req, res){ res.sendFile(__dirname + '/js/mouse.js'); });
app.get('/player.js', function(req, res){ res.sendFile(__dirname + '/js/player.js'); });
app.get('/crumb.js', function(req, res){ res.sendFile(__dirname + '/js/crumb.js'); });

// What does the server need to track?

var players = {};
var crumbs = {};
var clients = [];

var palettePlayer = ['red','green','yellow','orange'];

/*
 *  WEBSOCKETS, BABY!
 */

 var crumbMaker = setInterval(addCrumb, 4000);

io.on('connect', function(socket) {

    // Assign the new player an id
    var newPlayer = {
        name: getRandom(NAMES), // name
        id: socket.id,
        type: 0, // type
        joined: Date.now(),
        lastTimeoutCheck: Date.now(),
        loc: {x:0,y:0},
        color: palettePlayer[parseInt(Math.random()*palettePlayer.length)],
    };
    players[newPlayer.id] = newPlayer;
    socket.emit('playerInfo', newPlayer); // let the new player know their info
    io.emit('newPlayer', newPlayer); // let everyone know there's a new player
    io.emit('currentCrumbs', crumbs);

    // Add a new client
    clients[newPlayer.id] = socket;

    // Update player location on move
    socket.on('playerMoved', function(data){
        if(!players[data.id]) return;

        if(data.loc) players[data.id].loc = {x: data.loc.x, y: data.loc.y};
        else players[data.id].loc = {x: 0, y: 0};
        io.emit('playerMoved', data);
    });

    socket.on('disconnect', function(data){
        delete players[socket.id];
        io.emit('playerLeft', {id: socket.id});
    });

    socket.on('collision', function(data){

        /*
         *  We will need some collision checking here to prevent cheating
         */

        //Check that these clients exist
        if(!clients[data.id] || !clients[socket.id]) return;

        clients[socket.id].emit('collided', {
            id: data.id,
        });
        clients[data.id].emit('collided', {
            id: socket.id,
        });
    });

    socket.on('crumbRemoved', function(data){
        delete crumbs[data.id];
        socket.emit('crumbRemoved', data);
    });

    socket.on('currentCrumbs', function(){
        socket.emit('currentCrumbs', crumbs);
    });

    // Returns the list of current players when requested
    socket.on('currentPlayers', function(){
        socket.emit('currentPlayers', players);
    });
});

function getRandom(arr){
    return arr[parseInt(Math.random()*arr.length)];
};

function addCrumb(){
    var id = crypto.randomBytes(20).toString('hex');
    var crumb = {
        id: id,
        loc: {x: Math.random()*500, y: Math.random()*600},
        mass: parseInt(Math.random()*5)+2,
    };
    crumbs[id] = crumb;

    io.emit('crumbAdded', crumb);
};

const NAMES = ['scrapple', 'balrug', 'ewe', 'pandini', 'fuchs'];