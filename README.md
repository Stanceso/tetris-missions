# Tetris: Missions and Challenges

A modern HTML5 Canvas Tetris game built with plain HTML, CSS, and JavaScript.

## Features

- Classic 10x20 Tetris board
- All 7 standard tetrominoes: I, O, T, S, Z, J, L
- 7-bag randomizer for fair piece distribution
- Ghost piece preview
- Wall-kick rotation
- Next-piece preview
- Score, levels, line counter, and timer
- Score table: 100 / 300 / 500 / 800 x current level
- Level increases every 10 cleared lines
- LocalStorage leaderboard
- Mission system with bonus points
- Random daily missions
- Achievement system
- Game modes: Classic, Timed, Endless, Hardcore, Challenge
- Pause screen and game-over screen
- Animated line clear flash
- Sound effects, simple generated background music, and volume settings
- Responsive dark UI

## Controls

- Left Arrow: move left
- Right Arrow: move right
- Down Arrow: soft drop
- Up Arrow: rotate
- Space: hard drop
- P: pause or resume

The game also includes mobile-friendly on-screen controls.

## Run

Open `index.html` in a browser, or serve the folder with any static web server.

No third-party libraries are required.

## Files

- `index.html` - interface layout
- `styles.css` - responsive dark theme
- `script.js` - game logic and classes

## Main Classes

- `Game`
- `Board`
- `Piece`
- `MissionManager`
- `AchievementManager`
- `ScoreManager`
