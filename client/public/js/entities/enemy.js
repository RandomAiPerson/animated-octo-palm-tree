// Enemy class
export class Enemy {
    constructor(data) {
        this.id = data.id;
        this.type = data.type || 'basic';
        this.x = data.position.x;
        this.y = data.position.y;
        this.radius = data.radius || 20;
        this.health = data.health;
        this.maxHealth = data.maxHealth;
        this.damage = data.damage;
        this.speed = data.speed;
        this.expValue = data.expValue;
        this.damageTakenTime = 0;
        
        // Generate a persistent color based on enemy ID and type
        this.color = this.generateEnemyColor();
        this.accentColor = this.generateAccentColor();
    }
    
    // Generate a color based on enemy type
    generateEnemyColor() {
        // Color variations based on type
        switch(this.type) {
            case 'basic':
                return '#e33'; // Red
            case 'advanced':
                return '#b0b'; // Purple
            case 'fast':
                return '#fa2'; // Orange
            case 'tank':
                return '#822'; // Dark red
            case 'boss':
                return '#f22'; // Bright red
            default:
                return '#e33'; // Default red
        }
    }
    
    // Generate accent color
    generateAccentColor() {
        switch(this.type) {
            case 'basic':
                return '#f66'; // Lighter red
            case 'advanced':
                return '#d3d'; // Lighter purple
            case 'fast':
                return '#fc5'; // Lighter orange
            case 'tank':
                return '#a44'; // Lighter dark red
            case 'boss':
                return '#f55'; // Lighter bright red
            default:
                return '#f66'; // Default lighter red
        }
    }
    
    update() {
        // Enemy movement is handled by the server
        // This method is just a placeholder for potential client-side predictions
    }
    
    render(ctx) {
        // Save context
        ctx.save();
        
        // Draw enemy body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Use enemy's color with gradient for more depth
        const gradient = ctx.createRadialGradient(
            this.x, this.y, this.radius * 0.3,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, this.accentColor);
        gradient.addColorStop(1, this.color);
        
        ctx.fillStyle = gradient;
        
        // Flash white if recently damaged
        if (Date.now() - this.damageTakenTime < 100) {
            ctx.fillStyle = '#fff';
        }
        
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke();
        
        // Draw health bar
        this.renderHealthBar(ctx);
        
        // Draw enemy features based on type
        switch(this.type) {
            case 'basic':
                this.renderBasicEnemy(ctx);
                break;
            case 'advanced':
                this.renderAdvancedEnemy(ctx);
                break;
            case 'fast':
                this.renderFastEnemy(ctx);
                break;
            case 'tank':
                this.renderTankEnemy(ctx);
                break;
            case 'boss':
                this.renderBossEnemy(ctx);
                break;
            default:
                this.renderBasicEnemy(ctx);
        }
        
        // Restore context
        ctx.restore();
    }
    
    renderHealthBar(ctx) {
        const barWidth = this.radius * 2;
        const barHeight = 4;
        const x = this.x - barWidth / 2;
        const y = this.y - this.radius - 8;
        
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
    
    renderBasicEnemy(ctx) {
        // Basic enemy features - spikes
        const spikes = 6;
        const spikeLength = 8;
        
        for (let i = 0; i < spikes; i++) {
            const angle = (i / spikes) * Math.PI * 2;
            const startX = this.x + Math.cos(angle) * this.radius;
            const startY = this.y + Math.sin(angle) * this.radius;
            const endX = this.x + Math.cos(angle) * (this.radius + spikeLength);
            const endY = this.y + Math.sin(angle) * (this.radius + spikeLength);
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = '#e55';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    renderAdvancedEnemy(ctx) {
        // Advanced enemy features - more spikes and inner circle
        const spikes = 8;
        const spikeLength = 10;
        
        for (let i = 0; i < spikes; i++) {
            const angle = (i / spikes) * Math.PI * 2;
            const startX = this.x + Math.cos(angle) * this.radius;
            const startY = this.y + Math.sin(angle) * this.radius;
            const endX = this.x + Math.cos(angle) * (this.radius + spikeLength);
            const endY = this.y + Math.sin(angle) * (this.radius + spikeLength);
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = '#c0c';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#e0e';
        ctx.fill();
    }
    
    renderFastEnemy(ctx) {
        // Fast enemy - streamlined with speed marks
        ctx.strokeStyle = this.accentColor;
        ctx.lineWidth = 2;
        
        // Draw speed lines
        for (let i = 0; i < 3; i++) {
            const angle = Math.PI / 4 + (i * Math.PI / 2);
            
            ctx.beginPath();
            const startX = this.x - Math.cos(angle) * (this.radius + 5);
            const startY = this.y - Math.sin(angle) * (this.radius + 5);
            const endX = this.x - Math.cos(angle) * (this.radius + 15);
            const endY = this.y - Math.sin(angle) * (this.radius + 15);
            
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }
    
    renderTankEnemy(ctx) {
        // Tank enemy - heavily armored
        const segments = 6;
        const innerRadius = this.radius * 0.6;
        
        // Draw armor plates
        ctx.fillStyle = '#666';
        for (let i = 0; i < segments; i++) {
            const startAngle = (i / segments) * Math.PI * 2;
            const endAngle = ((i + 1) / segments) * Math.PI * 2;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, startAngle, endAngle);
            ctx.lineTo(this.x, this.y);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, startAngle, endAngle);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Inner core
        ctx.beginPath();
        ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
    
    renderBossEnemy(ctx) {
        // Boss enemy - crown and multiple spikes
        const spikes = 12;
        const spikeLength = 15;
        
        // Draw spikes
        for (let i = 0; i < spikes; i++) {
            const angle = (i / spikes) * Math.PI * 2;
            const startX = this.x + Math.cos(angle) * this.radius;
            const startY = this.y + Math.sin(angle) * this.radius;
            const endX = this.x + Math.cos(angle) * (this.radius + spikeLength);
            const endY = this.y + Math.sin(angle) * (this.radius + spikeLength);
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Draw crown
        ctx.beginPath();
        ctx.moveTo(this.x - this.radius * 0.6, this.y - this.radius * 0.6);
        ctx.lineTo(this.x - this.radius * 0.4, this.y - this.radius * 1.0);
        ctx.lineTo(this.x - this.radius * 0.2, this.y - this.radius * 0.6);
        ctx.lineTo(this.x, this.y - this.radius * 1.2);
        ctx.lineTo(this.x + this.radius * 0.2, this.y - this.radius * 0.6);
        ctx.lineTo(this.x + this.radius * 0.4, this.y - this.radius * 1.0);
        ctx.lineTo(this.x + this.radius * 0.6, this.y - this.radius * 0.6);
        ctx.fillStyle = '#fd0';
        ctx.fill();
        ctx.strokeStyle = '#b90';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#f00';
        ctx.fill();
    }
    
    showDamage() {
        this.damageTakenTime = Date.now();
    }
} 