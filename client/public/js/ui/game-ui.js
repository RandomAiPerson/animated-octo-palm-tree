// Game UI class
export class GameUI {
    constructor(game, socket) {
        this.game = game;
        this.socket = socket;
        
        // Initialize upgrade popup state
        this.upgradePopupShown = false;
        
        // Game UI elements
        this.waveCounter = document.getElementById('wave-counter');
        this.healthBar = document.getElementById('health-bar');
        this.healthFill = document.getElementById('health-fill');
        this.xpBar = document.getElementById('xp-bar');
        this.xpFill = document.getElementById('xp-fill');
        this.upgradeMenu = document.getElementById('upgrade-menu');
        this.upgradeButtons = document.querySelectorAll('.upgrade-btn');
        
        // Initialize UI
        this.init();
    }
    
    init() {
        // Set initial UI values
        this.updateWave(1);
        this.updateHealth(100, 100);
        this.updateXP(0);
        
        // Hide upgrade menu initially
        this.upgradeMenu.classList.add('hidden');
        
        // Add event listener for upgrade toggle
        const upgradeToggleBtn = document.getElementById('upgrade-toggle-btn');
        upgradeToggleBtn.addEventListener('click', () => {
            // If player has enough XP, show the upgrade popup
            if (this.game.player && this.game.player.experience >= 10) {
                this.showUpgradeChoices();
            } else {
                // Otherwise show the regular menu
                this.updateUpgradeButtons(this.game.player ? this.game.player.experience : 0);
                this.upgradeMenu.classList.toggle('hidden');
            }
        });
        
        // Add event listeners for upgrade buttons
        this.upgradeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const upgradeType = button.getAttribute('data-upgrade');
                
                // Add visual feedback for button click
                button.classList.add('upgrade-clicked');
                setTimeout(() => {
                    button.classList.remove('upgrade-clicked');
                }, 200);
                
                // Send upgrade request to server
                this.socket.emit('upgradePlayer', upgradeType);
                
                // Hide upgrade menu after selection
                setTimeout(() => {
                    this.upgradeMenu.classList.add('hidden');
                }, 300);
            });
        });
    }
    
    updateWave(waveNumber) {
        // Check which element exists and use it
        const waveElement = document.getElementById('wave-number') || document.getElementById('wave-counter');
        if (waveElement) {
            waveElement.textContent = waveNumber;
        }
    }
    
    updateHealth(health, maxHealth) {
        const percentage = (health / maxHealth) * 100;
        this.healthFill.style.width = `${percentage}%`;
        
        // Change color based on health percentage
        if (percentage < 25) {
            this.healthFill.style.backgroundColor = '#f33';
        } else if (percentage < 50) {
            this.healthFill.style.backgroundColor = '#f83';
        } else {
            this.healthFill.style.backgroundColor = '#f55';
        }
    }
    
    updateXP(experience) {
        // For simplicity, let's say 100 XP = 100%
        const percentage = Math.min((experience / 100) * 100, 100);
        this.xpFill.style.width = `${percentage}%`;
        
        // Change XP bar color when full to indicate upgrades available
        if (percentage >= 100) {
            this.xpFill.style.backgroundColor = '#ff0';
            this.xpFill.style.boxShadow = '0 0 10px #ff0';
            
            // Show upgrade popup if not already showing and there are upgrades available
            if (!document.getElementById('upgrade-popup') && !this.upgradePopupShown) {
                const upgrades = this.getAvailableUpgrades();
                if (upgrades.length > 0) {
                    this.showUpgradeChoices(upgrades, experience);
                    this.upgradePopupShown = true;
                }
            }
        } else {
            this.xpFill.style.backgroundColor = '#0f5';
            this.xpFill.style.boxShadow = 'none';
        }
        
        // Update upgrade buttons based on available XP
        this.updateUpgradeButtons(experience);
        
        // Also update upgrade toggle button to show current XP
        const upgradeToggleBtn = document.getElementById('upgrade-toggle-btn');
        upgradeToggleBtn.textContent = `Upgrades (${experience} XP)`;
        
        // Pulse the upgrade button when player has enough XP for upgrades
        if (experience >= 10) {
            upgradeToggleBtn.classList.add('pulse-animation');
        } else {
            upgradeToggleBtn.classList.remove('pulse-animation');
        }
    }
    
    updateUpgradeButtons(experience) {
        this.upgradeButtons.forEach(button => {
            const upgradeType = button.getAttribute('data-upgrade');
            
            // Disable/enable buttons based on XP
            if ((upgradeType === 'evolve' && experience < 50) || 
                (upgradeType !== 'evolve' && experience < 10)) {
                button.disabled = true;
                button.style.opacity = '0.5';
            } else {
                button.disabled = false;
                button.style.opacity = '1';
            }
            
            // Disable evolve button if already evolved
            if (upgradeType === 'evolve' && this.game.player && this.game.player.type !== 'basic') {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.textContent = 'Evolved';
            }
        });
    }
    
    // Add a new method to show the upgrade choices popup
    showUpgradeChoices(choices, playerXp) {
        // Create popup if it doesn't exist
        let popup = document.getElementById('upgrade-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'upgrade-popup';
            popup.className = 'upgrade-popup';
            document.getElementById('game-screen').appendChild(popup);
        }
        
        // Get player XP if not provided
        if (playerXp === undefined && this.game.player) {
            playerXp = this.game.player.experience;
        }
        
        // Generate choices if not provided
        if (!choices) {
            choices = this.getAvailableUpgrades();
        }
        
        popup.innerHTML = `
            <h2>Choose an Upgrade</h2>
            <div class="wave-info">Wave Complete! XP available: ${playerXp || 0}</div>
            <div class="upgrade-choices">
                ${choices.map(choice => `
                    <div class="upgrade-choice" data-choice="${choice}">
                        <img src="images/upgrades/${choice}.png" alt="${choice}" onerror="this.src='images/upgrades/default.png'">
                        <div class="upgrade-name">${this.formatUpgradeName(choice)}</div>
                        <div class="upgrade-cost">${this.getUpgradeCost(choice)} XP</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add click handler for upgrade choices
        const upgradeChoices = document.querySelectorAll('.upgrade-choice');
        upgradeChoices.forEach(choice => {
            choice.addEventListener('click', () => {
                const choiceId = choice.getAttribute('data-choice');
                this.handleUpgradeClick(choiceId);
                this.closeUpgradePopup();
            });
        });
        
        // Mark popup as shown
        this.upgradePopupShown = true;
    }
    
    // Add a method to get available upgrades based on XP
    getAvailableUpgrades() {
        const upgrades = ['speed', 'damage', 'fireRate', 'health'];
        const player = this.game.player;
        
        if (player) {
            // Add special upgrades if conditions met
            if (player.experience >= 30 && player.weaponType === 'normal') {
                upgrades.push('dualGuns');
            }
            
            if (player.experience >= 40 && player.weaponType === 'normal') {
                upgrades.push('shotgun');
            }
            
            if (player.type === 'basic' && player.experience >= 50) {
                upgrades.push('evolve');
            }
            
            // Filter out upgrades player can't afford
            return upgrades.filter(upgrade => player.experience >= this.getUpgradeCost(upgrade));
        }
        
        return upgrades;
    }
    
    // Format upgrade name for display
    formatUpgradeName(upgrade) {
        switch (upgrade) {
            case 'speed': return 'Speed';
            case 'damage': return 'Damage';
            case 'fireRate': return 'Fire Rate';
            case 'health': return 'Health';
            case 'evolve': return 'Evolve';
            case 'dualGuns': return 'Dual Guns';
            case 'shotgun': return 'Shotgun';
            default: return upgrade.charAt(0).toUpperCase() + upgrade.slice(1);
        }
    }
    
    // Get upgrade cost
    getUpgradeCost(upgrade) {
        switch (upgrade) {
            case 'speed': 
            case 'damage': 
            case 'fireRate': 
            case 'health': 
                return 10;
            case 'dualGuns': 
                return 30;
            case 'shotgun': 
                return 40;
            case 'evolve': 
                return 50;
            default: 
                return 10;
        }
    }
    
    // Add a method to close the upgrade popup
    closeUpgradePopup() {
        const popup = document.getElementById('upgrade-popup');
        if (popup) {
            popup.remove();
        }
        this.upgradePopupShown = false;
        
        // Check if player still has enough XP for another upgrade
        setTimeout(() => {
            if (this.game.player && this.game.player.experience >= 100) {
                this.showUpgradeChoices();
                this.upgradePopupShown = true;
            }
        }, 500); // Small delay before showing another popup
    }
    
    // Modify the existing handleUpgradeClick method
    handleUpgradeClick(upgradeType) {
        // Send upgrade request to server
        this.socket.emit('upgradePlayer', upgradeType);
        
        // Vibrate the screen slightly for feedback
        document.body.classList.add('screen-shake');
        setTimeout(() => {
            document.body.classList.remove('screen-shake');
        }, 300);
    }
} 