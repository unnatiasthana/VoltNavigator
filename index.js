// Simple JavaScript for Class 12th Student

// Variable to store API key
var apiKey = '489ed144-5fbf-4b7e-b90b-1bc508d66b86';

// Global array to store current stations
var allStations = [];

// Get HTML elements
var cityInput = document.getElementById("city-search-input");
var searchBtn = document.getElementById("search-button");
var stationGrid = document.getElementById("station-results");
var loadingMsg = document.getElementById("loading-cards");
var errorMsg = document.getElementById("error-message");
var noResultsMsg = document.getElementById("no-results-message");

// Main function to search for stations
async function searchCity() {
    var city = cityInput.value;
    
    // Check if empty
    if (city == "") {
        alert("Please enter a city name!");
        return;
    }

    // Show loading message, hide previous results
    loadingMsg.hidden = false;
    stationGrid.innerHTML = "";
    errorMsg.hidden = true;
    noResultsMsg.hidden = true;

    try {
        // Step 1: Use basic Geocoding API to get Latitude and Longitude
        var geoUrl = "https://nominatim.openstreetmap.org/search?q=" + city + "&format=json&limit=1";
        var geoResponse = await fetch(geoUrl);
        var geoData = await geoResponse.json();

        // If city is not found
        if (geoData.length == 0) {
            loadingMsg.hidden = true;
            noResultsMsg.hidden = false;
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
            return;
        }

        // Save data to our global array
        allStations = chargeData;
        
        // Show filter and summary sections
        document.getElementById("filter-sort-row").hidden = false;
        document.getElementById("results-summary").hidden = false;
        document.getElementById("summary-city-name").innerText = city;
        
        // Count Fast and Free
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
        
        document.getElementById("summary-total-count").innerText = allStations.length;
        document.getElementById("summary-fast-count").innerText = fastCount;
        document.getElementById("summary-free-count").innerText = freeCount;

        // Step 3: Draw stations on the screen using a normal loop
        displayStations(allStations);

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

        var lat = 0;
        var lon = 0;
        if (station.AddressInfo != null) {
            if (station.AddressInfo.Latitude != null) lat = station.AddressInfo.Latitude;
            if (station.AddressInfo.Longitude != null) lon = station.AddressInfo.Longitude;
        }
        var mapsLink = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon;

        html += "  <div class='card-footer'>";
        html += "    <button onclick='saveFavorite(" + i + ")' class='card-btn'>❤️ Save</button>";
        html += "    <a href='" + mapsLink + "' target='_blank' class='card-btn primary-btn'>🗺️ Directions</a>";
        html += "  </div>";
        html += "</div>";

        // Add this card to the grid
        stationGrid.innerHTML += html;
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
function saveFavorite(index) {
    var stationToSave = allStations[index];
    
    // Read old favorites from local storage
    var storageString = localStorage.getItem("my_simple_favorites");
    
    var favArray = [];
    if (storageString != null) {
        favArray = JSON.parse(storageString);
    }
    
    // Add new station
    favArray.push(stationToSave);
    
    // Save string back to local storage
    localStorage.setItem("my_simple_favorites", JSON.stringify(favArray));
    
    alert("Station saved to favorites!");
}

// Simple Theme Toggle (Dark / Light mode)
var themeBtn = document.getElementById("theme-toggle");
if (themeBtn != null) {
    themeBtn.addEventListener("click", function() {
        var htmlTag = document.documentElement;
        var currentTheme = htmlTag.getAttribute("data-theme");
        
        if (currentTheme == "light") {
            htmlTag.setAttribute("data-theme", "dark");
        } else {
            htmlTag.setAttribute("data-theme", "light");
        }
    });
}

// Sorting logic
var sortSelect = document.getElementById("sort-select");
if (sortSelect != null) {
    sortSelect.addEventListener("change", function() {
        var sortValue = sortSelect.value;
        
        // Basic Bubble Sort logic or built-in .sort() for strings/numbers
        allStations.sort(function(a, b) {
            // Get Titles securely
            var titleA = "Untitled";
            if (a.AddressInfo != null && a.AddressInfo.Title != null) { titleA = a.AddressInfo.Title; }
            
            var titleB = "Untitled";
            if (b.AddressInfo != null && b.AddressInfo.Title != null) { titleB = b.AddressInfo.Title; }
            
            // Get Number of Points securely
            var pointsA = a.NumberOfPoints == null ? 0 : a.NumberOfPoints;
            var pointsB = b.NumberOfPoints == null ? 0 : b.NumberOfPoints;

            // Simple If-Else for sorting
            if (sortValue == "name-asc") {
                if(titleA < titleB) return -1;
                if(titleA > titleB) return 1;
                return 0;
            } 
            else if (sortValue == "name-desc") {
                if(titleA > titleB) return -1;
                if(titleA < titleB) return 1;
                return 0;
            }
            else if (sortValue == "points-desc") {
                return pointsB - pointsA;
            }
            else if (sortValue == "points-asc") {
                return pointsA - pointsB;
            }
            // default returns 0
            return 0;
        });
        
        // Redraw after sort
        displayStations(allStations);
    });
}

// ---------------------------
// Basic Filter Logic
// ---------------------------
var filterButtons = document.querySelectorAll(".filter-button");

for (var i = 0; i < filterButtons.length; i++) {
    filterButtons[i].addEventListener("click", function() {
        
        // Remove active class from all buttons
        for (var j = 0; j < filterButtons.length; j++) {
            filterButtons[j].classList.remove("active");
        }
        
        // Add active class to clicked button
        this.classList.add("active");
        
        // Get the filter type directly from the HTML attribute
        var filterType = this.getAttribute("data-filter");
        
        var filteredStations = [];
        
        // Filter logic using simple loop
        for (var k = 0; k < allStations.length; k++) {
            var station = allStations[k];
            var keep = false;
            
            if (filterType == "all") {
                keep = true;
            } 
            else if (filterType == "fast") {
                if (station.Connections != null) {
                    for (var c = 0; c < station.Connections.length; c++) {
                        if (station.Connections[c].PowerKW >= 20) {
                            keep = true;
                        }
                    }
                }
            }
            else if (filterType == "free") {
                if (station.UsageType != null && station.UsageType.IsPayAtLocation === false && station.UsageType.IsMembershipRequired === false) {
                    keep = true;
                }
            }
            else if (filterType == "favorited") {
                // Check if this station's ID is in my saved favorites list
                var fStorage = localStorage.getItem("my_simple_favorites");
                if (fStorage != null) {
                    var fArray = JSON.parse(fStorage);
                    for (var m = 0; m < fArray.length; m++) {
                        if (fArray[m].ID == station.ID) {
                            keep = true;
                        }
                    }
                }
            }
            
            // Add to new list if we want to keep it
            if (keep == true) {
                filteredStations.push(station);
            }
        }
        
        // Display new filtered list
        displayStations(filteredStations);
    });
}
