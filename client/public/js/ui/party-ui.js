// Party UI class
export class PartyUI {
    constructor(socket, game) {
        this.socket = socket;
        this.game = game;
        
        // UI elements
        this.partyList = document.getElementById('party-list');
        this.partyId = document.getElementById('party-id');
        this.partyCount = document.getElementById('party-count');
        this.playerList = document.getElementById('player-list');
        this.startGameBtn = document.getElementById('start-game-btn');
        
        // Initialize UI
        this.init();
    }
    
    init() {
        // Listen for party list updates
        this.socket.on('partyList', (parties) => {
            this.updatePartyList(parties);
        });
    }
    
    updatePartyList(parties) {
        // Clear the party list
        this.partyList.innerHTML = '';
        
        if (parties.length === 0) {
            const noParties = document.createElement('div');
            noParties.className = 'party-item';
            noParties.textContent = 'No parties available';
            this.partyList.appendChild(noParties);
            return;
        }
        
        // Add each party to the list
        parties.forEach(party => {
            const partyItem = document.createElement('div');
            partyItem.className = 'party-item';
            
            const partyName = document.createElement('span');
            partyName.textContent = `Party #${party.id.substr(0, 4)}`;
            
            const partySize = document.createElement('span');
            partySize.textContent = `${party.players}/${party.maxPlayers}`;
            
            partyItem.appendChild(partyName);
            partyItem.appendChild(partySize);
            
            // Add click handler
            partyItem.addEventListener('click', () => {
                // Get custom name before joining party
                const nameInput = document.getElementById('player-name-input');
                const playerName = nameInput.value.trim();
                
                // Name should already be validated by the join button, but check again
                if (!playerName) {
                    alert('Please enter your name before joining a party.');
                    nameInput.focus();
                    return;
                }
                
                // Send join party request with name
                this.socket.emit('joinParty', { partyId: party.id, playerName });
            });
            
            this.partyList.appendChild(partyItem);
        });
    }
    
    updatePartyInfo(party) {
        // Update party ID
        this.partyId.textContent = `Party ID: ${party.id.substr(0, 8)}`;
        
        // Update party count
        this.partyCount.textContent = `${party.members.length}/4`;
        
        // Update player list
        this.updatePlayerList(party.members);
        
        // Update start game button visibility
        this.startGameBtn.style.display = party.leader === this.socket.id ? 'block' : 'none';
    }
    
    updatePlayerList(playerIds) {
        // Clear the player list
        this.playerList.innerHTML = '';
        
        // Keep track of already added players to avoid duplicates
        const addedPlayers = new Set();
        
        // Get all player data from server for accurate names
        this.socket.emit('getPartyMemberDetails', playerIds, (playerDetails) => {
            // Use the returned player details to populate the list
            playerDetails.forEach(player => {
                // Skip if already added
                if (addedPlayers.has(player.id)) return;
                addedPlayers.add(player.id);
                
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                
                // Highlight the player if they're the leader
                if (this.game.isLeader && player.id === this.socket.id) {
                    playerItem.style.backgroundColor = 'rgba(0, 170, 255, 0.3)';
                    playerItem.textContent = `👑 ${player.name} (You)`;
                } else if (player.id === this.socket.id) {
                    playerItem.textContent = `${player.name} (You)`;
                } else {
                    playerItem.textContent = player.name;
                }
                
                this.playerList.appendChild(playerItem);
            });
        });
    }
} 