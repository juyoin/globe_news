// app.js — Atlas | Global Explorer + Live News Layer
// CORS proxies: updated for 2026 with more options to avoid 404/429 hell

// ── News Category Definitions ─────────────────────────────
const NEWS_CATEGORIES = {
    politics: { color: '#5B8EE6', label: 'Politics' },
    conflict: { color: '#E05252', label: 'Conflict' },
    environment: { color: '#4CAF7D', label: 'Environment' },
    economy: { color: '#E6B84A', label: 'Economy' },
    science: { color: '#9B6FE6', label: 'Science' },
    society: { color: '#E67A5B', label: 'Society' },
    disaster: { color: '#E65B8E', label: 'Disaster' },
};

// ── Region Definitions ────────────────────────────────────
const NEWS_REGIONS = {
    americas: { label: 'Americas', icon: '🌎' },
    europe: { label: 'Europe', icon: '🌍' },
    asia: { label: 'Asia-Pacific', icon: '🌏' },
    middleeast: { label: 'Middle East', icon: '🕌' },
    africa: { label: 'Africa', icon: '🌍' },
    oceania: { label: 'Oceania', icon: '🌊' },
};

// ── RSS Feed Sources — grouped by region for coverage balance ─
const RSS_FEEDS = [
    // Global / International
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
    { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian' },
    { url: 'https://feeds.skynews.com/feeds/rss/world.xml', source: 'Sky News' },
    { url: 'https://feeds.bbci.co.uk/news/rss.xml', source: 'BBC News' },
    // Americas / US
    { url: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR' },
    { url: 'https://feeds.npr.org/1004/rss.xml', source: 'NPR World' },
    { url: 'https://www.cbsnews.com/latest/rss/world', source: 'CBS News' },
    { url: 'https://abcnews.go.com/abcnews/topstories', source: 'ABC News' },
    { url: 'https://www.cbc.ca/cmlink/rss-topstories', source: 'CBC Canada' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NY Times World' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml', source: 'NY Times US' },
    // Europe / Middle East / Africa
    { url: 'https://rss.dw.com/rss/en-world', source: 'DW News' },
    { url: 'https://www.euronews.com/rss', source: 'Euronews' },
    { url: 'https://timesofindia.indiatimes.com/rss.cms', source: 'Times of India' },
    // Asia / Pacific
    { url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', source: 'NHK Japan' },
    { url: 'https://feeds.feedburner.com/straitstimesonline/topics/sg', source: 'Straits Times' },
];

// ── CORS Proxy ───────────────────────────────────────────
// allorigins /get returns { contents: "<xml>...", status: { http_code: 200 } }
// This endpoint sets Access-Control-Allow-Origin: * and works from localhost
const ALLORIGINS = (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

// ── Country Spotlight data ────────────────────────────────
// Each entry: Google News RSS params + ISO code + capital fallback coords
const COUNTRIES = [
    { name: 'Afghanistan', code: 'AF', lang: 'fa', gl: 'AF', ceid: 'AF:fa', lat: 34.52, lng: 69.17 },
    { name: 'Argentina', code: 'AR', lang: 'es', gl: 'AR', ceid: 'AR:es', lat: -34.6, lng: -58.4 },
    { name: 'Australia', code: 'AU', lang: 'en', gl: 'AU', ceid: 'AU:en', lat: -35.3, lng: 149.1 },
    { name: 'Austria', code: 'AT', lang: 'de', gl: 'AT', ceid: 'AT:de', lat: 48.2, lng: 16.37 },
    { name: 'Bangladesh', code: 'BD', lang: 'bn', gl: 'BD', ceid: 'BD:bn', lat: 23.72, lng: 90.40 },
    { name: 'Belgium', code: 'BE', lang: 'fr', gl: 'BE', ceid: 'BE:fr', lat: 50.85, lng: 4.35 },
    { name: 'Bolivia', code: 'BO', lang: 'es', gl: 'BO', ceid: 'BO:es', lat: -16.5, lng: -68.15 },
    { name: 'Brazil', code: 'BR', lang: 'pt', gl: 'BR', ceid: 'BR:pt-419', lat: -15.8, lng: -47.9 },
    { name: 'Canada', code: 'CA', lang: 'en', gl: 'CA', ceid: 'CA:en', lat: 45.42, lng: -75.69 },
    { name: 'Chile', code: 'CL', lang: 'es', gl: 'CL', ceid: 'CL:es', lat: -33.45, lng: -70.67 },
    { name: 'China', code: 'CN', lang: 'zh-Hans', gl: 'CN', ceid: 'CN:zh-Hans', lat: 39.9, lng: 116.4 },
    { name: 'Colombia', code: 'CO', lang: 'es', gl: 'CO', ceid: 'CO:es', lat: 4.71, lng: -74.07 },
    { name: 'Czech Republic', code: 'CZ', lang: 'cs', gl: 'CZ', ceid: 'CZ:cs', lat: 50.09, lng: 14.42 },
    { name: 'Denmark', code: 'DK', lang: 'da', gl: 'DK', ceid: 'DK:da', lat: 55.68, lng: 12.57 },
    { name: 'Egypt', code: 'EG', lang: 'ar', gl: 'EG', ceid: 'EG:ar', lat: 30.06, lng: 31.25 },
    { name: 'Ethiopia', code: 'ET', lang: 'en', gl: 'ET', ceid: 'ET:en', lat: 9.03, lng: 38.74 },
    { name: 'Finland', code: 'FI', lang: 'fi', gl: 'FI', ceid: 'FI:fi', lat: 60.17, lng: 24.94 },
    { name: 'France', code: 'FR', lang: 'fr', gl: 'FR', ceid: 'FR:fr', lat: 48.86, lng: 2.35 },
    { name: 'Germany', code: 'DE', lang: 'de', gl: 'DE', ceid: 'DE:de', lat: 52.52, lng: 13.40 },
    { name: 'Ghana', code: 'GH', lang: 'en', gl: 'GH', ceid: 'GH:en', lat: 5.56, lng: -0.20 },
    { name: 'Greece', code: 'GR', lang: 'el', gl: 'GR', ceid: 'GR:el', lat: 37.98, lng: 23.73 },
    { name: 'Hungary', code: 'HU', lang: 'hu', gl: 'HU', ceid: 'HU:hu', lat: 47.50, lng: 19.04 },
    { name: 'India', code: 'IN', lang: 'en', gl: 'IN', ceid: 'IN:en', lat: 28.61, lng: 77.21 },
    { name: 'Indonesia', code: 'ID', lang: 'id', gl: 'ID', ceid: 'ID:id', lat: -6.21, lng: 106.85 },
    { name: 'Iran', code: 'IR', lang: 'fa', gl: 'IR', ceid: 'IR:fa', lat: 35.69, lng: 51.42 },
    { name: 'Iraq', code: 'IQ', lang: 'ar', gl: 'IQ', ceid: 'IQ:ar', lat: 33.34, lng: 44.40 },
    { name: 'Ireland', code: 'IE', lang: 'en', gl: 'IE', ceid: 'IE:en', lat: 53.33, lng: -6.25 },
    { name: 'Israel', code: 'IL', lang: 'he', gl: 'IL', ceid: 'IL:he', lat: 31.77, lng: 35.23 },
    { name: 'Italy', code: 'IT', lang: 'it', gl: 'IT', ceid: 'IT:it', lat: 41.9, lng: 12.48 },
    { name: 'Japan', code: 'JP', lang: 'ja', gl: 'JP', ceid: 'JP:ja', lat: 35.69, lng: 139.69 },
    { name: 'Jordan', code: 'JO', lang: 'ar', gl: 'JO', ceid: 'JO:ar', lat: 31.95, lng: 35.93 },
    { name: 'Kenya', code: 'KE', lang: 'en', gl: 'KE', ceid: 'KE:en', lat: -1.29, lng: 36.82 },
    { name: 'Lebanon', code: 'LB', lang: 'ar', gl: 'LB', ceid: 'LB:ar', lat: 33.89, lng: 35.50 },
    { name: 'Malaysia', code: 'MY', lang: 'ms', gl: 'MY', ceid: 'MY:ms', lat: 3.15, lng: 101.7 },
    { name: 'Mexico', code: 'MX', lang: 'es', gl: 'MX', ceid: 'MX:es', lat: 19.43, lng: -99.13 },
    { name: 'Morocco', code: 'MA', lang: 'fr', gl: 'MA', ceid: 'MA:fr', lat: 33.99, lng: -6.85 },
    { name: 'Netherlands', code: 'NL', lang: 'nl', gl: 'NL', ceid: 'NL:nl', lat: 52.37, lng: 4.90 },
    { name: 'New Zealand', code: 'NZ', lang: 'en', gl: 'NZ', ceid: 'NZ:en', lat: -41.29, lng: 174.78 },
    { name: 'Nigeria', code: 'NG', lang: 'en', gl: 'NG', ceid: 'NG:en', lat: 9.07, lng: 7.40 },
    { name: 'North Korea', code: 'KP', lang: 'ko', gl: 'KR', ceid: 'KR:ko', lat: 39.02, lng: 125.75 },
    { name: 'Norway', code: 'NO', lang: 'no', gl: 'NO', ceid: 'NO:no', lat: 59.91, lng: 10.75 },
    { name: 'Pakistan', code: 'PK', lang: 'ur', gl: 'PK', ceid: 'PK:ur', lat: 33.72, lng: 73.06 },
    { name: 'Peru', code: 'PE', lang: 'es', gl: 'PE', ceid: 'PE:es', lat: -12.05, lng: -77.05 },
    { name: 'Philippines', code: 'PH', lang: 'en', gl: 'PH', ceid: 'PH:en', lat: 14.60, lng: 120.98 },
    { name: 'Poland', code: 'PL', lang: 'pl', gl: 'PL', ceid: 'PL:pl', lat: 52.23, lng: 21.01 },
    { name: 'Portugal', code: 'PT', lang: 'pt', gl: 'PT', ceid: 'PT:pt-150', lat: 38.72, lng: -9.14 },
    { name: 'Romania', code: 'RO', lang: 'ro', gl: 'RO', ceid: 'RO:ro', lat: 44.43, lng: 26.10 },
    { name: 'Russia', code: 'RU', lang: 'ru', gl: 'RU', ceid: 'RU:ru', lat: 55.75, lng: 37.62 },
    { name: 'Saudi Arabia', code: 'SA', lang: 'ar', gl: 'SA', ceid: 'SA:ar', lat: 24.69, lng: 46.72 },
    { name: 'Serbia', code: 'RS', lang: 'sr', gl: 'RS', ceid: 'RS:sr', lat: 44.80, lng: 20.46 },
    { name: 'Singapore', code: 'SG', lang: 'en', gl: 'SG', ceid: 'SG:en', lat: 1.28, lng: 103.85 },
    { name: 'Somalia', code: 'SO', lang: 'so', gl: 'SO', ceid: 'SO:so', lat: 2.05, lng: 45.34 },
    { name: 'South Africa', code: 'ZA', lang: 'en', gl: 'ZA', ceid: 'ZA:en', lat: -25.75, lng: 28.19 },
    { name: 'South Korea', code: 'KR', lang: 'ko', gl: 'KR', ceid: 'KR:ko', lat: 37.57, lng: 126.98 },
    { name: 'Spain', code: 'ES', lang: 'es', gl: 'ES', ceid: 'ES:es', lat: 40.42, lng: -3.70 },
    { name: 'Sudan', code: 'SD', lang: 'ar', gl: 'SD', ceid: 'SD:ar', lat: 15.55, lng: 32.53 },
    { name: 'Sweden', code: 'SE', lang: 'sv', gl: 'SE', ceid: 'SE:sv', lat: 59.33, lng: 18.07 },
    { name: 'Switzerland', code: 'CH', lang: 'de', gl: 'CH', ceid: 'CH:de', lat: 46.95, lng: 7.45 },
    { name: 'Syria', code: 'SY', lang: 'ar', gl: 'SY', ceid: 'SY:ar', lat: 33.51, lng: 36.29 },
    { name: 'Taiwan', code: 'TW', lang: 'zh-Hant', gl: 'TW', ceid: 'TW:zh-Hant', lat: 25.04, lng: 121.56 },
    { name: 'Thailand', code: 'TH', lang: 'th', gl: 'TH', ceid: 'TH:th', lat: 13.75, lng: 100.52 },
    { name: 'Turkey', code: 'TR', lang: 'tr', gl: 'TR', ceid: 'TR:tr', lat: 39.93, lng: 32.86 },
    { name: 'Uganda', code: 'UG', lang: 'en', gl: 'UG', ceid: 'UG:en', lat: 0.32, lng: 32.58 },
    { name: 'Ukraine', code: 'UA', lang: 'uk', gl: 'UA', ceid: 'UA:uk', lat: 50.45, lng: 30.52 },
    { name: 'United Kingdom', code: 'GB', lang: 'en', gl: 'GB', ceid: 'GB:en', lat: 51.51, lng: -0.13 },
    { name: 'United States', code: 'US', lang: 'en', gl: 'US', ceid: 'US:en', lat: 38.89, lng: -77.04 },
    { name: 'Venezuela', code: 'VE', lang: 'es', gl: 'VE', ceid: 'VE:es', lat: 10.49, lng: -66.88 },
    { name: 'Vietnam', code: 'VN', lang: 'vi', gl: 'VN', ceid: 'VN:vi', lat: 21.03, lng: 105.85 },
    { name: 'Yemen', code: 'YE', lang: 'ar', gl: 'YE', ceid: 'YE:ar', lat: 15.35, lng: 44.21 },
    { name: 'Zimbabwe', code: 'ZW', lang: 'en', gl: 'ZW', ceid: 'ZW:en', lat: -17.83, lng: 31.05 },
];

// ── Default filter state ──────────────────────────────────
const DEFAULT_FILTERS = {
    count: 30,
    categories: new Set(Object.keys(NEWS_CATEGORIES)),
    regions: new Set(Object.keys(NEWS_REGIONS)),
};

// ── Gemini API Key ────────────────────────────────────────
const GEMINI_API_KEY = 'AIzaSyCW38_XjSK7XG_r9WL7fbPmt3xqfvsKfAE';

// ── Module-level state ────────────────────────────────────
let _marker = null;
let _geocoder = null;
let _map = null;
let _AME = null;   // AdvancedMarkerElement constructor
let _newsVisible = true;

// All fetched+geocoded news; markers toggled by filters
let _allNewsData = [];   // [{ item, marker }]
let _activeFilters = {
    count: DEFAULT_FILTERS.count,
    categories: new Set(DEFAULT_FILTERS.categories),
    regions: new Set(DEFAULT_FILTERS.regions),
};

// Country spotlight state
let _spotlightData = [];  // [{ item, marker }] for country spotlight
let _spotlightCountry = null; // currently active country object

// ── Region detection from coordinates ────────────────────
function getRegion(lat, lng) {
    if (lng <= -30) return 'americas';
    if (lat > 12 && lat < 44 && lng > 25 && lng < 65) return 'middleeast';
    if (lat > -38 && lat < 40 && lng > -20 && lng < 55) return 'africa';
    if (lat > 35 && lat < 72 && lng > -12 && lng < 45) return 'europe';
    if (lat < -10 && lng > 100 && lng < 180) return 'oceania';
    return 'asia';
}

// ── Fetch RSS via allorigins (returns XML text) ──────────
async function fetchRSS(url) {
    try {
        const res = await fetch(ALLORIGINS(url), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status?.http_code >= 400) throw new Error(`Upstream ${data.status.http_code}`);
        return data.contents || null;
    } catch (err) {
        console.warn(`fetchRSS failed for ${url}: ${err.message}`);
        return null;
    }
}

// ── Clean RSS description ─────────────────────────────────
function cleanDescription(desc) {
    return desc.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

// ── Process batch with Gemini ─────────────────────────────
async function processNewsBatch(rawArticles) {
    const categoriesList = Object.keys(NEWS_CATEGORIES).join(', ');
    const prompt = `Translate these articles to English, summarize each in one sentence, extract the specific city mentioned (if none or ambiguous, skip the article), provide the exact latitude and longitude for that city as numbers, and classify the category as one of: ${categoriesList}. Return the result strictly as a JSON array of objects, each with: "title" (translated), "summary", "location", "lat" (number), "lng" (number), "category". Only include articles with a valid specific location.

Articles:
${rawArticles.map((a, i) => `${i + 1}. Title: ${a.title}\nDescription: ${a.desc}`).join('\n\n')}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Gemini HTTP error: ${response.status} - ${errText}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates.length) {
            console.error('Gemini response missing candidates:', data);
            throw new Error('No candidates in response');
        }

        let jsonText = data.candidates[0].content.parts[0].text;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonText);
    } catch (err) {
        console.error('Gemini process error:', err);
        return [];
    }
}

// ── Fetch and process global news with Gemini ─────────────
async function fetchGlobalNews() {
    const rawItems = [];
    for (const feed of RSS_FEEDS) {
        try {
            const xml = await fetchRSS(feed.url);
            if (!xml) continue; // Skip bad feeds
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const items = Array.from(doc.querySelectorAll('item'));
            for (const item of items) {
                const title = item.querySelector('title')?.textContent?.trim() || '';
                const desc = cleanDescription(item.querySelector('description')?.textContent || '');
                const link = item.querySelector('link')?.textContent?.trim() || '';
                const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
                if (title && desc) {
                    rawItems.push({ title, desc, link, pubDate, source: feed.source });
                }
            }
        } catch { }
    }

    // Cap at 40 items to avoid burning Gemini quota
    const capped = rawItems.slice(0, 40);

    // Batch into groups of 10 (larger = fewer API calls)
    const batches = [];
    for (let i = 0; i < capped.length; i += 10) {
        batches.push(capped.slice(i, i + 10));
    }

    // Process batches SEQUENTIALLY with a delay to avoid rate limiting
    const processedBatches = [];
    for (let i = 0; i < batches.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 2000)); // 2s between calls
        processedBatches.push(await processNewsBatch(batches[i]));
    }
    let processedItems = processedBatches.flat();

    // Add back region; source/link/pubDate come directly from Gemini's p object
    processedItems = processedItems.map((p) => ({
        ...p,
        desc: p.summary,
        region: getRegion(p.lat, p.lng),
        source: p.source || capped.find(r => r.title === p.title)?.source || 'Unknown',
        link: p.link || capped.find(r => r.title === p.title)?.link || '',
        pubDate: p.pubDate || capped.find(r => r.title === p.title)?.pubDate || '',
    }));

    // Dedupe by link, sort by date, take top 120
    const unique = processedItems.filter((item, i, arr) => arr.findIndex(t => t.link === item.link) === i);
    unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    return unique.slice(0, 120);
}

// ── Fetch and process country spotlight news with Gemini ──
async function fetchCountryNews(country) {
    const url = `https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=${country.lang}&gl=${country.gl}&ceid=${country.ceid}`;
    const rawItems = [];
    try {
        const xml = await fetchRSS(url);
        if (!xml) return [];
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const items = Array.from(doc.querySelectorAll('item'));
        for (const item of items) {
            const title = item.querySelector('title')?.textContent?.trim() || '';
            const desc = cleanDescription(item.querySelector('description')?.textContent || '');
            const link = item.querySelector('link')?.textContent?.trim() || '';
            const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
            if (title && desc) {
                rawItems.push({ title, desc, link, pubDate, source: 'Google News' });
            }
        }
    } catch (err) {
        console.error('Country RSS error:', err);
        return [];
    }

    // Cap, batch into 10s, process sequentially
    const capped = rawItems.slice(0, 30);
    const batches = [];
    for (let i = 0; i < capped.length; i += 10) {
        batches.push(capped.slice(i, i + 10));
    }
    const processedBatches = [];
    for (let i = 0; i < batches.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 2000));
        processedBatches.push(await processNewsBatch(batches[i]));
    }
    let processedItems = processedBatches.flat();

    processedItems = processedItems.map((p, idx) => {
        const original = rawItems[idx];
        return {
            ...p,
            desc: p.summary,
            source: original?.source || 'Google News',
            pubDate: original?.pubDate || '',
            link: original?.link || '',
            region: getRegion(p.lat, p.lng)
        };
    });

    // Dedupe, sort, take top 100 for spotlight
    const unique = processedItems.filter((item, i, arr) => arr.findIndex(t => t.link === item.link) === i);
    unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    return unique.slice(0, 100);
}

// ── Create news marker element ────────────────────────────
function createNewsMarkerEl(category) {
    const el = document.createElement('div');
    el.className = 'news-marker';
    el.innerHTML = `
        <div class="news-dot" style="--cat-color: ${NEWS_CATEGORIES[category]?.color || '#E67A5B'}"></div>
        <div class="news-ring" style="--cat-color: ${NEWS_CATEGORIES[category]?.color || '#E67A5B'}"></div>
    `;
    return el;
}

// ── Create spotlight marker element ───────────────────────
function createSpotlightMarkerEl(category) {
    const el = document.createElement('div');
    el.className = 'spotlight-marker';
    el.innerHTML = `
        <div class="spotlight-diamond" style="--cat-color: ${NEWS_CATEGORIES[category]?.color || '#E67A5B'}"></div>
        <div class="spotlight-ring" style="--cat-color: ${NEWS_CATEGORIES[category]?.color || '#E67A5B'}"></div>
    `;
    return el;
}

// ── Show tooltip ──────────────────────────────────────────
function showTooltip(text, x, y) {
    const tooltip = document.getElementById('news-tooltip');
    tooltip.textContent = text;
    tooltip.style.left = `${x + 16}px`;
    tooltip.style.top = `${y - 8}px`;
    tooltip.classList.add('visible');
}

function moveTooltip(x, y) {
    const tooltip = document.getElementById('news-tooltip');
    tooltip.style.left = `${x + 16}px`;
    tooltip.style.top = `${y - 8}px`;
}

function hideTooltip() {
    document.getElementById('news-tooltip').classList.remove('visible');
}

// ── Show news card ────────────────────────────────────────
function showNewsCard(item) {
    const card = document.getElementById('info-card');
    const modeLabel = document.getElementById('card-mode-label');
    const placeName = document.getElementById('place-name');
    const placeAddress = document.getElementById('place-address');
    const newsSection = document.getElementById('news-card-section');
    const categoryBadge = document.getElementById('news-category-badge');
    const sourceTag = document.getElementById('news-source-tag');
    const summary = document.getElementById('news-summary');
    const readMore = document.getElementById('news-read-more');
    const coords = document.getElementById('place-coords');

    modeLabel.textContent = 'NEWS STORY';
    placeName.textContent = item.title;
    placeAddress.textContent = item.location;
    categoryBadge.textContent = NEWS_CATEGORIES[item.category]?.label || 'Society';
    categoryBadge.style.borderColor = NEWS_CATEGORIES[item.category]?.color || '#E67A5B';
    categoryBadge.style.color = NEWS_CATEGORIES[item.category]?.color || '#E67A5B';
    categoryBadge.style.background = `color-mix(in srgb, ${NEWS_CATEGORIES[item.category]?.color || '#E67A5B'} 10%, transparent)`;
    sourceTag.textContent = item.source;
    summary.textContent = item.desc;
    if (item.link) {
        readMore.href = item.link;
        readMore.style.display = 'inline-flex';
    } else {
        readMore.style.display = 'none';
    }
    coords.textContent = `${item.lat.toFixed(4)}° N  ·  ${item.lng.toFixed(4)}° E`;
    newsSection.style.display = 'block';
    card.classList.add('active');
}

// ── Show info card for places ─────────────────────────────
function showInfoCard(place) {
    const card = document.getElementById('info-card');
    const modeLabel = document.getElementById('card-mode-label');
    const placeName = document.getElementById('place-name');
    const placeAddress = document.getElementById('place-address');
    const newsSection = document.getElementById('news-card-section');
    const coords = document.getElementById('place-coords');

    modeLabel.textContent = 'DESTINATION';
    placeName.textContent = place.displayName || 'Unknown';
    placeAddress.textContent = place.formattedAddress || '—';
    coords.textContent = `${place.location.lat().toFixed(4)}° N  ·  ${place.location.lng().toFixed(4)}° E`;
    newsSection.style.display = 'none';
    card.classList.add('active');
}

// ── Dismiss card ──────────────────────────────────────────
function dismissCard() {
    const card = document.getElementById('info-card');
    card.classList.remove('active');
    _marker.map = null;
}

// ── Apply filters to markers ──────────────────────────────
function applyFilters() {
    const counter = document.getElementById('news-counter');
    let visibleCount = 0;

    _allNewsData.forEach(({ item, marker }) => {
        const visible = _newsVisible &&
            _activeFilters.categories.has(item.category) &&
            _activeFilters.regions.has(item.region);
        marker.map = visible ? _map : null;
        if (visible) visibleCount++;
    });

    _spotlightData.forEach(({ item, marker }) => {
        const visible = _newsVisible &&
            _activeFilters.categories.has(item.category) &&
            _activeFilters.regions.has(item.region);
        marker.map = visible ? _map : null;
        if (visible) visibleCount++;
    });

    counter.textContent = Math.min(visibleCount, _activeFilters.count);
}

// ── Init customize panel ──────────────────────────────────
function initCustomizePanel() {
    const panel = document.getElementById('customize-panel');
    const customizeBtn = document.getElementById('customize-btn');
    const closeBtn = document.getElementById('customize-close');
    const countBtns = document.querySelectorAll('.count-btn');
    const catsGrid = document.getElementById('customize-categories');
    const regsGrid = document.getElementById('customize-regions');
    const catsAll = document.getElementById('cats-all');
    const catsNone = document.getElementById('cats-none');
    const regsAll = document.getElementById('regs-all');
    const regsNone = document.getElementById('regs-none');

    customizeBtn.addEventListener('click', () => {
        panel.classList.toggle('open');
        customizeBtn.classList.toggle('active');
    });
    closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
        customizeBtn.classList.remove('active');
    });

    // Count buttons
    countBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            countBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _activeFilters.count = parseInt(btn.dataset.count);
            applyFilters();
        });
    });

    // Categories chips
    for (const [key, { color, label }] of Object.entries(NEWS_CATEGORIES)) {
        const chip = document.createElement('button');
        chip.className = 'filter-chip';
        chip.dataset.key = key;
        chip.innerHTML = `<span class="chip-dot" style="--chip-color: ${color}"></span>${label}`;
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            _activeFilters.categories[_activeFilters.categories.has(key) ? 'delete' : 'add'](key);
            applyFilters();
        });
        chip.classList.add('active'); // Default on
        catsGrid.appendChild(chip);
    }

    // Regions chips
    for (const [key, { label, icon }] of Object.entries(NEWS_REGIONS)) {
        const chip = document.createElement('button');
        chip.className = 'filter-chip region-chip';
        chip.dataset.key = key;
        chip.innerHTML = `${icon} ${label}`;
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            _activeFilters.regions[_activeFilters.regions.has(key) ? 'delete' : 'add'](key);
            applyFilters();
        });
        chip.classList.add('active'); // Default on
        regsGrid.appendChild(chip);
    }

    // Bulk actions
    catsAll.addEventListener('click', () => toggleAll(catsGrid, true, 'categories'));
    catsNone.addEventListener('click', () => toggleAll(catsGrid, false, 'categories'));
    regsAll.addEventListener('click', () => toggleAll(regsGrid, true, 'regions'));
    regsNone.addEventListener('click', () => toggleAll(regsGrid, false, 'regions'));

    function toggleAll(grid, state, filterType) {
        grid.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', state);
            const key = chip.dataset.key;
            _activeFilters[filterType][state ? 'add' : 'delete'](key);
        });
        applyFilters();
    }

    // Country spotlight
    const countryInput = document.getElementById('country-search-input');
    const countryDropdown = document.getElementById('country-dropdown');
    const spotlightTag = document.getElementById('spotlight-active-tag');
    const spotlightName = document.getElementById('spotlight-country-name');
    const spotlightClear = document.getElementById('spotlight-clear-btn');
    const spotlightStatus = document.getElementById('spotlight-status');

    function renderCountryDropdown(query) {
        countryDropdown.innerHTML = '';
        const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
        if (!filtered.length) {
            const li = document.createElement('li');
            li.className = 'country-item no-result';
            li.textContent = 'No matches';
            countryDropdown.appendChild(li);
        } else {
            filtered.forEach(country => {
                const li = document.createElement('li');
                li.className = 'country-item';
                li.textContent = country.name;
                li.addEventListener('click', () => activateSpotlight(country));
                countryDropdown.appendChild(li);
            });
        }
        countryDropdown.classList.add('open');
    }

    countryInput.addEventListener('focus', () => renderCountryDropdown(countryInput.value));
    countryInput.addEventListener('input', () => renderCountryDropdown(countryInput.value));
    countryInput.addEventListener('blur', () => setTimeout(() => countryDropdown.classList.remove('open'), 150));

    spotlightClear.addEventListener('click', () => {
        clearSpotlight();
        countryInput.value = '';
    });

    async function activateSpotlight(country) {
        clearSpotlight();
        _spotlightCountry = country;
        spotlightName.textContent = country.name;
        spotlightTag.style.display = 'inline-flex';
        spotlightClear.style.display = 'inline-flex';
        countryDropdown.classList.remove('open');
        countryInput.value = '';
        spotlightStatus.textContent = 'Fetching news...';
        spotlightStatus.classList.add('visible');

        let newsItems;
        try {
            newsItems = await fetchCountryNews(country);
        } catch (err) {
            console.error('Spotlight fetch error:', err);
            spotlightStatus.textContent = 'Failed to fetch';
            setTimeout(() => spotlightStatus.classList.remove('visible'), 3000);
            return;
        }

        spotlightStatus.classList.remove('visible');

        newsItems.forEach(item => {
            const el = createSpotlightMarkerEl(item.category);
            const marker = new _AME({
                map: null,
                position: { lat: item.lat, lng: item.lng },
                content: el,
                title: item.title,
                zIndex: 10,
            });

            el.addEventListener('mouseenter', (e) => showTooltip(item.title, e.clientX, e.clientY));
            el.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
            el.addEventListener('mouseleave', () => hideTooltip());
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                hideTooltip();
                dismissCard();
                showNewsCard(item);
            });

            _spotlightData.push({ item, marker });
        });

        applyFilters();
        _map.panTo({ lat: country.lat, lng: country.lng });
        _map.setZoom(5);
    }

    function clearSpotlight() {
        _spotlightData.forEach(({ marker }) => { marker.map = null; });
        _spotlightData = [];
        _spotlightCountry = null;
        spotlightTag.style.display = 'none';
        spotlightClear.style.display = 'none';
        applyFilters();
    }
}

// ── News Layer Init ───────────────────────────────────────
async function initNewsLayer() {
    const status = document.getElementById('news-status');
    const counter = document.getElementById('news-counter');

    // Clear any existing markers
    _allNewsData.forEach(({ marker }) => { marker.map = null; });
    _allNewsData = [];

    status.textContent = 'Fetching live news…';
    status.classList.add('visible');
    counter.classList.remove('visible');

    let newsItems = [];
    try {
        newsItems = await fetchGlobalNews();
    } catch (err) {
        console.error('News fetch error:', err);
        status.textContent = `News unavailable: ${err.message}`;
        setTimeout(() => status.classList.remove('visible'), 5000);
        return;
    }

    status.classList.remove('visible');

    // Create all markers (initially hidden — applyFilters() will show the right ones)
    newsItems.forEach((item) => {
        const el = createNewsMarkerEl(item.category);
        const marker = new _AME({
            map: null,
            position: { lat: item.lat, lng: item.lng },
            content: el,
            title: item.title,
            zIndex: 5,
        });

        el.addEventListener('mouseenter', (e) => showTooltip(item.title, e.clientX, e.clientY));
        el.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
        el.addEventListener('mouseleave', () => hideTooltip());
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            hideTooltip();
            dismissCard();
            showNewsCard(item);
        });

        _allNewsData.push({ item, marker });
    });

    counter.classList.add('visible');
    applyFilters(); // show according to current filters

    console.log(`News layer: ${newsItems.length} stories fetched, filters applied.`);
}

// ── Main Map Init ─────────────────────────────────────────
async function initMap() {
    try {
        const { Map } = await google.maps.importLibrary('maps');
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');

        _AME = AdvancedMarkerElement;

        const map = new Map(document.getElementById('map'), {
            center: { lat: 20, lng: 10 }, zoom: 2.8,
            mapTypeId: 'hybrid', mapId: 'c5c4e760881f738038c2baa1',
            zoomControl: false, mapTypeControl: false, scaleControl: false,
            streetViewControl: false, rotateControl: false, fullscreenControl: false,
            gestureHandling: 'auto', clickableIcons: true,
        });
        _map = map;

        const mapEl = document.getElementById('map');
        map.addListener('mousedown', () => mapEl.classList.add('is-dragging'));
        map.addListener('mouseup', () => mapEl.classList.remove('is-dragging'));
        mapEl.addEventListener('touchend', () => mapEl.classList.remove('is-dragging'));

        const pin = new PinElement({ background: '#C9A75C', borderColor: '#8C6F2A', glyphColor: '#1A1200', scale: 1.25 });
        _marker = new AdvancedMarkerElement({ map: null, content: pin });
        _geocoder = new google.maps.Geocoder();

        // ── Search ─────────────────────────────────────────
        const { AutocompleteSuggestion } = await google.maps.importLibrary('places');
        const input = document.getElementById('search-input');
        const clearBtn = document.getElementById('clear-btn');
        const suggestions = document.getElementById('suggestions-list');
        let debounceTimer = null, activeIndex = -1, currentPreds = [];

        input.addEventListener('input', () => {
            const q = input.value.trim();
            clearBtn.classList.toggle('visible', q.length > 0);
            clearTimeout(debounceTimer);
            if (q.length < 2) { closeDropdown(); return; }
            debounceTimer = setTimeout(async () => {
                try {
                    const { suggestions: preds } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q });
                    if (!preds?.length) { closeDropdown(); return; }
                    currentPreds = preds; renderSuggestions(preds);
                } catch { closeDropdown(); }
            }, 220);
        });

        function renderSuggestions(preds) {
            suggestions.innerHTML = ''; activeIndex = -1;
            preds.slice(0, 6).forEach((pred, i) => {
                const pp = pred.placePrediction;
                const main = pp.mainText?.toString() || pp.text?.toString() || '';
                const sub = pp.secondaryText?.toString() || '';
                const li = document.createElement('li');
                li.className = 'suggestion-item'; li.dataset.index = i;
                li.innerHTML = `<span class="sug-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span><span class="sug-text"><span class="sug-main">${escapeHtml(main)}</span>${sub ? `<span class="sug-sub">${escapeHtml(sub)}</span>` : ''}</span>`;
                li.addEventListener('mousedown', (e) => { e.preventDefault(); selectPlace(i, main); });
                suggestions.appendChild(li);
            });
            suggestions.classList.add('open');
        }

        async function selectPlace(predIndex, label) {
            input.value = label; clearBtn.classList.add('visible'); closeDropdown();
            try {
                const place = currentPreds[predIndex].placePrediction.toPlace();
                await place.fetchFields({ fields: ['location', 'viewport', 'displayName', 'formattedAddress'] });
                if (!place.location) return;
                if (place.viewport) map.fitBounds(place.viewport);
                else { map.panTo(place.location); map.setZoom(13); }
                _marker.position = place.location; _marker.map = map;
                showInfoCard(place); input.blur();
            } catch (err) { console.warn('Place fetch error:', err); }
        }

        input.addEventListener('keydown', (e) => {
            const items = suggestions.querySelectorAll('.suggestion-item');
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); highlightItem(items); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, -1); highlightItem(items); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (items.length > 0) {
                    const target = activeIndex >= 0 ? items[activeIndex] : items[0];
                    selectPlace(parseInt(target.dataset.index), target.querySelector('.sug-main').textContent);
                } else {
                    const q = input.value.trim(); if (q.length < 2) return;
                    clearTimeout(debounceTimer);
                    AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q })
                        .then(({ suggestions: preds }) => { if (!preds?.length) return; currentPreds = preds; const pp = preds[0].placePrediction; selectPlace(0, pp.mainText?.toString() || pp.text?.toString() || q); })
                        .catch(err => console.warn(err));
                }
            } else if (e.key === 'Escape') { closeDropdown(); input.blur(); }
        });

        function highlightItem(items) { items.forEach((el, i) => el.classList.toggle('active', i === activeIndex)); }
        function closeDropdown() { suggestions.classList.remove('open'); suggestions.innerHTML = ''; activeIndex = -1; }
        document.addEventListener('click', (e) => {
            if (!document.getElementById('search-container').contains(e.target)) closeDropdown();
            if (!document.getElementById('customize-panel').contains(e.target) &&
                !document.getElementById('customize-btn').contains(e.target)) {
                document.getElementById('customize-panel').classList.remove('open');
            }
        });
        clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.classList.remove('visible'); closeDropdown(); dismissCard(); input.focus(); });

        // ── Map controls ───────────────────────────────────
        document.getElementById('zoom-in').addEventListener('click', () => map.setZoom(map.getZoom() + 1));
        document.getElementById('zoom-out').addEventListener('click', () => map.setZoom(map.getZoom() - 1));

        let isSatellite = true;
        document.getElementById('map-type-btn').addEventListener('click', () => {
            isSatellite = !isSatellite;
            map.setMapTypeId(isSatellite ? 'hybrid' : 'roadmap');
            document.getElementById('icon-satellite').style.display = isSatellite ? 'block' : 'none';
            document.getElementById('icon-map').style.display = isSatellite ? 'none' : 'block';
        });

        document.getElementById('my-location-btn').addEventListener('click', () => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(({ coords }) => {
                const loc = { lat: coords.latitude, lng: coords.longitude };
                map.panTo(loc); map.setZoom(13); _marker.position = loc; _marker.map = map;
                _geocoder.geocode({ location: loc }, (results, status) => {
                    if (status !== 'OK' || !results[0]) return;
                    const best = results.find(r => r.types.some(t => ['locality', 'sublocality', 'administrative_area_level_2', 'administrative_area_level_1', 'country'].includes(t))) || results[0];
                    const get = (t) => best.address_components.find(c => c.types.includes(t))?.long_name || '';
                    const city = get('locality') || get('sublocality') || get('administrative_area_level_2');
                    const region = get('administrative_area_level_1'), country = get('country');
                    showInfoCard({ displayName: city || region || country || 'Current Location', formattedAddress: [city, region, country].filter(Boolean).join(', '), location: { lat: () => loc.lat, lng: () => loc.lng } });
                });
            }, () => console.warn('Geolocation denied.'));
        });

        // News layer toggle
        document.getElementById('news-toggle-btn').onclick = () => {
            _newsVisible = !_newsVisible;
            document.getElementById('news-toggle-btn').classList.toggle('active', _newsVisible);
            document.getElementById('news-counter').classList.toggle('visible', _newsVisible);
            applyFilters();
        };

        // Refresh news
        document.getElementById('news-refresh-btn').onclick = () => initNewsLayer();

        // ── Map click ──────────────────────────────────────
        const { Place } = await google.maps.importLibrary('places');
        map.addListener('click', async (e) => {
            e.stop();
            try {
                if (e.placeId) {
                    const place = new Place({ id: e.placeId });
                    await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'viewport'] });
                    if (!place.location) return;
                    _marker.position = place.location; _marker.map = map;
                    if (place.viewport) map.fitBounds(place.viewport); else map.panTo(place.location);
                    showInfoCard(place);
                } else {
                    const loc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                    _geocoder.geocode({ location: loc }, (results, status) => {
                        if (status !== 'OK' || !results[0]) return;
                        const best = results.find(r => r.types.some(t => ['locality', 'sublocality', 'administrative_area_level_2', 'administrative_area_level_1', 'country', 'natural_feature', 'park'].includes(t))) || results[0];
                        const get = (t) => best.address_components.find(c => c.types.includes(t))?.long_name || '';
                        const city = get('locality') || get('sublocality') || get('administrative_area_level_2');
                        const region = get('administrative_area_level_1'), country = get('country');
                        _marker.position = loc; _marker.map = map;
                        showInfoCard({ displayName: city || region || country || 'Unknown Location', formattedAddress: [city, region, country].filter(Boolean).join(', '), location: { lat: () => loc.lat, lng: () => loc.lng } });
                    });
                }
            } catch (err) { console.warn('Map click error:', err); }
        });

        // ── Coordinate HUD ─────────────────────────────────
        const coordsEl = document.getElementById('coords');
        map.addListener('mousemove', (e) => {
            const lat = e.latLng.lat(), lng = e.latLng.lng();
            coordsEl.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}  ·  ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
        });

        document.getElementById('close-card').addEventListener('click', () => dismissCard());

        // ── Legend ─────────────────────────────────────────
        document.getElementById('legend-toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('news-legend').classList.toggle('open');
        });

        // Dismiss loading overlay
        const loadingEl = document.getElementById('map-loading');
        loadingEl.classList.add('hidden');
        loadingEl.addEventListener('transitionend', () => loadingEl.remove(), { once: true });

        // Boot news system
        initCustomizePanel();
        initNewsLayer();

        console.log('Atlas map loaded.');
    } catch (e) {
        console.error('Map init failed:', e.message);
        document.getElementById('map-loading').style.display = 'none';
        document.getElementById('map-error-msg').textContent = e.message || 'An unexpected error occurred.';
        document.getElementById('map-error').style.display = 'flex';
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

initMap();