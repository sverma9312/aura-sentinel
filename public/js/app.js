/**
 * AURA SENTINEL — Multi-Region Client Application Controller
 * Manages UI state, data fetching for INDIA (NSE/BSE) and GLOBAL markets,
 * 1-hour auto-sync countdown, oscilloscope canvas chart, autocomplete, and watchlist persistence.
 */

(function () {
  'use strict';

  // Default Demo Users Database
  const DEFAULT_USERS = [
    {
      email: 'analyst@aura.capital',
      password: 'sentinel2026',
      name: 'Senior Financial Architect',
      org: 'Aura Capital Markets',
      role: 'TIER-1 MACRO STRATEGIST',
      theme: 'dark'
    }
  ];

  // State
  const state = {
    currentUser: null,
    currentTheme: 'dark',
    currentRegion: 'india', // Defaults to India as primary operating location
    currentTimeframe: { range: '1mo', interval: '1d', label: '1-MONTH' },
    macroOverview: null,
    stockOpportunities: [],
    incidentWire: [],
    lastUpdated: null,
    nextRefresh: null,
    currentTab: 'tab-macro',
    currentStockFilter: 'all',
    wireFilterQuery: '',
    selectedStock: null,
    watchlist: JSON.parse(localStorage.getItem('aura_sentinel_watchlist') || '["HAL.NS", "BEL.NS", "RELIANCE.NS", "TATAPOWER.NS"]'),
    countdownInterval: null,
    isRefreshing: false
  };

  // Quick Catalyst Sets
  const REGION_CHIPS = {
    india: [
      { label: 'HAL', symbol: 'HAL.NS' },
      { label: 'BEL', symbol: 'BEL.NS' },
      { label: 'RELIANCE', symbol: 'RELIANCE.NS' },
      { label: 'TATA POWER', symbol: 'TATAPOWER.NS' },
      { label: 'L&T', symbol: 'LT.NS' },
      { label: 'TCS', symbol: 'TCS.NS' },
      { label: 'HDFC BANK', symbol: 'HDFCBANK.NS' },
      { label: 'IREDA', symbol: 'IREDA.NS' }
    ],
    global: [
      { label: 'NVDA', symbol: 'NVDA' },
      { label: 'LMT', symbol: 'LMT' },
      { label: 'CCJ', symbol: 'CCJ' },
      { label: 'TSM', symbol: 'TSM' },
      { label: 'XOM', symbol: 'XOM' },
      { label: 'PLTR', symbol: 'PLTR' },
      { label: 'NVO', symbol: 'NVO' }
    ]
  };

  // DOM Elements
  const el = {
    masterLed: document.getElementById('master-led'),
    btnRegIndia: document.getElementById('btn-reg-india'),
    btnRegGlobal: document.getElementById('btn-reg-global'),
    ledRegIndia: document.getElementById('led-reg-india'),
    ledRegGlobal: document.getElementById('led-reg-global'),
    macroGaugeTitle: document.getElementById('macro-gauge-title'),
    macroNeedle: document.getElementById('macro-needle'),
    globalScoreLcd: document.getElementById('global-score-lcd'),
    timerMinutes: document.getElementById('timer-minutes'),
    timerSeconds: document.getElementById('timer-seconds'),
    nextRefreshLabel: document.getElementById('next-refresh-label'),
    btnForceRefresh: document.getElementById('btn-force-refresh'),
    ledLive: document.getElementById('led-live'),
    ledBusy: document.getElementById('led-busy'),
    audioToggle: document.getElementById('audio-toggle'),
    
    // Search
    searchInput: document.getElementById('ticker-search-input'),
    btnSearchClear: document.getElementById('btn-search-clear'),
    btnSearchSubmit: document.getElementById('btn-search-submit'),
    autocompleteDropdown: document.getElementById('search-autocomplete-dropdown'),
    quickTagsContainer: document.getElementById('quick-tags-container'),
    
    // Rocker Navigation
    rockerTabs: document.querySelectorAll('.rocker-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    wireCounter: document.getElementById('wire-counter'),
    watchlistCounter: document.getElementById('watchlist-counter'),
    
    // Macro Radar (Tab 1)
    macroRadarHeading: document.getElementById('macro-radar-heading'),
    macroRadarSubtext: document.getElementById('macro-radar-subtext'),
    statArticles: document.getElementById('stat-articles'),
    statStance: document.getElementById('stat-stance'),
    statUpdated: document.getElementById('stat-updated'),
    sectorsContainer: document.getElementById('sectors-container'),
    
    // Stock Opportunities (Tab 2)
    stockSectorFilters: document.getElementById('stock-sector-filters'),
    stockCardsContainer: document.getElementById('stock-cards-container'),
    
    // Deep Dive (Tab 3)
    deepdiveEmptyState: document.getElementById('deepdive-empty-state'),
    deepdiveActivePanel: document.getElementById('deepdive-active-panel'),
    deepdivePopularSuggestions: document.getElementById('deepdive-popular-suggestions'),
    ddSymbol: document.getElementById('dd-symbol'),
    ddName: document.getElementById('dd-name'),
    ddSector: document.getElementById('dd-sector'),
    ddSubsector: document.getElementById('dd-subsector'),
    ddPrice: document.getElementById('dd-price'),
    ddChange: document.getElementById('dd-change'),
    ddWatchlistBtn: document.getElementById('dd-watchlist-btn'),
    oscilloscopeCanvas: document.getElementById('oscilloscope-canvas'),
    ddNeedle: document.getElementById('dd-needle'),
    ddSentimentScore: document.getElementById('dd-sentiment-score'),
    ddSentimentLabel: document.getElementById('dd-sentiment-label'),
    ddBullCount: document.getElementById('dd-bull-count'),
    ddBearCount: document.getElementById('dd-bear-count'),
    ddConfidence: document.getElementById('dd-confidence'),
    ddThesis: document.getElementById('dd-thesis'),
    ddRisks: document.getElementById('dd-risks'),
    ddMacro: document.getElementById('dd-macro'),
    ddNewsCount: document.getElementById('dd-news-count'),
    ddNewsList: document.getElementById('dd-news-list'),
    
    // Incident Wire (Tab 4)
    wireFilterInput: document.getElementById('wire-filter-input'),
    incidentWireContainer: document.getElementById('incident-wire-container'),
    
    // Watchlist (Tab 5)
    watchlistContainer: document.getElementById('watchlist-container'),
    btnClearWatchlist: document.getElementById('btn-clear-watchlist')
  };

  // =========================================================================
  // INITIALIZATION & AUTH CHECK
  // =========================================================================
  async function init() {
    setupAuthDatabase();
    setupEventListeners();
    renderRegionControls();
    updateWatchlistBadge();

    // Check Authentication Session
    const authenticated = checkAuthSession();
    if (authenticated) {
      // Fetch intelligence for authenticated user
      await fetchAllIntelligence();
      startCountdownEngine();
    }
  }

  // =========================================================================
  // AUTHENTICATION & SESSION MANAGEMENT
  // =========================================================================
  function setupAuthDatabase() {
    if (!localStorage.getItem('aura_sentinel_users')) {
      localStorage.setItem('aura_sentinel_users', JSON.stringify(DEFAULT_USERS));
    }
  }

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem('aura_sentinel_users')) || DEFAULT_USERS;
    } catch (e) {
      return DEFAULT_USERS;
    }
  }

  function checkAuthSession() {
    const savedSession = localStorage.getItem('aura_sentinel_session');
    const authModal = document.getElementById('auth-modal');

    if (savedSession) {
      try {
        const user = JSON.parse(savedSession);
        state.currentUser = user;
        applyTheme(user.theme || 'dark');
        updateHeaderUserUI(user);
        if (authModal) authModal.classList.add('hidden');
        return true;
      } catch (e) {
        localStorage.removeItem('aura_sentinel_session');
      }
    }

    // Not authenticated -> show security vault gate
    state.currentUser = null;
    applyTheme('dark');
    if (authModal) authModal.classList.remove('hidden');
    return false;
  }

  function loginUser(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);

    if (!user) {
      showAuthToast('INVALID SECURITY CREDENTIALS. ACCESS DENIED.', 'error');
      if (window.tactileAudio) window.tactileAudio.playRelaySnap();
      return false;
    }

    state.currentUser = user;
    localStorage.setItem('aura_sentinel_session', JSON.stringify(user));
    applyTheme(user.theme || 'dark');
    updateHeaderUserUI(user);

    showAuthToast('ACCESS GRANTED. DECRYPTING TERMINAL...', 'success');
    if (window.tactileAudio) window.tactileAudio.playRelaySnap();

    setTimeout(() => {
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.add('hidden');
      fetchAllIntelligence();
      startCountdownEngine();
    }, 600);

    return true;
  }

  function registerUser(name, org, email, password) {
    const users = getUsers();
    const exists = users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());

    if (exists) {
      showAuthToast('USER WITH THIS EMAIL ALREADY REGISTERED. PLEASE LOG IN.', 'error');
      return false;
    }

    const newUser = {
      name: name.trim(),
      org: org.trim() || 'Aura Capital Markets',
      email: email.trim().toLowerCase(),
      password,
      role: 'TIER-1 MACRO ANALYST',
      theme: state.currentTheme || 'dark',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('aura_sentinel_users', JSON.stringify(users));

    // Automatically log in newly created user
    loginUser(newUser.email, newUser.password);
    return true;
  }

  function logoutUser() {
    state.currentUser = null;
    localStorage.removeItem('aura_sentinel_session');
    
    // Close settings modal if open
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden');

    // Show Auth Gate
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.classList.remove('hidden');

    if (window.tactileAudio) window.tactileAudio.playRelaySnap();
  }

  function updateHeaderUserUI(user) {
    if (!user) return;
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    const avatarEl = document.getElementById('header-user-avatar');
    const profName = document.getElementById('profile-name');
    const profEmail = document.getElementById('profile-email');
    const profOrg = document.getElementById('profile-org');

    if (nameEl) nameEl.textContent = user.name.toUpperCase();
    if (roleEl) roleEl.textContent = user.org ? user.org.toUpperCase() : 'AURA CAPITAL';
    if (avatarEl) {
      const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      avatarEl.textContent = initials || 'SA';
    }

    if (profName) profName.textContent = user.name;
    if (profEmail) profEmail.textContent = user.email;
    if (profOrg) profOrg.textContent = user.org || 'Aura Capital Markets';
  }

  function showAuthToast(msg, type = 'error') {
    const toast = document.getElementById('auth-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `auth-msg-toast ${type}`;
    toast.classList.remove('hidden');
  }

  // =========================================================================
  // THEME ENGINE (DARK OBSIDIAN vs BRIGHT PLATINUM)
  // =========================================================================
  function applyTheme(themeName) {
    state.currentTheme = themeName;
    const isBright = themeName === 'bright';

    if (isBright) {
      document.body.classList.add('theme-bright');
    } else {
      document.body.classList.remove('theme-bright');
    }

    // Update active state in Settings Modal
    const cardDark = document.getElementById('theme-card-dark');
    const cardBright = document.getElementById('theme-card-bright');
    if (cardDark) cardDark.classList.toggle('active', !isBright);
    if (cardBright) cardBright.classList.toggle('active', isBright);

    // Save in user profile if logged in
    if (state.currentUser) {
      state.currentUser.theme = themeName;
      localStorage.setItem('aura_sentinel_session', JSON.stringify(state.currentUser));

      // Update in users database
      const users = getUsers();
      const uIdx = users.findIndex(u => u.email === state.currentUser.email);
      if (uIdx > -1) {
        users[uIdx].theme = themeName;
        localStorage.setItem('aura_sentinel_users', JSON.stringify(users));
      }
    }

    // Redraw Oscilloscope Canvas for new theme colors
    if (state.selectedStock && state.selectedStock.quote) {
      const isIndia = state.selectedStock.symbol.endsWith('.NS') || state.selectedStock.quote.currency === 'INR';
      setTimeout(() => drawOscilloscopeChart(state.selectedStock.quote.sparkline || [], isIndia ? '₹' : '$', state.currentTimeframe.range), 50);
    }
  }

  // =========================================================================
  // REGION CONTROLS (INDIA VS GLOBAL)
  // =========================================================================
  function renderRegionControls() {
    const isIndia = state.currentRegion === 'india';

    el.btnRegIndia.classList.toggle('active', isIndia);
    el.ledRegIndia.classList.toggle('active', isIndia);
    el.btnRegGlobal.classList.toggle('active', !isIndia);
    el.ledRegGlobal.classList.toggle('active', !isIndia);

    el.macroGaugeTitle.textContent = isIndia ? 'INDIA MARKET MOOD' : 'GLOBAL MARKET MOOD';
    el.macroRadarHeading.textContent = isIndia ? 'INDIA MARKET PULSE & SECTOR OUTLOOK' : 'GLOBAL MARKET PULSE & SECTOR OUTLOOK';
    el.macroRadarSubtext.textContent = isIndia 
      ? 'Live macroeconomic overview, RBI policy updates, budget outlays, and sector momentum flows synthesized into clear investment themes.'
      : 'Live global macroeconomic overview, central bank policy updates, international trade flows, and sector momentum.';

    el.searchInput.placeholder = isIndia
      ? 'SEARCH INDIAN EQUITIES (e.g. HAL, RELIANCE, TCS, TATAPOWER, LT, HDFCBANK)...'
      : 'SEARCH GLOBAL EQUITIES (e.g. NVDA, LMT, CCJ, TSM, XOM, AAPL, TSLA)...';

    // Render Quick Tags
    renderQuickTags();

    // Render Sector Filters on Tab 2
    renderSectorFilterButtons();

    // Render Deep Dive Suggestions
    renderDeepDiveSuggestions();
  }

  function renderQuickTags() {
    el.quickTagsContainer.innerHTML = '<span class="tag-title">KEY CATALYSTS:</span>';
    const chips = REGION_CHIPS[state.currentRegion] || [];

    chips.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'quick-chip';
      btn.textContent = c.label;
      btn.setAttribute('data-symbol', c.symbol);
      btn.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        loadStockDeepDive(c.symbol);
      });
      el.quickTagsContainer.appendChild(btn);
    });
  }

  function renderSectorFilterButtons() {
    const isIndia = state.currentRegion === 'india';
    const filters = isIndia ? [
      { id: 'all', label: 'ALL SECTORS' },
      { id: 'defense_india', label: 'DEFENSE & MAKE IN INDIA' },
      { id: 'energy_india', label: 'POWER & RENEWABLES' },
      { id: 'industrials_india', label: 'INFRA & RAIL' },
      { id: 'financials_india', label: 'BANKING & NBFC' },
      { id: 'technology_india', label: 'IT & AI EXPORT' },
      { id: 'auto_india', label: 'AUTO & EV' }
    ] : [
      { id: 'all', label: 'ALL SECTORS' },
      { id: 'technology', label: 'TECH & CHIPS' },
      { id: 'defense', label: 'DEFENSE & AERO' },
      { id: 'energy', label: 'ENERGY & NUCLEAR' },
      { id: 'healthcare', label: 'BIOPHARMA' },
      { id: 'industrials', label: 'SUPPLY CHAINS' }
    ];

    el.stockSectorFilters.innerHTML = '';
    filters.forEach(f => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${state.currentStockFilter === f.id ? 'active' : ''}`;
      btn.textContent = f.label;
      btn.setAttribute('data-filter', f.id);
      btn.addEventListener('click', () => {
        el.stockSectorFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentStockFilter = f.id;
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        renderStockOpportunities();
      });
      el.stockSectorFilters.appendChild(btn);
    });
  }

  function renderDeepDiveSuggestions() {
    el.deepdivePopularSuggestions.innerHTML = '';
    const isIndia = state.currentRegion === 'india';
    const samples = isIndia ? [
      { label: 'Analyze HAL (HAL.NS)', symbol: 'HAL.NS' },
      { label: 'Analyze BEL (BEL.NS)', symbol: 'BEL.NS' },
      { label: 'Analyze Reliance (RELIANCE.NS)', symbol: 'RELIANCE.NS' },
      { label: 'Analyze Tata Power (TATAPOWER.NS)', symbol: 'TATAPOWER.NS' },
      { label: 'Analyze L&T (LT.NS)', symbol: 'LT.NS' }
    ] : [
      { label: 'Analyze NVIDIA (NVDA)', symbol: 'NVDA' },
      { label: 'Analyze Lockheed (LMT)', symbol: 'LMT' },
      { label: 'Analyze Cameco (CCJ)', symbol: 'CCJ' },
      { label: 'Analyze ASML (ASML)', symbol: 'ASML' }
    ];

    samples.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'btn-sample-pick';
      btn.textContent = s.label;
      btn.setAttribute('data-symbol', s.symbol);
      btn.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        loadStockDeepDive(s.symbol);
      });
      el.deepdivePopularSuggestions.appendChild(btn);
    });
  }

  // =========================================================================
  // API FETCHING & DATA BINDING
  // =========================================================================
  async function fetchAllIntelligence(isManualRefresh = false) {
    if (state.isRefreshing) return;
    state.isRefreshing = true;

    setLoadingState(true);

    try {
      const reg = state.currentRegion;

      if (isManualRefresh) {
        await fetch(`/api/refresh?region=${reg}`, { method: 'POST' });
      }

      const [macroRes, stocksRes, wireRes] = await Promise.all([
        fetch(`/api/macro-overview?region=${reg}`).then(r => r.json()),
        fetch(`/api/stock-opportunities?region=${reg}`).then(r => r.json()),
        fetch(`/api/incident-wire?region=${reg}`).then(r => r.json())
      ]);

      if (macroRes.success) {
        state.macroOverview = macroRes.data;
        state.lastUpdated = macroRes.lastUpdated;
        state.nextRefresh = macroRes.nextRefresh;
      }

      if (stocksRes.success) {
        state.stockOpportunities = stocksRes.data || [];
      }

      if (wireRes.success) {
        state.incidentWire = wireRes.data || [];
      }

      // Render Views
      renderHeaderMetrics();
      renderMacroRadar();
      renderStockOpportunities();
      renderIncidentWire();
      renderWatchlist();

      if (state.selectedStock) {
        loadStockDeepDive(state.selectedStock.symbol || state.selectedStock.ticker, false);
      }
    } catch (err) {
      console.error('Failed to fetch macro intelligence:', err);
    } finally {
      state.isRefreshing = false;
      setLoadingState(false);
    }
  }

  function setLoadingState(loading) {
    if (loading) {
      el.ledLive.classList.remove('active');
      el.ledBusy.classList.add('active');
      el.btnForceRefresh.classList.add('depressed');
    } else {
      el.ledLive.classList.add('active');
      el.ledBusy.classList.remove('active');
      el.btnForceRefresh.classList.remove('depressed');
    }
  }

  // =========================================================================
  // 1-HOUR COUNTDOWN & AUTO-SYNC ENGINE
  // =========================================================================
  function startCountdownEngine() {
    if (state.countdownInterval) clearInterval(state.countdownInterval);

    state.countdownInterval = setInterval(() => {
      if (!state.nextRefresh) return;

      const now = new Date().getTime();
      const target = new Date(state.nextRefresh).getTime();
      const diffMs = target - now;

      if (diffMs <= 0) {
        el.timerMinutes.textContent = '00';
        el.timerSeconds.textContent = '00';
        if (window.tactileAudio) window.tactileAudio.playRelaySnap();
        fetchAllIntelligence(true);
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;

      el.timerMinutes.textContent = String(minutes).padStart(2, '0');
      el.timerSeconds.textContent = String(seconds).padStart(2, '0');
    }, 1000);
  }

  // =========================================================================
  // RENDER: HEADER & GAUGES
  // =========================================================================
  function renderHeaderMetrics() {
    if (!state.macroOverview) return;

    const score = state.macroOverview.globalSentimentScore || 0;
    const angle = Math.max(-45, Math.min(45, (score / 100) * 45));
    el.macroNeedle.style.transform = `rotate(${angle}deg)`;

    const sign = score > 0 ? '+' : '';
    let label = 'BALANCED';
    if (score >= 18) label = 'STRONG BULLISH';
    else if (score >= 6) label = 'POSITIVE MOOD';
    else if (score <= -18) label = 'DEFENSIVE MOOD';
    else if (score <= -6) label = 'CAUTIOUS';

    el.globalScoreLcd.textContent = `${sign}${score} ${label}`;
    if (score >= 0) {
      el.globalScoreLcd.style.color = 'var(--phosphor-green)';
    } else {
      el.globalScoreLcd.style.color = 'var(--phosphor-red)';
    }

    if (state.nextRefresh) {
      const d = new Date(state.nextRefresh);
      el.nextRefreshLabel.textContent = `NEXT: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    el.statArticles.textContent = state.macroOverview.totalArticlesAnalyzed || '--';
    
    let stanceFriendly = state.macroOverview.globalStance || '--';
    if (stanceFriendly === 'HIGH EXPANSION') stanceFriendly = 'STRONG BULLISH (EXPANSION)';
    else if (stanceFriendly === 'MODERATE EXPANSION') stanceFriendly = 'MODERATE GROWTH (BULLISH)';
    else if (stanceFriendly === 'DEFENSIVE') stanceFriendly = 'CAUTIOUS (DEFENSIVE)';
    else if (stanceFriendly === 'NEUTRAL') stanceFriendly = 'BALANCED (NEUTRAL)';
    
    el.statStance.textContent = stanceFriendly;
    if (state.lastUpdated) {
      const dt = new Date(state.lastUpdated);
      el.statUpdated.textContent = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    el.wireCounter.textContent = state.incidentWire.length;
  }

  // =========================================================================
  // RENDER: AI NARRATIVE PANEL (Gemini)
  // =========================================================================
  function renderAiNarrative() {
    const panel = document.getElementById('ai-narrative-panel');
    const textEl = document.getElementById('ai-narrative-text');
    const tsEl = document.getElementById('ai-narrative-ts');

    if (!panel || !textEl) return;

    const narrative = state.macroOverview && state.macroOverview.aiNarrative;
    if (narrative) {
      textEl.textContent = narrative;
      if (tsEl && state.lastUpdated) {
        const dt = new Date(state.lastUpdated);
        tsEl.textContent = `Generated ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  }

  // =========================================================================
  // RENDER: TAB 1 (MACRO RADAR & SECTORS)
  // =========================================================================
  function renderMacroRadar() {
    if (!state.macroOverview || !state.macroOverview.sectors) return;

    renderAiNarrative();

    const sectors = state.macroOverview.sectors;

    el.sectorsContainer.innerHTML = '';

    sectors.forEach(sec => {
      const card = document.createElement('div');
      card.className = 'sector-instrument-card';

      let badgeClass = 'mod-tailwind';
      let fillClass = 'fill-cyan';
      let badgeText = `${sec.tailwindScore > 0 ? '+' : ''}${sec.tailwindScore} TAILWIND`;

      if (sec.tailwindScore >= 20) {
        badgeClass = 'strong-tailwind';
        fillClass = 'fill-green';
        badgeText = `+${sec.tailwindScore} STRONG TAILWIND`;
      } else if (sec.tailwindScore <= -6) {
        badgeClass = 'headwind';
        fillClass = 'fill-red';
        badgeText = `${sec.tailwindScore} HEADWIND`;
      }

      const barPercent = Math.max(5, Math.min(100, Math.round(((sec.tailwindScore + 100) / 200) * 100)));

      const catalystsHtml = (sec.topCatalysts || []).map(cat => `
        <div class="catalyst-item">
          <a href="${cat.link}" target="_blank" rel="noopener" class="catalyst-link" title="Source: ${cat.source}">
            📰 ${escapeHtml(cat.title)}
          </a>
          <div class="catalyst-source">${escapeHtml(cat.source)} &bull; ${formatTimeAgo(cat.pubDate)}</div>
        </div>
      `).join('');

      const tickersHtml = (sec.keyTickers || []).map(t => `
        <button class="chip-btn" data-symbol="${t}">${t.replace('.NS', '')}</button>
      `).join('');

      card.innerHTML = `
        <div class="sector-card-header">
          <div class="sector-title-group">
            <div class="sector-icon-bezel">${getSectorIcon(sec.sectorId)}</div>
            <div>
              <div class="sector-name">${escapeHtml(sec.sectorName)}</div>
              <div class="sector-desc">${escapeHtml(sec.description)}</div>
            </div>
          </div>
          <span class="tailwind-badge ${badgeClass}">${badgeText}</span>
        </div>

        <div class="score-track-housing">
          <div class="score-track-labels">
            <span>HEADWIND</span>
            <span>MACRO STRENGTH (${barPercent}%)</span>
            <span>TAILWIND</span>
          </div>
          <div class="score-track-bar">
            <div class="score-fill ${fillClass}" style="width: ${barPercent}%;"></div>
          </div>
        </div>

        <div class="sector-catalysts">
          <div class="catalysts-title">ACTIVE MACRO CATALYSTS (${sec.catalystCount} EVENTS)</div>
          ${catalystsHtml || '<div class="catalyst-item">No breaking incidents in this cycle.</div>'}
        </div>

        <div class="sector-footer-tickers">
          <span class="footer-ticker-lbl">KEY EQUITIES:</span>
          <div class="ticker-chip-row">${tickersHtml}</div>
        </div>
      `;

      card.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sym = btn.getAttribute('data-symbol');
          if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
          loadStockDeepDive(sym);
        });
      });

      el.sectorsContainer.appendChild(card);
    });
  }

  // =========================================================================
  // RENDER: TAB 2 (STOCK OPPORTUNITIES)
  // =========================================================================
  function renderStockOpportunities() {
    el.stockCardsContainer.innerHTML = '';

    const filtered = state.stockOpportunities.filter(stock => {
      if (state.currentStockFilter === 'all') return true;
      return stock.sector.toLowerCase() === state.currentStockFilter.toLowerCase();
    });

    if (filtered.length === 0) {
      el.stockCardsContainer.innerHTML = `
        <div class="empty-vault-card">
          <div class="vault-icon">📡</div>
          <h3>NO EQUITIES MATCHING FILTER</h3>
          <p>Try selecting another sector or switch to "ALL SECTORS".</p>
        </div>
      `;
      return;
    }

    filtered.forEach(stock => {
      const isPinned = state.watchlist.includes(stock.ticker);
      const isPosChange = (stock.changePercent || 0) >= 0;
      const changeClass = isPosChange ? 'positive' : 'negative';
      const changeSign = isPosChange ? '+' : '';
      const currencySymbol = (stock.currency === 'INR' || stock.ticker.endsWith('.NS')) ? '₹' : '$';

      const card = document.createElement('div');
      card.className = 'stock-opportunity-card';

      card.innerHTML = `
        <div class="stock-card-top">
          <div class="stock-identity">
            <div class="stock-ticker-row">
              <span class="ticker-symbol">${stock.ticker}</span>
              <span class="subsector-badge">${escapeHtml(stock.subsector || stock.sector)}</span>
            </div>
            <div class="company-name">${escapeHtml(stock.name)}</div>
          </div>
          <div class="price-cluster">
            <div class="stock-price">${currencySymbol}${stock.price ? stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}</div>
            <div class="stock-change ${changeClass}">${changeSign}${stock.change ? stock.change.toFixed(2) : '0.00'} (${changeSign}${stock.changePercent ? stock.changePercent.toFixed(2) : '0.00'}%)</div>
          </div>
        </div>

        <div class="catalyst-meter-row">
          <div class="catalyst-score-badge">${stock.catalystScore > 0 ? '+' : ''}${stock.catalystScore}/100</div>
          <div class="catalyst-label-tag">CATALYST SCORE (${stock.confidence}% CONFIDENCE)</div>
          <div class="catalyst-news-counter">${stock.newsVolume || 0} NEWS EVENTS</div>
        </div>

        <div class="card-thesis-box">
          <div class="box-title">🎯 NEWS-DRIVEN INVESTMENT THESIS</div>
          <p class="box-text">${escapeHtml(stock.thesis)}</p>
        </div>

        <div class="card-risk-box">
          <div class="box-title">⚠️ GEOPOLITICAL & REGULATORY RISKS</div>
          <p class="box-text">${escapeHtml(stock.risks)}</p>
        </div>

        <div class="card-actions-row">
          <button class="btn-card-deepdive" data-symbol="${stock.ticker}">
            🔬 FULL DEEP DIVE
          </button>
          <button class="btn-pin-toggle ${isPinned ? 'pinned' : ''}" data-symbol="${stock.ticker}">
            ★ ${isPinned ? 'WATCHING' : 'PIN TO WATCHLIST'}
          </button>
        </div>
      `;

      card.querySelector('.btn-card-deepdive').addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        loadStockDeepDive(stock.ticker);
      });

      card.querySelector('.btn-pin-toggle').addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playRelaySnap();
        toggleWatchlist(stock.ticker);
      });

      el.stockCardsContainer.appendChild(card);
    });
  }

  // =========================================================================
  // RENDER & CONTROLLER: TAB 3 (STOCK DEEP DIVE & OSCILLOSCOPE)
  // =========================================================================
  async function loadStockDeepDive(symbolOrQuery, switchTab = true, customRange = null, customInterval = null, customLabel = null) {
    if (!symbolOrQuery) return;
    const sym = symbolOrQuery.trim().toUpperCase();

    if (switchTab) {
      switchActiveTab('tab-deepdive');
    }

    if (customRange) {
      state.currentTimeframe.range = customRange;
      state.currentTimeframe.interval = customInterval || (customRange === '1d' ? '5m' : customRange === '5d' ? '15m' : customRange === '1y' || customRange === '3y' ? '1wk' : '1d');
      state.currentTimeframe.label = customLabel || customRange.toUpperCase();
    }

    // Update Timeframe Button Styles
    document.querySelectorAll('#timeframe-buttons .tf-btn').forEach(btn => {
      if (btn.getAttribute('data-range') === state.currentTimeframe.range) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const tfLabel = state.currentTimeframe.label || '1-MONTH';
    const oscTitle = document.getElementById('oscilloscope-title');
    const signalRangeInd = document.getElementById('signal-range-indicator');
    if (oscTitle) oscTitle.textContent = `PRICE & CATALYST OSCILLOSCOPE (${tfLabel} TRAJECTORY)`;
    if (signalRangeInd) signalRangeInd.textContent = `SIGNAL RANGE: ${tfLabel}`;

    el.deepdiveEmptyState.classList.add('hidden');
    el.deepdiveActivePanel.classList.remove('hidden');

    if (!state.selectedStock || state.selectedStock.symbol !== sym) {
      el.ddSymbol.textContent = sym;
      el.ddName.textContent = 'FETCHING LIVE QUOTE & NEWS...';
      el.ddPrice.textContent = '--';
      el.ddChange.textContent = '--';
      el.ddThesis.textContent = 'Analyzing news developments and catalyst signals...';
      el.ddRisks.textContent = 'Extracting geopolitical, regulatory, and supply chain exposure...';
      el.ddMacro.textContent = 'Synthesizing macroeconomic sector linkages...';
      el.ddNewsList.innerHTML = '<div class="targeted-news-item">Ingesting live feed for this asset...</div>';
    }

    try {
      const reg = state.currentRegion;
      const { range, interval } = state.currentTimeframe;
      const res = await fetch(`/api/stock-deep-dive?symbol=${encodeURIComponent(sym)}&region=${reg}&range=${range}&interval=${interval}`);
      const json = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to load deep dive');
      }

      const data = json.data;
      state.selectedStock = data;

      el.ddSymbol.textContent = data.symbol;
      el.ddName.textContent = data.name;
      el.ddSector.textContent = data.sector;
      el.ddSubsector.textContent = data.subsector;

      const quote = data.quote || {};
      const price = quote.regularMarketPrice || 0;
      const change = quote.change || 0;
      const changePercent = quote.changePercent || 0;
      const isPos = change >= 0;
      const currencySymbol = (quote.currency === 'INR' || data.symbol.endsWith('.NS')) ? '₹' : '$';

      el.ddPrice.textContent = `${currencySymbol}${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      el.ddChange.textContent = `${isPos ? '+' : ''}${change.toFixed(2)} (${isPos ? '+' : ''}${changePercent.toFixed(2)}%)`;
      el.ddChange.style.color = isPos ? 'var(--phosphor-green)' : 'var(--phosphor-red)';

      const isPinned = state.watchlist.includes(data.symbol);
      el.ddWatchlistBtn.innerHTML = `
        <span class="star-icon">★</span>
        <span class="btn-text">${isPinned ? 'PINNED IN VAULT' : 'PIN TO WATCHLIST'}</span>
      `;
      if (isPinned) el.ddWatchlistBtn.classList.add('pinned');
      else el.ddWatchlistBtn.classList.remove('pinned');

      const score = data.catalystScore || 0;
      const angle = Math.max(-45, Math.min(45, (score / 100) * 45));
      el.ddNeedle.style.transform = `rotate(${angle}deg)`;

      el.ddSentimentScore.textContent = `${score > 0 ? '+' : ''}${score}`;
      el.ddSentimentLabel.textContent = (data.sentimentLabel || 'NEUTRAL').replace(/_/g, ' ');
      el.ddBullCount.textContent = data.bullishNewsCount || 0;
      el.ddBearCount.textContent = data.bearishNewsCount || 0;
      el.ddConfidence.textContent = `${data.confidence}%`;

      el.ddThesis.textContent = data.thesis;
      el.ddRisks.textContent = data.risks;
      el.ddMacro.textContent = data.macroCorrelation;

      el.ddNewsCount.textContent = `${(data.recentNews || []).length} ARTICLES`;
      el.ddNewsList.innerHTML = '';

      if (data.recentNews && data.recentNews.length > 0) {
        data.recentNews.forEach(item => {
          const itemEl = document.createElement('div');
          itemEl.className = 'targeted-news-item';

          let sentimentClass = 'neutral';
          if (item.sentimentScore > 0) sentimentClass = 'bullish';
          else if (item.sentimentScore < 0) sentimentClass = 'bearish';

          itemEl.innerHTML = `
            <div class="news-item-content">
              <a href="${item.link}" target="_blank" rel="noopener" class="news-item-title">
                ${escapeHtml(item.title)}
              </a>
              <div class="news-item-meta">
                <span>${escapeHtml(item.source)}</span>
                <span>&bull;</span>
                <span>${formatTimeAgo(item.pubDate)}</span>
              </div>
            </div>
            <span class="sentiment-badge-pill ${sentimentClass}">
              ${item.sentiment ? item.sentiment.replace(/_/g, ' ') : 'NEUTRAL'}
            </span>
          `;
          el.ddNewsList.appendChild(itemEl);
        });
      } else {
        el.ddNewsList.innerHTML = '<div class="targeted-news-item">No specific headlines detected in past 72 hours for this asset.</div>';
      }

      drawOscilloscopeChart(quote.sparkline || [], currencySymbol, state.currentTimeframe.range);

    } catch (err) {
      console.error('Deep dive error:', err);
      el.ddThesis.textContent = `Error retrieving live intelligence for ${sym}. Please check symbol and retry.`;
    }
  }

  // Draw Glowing Phosphor Oscilloscope Chart on Canvas
  function drawOscilloscopeChart(points, currencySymbol = '$', currentRange = '1mo') {
    const canvas = el.oscilloscopeCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
    ctx.lineWidth = 1;

    const gridStepX = width / 10;
    const gridStepY = height / 6;

    for (let x = 0; x < width; x += gridStepX) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStepY) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.18)';
    ctx.beginPath();
    ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!points || points.length < 2) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
      return;
    }

    const prices = points.map(p => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = (maxP - minP) || 1;
    const padTop = 32;
    const padBottom = 30;
    const usableHeight = height - padTop - padBottom;

    const gradient = ctx.createLinearGradient(0, padTop, 0, height);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0.28)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0.0)');

    ctx.beginPath();
    points.forEach((pt, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = padTop + usableHeight - ((pt.price - minP) / range) * usableHeight;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    points.forEach((pt, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = padTop + usableHeight - ((pt.price - minP) / range) * usableHeight;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    const stepNodes = points.length > 50 ? 8 : points.length > 25 ? 4 : 2;
    points.forEach((pt, idx) => {
      if (idx % stepNodes === 0 || idx === points.length - 1) {
        const x = (idx / (points.length - 1)) * width;
        const y = padTop + usableHeight - ((pt.price - minP) / range) * usableHeight;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    });

    ctx.font = '10px "JetBrains Mono"';
    ctx.fillStyle = '#00ff88';
    ctx.fillText(`HI: ${currencySymbol}${maxP.toFixed(2)}`, 10, 20);
    ctx.fillStyle = '#8e99a8';
    ctx.fillText(`LO: ${currencySymbol}${minP.toFixed(2)}`, 10, height - 10);
    ctx.fillText(`LATEST: ${currencySymbol}${prices[prices.length - 1].toFixed(2)}`, width - 130, 20);

    // Display Start and End timestamps on bottom corners
    if (points.length > 0) {
      ctx.fillStyle = '#5a6473';
      ctx.fillText(points[0].date || '', 80, height - 10);
      ctx.fillText(points[points.length - 1].date || '', width - 90, height - 10);
    }
  }

  // =========================================================================
  // RENDER: TAB 4 (INCIDENT WIRE)
  // =========================================================================
  function renderIncidentWire() {
    el.incidentWireContainer.innerHTML = '';

    const query = state.wireFilterQuery.toLowerCase().trim();
    const filtered = state.incidentWire.filter(item => {
      if (!query) return true;
      const inTitle = item.title.toLowerCase().includes(query);
      const inDesc = (item.description || '').toLowerCase().includes(query);
      const inThemes = (item.themes || []).some(t => t.toLowerCase().includes(query));
      return inTitle || inDesc || inThemes;
    });

    if (filtered.length === 0) {
      el.incidentWireContainer.innerHTML = `
        <div class="empty-vault-card">
          <div class="vault-icon">🔍</div>
          <h3>NO WIRE INCIDENTS MATCHING "${escapeHtml(query)}"</h3>
          <p>Try another search term (e.g. defense, rbi, solar, capex, chip, crude, tariff).</p>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'wire-incident-card';

      let beaconClass = 'neutral';
      if (item.sentimentScore > 0) beaconClass = 'bullish';
      else if (item.sentimentScore < 0) beaconClass = 'bearish';

      const themesHtml = (item.themes || []).map(t => `
        <span class="wire-theme-tag">${escapeHtml(t)}</span>
      `).join('');

      card.innerHTML = `
        <div class="wire-signal-beacon ${beaconClass}" title="Sentiment: ${item.sentiment}"></div>
        <div class="wire-body">
          <a href="${item.link}" target="_blank" rel="noopener" class="wire-title-link">
            ${escapeHtml(item.title)}
          </a>
          ${item.description ? `<p class="wire-desc">${escapeHtml(item.description)}</p>` : ''}
          <div class="wire-tags-tray">
            <span class="wire-source-tag">${escapeHtml(item.source)} &bull; ${formatTimeAgo(item.pubDate)}</span>
            ${themesHtml}
          </div>
        </div>
      `;

      el.incidentWireContainer.appendChild(card);
    });
  }

  // =========================================================================
  // RENDER: TAB 5 (WATCHLIST VAULT)
  // =========================================================================
  function renderWatchlist() {
    el.watchlistContainer.innerHTML = '';

    if (state.watchlist.length === 0) {
      el.watchlistContainer.innerHTML = `
        <div class="empty-vault-card">
          <div class="vault-icon">🔒</div>
          <h3>YOUR WATCHLIST VAULT IS EMPTY</h3>
          <p>Click the <strong>★ PIN TO WATCHLIST</strong> button on any stock opportunity card or deep-dive page to track your favored equities here.</p>
        </div>
      `;
      return;
    }

    const watchlistStocks = state.stockOpportunities.filter(s => state.watchlist.includes(s.ticker));

    state.watchlist.forEach(sym => {
      let stock = watchlistStocks.find(s => s.ticker === sym);
      const isIndia = sym.endsWith('.NS') || sym.endsWith('.BO');
      const currencySymbol = isIndia ? '₹' : '$';

      if (!stock) {
        stock = {
          ticker: sym,
          name: `${sym} Pinned Asset`,
          sector: isIndia ? 'Indian Equity' : 'Global Equity',
          subsector: isIndia ? 'NSE / BSE' : 'Equity',
          price: isIndia ? 2500 : 150,
          change: 0,
          changePercent: 0,
          catalystScore: 18,
          confidence: 75,
          newsVolume: 1,
          thesis: 'Active tracking enabled. Click Full Deep Dive for real-time catalyst analysis.',
          risks: 'Subject to regional market volatility.'
        };
      }

      const card = document.createElement('div');
      card.className = 'stock-opportunity-card';
      const isPosChange = (stock.changePercent || 0) >= 0;

      card.innerHTML = `
        <div class="stock-card-top">
          <div class="stock-identity">
            <div class="stock-ticker-row">
              <span class="ticker-symbol">${stock.ticker}</span>
              <span class="subsector-badge">${escapeHtml(stock.subsector || stock.sector)}</span>
            </div>
            <div class="company-name">${escapeHtml(stock.name)}</div>
          </div>
          <div class="price-cluster">
            <div class="stock-price">${currencySymbol}${stock.price ? stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}</div>
            <div class="stock-change ${isPosChange ? 'positive' : 'negative'}">
              ${isPosChange ? '+' : ''}${stock.change ? stock.change.toFixed(2) : '0.00'} (${isPosChange ? '+' : ''}${stock.changePercent ? stock.changePercent.toFixed(2) : '0.00'}%)
            </div>
          </div>
        </div>

        <div class="card-thesis-box">
          <div class="box-title">🎯 CATALYST THESIS</div>
          <p class="box-text">${escapeHtml(stock.thesis)}</p>
        </div>

        <div class="card-actions-row">
          <button class="btn-card-deepdive" data-symbol="${stock.ticker}">
            🔬 FULL DEEP DIVE
          </button>
          <button class="btn-pin-toggle pinned" data-symbol="${stock.ticker}">
            ★ UNPIN
          </button>
        </div>
      `;

      card.querySelector('.btn-card-deepdive').addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        loadStockDeepDive(stock.ticker);
      });

      card.querySelector('.btn-pin-toggle').addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playRelaySnap();
        toggleWatchlist(stock.ticker);
      });

      el.watchlistContainer.appendChild(card);
    });
  }

  function toggleWatchlist(symbol) {
    const sym = symbol.toUpperCase().trim();
    const idx = state.watchlist.indexOf(sym);
    if (idx > -1) {
      state.watchlist.splice(idx, 1);
    } else {
      state.watchlist.push(sym);
    }
    localStorage.setItem('aura_sentinel_watchlist', JSON.stringify(state.watchlist));
    updateWatchlistBadge();
    renderStockOpportunities();
    renderWatchlist();

    if (state.selectedStock && state.selectedStock.symbol === sym) {
      const isPinned = state.watchlist.includes(sym);
      el.ddWatchlistBtn.innerHTML = `
        <span class="star-icon">★</span>
        <span class="btn-text">${isPinned ? 'PINNED IN VAULT' : 'PIN TO WATCHLIST'}</span>
      `;
      if (isPinned) el.ddWatchlistBtn.classList.add('pinned');
      else el.ddWatchlistBtn.classList.remove('pinned');
    }
  }

  function updateWatchlistBadge() {
    el.watchlistCounter.textContent = state.watchlist.length;
  }

  // =========================================================================
  // EVENT LISTENERS & NAVIGATION
  // =========================================================================
  function setupEventListeners() {
    // Region Selectors
    el.btnRegIndia.addEventListener('click', () => {
      if (state.currentRegion === 'india') return;
      if (window.tactileAudio) window.tactileAudio.playRelaySnap();
      state.currentRegion = 'india';
      state.currentStockFilter = 'all';
      renderRegionControls();
      fetchAllIntelligence();
    });

    el.btnRegGlobal.addEventListener('click', () => {
      if (state.currentRegion === 'global') return;
      if (window.tactileAudio) window.tactileAudio.playRelaySnap();
      state.currentRegion = 'global';
      state.currentStockFilter = 'all';
      renderRegionControls();
      fetchAllIntelligence();
    });

    // Rocker Tabs
    el.rockerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        switchActiveTab(targetTab);
      });
    });

    // Force Refresh Button
    el.btnForceRefresh.addEventListener('click', () => {
      if (window.tactileAudio) window.tactileAudio.playRelaySnap();
      fetchAllIntelligence(true);
    });

    // Audio Haptic Switch
    el.audioToggle.addEventListener('change', (e) => {
      if (window.tactileAudio) {
        window.tactileAudio.enabled = e.target.checked;
        if (e.target.checked) window.tactileAudio.playDialTick();
      }
    });

    // Search Input & Autocomplete
    let searchDebounce = null;
    el.searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      el.btnSearchClear.classList.toggle('hidden', q.length === 0);

      clearTimeout(searchDebounce);
      if (q.length >= 2) {
        searchDebounce = setTimeout(() => handleSearchAutocomplete(q), 300);
      } else {
        el.autocompleteDropdown.classList.add('hidden');
      }
    });

    el.btnSearchClear.addEventListener('click', () => {
      el.searchInput.value = '';
      el.btnSearchClear.classList.add('hidden');
      el.autocompleteDropdown.classList.add('hidden');
      el.searchInput.focus();
    });

    el.btnSearchSubmit.addEventListener('click', () => {
      const q = el.searchInput.value.trim();
      if (q) {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        el.autocompleteDropdown.classList.add('hidden');
        loadStockDeepDive(q);
      }
    });

    el.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = el.searchInput.value.trim();
        if (q) {
          if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
          el.autocompleteDropdown.classList.add('hidden');
          loadStockDeepDive(q);
        }
      }
    });

    // Deep dive watchlist toggle
    el.ddWatchlistBtn.addEventListener('click', () => {
      if (state.selectedStock) {
        if (window.tactileAudio) window.tactileAudio.playRelaySnap();
        toggleWatchlist(state.selectedStock.symbol);
      }
    });

    // Wire live filter input
    el.wireFilterInput.addEventListener('input', (e) => {
      state.wireFilterQuery = e.target.value;
      renderIncidentWire();
    });

    // Timeframe Selector Buttons (1D, 1W, 1M, 6M, 1Y, 3Y)
    document.querySelectorAll('#timeframe-buttons .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range');
        const interval = btn.getAttribute('data-interval');
        const label = btn.getAttribute('data-label');
        
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();

        if (state.selectedStock) {
          const sym = state.selectedStock.symbol || state.selectedStock.ticker;
          loadStockDeepDive(sym, false, range, interval, label);
        } else {
          state.currentTimeframe = { range, interval, label };
          document.querySelectorAll('#timeframe-buttons .tf-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const oscTitle = document.getElementById('oscilloscope-title');
          const signalRangeInd = document.getElementById('signal-range-indicator');
          if (oscTitle) oscTitle.textContent = `PRICE & CATALYST OSCILLOSCOPE (${label} TRAJECTORY)`;
          if (signalRangeInd) signalRangeInd.textContent = `SIGNAL RANGE: ${label}`;
        }
      });
    });

    // Clear Watchlist Button
    el.btnClearWatchlist.addEventListener('click', () => {
      if (confirm('Clear all stocks from your Watchlist Vault?')) {
        state.watchlist = [];
        localStorage.removeItem('aura_sentinel_watchlist');
        updateWatchlistBadge();
        renderWatchlist();
        renderStockOpportunities();
      }
    });

    // Source of Truth Registry Modal
    const sourceModal = document.getElementById('source-modal');
    const btnOpenSources = document.getElementById('btn-open-sources');
    const btnCloseSources = document.getElementById('btn-close-sources');
    const btnCloseSourcesBottom = document.getElementById('btn-close-sources-bottom');

    if (btnOpenSources && sourceModal) {
      btnOpenSources.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playRelaySnap();
        sourceModal.classList.remove('hidden');
      });

      const closeModal = () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        sourceModal.classList.add('hidden');
      };

      if (btnCloseSources) btnCloseSources.addEventListener('click', closeModal);
      if (btnCloseSourcesBottom) btnCloseSourcesBottom.addEventListener('click', closeModal);

      sourceModal.addEventListener('click', (e) => {
        if (e.target === sourceModal) closeModal();
      });
    }

    // =========================================================================
    // AUTHENTICATION VAULT EVENT LISTENERS
    // =========================================================================
    const tabAuthLogin = document.getElementById('tab-auth-login');
    const tabAuthSignup = document.getElementById('tab-auth-signup');
    const formLogin = document.getElementById('form-login');
    const formSignup = document.getElementById('form-signup');
    const btnDemoLogin = document.getElementById('btn-demo-login');

    if (tabAuthLogin && tabAuthSignup) {
      tabAuthLogin.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        tabAuthLogin.classList.add('active');
        tabAuthSignup.classList.remove('active');
        formLogin.classList.remove('hidden');
        formSignup.classList.add('hidden');
        document.getElementById('auth-toast').classList.add('hidden');
      });

      tabAuthSignup.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        tabAuthSignup.classList.add('active');
        tabAuthLogin.classList.remove('active');
        formSignup.classList.remove('hidden');
        formLogin.classList.add('hidden');
        document.getElementById('auth-toast').classList.add('hidden');
      });
    }

    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        loginUser(email, pass);
      });
    }

    if (formSignup) {
      formSignup.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const org = document.getElementById('signup-org').value;
        const email = document.getElementById('signup-email').value;
        const pass = document.getElementById('signup-password').value;
        registerUser(name, org, email, pass);
      });
    }

    if (btnDemoLogin) {
      btnDemoLogin.addEventListener('click', () => {
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        if (emailInput && passInput) {
          emailInput.value = 'analyst@aura.capital';
          passInput.value = 'sentinel2026';
          if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
          loginUser('analyst@aura.capital', 'sentinel2026');
        }
      });
    }

    // =========================================================================
    // ACCOUNT SETTINGS & THEME CUSTOMIZATION MODAL
    // =========================================================================
    const settingsModal = document.getElementById('settings-modal');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnLogoutHeader = document.getElementById('btn-logout-header');
    const btnLogoutSettings = document.getElementById('btn-logout-settings');
    const cardDark = document.getElementById('theme-card-dark');
    const cardBright = document.getElementById('theme-card-bright');

    if (btnOpenSettings && settingsModal) {
      btnOpenSettings.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playRelaySnap();
        if (state.currentUser) updateHeaderUserUI(state.currentUser);
        settingsModal.classList.remove('hidden');
      });

      const closeSettings = () => {
        if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
        settingsModal.classList.add('hidden');
      };

      if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
      if (btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettings);

      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
      });
    }

    if (btnLogoutHeader) btnLogoutHeader.addEventListener('click', logoutUser);
    if (btnLogoutSettings) btnLogoutSettings.addEventListener('click', logoutUser);

    // Theme Switch Cards
    if (cardDark) {
      cardDark.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playDialTick();
        applyTheme('dark');
      });
    }

    if (cardBright) {
      cardBright.addEventListener('click', () => {
        if (window.tactileAudio) window.tactileAudio.playDialTick();
        applyTheme('bright');
      });
    }

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (settingsModal && !settingsModal.classList.contains('hidden')) settingsModal.classList.add('hidden');
        if (sourceModal && !sourceModal.classList.contains('hidden')) sourceModal.classList.add('hidden');
      }
    });

    // Close autocomplete on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box-recessed') && !e.target.closest('.autocomplete-dropdown')) {
        el.autocompleteDropdown.classList.add('hidden');
      }
    });
  }

  async function handleSearchAutocomplete(query) {
    try {
      const reg = state.currentRegion;
      const res = await fetch(`/api/stock-search?q=${encodeURIComponent(query)}&region=${reg}`);
      const json = await res.json();

      if (!json.success || !json.results || json.results.length === 0) {
        el.autocompleteDropdown.classList.add('hidden');
        return;
      }

      el.autocompleteDropdown.innerHTML = '';
      json.results.slice(0, 7).forEach(item => {
        const row = document.createElement('div');
        row.className = 'autocomplete-item';
        row.innerHTML = `
          <div>
            <span class="item-ticker">${item.symbol}</span>
            <span class="item-name">${escapeHtml(item.name)}</span>
          </div>
          <span class="item-exchange">${item.exchange || 'EQUITY'}</span>
        `;
        row.addEventListener('click', () => {
          if (window.tactileAudio) window.tactileAudio.playMechanicalClick();
          el.searchInput.value = item.symbol;
          el.autocompleteDropdown.classList.add('hidden');
          loadStockDeepDive(item.symbol);
        });
        el.autocompleteDropdown.appendChild(row);
      });

      el.autocompleteDropdown.classList.remove('hidden');
    } catch (err) {
      console.warn('Search autocomplete error:', err);
    }
  }

  function switchActiveTab(tabId) {
    state.currentTab = tabId;

    el.rockerTabs.forEach(t => {
      if (t.getAttribute('data-tab') === tabId) t.classList.add('active');
      else t.classList.remove('active');
    });

    el.tabContents.forEach(content => {
      if (content.id === tabId) content.classList.add('active');
      else content.classList.remove('active');
    });

    if (tabId === 'tab-deepdive' && state.selectedStock && state.selectedStock.quote) {
      const isIndia = state.selectedStock.symbol.endsWith('.NS') || state.selectedStock.quote.currency === 'INR';
      setTimeout(() => drawOscilloscopeChart(state.selectedStock.quote.sparkline || [], isIndia ? '₹' : '$'), 50);
    }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================
  function getSectorIcon(sectorId) {
    const icons = {
      // Global
      'defense': '🛡️',
      'technology': '⚡',
      'energy': '☢️',
      'healthcare': '🧬',
      'industrials': '⚓',
      // India
      'defense_india': '🛡️',
      'energy_india': '⚡',
      'industrials_india': '⚓',
      'financials_india': '🏦',
      'technology_india': '💻',
      'auto_india': '🚗'
    };
    return icons[sectorId] || '🌐';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return 'Recent';
    const now = new Date();
    const dt = new Date(dateStr);
    const diffSec = Math.floor((now - dt) / 1000);

    if (isNaN(diffSec) || diffSec < 0) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
