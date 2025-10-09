// Matrix-style background animation for Chatsubo MUD Blog
// Matrix-style background animation for Chatsubo MUD Blog
// Inspired by the classic Matrix digital rain effect

class MatrixRain {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('matrix');
        
        if (!this.container) return;
        
        this.container.appendChild(this.canvas);
        
        // Configuration
        this.fontSize = 14;
        this.columns = 0;
        this.drops = [];
        
        // Characters to use in the matrix
        this.chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;':\",./<>?`~";
        this.katakana = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
        this.matrixChars = this.chars + this.katakana;
        
        this.init();
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    init() {
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.opacity = '0.1';
        
        this.resize();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.columns = Math.floor(this.canvas.width / this.fontSize);
        
        // Initialize drops array
        this.drops = [];
        for (let i = 0; i < this.columns; i++) {
            this.drops[i] = Math.random() * -100;
        }
    }
    
    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.resize();
        }, 100);
    }
    
    draw() {
        // Create fade effect
        this.ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set text properties
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = `${this.fontSize}px monospace`;
        
        // Draw characters
        for (let i = 0; i < this.drops.length; i++) {
            // Random character
            const char = this.matrixChars[Math.floor(Math.random() * this.matrixChars.length)];
            
            // Draw character
            const x = i * this.fontSize;
            const y = this.drops[i] * this.fontSize;
            
            // Add some variation in brightness
            const alpha = Math.random() * 0.5 + 0.5;
            this.ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
            this.ctx.fillText(char, x, y);
            
            // Reset drop to top when it reaches bottom
            if (y > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }
            
            // Move drop down
            this.drops[i]++;
        }
    }
    
    animate() {
        this.draw();
        setTimeout(() => {
            requestAnimationFrame(() => this.animate());
        }, 50); // Control animation speed
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MatrixRain();
});

// Cyberpunk terminal effect for code blocks
document.addEventListener('DOMContentLoaded', () => {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        block.parentElement.classList.add('terminal');
    });
});

// Add typing effect to certain elements
class TypingEffect {
    constructor(element, text, speed = 50) {
        this.element = element;
        this.text = text;
        this.speed = speed;
        this.index = 0;
        
        this.element.textContent = '';
        this.type();
    }
    
    type() {
        if (this.index < this.text.length) {
            this.element.textContent += this.text.charAt(this.index);
            this.index++;
            setTimeout(() => this.type(), this.speed);
        }
    }
}

// Apply typing effect to certain elements on page load
document.addEventListener('DOMContentLoaded', () => {
    const typingElements = document.querySelectorAll('[data-typing]');
    
    typingElements.forEach(element => {
        const originalText = element.textContent;
        const speed = parseInt(element.getAttribute('data-typing-speed')) || 50;
        
        // Add intersection observer for performance
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    new TypingEffect(element, originalText, speed);
                    observer.unobserve(element);
                }
            });
        });
        
        observer.observe(element);
    });
});

// Add glitch effect on hover for certain elements
document.addEventListener('DOMContentLoaded', () => {
    const glitchElements = document.querySelectorAll('.site-title a, .post-title');
    
    glitchElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            element.style.animation = 'glitch 0.3s ease-in-out';
        });
        
        element.addEventListener('animationend', () => {
            element.style.animation = '';
        });
    });
});

// Add CSS for glitch effect
const glitchCSS = `
@keyframes glitch {
    0% { transform: translate(0); }
    10% { transform: translate(-2px, -2px); }
    20% { transform: translate(2px, 2px); }
    30% { transform: translate(-2px, 2px); }
    40% { transform: translate(2px, -2px); }
    50% { transform: translate(-2px, -2px); }
    60% { transform: translate(2px, 2px); }
    70% { transform: translate(-2px, 2px); }
    80% { transform: translate(2px, -2px); }
    90% { transform: translate(-2px, -2px); }
    100% { transform: translate(0); }
}
`;

// Inject glitch CSS
const style = document.createElement('style');
style.textContent = glitchCSS;
document.head.appendChild(style);