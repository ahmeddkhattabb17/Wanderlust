const API = {
  countries: "https://date.nager.at/api/v3/AvailableCountries",
  holidays: (year, code) => `https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`,
  longWeekends: (year, code) => `https://date.nager.at/api/v3/LongWeekend/${year}/${code}`,
  countryInfo: (code) => `https://restcountries.com/v3.1/alpha/${code}`,
  geocode: (city, code) =>
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&countryCode=${code}&count=1&language=en&format=json`,
  weather: (lat, lon) =>
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto`,
  events: (city, code) =>
    `https://app.ticketmaster.com/discovery/v2/events.json?apikey=VwECw2OiAzxVzIqnwmKJUG41FbeXJk1y&city=${encodeURIComponent(city)}&countryCode=${code}&size=20&sort=date,asc`,
  rates: (base) => `https://v6.exchangerate-api.com/v6/805842951e5953ad31497176/latest/${base}`,
  sun: (lat, lon, date) =>
    `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${date}&formatted=0`,
};

const CURRENCIES = {
  USD: "US Dollar", EUR: "Euro", GBP: "British Pound", EGP: "Egyptian Pound",
  AED: "UAE Dirham", SAR: "Saudi Riyal", JPY: "Japanese Yen", CAD: "Canadian Dollar",
  INR: "Indian Rupee", AUD: "Australian Dollar", CHF: "Swiss Franc", CNY: "Chinese Yuan",
  MAD: "Moroccan Dirham", TRY: "Turkish Lira", KWD: "Kuwaiti Dinar", QAR: "Qatari Riyal",
};

const CITY_FALLBACKS = {
  EG: ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Sharm El Sheikh"],
  US: ["New York", "Los Angeles", "Chicago", "Miami", "Las Vegas", "San Francisco"],
  GB: ["London", "Manchester", "Liverpool", "Edinburgh", "Birmingham"],
  FR: ["Paris", "Lyon", "Nice", "Marseille", "Bordeaux"],
  DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne"],
  IT: ["Rome", "Milan", "Venice", "Florence", "Naples"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Malaga"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  SA: ["Riyadh", "Jeddah", "Mecca", "Medina"],
  TR: ["Istanbul", "Ankara", "Antalya", "Izmir"],
  JP: ["Tokyo", "Osaka", "Kyoto", "Yokohama"],
  CA: ["Toronto", "Vancouver", "Montreal", "Ottawa"],
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth"],
};

const state = {
  countries: [],
  selected: JSON.parse(localStorage.getItem("wanderlustSelection") || "null") || {
    countryCode: "EG",
    countryName: "Egypt",
    city: "Cairo",
    year: new Date().getFullYear(),
  },
  countryInfo: null,
  coords: null,
  holidays: [],
  longWeekends: [],
  events: [],
  weather: null,
  rates: null,
  planFilter: "all",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  fillYears();
  fillCurrencySelects();
  updateClock();
  setInterval(updateClock, 1000);
  renderPlansMeta();
  await loadCountries();
  await syncSelectionInputs();
  await applySelection(false);
  showView(location.hash.replace("#", "") || "dashboard");
  convertCurrency();
}

function bindEvents() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-go-dashboard]")) showView("dashboard");
  });

  $$(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      showView(item.dataset.view);
    });
  });

  $("#global-country")?.addEventListener("change", async (e) => {
    const option = e.target.selectedOptions[0];
    state.selected.countryCode = e.target.value;
    state.selected.countryName = option?.dataset.name || option?.textContent?.trim() || "";
    await updateCityOptions();
  });

  $("#global-search-btn")?.addEventListener("click", () => applySelection(true));
  $("#clear-selection-btn")?.addEventListener("click", clearSelection);
  $("#mobile-menu-btn")?.addEventListener("click", () => $("#sidebar")?.classList.add("open"));
  $("#sidebar-overlay")?.addEventListener("click", closeSidebar);
  $("#start-exploring-btn")?.addEventListener("click", () => showView("holidays"));

  $("#convert-btn")?.addEventListener("click", convertCurrency);
  $("#swap-currencies-btn")?.addEventListener("click", () => {
    const from = $("#currency-from");
    const to = $("#currency-to");
    [from.value, to.value] = [to.value, from.value];
    convertCurrency();
  });

  ["#currency-amount", "#currency-from", "#currency-to"].forEach((selector) => {
    $(selector)?.addEventListener("input", convertCurrency);
    $(selector)?.addEventListener("change", convertCurrency);
  });

  $("#clear-all-plans-btn")?.addEventListener("click", clearAllPlans);
  $$(".plan-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.planFilter = btn.dataset.filter;
      renderPlans();
    });
  });
}
async function loadCountries() {
  try {
    state.countries = await fetchJson(API.countries);
  } catch {
    state.countries = [
      { countryCode: "EG", name: "Egypt" },
      { countryCode: "US", name: "United States" },
      { countryCode: "GB", name: "United Kingdom" },
      { countryCode: "FR", name: "France" },
      { countryCode: "DE", name: "Germany" },
    ];
    toast("Could not load all countries. Using starter countries.", "error");
  }
  $("#stat-countries").textContent = `${state.countries.length}+`;
  $("#global-country").innerHTML = `<option value="">Select Country</option>${state.countries
    .map((c) => `<option value="${c.countryCode}" data-name="${escapeHtml(c.name)}">${flag(c.countryCode)} ${escapeHtml(c.name)}</option>`)
    .join("")}`;
}
function fillYears() {
  const current = new Date().getFullYear();
  $("#global-year").innerHTML = Array.from({ length: 5 }, (_, i) => current + i)
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
}
function fillCurrencySelects() {
  const options = Object.entries(CURRENCIES)
    .map(([code, name]) => `<option value="${code}">${code} - ${name}</option>`)
    .join("");
  $("#currency-from").innerHTML = options;
  $("#currency-to").innerHTML = options;
  $("#currency-from").value = "USD";
  $("#currency-to").value = "EGP";
}

