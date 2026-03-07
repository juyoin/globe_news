// app.js - FULL FILE with mods for better POI interaction reliability (2026 reality)

// Note: Native POI hover BLUE GLOW is often broken/missing in JS API vector maps (clickableIcons gives cursor only).
// This is GOOGLE'S limitation, not your fuckup. See release notes 2026: hover cards gutted in Embed, inconsistent in JS.
// We keep clickableIcons:true for pointer + click placeId. No reliable hover color hook exists without custom fake labels.

// Module-level marker reference so dismissCard doesn't require it as a parameter
let _marker = null;
// News intelligence module state
const NEWS_API_KEY = '229da195b45a436eb1a0188cecb9679a';
const GEMINI_API_KEY = 'AIzaSyDhNh6IYzdn1fCmJvP1AnAXDNkz3vYtZME';
const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemma-3-1b-it',
    'gemma-3-4b-it',
    'gemma-3-12b-it',
];

const INTELLIGENCE_LEVELS = {
    standard: {
        key: 'standard',
        label: 'Standard (Global Pulse)',
        focus: 'Top headlines from major global outlets.',
        modePrompt:
            'Prioritize globally significant, high-impact stories and extract the main reported location for each story.'
    },
    conflict_watch: {
        key: 'conflict_watch',
        label: 'Conflict Watch',
        focus: 'War zones, civil unrest, and territorial disputes.',
        query: 'war OR conflict OR crisis',
        modePrompt:
            'Identify Active Frontlines. Place each item location exactly where active fighting or clashes are reported, not just political capitals.'
    },
    green_horizon: {
        key: 'green_horizon',
        label: 'Green Horizon',
        focus: 'Natural disasters, climate breakthroughs, or major weather events.',
        query: 'wildfire OR earthquake OR "climate change" OR "renewable energy"',
        modePrompt:
            'Prioritize climate and environment events, disasters, and major weather impacts. Use the most specific affected location.'
    },
    economic_engine: {
        key: 'economic_engine',
        label: 'Economic Engine',
        focus: 'Stock market shifts, trade deals, and inflation crises.',
        query: 'recession OR "stock market" OR "trade agreement" OR central-bank',
        modePrompt:
            'Prioritize market shocks, trade agreements, and inflation or central bank actions. Use the primary market or country location.'
    },
    cyber_frontier: {
        key: 'cyber_frontier',
        label: 'Cyber Frontier',
        focus: 'Major data breaches, AI breakthroughs, and digital warfare.',
        query: 'cyberattack OR "artificial intelligence" OR hacking OR silicon-valley',
        modePrompt:
            'Prioritize major cyber incidents and AI breakthroughs. Set location to where the incident occurred or where the affected organization is based.'
    }
};

let _newsMarkers = [];
let _newsData = [];
let _newsMap = null;
let _AME = null;

function getLevelConfig(levelKey) {
    return INTELLIGENCE_LEVELS[levelKey] || INTELLIGENCE_LEVELS.standard;
}

function buildNewsApiUrl(levelKey) {
    const level = getLevelConfig(levelKey);
    if (level.key === 'standard') {
        return `https://newsapi.org/v2/top-headlines?language=en&pageSize=20&apiKey=${NEWS_API_KEY}`;
    }
    const q = encodeURIComponent(level.query);
    return `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;
}

async function fetchNews(levelKey = 'standard') {
    const rawUrl = buildNewsApiUrl(levelKey);
    const proxies = [
        enc => `https://corsproxy.io/?${enc}`,
        enc => `https://api.codetabs.com/v1/proxy?quest=${enc}`,
        enc => `https://thingproxy.freeboard.io/fetch/${enc}`,
        enc => `https://api.allorigins.win/raw?url=${enc}`,
    ];

    let lastErr = null;
    for (const buildUrl of proxies) {
        const url = buildUrl(encodeURIComponent(rawUrl));
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
            const data = await res.json();
            if (data.status === 'error') throw new Error(data.message || 'NewsAPI error');
            const articles = (data.articles || []).filter(a => a.title && a.description && !a.title.includes('[Removed]'));
            if (!articles.length) throw new Error('No articles returned');
            return articles;
        } catch (err) {
            lastErr = err;
            console.warn(`[Atlas News] Proxy failed (${url.slice(0, 40)}…):`, err.message);
        }
    }
    throw new Error(`All proxies failed. Last error: ${lastErr?.message}`);
}

