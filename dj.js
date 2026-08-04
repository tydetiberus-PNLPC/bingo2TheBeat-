/* js/dj.js */
var timerInterval = null; 
var secondsRemaining = 30; 
var currentTimerLabel = "CLIP"; 
var currentMediaType = "audio"; 
var ytPlayer = null; 
var isPlayerReady = false; 
var currentActiveTrackId = null; 
var isSkipping = false; 
var globalPatternCatalog = []; 
var patternAnimationInterval = null;
var currentVariationIndex = 0;
var currentRenderedPatternName = "";

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('hidden-audio-player-element', { 
        height: '1', 
        width: '1', 
        videoId: 'fJ9rUzIMcZQ', 
        playerVars: { 'autoplay': 0, 'controls': 0, 'playsinline': 1, 'enablejsapi': 1 }, 
        events: { 
            'onReady': function() { isPlayerReady = true; }, 
            'onError': function(e) { handleUnplayableTrack(); } 
        } 
    });
}

document.addEventListener('DOMContentLoaded', function() {
    var monitorBtn = document.getElementById('monitor-link');
    if (monitorBtn) monitorBtn.href = APP_BASE_URL + "?view=monitor&eventId=" + encodeURIComponent(currentEventId);
    
    google.script.run.withSuccessHandler(function(catalog) { 
        globalPatternCatalog = catalog; 
        loadState(); 
        setInterval(loadState, 3000); 
    }).getPatternCatalog();

    google.script.run.withSuccessHandler(function(isTestMode) {
        if (isTestMode) {
            var clipToggle = document.getElementById('clip-toggle');
            var pauseToggle = document.getElementById('pause-toggle');
            if (clipToggle && pauseToggle) {
                clipToggle.insertAdjacentHTML('afterbegin', '<option value="5" style="color:var(--danger); font-weight:bold;">5s (FAST TEST)</option>');
                pauseToggle.insertAdjacentHTML('afterbegin', '<option value="1" style="color:var(--danger); font-weight:bold;">1s (FAST TEST)</option>');
                clipToggle.value = "5";
                pauseToggle.value = "1";
                let tDisp = document.getElementById('timer-display');
                if(tDisp) tDisp.innerText = "00:05";
                let pDisp = document.getElementById('pause-timer-display');
                if(pDisp) pDisp.innerText = "00:01";
                updateTiming(); 
            }
        }
    }).getTestMode();
});

function loadState() { 
    google.script.run.withSuccessHandler(renderState).getLiveGameState(currentEventId); 
}