async function syncSelectionInputs() {
  if (!state.selected) return;
  $("#global-country").value = state.selected.countryCode;
  await updateCityOptions();
  $("#global-city").value = state.selected.city;
  $("#global-year").value = state.selected.year;
}
async function updateCityOptions() {
  const code = $("#global-country").value;
  const option = $("#global-country").selectedOptions[0];
  const name = option?.dataset.name || option?.textContent?.trim() || "";
  let cities = CITY_FALLBACKS[code] || [];
  try {
    if (code) {
      const [info] = await fetchJson(API.countryInfo(code));
      const capitals = info?.capital || [];
      cities = [...new Set([...capitals, ...cities])];
      if (!cities.length && name) cities = [name];
    }
  } catch {
    if (!cities.length && name) cities = [name];
  }

  $("#global-city").innerHTML = cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join("");
}

async function applySelection(showToast = true) {
  const countryCode = $("#global-country").value || state.selected?.countryCode;
  const countryName = $("#global-country").selectedOptions[0]?.dataset.name || state.selected?.countryName;
  const city = $("#global-city").value || state.selected?.city;
  const year = Number($("#global-year").value || state.selected?.year || new Date().getFullYear());

  if (!countryCode || !countryName || !city) {
    clearSelection();
    return;
  }

  state.selected = { countryCode, countryName, city, year };
  localStorage.setItem("wanderlustSelection", JSON.stringify(state.selected));
  showLoading("Loading destination data...");

  try {
    await Promise.all([loadCountryInfo(), loadCoordinates(), loadHolidays(), loadLongWeekends()]);
    await Promise.allSettled([loadEvents(), loadWeather(), loadSunTimes()]);
    renderAllSelectionViews();
    if (showToast) toast(`Loaded ${countryName} - ${city}`, "success");
  } catch (error) {
    toast(error.message || "Something went wrong while loading destination data.", "error");
  } finally {
    hideLoading();
  }
}

function clearSelection() {
  state.selected = null;
  state.countryInfo = null;
  state.coords = null;
  state.holidays = [];
  state.events = [];
  state.longWeekends = [];
  state.weather = null;
  localStorage.removeItem("wanderlustSelection");
  $("#selected-destination")?.classList.add("hidden");
  renderAllSelectionViews();
}

async function loadCountryInfo() {
  const [info] = await fetchJson(API.countryInfo(state.selected.countryCode));
  state.countryInfo = info;
}

async function loadCoordinates() {
  const data = await fetchJson(API.geocode(state.selected.city, state.selected.countryCode));
  const result = data.results?.[0];
  if (!result) throw new Error("City coordinates were not found.");
  state.coords = { lat: result.latitude, lon: result.longitude, timezone: result.timezone };
}

async function loadHolidays() {
  try {
    state.holidays = await fetchJson(API.holidays(state.selected.year, state.selected.countryCode));
  } catch {
    state.holidays = [];
  }
}

async function loadLongWeekends() {
  try {
    state.longWeekends = await fetchJson(API.longWeekends(state.selected.year, state.selected.countryCode));
  } catch {
    state.longWeekends = createLongWeekendsFromHolidays(state.holidays);
  }
}

async function loadEvents() {
  try {
    const data = await fetchJson(API.events(state.selected.city, state.selected.countryCode));
    state.events = data._embedded?.events || [];
  } catch {
    state.events = [];
  }
}

async function loadWeather() {
  if (!state.coords) return;
  state.weather = await fetchJson(API.weather(state.coords.lat, state.coords.lon));
}

async function loadSunTimes() {
  if (!state.coords) return;
  const date = `${state.selected.year}-01-25`;
  state.sun = await fetchJson(API.sun(state.coords.lat, state.coords.lon, date));
}

function renderAllSelectionViews() {
  renderSelectedDestination();
  renderDashboardCountry();
  renderHeaderSelections();
  renderHolidays();
  renderEvents();
  renderWeather();
  renderLongWeekends();
  renderSunTimes();
  renderPlansMeta();
}

function renderSelectedDestination() {
  const box = $("#selected-destination");
  if (!state.selected) {
    box?.classList.add("hidden");
    return;
  }
  box?.classList.remove("hidden");
  $("#selected-country-flag").src = flagUrl(state.selected.countryCode, 80);
  $("#selected-country-flag").alt = state.selected.countryName;
  $("#selected-country-name").textContent = state.selected.countryName;
  $("#selected-city-name").textContent = `- ${state.selected.city}`;
}

