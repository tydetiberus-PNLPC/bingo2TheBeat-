/* js/card.js */
var currentBookletId = null;
var activeGameNumber = null;
var currentCardSongs = [];
var activePatternName = "";
var globalCatalog = [];
var isPolling = false;

document.addEventListener('DOMContentLoaded', function() {
    // 1. Determine or auto-assign Booklet Pack ID
    initBookletId();
    
    // 2. Fetch catalog and start polling backend state
    google.script.run.withSuccessHandler(function(catalog) {
        globalCatalog = catalog || [];
        pollGameState();
        setInterval(pollGameState, 3000); // Check for DJ game advances every 3 seconds
    }).getPatternCatalog();
});

function initBookletId() {
    if (requestedCardId) {
        currentBookletId = String(requestedCardId).replace(/\D/g, '');
        localStorage.setItem('BTB_BOOKLET_ID_' + currentEventId, currentBookletId);
    } else {
        currentBookletId = localStorage.getItem('BTB_BOOKLET_ID_' + currentEventId);
        if (!currentBookletId) {
            // Assign a random sample booklet ID between 101 and 150
            currentBookletId = String(Math.floor(Math.random() * 50) + 101);
            localStorage.setItem('BTB_BOOKLET_ID_' + currentEventId, currentBookletId);
        }
    }
    document.getElementById('booklet-id-display').innerText = currentBookletId;
}

function pollGameState() {
    if (isPolling) return;
    isPolling = true;

    google.script.run.withSuccessHandler(function(state) {
        isPolling = false;
        if (!state) return;

        // --- NEW SECURITY CHECK ---
        if (state.accessType === 'PAID') {
            var isAuth = localStorage.getItem('BTB_AUTH_' + currentEventId);
            if (isAuth !== 'VERIFIED') {
                document.getElementById('pin-gate-overlay').style.display = 'flex';
                document.querySelector('.card-container').style.display = 'none'; // Hide the game behind the lock
                return; // Stop processing the rest of the game state until unlocked
            }
        }
        
        // If we get here, they are authorized! Hide the lock and show the game.
        var overlay = document.getElementById('pin-gate-overlay');
        var container = document.querySelector('.card-container');
        if (overlay) overlay.style.display = 'none';
        if (container) container.style.display = 'flex';
        // --- END SECURITY CHECK ---

        // Header updates
        if (state.themeName) document.getElementById('event-theme-display').innerText = state.themeName;

        // 🚀 AUTO-ADVANCING DETECTOR
        if (activeGameNumber !== state.currentGameNumber) {
            var isInitialLoad = (activeGameNumber === null);
            activeGameNumber = state.currentGameNumber;
            document.getElementById('game-num-display').innerText = activeGameNumber;

            if (!isInitialLoad) {
                showToast("Game #" + activeGameNumber + " Started! Card updated.");
            }

            // Fetch new grid for this game in the booklet pack
            loadBookletCardGrid();
        }

        // Update target pattern if changed mid-game
        if (activePatternName !== state.activePattern) {
            activePatternName = state.activePattern || "Standard Bingo (Any Line)";
            document.getElementById('pattern-title-display').innerText = activePatternName;
            renderMiniPattern(activePatternName);
        }

    }).withFailureHandler(function() { isPolling = false; }).getLiveGameState(currentEventId);
}

function loadBookletCardGrid() {
    google.script.run.withSuccessHandler(function(cardData) {
        if (!cardData || !cardData.songs) return;
        currentCardSongs = cardData.songs;
        renderGrid();
    }).getVirtualCardForBooklet(currentEventId, currentBookletId, activeGameNumber);
}

