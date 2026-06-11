// VoltNavigator — Favorites & History Page Logic

// State Variables
var savedFavorites = [];
var searchHistory = [];
var currentFilterType = "all"; // "all", "fast", "free"
var currentSearchQuery = "";
var currentSortValue = "name-asc"; // "name-asc", "name-desc", "power-desc"

// HTML Elements
var favGrid = document.getElementById("fav-grid");
var emptyFavsMsg = document.getElementById("fav-empty");
var emptyHistoryMsg = document.getElementById("history-empty");
var favoritesPanel = document.getElementById("favorites-panel");
var historyPanel = document.getElementById("history-panel");
var historyList = document.getElementById("history-list");

var tabFavorites = document.getElementById("tab-favorites");
var tabHistory = document.getElementById("tab-history");
var favTabCount = document.getElementById("fav-tab-count");
var historyTabCount = document.getElementById("history-tab-count");

var favSearchInput = document.getElementById("fav-search-input");
var favSearchClear = document.getElementById("fav-search-clear");
var favSortSelect = document.getElementById("fav-sort-select");

var favCountTotal = document.getElementById("fav-count-total");
var favCountFast = document.getElementById("fav-count-fast");
var favCountFree = document.getElementById("fav-count-free");

var clearFavsBtn = document.getElementById("fav-clear-all");
var clearHistoryBtn = document.getElementById("history-clear-all");

var favActionsRow = document.getElementById("fav-actions-row");
var historyActionsRow = document.getElementById("history-actions-row");

// Toast Notification
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