function renderState(state) {
    if (!state) return; 
    currentMediaType = state.mediaType || "audio";
    
    // UPDATE: Colors tweaked for dark mode visibility
    var headerElem = document.getElementById('now-playing-header');
    if (headerElem) { 
        if (state.status === 'PLAYING') { headerElem.innerText = "Now Playing"; headerElem.style.color = "var(--accent)"; } 
        else if (state.status === 'PAUSED') { headerElem.innerText = "Paused"; headerElem.style.color = "var(--warning)"; } 
        else { headerElem.innerText = "Up Next (Ready)"; headerElem.style.color = "var(--primary)"; } 
    }

    var secWidget = document.getElementById('security-widget');
    if (secWidget) {
        if (state.accessType === 'PAID') {
            secWidget.style.display = 'block';
        } else {
            secWidget.style.display = 'none';
        }
    }
    
    var isReadyToStart = (state.status === 'READY_TO_START');
    let btnStart = document.getElementById('btn-start-game');
    if(btnStart) btnStart.style.display = isReadyToStart ? 'flex' : 'none';
    
    let btnPlay = document.getElementById('btn-play');
    if(btnPlay) btnPlay.style.display = isReadyToStart ? 'none' : 'flex';
    
    let btnPause = document.getElementById('btn-pause');
    if(btnPause) btnPause.style.display = isReadyToStart ? 'none' : 'flex';
    
    let btnRestart = document.getElementById('btn-restart');
    if(btnRestart) btnRestart.style.display = isReadyToStart ? 'none' : 'flex';

    if (currentMediaType === "video") { 
        if(document.getElementById('video-player-wrapper')) document.getElementById('video-player-wrapper').style.display = 'block'; 
        if(document.getElementById('audio-player-wrapper')) document.getElementById('audio-player-wrapper').style.display = 'none'; 
    } else { 
        if(document.getElementById('video-player-wrapper')) document.getElementById('video-player-wrapper').style.display = 'none'; 
        if(document.getElementById('audio-player-wrapper')) document.getElementById('audio-player-wrapper').style.display = 'block'; 
    }
    
    let titleElem = document.getElementById('event-theme-title');
    if (state.themeName && titleElem) titleElem.innerText = "THEME: " + state.themeName;
    
    let locElem = document.getElementById('event-location-name');
    if (locElem) locElem.innerText = "Live Session Active";
    
    if (!timerInterval) {
        let cMins = Math.floor((state.clipDuration || 30) / 60);
        let cSecs = (state.clipDuration || 30) % 60;
        let tDisp = document.getElementById('timer-display');
        if(tDisp) tDisp.innerText = (cMins < 10 ? "0" : "") + cMins + ":" + (cSecs < 10 ? "0" : "") + cSecs;

        let pMins = Math.floor((state.pauseDuration || 30) / 60);
        let pSecs = (state.pauseDuration || 30) % 60;
        let pDisp = document.getElementById('pause-timer-display');
        if(pDisp) pDisp.innerText = (pMins < 10 ? "0" : "") + pMins + ":" + (pSecs < 10 ? "0" : "") + pSecs;
        
        var clipT = document.getElementById('clip-toggle');
        var pauseT = document.getElementById('pause-toggle');
        if (clipT && state.clipDuration) clipT.value = state.clipDuration;
        if (pauseT && state.pauseDuration) pauseT.value = state.pauseDuration;
    }

    let activePat = state.activePattern || "Standard Bingo (Any Line)";
    let currentPatTitle = document.getElementById('current-pattern-title');
    if(currentPatTitle) currentPatTitle.innerText = activePat;
    renderAnimatedPattern(activePat);

    let nextPatText = document.getElementById('header-next-pattern');
    if (state.patternSchedule && state.patternSchedule.length > 0 && nextPatText) {
        let nextIndex = state.status === 'READY_TO_START' ? (state.currentGameNumber - 1) : state.currentGameNumber;
        if (nextIndex < state.patternSchedule.length) {
            nextPatText.innerText = state.patternSchedule[nextIndex].name;
        } else {
            nextPatText.innerText = "None (End)";
        }
    }

    if (state.currentTrack) {
        currentActiveTrackId = state.currentTrack.trackId; 
        
        let trkTitle = document.getElementById('track-title');
        if(trkTitle) trkTitle.innerText = state.currentTrack.title || "Press Play to Begin"; 
        
        let trkArt = document.getElementById('track-artist');
        if(trkArt) trkArt.innerText = state.currentTrack.artist || "--";
        
        var coverImg = document.getElementById('album-cover-img');
        if(coverImg) {
            if (state.currentTrack.albumArtUrl && state.currentTrack.albumArtUrl.indexOf('http') === 0) coverImg.src = state.currentTrack.albumArtUrl; 
            else if (state.currentTrack.youtubeId) coverImg.src = "https://img.youtube.com/vi/" + state.currentTrack.youtubeId + "/hqdefault.jpg"; 
            else coverImg.src = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400";
        }
    }

    var maxG = state.effectiveGames || 10; var currG = state.currentGameNumber || 1;
    let sgCount = document.getElementById('stat-current-game');
    if(sgCount) sgCount.innerText = currG; 
    
    let mgCount = document.getElementById('stat-max-games');
    if(mgCount) mgCount.innerText = maxG; 
    
    let gCount = document.getElementById('game-song-count');
    if(gCount) gCount.innerText = (state.gamePlayedTrackIds || []).length; 
    
    let tCount = document.getElementById('total-song-count');
    if(tCount) tCount.innerText = state.totalTracksPlayedCount || 0;

    var uncalledBadge = document.getElementById('uncalled-badge');
    if (uncalledBadge) {
        var count = state.uncalledBingoCount || 0;
        var winnersList = state.uncalledWinningCardIds || [];
        if (count > 0) { 
            uncalledBadge.innerText = "🚨 BINGO CALLED: " + count + " (IDs: " + winnersList.join(', ') + ")"; 
            uncalledBadge.classList.add('flash-alert');
            uncalledBadge.style.background = ""; // let css handle it
        } 
        else { 
            uncalledBadge.style.background = "var(--danger)"; 
            uncalledBadge.innerText = "Uncalled: 0"; 
            uncalledBadge.classList.remove('flash-alert');
        }
    }

    var playedList = document.getElementById('played-songs-list');
    if (playedList) {
        playedList.innerHTML = '';
        if (!state.playedSongTitles || state.playedSongTitles.length === 0) {
            playedList.innerHTML = '<li style="justify-content: center; font-style: italic; color: var(--text-muted); border: none;">No songs played yet.</li>';
        } else {
            let reversedSongs = [...state.playedSongTitles].reverse();
            let totalPlayed = state.playedSongTitles.length;
            
            reversedSongs.forEach(function(title, idx) {
                let li = document.createElement('li');
                let trackNum = totalPlayed - idx;
                // UPDATE: Dark mode list colors
                li.innerHTML = '<span style="color:var(--primary); font-weight:900; width: 25px;">' + trackNum + '.</span> <span style="flex:1;">' + title + '</span>';
                playedList.appendChild(li);
            });
        }
    }
}

