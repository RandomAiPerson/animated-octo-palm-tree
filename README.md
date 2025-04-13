# Wave Defense Game

A multiplayer wave defense game inspired by Diep.io with Node.js as the backend server.

## Features

- **Multiplayer Co-op Gameplay**: Team up with up to 4 players to fight waves of enemies.
- **Party System**: Create or join parties to play with friends.
- **Upgrade System**: Earn XP by defeating enemies and upgrade your tank's abilities.
- **Evolution System**: Evolve your basic tank into more powerful versions.
- **Progressive Difficulty**: Enemy waves get progressively harder as you advance.
- **Real-time Action**: Smooth movement and shooting using Socket.IO.

## Game Controls

- **Movement**: WASD or Arrow Keys
- **Aim**: Mouse cursor
- **Shoot**: Automatic or click
- **Upgrades**: Click the "Upgrades" button to access the upgrade menu

## Technology Stack

- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: HTML5 Canvas, JavaScript ES6
- **Networking**: Real-time WebSockets via Socket.IO

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. For development with auto-restart:
   ```
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Game Mechanics

### Player Progression

- Defeat enemies to earn XP
- Spend XP on upgrades:
  - Speed (+0.5)
  - Damage (+2)
  - Fire Rate (+0.5)
  - Health (+10)
  - Evolution (50 XP) - Unlocks new abilities and visuals

### Enemy Types

- **Basic Enemies**: Standard enemies that appear in early waves
- **Advanced Enemies**: Tougher enemies with more health that appear in later waves

### Waves

- Each wave contains progressively more enemies
- Enemies become stronger with each wave (more health, damage, and speed)
- The wave number is displayed at the top of the screen

## Multiplayer

- Create a party or join an existing one
- Party lobbies display player count (e.g., "2/4")
- Party leaders can start the game when ready
- All players in a party are taken into the same game session

## Future Enhancements

- PvP functionality after wave 10
- Additional tank evolutions
- More enemy types
- Cosmetic customization
- Leaderboard tracking 