// Escape HTML Helper
function escapeHtml(text) {
    if (!text) return "";
    return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Relative Time Helper
function formatRelativeTime(timestamp) {
    var diff = Date.now() - timestamp;
    var secs = Math.floor(diff / 1000);
    if (secs < 60) return "Just now";
    var mins = Math.floor(secs / 60);
    if (mins < 60) return mins + "m ago";
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(hours / 24);
    return days === 1 ? "Yesterday" : days + " days ago";
}

// ─── Theme Persistence ───
function initTheme() {
    var savedTheme = localStorage.getItem("volt_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", function() {
            var currentTheme = document.documentElement.getAttribute("data-theme");
            var newTheme = currentTheme === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", newTheme);
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

// ─── Tab Switching ───
function initTabs() {
    if (tabFavorites && tabHistory) {
        tabFavorites.addEventListener("click", function() {
            tabFavorites.classList.add("active");
            tabHistory.classList.remove("active");
            favoritesPanel.hidden = false;
            historyPanel.hidden = true;
            renderFavorites();
        });

        tabHistory.addEventListener("click", function() {
            tabHistory.classList.add("active");
            tabFavorites.classList.remove("active");
            favoritesPanel.hidden = true;
            historyPanel.hidden = false;
            renderHistory();
        });
    }
}

// ─── Loading Data ───
function loadData() {
    // Load Favorites
    var favsString = localStorage.getItem("my_simple_favorites");
    try {
        savedFavorites = favsString ? JSON.parse(favsString) : [];
    } catch (e) {
        savedFavorites = [];
    }
    if (favTabCount) favTabCount.innerText = savedFavorites.length;

    // Load History
    var historyString = localStorage.getItem("volt_search_history");
    try {
        searchHistory = historyString ? JSON.parse(historyString) : [];
    } catch (e) {
        searchHistory = [];
    }
    if (historyTabCount) historyTabCount.innerText = searchHistory.length;
}

// ─── Render Favorites ───
function renderFavorites() {
    if (!favGrid) return;
    favGrid.innerHTML = "";

    // Calculate Summary Stats from ALL saved favorites
    var totalCount = savedFavorites.length;
    var fastCount = 0;
    var freeCount = 0;

    for (var i = 0; i < savedFavorites.length; i++) {
        var s = savedFavorites[i];
        
        // Fast Check
        var isFast = false;
        if (s.Connections) {
            for (var c = 0; c < s.Connections.length; c++) {
                if (s.Connections[c].PowerKW >= 20) isFast = true;
            }
        }
        if (isFast) fastCount++;

        // Free Check
        var isFree = false;
        if (s.UsageType && s.UsageType.IsPayAtLocation === false && s.UsageType.IsMembershipRequired === false) {
            isFree = true;
        }
        if (isFree) freeCount++;
    }

    if (favCountTotal) favCountTotal.innerText = totalCount;
    if (favCountFast) favCountFast.innerText = fastCount;
    if (favCountFree) favCountFree.innerText = freeCount;

    // Apply Filters & Search in-memory
    var filtered = savedFavorites.filter(function(station) {
        // 1. Search Query Filter
        var title = (station.AddressInfo && station.AddressInfo.Title) ? station.AddressInfo.Title : "Unnamed Station";
        var address = (station.AddressInfo && station.AddressInfo.AddressLine1) ? station.AddressInfo.AddressLine1 : "No Address";
        var matchesSearch = title.toLowerCase().indexOf(currentSearchQuery.toLowerCase()) !== -1 ||
                            address.toLowerCase().indexOf(currentSearchQuery.toLowerCase()) !== -1;

        if (!matchesSearch) return false;

        // 2. Badge Filter
        if (currentFilterType === "fast") {
            var isFst = false;
            if (station.Connections) {
                for (var c = 0; c < station.Connections.length; c++) {
                    if (station.Connections[c].PowerKW >= 20) isFst = true;
                }
            }
            return isFst;
        } else if (currentFilterType === "free") {
            return station.UsageType && station.UsageType.IsPayAtLocation === false && station.UsageType.IsMembershipRequired === false;
        }

        return true;
    });

    // Apply Sorting
    filtered.sort(function(a, b) {
        var titleA = (a.AddressInfo && a.AddressInfo.Title) ? a.AddressInfo.Title : "Untitled";
        var titleB = (b.AddressInfo && b.AddressInfo.Title) ? b.AddressInfo.Title : "Untitled";

        if (currentSortValue === "name-asc") {
            return titleA.localeCompare(titleB);
        } else if (currentSortValue === "name-desc") {
            return titleB.localeCompare(titleA);
        } else if (currentSortValue === "power-desc") {
            var getMaxPower = function(s) {
                var maxP = 0;
                if (s.Connections) {
                    for (var j = 0; j < s.Connections.length; j++) {
                        var p = s.Connections[j].PowerKW || 0;
                        if (p > maxP) maxP = p;
                    }
                }
                return maxP;
            };
            return getMaxPower(b) - getMaxPower(a);
        }
        return 0;
    });

    // Check if empty
    if (filtered.length === 0) {
        emptyFavsMsg.hidden = false;
        favActionsRow.hidden = true;
        return;
    }

    emptyFavsMsg.hidden = true;
    favActionsRow.hidden = false;

    // Draw filtered list
    for (var i = 0; i < filtered.length; i++) {
        var station = filtered[i];
        var title = (station.AddressInfo && station.AddressInfo.Title) ? station.AddressInfo.Title : "Unnamed Station";
        var address = (station.AddressInfo && station.AddressInfo.AddressLine1) ? station.AddressInfo.AddressLine1 : "No Address";
        
        var isFast = false;
        if (station.Connections) {
            for (var c = 0; c < station.Connections.length; c++) {
                if (station.Connections[c].PowerKW >= 20) isFast = true;
            }
        }

        var html = "";
        html += "<div class='charging-station-card'>";
        html += "  <div class='station-name'>" + escapeHtml(title) + "</div>";
        html += "  <div class='station-address'>" + escapeHtml(address) + "</div>";

        if (isFast) {
            html += "  <span class='badge badge-fast'>Fast Charger ⚡</span>";
        } else {
            html += "  <span class='badge'>Standard Charger 🔌</span>";
        }

        // Render Connections
        if (station.Connections && station.Connections.length > 0) {
            html += "  <div class='station-connectors'>";
            html += "    <strong>Connectors:</strong>";
            html += "    <ul>";
            for (var c = 0; c < station.Connections.length; c++) {
                var conn = station.Connections[c];
                var typeTitle = conn.ConnectionType ? conn.ConnectionType.Title : "Unknown Type";
                var power = conn.PowerKW ? conn.PowerKW + " kW" : "Unknown Power";
                var qty = conn.Quantity ? " (x" + conn.Quantity + ")" : "";
                html += "      <li>" + escapeHtml(typeTitle) + " - " + escapeHtml(power) + escapeHtml(qty) + "</li>";
            }
            html += "    </ul>";
            html += "  </div>";
        }

        var lat = station.AddressInfo ? (station.AddressInfo.Latitude || 0) : 0;
        var lon = station.AddressInfo ? (station.AddressInfo.Longitude || 0) : 0;
        var mapsLink = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon;

        html += "  <div class='card-footer'>";
        html += "    <button onclick='removeFavorite(\"" + station.ID + "\")' class='card-btn' style='color:#ef4444; border-color:rgba(239,68,68,0.2)'>🗑️ Remove</button>";
        html += "    <a href='" + mapsLink + "' target='_blank' class='card-btn primary-btn'>🗺️ Directions</a>";
        html += "  </div>";
        html += "</div>";

        favGrid.innerHTML += html;
    }
}

// Remove Favorite by ID
function removeFavorite(id) {
    savedFavorites = savedFavorites.filter(function(station) {
        return station.ID.toString() !== id.toString();
    });

    localStorage.setItem("my_simple_favorites", JSON.stringify(savedFavorites));
    if (favTabCount) favTabCount.innerText = savedFavorites.length;
    
    showToast("Removed from favorites.");
    renderFavorites();
}
window.removeFavorite = removeFavorite;

// Clear All Favorites
if (clearFavsBtn) {
    clearFavsBtn.addEventListener("click", function() {
        if (confirm("Are you sure you want to remove all saved favorites?")) {
            savedFavorites = [];
            localStorage.setItem("my_simple_favorites", JSON.stringify(savedFavorites));
            if (favTabCount) favTabCount.innerText = "0";
            showToast("Cleared all favorites.");
            renderFavorites();
        }
    });
}

// ─── Search & Filters Listeners ───
if (favSearchInput) {
    favSearchInput.addEventListener("input", function() {
        currentSearchQuery = favSearchInput.value.trim();
        if (favSearchClear) {
            favSearchClear.hidden = currentSearchQuery === "";
        }
        renderFavorites();
    });
}

if (favSearchClear) {
    favSearchClear.addEventListener("click", function() {
        favSearchInput.value = "";
        currentSearchQuery = "";
        favSearchClear.hidden = true;
        renderFavorites();
    });
}

if (favSortSelect) {
    favSortSelect.addEventListener("change", function() {
        currentSortValue = favSortSelect.value;
        renderFavorites();
    });
}

// Wire Up Filter Button Clicks in Favorites
var filterButtons = document.querySelectorAll(".fav-filter-row .filter-button");
for (var i = 0; i < filterButtons.length; i++) {
    filterButtons[i].addEventListener("click", function() {
        for (var j = 0; j < filterButtons.length; j++) {
            filterButtons[j].classList.remove("active");
        }
        this.classList.add("active");
        
        var filterId = this.getAttribute("id");
        if (filterId === "fav-filter-fast") {
            currentFilterType = "fast";
        } else if (filterId === "fav-filter-free") {
            currentFilterType = "free";
        } else {
            currentFilterType = "all";
        }
        
        renderFavorites();
    });
}

// ─── Render Search History ───
function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (searchHistory.length === 0) {
        emptyHistoryMsg.hidden = false;
        historyActionsRow.hidden = true;
        return;
    }

    emptyHistoryMsg.hidden = true;
    historyActionsRow.hidden = false;

    for (var i = 0; i < searchHistory.length; i++) {
        var item = searchHistory[i];
        var timeString = formatRelativeTime(item.timestamp);
        
        var html = "";
        // Set CSS delay variable for list staggered animation
        html += "<div class='history-item' style='--delay: " + (i * 0.05) + "s' onclick='goToSearch(\"" + encodeURIComponent(item.city) + "\")'>";
        html += "  <div class='history-item-icon'>📍</div>";
        html += "  <div class='history-item-details'>";
        html += "    <div class='history-item-city'>" + escapeHtml(item.city) + "</div>";
        html += "    <div class='history-item-time'>" + timeString + "</div>";
        html += "  </div>";
        html += "  <div class='history-item-arrow'>→</div>";
        html += "  <button class='history-item-delete' onclick='event.stopPropagation(); deleteHistoryItem(" + i + ")' aria-label='Delete history item'>🗑️</button>";
        html += "</div>";

        historyList.innerHTML += html;
    }
}

// Redirect to dashboard with city search param
function goToSearch(city) {
    window.location.href = "index.html?city=" + city;
}
window.goToSearch = goToSearch;

// Delete single history item
function deleteHistoryItem(index) {
    searchHistory.splice(index, 1);
    localStorage.setItem("volt_search_history", JSON.stringify(searchHistory));
    if (historyTabCount) historyTabCount.innerText = searchHistory.length;
    showToast("Removed search from history.");
    renderHistory();
}
window.deleteHistoryItem = deleteHistoryItem;

// Clear all history
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", function() {
        if (confirm("Are you sure you want to clear your search history?")) {
            searchHistory = [];
            localStorage.setItem("volt_search_history", JSON.stringify(searchHistory));
            if (historyTabCount) historyTabCount.innerText = "0";
            showToast("Cleared search history.");
            renderHistory();
        }
    });
}

// ─── Initialization on load ───
window.addEventListener("DOMContentLoaded", function() {
    initTheme();
    initTabs();
    loadData();
    
    // Initial render based on active view (Favorites is default)
    renderFavorites();
});
