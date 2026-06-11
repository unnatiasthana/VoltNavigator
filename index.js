// Simple JavaScript for Class 12th Student

// Variable to store API key
var apiKey = '489ed144-5fbf-4b7e-b90b-1bc508d66b86';

// Global array to store current stations
var allStations = [];

// Map globals
var map = null;
var markerClusterGroup = null;
var stationMarkers = {};
var activeRouteLine = null;
var userLocationMarker = null;
var currentUserLocation = null;

// Custom SVG Icons for Standard and Fast EV chargers
var standardIcon = L.divIcon({
    html: `
    <div class="custom-marker standard-marker">
        <svg viewBox="0 0 24 30" width="30" height="38" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#00b359" stroke="#ffffff" stroke-width="1.5" />
            <circle cx="12" cy="9" r="4.5" fill="#ffffff" />
            <path d="M12 6.5v5M10.5 8.5h3" stroke="#00b359" stroke-width="1.5" fill="none" stroke-linecap="round" />
        </svg>
    </div>`,
    className: 'custom-leaflet-marker',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -35]
});

var fastIcon = L.divIcon({
    html: `
    <div class="custom-marker fast-marker">
        <svg viewBox="0 0 24 30" width="30" height="38" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#00e673" stroke="#ffffff" stroke-width="1.5" />
            <circle cx="12" cy="9" r="4.5" fill="#ffffff" />
            <polygon points="12,5.5 9.5,9.5 11.5,9.5 11,13 14,8.5 12,8.5" fill="#f59e0b" />
        </svg>
    </div>`,
    className: 'custom-leaflet-marker',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -35]
});

// Toast notification function
function showToast(message) {
    var toast = document.getElementById("notification-toast");
    if (toast) {
        toast.innerText = message;
        toast.classList.add("show");
        setTimeout(function() {
            toast.classList.remove("show");
        }, 3000);
    } else {
        alert(message);
    }
}

// Show and Hide Map/Placeholder helpers
function showMap() {
    var mapDiv = document.getElementById("map");
    var placeholder = document.getElementById("map-placeholder");
    if (mapDiv) {
        mapDiv.style.visibility = "visible";
        mapDiv.hidden = false;
        if (map) {
            setTimeout(function() {
                map.invalidateSize();
            }, 100);
        }
    }
    if (placeholder) {
        placeholder.classList.add("hidden");
    }
}

function showPlaceholder() {
    var mapDiv = document.getElementById("map");
    var placeholder = document.getElementById("map-placeholder");
    if (mapDiv) {
        mapDiv.hidden = true;
        mapDiv.style.visibility = "hidden";
    }
    if (placeholder) {
        placeholder.classList.remove("hidden");
    }
}

// Map initialization helper
function initMap(centerLat, centerLon) {
    showMap();

    if (map == null) {
        map = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        markerClusterGroup = L.markerClusterGroup();
        map.addLayer(markerClusterGroup);
    }
    map.setView([centerLat, centerLon], 12);
    setTimeout(function() {
        if (map) map.invalidateSize();
    }, 100);
}

// Get HTML elements
var cityInput = document.getElementById("city-search-input");
var searchBtn = document.getElementById("search-button");
var stationGrid = document.getElementById("station-results");
var loadingMsg = document.getElementById("loading-cards");
var errorMsg = document.getElementById("error-message");
var noResultsMsg = document.getElementById("no-results-message");

// Function to save successful searches to history
function saveSearchHistory(city) {
    if (!city) return;
    var historyString = localStorage.getItem("volt_search_history");
    var historyArray = [];
    if (historyString != null) {
        try {
            historyArray = JSON.parse(historyString);
        } catch (e) {
            historyArray = [];
        }
    }
    // Remove duplicate if it already exists (case insensitive)
    historyArray = historyArray.filter(function(item) {
        return item.city.toLowerCase() !== city.toLowerCase();
    });
    // Add to front of array
    historyArray.unshift({
        city: city,
        timestamp: Date.now()
    });
    // Limit to 10 items
    if (historyArray.length > 10) {
        historyArray.pop();
    }
    localStorage.setItem("volt_search_history", JSON.stringify(historyArray));
}

