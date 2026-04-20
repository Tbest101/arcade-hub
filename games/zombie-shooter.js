/* ================================================
   ZOMBIE ARSENAL — Realistic Survivor Edition
   ================================================
   Left Side: Arsenal (Unlock Weapons & Multipliers)
   Right Side: Combat (Zombie Horde)
   Shooter: Controlled by dragging at the bottom.
   VFX: Blood splatters, muzzle flashes, screen shake.
   ================================================ */

const ZombieShooter = (() => {
    // Config
    const WEAPONS = [
        { id: 'pistol', name: 'PISTOL', cost: 0, damage: 1, rate: 450, spread: 0, count: 1 },
        { id: 'dual', name: 'DUAL 9MM', cost: 15, damage: 1, rate: 300, spread: 2, count: 2 },
        { id: 'smg', name: 'TACTICAL SMG', cost: 45, damage: 1.2, rate: 120, spread: 8, count: 1 },
        { id: 'shotgun', name: '12-GAUGE', cost: 120, damage: 1.5, rate: 700, spread: 35, count: 5 },
        { id: 'ar', name: 'ASSAULT RIFLE', cost: 300, damage: 3, rate: 200, spread: 4, count: 1 }
    ];

    // State
    let container = null;
    let canvas, ctx;
    let animId;
    let lastTime = 0;
    
    let assets = {
        survivor: new Image(),
        zombie: new Image(),
        crate: new Image(),
        loaded: false
    };

    let gameState = 'playing';
    let score = 0;
    let currentWeaponIdx = 0;
    let shooterCount = 1;
    let mouseX = 0;
    
    let entities = {
        bullets: [],
        zombies: [],
        arsenalItems: [],
        multipliers: [],
        particles: [],
        bloodSplatters: []
    };

    let timers = {
        fire: 0,
        zombieSpawn: 0,
        arsenalSpawn: 0
    };

    let screenShake = 0;

    /* ---------- LIFECYCLE ---------- */

    function init(parentContainer) {
        container = parentContainer;
        loadAssets().then(() => {
            resetState();
            renderBase();
            startLoop();
        });
    }

    function loadAssets() {
        return new Promise((resolve) => {
            let count = 0;
            const total = 3;
            const check = () => {
                count++;
                if (count === total) {
                    assets.loaded = true;
                    resolve();
                }
            };
            assets.survivor.onload = check;
            assets.zombie.onload = check;
            assets.crate.onload = check;
            
            assets.survivor.src = 'assets/survivor.png';
            assets.zombie.src = 'assets/zombie.png';
            assets.crate.src = 'assets/crate.png';
        });
    }

    function destroy() {
        cancelAnimationFrame(animId);
        window.removeEventListener('mousemove', handleInput);
        window.removeEventListener('touchmove', handleInput);
        container.innerHTML = '';
    }

    function resetState() {
        score = 0;
        currentWeaponIdx = 0;
        shooterCount = 1;
        gameState = 'playing';
        entities = { bullets: [], zombies: [], arsenalItems: [], multipliers: [], particles: [], bloodSplatters: [] };
        timers = { fire: 0, zombieSpawn: 0, arsenalSpawn: 0 };
        screenShake = 0;
    }

    /* ---------- UI SETUP ---------- */

    function renderBase() {
        container.innerHTML = `
            <div class="zs-wrapper">
                <canvas id="zs-canvas"></canvas>
                <div class="zs-hud">
                    <div class="zs-score">RESOURCES: <span id="zs-score-val">0</span></div>
                    <div class="zs-weapon">ARMAMENT: <span id="zs-weapon-val">${WEAPONS[0].name}</span></div>
                    <div class="zs-count">SURVIVORS: <span id="zs-count-val">1</span></div>
                </div>
            </div>
        `;

        canvas = document.getElementById('zs-canvas');
        ctx = canvas.getContext('2d');
        resize();

        window.addEventListener('resize', resize);
        canvas.addEventListener('mousemove', handleInput);
        canvas.addEventListener('touchmove', (e) => handleInput(e.touches[0]));
    }

    function resize() {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    function handleInput(e) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
    }

    /* ---------- GAME LOOP ---------- */

    function startLoop() {
        lastTime = performance.now();
        loop(lastTime);
    }

    function loop(now) {
        const dt = now - lastTime;
        lastTime = now;

        if (gameState === 'playing') {
            update(dt);
        }
        draw();

        animId = requestAnimationFrame(loop);
    }

    /* ---------- UPDATE ---------- */

    function update(dt) {
        const weapon = WEAPONS[currentWeaponIdx];

        timers.fire += dt;
        if (timers.fire >= weapon.rate) {
            fire(weapon);
            timers.fire = 0;
        }

        updateSpawning(dt);
        updateEntities(dt);
        checkCollisions();

        if (screenShake > 0) screenShake -= dt * 0.05;
        if (screenShake < 0) screenShake = 0;

        document.getElementById('zs-score-val').textContent = score;
        document.getElementById('zs-weapon-val').textContent = weapon.name;
        document.getElementById('zs-count-val').textContent = shooterCount;
    }

    function fire(weapon) {
        const spacing = 40;
        const startX = mouseX - ((shooterCount - 1) * spacing) / 2;

        for (let i = 0; i < shooterCount; i++) {
            const x = startX + i * spacing;
            const subSpacing = 10;
            const subStartX = x - ((weapon.count - 1) * subSpacing) / 2;

            for (let j = 0; j < weapon.count; j++) {
                const subX = subStartX + j * subSpacing;
                const angle = (Math.random() - 0.5) * (weapon.spread * Math.PI / 180);
                
                entities.bullets.push({
                    x: subX,
                    y: canvas.height - 70,
                    vx: Math.sin(angle) * 6,
                    vy: -6,
                    damage: weapon.damage
                });
            }
            // Muzzle flash particles
            createFlash(x, canvas.height - 70);
        }
    }

    function updateSpawning(dt) {
        // Zombies (Right)
        timers.zombieSpawn += dt;
        if (timers.zombieSpawn > Math.max(1200 - score/8, 400)) {
            const size = Math.random() * 20 + 35;
            const health = Math.floor(size / 10) + Math.floor(score / 400);
            entities.zombies.push({
                x: canvas.width / 2 + Math.random() * (canvas.width / 2 - size),
                y: -size,
                size: size,
                health: health,
                maxHealth: health,
                speed: 0.04 + Math.random() * 0.04 + (score / 12000),
                rotation: Math.PI
            });
            timers.zombieSpawn = 0;
        }

        // Arsenal Items (Left)
        timers.arsenalSpawn += dt;
        if (timers.arsenalSpawn > 4000) {
            const typeProb = Math.random();
            const laneWidth = canvas.width / 2;
            if (typeProb < 0.35 && currentWeaponIdx < WEAPONS.length - 1) {
                const nextWep = WEAPONS[currentWeaponIdx + 1];
                entities.arsenalItems.push({
                    x: Math.random() * (laneWidth - 80) + 40,
                    y: -60,
                    type: 'weapon',
                    health: nextWep.cost,
                    maxHealth: nextWep.cost,
                    name: nextWep.name
                });
            } else {
                const multType = Math.random() > 0.5 ? 'add' : 'mul';
                const val = multType === 'add' ? Math.floor(Math.random() * 2) + 1 : 2;
                entities.multipliers.push({
                    x: Math.random() * (laneWidth - 80) + 40,
                    y: -60,
                    type: multType,
                    val: val,
                    health: multType === 'add' ? 8 : 20,
                    maxHealth: multType === 'add' ? 8 : 20
                });
            }
            timers.arsenalSpawn = 0;
        }
    }

    function updateEntities(dt) {
        entities.bullets = entities.bullets.filter(b => {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            return b.y > 0 && b.x > 0 && b.x < canvas.width;
        });

        entities.zombies.forEach(z => {
            z.y += z.speed * dt;
            // Subtle wiggle
            z.rotation = Math.PI + Math.sin(Date.now() / 200) * 0.1;
            if (z.y + z.size > canvas.height - 60) gameOver();
        });

        entities.arsenalItems.forEach(item => item.y += 0.03 * dt);
        entities.multipliers.forEach(m => m.y += 0.03 * dt);

        // Particles
        entities.particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        });
        entities.particles = entities.particles.filter(p => p.life > 0);

        // Blood Splatters (fade away)
        entities.bloodSplatters.forEach(s => s.life -= dt);
        entities.bloodSplatters = entities.bloodSplatters.filter(s => s.life > 0);
    }

    function checkCollisions() {
        entities.bullets.forEach(b => {
            entities.zombies.forEach(z => {
                if (!b.used && b.x > z.x && b.x < z.x + z.size && b.y > z.y && b.y < z.y + z.size) {
                    z.health -= b.damage;
                    b.used = true;
                    createBlood(b.x, b.y);
                    if (z.health <= 0) {
                        score += Math.floor(z.size / 2);
                        createExplosion(z.x + z.size/2, z.y + z.size/2, '#34d399', 15);
                        screenShake = 5;
                    }
                }
            });

            entities.arsenalItems.forEach(item => {
                if (!b.used && Math.hypot(b.x - item.x, b.y - item.y) < 30) {
                    item.health -= b.damage;
                    b.used = true;
                    createExplosion(b.x, b.y, '#facc15', 3);
                    if (item.health <= 0) {
                        currentWeaponIdx++;
                        score += 200;
                        createExplosion(item.x, item.y, '#facc15', 20);
                    }
                }
            });

            entities.multipliers.forEach(m => {
                if (!b.used && Math.hypot(b.x - m.x, b.y - m.y) < 30) {
                    m.health -= b.damage;
                    b.used = true;
                    createExplosion(b.x, b.y, '#ec4899', 3);
                    if (m.health <= 0) {
                        if (m.type === 'add') shooterCount += m.val;
                        else shooterCount *= m.val;
                        shooterCount = Math.min(shooterCount, 12);
                        score += 100;
                        createExplosion(m.x, m.y, '#ec4899', 20);
                    }
                }
            });
        });

        entities.zombies = entities.zombies.filter(z => z.health > 0);
        entities.arsenalItems = entities.arsenalItems.filter(item => item.health > 0);
        entities.multipliers = entities.multipliers.filter(m => m.health > 0);
    }

    /* ---------- VFX HELPERS ---------- */

    function createBlood(x, y) {
        for (let i = 0; i < 3; i++) {
            entities.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                life: 300,
                color: '#991b1b',
                size: Math.random() * 3 + 1
            });
        }
        // Persistent splatter
        if (Math.random() > 0.7) {
            entities.bloodSplatters.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                size: Math.random() * 15 + 5,
                life: 5000,
                opacity: Math.random() * 0.4 + 0.1
            });
        }
    }

    function createFlash(x, y) {
        for (let i = 0; i < 4; i++) {
            entities.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 0.4,
                vy: -Math.random() * 0.4,
                life: 100,
                color: '#facc15',
                size: Math.random() * 4 + 2
            });
        }
    }

    function createExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.5;
            entities.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 600,
                color: color,
                size: Math.random() * 5 + 2
            });
        }
    }

    /* ---------- DRAWING ---------- */

    function draw() {
        ctx.save();
        if (screenShake > 0) {
            ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        }

        // Background
        ctx.fillStyle = '#0f1016';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Split line
        ctx.setLineDash([15, 15]);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(canvas.width/2, 0);
        ctx.lineTo(canvas.width/2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Blood Splatters
        entities.bloodSplatters.forEach(s => {
            ctx.globalAlpha = (s.life / 5000) * s.opacity;
            ctx.fillStyle = '#450a0a';
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, s.size, s.size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw Zombies
        entities.zombies.forEach(z => {
            ctx.save();
            ctx.translate(z.x + z.size/2, z.y + z.size/2);
            ctx.rotate(z.rotation);
            ctx.drawImage(assets.zombie, -z.size/2, -z.size/2, z.size, z.size);
            ctx.restore();
            // Health Bar
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(z.x, z.y - 10, z.size, 4);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(z.x, z.y - 10, z.size * (z.health / z.maxHealth), 4);
        });

        // Draw Arsenal
        entities.arsenalItems.forEach(item => {
            ctx.drawImage(assets.crate, item.x - 25, item.y - 25, 50, 50);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(item.x - 25, item.y - 35, 50, 4);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(item.x - 25, item.y - 35, 50 * (item.health / item.maxHealth), 4);
            ctx.font = 'bold 8px "Orbitron"';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(item.name, item.x, item.y + 40);
        });

        // Draw Multipliers
        entities.multipliers.forEach(m => {
            ctx.fillStyle = 'rgba(236, 72, 153, 0.1)';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = 'bold 18px "Orbitron"';
            ctx.fillStyle = '#ec4899';
            ctx.textAlign = 'center';
            ctx.fillText((m.type === 'add' ? '+' : 'x') + m.val, m.x, m.y + 7);
            // Health Bar
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(m.x - 25, m.y - 45, 50, 4);
            ctx.fillStyle = '#ec4899';
            ctx.fillRect(m.x - 25, m.y - 45, 50 * (m.health / m.maxHealth), 4);
        });

        // Draw Bullets
        entities.bullets.forEach(b => {
            ctx.fillStyle = '#fff';
            ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
        });
        ctx.shadowBlur = 0;

        // Draw Particles
        entities.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Shooters
        const spacing = 40;
        const startX = mouseX - ((shooterCount - 1) * spacing) / 2;
        for (let i = 0; i < shooterCount; i++) {
            const x = startX + i * spacing;
            ctx.save();
            ctx.translate(x, canvas.height - 40);
            ctx.drawImage(assets.survivor, -20, -20, 40, 40);
            ctx.restore();
        }

        if (gameState === 'gameover') {
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 40px "Orbitron"';
            ctx.textAlign = 'center';
            ctx.fillText('OUTRUN', canvas.width / 2, canvas.height / 2);
            ctx.font = '16px "Orbitron"';
            ctx.fillStyle = '#9ca3af';
            ctx.fillText(`RESOURCES SECURED: ${score}`, canvas.width / 2, canvas.height / 2 + 50);
            ctx.fillStyle = '#fff';
            ctx.fillText('CLICK TO DEPLOY AGAIN', canvas.width / 2, canvas.height / 2 + 100);
        }

        ctx.restore();
    }

    function gameOver() {
        gameState = 'gameover';
        canvas.onclick = () => {
            resetState();
            canvas.onclick = null;
        };
    }

    /* ---------- EXPOSE ---------- */

    return { init, destroy };
})();
