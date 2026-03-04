// app.js - FULL FILE with mods for better POI interaction reliability (2026 reality)

// Note: Native POI hover BLUE GLOW is often broken/missing in JS API vector maps (clickableIcons gives cursor only).
// This is GOOGLE'S limitation, not your fuckup. See release notes 2026: hover cards gutted in Embed, inconsistent in JS.
// We keep clickableIcons:true for pointer + click placeId. No reliable hover color hook exists without custom fake labels.

// Module-level marker reference so dismissCard doesn't require it as a parameter
let _marker = null;

async function initMap() {
    try {
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

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