// Main function to search for stations
async function searchCity() {
    var city = cityInput ? cityInput.value.trim() : "";
    
    // Check if empty
    if (city == "") {
        alert("Please enter a city name!");
        return;
    }

    // Show loading message, hide welcome card and previous results
    loadingMsg.hidden = false;
    stationGrid.innerHTML = "";
    errorMsg.hidden = true;
    noResultsMsg.hidden = true;
    
    var welcomeCard = document.getElementById("welcome-card");
    if (welcomeCard) welcomeCard.hidden = true;

    // Clear user location marker and active driving route line
    if (activeRouteLine != null && map != null) {
        map.removeLayer(activeRouteLine);
        activeRouteLine = null;
    }
    if (userLocationMarker != null && map != null) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    var directionsCard = document.getElementById("directions-card");
    if (directionsCard) directionsCard.hidden = true;
    currentUserLocation = null;

    try {
        // Step 1: Use basic Geocoding API to get Latitude and Longitude
        var geoUrl = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(city) + "&format=json&limit=1";
        var geoResponse = await fetch(geoUrl);
        var geoData = await geoResponse.json();

        // If city is not found
        if (geoData.length == 0) {
            loadingMsg.hidden = true;
            noResultsMsg.hidden = false;
            showPlaceholder();
            return;
        }

        var lat = geoData[0].lat;
        var lon = geoData[0].lon;

        // Step 2: Use OpenChargeMap API to find stations near coordinates
        var chargeUrl = "https://api.openchargemap.io/v3/poi/?key=" + apiKey + "&latitude=" + lat + "&longitude=" + lon + "&distance=25&distanceunit=km&maxresults=30&compact=true";
        var chargeResponse = await fetch(chargeUrl);
        var chargeData = await chargeResponse.json();

        // If no stations found
        if (chargeData.length == 0) {
            loadingMsg.hidden = true;
            noResultsMsg.hidden = false;
            showPlaceholder();
            return;
        }

        // Save data to our global array
        allStations = chargeData;
        
        // Save search to history
        saveSearchHistory(city);

        // Initialize Map
        initMap(lat, lon);
        
        // Populate dynamic connector dropdown based on search results
        populateConnectorDropdown(allStations);
        
        // Reset slider and filters to defaults
        resetFilterStates();
        
        // Show filter and summary sections
        document.getElementById("filter-sort-row").hidden = false;
        document.getElementById("results-summary").hidden = false;
        document.getElementById("summary-city-name").innerText = city;
        
        // Update Stats Summary Card
        updateStatsSummary();

        // Execute unified filter & sort pipeline (initial draw)
        applyFiltersAndSort();

        // Hide loading
        loadingMsg.hidden = true;

    } catch (error) {
        console.log("Error:", error);
        loadingMsg.hidden = true;
        errorMsg.hidden = false;
    }
}