function formatArticles(articles) {
    return articles.slice(0, 30)
        .map((a, i) => `${i + 1}. Title: ${a.title}\n   Description: ${a.description}`)
        .join('\n\n');
}

async function getCoordinates(location) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Atlas-NewsMap/1.0' } });
        const data = await res.json();
        if (!data.length) return { lat: null, lng: null };
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
        return { lat: null, lng: null };
    }
}

async function callGeminiModel(model, prompt) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        })
    });

    if (res.status === 429) {
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error(err.error?.message || 'Rate limited'), { isRateLimit: true });
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
    if (!raw) throw new Error(`Empty response from ${model}`);
    return { text: raw.replace(/```json\n?|```/g, '').trim(), model };
}

async function callGemini(prompt, onStatus) {
    let lastErr = null;
    for (const model of GEMINI_MODELS) {
        try {
            onStatus?.(`Trying ${model}…`);
            return await callGeminiModel(model, prompt);
        } catch (err) {
            console.warn(`[Atlas News] ${model} failed:`, err.message);
            lastErr = err;
            if (!err.isRateLimit) throw err;
        }
    }
    throw new Error('RATE_LIMIT: All models rate-limited. ' + lastErr?.message);
}

async function processNewsWithGemini(articles, levelKey, onStatus) {
    const level = getLevelConfig(levelKey);
    const prompt =
        'Process the following news articles.\n' +
        `INTELLIGENCE MODE: ${level.label}\n` +
        `MODE FOCUS: ${level.focus}\n` +
        'OUTPUT SCHEMA (JSON array, no other text, no markdown fences):\n' +
        '[{ "original_title": "string", "summary_en": "one sentence summary in English", "location": "City, Country" }]\n' +
        'INSTRUCTIONS:\n' +
        `* ${level.modePrompt}\n` +
        '* For "location" use the most specific place mentioned (city, then region, then country).\n' +
        '* If no real-world location is mentioned, set "location" to null.\n' +
        '* Return ONLY the raw JSON array.\n\n' +
        'ARTICLES:\n' + formatArticles(articles);

    onStatus?.('Sending articles to Gemini…');
    const { text: raw, model: usedModel } = await callGemini(prompt, onStatus);
    onStatus?.(`Parsing response from ${usedModel}…`);
    const items = JSON.parse(raw);

    const uniqueLocs = [...new Set(items.map(i => i.location).filter(Boolean))];
    onStatus?.(`Geolocating ${uniqueLocs.length} unique places…`);

    const coordCache = {};
    for (const loc of uniqueLocs) {
        coordCache[loc] = await getCoordinates(loc);
        await new Promise(r => setTimeout(r, 350));
    }

    return items.map(item => ({
        ...item,
        coords: item.location ? (coordCache[item.location] ?? { lat: null, lng: null }) : { lat: null, lng: null }
    }));
}

function clearNewsMarkers() {
    _newsMarkers.forEach(m => { m.map = null; });
    _newsMarkers = [];
}

function plotNewsMarkers(items, map) {
    clearNewsMarkers();
    items.forEach((item, i) => {
        if (!item.coords?.lat || !item.coords?.lng) return;
        const wrap = document.createElement('div');
        wrap.className = 'news-marker';
        wrap.innerHTML = `<div class="nm-dot">${i + 1}</div>`;

        const m = new _AME({
            map,
            position: { lat: item.coords.lat, lng: item.coords.lng },
            content: wrap,
            title: item.original_title,
            zIndex: 60
        });

        wrap.addEventListener('click', () => {
            openNewsDetail(item, i);
            map.panTo({ lat: item.coords.lat, lng: item.coords.lng });
            map.setZoom(Math.max(map.getZoom(), 5));
        });

        _newsMarkers.push(m);
    });
}

