import { Player } from './entities/player.js';
import { Enemy } from './entities/enemy.js';
import { Projectile } from './entities/projectile.js';
import { GameUI } from './ui/game-ui.js';
import { PartyUI } from './ui/party-ui.js';

// Game canvas and context
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Set canvas size to match container
canvas.width = 1600;
canvas.height = 900;

// Game screens
const mainMenu = document.getElementById('main-menu');
const partyLobby = document.getElementById('party-lobby');
const gameScreen = document.getElementById('game-screen');

// Socket connection
const socket = io();

// Game state
const game = {
    player: null,
    otherPlayers: {},
    projectiles: [],
    enemies: [],
    particles: [],
    wave: 1,
    gameId: null,
    partyId: null,
    isLeader: false,
    isRunning: false,
    keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        up: false,
        left: false,
        down: false,
        right: false
    },
    mouse: {
        x: 0,
        y: 0,
        isDown: false
    },
    lastShot: 0
};

// Initialize UI managers
const gameUI = new GameUI(game, socket);
const partyUI = new PartyUI(socket, game);

// Add game over state and handling
let gameOver = false;
let gameOverResult = null;
let gameOverTimer = 0;

// Initialize game
function init() {
    // Register event listeners
    registerKeyboardEvents();
    registerMouseEvents();
    registerButtonEvents();
    
    // Set up socket event listeners
    setupSocketEvents();
    
    // Show main menu
    showScreen(mainMenu);
}

