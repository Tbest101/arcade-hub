/* ================================================
   FLASH MEMORY — Number Recall Game
   ================================================
   A number flashes on a "paper" briefly.
   Player must type it back from memory.
   Correct digits → green, wrong → red.
   Beat all levels to complete the game.
   ================================================ */

const FlashMemory = (() => {
    // Config
    const START_DIGITS = 3;
    const MAX_DIGITS = 8;
    const BASE_FLASH_MS = 1200;       // flash time for level 1
    const FLASH_DECAY = 100;          // ms less per level
    const MIN_FLASH_MS = 400;
    const MAX_LIVES = 3;

    // State
    let container = null;
    let level = 1;
    let lives = MAX_LIVES;
    let score = 0;
    let currentNumber = '';
    let isFlashing = false;
    let flashTimeout = null;

    // DOM refs inside game
    let els = {};

    // High Score Logic
    const DB_KEY = 'arcade_flash_memory_scores';

    function getHighScores() {
        const scores = localStorage.getItem(DB_KEY);
        return scores ? JSON.parse(scores) : [];
    }

    function saveHighScore(name, score) {
        let scores = getHighScores();
        scores.push({ name, score, date: new Date().toISOString() });
        scores.sort((a, b) => b.score - a.score);
        scores = scores.slice(0, 5); // Keep top 5
        localStorage.setItem(DB_KEY, JSON.stringify(scores));
    }

    /* ---------- LIFECYCLE ---------- */

    function init(parentContainer) {
        container = parentContainer;
        level = 1;
        lives = MAX_LIVES;
        score = 0;
        render();
        startRound();
    }

    function destroy() {
        clearTimeout(flashTimeout);
        container.innerHTML = '';
        container = null;
        els = {};
    }

    /* ---------- RENDER ---------- */

    function render() {
        container.innerHTML = `
            <div class="fm-wrapper">
                <div class="fm-level-badge" id="fm-level">Level ${level}</div>

                <div class="fm-paper" id="fm-paper">
                    <div class="fm-number-display" id="fm-number"></div>
                </div>

                <p class="fm-instruction" id="fm-instruction">Watch carefully...</p>

                <div class="fm-input-area" id="fm-input-area" style="display:none;">
                    <input
                        type="text"
                        class="fm-input"
                        id="fm-input"
                        inputmode="numeric"
                        autocomplete="off"
                        placeholder="???"
                        maxlength="${getDigitCount()}"
                    />
                    <button class="fm-submit-btn" id="fm-submit">SUBMIT</button>
                </div>

                <div class="fm-result" id="fm-result"></div>
                <div class="fm-status" id="fm-status"></div>

                <div class="fm-stats" id="fm-stats">
                    Score: <span id="fm-score">${score}</span>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    Lives: <span id="fm-lives">${'❤️'.repeat(lives)}</span>
                </div>
            </div>
        `;

        // Cache refs
        els.level = document.getElementById('fm-level');
        els.paper = document.getElementById('fm-paper');
        els.number = document.getElementById('fm-number');
        els.instruction = document.getElementById('fm-instruction');
        els.inputArea = document.getElementById('fm-input-area');
        els.input = document.getElementById('fm-input');
        els.submit = document.getElementById('fm-submit');
        els.result = document.getElementById('fm-result');
        els.status = document.getElementById('fm-status');
        els.score = document.getElementById('fm-score');
        els.lives = document.getElementById('fm-lives');

        // Events
        els.submit.addEventListener('click', handleSubmit);
        els.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSubmit();
        });
        // Only allow digits
        els.input.addEventListener('input', () => {
            els.input.value = els.input.value.replace(/\D/g, '');
        });
    }

    /* ---------- GAME LOGIC ---------- */

    function getDigitCount() {
        return Math.min(START_DIGITS + level - 1, MAX_DIGITS);
    }

    function getFlashDuration() {
        return Math.max(BASE_FLASH_MS - (level - 1) * FLASH_DECAY, MIN_FLASH_MS);
    }

    function generateNumber() {
        const digits = getDigitCount();
        let num = '';
        for (let i = 0; i < digits; i++) {
            num += (i === 0) ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 10);
        }
        return num;
    }

    function startRound() {
        currentNumber = generateNumber();
        isFlashing = true;

        // Reset UI for new round
        els.result.innerHTML = '';
        els.status.textContent = '';
        els.status.className = 'fm-status';
        els.inputArea.style.display = 'none';
        els.instruction.textContent = 'Watch carefully...';
        els.level.textContent = `Level ${level}`;
        els.input.maxLength = getDigitCount();

        // Brief delay before flash
        flashTimeout = setTimeout(() => {
            showNumber();
        }, 600);
    }

    function showNumber() {
        els.number.textContent = currentNumber;
        els.number.classList.add('visible');
        els.paper.classList.add('flash-active');

        flashTimeout = setTimeout(() => {
            hideNumber();
        }, getFlashDuration());
    }

    function hideNumber() {
        els.number.classList.remove('visible');
        els.paper.classList.remove('flash-active');
        isFlashing = false;

        // Show input
        els.instruction.textContent = 'What was the number?';
        els.inputArea.style.display = 'flex';
        els.input.value = '';
        els.input.focus();
    }

    function handleSubmit() {
        const guess = els.input.value.trim();
        if (!guess || isFlashing) return;

        els.inputArea.style.display = 'none';

        // Compare digit by digit
        const correct = currentNumber.split('');
        const guessed = guess.split('');
        let allCorrect = true;

        els.result.innerHTML = '';

        // Pad guess if shorter
        const maxLen = Math.max(correct.length, guessed.length);

        for (let i = 0; i < maxLen; i++) {
            const span = document.createElement('span');
            span.className = 'fm-result-digit';
            span.style.animationDelay = `${i * 0.07}s`;

            if (i < guessed.length && i < correct.length && guessed[i] === correct[i]) {
                span.classList.add('correct');
                span.textContent = guessed[i];
            } else {
                span.classList.add('wrong');
                span.textContent = i < guessed.length ? guessed[i] : '_';
                allCorrect = false;
            }

            els.result.appendChild(span);
        }

        if (allCorrect) {
            onCorrect();
        } else {
            onWrong();
        }
    }

    function onCorrect() {
        score += level * 10;
        els.score.textContent = score;
        els.status.textContent = '✓ CORRECT!';
        els.status.className = 'fm-status success';
        els.instruction.textContent = '';

        if (level >= MAX_DIGITS - START_DIGITS + 1) {
            // Game complete!
            flashTimeout = setTimeout(() => showComplete(), 1200);
        } else {
            level++;
            flashTimeout = setTimeout(() => startRound(), 1500);
        }
    }

    function showComplete() {
        const scores = getHighScores();
        const isHighScore = scores.length < 5 || score > (scores[scores.length - 1]?.score || 0);

        container.innerHTML = `
            <div class="fm-complete">
                <div class="fm-complete-emoji">🏆</div>
                <div class="fm-complete-title">GAME COMPLETE!</div>
                <p class="fm-complete-sub">Score: ${score}</p>
                
                ${isHighScore ? `
                    <div class="fm-name-prompt">
                        <p>NEW HIGH SCORE!</p>
                        <input type="text" id="fm-player-name" placeholder="Enter Name" maxlength="15">
                        <button class="fm-action-btn" id="fm-save-score">SAVE SCORE</button>
                    </div>
                ` : ''}

                <div class="fm-leaderboard" id="fm-leaderboard">
                    ${renderLeaderboard()}
                </div>

                <div class="fm-final-actions">
                    <button class="fm-action-btn" id="fm-replay">↻ PLAY AGAIN</button>
                    <button class="fm-action-btn" id="fm-hub-btn">🏠 BACK TO HUB</button>
                </div>
            </div>
        `;

        if (isHighScore) {
            document.getElementById('fm-save-score').addEventListener('click', () => {
                const name = document.getElementById('fm-player-name').value.trim() || 'Anonymous';
                saveHighScore(name, score);
                document.querySelector('.fm-name-prompt').style.display = 'none';
                document.getElementById('fm-leaderboard').innerHTML = renderLeaderboard();
            });
        }

        document.getElementById('fm-replay').addEventListener('click', () => {
            level = 1;
            lives = MAX_LIVES;
            score = 0;
            render();
            startRound();
        });
        document.getElementById('fm-hub-btn').addEventListener('click', () => {
            Hub.goToHub();
        });
    }

    function onWrong() {
        lives--;
        els.lives.textContent = '❤️'.repeat(Math.max(lives, 0));
        els.status.className = 'fm-status fail';

        if (lives <= 0) {
            els.status.textContent = `GAME OVER — The number was ${currentNumber}`;
            els.instruction.textContent = '';
            
            // Wait a bit then show scores
            flashTimeout = setTimeout(() => showComplete(), 1500);
        } else {
            els.status.textContent = `✗ WRONG — The number was ${currentNumber}`;
            els.instruction.textContent = '';
            flashTimeout = setTimeout(() => startRound(), 1800);
        }
    }

    function renderLeaderboard() {
        const scores = getHighScores();
        if (scores.length === 0) return '';
        
        return `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>RANK</th>
                        <th>NAME</th>
                        <th>SCORE</th>
                    </tr>
                </thead>
                <tbody>
                    ${scores.map((s, i) => `
                        <tr>
                            <td>#${i + 1}</td>
                            <td>${s.name}</td>
                            <td>${s.score}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /* ---------- EXPOSE ---------- */

    return { init, destroy };
})();