function toggleHideSongs(isHidden) {
    var ul = document.getElementById('played-songs-list');
    if (ul) {
        ul.style.filter = isHidden ? "blur(6px)" : "none";
        ul.style.opacity = isHidden ? "0.4" : "1";
    }
}

function renderAnimatedPattern(patternName) {
    if (currentRenderedPatternName === patternName) return; 
    currentRenderedPatternName = patternName;
    clearInterval(patternAnimationInterval);
    
    var box = document.getElementById('animated-pattern-grid');
    if (!box) return;

    var pat = globalPatternCatalog.find(p => p.name === patternName);
    var variations = [];
    
    try {
        if (pat && pat.rawJson) { 
            variations = JSON.parse(pat.rawJson); 
            if (!Array.isArray(variations[0])) variations = [variations]; 
        } else if (pat && pat.previewGrid) { 
            variations = [pat.previewGrid]; 
        } else {
            variations = [[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]];
        }
    } catch(e) { 
        variations = [[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]]; 
    }

    currentVariationIndex = 0;

    function drawFrame() {
        var gridArray = variations[currentVariationIndex];
        box.innerHTML = '';
        for (var i = 0; i < 25; i++) {
            var cell = document.createElement('div');
            cell.className = 'pattern-cell';
            if (i === 12) { 
                cell.style.background = 'var(--bg-card)'; 
                cell.style.color = 'var(--text-main)'; 
                cell.style.fontSize = '0.7rem'; 
                cell.style.display = 'flex'; 
                cell.style.alignItems = 'center'; 
                cell.style.justifyContent = 'center'; 
                cell.innerText = 'FREE'; 
            } 
            else if (gridArray[i] === 1 || gridArray[i] === "1" || gridArray[i] === true) { 
                cell.className += ' active'; 
            }
            box.appendChild(cell);
        }
        currentVariationIndex = (currentVariationIndex + 1) % variations.length;
    }

    drawFrame();
    if (variations.length > 1) { patternAnimationInterval = setInterval(drawFrame, 1200); }
}

function overrideDifficulty(value) {
    let nextPatText = document.getElementById('header-next-pattern');
    if(nextPatText) nextPatText.innerText = "Updating...";
    google.script.run.withSuccessHandler(renderState).overrideGamePattern(currentEventId, 'Difficulty', value);
}

function setNextPattern(patternName) {
    let nextPatText = document.getElementById('header-next-pattern');
    if(nextPatText) nextPatText.innerText = "Updating...";
    closePatternDictionary();
    google.script.run.withSuccessHandler(renderState).overrideGamePattern(currentEventId, 'Specific', patternName);
}

