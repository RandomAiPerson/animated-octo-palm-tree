// Projectile class
export class Projectile {
    constructor(data) {
        this.id = data.id;
        this.ownerId = data.ownerId;
        this.x = data.position.x;
        this.y = data.position.y;
        this.angle = data.angle;
        this.speed = data.speed;
        this.damage = data.damage;
        this.radius = 5;
        this.timeToLive = data.timeToLive || 100;
        this.isExpired = false;
    }
    
    update() {
        // Move projectile
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        
        // Decrease TTL
        this.timeToLive--;
        
        // Check if projectile has expired
        if (this.timeToLive <= 0) {
            this.isExpired = true;
        }
        
        // Check if projectile is out of bounds
        if (this.x < -50 || this.x > 1650 || this.y < -50 || this.y > 950) {
            this.isExpired = true;
        }
    }
    
    render(ctx) {
        if (this.isExpired) return;
        
        // Save context
        ctx.save();
        
        // Draw projectile
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        
        // Draw projectile trail
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        const trailLength = 15;
        const trailX = this.x - Math.cos(this.angle) * trailLength;
        const trailY = this.y - Math.sin(this.angle) * trailLength;
        ctx.lineTo(trailX, trailY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Restore context
        ctx.restore();
    }
} 