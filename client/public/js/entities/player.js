// Player class
export class Player {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.x = data.position.x;
        this.y = data.position.y;
        this.angle = data.angle || 0;
        this.health = data.health;
        this.maxHealth = data.maxHealth;
        this.experience = data.experience || 0;
        this.level = data.level || 1;
        this.speed = data.speed || 5;
        this.damage = data.damage || 10;
        this.fireRate = data.fireRate || 5;
        this.type = data.type || 'basic';
        this.weaponType = data.weaponType || 'normal';
        this.radius = 20;
        this.damageTakenTime = 0;
        this.dead = false;
        
        // Generate a random color for this player (excluding red shades)
        // Use consistent colors for same player ID
        this.color = this.generatePlayerColor(this.id);
        this.secondaryColor = this.generateSecondaryColor(this.color);
    }
    
    // Generate a unique but consistent color based on player ID
    generatePlayerColor(id) {
        // Extract a number from the player ID to use as a seed
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        
        // Set random but consistent hue based on hash (avoid red which is 0-20 and 340-359)
        const hue = ((Math.abs(hash) % 320) + 21) % 360; // Avoid red hues
        
        // Use a bright, saturated color
        return `hsl(${hue}, 80%, 60%)`;
    }
    
    // Generate a darker version of the main color for secondary elements
    generateSecondaryColor(mainColor) {
        // Extract hue from main color
        const hue = parseInt(mainColor.match(/hsl\((\d+)/)[1]);
        
        // Make a darker, more saturated version
        return `hsl(${hue}, 90%, 40%)`;
    }
    
    update() {
        // This will be called each frame for the client's own player
    }
    
    move(dx, dy) {
        if (this.dead) return;
        
        // Apply movement with speed
        this.x += dx * this.speed;
        this.y += dy * this.speed;
        
        // Keep player within canvas bounds
        this.x = Math.max(this.radius, Math.min(this.x, 1600 - this.radius));
        this.y = Math.max(this.radius, Math.min(this.y, 900 - this.radius));
    }
    
    render(ctx) {
        if (this.dead) return;
        
        // Save context
        ctx.save();
        
        // Draw player body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Use player's unique color
        ctx.fillStyle = this.color;
        
        // Flash white if recently damaged
        if (Date.now() - this.damageTakenTime < 200) {
            ctx.fillStyle = '#fff';
        }
        
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        
        // Draw health bar above player
        this.renderHealthBar(ctx);
        
        // Draw weapon based on player type
        this.renderWeapon(ctx);
        
        // Draw player name
        this.renderNameTag(ctx);
        
        // Restore context
        ctx.restore();
    }
    
    renderHealthBar(ctx) {
        const barWidth = 40;
        const barHeight = 5;
        const x = this.x - barWidth / 2;
        const y = this.y - this.radius - 10;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health fill
        ctx.fillStyle = '#f55';
        const fillWidth = (this.health / this.maxHealth) * barWidth;
        ctx.fillRect(x, y, fillWidth, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
    
    renderWeapon(ctx) {
        // Position at player center
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        if (this.type === 'basic') {
            // Basic tank with different weapon types
            switch (this.weaponType) {
                case 'dual':
                    // Dual guns
                    const offsetY = 7;
                    
                    // Top barrel
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, -offsetY - 4, this.radius + 12, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, -offsetY - 4, this.radius + 12, 6);
                    
                    // Bottom barrel
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, offsetY - 2, this.radius + 12, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, offsetY - 2, this.radius + 12, 6);
                    break;
                    
                case 'shotgun':
                    // Wide shotgun barrel
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, -6, this.radius + 5, 12);
                    
                    // Extended barrel
                    ctx.fillRect(this.radius + 5, -4, 10, 8);
                    
                    // Barrel tip (wider to suggest spread)
                    ctx.beginPath();
                    ctx.moveTo(this.radius + 15, -6);
                    ctx.lineTo(this.radius + 15, 6);
                    ctx.lineTo(this.radius + 12, 4);
                    ctx.lineTo(this.radius + 12, -4);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Outline
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, -6, this.radius + 5, 12);
                    ctx.strokeRect(this.radius + 5, -4, 10, 8);
                    break;
                    
                default:
                    // Normal single barrel
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, -4, this.radius + 10, 8);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, -4, this.radius + 10, 8);
                    break;
            }
        } else if (this.type === 'advanced') {
            // Advanced tank with different weapon types
            switch (this.weaponType) {
                case 'dual':
                    // Dual advanced guns with spread
                    const offsetY = 9;
                    
                    // Top barrel
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, -offsetY - 4, this.radius + 15, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, -offsetY - 4, this.radius + 15, 6);
                    
                    // Bottom barrel
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, offsetY - 2, this.radius + 15, 6);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, offsetY - 2, this.radius + 15, 6);
                    break;
                    
                case 'shotgun':
                    // Advanced shotgun with side barrels
                    // Center barrel
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, -5, this.radius + 15, 10);
                    
                    // Side barrels
                    ctx.fillRect(5, -10, this.radius + 5, 4);
                    ctx.fillRect(5, 6, this.radius + 5, 4);
                    
                    // Barrel tip (wider to suggest spread)
                    ctx.beginPath();
                    ctx.moveTo(this.radius + 15, -7);
                    ctx.lineTo(this.radius + 18, -5);
                    ctx.lineTo(this.radius + 18, 5);
                    ctx.lineTo(this.radius + 15, 7);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Outline
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, -5, this.radius + 15, 10);
                    ctx.strokeRect(5, -10, this.radius + 5, 4);
                    ctx.strokeRect(5, 6, this.radius + 5, 4);
                    break;
                    
                default:
                    // Default advanced dual barrels
                    ctx.fillStyle = this.secondaryColor;
                    ctx.fillRect(0, -8, this.radius + 12, 5);
                    ctx.fillRect(0, 3, this.radius + 12, 5);
                    
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, -8, this.radius + 12, 5);
                    ctx.strokeRect(0, 3, this.radius + 12, 5);
                    break;
            }
        }
    }
    
    renderNameTag(ctx) {
        // Position the nametag directly above the player circle
        const nameTagY = this.y - this.radius - 12;
        
        // Set font before measuring text
        ctx.font = 'bold 14px Arial';
        
        const textMetrics = ctx.measureText(this.name);
        const textWidth = textMetrics.width;
        const padding = 6;
        
        // Draw background directly above the player
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(this.x - textWidth/2 - padding, nameTagY - 8, textWidth + padding*2, 16);
        
        // Add colored border matching player color
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - textWidth/2 - padding, nameTagY - 8, textWidth + padding*2, 16);
        
        // Draw text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, this.x, nameTagY);
    }
    
    showDamage() {
        this.damageTakenTime = Date.now();
    }
} 