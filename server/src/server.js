const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Game state
const gameState = {
  parties: {}, // Stores party information
  players: {}, // Stores player data
  games: {},   // Stores active game sessions
};

// Initialize express app and server
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../../client/public')));

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

// Game constants
const MAX_PARTY_SIZE = 4;
const TICK_RATE = 60; // Server updates per second
const GAME_SPEED = 1000 / TICK_RATE;

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Initialize player
  gameState.players[socket.id] = {
    id: socket.id,
    name: `Player-${socket.id.substr(0, 4)}`,
    position: { x: 800, y: 450 },
    angle: 0,
    health: 100,
    maxHealth: 100,
    experience: 0,
    level: 1,
    speed: 5,
    damage: 10,
    fireRate: 5,
    type: 'basic', // Player type/evolution
    weaponType: 'normal', // Weapon type (normal, dual, shotgun)
    party: null,
    game: null,
  };

  // Send initial player data
  socket.emit('playerInit', gameState.players[socket.id]);
  socket.emit('partyList', getPartyList());
  
  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Handle party cleanup
    const player = gameState.players[socket.id];
    if (player && player.party) {
      leaveParty(socket);
    }
    
    // Handle game cleanup
    if (player && player.game) {
      leaveGame(socket);
    }
    
    // Remove player
    delete gameState.players[socket.id];
  });

  // Player movement and actions
  socket.on('playerUpdate', (data) => {
    const player = gameState.players[socket.id];
    if (player && player.game) {
      player.position = data.position;
      player.angle = data.angle;
      
      // Broadcast to other players in the same game
      socket.to(player.game).emit('playerMove', {
        id: socket.id,
        position: player.position,
        angle: player.angle
      });
    }
  });

  // Player shot fired
  socket.on('playerShoot', (data) => {
    const player = gameState.players[socket.id];
    if (player && player.game) {
      const gameId = player.game;
      const projectiles = [];
      
      // Base projectile properties
      const baseProjectile = {
        id: uuidv4(),
        ownerId: socket.id,
        position: { ...player.position },
        angle: data.angle,
        speed: 10,
        damage: player.damage,
        timeToLive: 100, // Frames until bullet despawns
      };
      
      // Different behaviors based on weapon type
      switch (player.weaponType) {
        case 'dual':
          // Create two bullets offset from player center
          const offsetDistance = 10; // Distance between bullets
          const perpendicularAngle = data.angle + Math.PI/2;
          
          // Left gun projectile
          const leftPos = {
            x: player.position.x + Math.cos(perpendicularAngle) * offsetDistance,
            y: player.position.y + Math.sin(perpendicularAngle) * offsetDistance
          };
          
          // Right gun projectile
          const rightPos = {
            x: player.position.x - Math.cos(perpendicularAngle) * offsetDistance,
            y: player.position.y - Math.sin(perpendicularAngle) * offsetDistance
          };
          
          projectiles.push({
            ...baseProjectile,
            id: uuidv4(),
            position: leftPos
          });
          
          projectiles.push({
            ...baseProjectile,
            id: uuidv4(),
            position: rightPos
          });
          break;
          
        case 'shotgun':
          // Create 5 bullets in a spread pattern
          const spreadAngle = Math.PI / 8; // 22.5 degrees total spread
          
          for (let i = -2; i <= 2; i++) {
            const angle = data.angle + (i * spreadAngle / 2);
            const spreadDamage = i === 0 ? player.damage : player.damage * 0.6; // Center bullet does full damage
            
            projectiles.push({
              ...baseProjectile,
              id: uuidv4(),
              angle: angle,
              damage: spreadDamage
            });
          }
          break;
          
        default: // Normal single bullet
          projectiles.push(baseProjectile);
          break;
      }
      
      // Add all generated projectiles to game state
      if (!gameState.games[gameId].projectiles) {
        gameState.games[gameId].projectiles = [];
      }
      
      gameState.games[gameId].projectiles.push(...projectiles);
      
      // Broadcast all new projectiles to players in the game
      projectiles.forEach(projectile => {
        io.to(gameId).emit('newProjectile', projectile);
      });
    }
  });

  // Party management
  socket.on('createParty', (playerName) => {
    // Update player name if provided
    if (playerName) {
      gameState.players[socket.id].name = playerName;
    }
    
    const partyId = uuidv4();
    gameState.parties[partyId] = {
      id: partyId,
      leader: socket.id,
      members: [socket.id],
      status: 'waiting',
    };
    
    // Update player's party reference
    gameState.players[socket.id].party = partyId;
    
    // Join socket room for the party
    socket.join(partyId);
    
    // Send party creation confirmation
    socket.emit('partyCreated', gameState.parties[partyId]);
    
    // Update party list for all clients
    io.emit('partyList', getPartyList());
  });

  socket.on('joinParty', (data) => {
    // Handle both old and new format - String or Object with partyId
    const partyId = typeof data === 'string' ? data : data.partyId;
    
    // Update player name if provided
    if (data.playerName) {
      gameState.players[socket.id].name = data.playerName;
    }
    
    const party = gameState.parties[partyId];
    if (!party) {
      socket.emit('partyError', { message: 'Party does not exist' });
      return;
    }
    
    if (party.members.length >= MAX_PARTY_SIZE) {
      socket.emit('partyError', { message: 'Party is full' });
      return;
    }
    
    if (party.status !== 'waiting') {
      socket.emit('partyError', { message: 'Party already started a game' });
      return;
    }
    
    // Check if player is already in this party to prevent duplicates
    if (party.members.includes(socket.id)) {
      // Player is already in this party, just update UI
      socket.emit('partyJoined', party);
      return;
    }
    
    // Leave any existing party first
    if (gameState.players[socket.id].party) {
      leaveParty(socket);
    }
    
    // Add player to party
    party.members.push(socket.id);
    gameState.players[socket.id].party = partyId;
    
    // Join socket room for the party
    socket.join(partyId);
    
    // Send party join confirmation to the player who joined
    socket.emit('partyJoined', party);
    
    // Notify all party members
    io.to(partyId).emit('partyUpdate', party);
    
    // Update party list for all clients
    io.emit('partyList', getPartyList());
  });

  socket.on('leaveParty', () => {
    leaveParty(socket);
  });

  socket.on('startGame', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.party) {
      socket.emit('gameError', { message: 'You are not in a party' });
      return;
    }
    
    const party = gameState.parties[player.party];
    if (party.leader !== socket.id) {
      socket.emit('gameError', { message: 'Only party leader can start the game' });
      return;
    }
    
    // Start a new game session
    startGame(party.id);
  });

  // Player upgrades
  socket.on('upgradePlayer', (upgrade) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    let upgraded = false;
    let upgradeCost = 0;
    
    // Apply upgrade based on type
    switch (upgrade) {
      case 'speed':
        upgradeCost = 10;
        if (player.experience >= upgradeCost) {
          player.speed += 0.5;
          player.experience -= upgradeCost;
          upgraded = true;
        }
        break;
      case 'damage':
        upgradeCost = 10;
        if (player.experience >= upgradeCost) {
          player.damage += 2;
          player.experience -= upgradeCost;
          upgraded = true;
        }
        break;
      case 'fireRate':
        upgradeCost = 10;
        if (player.experience >= upgradeCost) {
          player.fireRate += 0.5;
          player.experience -= upgradeCost;
          upgraded = true;
        }
        break;
      case 'health':
        upgradeCost = 10;
        if (player.experience >= upgradeCost) {
          player.maxHealth += 10;
          player.health += 10;
          player.experience -= upgradeCost;
          upgraded = true;
        }
        break;
      case 'evolve':
        upgradeCost = 50;
        if (player.experience >= upgradeCost && player.type === 'basic') {
          player.type = 'advanced';
          player.damage += 5;
          player.maxHealth += 20;
          player.health += 20;
          player.experience -= upgradeCost;
          upgraded = true;
        }
        break;
      case 'dualGuns':
        upgradeCost = 30;
        if (player.experience >= upgradeCost) {
          player.weaponType = 'dual';
          player.damage += 3;
          player.experience -= upgradeCost;
          upgraded = true;
        }
        break;
      case 'shotgun':
        upgradeCost = 40;
        if (player.experience >= upgradeCost) {
          player.weaponType = 'shotgun';
          player.damage += 1;
          player.experience -= upgradeCost;
          upgraded = true;
        }
        break;
    }
    
    if (upgraded) {
      // Send complete updated player data
      const updatedPlayerData = {
        id: player.id,
        type: player.type,
        weaponType: player.weaponType || 'normal',
        health: player.health,
        maxHealth: player.maxHealth,
        experience: player.experience,
        level: player.level,
        speed: player.speed,
        damage: player.damage,
        fireRate: player.fireRate,
        upgradeApplied: upgrade
      };
      
      // Send updated data to the player
      socket.emit('playerUpdate', updatedPlayerData);
      
      // Broadcast to other players in the same game
      if (player.game) {
        socket.to(player.game).emit('playerUpdated', updatedPlayerData);
      }
      
      console.log(`Player ${socket.id} upgraded: ${upgrade}`);
    }
  });

  // Request to refresh party list
  socket.on('requestPartyList', () => {
    socket.emit('partyList', getPartyList());
  });
  
  // Get party member details (names, etc.)
  socket.on('getPartyMemberDetails', (playerIds, callback) => {
    // If callback is not a function, ignore this request
    if (typeof callback !== 'function') return;
    
    // Collect player data for each ID
    const playerDetails = playerIds.map(id => {
      const player = gameState.players[id];
      if (!player) return { id, name: `Unknown-${id.substr(0, 4)}` };
      
      return {
        id: player.id,
        name: player.name
      };
    });
    
    // Send back the player details via callback
    callback(playerDetails);
  });
});

