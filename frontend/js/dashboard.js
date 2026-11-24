
document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // CONFIGURATION
    // ==========================================

    const API_BASE = "/api";

    const GEOCODING_API =
        "https://geocoding-api.open-meteo.com/v1/search";

    const WEATHER_API =
        "https://api.open-meteo.com/v1/forecast";

    const DEFAULT_LOCATION = {
        name: "Pune",
        latitude: 18.5204,
        longitude: 73.8567
    };

    // ==========================================
    // DOM ELEMENTS
    // ==========================================

    const currentDate = document.getElementById("currentDate");

    const locationInput = document.getElementById("locationInput");
    const searchLocationBtn = document.getElementById("searchLocationBtn");
    const clearLocationBtn = document.getElementById("clearLocationBtn");
    const searchMessage = document.getElementById("searchMessage");

    const selectedLocation = document.getElementById("selectedLocation");
    const selectedLocationName = document.getElementById("selectedLocationName");

    const weatherCondition = document.getElementById("weatherCondition");
    const weatherLocation = document.getElementById("weatherLocation");
    const weatherUpdated = document.getElementById("weatherUpdated");

    const rainfallElement = document.getElementById("rainfall");
    const temperatureElement = document.getElementById("temperature");
    const humidityElement = document.getElementById("humidity");
    const riskLevelElement = document.getElementById("riskLevel");
    const rainfall7dElement = document.getElementById("rainfall7d");
    const windSpeedElement = document.getElementById("windSpeed");
    const assessmentScoreElement = document.getElementById("assessmentScore");
    const assessmentMethodElement = document.getElementById("assessmentMethod");
    const riskFactorsElement = document.getElementById("riskFactors");

    const mapStatus = document.getElementById("mapStatus");
    const mapCoordinates = document.getElementById("mapCoordinates");

    const alertsContainer = document.getElementById("alertsContainer");
    const analyticsContainer = document.getElementById("analyticsContainer");

    // ==========================================
    // STATE
    // ==========================================

    let map = null;
    let marker = null;
    let currentLocation = null;

    let currentAssessment = null;
    let currentWeather = null;

    let searchRequestNumber = 0;

    // ==========================================
    // DATE
    // ==========================================

    if (currentDate) {
        currentDate.textContent = new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function showMessage(message, type = "") {
        if (!searchMessage) return;

        searchMessage.textContent = message;
        searchMessage.className = "search-message";

        if (type) {
            searchMessage.classList.add(type);
        }
    }

    function setSearchLoading(loading) {
        if (searchLocationBtn) {
            searchLocationBtn.disabled = loading;
            searchLocationBtn.textContent = loading
                ? "Loading..."
                : "Search Location";
        }
    }

    function formatNumber(value, decimals = 1) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number.toFixed(decimals)
            : "--";
    }

    // ==========================================
    // WEATHER DESCRIPTION
    // ==========================================

    function getWeatherDescription(code) {
        const descriptions = {
            0: "Clear sky",
            1: "Mainly clear",
            2: "Partly cloudy",
            3: "Overcast",
            45: "Fog",
            48: "Depositing rime fog",
            51: "Light drizzle",
            53: "Moderate drizzle",
            55: "Dense drizzle",
            61: "Slight rain",
            63: "Moderate rain",
            65: "Heavy rain",
            71: "Slight snowfall",
            73: "Moderate snowfall",
            75: "Heavy snowfall",
            80: "Slight rain showers",
            81: "Moderate rain showers",
            82: "Violent rain showers",
            95: "Thunderstorm",
            96: "Thunderstorm with hail",
            99: "Severe thunderstorm with hail"
        };

        return descriptions[code] || "Weather information unavailable";
    }

    // ==========================================
    // RESET WEATHER
    // ==========================================

    function resetWeather() {
        if (weatherCondition) {
            weatherCondition.textContent = "Waiting for location";
        }

        if (weatherLocation) {
            weatherLocation.textContent = "No location selected";
        }

        if (weatherUpdated) {
            weatherUpdated.textContent = "Not updated";
        }

        if (rainfallElement) rainfallElement.textContent = "--";
        if (temperatureElement) temperatureElement.textContent = "--";
        if (humidityElement) humidityElement.textContent = "--";
        if (rainfall7dElement) rainfall7dElement.innerHTML = `--<small> mm</small>`;
        if (windSpeedElement) windSpeedElement.innerHTML = `--<small> km/h</small>`;
        if (assessmentScoreElement) assessmentScoreElement.innerHTML = `--<small> / 85</small>`;
        if (assessmentMethodElement) assessmentMethodElement.textContent = "Run a location assessment to view the method.";
        if (riskFactorsElement) riskFactorsElement.innerHTML = "<li>Search for a location to calculate its screening indicators.</li>";

        if (riskLevelElement) {
            riskLevelElement.textContent = "Unassessed";
            riskLevelElement.style.color = "";
        }

        currentWeather = null;
        currentAssessment = null;
    }

    // ==========================================
    // GEOCODING
    // ==========================================

    async function getCoordinates(city) {
        const url = new URL(GEOCODING_API);

        url.search = new URLSearchParams({
            name: city,
            count: "1",
            language: "en",
            format: "json"
        });

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Unable to search for this location.");
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error("Location not found. Try another city.");
        }

        const place = data.results[0];

        const locationParts = [
            place.name,
            place.admin1,
            place.country
        ].filter(Boolean);

        return {
            name: place.name,
            label: [...new Set(locationParts)].join(", "),
            latitude: place.latitude,
            longitude: place.longitude
        };
    }

    // ==========================================
    // GET WEATHER AND 7-DAY RAINFALL DATA
    // ==========================================

    async function getWeather(latitude, longitude) {
        const url = new URL(WEATHER_API);

        url.search = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),

            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "rain",
                "weather_code",
                "wind_speed_10m"
            ].join(","),

            hourly: "precipitation",

            past_days: "7",
            forecast_days: "1",

            timezone: "auto",
            temperature_unit: "celsius",
            precipitation_unit: "mm",
            wind_speed_unit: "kmh"
        });

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Unable to retrieve weather information.");
        }

        const data = await response.json();

        if (!data.current || !data.hourly) {
            throw new Error("Weather information is incomplete.");
        }

        // Find the last hourly record at or before current time.
        const currentTime = data.current.time;

        let currentIndex = data.hourly.time.findIndex(
            time => time > currentTime
        );

        if (currentIndex === -1) {
            currentIndex = data.hourly.time.length;
        }

        const hourlyUpToNow = data.hourly.precipitation
            .slice(0, currentIndex)
            .map(value => Number(value) || 0);

        // Last 168 hourly values represent approximately seven days.
        const lastSevenDays = hourlyUpToNow.slice(-168);

        const rainfall7d = lastSevenDays.reduce(
            (total, value) => total + value,
            0
        );

        return {
            current: data.current,
            hourlyPrecipitation: hourlyUpToNow,
            rainfall7d
        };
    }

    // ==========================================
    // UPDATE WEATHER CARDS
    // ==========================================

    function updateWeatherCards(weather, locationLabel) {
        const current = weather.current;

        if (temperatureElement) {
            temperatureElement.innerHTML =
                `${formatNumber(current.temperature_2m)}<small> °C</small>`;
        }

        if (humidityElement) {
            humidityElement.innerHTML =
                `${formatNumber(current.relative_humidity_2m, 0)}<small> %</small>`;
        }

        if (rainfallElement) {
            rainfallElement.innerHTML =
                `${formatNumber(current.precipitation)}<small> mm</small>`;
        }
        if (rainfall7dElement) {
            rainfall7dElement.innerHTML = `${formatNumber(weather.rainfall7d)}<small> mm</small>`;
        }
        if (windSpeedElement) {
            windSpeedElement.innerHTML = `${formatNumber(current.wind_speed_10m)}<small> km/h</small>`;
        }

        if (weatherCondition) {
            weatherCondition.textContent =
                getWeatherDescription(current.weather_code);
        }

        if (weatherLocation) {
            weatherLocation.textContent = locationLabel;
        }

        if (weatherUpdated) {
            weatherUpdated.textContent =
                `Updated: ${current.time.replace("T", " ")}`;
        }
    }

    // ==========================================
    // RISK ASSESSMENT API
    // ==========================================

    async function assessRisk(location, weather) {
        if (riskLevelElement) {
            riskLevelElement.textContent = "Assessing...";
            riskLevelElement.style.color = "";
        }

        const payload = {
            location: location.label,
            latitude: location.latitude,
            longitude: location.longitude,

            weather: {
                hourlyPrecipitation: weather.hourlyPrecipitation,
                rainfall7d: weather.rainfall7d,
                humidity: weather.current.relative_humidity_2m,
                weatherCode: weather.current.weather_code
            }
        };

        const response = await fetch(`${API_BASE}/risk/assess`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Risk assessment could not be completed."
            );
        }

        const assessment = result.assessment;

        currentAssessment = assessment;

        displayRisk(assessment);

        // Refresh the dashboard's saved data.
        await Promise.allSettled([
            loadAlerts(),
            loadAssessmentHistory()
        ]);

        return result;
    }

    // ==========================================
    // DISPLAY RISK LEVEL
    // ==========================================

    function displayRisk(assessment) {
        if (!riskLevelElement) return;

        const level =
            assessment.riskLevel ||
            assessment.level ||
            assessment.risk_level ||
            "Unassessed";

        const score =
            assessment.riskScore ??
            assessment.score ??
            assessment.risk_score;

        riskLevelElement.textContent =
            score !== undefined && score !== null
                ? `${level} (${score}/85)`
                : level;

        const colors = {
            Low: "#246B3D",
            Moderate: "#D18A22",
            High: "#D9534F",
            Severe: "#B42318"
        };

        riskLevelElement.style.color =
            colors[level] || "#243B53";

        if (assessmentScoreElement) {
            assessmentScoreElement.innerHTML = `${escapeHTML(score ?? "--")}<small> / 85</small>`;
        }
        if (assessmentMethodElement) {
            assessmentMethodElement.textContent = assessment.method || "Rule-based environmental screening heuristic";
        }
        if (riskFactorsElement) {
            const factors = Array.isArray(assessment.factors) ? assessment.factors : [];
            riskFactorsElement.innerHTML = factors.length
                ? factors.map(factor => `<li>${escapeHTML(factor)}</li>`).join("")
                : "<li>No contributing factors were supplied.</li>";
        }
    }

    // ==========================================
    // MAP INITIALIZATION
    // ==========================================

    function initializeMap() {
        const mapElement = document.getElementById("riskMap");

        if (!mapElement || typeof L === "undefined") {
            console.error("Leaflet or map element is unavailable.");
            return;
        }

        map = L.map("riskMap").setView(
            [
                DEFAULT_LOCATION.latitude,
                DEFAULT_LOCATION.longitude
            ],
            10
        );

        // Primary map layer.
        
        // OpenStreetMap tiles - no API key required.
        const osmLayer = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution: "&copy; OpenStreetMap contributors",
                maxZoom: 19
            }
        );

        osmLayer.addTo(map);

        // Backup map layer.
        const backupLayer = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
            {
                attribution: "Tiles &copy; Esri",
                maxZoom: 19
            }
        );

        let tileErrors = 0;
        osmLayer.on("tileerror", () => {
            tileErrors++;
            if (tileErrors >= 3 && map.hasLayer(osmLayer)) {
                map.removeLayer(osmLayer);
                backupLayer.addTo(map);
            }
        });
        osmLayer.addTo(map);

        marker = L.marker([
            DEFAULT_LOCATION.latitude,
            DEFAULT_LOCATION.longitude
        ]).addTo(map);

        marker.bindPopup("Default Location: Pune");

        if (mapStatus) {
            mapStatus.textContent =
                "Map ready. Search a location or click the map to assess risk.";
        }

        if (mapCoordinates) {
            mapCoordinates.textContent =
                `${DEFAULT_LOCATION.latitude}, ${DEFAULT_LOCATION.longitude}`;
        }

        // Click anywhere on the map to assess that location.
        map.on("click", async event => {
            const location = {
                name: "Selected Map Location",
                label: `Selected Map Location (${event.latlng.lat.toFixed(4)}, ${event.latlng.lng.toFixed(4)})`,
                latitude: event.latlng.lat,
                longitude: event.latlng.lng
            };

            await processLocation(location);
        });

        setTimeout(() => {
            map.invalidateSize();
        }, 500);

        window.addEventListener("resize", () => {
            map.invalidateSize();
        });
    }

    // ==========================================
    // UPDATE MAP LOCATION
    // ==========================================

    