// Function to draw stations in HTML
function displayStations(stationsArray) {
    stationGrid.innerHTML = ""; // clear old content

    // Basic For Loop
    for (var i = 0; i < stationsArray.length; i++) {
        var station = stationsArray[i];
        
        // Get title safely
        var title = "Unnamed Station";
        if (station.AddressInfo != null && station.AddressInfo.Title != null) {
            title = station.AddressInfo.Title;
        }

        // Get address safely
        var address = "No Address";
        if (station.AddressInfo != null && station.AddressInfo.AddressLine1 != null) {
            address = station.AddressInfo.AddressLine1;
        }

        // Check if Fast Charger checking Connections array
        var isFast = false;
        if (station.Connections != null) {
            for (var j = 0; j < station.Connections.length; j++) {
                if (station.Connections[j].PowerKW >= 20) {
                    isFast = true;
                }
            }
        }
        
        // Build simple HTML using string addition
        var html = "";
        html += "<div class='charging-station-card'>";
        html += "  <div class='station-name'>" + title + "</div>";
        html += "  <div class='station-address'>" + address + "</div>";
        
        if (isFast == true) {
            html += "  <span class='badge badge-fast'>Fast Charger ⚡</span>";
        } else {
            html += "  <span class='badge'>Standard Charger 🔌</span>";
        }

        // Surface Connection details
        if (station.Connections != null && station.Connections.length > 0) {
            html += "  <div class='station-connectors' style='font-size: 13px; margin: 12px 0; line-height: 1.4; opacity: 0.95;'>";
            html += "    <strong>Connectors:</strong>";
            html += "    <ul style='margin: 4px 0 0 16px; padding: 0;'>";
            for (var c = 0; c < station.Connections.length; c++) {
                var conn = station.Connections[c];
                var typeTitle = conn.ConnectionType ? conn.ConnectionType.Title : "Unknown Type";
                var power = conn.PowerKW ? conn.PowerKW + " kW" : "Unknown Power";
                var qty = conn.Quantity ? " (x" + conn.Quantity + ")" : "";
                html += "      <li style='margin-bottom: 2px;'>" + typeTitle + " - " + power + qty + "</li>";
            }
            html += "    </ul>";
            html += "  </div>";
        }

        var lat = 0;
        var lon = 0;
        if (station.AddressInfo != null) {
            if (station.AddressInfo.Latitude != null) lat = station.AddressInfo.Latitude;
            if (station.AddressInfo.Longitude != null) lon = station.AddressInfo.Longitude;
        }
        var mapsLink = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon;

        html += "  <div class='card-footer'>";
        html += "    <button onclick='saveFavorite(\"" + station.ID + "\")' class='card-btn'>❤️ Save</button>";
        html += "    <button onclick='focusStation(\"" + station.ID + "\")' class='card-btn'>📍 Locate</button>";
        html += "    <a href='" + mapsLink + "' target='_blank' class='card-btn primary-btn'>🗺️ Directions</a>";
        html += "  </div>";
        html += "</div>";

        // Add this card to the grid
        stationGrid.innerHTML += html;
    }

    // Synchronize the Leaflet map markers
    updateMapMarkers(stationsArray);
}

// Function to update map markers
function updateMapMarkers(stationsArray) {
    if (map == null || markerClusterGroup == null) return;
    
    // Clear old markers
    markerClusterGroup.clearLayers();
    stationMarkers = {};
    
    for (var i = 0; i < stationsArray.length; i++) {
        var station = stationsArray[i];
        
        var lat = null;
        var lon = null;
        if (station.AddressInfo != null) {
            if (station.AddressInfo.Latitude != null) lat = station.AddressInfo.Latitude;
            if (station.AddressInfo.Longitude != null) lon = station.AddressInfo.Longitude;
        }
        
        if (lat == null || lon == null || lat == 0 || lon == 0) {
            continue;
        }
        
        var isFast = false;
        if (station.Connections != null) {
            for (var j = 0; j < station.Connections.length; j++) {
                if (station.Connections[j].PowerKW >= 20) {
                    isFast = true;
                }
            }
        }
        
        var markerIcon = isFast ? fastIcon : standardIcon;
        var marker = L.marker([lat, lon], { icon: markerIcon });
        
        var title = (station.AddressInfo && station.AddressInfo.Title) ? station.AddressInfo.Title : "Unnamed Station";
        var address = (station.AddressInfo && station.AddressInfo.AddressLine1) ? station.AddressInfo.AddressLine1 : "No Address";
        var mapsLink = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon;
        
        var popupHtml = "";
        popupHtml += "<div class='map-popup-card'>";
        popupHtml += "  <div class='station-name' style='font-size: 16px; margin-bottom: 4px;'>" + title + "</div>";
        popupHtml += "  <div class='station-address' style='font-size: 12px; margin-bottom: 10px;'>" + address + "</div>";
        
        if (isFast) {
            popupHtml += "  <span class='badge badge-fast' style='margin-bottom: 10px;'>Fast Charger ⚡</span>";
        } else {
            popupHtml += "  <span class='badge' style='margin-bottom: 10px;'>Standard Charger 🔌</span>";
        }

        // Surface Connection details
        if (station.Connections != null && station.Connections.length > 0) {
            popupHtml += "  <div class='station-connectors' style='font-size: 11px; margin-bottom: 8px;'>";
            popupHtml += "    <strong>Connectors:</strong>";
            popupHtml += "    <ul style='margin: 2px 0 0 12px; padding: 0;'>";
            for (var c = 0; c < station.Connections.length; c++) {
                var conn = station.Connections[c];
                var typeTitle = conn.ConnectionType ? conn.ConnectionType.Title : "Unknown Type";
                var power = conn.PowerKW ? conn.PowerKW + " kW" : "Unknown Power";
                popupHtml += "      <li style='margin-bottom: 1px;'>" + typeTitle + " - " + power + "</li>";
            }
            popupHtml += "    </ul>";
            popupHtml += "  </div>";
        }
        
        popupHtml += "  <div class='card-footer' style='margin-top: 5px; gap: 6px;'>";
        popupHtml += "    <button onclick='saveFavorite(\"" + station.ID + "\")' class='card-btn' style='padding: 6px; font-size: 12px;'>❤️ Save</button>";
        popupHtml += "    <a href='" + mapsLink + "' target='_blank' class='card-btn primary-btn' style='padding: 6px; font-size: 12px; text-decoration: none; text-align: center;'>🗺️ Directions</a>";
        popupHtml += "  </div>";
        popupHtml += "</div>";
        
        marker.bindPopup(popupHtml);
        
        stationMarkers[station.ID] = marker;
        markerClusterGroup.addLayer(marker);
    }
    
    // Zoom/Fit map bounds to show all markers
    if (stationsArray.length > 0) {
        var bounds = markerClusterGroup.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }
}