// Main game loop
function gameLoop() {
    if (!game.isRunning) return;
    
    // Clear canvas
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Handle player input
    handleInput();
    
    // Update and render game objects
    updateGame();
    renderGame();
    
    // Draw game over screen if game is over
    if (gameOver) {
        drawGameOver();
        gameOverTimer += 1;
        
        // Return to menu after 5 seconds (assuming 60fps)
        if (gameOverTimer > 300) {
            window.location.href = '/';
        }
        
        // Don't process further game logic when game is over
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Update game state
function updateGame() {
    // Update player
    if (game.player) {
        game.player.update();
        
        // Check if player can shoot
        const now = Date.now();
        if (game.mouse.isDown && now - game.lastShot > 1000 / game.player.fireRate) {
            game.lastShot = now;
            
            // Calculate angle from player to mouse
            const dx = game.mouse.x - game.player.x;
            const dy = game.mouse.y - game.player.y;
            const angle = Math.atan2(dy, dx);
            
            // Send shoot event to server
            socket.emit('playerShoot', { angle });
        }
        
        // Send player position update to server
        socket.emit('playerUpdate', {
            position: { x: game.player.x, y: game.player.y },
            angle: game.player.angle
        });
    }
    
    // Update projectiles
    game.projectiles.forEach(projectile => {
        projectile.update();
    });
    
    // Filter out expired projectiles
    game.projectiles = game.projectiles.filter(projectile => !projectile.isExpired);
    
    // Update particles
    if (game.particles && game.particles.length > 0) {
        game.particles.forEach(particle => {
            // Update particle position
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            
            // Reduce particle life
            particle.life--;
            
            // Add gravity effect to some particles
            particle.speedY += 0.03;
            
            // Slow down particles over time
            particle.speedX *= 0.98;
            particle.speedY *= 0.98;
            
            // Shrink particles as they age
            if (particle.life < 15) {
                particle.size *= 0.9;
            }
        });
        
        // Remove dead particles
        game.particles = game.particles.filter(particle => particle.life > 0);
    }
}

// Render game objects
function renderGame() {
    // Draw grid background
    drawGrid();
    
    // Draw enemies
    game.enemies.forEach(enemy => {
        enemy.render(ctx);
    });
    
    // Draw projectiles
    game.projectiles.forEach(projectile => {
        projectile.render(ctx);
    });
    
    // Draw particles
    if (game.particles && game.particles.length > 0) {
        game.particles.forEach(particle => {
            ctx.globalAlpha = particle.life / 30; // Fade out as life decreases
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1; // Reset alpha
    }
    
    // Draw other players
    Object.values(game.otherPlayers).forEach(player => {
        player.render(ctx);
    });
    
    // Draw player (on top)
    if (game.player) {
        game.player.render(ctx);
    }
}

// Draw grid background
function drawGrid() {
    // Clear canvas with a dark gray background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(80, 80, 80, 0.2)';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x < canvas.width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y < canvas.height; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // Remove all decorative background shapes
}

// Handle keyboard and mouse input
function handleInput() {
    if (!game.player) return;
    
    let dx = 0;
    let dy = 0;
    
    // Calculate movement direction based on keys
    if (game.keys.w || game.keys.up) dy -= 1;
    if (game.keys.s || game.keys.down) dy += 1;
    if (game.keys.a || game.keys.left) dx -= 1;
    if (game.keys.d || game.keys.right) dx += 1;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }
    
    // Apply movement
    game.player.move(dx, dy);
    
    // Update player angle based on mouse position
    const mouseX = game.mouse.x;
    const mouseY = game.mouse.y;
    game.player.angle = Math.atan2(mouseY - game.player.y, mouseX - game.player.x);
}

// Set up socket event listeners
function setupSocketEvents() {
    // Player initialization
    socket.on('playerInit', (data) => {
        game.player = new Player(data);
    });
    
    // Player stats updated from server
    socket.on('playerUpdate', (data) => {
        if (game.player) {
            // Update player stats
            game.player.health = data.health;
            game.player.maxHealth = data.maxHealth;
            game.player.speed = data.speed;
            game.player.damage = data.damage;
            game.player.fireRate = data.fireRate;
            game.player.experience = data.experience;
            game.player.type = data.type;
            
            // Update UI
            gameUI.updateHealth(data.health, data.maxHealth);
            gameUI.updateXP(data.experience);
            
            // Show upgrade effect if this was an upgrade
            if (data.upgradeApplied) {
                showUpgradeEffect(data.upgradeApplied);
            }
        }
    });
    
    // Party list update
    socket.on('partyList', (parties) => {
        partyUI.updatePartyList(parties);
    });
    
    // Party created
    socket.on('partyCreated', (party) => {
        game.partyId = party.id;
        game.isLeader = true;
        
        // Show party lobby
        showScreen(partyLobby);
        
        // Update party UI
        partyUI.updatePartyInfo(party);
    });
    
    // Party joined
    socket.on('partyJoined', (party) => {
        game.partyId = party.id;
        game.isLeader = party.leader === socket.id;
        
        // Show party lobby when successfully joined
        showScreen(partyLobby);
        
        // Update party UI
        partyUI.updatePartyInfo(party);
    });
    
    // Party update
    socket.on('partyUpdate', (party) => {
        game.isLeader = party.leader === socket.id;
        
        // Update party UI
        partyUI.updatePartyInfo(party);
    });
    
    // Party error
    socket.on('partyError', (error) => {
        alert(error.message);
    });
    
    // Game started
    socket.on('gameStarted', (data) => {
        game.gameId = data.id;
        game.wave = data.wave;
        
        // Initialize other players with their correct names
        data.players.forEach(playerData => {
            if (playerData.id !== socket.id) {
                // Create player object with full player data including name
                game.otherPlayers[playerData.id] = new Player(playerData);
            } else {
                // Update our own player with server data but keep local position
                const position = game.player ? { ...game.player.position } : playerData.position;
                game.player.name = playerData.name;
                game.player.health = playerData.health;
                game.player.maxHealth = playerData.maxHealth;
                game.player.experience = playerData.experience;
                game.player.level = playerData.level;
                game.player.speed = playerData.speed;
                game.player.damage = playerData.damage;
                game.player.fireRate = playerData.fireRate;
                game.player.type = playerData.type;
            }
        });
        
        // Start game
        game.isRunning = true;
        showScreen(gameScreen);
        gameLoop();
        
        // Update UI
        gameUI.updateWave(game.wave);
        gameUI.updateHealth(game.player.health, game.player.maxHealth);
        gameUI.updateXP(game.player.experience);
    });
    
    // New wave
    socket.on('newWave', (waveNumber) => {
        game.wave = waveNumber;
        gameUI.updateWave(waveNumber);
        
        // Show upgrade choices when a new wave starts (meaning previous wave was completed)
        if (game.player && game.player.experience >= 10) {
            // Add a small delay so the wave notification appears first
            setTimeout(() => {
                // Create an upgrade popup with appropriate player XP
                const upgradeChoices = gameUI.getAvailableUpgrades();
                gameUI.showUpgradeChoices(upgradeChoices, game.player.experience);
            }, 1000);
        }
    });
    
    // Enemies spawned
    socket.on('enemiesSpawned', (enemies) => {
        // Create enemy objects
        enemies.forEach(enemyData => {
            game.enemies.push(new Enemy(enemyData));
        });
    });
    
    // Enemies update
    socket.on('enemiesUpdate', (enemies) => {
        // Update enemy positions
        enemies.forEach(enemyData => {
            const enemy = game.enemies.find(e => e.id === enemyData.id);
            if (enemy) {
                enemy.x = enemyData.position.x;
                enemy.y = enemyData.position.y;
            }
        });
    });
    
    // Enemy damaged
    socket.on('enemyDamaged', (data) => {
        const enemy = game.enemies.find(e => e.id === data.id);
        if (enemy) {
            enemy.health = data.health;
            enemy.showDamage();
        }
    });
    
    // Enemy destroyed
    socket.on('enemyDestroyed', (enemyId) => {
        game.enemies = game.enemies.filter(e => e.id !== enemyId);
    });
    
    // New projectile
    socket.on('newProjectile', (projectileData) => {
        game.projectiles.push(new Projectile(projectileData));
    });
    
    // Player move
    socket.on('playerMove', (data) => {
        const player = game.otherPlayers[data.id];
        if (player) {
            player.x = data.position.x;
            player.y = data.position.y;
            player.angle = data.angle;
        }
    });
    
    // Player updated (upgrades)
    socket.on('playerUpdated', (data) => {
        const player = game.otherPlayers[data.id];
        if (player) {
            // Update other player's stats
            player.type = data.type;
            player.health = data.health;
            player.maxHealth = data.maxHealth;
            
            // If the player evolved, update their appearance
            if (data.upgradeApplied === 'evolve') {
                // Add visual effect for evolution
                createEvolutionEffect(player.x, player.y);
            }
        }
    });
    
    // Player damaged
    socket.on('playerDamaged', (data) => {
        if (data.id === socket.id) {
            game.player.health = data.health;
            gameUI.updateHealth(data.health, data.maxHealth);
            game.player.showDamage();
        } else {
            const player = game.otherPlayers[data.id];
            if (player) {
                player.health = data.health;
                player.maxHealth = data.maxHealth;
                player.showDamage();
            }
        }
    });
    
    // Player died
    socket.on('playerDied', (playerId) => {
        if (playerId === socket.id) {
            // Handle player death
            game.player.dead = true;
            alert('You died! You will respawn when the next wave begins.');
        } else {
            // Handle other player death
            if (game.otherPlayers[playerId]) {
                game.otherPlayers[playerId].dead = true;
            }
        }
    });
    
    // Player respawned
    socket.on('playerRespawned', (data) => {
        if (data.id === socket.id) {
            // Handle own player respawn
            game.player.dead = false;
            game.player.x = data.position.x;
            game.player.y = data.position.y;
            game.player.health = data.health;
            game.player.maxHealth = data.maxHealth;
            
            // Update UI
            gameUI.updateHealth(data.health, data.maxHealth);
            
            // Show notification
            alert('You have respawned for the next wave!');
        } else {
            // Handle other player respawn
            const player = game.otherPlayers[data.id];
            if (player) {
                player.dead = false;
                player.x = data.position.x;
                player.y = data.position.y;
                player.health = data.health;
                player.maxHealth = data.maxHealth;
            }
        }
    });
    
    // Player left
    socket.on('playerLeft', (playerId) => {
        delete game.otherPlayers[playerId];
    });
    
    // Player XP update
    socket.on('playerXp', (data) => {
        if (data.id === socket.id) {
            game.player.experience = data.experience;
            gameUI.updateXP(data.experience);
        }
    });
    
    // Game over
    socket.on('gameOver', data => {
        console.log('Game over', data);
        gameOver = true;
        gameOverResult = data.result;
        gameOverTimer = 0;
        
        // Play appropriate sound
        if (data.result === 'victory') {
            // Play victory sound if exists
            // playSound('victory');
        } else {
            // Play defeat sound if exists
            // playSound('defeat');
        }
    });
}

// Register keyboard events
function registerKeyboardEvents() {
    document.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                game.keys.w = true;
                game.keys.up = true;
                break;
            case 'a':
            case 'arrowleft':
                game.keys.a = true;
                game.keys.left = true;
                break;
            case 's':
            case 'arrowdown':
                game.keys.s = true;
                game.keys.down = true;
                break;
            case 'd':
            case 'arrowright':
                game.keys.d = true;
                game.keys.right = true;
                break;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                game.keys.w = false;
                game.keys.up = false;
                break;
            case 'a':
            case 'arrowleft':
                game.keys.a = false;
                game.keys.left = false;
                break;
            case 's':
            case 'arrowdown':
                game.keys.s = false;
                game.keys.down = false;
                break;
            case 'd':
            case 'arrowright':
                game.keys.d = false;
                game.keys.right = false;
                break;
        }
    });
}

