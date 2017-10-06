/* eslint-env browser */

window.onload = function () {
  let socket;

  const game = new Game(socket, document.querySelector('#game'), new Mouse());
  game.init();
};