// Function to focus and center map on a specific station
function focusStation(id) {
    var marker = stationMarkers[id];
    if (marker && map) {
        markerClusterGroup.zoomToShowLayer(marker, function() {
            marker.openPopup();
        });
        
        var mapDiv = document.getElementById("map");
        if (mapDiv) {
            mapDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Link search button to search function
if (searchBtn != null) {
    searchBtn.addEventListener("click", searchCity);
}

// Allow Enter key to search
if (cityInput != null) {
    cityInput.addEventListener("keypress", function(event) {
        if (event.key == "Enter") {
            searchCity();
        }
    });
}

// Function to save a station to Favorites using LocalStorage
function saveFavorite(id) {
    var stationToSave = null;
    
    // Find station by ID in allStations
    for (var i = 0; i < allStations.length; i++) {
        if (allStations[i].ID == id) {
            stationToSave = allStations[i];
            break;
        }
    }
    
    // Legacy support if passed an index instead of ID
    if (stationToSave == null && typeof id === "number" && id >= 0 && id < allStations.length) {
        stationToSave = allStations[id];
    }
    
    if (stationToSave == null) {
        showToast("Station not found!");
        return;
    }
    
    // Read old favorites from local storage
    var storageString = localStorage.getItem("my_simple_favorites");
    
    var favArray = [];
    if (storageString != null) {
        favArray = JSON.parse(storageString);
    }
    
    // Check if already in favorites to prevent duplicates
    for (var j = 0; j < favArray.length; j++) {
        if (favArray[j].ID == stationToSave.ID) {
            showToast("Already in favorites!");
            return;
        }
    }
    
    // Add new station
    favArray.push(stationToSave);
    
    // Save string back to local storage
    localStorage.setItem("my_simple_favorites", JSON.stringify(favArray));
    
    // Show premium toast feedback instead of basic alert popup
    showToast("Saved to favorites: " + (stationToSave.AddressInfo.Title || "Station"));
}

// Bind to window for HTML event handlers
window.saveFavorite = saveFavorite;
window.focusStation = focusStation;

// State of filters and sort
var currentFilterType = "all";
var currentConnectorType = "all";
var currentMinPower = 0;
var currentSortValue = "default";

// Populate Connector dropdown dynamically
function populateConnectorDropdown(stationsArray) {
    var select = document.getElementById("connector-type-select");
    if (!select) return;
    
    // Clear previous dynamic options
    select.innerHTML = '<option value="all">All Connectors</option>';
    
    var connectorSet = new Set();
    for (var i = 0; i < stationsArray.length; i++) {
        var s = stationsArray[i];
        if (s.Connections != null) {
            for (var j = 0; j < s.Connections.length; j++) {
                var conn = s.Connections[j];
                if (conn.ConnectionType != null && conn.ConnectionType.Title) {
                    connectorSet.add(conn.ConnectionType.Title);
                }
            }
        }
    }
    
    var sortedConnectors = Array.from(connectorSet).sort();
    for (var k = 0; k < sortedConnectors.length; k++) {
        var opt = document.createElement("option");
        opt.value = sortedConnectors[k];
        opt.innerText = sortedConnectors[k];
        select.appendChild(opt);
    }
}

// Reset UI and internal filter states
function resetFilterStates() {
    currentFilterType = "all";
    currentConnectorType = "all";
    currentMinPower = 0;
    currentSortValue = "default";
    
    var powerSlider = document.getElementById("power-slider");
    var powerValue = document.getElementById("power-value");
    if (powerSlider && powerValue) {
        powerSlider.value = 0;
        powerValue.innerText = 0;
    }
    
    var connectorSelect = document.getElementById("connector-type-select");
    if (connectorSelect) {
        connectorSelect.value = "all";
    }
    
    var sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
        sortSelect.value = "default";
    }
    
    var filterButtons = document.querySelectorAll(".filter-button");
    for (var j = 0; j < filterButtons.length; j++) {
        if (filterButtons[j].getAttribute("data-filter") == "all") {
            filterButtons[j].classList.add("active");
        } else {
            filterButtons[j].classList.remove("active");
        }
    }
}

// Unified Filter & Sort Pipeline
function applyFiltersAndSort() {
    var filtered = [];
    
    for (var i = 0; i < allStations.length; i++) {
        var station = allStations[i];
        
        // 1. Badge Filter (All, Fast, Free, Favorited)
        var matchesBadge = false;
        if (currentFilterType == "all") {
            matchesBadge = true;
        } else if (currentFilterType == "fast") {
            if (station.Connections != null) {
                for (var c = 0; c < station.Connections.length; c++) {
                    if (station.Connections[c].PowerKW >= 20) {
                        matchesBadge = true;
                        break;
                    }
                }
            }
        } else if (currentFilterType == "free") {
            if (station.UsageType != null && station.UsageType.IsPayAtLocation === false && station.UsageType.IsMembershipRequired === false) {
                matchesBadge = true;
            }
        } else if (currentFilterType == "favorited") {
            var fStorage = localStorage.getItem("my_simple_favorites");
            if (fStorage != null) {
                var fArray = JSON.parse(fStorage);
                for (var m = 0; m < fArray.length; m++) {
                    if (fArray[m].ID == station.ID) {
                        matchesBadge = true;
                        break;
                    }
                }
            }
        }
        
        if (!matchesBadge) continue;
        
        // 2. Connector Type Filter
        var matchesConnector = false;
        if (currentConnectorType == "all") {
            matchesConnector = true;
        } else {
            if (station.Connections != null) {
                for (var c = 0; c < station.Connections.length; c++) {
                    var conn = station.Connections[c];
                    if (conn.ConnectionType != null && conn.ConnectionType.Title === currentConnectorType) {
                        matchesConnector = true;
                        break;
                    }
                }
            }
        }
        
        if (!matchesConnector) continue;
        
        // 3. Min Power Filter
        var matchesPower = false;
        if (currentMinPower == 0) {
            matchesPower = true;
        } else {
            if (station.Connections != null) {
                for (var c = 0; c < station.Connections.length; c++) {
                    var power = station.Connections[c].PowerKW || 0;
                    if (power >= currentMinPower) {
                        matchesPower = true;
                        break;
                    }
                }
            }
        }
        
        if (!matchesPower) continue;
        
        filtered.push(station);
    }
    
    // Sort logic
    filtered.sort(function(a, b) {
        var titleA = "Untitled";
        if (a.AddressInfo != null && a.AddressInfo.Title != null) { titleA = a.AddressInfo.Title; }
        
        var titleB = "Untitled";
        if (b.AddressInfo != null && b.AddressInfo.Title != null) { titleB = b.AddressInfo.Title; }
        
        var pointsA = a.NumberOfPoints == null ? 0 : a.NumberOfPoints;
        var pointsB = b.NumberOfPoints == null ? 0 : b.NumberOfPoints;
        
        var getMaxPower = function(s) {
            var maxP = 0;
            if (s.Connections != null) {
                for (var j = 0; j < s.Connections.length; j++) {
                    var p = s.Connections[j].PowerKW || 0;
                    if (p > maxP) maxP = p;
                }
            }
            return maxP;
        };
        var powerA = getMaxPower(a);
        var powerB = getMaxPower(b);

        if (currentSortValue == "name-asc") {
            if(titleA < titleB) return -1;
            if(titleA > titleB) return 1;
            return 0;
        } 
        else if (currentSortValue == "name-desc") {
            if(titleA > titleB) return -1;
            if(titleA < titleB) return 1;
            return 0;
        }
        else if (currentSortValue == "power-desc") {
            return powerB - powerA;
        }
        else if (currentSortValue == "power-asc") {
            return powerA - powerB;
        }
        else if (currentSortValue == "points-desc") {
            return pointsB - pointsA;
        }
        else if (currentSortValue == "points-asc") {
            return pointsA - pointsB;
        }
        return 0;
    });
    
    // Check if empty
    var noResults = document.getElementById("no-results-message");
    if (noResults) {
        noResults.hidden = filtered.length > 0;
    }
    
    displayStations(filtered);
}

// Theme Toggle & Persistence
function initTheme() {
    var savedTheme = localStorage.getItem("volt_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn != null) {
        themeBtn.addEventListener("click", function() {
            var htmlTag = document.documentElement;
            var currentTheme = htmlTag.getAttribute("data-theme");
            var newTheme = currentTheme === "light" ? "dark" : "light";
            htmlTag.setAttribute("data-theme", newTheme);
            localStorage.setItem("volt_theme", newTheme);
            updateThemeIcon(newTheme);
        });
    }
}

function updateThemeIcon(theme) {
    var themeIcon = document.getElementById("theme-icon");
    if (themeIcon) {
        themeIcon.innerText = theme === "light" ? "☀️" : "🌙";
    }
}
initTheme();

// Bind Filter & Sort Listeners
var sortSelect = document.getElementById("sort-select");
if (sortSelect != null) {
    sortSelect.addEventListener("change", function() {
        currentSortValue = sortSelect.value;
        applyFiltersAndSort();
    });
}

var connectorSelect = document.getElementById("connector-type-select");
if (connectorSelect != null) {
    connectorSelect.addEventListener("change", function() {
        currentConnectorType = connectorSelect.value;
        applyFiltersAndSort();
    });
}

var powerSlider = document.getElementById("power-slider");
var powerValueDisplay = document.getElementById("power-value");
if (powerSlider != null && powerValueDisplay != null) {
    powerSlider.addEventListener("input", function() {
        currentMinPower = parseInt(powerSlider.value);
        powerValueDisplay.innerText = currentMinPower;
        applyFiltersAndSort();
    });
}

var filterButtons = document.querySelectorAll(".filter-button");
for (var i = 0; i < filterButtons.length; i++) {
    filterButtons[i].addEventListener("click", function() {
        for (var j = 0; j < filterButtons.length; j++) {
            filterButtons[j].classList.remove("active");
        }
        this.classList.add("active");
        currentFilterType = this.getAttribute("data-filter");
        applyFiltersAndSort();
    });
}

// Quick search helper
async function quickSearch(city) {
    if (cityInput) {
        cityInput.value = city;
        await searchCity();
    }
}
window.quickSearch = quickSearch;

// Check if query params have a city on load, or auto-locate
window.addEventListener("DOMContentLoaded", function() {
    var params = new URLSearchParams(window.location.search);
    var cityParam = params.get("city");
    if (cityParam) {
        if (cityInput) {
            cityInput.value = cityParam;
        }
        searchCity();
    } else {
        // Automatically request location access if no direct city search is requested
        getUserLocation();
    }
});

// Update stats count card
function updateStatsSummary() {
    var fastCount = 0;
    var freeCount = 0;
    for (var i = 0; i < allStations.length; i++) {
        var s = allStations[i];
        
        // Fast Check
        var isFst = false;
        if (s.Connections != null) {
            for (var j = 0; j < s.Connections.length; j++) {
                if (s.Connections[j].PowerKW >= 20) isFst = true;
            }
        }
        if (isFst) fastCount++;
        
        // Free Check
        var isFre = false;
        if (s.UsageType != null && s.UsageType.IsPayAtLocation === false && s.UsageType.IsMembershipRequired === false) {
            isFre = true;
        }
        if (isFre) freeCount++;
    }
    
    var totalEl = document.getElementById("summary-total-count");
    var fastEl = document.getElementById("summary-fast-count");
    var freeEl = document.getElementById("summary-free-count");
    
    if (totalEl) totalEl.innerText = allStations.length;
    if (fastEl) fastEl.innerText = fastCount;
    if (freeEl) freeEl.innerText = freeCount;
}

// Geolocation Functions
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    } else {
        showToast("Geolocation is not supported by this browser.");
    }
}