// Helper functions
function getPartyList() {
  const list = [];
  for (const id in gameState.parties) {
    const party = gameState.parties[id];
    if (party.status === 'waiting') {
      list.push({
        id: party.id,
        players: party.members.length,
        maxPlayers: MAX_PARTY_SIZE,
      });
    }
  }
  return list;
}

function leaveParty(socket) {
  const player = gameState.players[socket.id];
  if (!player || !player.party) return;
  
  const partyId = player.party;
  const party = gameState.parties[partyId];
  
  if (!party) return;
  
  // Remove player from party
  const index = party.members.indexOf(socket.id);
  if (index !== -1) {
    party.members.splice(index, 1);
  }
  
  // Leave socket room
  socket.leave(partyId);
  
  // Clear party reference from player
  player.party = null;
  
  // If party is empty, remove it
  if (party.members.length === 0) {
    delete gameState.parties[partyId];
  } else {
    // If leader left, assign new leader
    if (party.leader === socket.id) {
      party.leader = party.members[0];
    }
    
    // Notify remaining members
    io.to(partyId).emit('partyUpdate', party);
  }
  
  // Update party list for all clients
  io.emit('partyList', getPartyList());
}

function startGame(partyId) {
  const party = gameState.parties[partyId];
  if (!party) return;
  
  // Create new game
  const gameId = uuidv4();
  const game = {
    id: gameId,
    partyId: partyId,
    players: party.members,
    wave: 1,
    enemies: [],
    projectiles: [],
    startTime: Date.now(),
    status: 'active',
  };
  
  gameState.games[gameId] = game;
  
  // Update party status
  party.status = 'playing';
  party.game = gameId;
  
  // Update players and join game room
  party.members.forEach(playerId => {
    const player = gameState.players[playerId];
    if (player) {
      player.game = gameId;
      player.position = { 
        x: 400 + Math.random() * 800, 
        y: 300 + Math.random() * 400 
      };
      player.health = player.maxHealth;
      player.experience = 0;
      
      const socket = io.sockets.sockets.get(playerId);
      if (socket) {
        socket.join(gameId);
      }
    }
  });
  
  // Start game loop
  startGameLoop(gameId);
  
  // Notify all players
  io.to(gameId).emit('gameStarted', {
    id: gameId,
    wave: 1,
    players: party.members.map(id => {
      const player = gameState.players[id];
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        angle: player.angle,
        health: player.maxHealth,
        maxHealth: player.maxHealth,
        experience: 0,
        level: player.level,
        speed: player.speed,
        damage: player.damage,
        fireRate: player.fireRate,
        type: player.type,
        weaponType: player.weaponType || 'normal'
      };
    }),
  });
  
  // Update party list for all clients
  io.emit('partyList', getPartyList());
  
  // Start first wave
  spawnWave(gameId, 1);
}

