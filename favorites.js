// Simple JavaScript for Favorites - Class 12th Student 

// Get the main HTML grid
var favGrid = document.getElementById("fav-grid");
var emptyMsg = document.getElementById("fav-empty");

// Array to store favorite stations
var savedFavorites = [];

// Main function to load and display favorites
function loadFavorites() {
    // Read from local storage
    var storageString = localStorage.getItem("my_simple_favorites");
    
    // Check if there is data
    if (storageString == null || storageString == "[]") {
        emptyMsg.hidden = false;
        return;
    }
    
    // Convert string to array
    savedFavorites = JSON.parse(storageString);
    
    // Clear old HTML
    favGrid.innerHTML = "";
    
    // Simple For Loop to draw each station
    for (var i = 0; i < savedFavorites.length; i++) {
        var station = savedFavorites[i];
        
        var title = "Unnamed Station";
        if (station.AddressInfo != null && station.AddressInfo.Title != null) {
            title = station.AddressInfo.Title;
        }

        var address = "No Address";
        if (station.AddressInfo != null && station.AddressInfo.AddressLine1 != null) {
            address = station.AddressInfo.AddressLine1;
        }
        
        var isFast = false;
        if (station.Connections != null) {
            for (var j = 0; j < station.Connections.length; j++) {
                if (station.Connections[j].PowerKW >= 20) {
                    isFast = true;
                }
            }
        }
        
        // Build card HTML using string addition
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
        html += "    <button onclick='removeFavorite(" + i + ")' class='card-btn danger-btn'>🗑️ Remove</button>";
        html += "    <a href='" + mapsLink + "' target='_blank' class='card-btn primary-btn'>🗺️ Directions</a>";
        html += "  </div>";
        html += "</div>";

        // Add to grid
        favGrid.innerHTML += html;
    }
}

// Function to remove a favorite
function removeFavorite(index) {
    // Array Splice function removes 1 element at the specified index
    savedFavorites.splice(index, 1);
    
    // Save updated array back to local storage
    localStorage.setItem("my_simple_favorites", JSON.stringify(savedFavorites));
    
    // Reload screen
    if(savedFavorites.length == 0) {
        favGrid.innerHTML = "";
        emptyMsg.hidden = false;
    } else {
        loadFavorites(); 
    }
}

// Run this function when the page loads
if (favGrid != null) {
    loadFavorites();
}

// Simple Theme Toggle
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

// Favorite Sorting logic
var favSortSelect = document.getElementById("fav-sort-select");
if (favSortSelect != null) {
    favSortSelect.addEventListener("change", function() {
        var sortValue = favSortSelect.value;
        
        savedFavorites.sort(function(a, b) {
            var titleA = "Untitled";
            if (a.AddressInfo != null && a.AddressInfo.Title != null) { titleA = a.AddressInfo.Title; }
            
            var titleB = "Untitled";
            if (b.AddressInfo != null && b.AddressInfo.Title != null) { titleB = b.AddressInfo.Title; }
            
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
            // newest/oldest requires timestamp which basic Array doesn't have by default unless we added it
            // but we can just reverse the array or do nothing.
            
            return 0;
        });
        
        // Redraw table
        // We need to re-clear and re-run display loop
        loadFavoritesFromMemory();
    });
}

function loadFavoritesFromMemory() {
    favGrid.innerHTML = "";
    
    for (var i = 0; i < savedFavorites.length; i++) {
        var station = savedFavorites[i];
        
        var title = "Unnamed Station";
        if (station.AddressInfo != null && station.AddressInfo.Title != null) {
            title = station.AddressInfo.Title;
        }

        var address = "No Address";
        if (station.AddressInfo != null && station.AddressInfo.AddressLine1 != null) {
            address = station.AddressInfo.AddressLine1;
        }
        
        var isFast = false;
        if (station.Connections != null) {
            for (var j = 0; j < station.Connections.length; j++) {
                if (station.Connections[j].PowerKW >= 20) {
                    isFast = true;
                }
            }
        }
        
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
        html += "    <button onclick='removeFavorite(" + i + ")' class='card-btn danger-btn'>🗑️ Remove</button>";
        html += "    <a href='" + mapsLink + "' target='_blank' class='card-btn primary-btn'>🗺️ Directions</a>";
        html += "  </div>";
        html += "</div>";

        favGrid.innerHTML += html;
    }
}