async function onGeoSuccess(position) {
    var lat = position.coords.latitude;
    var lon = position.coords.longitude;
    currentUserLocation = { lat: lat, lon: lon };
    
    var welcomeCard = document.getElementById("welcome-card");
    if (welcomeCard) welcomeCard.hidden = true;
    
    loadingMsg.hidden = false;
    stationGrid.innerHTML = "";
    errorMsg.hidden = true;
    noResultsMsg.hidden = true;
    
    // Clear user location marker and active driving route line
    if (activeRouteLine != null && map != null) {
        map.removeLayer(activeRouteLine);
        activeRouteLine = null;
    }
    if (userLocationMarker != null && map != null) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    var directionsCard = document.getElementById("directions-card");
    if (directionsCard) directionsCard.hidden = true;
    
    try {
        var chargeUrl = "https://api.openchargemap.io/v3/poi/?key=" + apiKey + "&latitude=" + lat + "&longitude=" + lon + "&distance=25&distanceunit=km&maxresults=30&compact=true";
        var chargeResponse = await fetch(chargeUrl);
        var chargeData = await chargeResponse.json();

        if (chargeData.length == 0) {
            loadingMsg.hidden = true;
            noResultsMsg.hidden = false;
            showPlaceholder();
            return;
        }

        allStations = chargeData;

        // Initialize Map
        initMap(lat, lon);
        
        // Show current location dot
        renderUserLocationMarker(lat, lon);

        // Populate dynamic connector dropdown based on search results
        populateConnectorDropdown(allStations);
        
        // Reset filters
        resetFilterStates();
        
        // Show filter and summary sections
        document.getElementById("filter-sort-row").hidden = false;
        document.getElementById("results-summary").hidden = false;
        document.getElementById("summary-city-name").innerText = "Your Location";
        
        // Update Stats Card
        updateStatsSummary();

        // Execute unified filter & sort pipeline (initial draw)
        applyFiltersAndSort();
        
        // Locate driving directions to nearest station (OCM sorts by distance when coordinates are supplied)
        var nearestStation = allStations[0];
        await getDrivingDirections(lat, lon, nearestStation);

        loadingMsg.hidden = true;
    } catch (error) {
        console.log("Geolocation search error:", error);
        loadingMsg.hidden = true;
        errorMsg.hidden = false;
    }
}

