/* js/dashboard.js */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadDashboardData);
} else {
  loadDashboardData();
}

function loadDashboardData() {
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run.withSuccessHandler(renderLocationsTable).withFailureHandler(function(err) {
        displayTableError('location-list-body', 'Failed to retrieve active venues.');
    }).getLocations();

    google.script.run.withSuccessHandler(renderThemesTable).withFailureHandler(function(err) {
        displayTableError('theme-list-body', 'Failed to retrieve active playlists.');
    }).getThemes();

    google.script.run.withSuccessHandler(renderEventsTable).withFailureHandler(function(err) {
        displayTableError('event-list-body', 'Failed to retrieve scheduled events.');
    }).getEvents();
  }
}

function renderLocationsTable(locations) {
  var tbody = document.getElementById('location-list-body');
  if (!tbody) return;
  tbody.innerHTML = ''; 

  if (!locations || locations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#94a3b8;">No venues found. Open the Admin panel to create one!</td></tr>';
    return;
  }

  var baseUrl = (typeof APP_BASE_URL !== 'undefined') ? APP_BASE_URL : '';

  locations.forEach(function(loc) {
    var row = document.createElement('tr');
    var id = loc.locationId || loc.id || '';
    var editUrl = baseUrl + '?view=location-editor&locationId=' + encodeURIComponent(id);

    var mapUrl = loc.googleMapsUrl || '';
    var mapBtn = mapUrl 
      ? '<a href="' + escapeHtml(mapUrl) + '" target="_blank" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">🗺️ Map</a>' 
      : '<span style="color:#64748b; font-size:0.8rem; font-style:italic;">No Map Link</span>';

    row.innerHTML = 
      '<td style="font-weight: 600;"><a href="' + editUrl + '" target="_top">' + escapeHtml(loc.businessName || loc.locationName || 'Unknown Venue') + '</a></td>' +
      '<td>' + escapeHtml(loc.city || 'N/A') + '</td>' +
      '<td style="text-align: right; padding-right: 24px;">' + mapBtn + '</td>';
      
    tbody.appendChild(row);
  });
}

function renderThemesTable(themes) {
  var tbody = document.getElementById('theme-list-body');
  if (!tbody) return;
  tbody.innerHTML = ''; 

  if (!themes || themes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">No playlists found. Open the Admin panel to create one!</td></tr>';
    return;
  }

  var baseUrl = (typeof APP_BASE_URL !== 'undefined') ? APP_BASE_URL : '';

  themes.forEach(function(theme) {
    var row = document.createElement('tr');
    var id = theme.themeId || theme.id || theme.ThemeID || theme.ID || '';
    var editUrl = baseUrl + '?view=theme-editor&themeId=' + encodeURIComponent(id);

    row.innerHTML = 
      '<td style="font-weight: 600; white-space: nowrap;"><a href="' + editUrl + '" target="_top">' + escapeHtml(theme.themeName || theme.name) + '</a></td>' +
      '<td style="color: #94a3b8; font-size: 0.85rem;" title="' + escapeHtml(theme.shortDescription || '') + '">' + escapeHtml(theme.shortDescription || '') + '</td>' +
      '<td style="text-align: center; font-weight: 700;">' + (theme.trackCount || theme.tracks || 0) + '</td>' +
      '<td style="text-align: center;"><span class="badge badge-media">' + escapeHtml(theme.mediaType || 'Audio') + '</span></td>';
      
    tbody.appendChild(row);
  });
}

function renderEventsTable(events) {
  var tbody = document.getElementById('event-list-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!events || events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">No upcoming games scheduled. Open Admin panel to build a schedule!</td></tr>';
    return;
  }

  var baseUrl = (typeof APP_BASE_URL !== 'undefined') ? APP_BASE_URL : '';

  events.forEach(function(evt) {
    var row = document.createElement('tr');
    
    var editUrl = baseUrl + '?view=event-editor&eventId=' + encodeURIComponent(evt.eventId);
    var djUrl   = baseUrl + '?view=dj&eventId=' + encodeURIComponent(evt.eventId);

    var dateTimeDisplay = (evt.eventDate || '') + (evt.startTime ? (' @ ' + evt.startTime) : '');
    if (!dateTimeDisplay.trim()) dateTimeDisplay = 'Unscheduled';

    var isAlreadyPrinted = evt.isPrinted || evt.printed || evt.status === 'PRINTED' || evt.cardsPrinted;
    var printStatusBadge = isAlreadyPrinted
      ? '<span class="badge badge-printed">PDF Printed</span>'
      : '<span class="badge badge-ready">PDF Ready</span>';

    // Parse virtual and printed counts (fallbacks to defaults if missing)
    var vCount = evt.virtualCount || evt.digitalCount || 10;
    var pCount = evt.printedCount || evt.printCount || 0;

    row.innerHTML = 
      '<td style="font-weight: 600;"><a href="' + editUrl + '" target="_top">' + escapeHtml(dateTimeDisplay) + '</a></td>' +
      '<td>' + escapeHtml(evt.locationName || evt.locationId) + '</td>' +
      '<td>' + escapeHtml(evt.themeName || evt.themeId) + '</td>' +
      '<td style="text-align: center;">' + (evt.requestedGames || 10) + '</td>' +
      '<td style="text-align: center;">' + (evt.expectedPlayers || 0) + '</td>' +
      '<td style="text-align: center;">' +
        '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">' +
          '<div style="font-size: 0.8rem; color: #94a3b8;"><strong>' + vCount + '</strong> Digital | <strong>' + pCount + '</strong> PDF</div>' +
          '<div style="display: flex; gap: 8px; align-items: center;">' +
            printStatusBadge +
            '<button type="button" id="print-btn-' + escapeHtml(evt.eventId) + '" onclick="printEventCards(\'' + escapeHtml(evt.eventId) + '\')" class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.65rem;">PRINT PDF</button>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td style="text-align: right; padding-right: 24px;">' +
        '<a href="' + djUrl + '" target="_top" class="btn btn-neon" style="padding: 8px 16px;">🎧 LAUNCH DJ</a>' +
      '</td>';

    tbody.appendChild(row);
  });
}

function printEventCards(eventId) {
  var btn = document.getElementById('print-btn-' + eventId);
  if (btn) {
    btn.innerText = 'GENERATING...';
    btn.disabled = true;
  }

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.success === false) {
           alert("Error generating cards: " + (result.error || "Unknown Error"));
           if (btn) { btn.innerText = 'PRINT PDF'; btn.disabled = false; }
           return;
        }

        var baseUrl = (typeof APP_BASE_URL !== 'undefined') ? APP_BASE_URL : '';
        var printUrl = baseUrl + '?view=print-preview&eventId=' + encodeURIComponent(eventId);
        window.open(printUrl, '_blank');
        
        loadDashboardData(); 
      })
      .withFailureHandler(function(err) {
        alert("Failed to generate and print cards: " + (err.message || err));
        if (btn) { btn.innerText = 'PRINT PDF'; btn.disabled = false; }
      })
      .generateAndPrintCardsForEvent(eventId, null); 
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayTableError(elementId, message) {
  var tbody = document.getElementById(elementId);
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#ef4444;">⚠️ ' + escapeHtml(message) + '</td></tr>';
  }
}