// Register mouse events
function registerMouseEvents() {
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        game.mouse.x = e.clientX - rect.left;
        game.mouse.y = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mousedown', () => {
        game.mouse.isDown = true;
    });
    
    canvas.addEventListener('mouseup', () => {
        game.mouse.isDown = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
        game.mouse.isDown = false;
    });
}

// Register button events
function registerButtonEvents() {
    // Main menu buttons
    document.getElementById('create-party-btn').addEventListener('click', () => {
        // Get custom name before creating party
        const nameInput = document.getElementById('player-name-input');
        const playerName = nameInput.value.trim();
        
        // Require a name
        if (!playerName) {
            alert('Please enter your name before creating a party.');
            nameInput.focus();
            return;
        }
        
        // Send name to server along with create party request
        socket.emit('createParty', playerName);
    });
    
    document.getElementById('join-party-btn').addEventListener('click', () => {
        // Require a name before showing party list
        const nameInput = document.getElementById('player-name-input');
        const playerName = nameInput.value.trim();
        
        if (!playerName) {
            alert('Please enter your name before joining a party.');
            nameInput.focus();
            return;
        }
        
        // Show party list when Join Party is clicked
        const partyListContainer = document.getElementById('party-list-container');
        if (partyListContainer.classList.contains('hidden')) {
            partyListContainer.classList.remove('hidden');
        } else {
            partyListContainer.classList.add('hidden');
        }
    });
    
    // Party lobby buttons
    document.getElementById('start-game-btn').addEventListener('click', () => {
        socket.emit('startGame');
    });
    
    document.getElementById('leave-party-btn').addEventListener('click', () => {
        socket.emit('leaveParty');
        showScreen(mainMenu);
    });
    
    // Game UI buttons
    document.getElementById('upgrade-toggle-btn').addEventListener('click', () => {
        const upgradeMenu = document.getElementById('upgrade-menu');
        upgradeMenu.classList.toggle('hidden');
    });
    
    // Upgrade buttons
    const upgradeButtons = document.querySelectorAll('.upgrade-btn');
    upgradeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const upgradeType = button.getAttribute('data-upgrade');
            
            // Get required XP for this upgrade
            const requiredXP = upgradeType === 'evolve' ? 50 : 10;
            
            // Check if player has enough XP
            if (game.player && game.player.experience >= requiredXP) {
                // Use the GameUI method to handle the upgrade
                gameUI.handleUpgradeClick(upgradeType);
            } else {
                alert(`Not enough XP! You need ${requiredXP} XP for this upgrade.`);
            }
        });
    });
}