function onGeoError(error) {
    console.log("Geolocation failed or denied:", error);
    showToast("Could not determine your location. Please search manually.");
}

function renderUserLocationMarker(lat, lon) {
    if (map == null) return;
    
    if (userLocationMarker != null) {
        map.removeLayer(userLocationMarker);
    }
    
    var userIcon = L.divIcon({
        html: `
        <div class="user-pulse-marker" style="position: relative; width: 18px; height: 18px;">
            <div style="position: absolute; width: 14px; height: 14px; background: #0070f3; border: 2px solid #ffffff; border-radius: 50%; top: 2px; left: 2px; box-shadow: 0 0 6px rgba(0,112,243,0.8); z-index: 10;"></div>
            <div class="pulse-ring" style="position: absolute; width: 18px; height: 18px; background: rgba(0,112,243,0.4); border-radius: 50%; animation: pulseRing 1.8s infinite ease-out;"></div>
        </div>
        <style>
            @keyframes pulseRing {
                0% { transform: scale(0.6); opacity: 1; }
                100% { transform: scale(2.2); opacity: 0; }
            }
        </style>`,
        className: 'custom-user-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });
    
    userLocationMarker = L.marker([lat, lon], { icon: userIcon });
    userLocationMarker.addTo(map);
}

// OSRM Driving Route and Directions
async function getDrivingDirections(startLat, startLon, destStation) {
    if (!destStation || !destStation.AddressInfo) return;
    
    var destLat = destStation.AddressInfo.Latitude;
    var destLon = destStation.AddressInfo.Longitude;
    
    if (!destLat || !destLon) return;
    
    try {
        var osrmUrl = "https://router.project-osrm.org/route/v1/driving/" + startLon + "," + startLat + ";" + destLon + "," + destLat + "?overview=full&geometries=geojson&steps=true";
        var response = await fetch(osrmUrl);
        var data = await response.json();
        
        if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
            console.log("OSRM routing failed:", data);
            return;
        }
        
        var route = data.routes[0];
        
        // Draw path polyline
        drawRouteLine(route.geometry);
        
        // Render step instructions in sidebar
        displayDirectionsCard(route, destStation, startLat, startLon);
    } catch (e) {
        console.log("Error fetching routing directions:", e);
    }
}

function drawRouteLine(geometry) {
    if (map == null) return;
    
    if (activeRouteLine != null) {
        map.removeLayer(activeRouteLine);
    }
    
    activeRouteLine = L.geoJSON(geometry, {
        style: {
            color: '#00b359',
            weight: 5,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
        }
    }).addTo(map);
    
    var bounds = activeRouteLine.getBounds();
    if (userLocationMarker) {
        bounds.extend(userLocationMarker.getLatLng());
    }
    map.fitBounds(bounds, { padding: [50, 50] });
}

function escapeHtml(text) {
    if (!text) return "";
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function displayDirectionsCard(route, station, startLat, startLon) {
    var card = document.getElementById("directions-card");
    if (!card) return;
    
    var destNameEl = document.getElementById("route-dest-name");
    var distEl = document.getElementById("route-distance");
    var durEl = document.getElementById("route-duration");
    var stepsList = document.getElementById("directions-steps");
    var mapsBtn = document.getElementById("google-maps-directions-btn");
    
    var title = station.AddressInfo.Title || "Unnamed Station";
    var distanceKm = (route.distance / 1000).toFixed(1) + " km";
    
    var durationMins = Math.round(route.duration / 60);
    var durationText = durationMins + " min" + (durationMins !== 1 ? "s" : "");
    if (durationMins > 60) {
        var hrs = Math.floor(durationMins / 60);
        var mins = durationMins % 60;
        durationText = hrs + "h " + mins + "m";
    }
    
    if (destNameEl) destNameEl.innerText = title;
    if (distEl) distEl.innerText = distanceKm;
    if (durEl) durEl.innerText = durationText;
    
    if (mapsBtn) {
        mapsBtn.href = "https://www.google.com/maps/dir/?api=1&origin=" + startLat + "," + startLon + "&destination=" + station.AddressInfo.Latitude + "," + station.AddressInfo.Longitude + "&travelmode=driving";
    }
    
    if (stepsList) {
        stepsList.innerHTML = "";
        
        var legs = route.legs;
        if (legs && legs.length > 0) {
            var steps = legs[0].steps;
            if (steps && steps.length > 0) {
                for (var s = 0; s < steps.length; s++) {
                    var step = steps[s];
                    var instruction = step.maneuver.instruction || "";
                    var stepDist = step.distance;
                    
                    if (instruction) {
                        var li = document.createElement("li");
                        var distText = "";
                        if (stepDist > 0) {
                            distText = " <span style='opacity: 0.5; font-size: 0.74rem;'>(" + (stepDist >= 1000 ? (stepDist / 1000).toFixed(1) + "km" : Math.round(stepDist) + "m") + ")</span>";
                        }
                        li.innerHTML = escapeHtml(instruction) + distText;
                        stepsList.appendChild(li);
                    }
                }
            } else {
                stepsList.innerHTML = "<li>Follow the highlighted route on the map.</li>";
            }
        } else {
            stepsList.innerHTML = "<li>Follow the highlighted route on the map.</li>";
        }
    }
    
    card.hidden = false;
}

function clearActiveRoute() {
    if (activeRouteLine != null && map != null) {
        map.removeLayer(activeRouteLine);
        activeRouteLine = null;
    }
    var card = document.getElementById("directions-card");
    if (card) {
        card.hidden = true;
    }
}
window.clearActiveRoute = clearActiveRoute;

function useCurrentLocation() {
    getUserLocation();
}
window.useCurrentLocation = useCurrentLocation;
