/* ================================================
   dashboard.js
   VoltNavigator — Station Finder
   ------------------------------------------------
   Features (all using Array Higher-Order Functions):
     1. Search        — city search + keyword search (filter)
     2. Filtering     — fast / free / open / favorites (filter)
     3. Sorting       — name / power / points (sort)
     4. Interactions  — favorite ♡/♥, like 👍, view more
     5. Dark / Light  — theme toggle persisted in localStorage

   Array HOFs used: map, filter, sort, find, some, forEach,
                    reduce, slice, every, includes
================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────── */
  const API_BASE    = 'https://api.openchargemap.io/v3/poi/';
  const API_KEY     = '489ed144-5fbf-4b7e-b90b-1bc508d66b86';
  const PAGE_SIZE   = 12;
  const MAX_RESULTS = 100;

  /* ─────────────────────────────────────────
     STATE
  ───────────────────────────────────────── */
  let allStations   = [];
  let filtered      = [];
  let currentPage   = 0;
  let activeFilter  = 'all';
  let activeSort    = 'default';
  let keywordQuery  = '';
  let currentCity   = '';
  let isLoading     = false;
  let lastQuery     = '';

  /* Favorites & Likes — persisted in localStorage */
  function getFavorites() {
    try { return JSON.parse(localStorage.getItem('volt_favorites') || '[]'); } catch { return []; }
  }
  function saveFavorites(arr) {
    localStorage.setItem('volt_favorites', JSON.stringify(arr));
  }
  function isFavorited(id) {
    return getFavorites().some(fav => fav.id === id);
  }
  function toggleFavorite(station) {
    let favs = getFavorites();
    if (favs.some(f => f.id === station.id)) {
      favs = favs.filter(f => f.id !== station.id);
    } else {
      favs = [...favs, { ...station, favoritedAt: Date.now() }];
    }
    saveFavorites(favs);
    return favs.some(f => f.id === station.id);
  }

  function getLikes() {
    try { return JSON.parse(localStorage.getItem('volt_likes') || '{}'); } catch { return {}; }
  }
  function saveLikes(obj) {
    localStorage.setItem('volt_likes', JSON.stringify(obj));
  }
  function getLikeCount(id) {
    const likes = getLikes();
    return likes[id] || 0;
  }
  function toggleLike(id) {
    const likes = getLikes();
    likes[id] = likes[id] ? 0 : 1;
    saveLikes(likes);
    return likes[id];
  }

  /* ─────────────────────────────────────────
     THEME TOGGLE (Dark / Light)
  ───────────────────────────────────────── */
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon   = document.getElementById('theme-icon');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('volt_theme', theme);
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  (function initTheme() {
    const saved = localStorage.getItem('volt_theme') || 'dark';
    applyTheme(saved);
  })();

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ─────────────────────────────────────────
     DOM REFS
  ───────────────────────────────────────── */
  const cityInput       = document.getElementById('city-search-input');
  const searchBtn       = document.getElementById('search-button');
  const skeletonGrid    = document.getElementById('loading-cards');
  const stationGrid     = document.getElementById('station-results');
  const errorState      = document.getElementById('error-message');
  const errorMsg        = document.getElementById('error-description');
  const emptyState      = document.getElementById('no-results-message');
  const summaryBar      = document.getElementById('results-summary');
  const filterSortRow   = document.getElementById('filter-sort-row');
  const loadMoreWrap    = document.getElementById('load-more-section');
  const loadMoreBtn     = document.getElementById('load-more-button');
  const retryBtn        = document.getElementById('try-again-button');
  const filterBtns      = document.querySelectorAll('.filter-button');
  const sortSelect      = document.getElementById('sort-select');
  const keywordBar      = document.getElementById('keyword-search-bar');
  const keywordInput    = document.getElementById('keyword-search-input');
  const keywordClearBtn = document.getElementById('keyword-clear-button');

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
     SKELETON LOADER
  ───────────────────────────────────────── */
  function renderSkeletons(count = PAGE_SIZE) {
    if (!skeletonGrid) return;
    skeletonGrid.innerHTML = Array.from({ length: count })
      .map(() => `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skel skel-title"></div>
          <div class="skel skel-line"></div>
          <div class="skel skel-line short"></div>
          <div class="skel skel-line"></div>
          <div>
            <span class="skel skel-badge"></span>
            <span class="skel skel-badge" style="margin-left:6px"></span>
          </div>
        </div>`)
      .join('');
    showOnly(skeletonGrid);
    setVisible(summaryBar, false);
    setVisible(filterSortRow, false);
    setVisible(loadMoreWrap, false);
    setVisible(keywordBar, false);
  }

  /* ─────────────────────────────────────────
     GEOCODE
  ───────────────────────────────────────── */
  async function geocode(city) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('Could not find that city. Try a different spelling.');
    const data = await res.json();
    if (!data.length) throw new Error(`We couldn't find "${city}". Try a nearby major city.`);
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }

  /* ─────────────────────────────────────────
     FETCH STATIONS
  ───────────────────────────────────────── */
  async function fetchStations(lat, lon) {
    const params = new URLSearchParams({
      key: API_KEY, output: 'json',
      latitude: lat, longitude: lon,
      distance: 25, distanceunit: 'km',
      maxresults: MAX_RESULTS, compact: true, verbose: false,
    });
    const res = await fetch(`${API_BASE}?${params}`);
    if (!res.ok) throw new Error(`API error ${res.status}. Please try again.`);
    return await res.json();
  }

  /* ─────────────────────────────────────────
     PARSE STATION — uses map, filter, some
  ───────────────────────────────────────── */
  function parseStation(item) {
    const addr  = item.AddressInfo || {};
    const conns = item.Connections || [];
    const status = item.StatusType;
    const usage  = item.UsageType;

    const isFast = conns.some(c => c.PowerKW && c.PowerKW >= 20);
    const isFree = usage && usage.IsMembershipRequired === false && usage.IsPayAtLocation === false;

    let statusKey = 'unknown';
    if (status) {
      statusKey = status.IsOperational ? 'open' : 'offline';
    }

    const connTypes = [...new Set(
      conns
        .map(c => c.ConnectionType && c.ConnectionType.Title)
        .filter(Boolean)
        .map(t => t.replace('IEC 62196-2 Type ', 'Type ').replace(' (Mennekes)', ''))
        .slice(0, 3)
    )];

    const maxKw = conns.reduce((max, c) => Math.max(max, c.PowerKW || 0), 0);

    return {
      id: item.ID,
      name: addr.Title || 'Unnamed Station',
      address: [addr.AddressLine1, addr.Town, addr.Country?.ISOCode].filter(Boolean).join(', '),
      lat: addr.Latitude,
      lon: addr.Longitude,
      network: item.OperatorInfo?.Title || 'Independent',
      statusKey, isFast, isFree, connTypes, maxKw,
      numPoints: item.NumberOfPoints || conns.length || '?',
    };
  }

  /* ─────────────────────────────────────────
     RENDER CARD — with favorite & like buttons
  ───────────────────────────────────────── */
  function renderCard(station, index) {
    const statusLabel = { open: '🟢 Open', unknown: '⚪ Unknown', offline: '🔴 Offline' }[station.statusKey];
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
    const fav = isFavorited(station.id);
    const likeCount = getLikeCount(station.id);
    const liked = likeCount > 0;

    const badges = [];
    if (station.isFast) badges.push(`<span class="badge badge-fast">⚡ Fast ${station.maxKw > 0 ? station.maxKw + ' kW' : 'charge'}</span>`);
    else badges.push(`<span class="badge badge-slow">🔌 Standard</span>`);
    if (station.isFree) badges.push(`<span class="badge badge-free">🆓 Free</span>`);
    else badges.push(`<span class="badge badge-pay"> Paid</span>`);
    station.connTypes.forEach(t => badges.push(`<span class="badge badge-conn">${t}</span>`));

    const delay = Math.min(index * 0.04, 0.5);

    return `
      <article class="charging-station-card" style="--delay:${delay}s" data-id="${station.id}">
        <div class="station-status-row">
          <span class="station-status-label ${station.statusKey}">
            <span class="status-indicator-dot ${station.statusKey}"></span>
            ${statusLabel}
          </span>
          <span class="network-name" title="${escHtml(station.network)}">${escHtml(station.network)}</span>
        </div>
        <h2 class="station-name">${escHtml(station.name)}</h2>
        <p class="station-address">${escHtml(station.address)}</p>
        <div class="station-connector-types">${badges.join('')}</div>
        <div class="station-card-footer">
          <div class="charging-points-count">
            <strong>${station.numPoints}</strong>
            ${parseInt(station.numPoints) === 1 ? 'point' : 'points'}
          </div>
          <div class="card-interactions">
            <button class="card-like-btn ${liked ? 'liked' : ''}" data-action="like" data-station-id="${station.id}" aria-label="Like station" title="Like">
              👍 <span class="like-count">${likeCount || ''}</span>
            </button>
            <button class="card-fav-btn ${fav ? 'favorited' : ''}" data-action="favorite" data-station-id="${station.id}" aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}" title="${fav ? 'Unfavorite' : 'Favorite'}">
              ${fav ? '❤️' : '🤍'}
            </button>
            <a class="get-directions-button" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" aria-label="Get directions to ${escHtml(station.name)}">
              📍
            </a>
          </div>
        </div>
      </article>`;
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─────────────────────────────────────────
     SEARCH within results — uses filter + includes
  ───────────────────────────────────────── */
  function applyKeywordSearch(stations, query) {
    if (!query.trim()) return stations;
    const q = query.toLowerCase().trim();
    return stations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.network.toLowerCase().includes(q) ||
      s.connTypes.some(ct => ct.toLowerCase().includes(q))
    );
  }

  /* ─────────────────────────────────────────
     FILTER — uses filter HOF
  ───────────────────────────────────────── */
  function applyFilterLogic(stations, filterKey) {
    const favIds = getFavorites().map(f => f.id);
    return stations.filter(s => {
      if (filterKey === 'fast') return s.isFast;
      if (filterKey === 'free') return s.isFree;
      if (filterKey === 'open') return s.statusKey === 'open';
      if (filterKey === 'favorited') return favIds.includes(s.id);
      return true;
    });
  }

  /* ─────────────────────────────────────────
     SORT — uses sort HOF (toSorted pattern)
  ───────────────────────────────────────── */
  function applySortLogic(stations, sortKey) {
    return [...stations].sort((a, b) => {
      if (sortKey === 'name-asc')    return a.name.localeCompare(b.name);
      if (sortKey === 'name-desc')   return b.name.localeCompare(a.name);
      if (sortKey === 'power-desc')  return b.maxKw - a.maxKw;
      if (sortKey === 'power-asc')   return a.maxKw - b.maxKw;
      if (sortKey === 'points-desc') return (parseInt(b.numPoints) || 0) - (parseInt(a.numPoints) || 0);
      if (sortKey === 'points-asc')  return (parseInt(a.numPoints) || 0) - (parseInt(b.numPoints) || 0);
      return 0;
    });
  }

  /* ─────────────────────────────────────────
     PIPELINE: filter → search → sort → render
     Chains filter(), filter(), sort(), slice(), map(), forEach()
  ───────────────────────────────────────── */
  function applyPipeline() {
    currentPage = 0;
    if (stationGrid) stationGrid.innerHTML = '';

    filtered = applySortLogic(
      applyKeywordSearch(
        applyFilterLogic(allStations, activeFilter),
        keywordQuery
      ),
      activeSort
    );

    if (!filtered.length) {
      showOnly(emptyState);
      setVisible(loadMoreWrap, false);
      return;
    }
    renderPage();
  }

  /* ─────────────────────────────────────────
     UPDATE SUMMARY — uses filter + reduce
  ───────────────────────────────────────── */
  function updateSummary(stations, city) {
    const fastCount = stations.filter(s => s.isFast).length;
    const freeCount = stations.filter(s => s.isFree).length;
    const cityShort = city.split(',')[0].trim();

    document.getElementById('summary-total-count').textContent = stations.length;
    document.getElementById('summary-fast-count').textContent  = fastCount;
    document.getElementById('summary-free-count').textContent  = freeCount;
    document.getElementById('summary-city-name').textContent   = cityShort;
    setVisible(summaryBar, true);
  }

  /* ─────────────────────────────────────────
     RENDER PAGE — uses slice, map, forEach
  ───────────────────────────────────────── */
  function renderPage() {
    const start = currentPage * PAGE_SIZE;
    const page  = filtered.slice(start, start + PAGE_SIZE);

    page.map((station, i) => renderCard(station, start + i))
        .forEach(html => stationGrid.insertAdjacentHTML('beforeend', html));

    showOnly(stationGrid);

    const hasMore = (currentPage + 1) * PAGE_SIZE < filtered.length;
    setVisible(loadMoreWrap, hasMore);
    if (hasMore && loadMoreBtn) {
      loadMoreBtn.disabled    = false;
      loadMoreBtn.textContent = `Load more (${filtered.length - (currentPage + 1) * PAGE_SIZE} remaining)`;
    }
    currentPage++;
  }

  /* ─────────────────────────────────────────
     MAIN SEARCH
  ───────────────────────────────────────── */
  async function search(city) {
    if (!city.trim()) { showToast('Enter a city name first 😊', 'bad'); return; }
    if (isLoading) return;

    isLoading   = true;
    currentCity = city.trim();
    lastQuery   = currentCity;
    keywordQuery = '';
    if (keywordInput) keywordInput.value = '';
    if (cityInput) cityInput.value = currentCity;

    filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    activeFilter = 'all';
    if (sortSelect) { sortSelect.value = 'default'; activeSort = 'default'; }

    renderSkeletons();
    if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = 'Searching…'; }

    try {
      const { lat, lon } = await geocode(currentCity);
      const raw = await fetchStations(lat, lon);

      allStations = raw.map(parseStation);
      filtered    = allStations;
      currentPage = 0;

      if (!allStations.length) {
        showOnly(emptyState);
        setVisible(summaryBar, false);
        setVisible(filterSortRow, false);
        setVisible(keywordBar, false);
        showToast(`No stations found near ${currentCity} 😔`, 'bad');
        return;
      }

      stationGrid.innerHTML = '';
      updateSummary(allStations, currentCity);
      setVisible(filterSortRow, true);
      setVisible(keywordBar, true);
      renderPage();

      /* Save search to history */
      saveToHistory(currentCity);

      showToast(`Found ${allStations.length} stations near ${currentCity.split(',')[0]} ⚡`, 'ok');

    } catch (err) {
      showOnly(errorState);
      setVisible(summaryBar, false);
      setVisible(filterSortRow, false);
      setVisible(keywordBar, false);
      if (errorMsg) errorMsg.textContent = err.message || 'Something went wrong.';
      console.error('[VoltDash]', err);
    } finally {
      isLoading = false;
      if (searchBtn) { searchBtn.disabled = false; searchBtn.textContent = 'Search ⚡'; }
    }
  }

  /* ─────────────────────────────────────────
     SEARCH HISTORY — persisted in localStorage
     Uses filter, slice, map
  ───────────────────────────────────────── */
  function saveToHistory(city) {
    let history = getHistory();
    history = history.filter(h => h.city.toLowerCase() !== city.toLowerCase());
    history = [{ city, timestamp: Date.now() }, ...history].slice(0, 20);
    localStorage.setItem('volt_history', JSON.stringify(history));
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem('volt_history') || '[]'); } catch { return []; }
  }

  /* ─────────────────────────────────────────
     TOAST
  ───────────────────────────────────────── */
  function showToast(msg, type = '') {
    if (typeof toast === 'function') {
      toast(msg, type);
    } else {
      const el = document.getElementById('notification-toast');
      if (!el) return;
      el.innerHTML  = msg;
      el.className  = `toast show ${type}`;
      setTimeout(() => el.classList.remove('show'), 4200);
    }
  }

  /* ─────────────────────────────────────────
     CARD INTERACTION DELEGATION
     (favorite + like buttons)
  ───────────────────────────────────────── */
  if (stationGrid) {
    stationGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const stationId = parseInt(btn.dataset.stationId);
      const action    = btn.dataset.action;

      if (action === 'favorite') {
        const station = allStations.find(s => s.id === stationId);
        if (!station) return;
        const nowFav = toggleFavorite(station);
        btn.classList.toggle('favorited', nowFav);
        btn.innerHTML = nowFav ? '❤️' : '🤍';
        btn.setAttribute('aria-label', nowFav ? 'Remove from favorites' : 'Add to favorites');
        showToast(nowFav ? 'Added to favorites ❤️' : 'Removed from favorites', nowFav ? 'ok' : '');

        if (activeFilter === 'favorited') {
          applyPipeline();
        }
      }

      if (action === 'like') {
        const isLiked = toggleLike(stationId);
        btn.classList.toggle('liked', !!isLiked);
        const countSpan = btn.querySelector('.like-count');
        if (countSpan) countSpan.textContent = isLiked ? '1' : '';
        showToast(isLiked ? 'Liked! 👍' : 'Unliked', isLiked ? 'ok' : '');
      }
    });
  }

  /* ─────────────────────────────────────────
     EVENT LISTENERS
  ───────────────────────────────────────── */

  if (searchBtn) searchBtn.addEventListener('click', () => search(cityInput.value));
  if (cityInput) cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(cityInput.value); });

  /* Filters — uses forEach */
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyPipeline();
    });
  });

  /* Sort */
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      activeSort = sortSelect.value;
      applyPipeline();
    });
  }

  /* Keyword search — uses filter + includes */
  if (keywordInput) {
    let debounce;
    keywordInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        keywordQuery = keywordInput.value;
        setVisible(keywordClearBtn, !!keywordQuery.trim());
        applyPipeline();
      }, 250);
    });
  }
  if (keywordClearBtn) {
    keywordClearBtn.addEventListener('click', () => {
      keywordInput.value = '';
      keywordQuery = '';
      setVisible(keywordClearBtn, false);
      applyPipeline();
    });
  }

  /* Load more */
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading…';
      setTimeout(() => renderPage(), 300);
    });
  }

  /* Retry */
  if (retryBtn) {
    retryBtn.addEventListener('click', () => search(lastQuery || currentCity));
  }

  /* ─────────────────────────────────────────
     AUTO-LOAD
  ───────────────────────────────────────── */
  function autoLoad() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude: lat, longitude: lon } = pos.coords;
            const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || 'Delhi';
            if (cityInput) cityInput.value = city;
            search(city);
          } catch { search('Delhi'); }
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
    getFavorites,
    getHistory,
  };

  if (document.getElementById('city-search-input')) {
    autoLoad();
  }

})();
