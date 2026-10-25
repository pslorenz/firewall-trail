/* SPDX-License-Identifier: GPL-3.0-or-later */
/* main.js: start the game once every script has loaded. */
(function () {
  FT.app = document.getElementById("app");
  document.getElementById("feedback").onclick = () => FT.share.sendFeedback();
  FT.screens.title();
})();
