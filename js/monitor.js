/* js/monitor.js */

let eventId = null;
let currentTrackId = null; // Used to prevent reloading the same media

window.onload = function() {
    google.script.url.getLocation(function(location) {
        eventId = location.parameter.eventId;
        if (eventId) {
            // Start polling the server every 2 seconds
            setInterval(pollLiveState, 2000);
        } else {
            document.getElementById('standby-msg').innerText = "ERROR: EVENT ID MISSING";
        }
    });
};

function pollLiveState() {
    google.script.run
        .withSuccessHandler(updateMonitorUI)
        .getLiveState(eventId);
}

function updateMonitorUI(state) {
    if (!state) return; // No state broadcasted yet
    
    // Update Theme Title
    if (state.themeName) {
        document.getElementById('theme-title').innerText = state.themeName.toUpperCase();
    }

    // Handle Tie-Breaker Mode
    if (state.mode === 'TIE_BREAKER') {
        document.getElementById('tie-breaker-ui').style.display = 'flex';
        document.getElementById('tie-eliminated').innerText = state.eliminatedArtist ? `ELIMINATED: ${state.eliminatedArtist}` : "DRAWING NEXT ARTIST...";
        return;
    } else {
        document.getElementById('tie-breaker-ui').style.display = 'none';
    }

    // Handle Playback Status
    const mediaContainer = document.getElementById('media-container');
    
    if (state.status === 'PLAYING' && state.track) {
        // Only update the DOM if it's a new track (prevents video from restarting every 2 seconds)
        if (currentTrackId !== state.track.providerTrackId) {
            currentTrackId = state.track.providerTrackId;
            
            // If we have a video URL, we embed YouTube. Otherwise, fallback to thumbnail.
            if (state.track.videoUrl) {
                // Convert watch URL to embed URL and add autoplay
                const embedUrl = `https://www.youtube.com/embed/${state.track.providerTrackId}?autoplay=1&controls=0&disablekb=1&modestbranding=1`;
                mediaContainer.innerHTML = `<iframe src="${embedUrl}" allow="autoplay; encrypted-media" frameborder="0"></iframe>`;
            } else if (state.track.thumbnailUrl) {
                mediaContainer.innerHTML = `<img src="${state.track.thumbnailUrl}" alt="Album Art">`;
            } else {
                mediaContainer.innerHTML = `<div class="standby-text">🎵 NOW PLAYING 🎵</div>`;
            }
        }
    } else if (state.status === 'PAUSED' || state.status === 'BINGO') {
        currentTrackId = null; // Reset
        let msg = state.status === 'BINGO' ? "BINGO CALLED! VERIFYING..." : "PAUSED";
        mediaContainer.innerHTML = `<div class="standby-text" style="color: var(--btn-gold);">${msg}</div>`;
    }
}