function renderDashboardCountry() {
  const target = $("#dashboard-country-info");
  if (!state.selected || !state.countryInfo) {
    target.innerHTML = emptyBlock("fa-solid fa-flag", "No Country Selected", "Choose a country above to see travel information.", false);
    return;
  }

  const c = state.countryInfo;
  const currencies = Object.entries(c.currencies || {}).map(([code, value]) => `${value.name} (${code} ${value.symbol || ""})`);
  const languages = Object.values(c.languages || {});
  const borders = c.borders || [];
  $("#stat-holidays").textContent = state.holidays.length;
  $("#stat-events").textContent = state.events.length || "0";

  target.innerHTML = `
    <div class="dashboard-country-header">
      <img src="${c.flags?.png || flagUrl(state.selected.countryCode, 160)}" alt="${escapeHtml(c.name?.common)}" class="dashboard-country-flag">
      <div class="dashboard-country-title">
        <h3>${escapeHtml(c.name?.common || state.selected.countryName)}</h3>
        <p class="official-name">${escapeHtml(c.name?.official || "")}</p>
        <span class="region"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(c.region || "World")} - ${escapeHtml(c.subregion || "Travel destination")}</span>
      </div>
    </div>
    <div class="dashboard-local-time">
      <div class="local-time-display">
        <i class="fa-solid fa-clock"></i>
        <span class="local-time-value" id="country-local-time">${localTime(c.timezones?.[0])}</span>
        <span class="local-time-zone">${escapeHtml(c.timezones?.[0] || "UTC")}</span>
      </div>
    </div>
    <div class="dashboard-country-grid">
      ${countryDetail("fa-solid fa-building-columns", "Capital", (c.capital || [state.selected.city])[0])}
      ${countryDetail("fa-solid fa-users", "Population", number(c.population))}
      ${countryDetail("fa-solid fa-ruler-combined", "Area", `${number(c.area)} km²`)}
      ${countryDetail("fa-solid fa-globe", "Continent", c.continents?.[0] || c.region)}
      ${countryDetail("fa-solid fa-phone", "Calling Code", `${c.idd?.root || ""}${c.idd?.suffixes?.[0] || ""}` || "N/A")}
      ${countryDetail("fa-solid fa-car", "Driving Side", title(c.car?.side || "N/A"))}
      ${countryDetail("fa-solid fa-calendar-week", "Week Starts", title(c.startOfWeek || "Monday"))}
      ${countryDetail("fa-solid fa-city", "Selected City", state.selected.city)}
    </div>
    <div class="dashboard-country-extras">
      ${extraTags("fa-solid fa-coins", "Currency", currencies)}
      ${extraTags("fa-solid fa-language", "Languages", languages)}
      ${extraTags("fa-solid fa-map-location-dot", "Neighbors", borders, "border-tag")}
    </div>
    <div class="dashboard-country-actions">
      <a href="${c.maps?.googleMaps || `https://www.google.com/maps/search/${encodeURIComponent(state.selected.countryName)}`}" target="_blank" class="btn-map-link">
        <i class="fa-solid fa-map"></i> View on Google Maps
      </a>
    </div>`;
}

function renderHeaderSelections() {
  $$(".view-header-selection").forEach((box) => {
    if (!state.selected) {
      box.style.display = "none";
      return;
    }
    box.style.display = "flex";
    const needsCity = box.closest("#events-view, #weather-view, #sun-times-view");
    box.innerHTML = `
      <div class="current-selection-badge">
        <img src="${flagUrl(state.selected.countryCode, 40)}" alt="${escapeHtml(state.selected.countryName)}" class="selection-flag">
        <span>${escapeHtml(state.selected.countryName)}</span>
        ${needsCity ? `<span class="selection-city">${escapeHtml(state.selected.city)}</span>` : ""}
        <span class="selection-year">${state.selected.year}</span>
      </div>`;
  });
}

function renderHolidays() {
  const target = $("#holidays-content");
  if (!state.selected) {
    target.innerHTML = emptyBlock("fa-solid fa-calendar-xmark", "No Country Selected", "Select a country from the dashboard to explore public holidays.");
    return;
  }
  if (!state.holidays.length) {
    target.innerHTML = emptyBlock("fa-regular fa-calendar", "No Holidays Found", "This country has no public holiday data for the selected year.");
    return;
  }
  target.innerHTML = state.holidays.map((holiday) => {
    const date = new Date(`${holiday.date}T12:00:00`);
    const plan = holidayPlan(holiday);
    return `
      <div class="holiday-card">
        <div class="holiday-card-header">
          <div class="holiday-date-box"><span class="day">${date.getDate()}</span><span class="month">${month(date)}</span></div>
          <button class="holiday-action-btn ${isSaved(plan.id) ? "saved" : ""}" data-save='${jsonAttr(plan)}'><i class="${isSaved(plan.id) ? "fa-solid" : "fa-regular"} fa-heart"></i></button>
        </div>
        <h3>${escapeHtml(holiday.name)}</h3>
        <p class="holiday-name">${escapeHtml(holiday.localName || holiday.name)}</p>
        <div class="holiday-card-footer">
          <span class="holiday-day-badge"><i class="fa-regular fa-calendar"></i> ${weekday(date)}</span>
          <span class="holiday-type-badge">${escapeHtml(holiday.types?.[0] || "Public")}</span>
        </div>
      </div>`;
  }).join("");
  bindSaveButtons(target);
}

function renderEvents() {
  const target = $("#events-content");
  if (!state.selected) {
    target.innerHTML = emptyBlock("fa-solid fa-ticket", "No City Selected", "Select a country and city from the dashboard to discover events.");
    return;
  }
  if (!state.events.length) {
    target.innerHTML = emptyBlock("fa-regular fa-calendar-xmark", "No Events Found", `Ticketmaster has no events for ${state.selected.city} right now.`);
    return;
  }
  target.innerHTML = state.events.map((event) => {
    const image = event.images?.find((img) => img.ratio === "16_9")?.url || event.images?.[0]?.url || "";
    const date = event.dates?.start?.localDate || "";
    const time = event.dates?.start?.localTime?.slice(0, 5) || "Time TBA";
    const venue = event._embedded?.venues?.[0]?.name || state.selected.city;
    const category = event.classifications?.[0]?.segment?.name || "Event";
    const price = event.priceRanges?.[0] ? `${event.priceRanges[0].min || ""} ${event.priceRanges[0].currency || ""}` : "See tickets";
    const plan = eventPlan(event);
    return `
      <div class="event-card">
        <div class="event-card-image">
          ${image ? `<img src="${image}" alt="${escapeHtml(event.name)}">` : ""}
          <span class="event-card-category">${escapeHtml(category)}</span>
          <button class="event-card-save ${isSaved(plan.id) ? "saved" : ""}" data-save='${jsonAttr(plan)}'><i class="${isSaved(plan.id) ? "fa-solid" : "fa-regular"} fa-heart"></i></button>
        </div>
        <div class="event-card-body">
          <h3>${escapeHtml(event.name)}</h3>
          <div class="event-card-info">
            <div><i class="fa-regular fa-calendar"></i> ${formatDate(date)} - ${time}</div>
            <div><i class="fa-solid fa-location-dot"></i> ${escapeHtml(venue)}</div>
          </div>
          <div class="event-card-footer">
            <span class="event-price">${escapeHtml(price)}</span>
            ${event.url ? `<a class="btn-buy-ticket" href="${event.url}" target="_blank"><i class="fa-solid fa-ticket"></i> Tickets</a>` : `<button class="btn-event" data-save='${jsonAttr(plan)}'>Save</button>`}
          </div>
        </div>
      </div>`;
  }).join("");
  bindSaveButtons(target);
}

function renderWeather() {
  const target = $("#weather-content");
  if (!state.selected) {
    target.innerHTML = emptyBlock("fa-solid fa-temperature-empty", "No City Selected", "Select a country and city from the dashboard to see the weather forecast.");
    return;
  }
  if (!state.weather?.current) {
    target.innerHTML = emptyBlock("fa-solid fa-cloud", "Weather Unavailable", "Could not load the forecast for this city.");
    return;
  }

  const w = state.weather;
  const current = w.current;
  const daily = w.daily;
  const code = current.weather_code;
  target.innerHTML = `
    <div class="weather-hero-card ${weatherClass(code)}">
      <div class="weather-hero-bg"></div>
      <div class="weather-hero-content">
        <div class="weather-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(state.selected.city)}, ${escapeHtml(state.selected.countryName)} <span class="weather-time">${formatDate(current.time)}</span></div>
        <div class="weather-hero-main">
          <div class="weather-hero-left">
            <div class="weather-hero-icon"><i class="${weatherIcon(code)}"></i></div>
            <div class="weather-hero-temp"><span class="temp-value">${Math.round(current.temperature_2m)}</span><span class="temp-unit">°C</span></div>
          </div>
          <div class="weather-hero-right">
            <div class="weather-condition">${weatherText(code)}</div>
            <div class="weather-feels">Feels like ${Math.round(current.apparent_temperature)}°C</div>
            <div class="weather-high-low">
              <span class="high"><i class="fa-solid fa-arrow-up"></i> ${Math.round(daily.temperature_2m_max[0])}°</span>
              <span class="low"><i class="fa-solid fa-arrow-down"></i> ${Math.round(daily.temperature_2m_min[0])}°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="weather-details-grid">
      ${weatherDetail("humidity", "fa-solid fa-droplet", "Humidity", `${current.relative_humidity_2m}%`, current.relative_humidity_2m)}
      ${weatherDetail("wind", "fa-solid fa-wind", "Wind Speed", `${Math.round(current.wind_speed_10m)} km/h`, Math.min(current.wind_speed_10m * 2, 100))}
      ${weatherDetail("uv", "fa-solid fa-sun", "UV Index", current.uv_index ?? "N/A", Math.min((current.uv_index || 0) * 10, 100), uvLevel(current.uv_index))}
      ${weatherDetail("precip", "fa-solid fa-cloud-rain", "Rain Chance", `${daily.precipitation_probability_max?.[0] || 0}%`, daily.precipitation_probability_max?.[0] || 0)}
      <div class="weather-detail-card sunrise-sunset">
        <div class="sun-times-visual">
          <div class="sun-time sunrise"><i class="fa-solid fa-sun"></i><span class="sun-label">Sunrise</span><span class="sun-value">${timeOnly(daily.sunrise[0])}</span></div>
          <div class="sun-arc"><div class="sun-arc-path"></div></div>
          <div class="sun-time sunset"><i class="fa-solid fa-moon"></i><span class="sun-label">Sunset</span><span class="sun-value">${timeOnly(daily.sunset[0])}</span></div>
        </div>
      </div>
    </div>
    <div class="weather-section">
      <h3 class="weather-section-title"><i class="fa-solid fa-clock"></i> Hourly Forecast</h3>
      <div class="hourly-scroll">${renderHourly(w)}</div>
    </div>
    <div class="weather-section">
      <h3 class="weather-section-title"><i class="fa-solid fa-calendar-week"></i> 7-Day Forecast</h3>
      <div class="forecast-list">${renderDaily(w)}</div>
    </div>`;
}

function renderLongWeekends() {
  const target = $("#lw-content");
  if (!state.selected) {
    target.innerHTML = emptyBlock("fa-solid fa-umbrella-beach", "No Country Selected", "Select a country to find long weekend opportunities.");
    return;
  }
  if (!state.longWeekends.length) {
    target.innerHTML = emptyBlock("fa-regular fa-calendar", "No Long Weekends Found", "No long weekend data found for this year.");
    return;
  }
  target.innerHTML = state.longWeekends.map((item, index) => {
    const start = dateFromAny(item.startDate || item.start);
    const end = dateFromAny(item.endDate || item.end);
    const days = daysBetween(start, end) + 1;
    const needBridge = item.needBridgeDay || item.needBridgeDays || item.bridgeDays?.length;
    const plan = longWeekendPlan(item, index, start, end, days);
    return `
      <div class="lw-card">
        <div class="lw-card-header">
          <span class="lw-badge"><i class="fa-solid fa-calendar-days"></i> ${days} Days</span>
          <button class="holiday-action-btn ${isSaved(plan.id) ? "saved" : ""}" data-save='${jsonAttr(plan)}'><i class="${isSaved(plan.id) ? "fa-solid" : "fa-regular"} fa-heart"></i></button>
        </div>
        <h3>Long Weekend #${index + 1}</h3>
        <div class="lw-dates"><i class="fa-regular fa-calendar"></i> ${formatDate(start)} - ${formatDate(end)}</div>
        <div class="lw-info-box ${needBridge ? "warning" : "success"}">
          <i class="fa-solid ${needBridge ? "fa-info-circle" : "fa-check-circle"}"></i> ${needBridge ? "Requires taking a bridge day off" : "No extra days off needed!"}
        </div>
        <div class="lw-days-visual">${daysVisual(start, days)}</div>
      </div>`;
  }).join("");
  bindSaveButtons(target);
}

function renderSunTimes() {
  const target = $("#sun-times-content");
  if (!state.selected) {
    target.innerHTML = emptyBlock("fa-solid fa-sun", "No City Selected", "Select a country and city from the dashboard to see sunrise and sunset times.");
    return;
  }
  const r = state.sun?.results;
  if (!r) {
    target.innerHTML = emptyBlock("fa-regular fa-sun", "Sun Times Unavailable", "Could not load sunrise and sunset times for this city.");
    return;
  }
  const dayLength = secondsToHours(r.day_length);
  const daylightPct = Math.round((r.day_length / 86400) * 1000) / 10;
  target.innerHTML = `
    <div class="sun-main-card">
      <div class="sun-main-header">
        <div class="sun-location"><h2><i class="fa-solid fa-location-dot"></i> ${escapeHtml(state.selected.city)}</h2><p>Sun times for your selected location</p></div>
        <div class="sun-date-display"><div class="date">${formatDate(`${state.selected.year}-01-25`)}</div><div class="day">${weekday(new Date(`${state.selected.year}-01-25T12:00:00`))}</div></div>
      </div>
      <div class="sun-times-grid">
        ${sunCard("dawn", "fa-solid fa-moon", "Dawn", timeOnly(r.civil_twilight_begin), "Civil Twilight")}
        ${sunCard("sunrise", "fa-solid fa-sun", "Sunrise", timeOnly(r.sunrise), "Golden Hour Start")}
        ${sunCard("noon", "fa-solid fa-sun", "Solar Noon", timeOnly(r.solar_noon), "Sun at Highest")}
        ${sunCard("sunset", "fa-solid fa-sun", "Sunset", timeOnly(r.sunset), "Golden Hour End")}
        ${sunCard("dusk", "fa-solid fa-moon", "Dusk", timeOnly(r.civil_twilight_end), "Civil Twilight")}
        ${sunCard("daylight", "fa-solid fa-hourglass-half", "Day Length", dayLength, "Total Daylight")}
      </div>
    </div>
    <div class="day-length-card">
      <h3><i class="fa-solid fa-chart-pie"></i> Daylight Distribution</h3>
      <div class="day-progress"><div class="day-progress-bar"><div class="day-progress-fill" style="width:${daylightPct}%"></div></div></div>
      <div class="day-length-stats">
        <div class="day-stat"><div class="value">${dayLength}</div><div class="label">Daylight</div></div>
        <div class="day-stat"><div class="value">${daylightPct}%</div><div class="label">of 24 Hours</div></div>
        <div class="day-stat"><div class="value">${secondsToHours(86400 - r.day_length)}</div><div class="label">Darkness</div></div>
      </div>
    </div>`;
}

async function convertCurrency() {
  const amount = Number($("#currency-amount")?.value || 0);
  const from = $("#currency-from")?.value || "USD";
  const to = $("#currency-to")?.value || "EGP";
  try {
    if (!state.rates || state.rates.base_code !== from) state.rates = await fetchJson(API.rates(from));
    const rate = state.rates.conversion_rates?.[to];
    const converted = amount * rate;
    $("#currency-result").innerHTML = `
      <div class="conversion-display">
        <div class="conversion-from"><span class="amount">${money(amount)}</span><span class="currency-code">${from}</span></div>
        <div class="conversion-equals"><i class="fa-solid fa-equals"></i></div>
        <div class="conversion-to"><span class="amount">${money(converted)}</span><span class="currency-code">${to}</span></div>
      </div>
      <div class="exchange-rate-info">
        <p>1 ${from} = ${Number(rate).toFixed(6)} ${to}</p>
        <small>Last updated: ${state.rates.time_last_update_utc ? formatDate(state.rates.time_last_update_utc) : "Live rate"}</small>
      </div>`;
    renderPopularCurrencies(from);
  } catch {
    toast("Currency rates are unavailable right now.", "error");
  }
}

function renderPopularCurrencies(base) {
  const popular = ["EUR", "GBP", "EGP", "AED", "SAR", "JPY", "CAD", "INR"].filter((code) => code !== base);
  $("#popular-currencies").innerHTML = popular.map((code) => `
    <div class="popular-currency-card">
      <img src="${currencyFlag(code)}" alt="${code}" class="flag">
      <div class="info"><div class="code">${code}</div><div class="name">${CURRENCIES[code] || code}</div></div>
      <div class="rate">${Number(state.rates.conversion_rates?.[code] || 0).toFixed(4)}</div>
    </div>`).join("");
}

function getPlans() {
  return JSON.parse(localStorage.getItem("wanderlustPlans") || "[]");
}

function setPlans(plans) {
  localStorage.setItem("wanderlustPlans", JSON.stringify(plans));
  renderPlansMeta();
}

function savePlan(plan) {
  const plans = getPlans();
  const existing = plans.find((item) => item.id === plan.id);
  if (existing) {
    setPlans(plans.filter((item) => item.id !== plan.id));
    toast("Removed from My Plans", "info");
  } else {
    setPlans([{ ...plan, savedAt: new Date().toISOString() }, ...plans]);
    toast("Saved to My Plans", "success");
  }
  renderAllSelectionViews();
  if ($("#my-plans-view")?.classList.contains("active")) renderPlans();
}

function isSaved(id) {
  return getPlans().some((plan) => plan.id === id);
}

function renderPlansMeta() {
  const plans = getPlans();
  const counts = {
    all: plans.length,
    holiday: plans.filter((p) => p.type === "holiday").length,
    event: plans.filter((p) => p.type === "event").length,
    longweekend: plans.filter((p) => p.type === "longweekend").length,
  };
  $("#stat-saved").textContent = counts.all;
  $("#plans-count").textContent = counts.all;
  $("#plans-count").classList.toggle("hidden", counts.all === 0);
  $("#filter-all-count").textContent = counts.all;
  $("#filter-holiday-count").textContent = counts.holiday;
  $("#filter-event-count").textContent = counts.event;
  $("#filter-lw-count").textContent = counts.longweekend;
}

function renderPlans() {
  renderPlansMeta();
  $$(".plan-filter").forEach((btn) => btn.classList.toggle("active", btn.dataset.filter === state.planFilter));
  const plans = getPlans().filter((plan) => state.planFilter === "all" || plan.type === state.planFilter);
  const target = $("#plans-content");
  if (!plans.length) {
    target.innerHTML = emptyBlock("fa-solid fa-heart-crack", "No Saved Plans Yet", "Start exploring and save holidays, events, or long weekends you like!", false, "Start Exploring");
    $("#start-exploring-btn")?.addEventListener("click", () => showView("holidays"));
    return;
  }
  target.innerHTML = plans.map((plan) => `
    <div class="plan-card">
      <span class="plan-card-type ${plan.type}">${plan.type === "longweekend" ? "Long Weekend" : plan.type}</span>
      <div class="plan-card-content">
        <h4>${escapeHtml(plan.title)}</h4>
        <div class="plan-card-details">
          <div><i class="fa-regular fa-calendar"></i> ${escapeHtml(plan.date || "Flexible")}</div>
          <div><i class="fa-solid fa-location-dot"></i> ${escapeHtml(plan.location || "Travel plan")}</div>
          ${plan.note ? `<div><i class="fa-solid fa-circle-info"></i> ${escapeHtml(plan.note)}</div>` : ""}
        </div>
        <div class="plan-card-actions">
          <button class="btn-plan-remove" data-remove="${plan.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>
    </div>`).join("");
  target.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setPlans(getPlans().filter((plan) => plan.id !== btn.dataset.remove));
      renderPlans();
      renderAllSelectionViews();
      toast("Plan deleted", "info");
    });
  });
}

function clearAllPlans() {
  if (!getPlans().length) return;
  localStorage.removeItem("wanderlustPlans");
  renderPlans();
  renderAllSelectionViews();
  toast("All saved plans cleared", "info");
}

function showView(view) {
  const viewId = view || "dashboard";
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${viewId}-view`));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  location.hash = viewId;
  closeSidebar();
  const titles = {
    dashboard: ["Dashboard", "Welcome back! Ready to plan your next adventure?"],
    holidays: ["Holidays", "Explore public holidays around the world"],
    events: ["Events", "Find concerts, sports, and entertainment"],
    weather: ["Weather", "Check forecasts for any destination"],
    "long-weekends": ["Long Weekends", "Find the perfect mini-trip opportunities"],
    currency: ["Currency", "Convert currencies with live exchange rates"],
    "sun-times": ["Sun Times", "Check sunrise and sunset times worldwide"],
    "my-plans": ["My Plans", "Your saved holidays and events"],
  };
  const [title, subtitle] = titles[viewId] || titles.dashboard;
  $("#page-title").textContent = title;
  $("#page-subtitle").textContent = subtitle;
  if (viewId === "my-plans") renderPlans();
}

