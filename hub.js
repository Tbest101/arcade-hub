/* ================================================
   HUB — Game Launcher & Particle Background
   ================================================ */

const Hub = (() => {
    const games = [];
    let activeGame = null;

    // DOM refs (resolved on boot)
    let hubScreen, gameScreen, gameContainer, backBtn, gamesGrid, canvas, ctx;

    // Particle system state
    let particles = [];
    let animFrameId = null;

    /* ---------- PUBLIC API ---------- */

    function registerGame(game) {
        games.push(game);
    }

    function boot() {
        hubScreen = document.getElementById('hub-screen');
        gameScreen = document.getElementById('game-screen');
        gameContainer = document.getElementById('game-container');
        backBtn = document.getElementById('back-btn');
        gamesGrid = document.getElementById('games-grid');
        canvas = document.getElementById('particles-canvas');
        ctx = canvas.getContext('2d');

        renderCards();
        initParticles();
        backBtn.addEventListener('click', goToHub);
    }

    /* ---------- CARDS ---------- */

    function renderCards() {
        gamesGrid.innerHTML = '';
        games.forEach((g) => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.id = `card-${g.id}`;
            card.style.setProperty('--card-glow', g.color);
            card.innerHTML = `
                <span class="card-emoji">${g.emoji}</span>
                <div class="card-title">${g.title}</div>
                <p class="card-desc">${g.description}</p>
                <div class="card-play-hint">▶ PLAY</div>
            `;
            // Glow border on hover via ::before
            card.style.cssText += `--card-glow: ${g.color};`;
            card.querySelector('.card-emoji').style.filter = `drop-shadow(0 0 18px ${g.color})`;
            card.addEventListener('click', () => launchGame(g));
            gamesGrid.appendChild(card);

            // Stagger entrance animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            requestAnimationFrame(() => {
                card.style.transition = 'opacity 0.6s var(--ease-out-expo), transform 0.6s var(--ease-out-expo)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            });
        });
    }

    /* ---------- NAVIGATION ---------- */

    function launchGame(game) {
        activeGame = game;
        hubScreen.classList.remove('active');
        setTimeout(() => {
            gameScreen.classList.add('active');
            game.init(gameContainer);
        }, 300);
    }

    function goToHub() {
        if (activeGame && activeGame.destroy) {
            activeGame.destroy();
        }
        activeGame = null;
        gameContainer.innerHTML = '';
        gameScreen.classList.remove('active');
        setTimeout(() => {
            hubScreen.classList.add('active');
        }, 300);
    }

    /* ---------- PARTICLES ---------- */

    function initParticles() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        createParticles();
        animateParticles();
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticles() {
        particles = [];
        const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 120);
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.4 + 0.1,
                color: ['#a855f7', '#22d3ee', '#ec4899', '#34d399'][Math.floor(Math.random() * 4)]
            });
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        });

        // Draw faint connections
        ctx.globalAlpha = 1;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = particles[i].color;
                    ctx.globalAlpha = 0.04 * (1 - dist / 120);
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;

        animFrameId = requestAnimationFrame(animateParticles);
    }

    /* ---------- EXPOSE ---------- */

    return { registerGame, boot, goToHub };
})();
