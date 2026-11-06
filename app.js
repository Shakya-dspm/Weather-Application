const map = L.map("location-section").setView([7.8731, 80.7718], 7);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const searchInput = document.getElementById("locationSearch");
const suggestions = document.getElementById("suggestions");

let searchResults = [];
let location;
let activeIndex = -1;
let debounceTimer;
let controller;
let marker;

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

    location = locationName;

    console.log({
        name: locationName,
        latitude: latitude,
        longitude: longitude
    });

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

