/* ================================================
   favorites.js
   VoltNavigator — Favorites & History Page
   ------------------------------------------------
   Features (ALL using Array Higher-Order Functions):
     1. Search     — filter favorites by keyword (filter + includes)
     2. Filtering  — fast / free / open (filter)
     3. Sorting    — newest / oldest / name / power (sort)
     4. Interactions — unfavorite ❤️, like 👍, delete history
     5. Dark/Light — theme toggle (shared logic)

   Array HOFs used: map, filter, sort, find, some,
                    forEach, reduce, slice, includes
================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     LOCAL STORAGE HELPERS
     (same keys as dashboard.js)
  ───────────────────────────────────────── */
  function getFavorites() {
    try { return JSON.parse(localStorage.getItem('volt_favorites') || '[]'); } catch { return []; }
  }
  function saveFavorites(arr) {
    localStorage.setItem('volt_favorites', JSON.stringify(arr));
  }
  function removeFavorite(id) {
    const favs = getFavorites().filter(f => f.id !== id);
    saveFavorites(favs);
    return favs;
  }
  function clearAllFavorites() {
    localStorage.setItem('volt_favorites', '[]');
  }

  function getLikes() {
    try { return JSON.parse(localStorage.getItem('volt_likes') || '{}'); } catch { return {}; }
  }
  function saveLikes(obj) {
    localStorage.setItem('volt_likes', JSON.stringify(obj));
  }
  function getLikeCount(id) {
    return getLikes()[id] || 0;
  }
  function toggleLike(id) {
    const likes = getLikes();
    likes[id] = likes[id] ? 0 : 1;
    saveLikes(likes);
    return likes[id];
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem('volt_history') || '[]'); } catch { return []; }
  }
  function saveHistory(arr) {
    localStorage.setItem('volt_history', JSON.stringify(arr));
  }
  function removeHistoryItem(city) {
    const history = getHistory().filter(h => h.city !== city);
    saveHistory(history);
    return history;
  }
  function clearAllHistory() {
    localStorage.setItem('volt_history', '[]');
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
    applyTheme(localStorage.getItem('volt_theme') || 'dark');
  })();

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ─────────────────────────────────────────
     STATE
  ───────────────────────────────────────── */
  let activeTab       = 'favorites';
  let favSearchQuery  = '';
  let favFilter       = 'all';
  let favSort         = 'newest';

  /* ─────────────────────────────────────────
     DOM REFS
  ───────────────────────────────────────── */
  const favPanel        = document.getElementById('favorites-panel');
  const histPanel       = document.getElementById('history-panel');
  const tabFav          = document.getElementById('tab-favorites');
  const tabHist         = document.getElementById('tab-history');
  const favGrid         = document.getElementById('fav-grid');
  const favEmpty        = document.getElementById('fav-empty');
  const favToolbar      = document.getElementById('fav-toolbar');
  const favStatsRow     = document.getElementById('fav-stats-row');
  const favActionsRow   = document.getElementById('fav-actions-row');
  const favSearchInput  = document.getElementById('fav-search-input');
  const favSearchClear  = document.getElementById('fav-search-clear');
  const favSortSelect   = document.getElementById('fav-sort-select');
  const favFilterBtns   = document.querySelectorAll('[data-fav-filter]');
  const favClearAllBtn  = document.getElementById('fav-clear-all');
  const favTabCount     = document.getElementById('favorites-tab-count');
  const histTabCount    = document.getElementById('history-tab-count');
  const histList        = document.getElementById('history-list');
  const histEmpty       = document.getElementById('history-empty');
  const histActionsRow  = document.getElementById('history-actions-row');
  const histClearAllBtn = document.getElementById('history-clear-all');

  /* ─────────────────────────────────────────
      TABS
  ───────────────────────────────────────── */
  function switchTab(tab) {
    activeTab = tab;
    [tabFav, tabHist].forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    tabFav.setAttribute('aria-selected', String(tab === 'favorites'));
    tabHist.setAttribute('aria-selected', String(tab === 'history'));

    if (tab === 'favorites') {
      favPanel.hidden  = false;
      histPanel.hidden = true;
      renderFavorites();
    } else {
      favPanel.hidden  = true;
      histPanel.hidden = false;
      renderHistory();
    }
  }

  if (tabFav)  tabFav.addEventListener('click', () => switchTab('favorites'));
  if (tabHist) tabHist.addEventListener('click', () => switchTab('history'));

  /* ─────────────────────────────────────────
     FAVORITES PIPELINE
     filter → search → sort → render
     All using Array Higher-Order Functions
  ───────────────────────────────────────── */

  /* SEARCH — uses filter + includes */
  function searchFavorites(favs, query) {
    if (!query.trim()) return favs;
    const q = query.toLowerCase().trim();
    return favs.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.network.toLowerCase().includes(q) ||
      (s.connTypes || []).some(ct => ct.toLowerCase().includes(q))
    );
  }

  /* FILTER — uses filter */
  function filterFavorites(favs, filterKey) {
    return favs.filter(s => {
      if (filterKey === 'fast') return s.isFast;
      if (filterKey === 'free') return s.isFree;
      if (filterKey === 'open') return s.statusKey === 'open';
      return true;
    });
  }

  /* SORT — uses sort */
  function sortFavorites(favs, sortKey) {
    return [...favs].sort((a, b) => {
      if (sortKey === 'newest')    return (b.favoritedAt || 0) - (a.favoritedAt || 0);
      if (sortKey === 'oldest')    return (a.favoritedAt || 0) - (b.favoritedAt || 0);
      if (sortKey === 'name-asc')  return a.name.localeCompare(b.name);
      if (sortKey === 'name-desc') return b.name.localeCompare(a.name);
      if (sortKey === 'power-desc') return (b.maxKw || 0) - (a.maxKw || 0);
      return 0;
    });
  }

  /* RENDER CARD — uses same card pattern as dashboard */
  function renderFavCard(station, index) {
    const statusLabel = { open: '🟢 Open', unknown: '⚪ Unknown', offline: '🔴 Offline' }[station.statusKey] || '⚪ Unknown';
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
    const likeCount = getLikeCount(station.id);
    const liked = likeCount > 0;

    const badges = [];
    if (station.isFast) badges.push(`<span class="badge badge-fast">⚡ Fast ${station.maxKw > 0 ? station.maxKw + ' kW' : ''}</span>`);
    else badges.push(`<span class="badge badge-slow">🔌 Standard</span>`);
    if (station.isFree) badges.push(`<span class="badge badge-free">🆓 Free</span>`);
    else badges.push(`<span class="badge badge-pay">💳 Paid</span>`);
    (station.connTypes || []).forEach(t => badges.push(`<span class="badge badge-conn">${esc(t)}</span>`));

    const delay = Math.min(index * 0.05, 0.5);

    return `
      <article class="charging-station-card" style="--delay:${delay}s" data-id="${station.id}">
        <div class="station-status-row">
          <span class="station-status-label ${station.statusKey}">
            <span class="status-indicator-dot ${station.statusKey}"></span>
            ${statusLabel}
          </span>
          <span class="network-name" title="${esc(station.network)}">${esc(station.network)}</span>
        </div>
        <h2 class="station-name">${esc(station.name)}</h2>
        <p class="station-address">${esc(station.address)}</p>
        <div class="station-connector-types">${badges.join('')}</div>
        <div class="station-card-footer">
          <div class="charging-points-count">
            <strong>${station.numPoints || '?'}</strong>
            ${parseInt(station.numPoints) === 1 ? 'point' : 'points'}
          </div>
          <div class="card-interactions">
            <button class="card-like-btn ${liked ? 'liked' : ''}" data-action="like" data-station-id="${station.id}" aria-label="Like" title="Like">
              👍 <span class="like-count">${likeCount || ''}</span>
            </button>
            <button class="card-fav-btn favorited" data-action="unfavorite" data-station-id="${station.id}" aria-label="Remove from favorites" title="Unfavorite">
              ❤️
            </button>
            <a class="get-directions-button" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" aria-label="Directions">
              📍
            </a>
          </div>
        </div>
      </article>`;
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─────────────────────────────────────────
     RENDER FAVORITES
     Uses: filter, filter, sort, map, forEach, reduce
  ───────────────────────────────────────── */
  function renderFavorites() {
    const allFavs = getFavorites();

    /* Update counts using reduce */
    const counts = allFavs.reduce((acc, s) => {
      acc.total++;
      if (s.isFast) acc.fast++;
      if (s.isFree) acc.free++;
      return acc;
    }, { total: 0, fast: 0, free: 0 });

    if (favTabCount) favTabCount.textContent = counts.total;
    document.getElementById('fav-count-total').textContent = counts.total;
    document.getElementById('fav-count-fast').textContent  = counts.fast;
    document.getElementById('fav-count-free').textContent  = counts.free;

    if (!allFavs.length) {
      favEmpty.hidden     = false;
      favGrid.innerHTML   = '';
      favToolbar.style.display   = 'none';
      favStatsRow.style.display  = 'none';
      favActionsRow.hidden = true;
      return;
    }

    favToolbar.style.display  = '';
    favStatsRow.style.display = '';
    favEmpty.hidden            = true;

    /* Pipeline: filter → search → sort */
    const result = sortFavorites(
      searchFavorites(
        filterFavorites(allFavs, favFilter),
        favSearchQuery
      ),
      favSort
    );

    if (!result.length) {
      favGrid.innerHTML = `
        <div class="fav-empty" style="grid-column:1/-1">
          <div class="fav-empty-icon">🔍</div>
          <h2 class="fav-empty-title">No matches</h2>
          <p class="fav-empty-message">Try a different search or remove filters.</p>
        </div>`;
      favActionsRow.hidden = true;
      return;
    }

    favGrid.innerHTML = result
      .map((station, i) => renderFavCard(station, i))
      .join('');

    favActionsRow.hidden = false;
  }

  /* ─────────────────────────────────────────
     RENDER HISTORY
     Uses: map, filter, forEach
  ───────────────────────────────────────── */
  function renderHistory() {
    const history = getHistory();
    if (histTabCount) histTabCount.textContent = history.length;

    if (!history.length) {
      histEmpty.hidden = false;
      histList.innerHTML = '';
      histActionsRow.hidden = true;
      return;
    }

    histEmpty.hidden = true;
    histActionsRow.hidden = false;

    histList.innerHTML = history
      .map((item, i) => {
        const time = timeAgo(item.timestamp);
        const delay = Math.min(i * 0.04, 0.4);
        return `
          <div class="history-item" style="--delay:${delay}s" data-city="${esc(item.city)}">
            <div class="history-item-icon">📍</div>
            <div class="history-item-details">
              <div class="history-item-city">${esc(item.city)}</div>
              <div class="history-item-time">${time}</div>
            </div>
            <button class="history-item-delete" data-action="delete-history" data-city="${esc(item.city)}" aria-label="Remove from history" title="Remove">✕</button>
            <span class="history-item-arrow">→</span>
          </div>`;
      })
      .join('');
  }

  /* Time ago helper — pure function */
  function timeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    const intervals = [
      { label: 'year',   seconds: 31536000 },
      { label: 'month',  seconds: 2592000 },
      { label: 'week',   seconds: 604800 },
      { label: 'day',    seconds: 86400 },
      { label: 'hour',   seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ];
    const match = intervals.find(i => seconds >= i.seconds);
    if (!match) return 'Just now';
    const count = Math.floor(seconds / match.seconds);
    return `${count} ${match.label}${count > 1 ? 's' : ''} ago`;
  }

  /* ─────────────────────────────────────────
     EVENT DELEGATION — card interactions
  ───────────────────────────────────────── */
  if (favGrid) {
    favGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const stationId = parseInt(btn.dataset.stationId);
      const action    = btn.dataset.action;

      if (action === 'unfavorite') {
        removeFavorite(stationId);
        renderFavorites();
        showToast('Removed from favorites', '');
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

  /* History interactions */
  if (histList) {
    histList.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-action="delete-history"]');
      if (delBtn) {
        e.stopPropagation();
        removeHistoryItem(delBtn.dataset.city);
        renderHistory();
        showToast('Removed from history', '');
        return;
      }

      const item = e.target.closest('.history-item');
      if (item) {
        window.location.href = `dashboard.html?city=${encodeURIComponent(item.dataset.city)}`;
      }
    });
  }

  /* ─────────────────────────────────────────
     SEARCH FAVORITES — uses filter + includes
  ───────────────────────────────────────── */
  if (favSearchInput) {
    let debounce;
    favSearchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        favSearchQuery = favSearchInput.value;
        if (favSearchClear) favSearchClear.hidden = !favSearchQuery.trim();
        renderFavorites();
      }, 200);
    });
  }
  if (favSearchClear) {
    favSearchClear.addEventListener('click', () => {
      favSearchInput.value = '';
      favSearchQuery = '';
      favSearchClear.hidden = true;
      renderFavorites();
    });
  }

  /* Filter buttons — forEach */
  favFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      favFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      favFilter = btn.dataset.favFilter;
      renderFavorites();
    });
  });

  /* Sort — uses sort */
  if (favSortSelect) {
    favSortSelect.addEventListener('change', () => {
      favSort = favSortSelect.value;
      renderFavorites();
    });
  }

  /* Clear all favorites */
  if (favClearAllBtn) {
    favClearAllBtn.addEventListener('click', () => {
      if (confirm('Remove all favorites? This can\'t be undone.')) {
        clearAllFavorites();
        renderFavorites();
        showToast('All favorites cleared 🗑️', '');
      }
    });
  }

  /* Clear all history */
  if (histClearAllBtn) {
    histClearAllBtn.addEventListener('click', () => {
      if (confirm('Clear all search history?')) {
        clearAllHistory();
        renderHistory();
        showToast('History cleared 🗑️', '');
      }
    });
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
      el.innerHTML = msg;
      el.className = `toast show ${type}`;
      setTimeout(() => el.classList.remove('show'), 4200);
    }
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    const favs = getFavorites();
    const hist = getHistory();
    if (favTabCount) favTabCount.textContent = favs.length;
    if (histTabCount) histTabCount.textContent = hist.length;
    renderFavorites();
  }

  init();

})();