function bindSaveButtons(root) {
  root.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      savePlan(JSON.parse(btn.dataset.save));
    });
  });
}

function fetchJson(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  });
}

function showLoading(text = "Loading...") {
  $("#loading-text").textContent = text;
  $("#loading-overlay").classList.remove("hidden");
}

function hideLoading() {
  $("#loading-overlay").classList.add("hidden");
}

function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-check-circle" : type === "error" ? "fa-triangle-exclamation" : "fa-circle-info"}"></i><span>${escapeHtml(message)}</span><button class="toast-close"><i class="fa-solid fa-xmark"></i></button>`;
  $("#toast-container").appendChild(node);
  node.querySelector("button").addEventListener("click", () => node.remove());
  setTimeout(() => node.remove(), 3500);
}

function updateClock() {
  $("#current-datetime").textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date());
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  $("#sidebar-overlay")?.classList.add("hidden");
}

function emptyBlock(icon, titleText, body, includeButton = true, buttonText = "Go to Dashboard") {
  return `
    <div class="empty-state">
      <div class="empty-icon"><i class="${icon}"></i></div>
      <h3>${escapeHtml(titleText)}</h3>
      <p>${escapeHtml(body)}</p>
      ${includeButton ? `<button class="btn-primary" data-go-dashboard><i class="fa-solid fa-globe"></i> ${buttonText}</button>` : `<button class="btn-primary" id="start-exploring-btn"><i class="fa-solid fa-compass"></i> ${buttonText}</button>`}
    </div>`;
}

window.addEventListener("hashchange", () => showView(location.hash.replace("#", "") || "dashboard"));

function countryDetail(icon, label, value) {
  return `<div class="dashboard-country-detail"><i class="${icon}"></i><span class="label">${label}</span><span class="value">${escapeHtml(value || "N/A")}</span></div>`;
}

function extraTags(icon, titleText, values, cls = "") {
  const list = values?.length ? values : ["N/A"];
  return `<div class="dashboard-country-extra"><h4><i class="${icon}"></i> ${titleText}</h4><div class="extra-tags">${list.map((v) => `<span class="extra-tag ${cls}">${escapeHtml(v)}</span>`).join("")}</div></div>`;
}

function weatherDetail(type, icon, label, value, pct, extra = "") {
  return `<div class="weather-detail-card"><div class="detail-icon ${type}"><i class="${icon}"></i></div><div class="detail-info"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div><div class="detail-bar"><div class="detail-bar-fill" style="width:${pct || 0}%"></div></div>${extra ? `<div class="detail-extra">${extra}</div>` : ""}</div>`;
}

function renderHourly(w) {
  return w.hourly.time.slice(0, 24).map((time, i) => `
    <div class="hourly-item ${i === 0 ? "now" : ""}">
      <span class="hourly-time">${i === 0 ? "Now" : timeOnly(time)}</span>
      <span class="hourly-icon"><i class="${weatherIcon(w.hourly.weather_code[i])}"></i></span>
      <span class="hourly-temp">${Math.round(w.hourly.temperature_2m[i])}°</span>
      <span class="hourly-precip"><i class="fa-solid fa-droplet"></i> ${w.hourly.precipitation_probability[i] || 0}%</span>
    </div>`).join("");
}

function renderDaily(w) {
  return w.daily.time.map((time, i) => {
    const date = new Date(`${time}T12:00:00`);
    return `<div class="forecast-day ${i === 0 ? "today" : ""}">
      <div class="forecast-day-name"><span class="day-label">${i === 0 ? "Today" : weekday(date).slice(0, 3)}</span><span class="day-date">${date.getDate()} ${month(date)}</span></div>
      <div class="forecast-icon"><i class="${weatherIcon(w.daily.weather_code[i])}"></i></div>
      <div class="forecast-temps"><span class="temp-max">${Math.round(w.daily.temperature_2m_max[i])}°</span><span class="temp-min">${Math.round(w.daily.temperature_2m_min[i])}°</span></div>
      <div class="forecast-precip"><i class="fa-solid fa-droplet"></i> ${w.daily.precipitation_probability_max[i] || 0}%</div>
    </div>`;
  }).join("");
}

function sunCard(cls, icon, label, value, sub) {
  return `<div class="sun-time-card ${cls}"><div class="icon"><i class="${icon}"></i></div><div class="label">${label}</div><div class="time">${value}</div><div class="sub-label">${sub}</div></div>`;
}

function holidayPlan(h) {
  return { id: `holiday-${h.countryCode}-${h.date}-${slug(h.name)}`, type: "holiday", title: h.name, date: formatDate(h.date), location: state.selected.countryName, note: h.localName };
}

function eventPlan(e) {
  const date = e.dates?.start?.localDate || "";
  return { id: `event-${e.id}`, type: "event", title: e.name, date: formatDate(date), location: `${state.selected.city}, ${state.selected.countryName}`, note: e._embedded?.venues?.[0]?.name || "" };
}

function longWeekendPlan(item, index, start, end, days) {
  return { id: `longweekend-${state.selected.countryCode}-${start.toISOString().slice(0, 10)}-${index}`, type: "longweekend", title: `Long Weekend #${index + 1}`, date: `${formatDate(start)} - ${formatDate(end)}`, location: state.selected.countryName, note: `${days} days` };
}

