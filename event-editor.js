/*
 * js/event-editor.js
 * Manages event form population, dropdown fetching, card auto-calculation, and submission.
 */

document.addEventListener('DOMContentLoaded', function() {
  initializeEventEditor();
});

function initializeEventEditor() {
  if (typeof google === 'undefined' || !google.script || !google.script.run) {
    console.warn("Google Apps Script context unavailable.");
    return;
  }

  // 1. Fetch dropdown options for Locations and Themes concurrently
  google.script.run.withSuccessHandler(populateLocationDropdown).getLocations();
  google.script.run.withSuccessHandler(populateThemeDropdown).getThemes();

  // 2. Check if we are editing an existing event using Google's secure URL API
  if (google.script.url) {
    google.script.url.getLocation(function(location) {
      var eventId = location.parameter ? location.parameter.eventId : null;
      
      if (eventId) {
        document.getElementById('form-title').innerText = 'Edit Scheduled Event';
        document.getElementById('event-id-input').value = eventId;

        google.script.run
          .withSuccessHandler(populateEventForm)
          .withFailureHandler(function(err) {
            console.error("Failed to load event record:", err);
          })
          .getEventById(eventId);
      } else {
        // Set default date to today for new events
        var today = new Date().toISOString().split('T')[0];
        document.getElementById('event-date').value = today;
        document.getElementById('start-time').value = '19:00';
        calculateCardPrints();
      }
    });
  } else {
    // Fallback for local testing outside of Google Apps Script
    var urlParams = new URLSearchParams(window.location.search);
    var eventId = urlParams.get('eventId');

    if (eventId) {
      document.getElementById('form-title').innerText = 'Edit Scheduled Event';
      document.getElementById('event-id-input').value = eventId;
      
      google.script.run
        .withSuccessHandler(populateEventForm)
        .withFailureHandler(function(err) {
          console.error("Failed to load event record:", err);
        })
        .getEventById(eventId);
    } else {
      var today = new Date().toISOString().split('T')[0];
      document.getElementById('event-date').value = today;
      document.getElementById('start-time').value = '19:00';
      calculateCardPrints();
    }
  }
}

function populateLocationDropdown(locations) {
  var select = document.getElementById('location-id');
  if (!select) return;
  
  select.innerHTML = '<option value="">-- Select Event Venue --</option>';
  if (locations && locations.length > 0) {
    locations.forEach(function(loc) {
      var opt = document.createElement('option');
      opt.value = loc.locationId;
      opt.textContent = loc.businessName || loc.locationId;
      select.appendChild(opt);
    });
  }
}

function populateThemeDropdown(themes) {
  var select = document.getElementById('theme-id');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose a Playable Theme --</option>';
  if (themes && themes.length > 0) {
    themes.forEach(function(thm) {
      var opt = document.createElement('option');
      opt.value = thm.themeId;
      opt.textContent = thm.themeName + ' (' + (thm.trackCount || 0) + ' tracks)';
      select.appendChild(opt);
    });
  }
}

function populateEventForm(evt) {
  if (!evt) {
    alert("Requested event record could not be found.");
    return;
  }

  document.getElementById('location-id').value = evt.locationId || '';
  document.getElementById('theme-id').value = evt.themeId || '';
  
  if (evt.eventDate) {
    var formattedDate = new Date(evt.eventDate).toISOString().split('T')[0];
    document.getElementById('event-date').value = formattedDate;
  }
  
  document.getElementById('start-time').value = evt.startTime || '19:00';
  document.getElementById('requested-games').value = evt.requestedGames || 10;
  document.getElementById('expected-players').value = evt.expectedPlayers || 50;
  document.getElementById('staff-notes').value = evt.staffNotes || '';
  
  calculateCardPrints();
}

/**
 * Automatically calculates total bingo cards required (Games x Expected Players)
 */
function calculateCardPrints() {
  var games = parseInt(document.getElementById('requested-games').value, 10) || 0;
  var players = parseInt(document.getElementById('expected-players').value, 10) || 0;
  var totalPrints = games * players;
  
  var printsInput = document.getElementById('cards-to-print');
  if (printsInput) {
    printsInput.value = totalPrints;
  }
}

/**
 * Handles payload submission back to EventService.gs
 */
function handleEventSave(e) {
  if (e && e.preventDefault) e.preventDefault();

  var saveBtn = document.getElementById('save-event-btn');
  saveBtn.disabled = true;
  saveBtn.innerText = 'SAVING EVENT...';

  var locSelect = document.getElementById('location-id');
  var locationName = locSelect.options[locSelect.selectedIndex] ? locSelect.options[locSelect.selectedIndex].text : '';

  var payload = {
    eventId: document.getElementById('event-id-input').value || null,
    locationId: document.getElementById('location-id').value,
    locationName: locationName,
    themeId: document.getElementById('theme-id').value,
    eventDate: document.getElementById('event-date').value,
    startTime: document.getElementById('start-time').value,
    requestedGames: parseInt(document.getElementById('requested-games').value, 10) || 10,
    expectedPlayers: parseInt(document.getElementById('expected-players').value, 10) || 50,
    printCount: parseInt(document.getElementById('cards-to-print').value, 10) || 500,
    staffNotes: document.getElementById('staff-notes').value.trim()
  };

  google.script.run
    .withSuccessHandler(function() {
      navigateToDashboard();
    })
    .withFailureHandler(function(err) {
      alert("Error saving event: " + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.innerText = 'SAVE EVENT';
    })
    .saveNewEvent(payload);
}

function navigateToDashboard() {
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function(url) {
        window.top.location.href = url;
      })
      .getRouteUrl('index');
  } else {
    window.top.location.href = '?view=index';
  }
}