function startGameLoop(gameId) {
  const gameLoop = setInterval(() => {
    const game = gameState.games[gameId];
    if (!game || game.status !== 'active') {
      clearInterval(gameLoop);
      return;
    }
    
    // Update game state
    updateProjectiles(gameId);
    updateEnemies(gameId);
    updateGameState(gameId);
    
    // Check if wave is complete
    if (game.enemies.length === 0) {
      const nextWave = game.wave + 1;
      game.wave = nextWave;
      
      // Revive dead players for the next wave
      respawnDeadPlayers(gameId);
      
      // Notify players about the new wave
      io.to(gameId).emit('newWave', nextWave);
      
      // Spawn next wave
      spawnWave(gameId, nextWave);
    }
    
  }, GAME_SPEED);
}

// Function to respawn dead players when a new wave starts
function respawnDeadPlayers(gameId) {
  const game = gameState.games[gameId];
  if (!game) return;

  // Check all players in the game
  game.players.forEach(playerId => {
    const player = gameState.players[playerId];
    if (player) {
      // If player is dead (health <= 0), respawn them
      if (player.health <= 0) {
        // Reset player health to max
        player.health = player.maxHealth;
        
        // Randomize respawn position
        player.position = { 
          x: 400 + Math.random() * 800, 
          y: 300 + Math.random() * 400 
        };
        
        // Notify player and others they've respawned
        io.to(gameId).emit('playerRespawned', {
          id: player.id,
          position: player.position,
          health: player.health,
          maxHealth: player.maxHealth
        });
      }
    }
  });
}

