let userLatitude = 7.8731;
let userLongitude = 80.7718;

let map;
let searchResults = [];
let activeIndex = -1;
let debounceTimer;
let controller;
let marker;

window.addEventListener('DOMContentLoaded', () => {
    console.log("Page started. Triggering location request...");
    startLocationFetch();
    loadPopularCities();
});

window.addEventListener('resize', () => {
    if (map) {
        map.invalidateSize();
    }
});

function startLocationFetch() {
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        fallbackFunction(); // Call your fallback if it fails
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    // Triggers the prompt immediately on page start
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
}

function successCallback(position) {
    // Save coordinates into the global variables
    userLatitude = position.coords.latitude;
    userLongitude = position.coords.longitude;

    console.log(`Location locked: ${userLatitude}, ${userLongitude}`);

    initializeMap(userLatitude, userLongitude);

    searchCityOnAction(`${userLatitude},${userLongitude}`);
}

function errorCallback(error) {
    console.warn(`Location error (${error.code}): ${error.message}`);
    initializeMap(userLatitude, userLongitude);
}

function initializeMap(lat, lon) {
    if (map) {
        // Prevent re-initialization error if called twice
        map.setView([lat, lon], 10);
        return;
    }

    map = L.map("location-section").setView([lat, lon], 15);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, and the GIS User Community'
    }).addTo(map);

    marker = L.marker([lat, lon]).addTo(map).bindPopup("<b>Your Location</b>").openPopup();

    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

const searchInput = document.getElementById("locationSearch");
const suggestions = document.getElementById("suggestions");

async function getLocations(query) {

    if (controller) {
        controller.abort();
    }

    controller = new AbortController();

    const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;

    try {

        const response = await fetch(url, {
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error("Location search failed");
        }

        const data = await response.json();

        return data.features || [];

    } catch (error) {

        if (error.name === "AbortError") {
            return [];
        }

        console.error(error);

        return [];
    }
}


// ==================================
// 4. DISPLAY SUGGESTIONS
// ==================================

function displaySuggestions(results) {

    suggestions.innerHTML = "";
    searchResults = results;
    activeIndex = -1;

    if (results.length === 0) {
        suggestions.style.display = "none";
        return;
    }

    results.forEach((place, index) => {

        const properties = place.properties;

        const name = properties.name || "Unknown location";

        const locationDetails = [
            properties.city,
            properties.state,
            properties.country
        ].filter(Boolean);

        const displayName =
            [name, ...locationDetails.filter(
                item => item.toLowerCase() !== name.toLowerCase()
            )].join(", ");

        const li = document.createElement("li");

        li.textContent = "📍 " + displayName;

        li.addEventListener("click", () => {
            selectLocation(index);
        });

        suggestions.appendChild(li);

    });

    suggestions.style.display = "block";
}


// ==================================
// 5. SELECT A LOCATION
// ==================================

function selectLocation(index) {

    const place = searchResults[index];

    if (!place) return;

    const coordinates = place.geometry.coordinates;

    const longitude = coordinates[0];
    const latitude = coordinates[1];

    const locationName =
        place.properties.name || "Selected location";

    // Update search input
    searchInput.value =
        place.properties.name +
        (place.properties.country
            ? ", " + place.properties.country
            : "");

    // Hide suggestions
    suggestions.style.display = "none";

    // Move map to selected location
    map.flyTo([latitude, longitude], 14, {
        duration: 1.5
    });

    // Remove previous marker
    if (marker) {
        map.removeLayer(marker);
    }

    // Add new marker
    marker = L.marker([latitude, longitude]).addTo(map);

    // Add popup
    marker.bindPopup(
        `<b>${escapeHTML(locationName)}</b>`
    ).openPopup();

    console.log({
        name: locationName,
        latitude: latitude,
        longitude: longitude
    });

    searchCityOnAction(locationName);

}


// ==================================
// 6. PREVENT HTML INJECTION IN POPUP
// ==================================

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

}