function updateMapLocation(location) {
    if (!map) {
        console.error("Map is not initialized.");
        return;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        console.error("Invalid location coordinates:", location);
        return;
    }

    const coordinates = [latitude, longitude];

    // Move map to the searched location.
    map.flyTo(coordinates, 12, {
        animate: true,
        duration: 1.5
    });

    // Create marker if it doesn't exist; otherwise move it.
    if (!marker) {
        marker = L.marker(coordinates).addTo(map);
    } else {
        marker.setLatLng(coordinates);
    }

    marker
        .bindPopup(`<strong>${escapeHTML(location.label)}</strong>`)
        .openPopup();

    if (mapStatus) {
        mapStatus.textContent =
            `Monitoring location: ${location.label}`;
    }

    if (mapCoordinates) {
        mapCoordinates.textContent =
            `Latitude: ${latitude.toFixed(5)} | Longitude: ${longitude.toFixed(5)}`;
    }

    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}


    // ==========================================
    // PROCESS A LOCATION
    // ==========================================

    async function processLocation(location) {
        const requestNumber = ++searchRequestNumber;

        currentLocation = location;

        if (selectedLocation) {
            selectedLocation.hidden = false;
        }

        if (selectedLocationName) {
            selectedLocationName.textContent = location.label;
        }

        updateMapLocation(location);

        showMessage("Retrieving weather information...", "");

        try {
            const weather = await getWeather(
                location.latitude,
                location.longitude
            );

            // Ignore an older search if a newer one was started.
            if (requestNumber !== searchRequestNumber) return;

            currentWeather = weather;

            updateWeatherCards(weather, location.label);

            showMessage(
                "Weather data loaded. Calculating risk...",
                ""
            );

            try {
                await assessRisk(location, weather);

                if (requestNumber !== searchRequestNumber) return;

                showMessage(
                    "Weather and risk assessment updated successfully.",
                    "success"
                );

                if (mapStatus) {
                    mapStatus.textContent =
                        `Risk assessment completed for ${location.label}`;
                }

            } catch (riskError) {
                console.error("Risk assessment error:", riskError);

                if (riskLevelElement) {
                    riskLevelElement.textContent = "Assessment Failed";
                    riskLevelElement.style.color = "#D9534F";
                }

                showMessage(
                    `Weather loaded, but risk assessment failed: ${riskError.message}`,
                    "error"
                );
            }

        } catch (error) {
            console.error("Location processing error:", error);

            if (requestNumber !== searchRequestNumber) return;

            showMessage(error.message, "error");
        }
    }

    // ==========================================
    // SEARCH LOCATION
    // ==========================================

    async function searchLocation() {
        const city = locationInput?.value.trim();

        if (!city) {
            showMessage("Please enter a city or location.", "error");
            return;
        }

        setSearchLoading(true);

        showMessage("Searching for location...", "");

        try {
            const location = await getCoordinates(city);

            await processLocation(location);

        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setSearchLoading(false);
        }
    }

    // ==========================================
    // CLEAR LOCATION
    // ==========================================

    function clearLocation() {
        searchRequestNumber++;

        if (locationInput) {
            locationInput.value = "";
        }

        if (selectedLocation) {
            selectedLocation.hidden = true;
        }

        resetWeather();

        currentLocation = null;

        if (map && marker) {
            map.setView(
                [
                    DEFAULT_LOCATION.latitude,
                    DEFAULT_LOCATION.longitude
                ],
                10
            );

            marker.setLatLng([
                DEFAULT_LOCATION.latitude,
                DEFAULT_LOCATION.longitude
            ]);

            marker.bindPopup("Default Location: Pune");

            if (mapStatus) {
                mapStatus.textContent =
                    "Map reset to Pune. Search a location or click the map.";
            }

            if (mapCoordinates) {
                mapCoordinates.textContent =
                    `${DEFAULT_LOCATION.latitude}, ${DEFAULT_LOCATION.longitude}`;
            }
        }

        showMessage("Location cleared.", "");
    }

    // ==========================================
    // LOAD ALERTS FROM MONGODB
    // ==========================================

    async function loadAlerts() {
        if (!alertsContainer) return;

        try {
            const response = await fetch(`${API_BASE}/alerts?limit=8`);

            if (!response.ok) {
                throw new Error("Could not load alerts.");
            }

            const result = await response.json();

            const alerts = result.items || [];

            if (alerts.length === 0) {
                alertsContainer.innerHTML = `
                    <i class="fa-solid fa-shield-halved"></i>
                    <h4>No alerts available</h4>
                    <p>Alerts will appear here when high or severe risk is detected.</p>
                `;

                alertsContainer.className = "empty-alert";
                return;
            }

            alertsContainer.className = "alerts-list";

            alertsContainer.innerHTML = alerts.map(alert => {
                const level =
                    alert.riskLevel ||
                    alert.level ||
                    alert.severity ||
                    "Risk Alert";

                const location =
                    alert.location || "Unknown location";

                const message =
                    alert.message ||
                    alert.description ||
                    "A risk alert has been generated.";

                const date = alert.createdAt
                    ? new Date(alert.createdAt).toLocaleString("en-IN")
                    : "Date unavailable";

                return `
                    <div class="alert-item">
                        <div class="alert-heading">
                            <strong>${escapeHTML(level)}</strong>
                            <span>${escapeHTML(date)}</span>
                        </div>

                        <p class="alert-location">
                            <i class="fa-solid fa-location-dot"></i>
                            ${escapeHTML(location)}
                        </p>

                        <p class="alert-message">
                            ${escapeHTML(message)}
                        </p>
                    </div>
                `;
            }).join("");

        } catch (error) {
            console.error("Alerts loading error:", error);

            alertsContainer.className = "empty-alert";

            alertsContainer.innerHTML = `
                <i class="fa-solid fa-circle-exclamation"></i>
                <h4>Unable to load alerts</h4>
                <p>Check your backend connection and refresh the dashboard.</p>
            `;
        }
    }

    // ==========================================
    // LOAD ASSESSMENT HISTORY
    // ==========================================

    async function loadAssessmentHistory() {
        if (!analyticsContainer) return;

        try {
            const response = await fetch(
                `${API_BASE}/assessments?limit=20`
            );

            if (!response.ok) {
                throw new Error("Could not load assessment history.");
            }

            const result = await response.json();

            const assessments = result.items || [];

            if (assessments.length === 0) {
                analyticsContainer.innerHTML = `
                    <p>No assessment history available yet.</p>
                    <p>Search a location to create your first assessment.</p>
                `;

                return;
            }

            const recentAssessments = assessments.slice(0, 10);

            const scoreRows = recentAssessments.slice(0, 8).slice().reverse();
            analyticsContainer.innerHTML = `
                <div class="history-summary">
                    <strong>${assessments.length}</strong>
                    <span>Saved assessments retrieved · most recent first</span>
                </div>
                <div class="history-chart" aria-label="Recent risk screening scores">
                    ${scoreRows.map(item => {
                        const score = Math.max(0, Math.min(85, Number(item.riskScore ?? item.score ?? 0)));
                        const name = escapeHTML(item.location || "Location");
                        return `<div class="history-bar-column" title="${name}: ${score}/85"><div class="history-bar-value">${score}</div><div class="history-bar-track"><span style="height:${(score / 85) * 100}%"></span></div><small>${name}</small></div>`;
                    }).join("")}
                </div>
                <h4 class="history-subheading">Recent assessment records</h4>
                <div class="history-list">
                    ${recentAssessments.map(item => {
                        const level =
                            item.riskLevel ||
                            item.level ||
                            "Unknown";

                        const location =
                            item.location || "Unknown location";

                        const score =
                            item.riskScore ??
                            item.score ??
                            "--";

                        const date = item.createdAt
                            ? new Date(item.createdAt).toLocaleString("en-IN")
                            : "Date unavailable";

                        return `
                            <div class="history-item">
                                <div>
                                    <strong>${escapeHTML(location)}</strong>
                                    <small>${escapeHTML(date)}</small>
                                </div>

                                <div class="history-result">
                                    <span class="history-level ${escapeHTML(String(level).toLowerCase())}">
                                        ${escapeHTML(level)}
                                    </span>

                                    <strong>${escapeHTML(score)}/85</strong>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;

        } catch (error) {
            console.error("Assessment history error:", error);

            analyticsContainer.innerHTML = `
                <p>Unable to retrieve assessment history.</p>
                <p>Please check the backend connection.</p>
            `;
        }
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    if (searchLocationBtn) {
        searchLocationBtn.addEventListener("click", searchLocation);
    }

    if (clearLocationBtn) {
        clearLocationBtn.addEventListener("click", clearLocation);
    }

    if (locationInput) {
        locationInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                searchLocation();
            }
        });
    }

    // ==========================================
    // TERRAGUARD RISK AI ASSISTANT
    // ==========================================
    const chatMessages = document.getElementById("chatMessages");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatSend = document.getElementById("chatSend");

    function addChatMessage(text, role) {
        if (!chatMessages) return;
        const bubble = document.createElement("div");
        bubble.className = `chat-message ${role}`;
        bubble.textContent = text;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendChatMessage(message) {
        const question = String(message || "").trim();
        if (!question || !chatInput || !chatSend) return;
        addChatMessage(question, "user");
        chatInput.value = "";
        chatSend.disabled = true;
        const pending = document.createElement("div");
        pending.className = "chat-message assistant";
        pending.textContent = "Thinking...";
        chatMessages.appendChild(pending);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const current = currentWeather?.current || {};
        const context = {
            location: currentLocation?.label || null,
            assessment: currentAssessment || null,
            weather: currentWeather ? {
                temperature: current.temperature_2m,
                humidity: current.relative_humidity_2m,
                precipitation: current.precipitation,
                rainfall7d: currentWeather.rainfall7d
            } : null
        };
        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: question, context })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "Assistant is unavailable.");
            pending.textContent = result.answer;
        } catch (error) {
            pending.textContent = `I couldn't reach the assistant service. Check that the backend is running. (${error.message})`;
        } finally {
            chatSend.disabled = false;
            chatInput.focus();
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    if (chatForm) {
        chatForm.addEventListener("submit", event => {
            event.preventDefault();
            sendChatMessage(chatInput.value);
        });
    }
    document.querySelectorAll("[data-chat-prompt]").forEach(button => {
        button.addEventListener("click", () => sendChatMessage(button.dataset.chatPrompt));
    });

    // ==========================================
    // SIDEBAR NAVIGATION
    // ==========================================
    const navLinks = Array.from(document.querySelectorAll(".sidebar-nav .nav-link, .sidebar-bottom .nav-link"));
    const navTargets = navLinks.map(link => ({ link, target: document.querySelector(link.getAttribute("href")) })).filter(item => item.target);

    navLinks.forEach(link => {
        link.addEventListener("click", event => {
            const href = link.getAttribute("href");
            if (!href || !href.startsWith("#")) return;
            const target = document.querySelector(href);
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            history.replaceState(null, "", href);
            navLinks.forEach(item => {
                item.classList.toggle("active", item === link);
                if (item === link) item.setAttribute("aria-current", "page");
                else item.removeAttribute("aria-current");
            });
        });
    });

    if ("IntersectionObserver" in window && navTargets.length) {
        const sectionObserver = new IntersectionObserver(entries => {
            const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            const active = navTargets.find(item => item.target === visible.target);
            if (!active) return;
            navLinks.forEach(link => {
                const selected = link === active.link;
                link.classList.toggle("active", selected);
                if (selected) link.setAttribute("aria-current", "page");
                else link.removeAttribute("aria-current");
            });
        }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, .15, .35] });
        navTargets.forEach(item => sectionObserver.observe(item.target));
    }

    // ==========================================
    // INITIALIZE DASHBOARD
    // ==========================================

    resetWeather();

    initializeMap();

    // Load saved data when the dashboard opens.
    loadAlerts();
    loadAssessmentHistory();

    console.log("TerraGuard AI Dashboard Initialized");
});
