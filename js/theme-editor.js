/* js/theme-editor.js */

var currentThemeId = null;

// Wait for the page to load, then check if we are editing an existing theme
document.addEventListener('DOMContentLoaded', function() {
    if (typeof google !== 'undefined' && google.script && google.script.url) {
        google.script.url.getLocation(function(location) {
            var paramThemeId = location.parameter ? location.parameter.themeId : null;
            if (paramThemeId) {
                currentThemeId = paramThemeId;
                
                var titleEl = document.getElementById('editorTitle');
                var idInput = document.getElementById('themeId');
                var delBtn = document.getElementById('btn-delete-theme');
                
                if (titleEl) titleEl.innerText = 'Modify Themed Playlist';
                if (idInput) idInput.value = paramThemeId;
                if (delBtn) delBtn.style.display = 'inline-block'; // Show delete button

                // Fetch existing record data from the database
                google.script.run
                    .withSuccessHandler(populateFormForEdit)
                    .getThemeById(paramThemeId);
            }
        });
    }
});

// Populates the form inputs with the data fetched from the database
function populateFormForEdit(theme) {
    if (!theme) return;
    
    var nameEl = document.getElementById('themeName');
    var descEl = document.getElementById('themeDesc');
    var mediaEl = document.getElementById('mediaType');
    var urlEl = document.getElementById('playlistUrl');
    var trkCountEl = document.getElementById('validatedTrackCount');
    var plIdEl = document.getElementById('validatedPlaylistId');
    
    if (nameEl) nameEl.value = theme.themeName || '';
    if (descEl) descEl.value = theme.shortDescription || '';
    if (mediaEl) mediaEl.value = theme.mediaType || 'Audio';
    if (urlEl) urlEl.value = theme.playlistUrl || (theme.playlistId ? 'https://www.youtube.com/playlist?list=' + theme.playlistId : '');
    if (trkCountEl) trkCountEl.value = theme.trackCount || 0;
    if (plIdEl) plIdEl.value = theme.playlistId || '';
    
    var resultBox = document.getElementById('validationResult');
    if (resultBox) {
        resultBox.innerHTML = '<span style="color:var(--accent); font-weight:bold;">✅ Currently linked to active playlist (' + (theme.trackCount || 0) + ' tracks). Rescan only if URL changed.</span>';
    }
}

// Scans the YouTube playlist URL provided in the editor
function testScanPlaylist() {
    var urlInputEl = document.getElementById('playlistUrl');
    var urlInput = urlInputEl ? urlInputEl.value : '';
    
    var resultBox = document.getElementById('validationResult');
    var validateBtn = document.getElementById('validateBtn');
    var saveBtn = document.getElementById('saveBtn');

    if (!urlInput) {
        if (resultBox) resultBox.innerHTML = '<span style="color:var(--danger); font-weight:bold;">⚠️ Please paste a YouTube playlist link first.</span>';
        return;
    }

    if (validateBtn) { validateBtn.disabled = true; validateBtn.innerText = 'Scanning...'; }
    if (resultBox) resultBox.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Connecting to YouTube Database...</span>';
    if (saveBtn) saveBtn.disabled = true;

    google.script.run
        .withSuccessHandler(function(response) {
            if (validateBtn) { validateBtn.disabled = false; validateBtn.innerText = 'SCAN TRACKS'; }
            
            if (response && response.success) {
                if (resultBox) resultBox.innerHTML = '<span style="color:var(--accent); font-weight:bold;">✅ Playlist scanned successfully! Found ' + response.trackCount + ' tracks.</span>';
                
                var countEl = document.getElementById('validatedTrackCount');
                var plIdEl = document.getElementById('validatedPlaylistId');
                if (countEl) countEl.value = response.trackCount;
                if (plIdEl) plIdEl.value = response.playlistId;
                
                if (saveBtn) saveBtn.disabled = false;
            } else {
                if (resultBox) resultBox.innerHTML = '<span style="color:var(--danger); font-weight:bold;">⚠️ Could not process playlist.</span>';
            }
        })
        .withFailureHandler(function(err) {
            if (validateBtn) { validateBtn.disabled = false; validateBtn.innerText = 'SCAN TRACKS'; }
            if (resultBox) resultBox.innerHTML = '<span style="color:var(--danger); font-weight:bold;">⚠️ Error: ' + err.message + '</span>';
        })
        .scanYouTubePlaylist(urlInput.trim());
}

// Submits the modified theme back to the database
function handleFormSubmit(e) {
    if (e) e.preventDefault();
    
    var saveBtn = document.getElementById('saveBtn');
    
    var idEl = document.getElementById('themeId');
    var nameEl = document.getElementById('themeName');
    var descEl = document.getElementById('themeDesc');
    var mediaEl = document.getElementById('mediaType');
    var urlEl = document.getElementById('playlistUrl');
    var plIdEl = document.getElementById('validatedPlaylistId');
    var countEl = document.getElementById('validatedTrackCount');

    var payload = {
        themeId: idEl ? idEl.value : '',
        themeName: nameEl ? nameEl.value : '',
        shortDescription: descEl ? descEl.value : '',
        mediaType: mediaEl ? mediaEl.value : 'Audio',
        playlistUrl: urlEl ? urlEl.value : '',
        playlistId: plIdEl ? plIdEl.value : '',
        trackCount: countEl ? (parseInt(countEl.value) || 0) : 0
    };

    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = 'SAVING...'; }

    google.script.run
        .withSuccessHandler(function() {
            var baseUrl = (typeof APP_BASE_URL !== 'undefined') ? APP_BASE_URL : '';
            window.open(baseUrl + "?view=index", "_top");
        })
        .withFailureHandler(function(err) {
            alert("Error saving theme: " + err.message);
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = 'SAVE CHANGES'; }
        })
        .saveNewTheme(payload);
}

// Deletes the theme and cascades to delete all associated tracks
function confirmDeleteTheme() {
    if (!currentThemeId) return;
    
    if (confirm("🚨 ARE YOU SURE YOU WANT TO DELETE THIS THEME?\n\nThis will permanently remove the theme and ALL its associated tracks from the database.")) {
        var btn = document.getElementById('btn-delete-theme');
        if (btn) { btn.innerText = "DELETING..."; btn.disabled = true; }

        google.script.run
            .withSuccessHandler(function() {
                var baseUrl = (typeof APP_BASE_URL !== 'undefined') ? APP_BASE_URL : '';
                window.open(baseUrl + "?view=index", "_top");
            })
            .withFailureHandler(function(err) {
                alert("Error deleting theme: " + err.message);
                if (btn) { btn.innerText = "🗑️ DELETE THEME"; btn.disabled = false; }
            })
            .deleteThemeById(currentThemeId);
    }
}