// ==================================
// 7. SEARCH WHEN USER TYPES
// ==================================

searchInput.addEventListener("input", () => {

    const query = searchInput.value.trim();

    clearTimeout(debounceTimer);

    if (controller) {
        controller.abort();
    }

    if (query.length < 3) {
        suggestions.style.display = "none";
        return;
    }

    debounceTimer = setTimeout(async () => {

        const results = await getLocations(query);

        // Ignore results if input changed while searching
        if (searchInput.value.trim() !== query) return;

        displaySuggestions(results);
    }, 350);

});


// ==================================
// 8. SEARCH WHEN ENTER IS PRESSED
// ==================================

searchInput.addEventListener("keydown", async (event) => {

    const items = suggestions.querySelectorAll("li");

    // Arrow down
    if (event.key === "ArrowDown") {

        if (!items.length) return;

        event.preventDefault();

        activeIndex = (activeIndex + 1) % items.length;

        updateActiveSuggestion(items);

    }

    // Arrow up
    else if (event.key === "ArrowUp") {

        if (!items.length) return;

        event.preventDefault();

        activeIndex =
            activeIndex <= 0 ? items.length - 1 : activeIndex - 1;

        updateActiveSuggestion(items);

    }

    // Enter
    else if (event.key === "Enter") {

        event.preventDefault();

        clearTimeout(debounceTimer);

        const query = searchInput.value.trim();

        if (!query) return;

        if (activeIndex >= 0 && searchResults[activeIndex]) {
            selectLocation(activeIndex);
            return;
        }

        if (searchResults.length > 0) {
            selectLocation(0);
            return;
        }

        const results = await getLocations(query);

        if (searchInput.value.trim() !== query) return;

        displaySuggestions(results);

        if (results.length > 0) {
            selectLocation(0);
        }

    }

    // Escape
    else if (event.key === "Escape") {

        suggestions.style.display = "none";

    }

});


// ==================================
// 9. UPDATE ACTIVE SUGGESTION
// ==================================

function updateActiveSuggestion(items) {

    items.forEach((item, index) => {

        item.classList.toggle("active", index === activeIndex);

    });

    items[activeIndex]?.scrollIntoView({
        block: "nearest"
    });

}


// ==================================
// 10. CLOSE SUGGESTIONS ON OUTSIDE CLICK
// ==================================

document.addEventListener("click", (event) => {

    if (!event.target.closest(".search-container")) {
        suggestions.style.display = "none";
    }

});

// ==================================
// 11. CALL API AND GET DATA
// ==================================

function searchCityOnAction(query) {

    const apiKey = "bdf15ef4a1514140b35105030261210";
    const baseUrl = "https://api.weatherapi.com/v1";

    fetch(`${baseUrl}/current.json?key=${apiKey}&q=${query}&aqi=yes`).then(res => res.json()).then(data => {
        console.log(data);

        const isDay = data.current.is_day === 1;
        if (isDay) {
            document.body.classList.remove("dark-theme");
            document.body.classList.add("light-theme");
        } else {
            document.body.classList.remove("light-theme");
            document.body.classList.add("dark-theme");
        }

        if (marker) {
            const locationName = `${data.location.name}, ${data.location.country}`;
            marker.bindPopup(`<b>${escapeHTML(locationName)}</b>`).openPopup();
        }

        const localTime = new Date(
            data.location.localtime.replace(" ", "T")
        );

        const timeEl = document.getElementById("time");
        const currentHumidity = document.getElementById("humidity");
        const currentTemperature = document.getElementById("temperature");
        const currentWindSpeed = document.getElementById("wind");
        const currentUVIndex = document.getElementById("uvIndex");
        const currentWeatherIcon = document.getElementById("weatherIcon");
        const currentAirQuality = document.getElementById("airQuality");
        const currentWeatherStatus = document.getElementById("weatherStatus");

        if (timeEl) {
            timeEl.innerHTML = localTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
        }

        currentHumidity.innerHTML = `${data.current.humidity}%`;
        currentWeatherStatus.innerHTML = `${data.current.condition.text}`;
        currentTemperature.innerHTML = `${data.current.temp_c.toFixed(0)}<sup>°C</sup>`;
        currentWindSpeed.innerHTML = `${data.current.wind_kph}`;
        currentUVIndex.innerHTML = `${data.current.uv}`;
        currentWeatherIcon.innerHTML = `<img src="${data.current.condition.icon}" alt="Weather Icon">`;
        currentAirQuality.innerHTML = `${data.current.air_quality["us-epa-index"]}`;
    })
        .catch(err => console.error("Weather fetch failed:", err));

    fetch7DaysHistory(query);
}