function startGame() {
    google.script.run.withSuccessHandler(renderState).triggerStartGame(currentEventId);
}

function openPatternDictionary() {
    var box = document.getElementById('dictionary-container'); 
    if(!box) return;
    
    box.innerHTML = ''; var categories = ['Easy', 'Medium', 'Hard', 'Expert'];
    categories.forEach(function(cat) {
        var categoryPatterns = globalPatternCatalog.filter(p => p.difficulty === cat);
        if (categoryPatterns.length === 0) return;
        var catHeader = document.createElement('h3'); 
        catHeader.innerText = cat + " Patterns"; 
        catHeader.style.borderBottom = "1px solid var(--border-color)"; 
        catHeader.style.color = "var(--primary)"; 
        catHeader.style.paddingBottom = "10px";
        catHeader.style.marginTop = "20px";
        box.appendChild(catHeader);
        
        var gridContainer = document.createElement('div'); gridContainer.style.display = 'flex'; gridContainer.style.flexWrap = 'wrap'; gridContainer.style.gap = '15px'; gridContainer.style.marginBottom = '25px'; gridContainer.style.marginTop = '15px';
        categoryPatterns.forEach(function(pat) {
            var patCard = document.createElement('div'); patCard.style.textAlign = 'center'; patCard.style.background = 'var(--bg-input)'; patCard.style.padding = '10px'; patCard.style.borderRadius = 'var(--radius-sm)'; patCard.style.border = '1px solid var(--border-color)'; patCard.style.width = '120px';
            var title = document.createElement('div'); title.innerText = pat.name; title.style.fontWeight = 'bold'; title.style.fontSize = '0.75rem'; title.style.marginBottom = '10px'; title.style.height = '30px'; title.style.display = 'flex'; title.style.alignItems = 'center'; title.style.justifyContent = 'center';
            var smallGrid = document.createElement('div'); smallGrid.className = 'pattern-grid'; smallGrid.style.width = '70px'; smallGrid.style.height = '70px'; smallGrid.style.margin = '0 auto'; smallGrid.style.gap = '1px';
            var gridArray = (pat.previewGrid && pat.previewGrid.length >= 25) ? pat.previewGrid : [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
            for (var i = 0; i < 25; i++) { var cell = document.createElement('div'); cell.className = 'pattern-cell'; if (i === 12) { cell.style.background = 'var(--bg-card)'; } else if (gridArray[i] === 1) { cell.className += ' active'; } smallGrid.appendChild(cell); }
            
            var btn = document.createElement('button'); btn.className = 'btn btn-secondary'; btn.innerText = 'SET NEXT'; btn.style.marginTop = '12px'; btn.style.fontSize = '0.7rem'; btn.style.padding = '4px 8px'; btn.style.width = '100%'; btn.onclick = function() { setNextPattern(pat.name); };
            
            patCard.appendChild(title); patCard.appendChild(smallGrid); patCard.appendChild(btn); gridContainer.appendChild(patCard);
        }); box.appendChild(gridContainer);
    }); 
    
    let modal = document.getElementById('dictionary-modal');
    if(modal) modal.style.display = 'flex';
}

function closePatternDictionary() { 
    let modal = document.getElementById('dictionary-modal');
    if(modal) modal.style.display = 'none'; 
}

function advanceNextGameFromModal() { 
    let modal = document.getElementById('bingo-modal');
    if(modal) modal.style.display = 'none'; 
    advanceNextGame(); 
}

function advanceNextGame() {
    if (confirm("Clear the board and start the NEXT GAME? (This will reset the uncalled bingos and song count).")) {
        pauseTrack(); 
        let tTitle = document.getElementById('track-title');
        if(tTitle) tTitle.innerText = "LOADING NEXT GAME...";
        
        google.script.run.withSuccessHandler(function(state) {
            alert("✅ Game Advanced! The board is clear and a new playlist queue is ready."); renderState(state);
        }).advanceToNextGame(currentEventId, "System");
    }
}

function playTrack() {
    google.script.run.withSuccessHandler(function(state) {
        renderState(state);
        if (state.currentTrack && state.currentTrack.youtubeId) {
            if (isPlayerReady && ytPlayer && ytPlayer.loadVideoById) { 
                ytPlayer.loadVideoById(state.currentTrack.youtubeId); 
                if (ytPlayer.unMute) ytPlayer.unMute(); 
                if (ytPlayer.setVolume) ytPlayer.setVolume(100); 
                ytPlayer.playVideo(); 
            }
            
            let statusText = document.getElementById('audio-status-text');
            if (currentMediaType === "audio" && statusText) {
                statusText.innerText = "▶ NOW STREAMING AUDIO...";
                statusText.style.color = "var(--accent)";
            }
        }
        
        let cToggle = document.getElementById('clip-toggle');
        var duration = cToggle ? (parseInt(cToggle.value) || 30) : 30; 
        startCountdown(duration, "CLIP");
    }).triggerPlayTrack(currentEventId);
}

function handleUnplayableTrack() {
    if (isSkipping) return; 
    isSkipping = true; 
    
    let statusText = document.getElementById('audio-status-text');
    if(statusText) {
        statusText.innerText = "⚠️ UNPLAYABLE TRACK - SKIPPING IN 1s..."; 
        statusText.style.color = "var(--danger)";
    }
    
    clearInterval(timerInterval);
    setTimeout(function() {
        google.script.run.withSuccessHandler(function(state) {
            isSkipping = false; renderState(state);
            if (state.currentTrack && state.currentTrack.youtubeId) { 
                if (isPlayerReady && ytPlayer && ytPlayer.loadVideoById) { 
                    ytPlayer.loadVideoById(state.currentTrack.youtubeId); 
                    if (ytPlayer.unMute) ytPlayer.unMute(); 
                    if (ytPlayer.setVolume) ytPlayer.setVolume(100); 
                    ytPlayer.playVideo(); 
                } 
            }
            
            let cToggle = document.getElementById('clip-toggle');
            var duration = cToggle ? (parseInt(cToggle.value) || 30) : 30; 
            startCountdown(duration, "CLIP");
        }).skipUnplayableTrack(currentEventId, currentActiveTrackId);
    }, 1000); 
}

function pauseTrack() { 
    clearInterval(timerInterval); 
    if (isPlayerReady && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); 
    
    let statusText = document.getElementById('audio-status-text');
    if(statusText) {
        statusText.innerText = "⏸ PAUSED"; 
        statusText.style.color = "var(--warning)";
    }
    
    google.script.run.withSuccessHandler(renderState).triggerPauseTrack(currentEventId); 
}

function restartTrack() { 
    if (isPlayerReady && ytPlayer && ytPlayer.seekTo) { ytPlayer.seekTo(0); ytPlayer.playVideo(); } 
    
    let cToggle = document.getElementById('clip-toggle');
    let duration = cToggle ? (parseInt(cToggle.value) || 30) : 30; 
    startCountdown(duration, "CLIP"); 
}

function startCountdown(seconds, label) {
    clearInterval(timerInterval); 
    secondsRemaining = seconds; 
    currentTimerLabel = label; 
    updateTimerDisplay();

    timerInterval = setInterval(function() {
        secondsRemaining--; 
        updateTimerDisplay();

        if (secondsRemaining <= 0) {
            clearInterval(timerInterval); 
            
            let pToggle = document.getElementById('pause-toggle');
            var pauseSec = pToggle ? (parseInt(pToggle.value) || 30) : 30;
            
            if (currentTimerLabel === "CLIP") { 
                if (isPlayerReady && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); 
                
                let statusText = document.getElementById('audio-status-text');
                if(statusText) {
                    statusText.innerText = "☕ INTERMISSION"; 
                    statusText.style.color = "var(--warning)";
                }
                
                google.script.run.withSuccessHandler(function(state) {
                    if (state && state.playlistTracks && isPlayerReady && ytPlayer && ytPlayer.cueVideoById) {
                        let played = state.gamePlayedTrackIds || [];
                        let nextTrack = state.playlistTracks.find(t => !played.includes(t.trackId));
                        if (nextTrack && nextTrack.youtubeId) {
                            ytPlayer.cueVideoById(nextTrack.youtubeId);
                        }
                    }
                }).getLiveGameState(currentEventId);

                startCountdown(pauseSec, "INTERMISSION"); 
            } 
            else if (currentTimerLabel === "INTERMISSION") { 
                let statusText = document.getElementById('audio-status-text');
                if(statusText) {
                    statusText.innerText = "⌛ LOADING NEXT TRACK..."; 
                    statusText.style.color = "var(--primary)";
                }
                playTrack(); 
            }
        }
    }, 1000);
}

function updateTimerDisplay() { 
    var mins = Math.floor(secondsRemaining / 60); var secs = secondsRemaining % 60; 
    var formatted = (mins < 10 ? "0" : "") + mins + ":" + (secs < 10 ? "0" : "") + secs;
    
    let tDisp = document.getElementById('timer-display');
    let pDisp = document.getElementById('pause-timer-display');
    let cBox = document.getElementById('clip-timer-box');
    let pBox = document.getElementById('pause-timer-box');

    if (currentTimerLabel === "INTERMISSION") {
        if(pDisp) pDisp.innerText = formatted;
        if(tDisp) tDisp.innerText = "00:00";
        if(pBox) pBox.classList.add('active');
        if(cBox) cBox.classList.remove('active');
    } else {
        if(tDisp) tDisp.innerText = formatted;
        if(pDisp) pDisp.innerText = "00:00";
        if(cBox) cBox.classList.add('active');
        if(pBox) pBox.classList.remove('active');
    }
}

function updateTiming() { 
    let clipElem = document.getElementById('clip-toggle');
    let pauseElem = document.getElementById('pause-toggle');
    var clip = clipElem ? clipElem.value : 30; 
    var pause = pauseElem ? pauseElem.value : 30; 
    
    google.script.run.withSuccessHandler(function(res) { 
        let maxGamesElem = document.getElementById('stat-max-games');
        if(maxGamesElem) maxGamesElem.innerText = res.effectiveGames; 
        loadState(); 
    }).updateTimingSettings(currentEventId, clip, pause); 
}

function handleUncalledToggle(isEnabled) { 
    let badge = document.getElementById('uncalled-badge');
    if(badge) {
        badge.style.display = isEnabled ? 'inline-block' : 'none'; 
        if(!isEnabled) badge.classList.remove('flash-alert');
    }
    google.script.run.toggleUncalledBingoSetting(currentEventId, isEnabled); 
}

function openBingoModal() { 
    pauseTrack(); 
    let modal = document.getElementById('bingo-modal');
    if(modal) modal.style.display = 'flex'; 
}

function runInstantVerification() {
    let inputElem = document.getElementById('verify-card-id');
    if(!inputElem) return;
    
    var cardId = String(inputElem.value).replace(/\D/g, '').trim(); 
    var resBox = document.getElementById('instant-verify-result');
    
    if(resBox) resBox.innerHTML = "Verifying...";
    
    google.script.run.withSuccessHandler(function(res) { 
        if(resBox) {
            resBox.innerHTML = res.valid 
                ? "<span style='color:var(--accent);'>✅ VALID BINGO!</span>" 
                : "<span style='color:var(--danger);'>❌ INVALID BINGO! Unplayed: " + res.unplayedRequiredSongs.join(', ') + "</span>"; 
        }
    }).verifyBingoCard(currentEventId, cardId);
}

function confirmBingo(isValid) { 
    let modal = document.getElementById('bingo-modal');
    if(modal) modal.style.display = 'none'; 
    if (!isValid) playTrack(); 
}

// 🔍 LOOKUP PIN FOR SPECIFIC BOOKLET
function lookupBookletPin() {
    var bookletId = document.getElementById('lookup-booklet-id').value;
    if (!bookletId) return;
    
    document.getElementById('dj-pin-display').innerText = "....";
    
    google.script.run.withSuccessHandler(function(pin) {
        document.getElementById('dj-pin-display').innerText = pin || "N/A";
    }).getPinForBooklet(currentEventId, bookletId);
}