function updateProjectiles(gameId) {
  const game = gameState.games[gameId];
  if (!game) return;
  
  // Update projectile positions
  game.projectiles = game.projectiles.filter(projectile => {
    // Update position based on angle and speed
    projectile.position.x += Math.cos(projectile.angle) * projectile.speed;
    projectile.position.y += Math.sin(projectile.angle) * projectile.speed;
    
    // Reduce TTL
    projectile.timeToLive--;
    
    // Check collisions with enemies
    const bulletRadius = 5; // Define bullet radius
    let hitEnemy = false;

    for (let i = 0; i < game.enemies.length; i++) {
      const enemy = game.enemies[i];
      const dx = projectile.position.x - enemy.position.x;
      const dy = projectile.position.y - enemy.position.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      // Check if bullet is hitting enemy (with slightly larger collision area for more forgiving hits)
      const collisionDistance = enemy.radius + bulletRadius + 2;
      if (distance < collisionDistance) {
        hitEnemy = true;
        enemy.health -= projectile.damage;
        
        // If enemy killed
        if (enemy.health <= 0) {
          const player = gameState.players[projectile.ownerId];
          if (player) {
            player.experience += enemy.expValue;
            io.to(gameId).emit('playerXp', {
              id: player.id,
              experience: player.experience
            });
          }
          
          // Remove enemy
          game.enemies.splice(i, 1);
          i--; // Adjust index since we removed an element
          io.to(gameId).emit('enemyDestroyed', enemy.id);
        } else {
          // Enemy took damage
          io.to(gameId).emit('enemyDamaged', {
            id: enemy.id,
            health: enemy.health,
            maxHealth: enemy.maxHealth
          });
        }
        
        break; // Stop checking other enemies since this projectile hit one
      }
    }

    // If projectile hit an enemy, remove it
    if (hitEnemy) {
      return false;
    }
    
    // Check if projectile is out of bounds or expired
    if (projectile.timeToLive <= 0 || 
        projectile.position.x < -100 || 
        projectile.position.x > 1700 || 
        projectile.position.y < -100 || 
        projectile.position.y > 1000) {
      return false;
    }
    
    // Keep the projectile
    return true;
  });
}

