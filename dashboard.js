/* ================================================
   dashboard.js
   VoltNavigator — Station Finder: API Integration
   ------------------------------------------------
   API: Open Charge Map (https://openchargemap.org)
        Free, no auth required, real EV data.

   Load after voltnav.js:
     <script src="voltnav.js"    defer></script>
     <script src="dashboard.js"  defer></script>

   Public helpers (usable from other scripts):
     VoltDash.search(city)      — trigger a search
     VoltDash.getCurrentCity()  — returns last searched city
================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────── */
  const API_BASE    = 'https://api.openchargemap.io/v3/poi/';
  const API_KEY     = '489ed144-5fbf-4b7e-b90b-1bc508d66b86'; // your Open Charge Map key
  const PAGE_SIZE   = 12;   // cards per page
  const MAX_RESULTS = 100;  // max we request from API

  /* ─────────────────────────────────────────
     STATE
  ───────────────────────────────────────── */
  let allStations   = [];   // full API response for current city
  let filtered      = [];   // after applying activeFilter
  let currentPage   = 0;    // pagination cursor
  let activeFilter  = 'all';
  let currentCity   = '';
  let isLoading     = false;
  let lastQuery     = '';

  /* ─────────────────────────────────────────
     DOM REFS
  ───────────────────────────────────────── */
  const cityInput    = document.getElementById('city-search-input');
  const searchBtn    = document.getElementById('search-button');
  const skeletonGrid = document.getElementById('loading-cards');
  const stationGrid  = document.getElementById('station-results');
  const errorState   = document.getElementById('error-message');
  const errorMsg     = document.getElementById('error-description');
  const emptyState   = document.getElementById('no-results-message');
  const summaryBar   = document.getElementById('results-summary');
  const filterRow    = document.getElementById('filter-options');
  const loadMoreWrap = document.getElementById('load-more-section');
  const loadMoreBtn  = document.getElementById('load-more-button');
  const retryBtn     = document.getElementById('try-again-button');
  const filterBtns   = document.querySelectorAll('.filter-button');

  /* ─────────────────────────────────────────
     SHOW / HIDE HELPERS
  ───────────────────────────────────────── */
  function showOnly(el) {
    [skeletonGrid, stationGrid, errorState, emptyState].forEach(e => {
      if (e) e.hidden = (e !== el);
    });
  }

  function setVisible(el, visible) {
    if (el) el.hidden = !visible;
  }

  /* ─────────────────────────────────────────
     SKELETON LOADER — builds animated cards
  ───────────────────────────────────────── */
  function renderSkeletons(count = PAGE_SIZE) {
    skeletonGrid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      skeletonGrid.innerHTML += `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skel skel-title"></div>
          <div class="skel skel-line"></div>
          <div class="skel skel-line short"></div>
          <div class="skel skel-line"></div>
          <div>
            <span class="skel skel-badge"></span>
            <span class="skel skel-badge" style="margin-left:6px"></span>
          </div>
        </div>`;
    }
    showOnly(skeletonGrid);
    setVisible(summaryBar, false);
    setVisible(filterRow, false);
    setVisible(loadMoreWrap, false);
  }

  /* ─────────────────────────────────────────
     GEOCODE: city name → {lat, lon}
     Uses OpenStreetMap Nominatim (free, no key)
  ───────────────────────────────────────── */
  async function geocode(city) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('Could not find that city. Try a different spelling.');
    const data = await res.json();
    if (!data.length) throw new Error(`We couldn't find "${city}". Try a nearby major city.`);
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
  }

  /* ─────────────────────────────────────────
     FETCH STATIONS from Open Charge Map
  ───────────────────────────────────────── */
  async function fetchStations(lat, lon, cityName) {
    const params = new URLSearchParams({
      key:             API_KEY,
      output:          'json',
      latitude:        lat,
      longitude:       lon,
      distance:        25,          // km radius
      distanceunit:    'km',
      maxresults:      MAX_RESULTS,
      compact:         true,
      verbose:         false,
      countrycode:     '',          // all countries
    });

    const url = `${API_BASE}?${params}`;
    const res  = await fetch(url);

    if (!res.ok) throw new Error(`API error ${res.status}. Please try again in a moment.`);

    const data = await res.json();
    return data;
  }

  /* ─────────────────────────────────────────
     PARSE a single station from API response
  ───────────────────────────────────────── */
  function parseStation(item) {
    const addr   = item.AddressInfo || {};
    const conns  = item.Connections || [];
    const status = item.StatusType;
    const usage  = item.UsageType;

    // Determine fast charge (any connector > 20kW)
    const isFast = conns.some(c => c.PowerKW && c.PowerKW >= 20);

    // Usage cost
    const isFree = usage && usage.IsMembershipRequired === false && usage.IsPayAtLocation === false;

    // Status
    let statusKey = 'unknown';
    if (status) {
      if (status.IsOperational)  statusKey = 'open';
      if (!status.IsOperational) statusKey = 'offline';
    }

    // Connector types
    const connTypes = [...new Set(
      conns
        .map(c => c.ConnectionType && c.ConnectionType.Title)
        .filter(Boolean)
        .map(t => t.replace('IEC 62196-2 Type ', 'Type ').replace(' (Mennekes)', ''))
        .slice(0, 3)
    )];

    // Max power across connectors
    const maxKw = Math.max(...conns.map(c => c.PowerKW || 0), 0);

    return {
      id:         item.ID,
      name:       addr.Title || 'Unnamed Station',
      address:    [addr.AddressLine1, addr.Town, addr.Country?.ISOCode].filter(Boolean).join(', '),
      lat:        addr.Latitude,
      lon:        addr.Longitude,
      network:    item.OperatorInfo?.Title || 'Independent',
      statusKey,
      isFast,
      isFree,
      connTypes,
      maxKw,
      numPoints:  item.NumberOfPoints || conns.length || '?',
      url:        addr.RelatedURL || null,
    };
  }

  /* ─────────────────────────────────────────
     RENDER a single station card
  ───────────────────────────────────────── */
  function renderCard(station, index) {
    const statusLabel = { open: '🟢 Open', unknown: '⚪ Unknown', offline: '🔴 Offline' }[station.statusKey];
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;

    const badges = [];
    if (station.isFast) badges.push(`<span class="badge badge-fast">⚡ Fast ${station.maxKw > 0 ? station.maxKw + ' kW' : 'charge'}</span>`);
    else                badges.push(`<span class="badge badge-slow">🔌 Slow charge</span>`);
    if (station.isFree) badges.push(`<span class="badge badge-free">🆓 Free</span>`);
    else                badges.push(`<span class="badge badge-pay">💳 Pay to use</span>`);
    if (station.connTypes.length) badges.push(
      station.connTypes.map(t => `<span class="badge badge-slow">${t}</span>`).join('')
    );

    const delay = Math.min(index * 0.04, 0.5);

    return `
      <article class="charging-station-card" style="--delay:${delay}s" data-id="${station.id}" data-fast="${station.isFast}" data-free="${station.isFree}" data-status="${station.statusKey}">
        <div class="station-status-row">
          <span class="station-status-label ${station.statusKey}">
            <span class="status-indicator-dot ${station.statusKey}"></span>
            ${statusLabel}
          </span>
          <span class="network-name" title="${station.network}">${station.network}</span>
        </div>
        <h2 class="station-name">${escHtml(station.name)}</h2>
        <p  class="station-address">${escHtml(station.address)}</p>
        <div class="station-connector-types">${badges.join('')}</div>
        <div class="station-card-footer">
          <div class="charging-points-count">
            <strong>${station.numPoints}</strong>
            ${parseInt(station.numPoints) === 1 ? 'point' : 'points'}
          </div>
          <a class="get-directions-button"
             href="${mapsUrl}"
             target="_blank"
             rel="noopener noreferrer"
             aria-label="Get directions to ${escHtml(station.name)}">
            📍 Directions
          </a>
        </div>
      </article>`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─────────────────────────────────────────
     UPDATE SUMMARY BAR
  ───────────────────────────────────────── */
  function updateSummary(stations, city) {
    const fastCount = stations.filter(s => s.isFast).length;
    const freeCount = stations.filter(s => s.isFree).length;
    const cityShort = city.split(',')[0].trim();

    document.getElementById('summary-total-count').textContent = stations.length;
    document.getElementById('summary-fast-count').textContent  = fastCount;
    document.getElementById('summary-free-count').textContent  = freeCount;
    document.getElementById('summary-city-name').textContent  = cityShort;
    setVisible(summaryBar, true);
  }

  /* ─────────────────────────────────────────
     APPLY FILTER + RENDER PAGE
  ───────────────────────────────────────── */
  function applyFilter(filter) {
    activeFilter = filter;
    currentPage  = 0;

    filtered = allStations.filter(s => {
      if (filter === 'fast')   return s.isFast;
      if (filter === 'free')   return s.isFree;
      if (filter === 'open')   return s.statusKey === 'open';
      return true;
    });

    stationGrid.innerHTML = '';

    if (!filtered.length) {
      showOnly(emptyState);
      setVisible(loadMoreWrap, false);
      return;
    }

    renderPage();
  }

  /* ─────────────────────────────────────────
     RENDER ONE PAGE of cards
  ───────────────────────────────────────── */
  function renderPage() {
    const start = currentPage * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);

    slice.forEach((station, i) => {
      stationGrid.insertAdjacentHTML('beforeend', renderCard(station, start + i));
    });

    showOnly(stationGrid);

    const hasMore = (currentPage + 1) * PAGE_SIZE < filtered.length;
    setVisible(loadMoreWrap, hasMore);
    if (hasMore) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = `Load more stations (${filtered.length - (currentPage + 1) * PAGE_SIZE} remaining)`;
    }

    currentPage++;
  }

  /* ─────────────────────────────────────────
     MAIN SEARCH FUNCTION
  ───────────────────────────────────────── */
  async function search(city) {
    if (!city.trim())   { showToast('Enter a city name first 😊', 'bad'); return; }
    if (isLoading)      return;

    isLoading   = true;
    currentCity = city.trim();
    lastQuery   = currentCity;

    // Update search input
    if (cityInput) cityInput.value = currentCity;

    // Reset filters UI
    filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    activeFilter = 'all';

    // Show skeletons
    renderSkeletons();
    setVisible(filterRow, false);
    searchBtn.disabled    = true;
    searchBtn.textContent = 'Searching…';

    try {
      // Step 1 — Geocode the city
      const { lat, lon } = await geocode(currentCity);

      // Step 2 — Fetch stations
      const raw = await fetchStations(lat, lon, currentCity);

      // Step 3 — Parse
      allStations = raw.map(parseStation);
      filtered    = allStations;
      currentPage = 0;

      if (!allStations.length) {
        showOnly(emptyState);
        setVisible(summaryBar, false);
        setVisible(filterRow, false);
        showToast(`No stations found near ${currentCity} 😔`, 'bad');
        return;
      }

      // Step 4 — Render
      stationGrid.innerHTML = '';
      updateSummary(allStations, currentCity);
      setVisible(filterRow, true);
      renderPage();

      showToast(`Found ${allStations.length} stations near ${currentCity.split(',')[0]} ⚡`, 'ok');

    } catch (err) {
      showOnly(errorState);
      setVisible(summaryBar, false);
      setVisible(filterRow, false);
      errorMsg.textContent = err.message || 'Something went wrong. Please try again.';
      console.error('[VoltDash]', err);
    } finally {
      isLoading             = false;
      searchBtn.disabled    = false;
      searchBtn.textContent = 'Search ⚡';
    }
  }

  /* ─────────────────────────────────────────
     TOAST — reuse voltnav.js toast if available,
     otherwise fall back to a local version
  ───────────────────────────────────────── */
  function showToast(msg, type = '') {
    // voltnav.js exposes toast() — guard in case it's not on this page
    if (typeof toast === 'function') {
      toast(msg, type === 'ok' ? 'ok' : type === 'bad' ? 'bad' : '');
    } else {
      const el = document.getElementById('notification-toast');
      if (!el) return;
      el.innerHTML  = msg;
      el.className  = `toast show ${type}`;
      setTimeout(() => el.classList.remove('show'), 4200);
    }
  }

  /* ─────────────────────────────────────────
     EVENT LISTENERS
  ───────────────────────────────────────── */

  // Search button
  if (searchBtn) {
    searchBtn.addEventListener('click', () => search(cityInput.value));
  }

  // Enter key in search input
  if (cityInput) {
    cityInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') search(cityInput.value);
    });
  }

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  // Load more
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      loadMoreBtn.disabled    = true;
      loadMoreBtn.textContent = 'Loading…';
      // Small delay for feel
      setTimeout(() => renderPage(), 300);
    });
  }

  // Retry button
  if (retryBtn) {
    retryBtn.addEventListener('click', () => search(lastQuery || currentCity));
  }

  /* ─────────────────────────────────────────
     AUTO-LOAD on page open — try geolocation
     first, fall back to London
  ───────────────────────────────────────── */
  function autoLoad() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          // Reverse geocode to get city name
          try {
            const { latitude: lat, longitude: lon } = pos.coords;
            const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || 'Delhi';
            if (cityInput) cityInput.value = city;
            search(city);
          } catch {
            search('Delhi');
          }
        },
        () => search('Delhi'),
        { timeout: 5000 }
      );
    } else {
      search('Delhi');
    }
  }

  /* ─────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────── */
  window.VoltDash = {
    search,
    getCurrentCity: () => currentCity,
  };

  /* ─────────────────────────────────────────
     INIT — guard: only run on dashboard page
  ───────────────────────────────────────── */
  if (document.getElementById('city-search-input')) {
    autoLoad();
  }

})();