// ==================================
// 12. POPULATE POPULAR CITIES CARD
// ==================================

function loadPopularCities() {
    const apiKey = "bdf15ef4a1514140b35105030261210";
    const baseUrl = "https://api.weatherapi.com/v1/current.json";

    // List of cities you want to track
    const cities = ["Colombo", "Galle", "Kandy", "Jaffna"];
    const cityItems = document.querySelectorAll("#popularCityList .city-item");

    cities.forEach((city, index) => {
        fetch(`${baseUrl}?key=${apiKey}&q=${city}`)
            .then(res => res.json())
            .then(data => {
                // Check if WeatherAPI returned an error (e.g., invalid key or city)
                if (data.error) {
                    console.error(`API Error for ${city}:`, data.error.message);
                    return;
                }

                const item = cityItems[index];
                if (!item) return;

                const nameEl = item.querySelector(".city-name");
                const statusEl = item.querySelector(".weather-status");
                const iconEl = item.querySelector(".pop-icon");

                // Safely update text and weather details if elements exist
                if (nameEl) nameEl.textContent = data.location.name;
                if (statusEl) statusEl.textContent = data.current.condition.text;
                if (iconEl) {
                    iconEl.src = data.current.condition.icon;
                    iconEl.alt = data.current.condition.text;
                }
            })
            .catch(err => console.error(`Failed to fetch weather for ${city}:`, err));
    });
}

// ==================================
// 13. FETCH & DISPLAY 7 DAYS HISTORY
// ==================================

async function fetch7DaysHistory(query) {
    const apiKey = "bdf15ef4a1514140b35105030261210";
    const historyContainer = document.getElementById("historyGrid");
    if (!historyContainer) return;

    historyContainer.innerHTML = "<p>Loading history...</p>";

    // Generate array of YYYY-MM-DD strings for the past 7 days
    const dates = [];
    for (let i = 7; i >= 1; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
    }

    try {
        // Fetch all 7 days concurrently
        const historyPromises = dates.map(date =>
            fetch(`https://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${query}&dt=${date}`)
                .then(res => res.json())
        );

        const results = await Promise.all(historyPromises);
        historyContainer.innerHTML = "";

        results.forEach(data => {
            const dayData = data.forecast.forecastday[0];
            const dateObj = new Date(dayData.date);

            // Format day label (e.g., "Mon, Nov 1")
            const formattedDate = dateObj.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric"
            });

            const card = document.createElement("div");
            card.className = "history-card";
            card.innerHTML = `
                <p class="history-date">${formattedDate}</p>
                <img src="${dayData.day.condition.icon}" alt="${dayData.day.condition.text}" class="history-icon">
                <p class="history-temp">${dayData.day.maxtemp_c.toFixed(0)}° / ${dayData.day.mintemp_c.toFixed(0)}°C</p>
                <p class="history-status">${dayData.day.condition.text}</p>
            `;
            historyContainer.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to fetch historical weather:", err);
        historyContainer.innerHTML = "<p>Unable to load weather history.</p>";
    }
}