function updateEnemies(gameId) {
  const game = gameState.games[gameId];
  if (!game) return;
  
  // Update enemy positions (simple AI)
  game.enemies.forEach(enemy => {
    // Find closest player
    let closestPlayer = null;
    let minDistance = Number.MAX_VALUE;
    
    // Array to store potential targets (players with health > 0)
    const alivePlayers = [];
    
    game.players.forEach(playerId => {
      const player = gameState.players[playerId];
      if (player && player.health > 0) {
        alivePlayers.push(player);
        
        const dx = player.position.x - enemy.position.x;
        const dy = player.position.y - enemy.position.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPlayer = player;
        }
      }
    });
    
    // If no closest player found but there are alive players, target a random one
    // This helps prevent enemies from getting stuck
    if (!closestPlayer && alivePlayers.length > 0) {
      closestPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      
      // Calculate distance to this random player
      const dx = closestPlayer.position.x - enemy.position.x;
      const dy = closestPlayer.position.y - enemy.position.y;
      minDistance = Math.sqrt(dx*dx + dy*dy);
    }
    
    // Move towards chosen player
    if (closestPlayer) {
      const dx = closestPlayer.position.x - enemy.position.x;
      const dy = closestPlayer.position.y - enemy.position.y;
      const angle = Math.atan2(dy, dx);
      
      // Add a small random offset to prevent enemies from stacking on each other
      const randomOffsetX = (Math.random() - 0.5) * 0.2;
      const randomOffsetY = (Math.random() - 0.5) * 0.2;
      
      // Apply movement based on speed
      enemy.position.x += (Math.cos(angle) + randomOffsetX) * enemy.speed;
      enemy.position.y += (Math.sin(angle) + randomOffsetY) * enemy.speed;
      
      // Check collision with player - using constant player radius of 20
      const playerRadius = 20;
      if (minDistance < playerRadius + enemy.radius) {
        closestPlayer.health -= enemy.damage;
        
        // Player took damage
        io.to(gameId).emit('playerDamaged', {
          id: closestPlayer.id,
          health: closestPlayer.health,
          maxHealth: closestPlayer.maxHealth
        });
        
        // Check if player died
        if (closestPlayer.health <= 0) {
          io.to(gameId).emit('playerDied', closestPlayer.id);
        }
      }
    } else {
      // If no players found, move to center of map
      const centerX = 800;
      const centerY = 450;
      const dx = centerX - enemy.position.x;
      const dy = centerY - enemy.position.y;
      const angle = Math.atan2(dy, dx);
      
      enemy.position.x += Math.cos(angle) * enemy.speed;
      enemy.position.y += Math.sin(angle) * enemy.speed;
    }
  });
  
  // Send enemy updates to clients
  io.to(gameId).emit('enemiesUpdate', game.enemies);
}

function spawnWave(gameId, waveNumber) {
  const game = gameState.games[gameId];
  if (!game) return;
  
  // Calculate number of enemies based on wave number
  const enemyCount = 5 + (waveNumber * 2);
  
  // Calculate enemy stats based on wave number
  const baseHealth = 20 + (waveNumber * 5);
  const baseDamage = 5 + waveNumber;
  const baseSpeed = 1 + (waveNumber * 0.1);
  const baseExp = 5 + waveNumber;
  
  // Spawn enemies
  for (let i = 0; i < enemyCount; i++) {
    // Spawn outside the visible area
    let spawnX, spawnY;
    const spawnSide = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    
    switch (spawnSide) {
      case 0: // top
        spawnX = Math.random() * 1600;
        spawnY = -50;
        break;
      case 1: // right
        spawnX = 1650;
        spawnY = Math.random() * 900;
        break;
      case 2: // bottom
        spawnX = Math.random() * 1600;
        spawnY = 950;
        break;
      case 3: // left
        spawnX = -50;
        spawnY = Math.random() * 900;
        break;
    }
    
    // Determine enemy type based on wave and randomness
    let enemyType = 'basic';
    let enemyHealth = baseHealth;
    let enemyDamage = baseDamage;
    let enemySpeed = baseSpeed;
    let enemyExp = baseExp;
    let enemyRadius = 20;
    
    // Increase variety as waves progress
    if (waveNumber >= 3) {
      // After wave 3, start introducing different enemy types
      const typeRoll = Math.random();
      
      if (waveNumber >= 10 && typeRoll < 0.05) {
        // Boss - rare, powerful enemy (5% chance after wave 10)
        enemyType = 'boss';
        enemyHealth = baseHealth * 5;
        enemyDamage = baseDamage * 2;
        enemySpeed = baseSpeed * 0.7;
        enemyExp = baseExp * 5;
        enemyRadius = 35;
      } else if (waveNumber >= 5 && typeRoll < 0.2) {
        // Tank - high health, slow, high damage
        enemyType = 'tank';
        enemyHealth = baseHealth * 2;
        enemyDamage = baseDamage * 1.5;
        enemySpeed = baseSpeed * 0.6;
        enemyExp = baseExp * 2;
        enemyRadius = 25;
      } else if (typeRoll < 0.4) {
        // Fast - low health, fast, low damage
        enemyType = 'fast';
        enemyHealth = baseHealth * 0.7;
        enemyDamage = baseDamage * 0.7;
        enemySpeed = baseSpeed * 1.8;
        enemyExp = baseExp * 1.2;
        enemyRadius = 15;
      } else if (typeRoll < 0.7 && waveNumber >= 5) {
        // Advanced - balanced upgrades (more common in later waves)
        enemyType = 'advanced';
        enemyHealth = baseHealth * 1.3;
        enemyDamage = baseDamage * 1.3;
        enemySpeed = baseSpeed * 1.1;
        enemyExp = baseExp * 1.5;
      } else {
        // Basic enemy - standard stats
        enemyType = 'basic';
      }
    }
    
    const enemy = {
      id: uuidv4(),
      type: enemyType,
      position: { x: spawnX, y: spawnY },
      radius: enemyRadius,
      health: enemyHealth,
      maxHealth: enemyHealth,
      damage: enemyDamage,
      speed: enemySpeed,
      expValue: enemyExp
    };
    
    game.enemies.push(enemy);
  }
  
  // Notify clients
  io.to(gameId).emit('enemiesSpawned', game.enemies);
}