function createLongWeekendsFromHolidays(holidays) {
  return holidays
    .map((h) => {
      const d = new Date(`${h.date}T12:00:00`);
      const day = d.getDay();
      if (day === 4) return { startDate: h.date, endDate: addDays(d, 3).toISOString().slice(0, 10), needBridgeDay: false };
      if (day === 0) return { startDate: addDays(d, -2).toISOString().slice(0, 10), endDate: h.date, needBridgeDay: false };
      if (day === 3) return { startDate: h.date, endDate: addDays(d, 3).toISOString().slice(0, 10), needBridgeDay: true };
      return null;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function daysVisual(start, count) {
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(start, i);
    const weekend = [5, 6].includes(d.getDay());
    return `<div class="lw-day ${weekend ? "weekend" : ""}"><span class="name">${weekday(d).slice(0, 3)}</span><span class="num">${d.getDate()}</span></div>`;
  }).join("");
}

function weatherIcon(code) {
  if ([0, 1].includes(code)) return "fa-solid fa-sun";
  if ([2, 3].includes(code)) return "fa-solid fa-cloud-sun";
  if ([45, 48].includes(code)) return "fa-solid fa-smog";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "fa-solid fa-cloud-rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "fa-solid fa-snowflake";
  if ([95, 96, 99].includes(code)) return "fa-solid fa-cloud-bolt";
  return "fa-solid fa-cloud";
}

function weatherText(code) {
  const map = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Slight rain", 63: "Rain", 65: "Heavy rain", 71: "Slight snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 95: "Thunderstorm" };
  return map[code] || "Mixed weather";
}