function renderGrid() {
    var gridContainer = document.getElementById('bingo-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    // Retrieve saved daubs for this specific game & booklet
    var storageKey = 'BTB_DAUBS_' + currentEventId + '_' + currentBookletId + '_G' + activeGameNumber;
    var daubedIndices = JSON.parse(localStorage.getItem(storageKey) || '[]');

    for (var i = 0; i < 25; i++) {
        var cell = document.createElement('div');
        cell.className = 'card-cell';
        cell.dataset.index = i;

        var songText = currentCardSongs[i] || "";

        if (i === 12 || songText.toUpperCase().includes('FREE')) {
            cell.className += ' free-space daubed';
            cell.innerText = 'FREE';
        } else {
            cell.innerText = songText;
            if (daubedIndices.includes(i)) {
                cell.className += ' daubed';
            }
            cell.onclick = function() { toggleDaub(this); };
        }

        gridContainer.appendChild(cell);
    }
}

function toggleDaub(cellElem) {
    var idx = parseInt(cellElem.dataset.index, 10);
    cellElem.classList.toggle('daubed');

    // Persist daubs to LocalStorage
    var storageKey = 'BTB_DAUBS_' + currentEventId + '_' + currentBookletId + '_G' + activeGameNumber;
    var daubedIndices = [];

    document.querySelectorAll('.card-cell.daubed').forEach(function(c) {
        var cIdx = parseInt(c.dataset.index, 10);
        if (cIdx !== 12) daubedIndices.push(cIdx);
    });

    localStorage.setItem(storageKey, JSON.stringify(daubedIndices));
}

function renderMiniPattern(patternName) {
    var miniBox = document.getElementById('mini-pattern-grid');
    if (!miniBox) return;
    miniBox.innerHTML = '';

    var pat = globalCatalog.find(p => p.name === patternName);
    var gridArray = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];

    if (pat && pat.previewGrid) {
        gridArray = pat.previewGrid;
    }

    for (var i = 0; i < 25; i++) {
        var cell = document.createElement('div');
        cell.className = 'mini-cell';
        if (i === 12 || gridArray[i] === 1 || gridArray[i] === "1" || gridArray[i] === true) {
            cell.className += ' active';
        }
        miniBox.appendChild(cell);
    }
}

function handleCallBingo() {
    var btn = document.getElementById('btn-call-bingo');
    btn.innerText = "SENDING CLAIM...";
    btn.disabled = true;

    google.script.run.withSuccessHandler(function(res) {
        btn.innerText = "🔔 CALL BINGO!";
        btn.disabled = false;
        alert("🎉 BINGO CLAIM SENT!\n\nYour claim has been flagged on the DJ Host Console for verification.");
    }).withFailureHandler(function(err) {
        btn.innerText = "🔔 CALL BINGO!";
        btn.disabled = false;
        alert("Error sending Bingo claim: " + err.message);
    }).submitVirtualBingoClaim(currentEventId, currentBookletId, activeGameNumber);
}

function showToast(message) {
    var toast = document.getElementById('game-toast');
    if (!toast) return;
    toast.innerText = message;
    toast.style.display = 'block';
    setTimeout(function() { toast.style.display = 'none'; }, 3500);
}

// ==========================================
// PIN GATEKEEPER LOGIC
// ==========================================
function submitPin() {
    var pinInput = document.getElementById('access-pin-input').value;
    var btn = document.getElementById('btn-submit-pin');
    var errorMsg = document.getElementById('pin-error-msg');
    
    if (!pinInput || pinInput.length < 4) {
        errorMsg.innerText = "Please enter a 4-digit PIN.";
        return;
    }

    btn.innerText = "VERIFYING...";
    btn.disabled = true;
    errorMsg.innerText = "";

    google.script.run
        .withSuccessHandler(function(res) {
            btn.innerText = "🔓 UNLOCK BOOKLET";
            btn.disabled = false;
            
            if (res.success) {
                // Save authorized status to phone
                localStorage.setItem('BTB_AUTH_' + currentEventId, 'VERIFIED');
                
                // Hide lock screen and load game data
                document.getElementById('pin-gate-overlay').style.display = 'none';
                document.querySelector('.card-container').style.display = 'flex';
                pollGameState(); 
            } else {
                errorMsg.innerText = res.message;
            }
        })
        .withFailureHandler(function(err) {
            btn.innerText = "🔓 UNLOCK BOOKLET";
            btn.disabled = false;
            errorMsg.innerText = "Network error. Try again.";
        })
        .verifyEventPin(currentEventId, pinInput);
}