function renderNewsList(items) {
    const el = document.getElementById('news-panel-list');
    el.innerHTML = '';

    if (!items.length) {
        el.innerHTML = '<p class="news-empty">No geolocatable news items found.</p>';
        return;
    }

    items.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'npl-item';
        div.innerHTML = `
          <span class="npl-num">${i + 1}</span>
          <div class="npl-body">
            <p class="npl-loc">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="10" height="10">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              ${escapeHtml(item.location || '—')}
            </p>
            <p class="npl-title">${escapeHtml(item.original_title)}</p>
            <p class="npl-summary">${escapeHtml(item.summary_en || '')}</p>
          </div>`;

        div.addEventListener('click', () => {
            openNewsDetail(item, i);
            if (_newsMap && item.coords?.lat && item.coords?.lng) {
                _newsMap.panTo({ lat: item.coords.lat, lng: item.coords.lng });
                _newsMap.setZoom(5);
            }
        });

        el.appendChild(div);
    });
}

function openNewsDetail(item, i) {
    const card = document.getElementById('news-detail-card');
    document.getElementById('ndc-num').textContent = `#${i + 1}`;
    document.getElementById('ndc-title').textContent = item.original_title;
    document.getElementById('ndc-location').textContent = item.location || '—';
    document.getElementById('ndc-summary').textContent = item.summary_en || '—';

    if (item.coords?.lat) {
        const { lat, lng } = item.coords;
        document.getElementById('ndc-coords').textContent =
            `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}  ·  ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
    } else {
        document.getElementById('ndc-coords').textContent = '—';
    }
    card.classList.add('active');
}

function initNewsUI(map) {
    _newsMap = map;
    const newsBtn = document.getElementById('news-btn');
    const panel = document.getElementById('news-panel');
    const closePanel = document.getElementById('close-news-panel');
    const closeCard = document.getElementById('close-ndc');
    const statusEl = document.getElementById('news-panel-status');
    const listEl = document.getElementById('news-panel-list');
    const errorEl = document.getElementById('news-panel-error');
    const statusTxt = document.getElementById('news-status-text');
    const errorMsg = document.getElementById('news-error-msg');
    const retryBtn = document.getElementById('news-retry-btn');
    const intelligenceLevelEl = document.getElementById('intelligence-level');
    const focusEl = document.getElementById('intelligence-focus');
    let loaded = false;
    let currentLevel = intelligenceLevelEl?.value || 'standard';

    const refreshLevelFocus = () => {
        const level = getLevelConfig(currentLevel);
        if (focusEl) focusEl.textContent = level.focus;
    };
    refreshLevelFocus();

    const runPipeline = async () => {
        const level = getLevelConfig(currentLevel);
        loaded = false;
        statusEl.style.display = 'flex';
        listEl.style.display = 'none';
        errorEl.style.display = 'none';
        statusTxt.textContent = 'Fetching ' + level.label + ' news…';

        try {
            const articles = await fetchNews(currentLevel);
            if (!articles.length) throw new Error('NewsAPI returned no articles');

            statusTxt.textContent = 'Sending ' + level.label + ' to Gemini…';
            const data = await processNewsWithGemini(articles, currentLevel, msg => { statusTxt.textContent = msg; });
            _newsData = data.filter(d => d.coords?.lat && d.coords?.lng);
            renderNewsList(_newsData);
            plotNewsMarkers(_newsData, map);
            statusEl.style.display = 'none';
            listEl.style.display = 'block';
            loaded = true;
            newsBtn.classList.add('news-loaded');
        } catch (err) {
            console.error('[Atlas News] Pipeline error:', err);
            statusEl.style.display = 'none';
            errorEl.style.display = 'flex';

            let msg = err.message || 'Unknown error';
            if (msg.startsWith('RATE_LIMIT') || msg.includes('429') || /quota/i.test(msg)) {
                msg = 'Gemini free-tier rate limit reached. Wait a minute, then retry.';
            } else if (/fetch|network|failed to fetch/i.test(msg)) {
                msg = 'Network error — check your connection and retry.';
            } else if (/json/i.test(msg)) {
                msg = 'Could not parse Gemini response. Retry to try again.';
            }
            errorMsg.textContent = msg;
        }
    };

    newsBtn?.addEventListener('click', () => {
        panel.classList.add('open');
        if (!loaded) runPipeline();
    });
    retryBtn?.addEventListener('click', runPipeline);
    intelligenceLevelEl?.addEventListener('change', () => {
        currentLevel = intelligenceLevelEl.value;
        refreshLevelFocus();
        clearNewsMarkers();
        runPipeline();
    });
    closePanel?.addEventListener('click', () => panel.classList.remove('open'));
    closeCard?.addEventListener('click', () => document.getElementById('news-detail-card').classList.remove('active'));

    panel.classList.add('open');
    runPipeline();
}

async function initMap() {
    try {
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
        _AME = AdvancedMarkerElement;

        // ── Map ───────────────────────────────────────────────
        const map = new Map(document.getElementById("map"), {
            center: { lat: 20, lng: 10 },
            zoom: 2.8,
            mapTypeId: "hybrid",
            mapId: "c5c4e760881f738038c2baa1",
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            gestureHandling: "auto",
            clickableIcons: true,
            // NOTE: styles[] is mutually exclusive with mapId — when mapId is present,
            // styles are silently ignored. Custom POI styling requires Cloud-based map
            // styling configured in Google Cloud Console and linked to the mapId.
            // AdvancedMarkerElement requires mapId, so we keep it and drop styles[].
        });

        // ── Cursor management ─────────────────────────────────
        // Default: arrow. Dragging: grabbing hand. POI hover: pointer (via CSS [title]).
        // MapOptions draggableCursor/draggingCursor are unreliable — class toggle is safer.
        const mapEl = document.getElementById("map");
        map.addListener("mousedown", () => mapEl.classList.add("is-dragging"));
        map.addListener("mouseup", () => mapEl.classList.remove("is-dragging"));
        mapEl.addEventListener("touchend", () => mapEl.classList.remove("is-dragging"));

        // ── Marker ────────────────────────────────────────────
        const pin = new PinElement({
            background: "#C9A75C",
            borderColor: "#8C6F2A",
            glyphColor: "#1A1200",
            scale: 1.25,
        });
        const marker = new AdvancedMarkerElement({ map: null, content: pin });
        _marker = marker; // expose to module scope for dismissCard

        // Single geocoder instance — shared by My Location and map click handlers
        const geocoder = new google.maps.Geocoder();

        // ── Search: new Places API ──
        const { AutocompleteSuggestion } = await google.maps.importLibrary("places");

        const input = document.getElementById("search-input");
        const clearBtn = document.getElementById("clear-btn");
        const suggestions = document.getElementById("suggestions-list");

        let debounceTimer = null;
        let activeIndex = -1;
        let currentPreds = [];

        input.addEventListener("input", () => {
            const q = input.value.trim();
            clearBtn.classList.toggle("visible", q.length > 0);
            clearTimeout(debounceTimer);
            if (q.length < 2) { closeDropdown(); return; }

            debounceTimer = setTimeout(async () => {
                try {
                    const { suggestions: preds } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q });
                    if (!preds?.length) { closeDropdown(); return; }
                    currentPreds = preds;
                    renderSuggestions(preds);
                } catch (err) {
                    console.warn("Autocomplete error:", err);
                    closeDropdown();
                }
            }, 220);
        });

        function renderSuggestions(preds) {
            suggestions.innerHTML = "";
            activeIndex = -1;

            preds.slice(0, 6).forEach((pred, i) => {
                const pp = pred.placePrediction;
                const main = pp.mainText?.toString() || pp.text?.toString() || "";
                const sub = pp.secondaryText?.toString() || "";

                const li = document.createElement("li");
                li.className = "suggestion-item";
                li.dataset.index = i;

                li.innerHTML = `
                    <span class="sug-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                    </span>
                    <span class="sug-text">
                        <span class="sug-main">${escapeHtml(main)}</span>
                        ${sub ? `<span class="sug-sub">${escapeHtml(sub)}</span>` : ""}
                    </span>`;

                li.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    selectPlace(i, main);
                });

                suggestions.appendChild(li);
            });

            suggestions.classList.add("open");
        }

        async function selectPlace(predIndex, label) {
            input.value = label;
            clearBtn.classList.add("visible");
            closeDropdown();

            try {
                const place = currentPreds[predIndex].placePrediction.toPlace();
                await place.fetchFields({ fields: ["location", "viewport", "displayName", "formattedAddress"] });

                if (!place.location) { console.warn("No location found."); return; }

                if (place.viewport) {
                    map.fitBounds(place.viewport);
                } else {
                    map.panTo(place.location);
                    map.setZoom(13);
                }

                marker.position = place.location;
                marker.map = map;
                showInfoCard(place);
                input.blur();
            } catch (err) {
                console.warn("Place fetch error:", err);
            }
        }

        input.addEventListener("keydown", (e) => {
            const items = suggestions.querySelectorAll(".suggestion-item");

            if (e.key === "ArrowDown") {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                highlightItem(items);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, -1);
                highlightItem(items);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (items.length > 0) {
                    const target = activeIndex >= 0 ? items[activeIndex] : items[0];
                    selectPlace(parseInt(target.dataset.index), target.querySelector(".sug-main").textContent);
                } else {
                    const q = input.value.trim();
                    if (q.length < 2) return;
                    clearTimeout(debounceTimer);
                    AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q })
                        .then(({ suggestions: preds }) => {
                            if (!preds?.length) return;
                            currentPreds = preds;
                            const pp = preds[0].placePrediction;
                            const label = pp.mainText?.toString() || pp.text?.toString() || q;
                            selectPlace(0, label);
                        })
                        .catch(err => console.warn("Enter search error:", err));
                }
            } else if (e.key === "Escape") {
                closeDropdown(); input.blur();
            }
        });

        function highlightItem(items) {
            items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
        }

        function closeDropdown() {
            suggestions.classList.remove("open");
            suggestions.innerHTML = "";
            activeIndex = -1;
        }

        document.addEventListener("click", (e) => {
            if (!document.getElementById("search-container").contains(e.target)) closeDropdown();
        });

        clearBtn.addEventListener("click", () => {
            input.value = "";
            clearBtn.classList.remove("visible");
            closeDropdown();
            dismissCard();
            input.focus();
        });

        document.getElementById("zoom-in").addEventListener("click", () => map.setZoom(map.getZoom() + 1));
        document.getElementById("zoom-out").addEventListener("click", () => map.setZoom(map.getZoom() - 1));

        let isSatellite = true;
        document.getElementById("map-type-btn").addEventListener("click", () => {
            isSatellite = !isSatellite;
            map.setMapTypeId(isSatellite ? "hybrid" : "roadmap");
            document.getElementById("icon-satellite").style.display = isSatellite ? "block" : "none";
            document.getElementById("icon-map").style.display = isSatellite ? "none" : "block";
        });

        document.getElementById("my-location-btn").addEventListener("click", () => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    const loc = { lat: coords.latitude, lng: coords.longitude };
                    map.panTo(loc); map.setZoom(13);
                    marker.position = loc; marker.map = map;

                    geocoder.geocode({ location: loc }, (results, status) => {
                        if (status !== "OK" || !results[0]) return;

                        const best = results.find(r => r.types.some(t => ["locality", "sublocality", "administrative_area_level_2", "administrative_area_level_1", "country"].includes(t))) || results[0];

                        const get = (type) => best.address_components.find(c => c.types.includes(type))?.long_name || "";

                        const city = get("locality") || get("sublocality") || get("administrative_area_level_2");
                        const region = get("administrative_area_level_1");
                        const country = get("country");

                        const name = city || region || country || "Current Location";
                        const address = [city, region, country].filter(Boolean).join(", ");

                        showInfoCard({
                            displayName: name,
                            formattedAddress: address,
                            location: { lat: () => loc.lat, lng: () => loc.lng },
                        });
                    });
                },
                () => console.warn("Geolocation denied.")
            );
        });

        const { Place } = await google.maps.importLibrary("places");

        map.addListener("click", async (e) => {
            e.stop();

            try {
                if (e.placeId) {
                    const place = new Place({ id: e.placeId });
                    await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "viewport"] });

                    if (!place.location) return;

                    marker.position = place.location;
                    marker.map = map;
                    if (place.viewport) map.fitBounds(place.viewport);
                    else map.panTo(place.location);

                    showInfoCard(place);
                } else {
                    const loc = { lat: e.latLng.lat(), lng: e.latLng.lng() };

                    geocoder.geocode({ location: loc }, (results, status) => {
                        if (status !== "OK" || !results[0]) return;

                        const best = results.find(r => r.types.some(t => ["locality", "sublocality", "administrative_area_level_2", "administrative_area_level_1", "country", "natural_feature", "park"].includes(t))) || results[0];

                        const get = (type) => best.address_components.find(c => c.types.includes(type))?.long_name || "";

                        const city = get("locality") || get("sublocality") || get("administrative_area_level_2");
                        const region = get("administrative_area_level_1");
                        const country = get("country");
                        const name = city || region || country || "Unknown Location";
                        const address = [city, region, country].filter(Boolean).join(", ");

                        marker.position = loc;
                        marker.map = map;

                        showInfoCard({
                            displayName: name,
                            formattedAddress: address,
                            location: { lat: () => loc.lat, lng: () => loc.lng },
                        });
                    });
                }
            } catch (err) {
                console.warn("Map click error:", err);
            }
        });

        const coordsEl = document.getElementById("coords");
        map.addListener("mousemove", (e) => {
            const lat = e.latLng.lat(), lng = e.latLng.lng();
            coordsEl.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}  ·  ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;
        });

        document.getElementById("close-card").addEventListener("click", () => dismissCard());
        initNewsUI(map);

        // All set — dismiss the loading overlay
        const loadingEl = document.getElementById("map-loading");
        loadingEl.classList.add("hidden");
        loadingEl.addEventListener("transitionend", () => loadingEl.remove(), { once: true });

        console.log("Map loaded.");

    } catch (e) {
        console.error("Map init failed:", e.message);
        document.getElementById("map-loading").style.display = "none";
        const errEl = document.getElementById("map-error");
        document.getElementById("map-error-msg").textContent = e.message || "An unexpected error occurred.";
        errEl.style.display = "flex";
    }
}

function showInfoCard(place) {
    document.getElementById("place-name").textContent = place.displayName || "Unknown";
    document.getElementById("place-address").textContent = place.formattedAddress || "";

    const lat = place.location.lat();
    const lng = place.location.lng();
    document.getElementById("place-coords").textContent =
        `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? "N" : "S"},  ${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? "E" : "W"}`;

    document.getElementById("info-card").classList.add("active");
}

function dismissCard() {
    document.getElementById("info-card").classList.remove("active");
    if (_marker) _marker.map = null;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

initMap();