// Switch between screens
function showScreen(screen) {
    mainMenu.classList.add('hidden');
    partyLobby.classList.add('hidden');
    gameScreen.classList.add('hidden');
    
    screen.classList.remove('hidden');
    
    // Make sure party list is visible when in main menu
    if (screen === mainMenu) {
        const partyListContainer = document.getElementById('party-list-container');
        partyListContainer.classList.remove('hidden');
        
        // Request fresh party list when returning to main menu
        socket.emit('requestPartyList');
    }
}

// Reset game state
function resetGame() {
    game.isRunning = false;
    game.otherPlayers = {};
    game.projectiles = [];
    game.enemies = [];
    game.gameId = null;
    game.partyId = null;
    game.isLeader = false;
    game.wave = 1;
}

// Start the game
init();

// Add game over screen drawing function
function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    
    let message = gameOverResult === 'victory' ? 'VICTORY!' : 'GAME OVER';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.font = '24px Arial';
    ctx.fillText(`Wave reached: ${game.wave}`, canvas.width / 2, canvas.height / 2);
    
    ctx.font = '18px Arial';
    ctx.fillText('Returning to menu...', canvas.width / 2, canvas.height / 2 + 50);
}

// Add function to create visual upgrade effects
function showUpgradeEffect(upgradeType) {
    // Create particles or effects based on upgrade type
    switch (upgradeType) {
        case 'speed':
            createParticleEffect(game.player.x, game.player.y, '#0ff', 20);
            break;
        case 'damage':
            createParticleEffect(game.player.x, game.player.y, '#f00', 20);
            break;
        case 'fireRate':
            createParticleEffect(game.player.x, game.player.y, '#ff0', 20);
            break;
        case 'health':
            createParticleEffect(game.player.x, game.player.y, '#0f0', 20);
            break;
        case 'evolve':
            createEvolutionEffect(game.player.x, game.player.y);
            break;
    }
}

// Create particle effect for upgrades
function createParticleEffect(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const particle = {
            x: x,
            y: y,
            size: Math.random() * 5 + 2,
            speedX: (Math.random() - 0.5) * 5,
            speedY: (Math.random() - 0.5) * 5,
            color: color,
            life: 30
        };
        
        game.particles = game.particles || [];
        game.particles.push(particle);
    }
}

// Create special effect for evolution upgrade
function createEvolutionEffect(x, y) {
    // Create a burst of particles in all directions
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const speed = 3 + Math.random() * 2;
        const distance = 10 + Math.random() * 30;
        
        const particle = {
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance,
            size: Math.random() * 6 + 4,
            speedX: Math.cos(angle) * speed,
            speedY: Math.sin(angle) * speed,
            color: `hsl(${Math.random() * 60 + 180}, 100%, 50%)`,
            life: 50 + Math.random() * 30
        };
        
        game.particles = game.particles || [];
        game.particles.push(particle);
    }
} 