function leaveGame(socket) {
  const player = gameState.players[socket.id];
  if (!player || !player.game) return;
  
  const gameId = player.game;
  const game = gameState.games[gameId];
  
  if (!game) return;
  
  // Remove player from game
  const index = game.players.indexOf(socket.id);
  if (index !== -1) {
    game.players.splice(index, 1);
  }
  
  // Leave socket room
  socket.leave(gameId);
  
  // Clear game reference from player
  player.game = null;
  
  // Notify other players
  io.to(gameId).emit('playerLeft', socket.id);
  
  // If no players left, end game
  if (game.players.length === 0) {
    game.status = 'ended';
    delete gameState.games[gameId];
    
    // Update party status if exists
    if (game.partyId && gameState.parties[game.partyId]) {
      gameState.parties[game.partyId].status = 'waiting';
      gameState.parties[game.partyId].game = null;
    }
  }
}

// After updateEnemies function definition, add a new function to check game over state
function updateGameState(gameId) {
  const game = gameState.games[gameId];
  if (!game) return;
  
  // Check if all players are dead
  let allPlayersDead = true;
  for (const playerId of game.players) {
    const player = gameState.players[playerId];
    if (player && player.health > 0) {
      allPlayersDead = false;
      break;
    }
  }
  
  // If all players are dead, end the game
  if (allPlayersDead && game.players.length > 0) {
    // Set a small delay before ending the game (3 seconds)
    if (!game.gameOverTimeout) {
      game.gameOverTimeout = setTimeout(() => {
        endGame(gameId, 'defeat');
      }, 3000);
    }
  }
}

// Add a new function to handle game over
function endGame(gameId, result) {
  const game = gameState.games[gameId];
  if (!game) return;
  
  // Clear any existing timeout
  if (game.gameOverTimeout) {
    clearTimeout(game.gameOverTimeout);
    game.gameOverTimeout = null;
  }
  
  // Set game status to ended
  game.status = 'ended';
  
  // Get max wave reached
  const waveReached = game.wave;
  
  // Notify all players of game over
  io.to(gameId).emit('gameOver', {
    result: result,
    wave: waveReached
  });
  
  // Update party status if exists
  if (game.partyId && gameState.parties[game.partyId]) {
    const party = gameState.parties[game.partyId];
    party.status = 'waiting';
    party.game = null;
    
    // Return all players to party lobby
    game.players.forEach(playerId => {
      const player = gameState.players[playerId];
      if (player) {
        player.game = null;
        player.health = player.maxHealth;
      }
    });
  }
  
  // Remove game after a short delay to allow for animations etc.
  setTimeout(() => {
    delete gameState.games[gameId];
  }, 5000);
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 