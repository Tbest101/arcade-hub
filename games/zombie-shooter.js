/* ================================================
   ZOMBIE ARSENAL — CINEMATIC EDITION
   ================================================
   2.5D perspective view, atmospheric VFX,
   glowing bullet trails, shockwave explosions.
   ================================================ */

const ZombieShooter = (() => {
    // Config
    const WEAPONS = [
        { id: 'pistol', name: 'PISTOL', cost: 0, damage: 1, rate: 120, spread: 6, count: 3, bulletColor: '#ff9500' },
        { id: 'dual', name: 'DUAL 9MM', cost: 15, damage: 1, rate: 80, spread: 10, count: 5, bulletColor: '#ffcc00' },
        { id: 'smg', name: 'TACTICAL SMG', cost: 45, damage: 1.2, rate: 40, spread: 15, count: 4, bulletColor: '#00ff88' },
        { id: 'shotgun', name: '12-GAUGE', cost: 120, damage: 1.5, rate: 180, spread: 45, count: 10, bulletColor: '#ff4444' },
        { id: 'ar', name: 'ASSAULT RIFLE', cost: 300, damage: 3, rate: 50, spread: 12, count: 6, bulletColor: '#00ccff' }
    ];

    // Perspective config
    const HORIZON_Y = 0.15;   // horizon at 15% from top
    const GROUND_START = 0.2; // ground plane starts at 20%

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
        bloodSplatters: [],
        embers: [],
        shockwaves: [],
        bulletTrails: []
    };

    let timers = {
        fire: 0,
        zombieSpawn: 0,
        arsenalSpawn: 0
    };

    let screenShake = 0;
    let recoilTimer = 0;
    let screenFlash = 0;
    let killCombo = 0;
    let comboTimer = 0;
    let totalKills = 0;

    /* ---------- PERSPECTIVE HELPERS ---------- */

    // Convert a "depth" (0 = horizon, 1 = foreground) to a Y position
    function depthToY(depth) {
        const horizonPx = canvas.height * HORIZON_Y;
        return horizonPx + depth * (canvas.height - horizonPx);
    }

    // Get scale factor based on Y position (smaller at top, larger at bottom)
    function getScale(y) {
        const horizonPx = canvas.height * HORIZON_Y;
        const maxDist = canvas.height - horizonPx;
        const dist = Math.max(0, y - horizonPx);
        return 0.3 + (dist / maxDist) * 0.7;
    }

    // Get X position adjusted for perspective convergence
    function perspectiveX(x, y) {
        const scale = getScale(y);
        const centerX = canvas.width / 2;
        return centerX + (x - centerX) * scale;
    }

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
        entities = {
            bullets: [], zombies: [], arsenalItems: [], multipliers: [],
            particles: [], bloodSplatters: [], embers: [], shockwaves: [], bulletTrails: []
        };
        timers = { fire: 0, zombieSpawn: 0, arsenalSpawn: 0 };
        screenShake = 0;
        recoilTimer = 0;
        screenFlash = 0;
        killCombo = 0;
        comboTimer = 0;
        totalKills = 0;
        // Seed ambient embers
        for (let i = 0; i < 40; i++) {
            spawnEmber(true);
        }
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
                <div id="zs-combo" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                    font-family:'Orbitron';font-size:0px;color:#facc15;pointer-events:none;
                    text-shadow:0 0 30px rgba(250,204,21,0.8);opacity:0;transition:all 0.1s;z-index:10;"></div>
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
        const dt = Math.min(now - lastTime, 50); // cap dt to prevent spiral
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
            recoilTimer = 120;
        }

        updateSpawning(dt);
        updateEntities(dt);
        checkCollisions();

        if (screenShake > 0) screenShake -= dt * 0.05;
        if (screenShake < 0) screenShake = 0;
        if (recoilTimer > 0) recoilTimer -= dt;
        if (recoilTimer < 0) recoilTimer = 0;
        if (screenFlash > 0) screenFlash -= dt * 0.008;
        if (screenFlash < 0) screenFlash = 0;

        // Combo timer
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                killCombo = 0;
                const el = document.getElementById('zs-combo');
                if (el) { el.style.opacity = '0'; el.style.fontSize = '0px'; }
            }
        }

        // Spawn ambient embers
        if (Math.random() < 0.15) spawnEmber(false);

        document.getElementById('zs-score-val').textContent = score;
        document.getElementById('zs-weapon-val').textContent = weapon.name;
        document.getElementById('zs-count-val').textContent = shooterCount;
    }

    function fire(weapon) {
        const spacing = 40;
        const startX = mouseX - ((shooterCount - 1) * spacing) / 2;
        const bulletColor = weapon.bulletColor;

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
                    damage: weapon.damage,
                    color: bulletColor,
                    trail: []
                });
            }
            // Muzzle flash
            createMuzzleFlash(x, canvas.height - 70, bulletColor);
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
                rotation: Math.PI,
                phase: Math.random() * Math.PI * 2,
                lurchSpeed: 0.002 + Math.random() * 0.003,
                swayAmp: 0.15 + Math.random() * 0.2
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
        // Bullets + trail
        entities.bullets = entities.bullets.filter(b => {
            // Store trail positions
            b.trail.push({ x: b.x, y: b.y, life: 150 });
            if (b.trail.length > 8) b.trail.shift();
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            return b.y > 0 && b.x > 0 && b.x < canvas.width;
        });

        // Update bullet trails
        entities.bulletTrails = entities.bulletTrails.filter(t => {
            t.life -= dt;
            return t.life > 0;
        });

        entities.zombies.forEach(z => {
            const lurchFactor = 1 + Math.sin(Date.now() * z.lurchSpeed + z.phase) * 0.5;
            z.y += z.speed * dt * lurchFactor;
            z.x += Math.sin(Date.now() * 0.001 + z.phase) * 0.15 * dt;
            z.rotation = Math.PI + Math.sin(Date.now() * 0.003 + z.phase) * z.swayAmp;
            if (z.y + z.size > canvas.height - 60) gameOver();
        });

        entities.arsenalItems.forEach(item => item.y += 0.03 * dt);
        entities.multipliers.forEach(m => m.y += 0.03 * dt);

        // Particles
        entities.particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.gravity) p.vy += 0.0003 * dt;
            p.life -= dt;
        });
        entities.particles = entities.particles.filter(p => p.life > 0);

        // Blood Splatters
        entities.bloodSplatters.forEach(s => s.life -= dt);
        entities.bloodSplatters = entities.bloodSplatters.filter(s => s.life > 0);

        // Embers
        entities.embers.forEach(e => {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.life -= dt;
            e.flicker = Math.sin(Date.now() * 0.01 + e.phase) * 0.5 + 0.5;
        });
        entities.embers = entities.embers.filter(e => e.life > 0);

        // Shockwaves
        entities.shockwaves.forEach(s => {
            s.radius += s.speed * dt;
            s.life -= dt;
        });
        entities.shockwaves = entities.shockwaves.filter(s => s.life > 0);
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
                        totalKills++;
                        killCombo++;
                        comboTimer = 2000;
                        createDeathExplosion(z.x + z.size/2, z.y + z.size/2);
                        screenShake = 8;
                        screenFlash = 0.3;
                        // Show combo
                        if (killCombo > 1) {
                            const el = document.getElementById('zs-combo');
                            if (el) {
                                el.textContent = `${killCombo}x COMBO!`;
                                el.style.opacity = '1';
                                el.style.fontSize = Math.min(20 + killCombo * 4, 60) + 'px';
                                setTimeout(() => { el.style.opacity = '0.5'; }, 200);
                            }
                        }
                    }
                }
            });

            entities.arsenalItems.forEach(item => {
                if (!b.used && Math.hypot(b.x - item.x, b.y - item.y) < 30) {
                    item.health -= b.damage;
                    b.used = true;
                    createSparks(b.x, b.y, '#facc15');
                    if (item.health <= 0) {
                        currentWeaponIdx++;
                        score += 200;
                        createDeathExplosion(item.x, item.y);
                        screenFlash = 0.5;
                    }
                }
            });

            entities.multipliers.forEach(m => {
                if (!b.used && Math.hypot(b.x - m.x, b.y - m.y) < 30) {
                    m.health -= b.damage;
                    b.used = true;
                    createSparks(b.x, b.y, '#ec4899');
                    if (m.health <= 0) {
                        if (m.type === 'add') shooterCount += m.val;
                        else shooterCount *= m.val;
                        shooterCount = Math.min(shooterCount, 12);
                        score += 100;
                        createDeathExplosion(m.x, m.y);
                        screenFlash = 0.4;
                    }
                }
            });
        });

        entities.zombies = entities.zombies.filter(z => z.health > 0);
        entities.arsenalItems = entities.arsenalItems.filter(item => item.health > 0);
        entities.multipliers = entities.multipliers.filter(m => m.health > 0);
    }

    /* ---------- VFX HELPERS ---------- */

    function spawnEmber(instant) {
        entities.embers.push({
            x: Math.random() * (canvas ? canvas.width : 800),
            y: instant ? Math.random() * (canvas ? canvas.height : 600) : (canvas ? canvas.height + 10 : 610),
            vx: (Math.random() - 0.5) * 0.02,
            vy: -0.015 - Math.random() * 0.03,
            size: Math.random() * 3 + 1,
            life: 3000 + Math.random() * 5000,
            phase: Math.random() * Math.PI * 2,
            flicker: 1,
            color: Math.random() > 0.5 ? '#ff6600' : '#ff3300'
        });
    }

    function createBlood(x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.3 + 0.05;
            entities.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.1,
                life: 400,
                color: Math.random() > 0.5 ? '#991b1b' : '#dc2626',
                size: Math.random() * 4 + 1,
                gravity: true
            });
        }
        // Persistent splatter
        for (let i = 0; i < 2; i++) {
            entities.bloodSplatters.push({
                x: x + (Math.random() - 0.5) * 30,
                y: y + (Math.random() - 0.5) * 30,
                size: Math.random() * 18 + 5,
                life: 6000,
                opacity: Math.random() * 0.5 + 0.15
            });
        }
    }

    function createMuzzleFlash(x, y, color) {
        // Bright core flash
        for (let i = 0; i < 6; i++) {
            entities.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -Math.random() * 0.6 - 0.2,
                life: 120,
                color: '#fff',
                size: Math.random() * 5 + 3
            });
        }
        // Colored sparks
        for (let i = 0; i < 8; i++) {
            const angle = -Math.PI/2 + (Math.random() - 0.5) * 1.2;
            const speed = Math.random() * 0.4 + 0.1;
            entities.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 200,
                color: color,
                size: Math.random() * 3 + 1,
                gravity: true
            });
        }
        // Smoke puffs
        for (let i = 0; i < 3; i++) {
            entities.particles.push({
                x: x + (Math.random() - 0.5) * 10, y,
                vx: (Math.random() - 0.5) * 0.05,
                vy: -0.03 - Math.random() * 0.03,
                life: 600,
                color: 'rgba(150,150,150,0.3)',
                size: Math.random() * 8 + 4,
                isSmoke: true
            });
        }
    }

    function createSparks(x, y, color) {
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.4 + 0.1;
            entities.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 300,
                color: color,
                size: Math.random() * 3 + 1,
                gravity: true
            });
        }
    }

    function createDeathExplosion(x, y) {
        // Shockwave ring
        entities.shockwaves.push({
            x, y,
            radius: 5,
            speed: 0.3,
            life: 400,
            maxLife: 400,
            color: '#34d399'
        });

        // Big particle burst
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.6 + 0.1;
            entities.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 800,
                color: ['#34d399', '#10b981', '#6ee7b7', '#fff'][Math.floor(Math.random() * 4)],
                size: Math.random() * 6 + 2,
                gravity: true
            });
        }

        // Fire burst
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.3;
            entities.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.1,
                life: 500,
                color: ['#ff6600', '#ff3300', '#facc15'][Math.floor(Math.random() * 3)],
                size: Math.random() * 8 + 3,
                isSmoke: true
            });
        }
    }

    /* ---------- DRAWING ---------- */

    function draw() {
        ctx.save();
        if (screenShake > 0) {
            ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        }

        drawBackground();
        drawBloodSplatters();
        drawZombies();
        drawArsenal();
        drawMultipliers();
        drawBullets();
        drawParticles();
        drawShockwaves();
        drawEmbers();
        drawShooters();
        drawAtmosphere();
        drawScreenFlash();
        drawGameOver();

        ctx.restore();
    }

    function drawBackground() {
        const w = canvas.width;
        const h = canvas.height;

        // Sky gradient — dark apocalyptic
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
        skyGrad.addColorStop(0, '#0a0a0f');
        skyGrad.addColorStop(0.3, '#0f0a1a');
        skyGrad.addColorStop(0.6, '#1a0a0a');
        skyGrad.addColorStop(1, '#1a1210');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Distant city silhouettes
        ctx.fillStyle = '#0d0d12';
        const horizonY = h * HORIZON_Y;
        const buildingBase = h * GROUND_START;
        for (let i = 0; i < 20; i++) {
            const bx = (i / 20) * w;
            const bw = w / 20 + Math.sin(i * 2.3) * 10;
            const bh = 15 + Math.abs(Math.sin(i * 1.7)) * 40;
            ctx.fillRect(bx, buildingBase - bh, bw, bh);
        }
        // Building window lights
        ctx.fillStyle = '#ff990015';
        for (let i = 0; i < 30; i++) {
            const wx = Math.random() * w;
            const wy = buildingBase - Math.random() * 40;
            ctx.fillRect(wx, wy, 2, 2);
        }

        // Ground plane with perspective
        const groundGrad = ctx.createLinearGradient(0, buildingBase, 0, h);
        groundGrad.addColorStop(0, '#1a1510');
        groundGrad.addColorStop(0.3, '#1f1815');
        groundGrad.addColorStop(1, '#25201a');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, buildingBase, w, h - buildingBase);

        // Perspective road lines (converging to vanishing point)
        const vanishX = w / 2;
        const vanishY = horizonY;
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let i = -6; i <= 6; i++) {
            const bottomX = vanishX + i * (w / 8);
            ctx.beginPath();
            ctx.moveTo(vanishX, vanishY);
            ctx.lineTo(bottomX, h);
            ctx.stroke();
        }

        // Horizontal depth lines
        for (let i = 0; i < 8; i++) {
            const t = i / 8;
            const y = buildingBase + t * t * (h - buildingBase);
            ctx.strokeStyle = `rgba(255,255,255,${0.015 + t * 0.02})`;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Split line (arsenal | combat)
        ctx.setLineDash([15, 15]);
        ctx.strokeStyle = 'rgba(255,100,100,0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w/2, horizonY);
        ctx.lineTo(w/2, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;

        // Fog layer near horizon
        const fogGrad = ctx.createLinearGradient(0, horizonY - 20, 0, buildingBase + 60);
        fogGrad.addColorStop(0, 'rgba(30,20,15,0.8)');
        fogGrad.addColorStop(1, 'rgba(30,20,15,0)');
        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, horizonY - 20, w, buildingBase - horizonY + 80);
    }

    function drawBloodSplatters() {
        entities.bloodSplatters.forEach(s => {
            ctx.globalAlpha = (s.life / 6000) * s.opacity;
            ctx.fillStyle = '#450a0a';
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, s.size, s.size * 0.6, 0.3, 0, Math.PI * 2);
            ctx.fill();
            // Darker center
            ctx.fillStyle = '#2d0606';
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, s.size * 0.4, s.size * 0.3, 0.3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawZombies() {
        // Sort by Y for depth (draw far ones first)
        const sorted = [...entities.zombies].sort((a, b) => a.y - b.y);
        sorted.forEach(z => {
            const scale = getScale(z.y);
            const drawSize = z.size * scale;

            ctx.save();
            ctx.translate(z.x + z.size/2, z.y + z.size/2);
            ctx.rotate(z.rotation);

            // Breathing pulse
            const pulse = 1 + Math.sin(Date.now() * 0.005 + z.phase) * 0.06;
            ctx.scale(pulse * scale, (1/pulse) * scale);

            // Shadow underneath
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(0, z.size/2 * 0.8, z.size * 0.4, z.size * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();

            // Damage glow
            const hurtRatio = z.health / z.maxHealth;
            if (hurtRatio < 0.5) {
                ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.02) * 0.4;
                // Red damage aura
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 15;
            }

            ctx.drawImage(assets.zombie, -z.size/2, -z.size/2, z.size, z.size);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            ctx.restore();

            // Health Bar with glow
            const barW = drawSize;
            const barX = z.x + (z.size - barW) / 2;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(barX, z.y - 12 * scale, barW, 5 * scale);
            const barColor = hurtRatio > 0.5 ? '#ef4444' : '#ff3333';
            ctx.fillStyle = barColor;
            ctx.fillRect(barX, z.y - 12 * scale, barW * hurtRatio, 5 * scale);
            // Glow on bar
            ctx.shadowColor = barColor;
            ctx.shadowBlur = 6;
            ctx.fillRect(barX, z.y - 12 * scale, barW * hurtRatio, 5 * scale);
            ctx.shadowBlur = 0;
        });
    }

    function drawArsenal() {
        entities.arsenalItems.forEach(item => {
            const scale = getScale(item.y);
            const drawSize = 50 * scale;

            // Glow effect
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 15;
            ctx.drawImage(assets.crate, item.x - drawSize/2, item.y - drawSize/2, drawSize, drawSize);
            ctx.shadowBlur = 0;

            // Health bar
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(item.x - drawSize/2, item.y - drawSize/2 - 10, drawSize, 4);
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 6;
            ctx.fillRect(item.x - drawSize/2, item.y - drawSize/2 - 10, drawSize * (item.health / item.maxHealth), 4);
            ctx.shadowBlur = 0;

            ctx.font = `bold ${Math.max(8, 10 * scale)}px "Orbitron"`;
            ctx.fillStyle = '#facc15';
            ctx.textAlign = 'center';
            ctx.fillText(item.name, item.x, item.y + drawSize/2 + 14);
        });
    }

    function drawMultipliers() {
        entities.multipliers.forEach(m => {
            const scale = getScale(m.y);
            const radius = 30 * scale;

            // Pulsing glow ring
            const pulseR = radius + Math.sin(Date.now() * 0.005) * 5;
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(m.x, m.y, pulseR, 0, Math.PI * 2);
            ctx.stroke();

            // Fill
            const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, radius);
            grad.addColorStop(0, 'rgba(236, 72, 153, 0.2)');
            grad.addColorStop(1, 'rgba(236, 72, 153, 0.02)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(m.x, m.y, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = `bold ${Math.max(14, 18 * scale)}px "Orbitron"`;
            ctx.fillStyle = '#ec4899';
            ctx.shadowColor = '#ec4899';
            ctx.shadowBlur = 15;
            ctx.textAlign = 'center';
            ctx.fillText((m.type === 'add' ? '+' : 'x') + m.val, m.x, m.y + 7 * scale);
            ctx.shadowBlur = 0;

            // Health Bar
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(m.x - 25 * scale, m.y - 45 * scale, 50 * scale, 4);
            ctx.fillStyle = '#ec4899';
            ctx.fillRect(m.x - 25 * scale, m.y - 45 * scale, 50 * scale * (m.health / m.maxHealth), 4);
        });
    }

    function drawBullets() {
        const weapon = WEAPONS[currentWeaponIdx];
        const color = weapon.bulletColor;

        entities.bullets.forEach(b => {
            // Draw trail
            if (b.trail.length > 1) {
                for (let i = 0; i < b.trail.length - 1; i++) {
                    const t = b.trail[i];
                    const alpha = (i / b.trail.length) * 0.4;
                    ctx.strokeStyle = color;
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(b.trail[i].x, b.trail[i].y);
                    ctx.lineTo(b.trail[i + 1] ? b.trail[i + 1].x : b.x, b.trail[i + 1] ? b.trail[i + 1].y : b.y);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }

            // Bullet glow
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#fff';
            ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
            // Colored core
            ctx.fillStyle = color;
            ctx.fillRect(b.x - 1, b.y - 3, 2, 6);
            ctx.shadowBlur = 0;
        });
    }

    function drawParticles() {
        entities.particles.forEach(p => {
            const lifeRatio = p.life / (p.isSmoke ? 600 : 400);
            ctx.globalAlpha = Math.min(lifeRatio, 1);

            if (p.isSmoke) {
                // Smoke puffs — expand as they fade
                const smokeSize = p.size * (2 - lifeRatio);
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, smokeSize);
                grad.addColorStop(0, 'rgba(120,110,100,0.15)');
                grad.addColorStop(1, 'rgba(80,70,60,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, smokeSize, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });
        ctx.globalAlpha = 1;
    }

    function drawShockwaves() {
        entities.shockwaves.forEach(s => {
            const lifeRatio = s.life / s.maxLife;
            ctx.globalAlpha = lifeRatio * 0.6;
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 3 * lifeRatio;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.stroke();
            // Inner ring
            ctx.globalAlpha = lifeRatio * 0.3;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius * 0.6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    function drawEmbers() {
        entities.embers.forEach(e => {
            const lifeRatio = Math.min(e.life / 1000, 1);
            ctx.globalAlpha = lifeRatio * e.flicker * 0.7;
            ctx.fillStyle = e.color;
            ctx.shadowColor = e.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.size * lifeRatio, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    function drawShooters() {
        const spacing = 40;
        const startX = mouseX - ((shooterCount - 1) * spacing) / 2;
        const now = Date.now();
        for (let i = 0; i < shooterCount; i++) {
            const x = startX + i * spacing;
            const phase = i * 0.7;
            ctx.save();

            // Breathing bob
            const breathY = Math.sin(now * 0.003 + phase) * 3;
            // Idle sway
            const swayAngle = Math.sin(now * 0.002 + phase) * 0.06;
            // Recoil
            const recoilY = recoilTimer > 0 ? -recoilTimer * 0.04 : 0;
            const recoilScale = recoilTimer > 0 ? 1 + recoilTimer * 0.001 : 1;

            ctx.translate(x, canvas.height - 40 + breathY + recoilY);
            ctx.rotate(swayAngle);
            ctx.scale(recoilScale, recoilScale);

            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 22, 18, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Muzzle glow when firing
            if (recoilTimer > 50) {
                ctx.shadowColor = WEAPONS[currentWeaponIdx].bulletColor;
                ctx.shadowBlur = 25;
            }

            ctx.drawImage(assets.survivor, -20, -20, 40, 40);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    function drawAtmosphere() {
        const w = canvas.width;
        const h = canvas.height;

        // Vignette overlay
        const vignetteGrad = ctx.createRadialGradient(w/2, h/2, w * 0.25, w/2, h/2, w * 0.75);
        vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, w, h);

        // Top atmospheric gradient
        const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.08);
        topGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, w, h * 0.08);

        // Score glow (subtle light source at top center)
        ctx.globalAlpha = 0.05;
        const scoreGlow = ctx.createRadialGradient(w/2, 0, 0, w/2, 0, w * 0.4);
        scoreGlow.addColorStop(0, '#ff6600');
        scoreGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = scoreGlow;
        ctx.fillRect(0, 0, w, h * 0.3);
        ctx.globalAlpha = 1;
    }

    function drawScreenFlash() {
        if (screenFlash > 0) {
            ctx.globalAlpha = screenFlash;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
        }
    }

    function drawGameOver() {
        if (gameState !== 'gameover') return;

        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Red glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
        glow.addColorStop(0, 'rgba(239,68,68,0.15)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 30;
        ctx.font = 'bold 48px "Orbitron"';
        ctx.fillText('OVERRUN', cx, cy - 40);
        ctx.shadowBlur = 0;

        // Stats
        ctx.font = '14px "Orbitron"';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(`RESOURCES SECURED: ${score}`, cx, cy + 20);
        ctx.fillText(`HOSTILES ELIMINATED: ${totalKills}`, cx, cy + 45);

        // Restart prompt
        ctx.font = '13px "Orbitron"';
        ctx.fillStyle = '#fff';
        const pulse = 0.5 + Math.sin(Date.now() * 0.003) * 0.5;
        ctx.globalAlpha = pulse;
        ctx.fillText('CLICK TO DEPLOY AGAIN', cx, cy + 100);
        ctx.globalAlpha = 1;
    }

    function gameOver() {
        gameState = 'gameover';
        screenFlash = 1;
        screenShake = 20;
        canvas.onclick = () => {
            resetState();
            canvas.onclick = null;
        };
    }

    /* ---------- EXPOSE ---------- */

    return { init, destroy };
})();