function weatherClass(code) {
  if ([0, 1].includes(code)) return "weather-sunny";
  if ([2, 3].includes(code)) return "weather-cloudy";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "weather-rainy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "weather-snowy";
  if ([95, 96, 99].includes(code)) return "weather-stormy";
  if ([45, 48].includes(code)) return "weather-foggy";
  return "weather-default";
}

function uvLevel(value = 0) {
  const level = value < 3 ? "low" : value < 6 ? "moderate" : value < 8 ? "high" : value < 11 ? "very-high" : "extreme";
  return `<span class="uv-level ${level}">${level.replace("-", " ")}</span>`;
}

function localTime(timezone = "UTC") {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone.replace("UTC", "Etc/GMT"), hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
  }
}

function dateFromAny(value) {
  return value instanceof Date ? value : new Date(`${value}T12:00:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(a, b) {
  return Math.round((dateFromAny(b) - dateFromAny(a)) / 86400000);
}

function secondsToHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function timeOnly(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "Date TBA";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function weekday(date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
}

function month(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

function flag(code) {
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt()));
}

function flagUrl(code, size = 40) {
  return `https://flagcdn.com/w${size}/${code.toLowerCase()}.png`;
}

function currencyFlag(code) {
  const map = { USD: "us", EUR: "eu", GBP: "gb", EGP: "eg", AED: "ae", SAR: "sa", JPY: "jp", CAD: "ca", INR: "in", AUD: "au", CHF: "ch", CNY: "cn", MAD: "ma", TRY: "tr", KWD: "kw", QAR: "qa" };
  return `https://flagcdn.com/w40/${map[code] || "un"}.png`;
}

function number(value) {
  return Number(value || 0).toLocaleString();
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function title(value) {
  return `${value}`.charAt(0).toUpperCase() + `${value}`.slice(1);
}

function slug(value) {
  return `${value}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return `${value ?? ""}`.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function jsonAttr(value) {
  return escapeHtml(JSON.stringify(value));
}
