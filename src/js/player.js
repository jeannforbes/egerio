/* eslint-env browser */

/*
 *  Player.js
 *  
 *  Describes a user/player's attributes and methods
 */

const Player = function (id, name, type, color, mass) {
  this.id = id;
  this.name = name || 'anonymous';
  this.type = type || 0;
  this.mass = mass;
  this.maxMass = 60;
  this.maxSpeed = 100;

  // What's the vector, Victor?
  this.accel = new Victor(0, 0);
  this.vel = new Victor(0, 0);
  this.loc = new Victor(0, 0);

  this.color = color;
};

Player.prototype.move = function (pos) {
  // Get accel from mouse pos
  this.accel.add(pos.clone().subtract(this.loc).normalize());
  this.vel.add(this.accel);

  // Limit velocity
  if (this.vel.magnitude() > 5) this.vel.normalize().multiply(new Victor(5, 5));
  this.loc.add(this.vel);

  this.accel = new Victor(0, 0);
};

// What happens to me on a collision?
Player.prototype.collide = function () {
  // Turns out, you don't care!
};

Player.prototype.eat = function (crumb) {
  if (this.mass < this.maxMass) this.mass += crumb.mass;
  this.color = crumb.color;
};

// Draws the player to the canvas
Player.prototype.draw = function (ctx) {
  ctx.save();

  // style
  ctx.fillStyle = this.color || 'white';

  // drawing
  ctx.beginPath();
  ctx.arc(this.loc.x, this.loc.y, this.mass, 0, 2 * Math.PI);
  ctx.fill();

  // transforms
  ctx.translate(this.loc.x - 20, this.loc.y + 10);

  ctx.restore();
};

// Returns true if colliding
Player.prototype.checkCollision = function (collider, cb) {
  // Ignore collisions with yourself
  if (this.id === collider.id) return;

  // Check distance
  const distBtwn = this.loc.distance(collider.loc) * 2; // 10 for "squishier" bounds
  if (distBtwn < (this.mass + collider.mass)) {
    cb();
  }
};
