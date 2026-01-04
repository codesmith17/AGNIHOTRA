// Function to format date to DD.MM.YYYY format
function formatDateToDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

const CACHE_KEY = 'agnihotra_timings_cache';
const CACHE_EXPIRY_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds

// Function to check and get valid cached data
function getValidCachedData(lat, lng) {
    const cachedJSON = localStorage.getItem(CACHE_KEY);
    if (!cachedJSON) return null;

    try {
        const cache = JSON.parse(cachedJSON);
        const now = Date.now();

        // 1. Check if older than 6 months
        if (now - cache.lastUpdated > CACHE_EXPIRY_MS) {
            return null;
        }

        // 2. Check if location changed significantly (more than 0.05 degree)
        const latDiff = Math.abs(cache.lat - lat);
        const lngDiff = Math.abs(cache.lng - lng);
        if (latDiff > 0.05 || lngDiff > 0.05) {
            return null;
        }

        // 3. Check if we have data for today
        const todayStr = formatDateToDDMMYYYY(new Date());
        if (!cache.timings || !cache.timings[todayStr]) {
            return null;
        }

        return cache;
    } catch (e) {
        console.error("Error reading cache:", e);
        return null;
    }
}

// Function to save timings to cache
function saveTimingsToCache(timings, lat, lng) {
    const cacheData = {
        lastUpdated: Date.now(),
        lat: lat,
        lng: lng,
        timings: timings
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
}

// Function to get sunrise and sunset - prioritize homatherapie.de for precise timing
async function getSunriseSunset(lat, lng) {
    if (!lat || !lng) {
        console.error('❌ No coordinates provided to getSunriseSunset');
        return;
    }
    
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayFormatted = formatDateToDDMMYYYY(today);
        const tomorrowFormatted = formatDateToDDMMYYYY(tomorrow);

        // Check cache first
        const cache = getValidCachedData(lat, lng);
        if (cache && cache.timings[todayFormatted]) {
            const todayData = cache.timings[todayFormatted];
            const tomorrowData = cache.timings[tomorrowFormatted];
            
            if (todayData) displaySunriseSunset(todayData, 'todayTimes');
            if (tomorrowData) displaySunriseSunset(tomorrowData, 'tomorrowTimes');
            
            if (todayData && tomorrowData) {
                displayUpcomingTimings(todayData, tomorrowData, 'upcomingTimes');
                // Display the full schedule table from cache
                displayFullSchedule(cache.timings);
                return;
            }
        }
        
        // Fetch 6 months of data
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 6);
        const endDateFormatted = formatDateToDDMMYYYY(endDate);

        // Try homatherapie.de first for precise timing (6 month range)
        const allTimings = await fetchSunriseSunsetData(todayFormatted, lat, lng, endDateFormatted);
        
        if (allTimings && Object.keys(allTimings).length > 0) {
            // Save to cache
            saveTimingsToCache(allTimings, lat, lng);
            
            const todayData = allTimings[todayFormatted];
            const tomorrowData = allTimings[tomorrowFormatted];
            
            if (todayData) displaySunriseSunset(todayData, 'todayTimes');
            if (tomorrowData) displaySunriseSunset(tomorrowData, 'tomorrowTimes');
            
            if (todayData && tomorrowData) {
                displayUpcomingTimings(todayData, tomorrowData, 'upcomingTimes');
            } else {
                await getSunriseSunsetFromSunAPI(lat, lng, todayData, tomorrowData);
            }

            // Display the full schedule table
            displayFullSchedule(allTimings);
        } else {
            throw new Error('Failed to fetch precise timing from homatherapie.de');
        }
        
    } catch (error) {
        console.error('❌ homatherapie.de API blocked or failed:', error);
        await getSunriseSunsetFromSunAPI(lat, lng);
    }
}

// Function to fetch data from homatherapie.de for a date range
async function fetchSunriseSunsetData(date, lat, lng, endDate = null) {
    try {
        const year = date.split('.')[2];
        const actualEndDate = endDate || date;
        const url = "https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results.html";
        
        // Get location name first
        let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Fallback to coordinates
        
        try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            
            if (response.ok) {
                const data = await response.json();
                locationName = `${data.city || data.locality || 'Unknown'}, ${data.principalSubdivision || data.countryName || 'Unknown'}`;
            }
        } catch (geoError) {
            // Silently fail geo-naming
        }
        
        // Create form data
        const formData = new URLSearchParams();
        formData.append('yearDate', year);
        formData.append('location', locationName);
        formData.append('lat_deg', lat.toString());
        formData.append('lon_deg', lng.toString());
        formData.append('date', date);
        formData.append('end_date', actualEndDate);
        
        // Try deployed proxies first, then local proxy
        const proxyEndpoints = [
            'https://agnihotra-eternal-agni.vercel.app/api/agnihotra',         // Deployed Vercel endpoint
            'http://localhost:8080/api/agnihotra'                              // Local development endpoint
        ];
        
        let response = null;
        let proxyUsed = null;
        
        for (const endpoint of proxyEndpoints) {
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString()
                });
                
                if (response.ok) {
                    proxyUsed = endpoint;
                    break;
                }
                
            } catch (proxyError) {
                continue;
            }
        }
        
        if (response && response.ok) {
            const htmlText = await response.text();
            
            const timingsMap = {};
            const lines = htmlText.split('\n');
            
            // Regex to find dates like DD.MM.YYYY
            const dateRegex = /(\d{2}\.\d{2}\.\d{4})/;
            // Regex to find times like HH:MM:SS
            const timeRegex = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;

            lines.forEach(line => {
                const dateMatch = line.match(dateRegex);
                if (dateMatch && line.includes('<td') && line.includes('align="right"')) {
                    const dateFound = dateMatch[1];
                    const times = [];
                    let match;
                    
                    // Reset regex state for each line
                    timeRegex.lastIndex = 0;
                    while ((match = timeRegex.exec(line)) !== null) {
                        const hour = match[1].padStart(2, '0');
                        const minute = match[2];
                        const second = match[3];
                        times.push(`${hour}:${minute}:${second}`);
                    }

                    if (times.length >= 2) {
                        timingsMap[dateFound] = {
                            date: dateFound,
                            sunrise: times[0],
                            sunset: times[1]
                        };
                    }
                }
            });
            
            const count = Object.keys(timingsMap).length;
            if (count === 0) {
                return null;
            }
            
            return timingsMap;
            
        } else {
            // Since we can't reliably access homatherapie.de from browser,
            // we'll return null to trigger fallback to sunrisesunset.io
            throw new Error('All proxy endpoints failed. Browser CORS policy prevents direct access to homatherapie.de API.');
        }
        
    } catch (error) {
        console.error(`Error fetching data for ${date}:`, error);
        return null;
    }
}

// Alternative function using sunrisesunset.io API (provides seconds precision)
async function getSunriseSunsetFromSunAPI(lat, lng, existingTodayData = null, existingTomorrowData = null) {
    try {
        let todayData = existingTodayData;
        let tomorrowData = existingTomorrowData;
        
        // Only fetch missing data
        const fetchPromises = [];
        if (!todayData) {
            const apiUrlToday = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=today`;
            fetchPromises.push(fetch(apiUrlToday).then(r => r.json()));
        } else {
            fetchPromises.push(Promise.resolve(null));
        }
        
        if (!tomorrowData) {
            const apiUrlTomorrow = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=tomorrow`;
            fetchPromises.push(fetch(apiUrlTomorrow).then(r => r.json()));
        } else {
            fetchPromises.push(Promise.resolve(null));
        }
        
        const [todayResponse, tomorrowResponse] = await Promise.all(fetchPromises);
        
        // Use existing data or convert from API response
        if (!todayData && todayResponse) {
            const todayResults = todayResponse.results;
            todayData = {
                date: todayResults.date,
                sunrise: todayResults.sunrise,
                sunset: todayResults.sunset
            };
        }
        
        if (!tomorrowData && tomorrowResponse) {
            const tomorrowResults = tomorrowResponse.results;
            tomorrowData = {
                date: tomorrowResults.date,
                sunrise: tomorrowResults.sunrise,
                sunset: tomorrowResults.sunset
            };
        }

        displaySunriseSunset(todayData, 'todayTimes');
        displaySunriseSunset(tomorrowData, 'tomorrowTimes');
        displayUpcomingTimings(todayData, tomorrowData, 'upcomingTimes');
        
    } catch (error) {
        console.error('Error with sunrisesunset.io API:', error);
        const loadingSpinner = document.querySelector('.loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

function displaySunriseSunset(results, elementId) {
    const element = document.getElementById(elementId);
    element.innerHTML = ''; // Clear previous

    // Add Date Header once
    const dateHeader = document.createElement('div');
    dateHeader.className = 'card-date-header';
    dateHeader.innerText = results.date;
    element.appendChild(dateHeader);

    const sunriseDiv = document.createElement('div');
    sunriseDiv.className = 'time-item';
    sunriseDiv.innerHTML = `
        <span class="time-label"><i class="fas fa-sun" style="color: #FFD700;"></i> SUNRISE</span>
        <span class="time-value">${formatTimeToAMPM(results.sunrise)}</span>
    `;

    const sunsetDiv = document.createElement('div');
    sunsetDiv.className = 'time-item';
    sunsetDiv.innerHTML = `
        <span class="time-label"><i class="fas fa-moon" style="color: #4B0082;"></i> SUNSET</span>
        <span class="time-value">${formatTimeToAMPM(results.sunset)}</span>
    `;

    element.appendChild(sunriseDiv);
    element.appendChild(sunsetDiv);
}

function formatTimeToAMPM(timeStr) {
    if (!timeStr) return '--:--:--';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
}

function displayFullSchedule(timings) {
    const tableBody = document.getElementById('timingsTableBody');
    if (!tableBody) return;

    // Show the schedule section
    const scheduleSection = tableBody.closest('.schedule-section') || tableBody.closest('.schedule-container');
    if (scheduleSection) {
        scheduleSection.style.display = 'block';
    }

    // Clear existing rows
    tableBody.innerHTML = '';

    // Sort dates
    const sortedDates = Object.keys(timings).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.').map(Number);
        const [dayB, monthB, yearB] = b.split('.').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });

    // Add rows for each date
    sortedDates.forEach(dateStr => {
        const data = timings[dateStr];
        const row = document.createElement('tr');
        
        // Highlight today's row
        const todayStr = formatDateToDDMMYYYY(new Date());
        if (dateStr === todayStr) {
            row.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
            row.style.fontWeight = 'bold';
        }

        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${data.sunrise}</td>
            <td>${data.sunset}</td>
        `;
        tableBody.appendChild(row);
    });
}

function displayUpcomingTimings(todayResults, tomorrowResults, elementId) {
    const element = document.getElementById(elementId);
    const currentTime = Date.now();

    // Parse the date format DD.MM.YYYY and time format HH:MM:SS
    const todaySunriseTime = parseDateTime(todayResults.date, todayResults.sunrise);
    const todaySunsetTime = parseDateTime(todayResults.date, todayResults.sunset);
    const tomorrowSunriseTime = parseDateTime(tomorrowResults.date, tomorrowResults.sunrise);
    const tomorrowSunsetTime = parseDateTime(tomorrowResults.date, tomorrowResults.sunset);

    // Clear previous content and countdowns
    element.innerHTML = '';
    window.activeCountdowns = {}; // Clear all active countdowns

    // Find the next upcoming event(s) based on current time
    const upcomingEvents = [];

    // Check what's coming next - always show the next 2 upcoming events
    if (currentTime < todaySunriseTime) {
        // Before today's sunrise - show today's sunrise and sunset
        upcomingEvents.push(['Today\'s Sunrise', todaySunriseTime]);
        upcomingEvents.push(['Today\'s Sunset', todaySunsetTime]);
    } else if (currentTime < todaySunsetTime) {
        // After today's sunrise but before today's sunset - show today's sunset and tomorrow's sunrise
        upcomingEvents.push(['Today\'s Sunset', todaySunsetTime]);
        upcomingEvents.push(['Tomorrow\'s Sunrise', tomorrowSunriseTime]);
    } else {
        // After today's sunset - show tomorrow's sunrise and sunset
        upcomingEvents.push(['Tomorrow\'s Sunrise', tomorrowSunriseTime]);
        upcomingEvents.push(['Tomorrow\'s Sunset', tomorrowSunsetTime]);
    }

    // Display the upcoming events
    upcomingEvents.forEach(([eventName, eventTime]) => {
        displayCountdownAndTime(element, eventName, eventTime);
    });
}

// Helper function to parse date and time into timestamp
function parseDateTime(dateStr, timeStr) {
    // Handle both DD.MM.YYYY and YYYY-MM-DD formats
    let day, month, year;
    
    if (dateStr.includes('.')) {
        // DD.MM.YYYY format from homatherapie.de
        [day, month, year] = dateStr.split('.').map(Number);
    } else if (dateStr.includes('-')) {
        // YYYY-MM-DD format from sunrisesunset.io API
        [year, month, day] = dateStr.split('-').map(Number);
    } else {
        console.error("Unknown date format:", dateStr);
        return Date.now(); // Return current time if parsing fails
    }
    
    // Parse time string - handle both "HH:MM:SS" and "H:MM:SS AM/PM" formats
    let hours, minutes, seconds = 0;
    
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
        // Handle AM/PM format like "6:04:27 AM"
        const isPM = timeStr.includes('PM');
        const timePart = timeStr.replace(/\s*(AM|PM)/i, '');
        
        const timeParts = timePart.split(':');
        hours = parseInt(timeParts[0]);
        minutes = parseInt(timeParts[1]);
        seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;
        
        // Convert to 24-hour format
        if (isPM && hours !== 12) {
            hours += 12;
        } else if (!isPM && hours === 12) {
            hours = 0;
        }
    } else {
        // Handle 24-hour format like "06:04:27"
        const timeParts = timeStr.split(':');
        hours = parseInt(timeParts[0]);
        minutes = parseInt(timeParts[1]);
        seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;
    }
    
    // Validate parsed values
    if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        console.error("Failed to parse date/time:", { dateStr, timeStr, day, month, year, hours, minutes, seconds });
        return Date.now(); // Return current time if parsing fails
    }
    
    // Create date object (month is 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    
    return date.getTime();
}

// Global object to store countdown data
window.activeCountdowns = window.activeCountdowns || {};

function displayCountdownAndTime(element, type, time) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'time-item';
    
    // Create a unique ID by removing spaces and special characters
    const uniqueId = type.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isSunrise = type.toLowerCase().includes('sunrise');
    const iconClass = isSunrise ? 'fas fa-sun' : 'fas fa-moon';
    const iconColor = isSunrise ? '#FFD700' : '#4B0082';
    
    itemDiv.innerHTML = `
        <span class="time-label"><i class="${iconClass}" style="color: ${iconColor};"></i> ${type.toUpperCase()}</span>
        <span id="${uniqueId}Countdown" class="countdown-value">--h --m --s</span>
        <span class="time-secondary">at ${formatDateTimeToTimeOnly(time)}</span>
    `;

    element.appendChild(itemDiv);

    // Store countdown data globally
    window.activeCountdowns[uniqueId] = time;

    // Start the countdown immediately
    updateCountdown(uniqueId, time);
}

function formatDateTimeToTimeOnly(time) {
    const date = new Date(time);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${String(h).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

// Global countdown updater - runs every second
if (!window.countdownInterval) {
    window.countdownInterval = setInterval(() => {
        for (const [countdownId, targetTime] of Object.entries(window.activeCountdowns)) {
            updateCountdown(countdownId, targetTime);
        }
    }, 1000);
}

function updateCountdown(type, targetTime) {
    const currentTime = Date.now();
    const timeDiff = targetTime - currentTime;

    const countdownElement = document.getElementById(`${type}Countdown`);
    
    if (!countdownElement) {
        return; // Element doesn't exist, skip update
    }

    if (timeDiff > 0) {
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        let countdownText = '';
        if (days > 0) {
            countdownText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else {
            countdownText = `${hours}h ${minutes}m ${seconds}s`;
        }
        
        countdownElement.innerText = countdownText;
    } else {
        countdownElement.innerText = 'Time passed';
    }
}

function formatDateTime(time) {
    const date = new Date(time);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedDate = `${date.toDateString()} ${hours % 12 || 12}:${minutes}:${seconds} ${ampm}`;
    return formattedDate;
}

async function getLocation() {
    const loadingSpinner = document.querySelector('.loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'block';
    }
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            document.getElementById('userLocation').innerText = `Your Location: Latitude ${latitude}, Longitude ${longitude}`;
            await reverseGeocode(latitude, longitude);
        }, async (error) => {
            await showError(error);
        });
    } else {
        document.getElementById('userLocation').innerText = "Geolocation not supported. Getting approximate location...";
        // Try to get approximate location using IP-based geolocation
        await getApproximateLocation();
    }
}

async function reverseGeocode(latitude, longitude) {
    try {
        // Use Nominatim (OpenStreetMap) for more precise address details
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Extract a clean, precise address
            const address = data.display_name;
            const shortAddress = address.split(',').slice(0, 4).join(',').trim(); // Get first few parts for cleaner display
            
            document.getElementById('userLocation').innerHTML = `
                <span style="font-size: 0.9rem; opacity: 0.8; display: block; margin-bottom: 5px;">Detected Address:</span>
                <span style="font-weight: bold; font-size: 1.1rem; line-height: 1.4; display: block;">${address}</span>
            `;

            // Call the async getSunriseSunset function
            await getSunriseSunset(latitude, longitude);
        } else {
            // Fallback to original BigDataCloud service if Nominatim fails
            const bdcResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            if (bdcResponse.ok) {
                const bdcData = await bdcResponse.json();
                const location = `${bdcData.city || bdcData.locality || 'Unknown City'}, ${bdcData.principalSubdivision || 'Unknown State'}, ${bdcData.countryName || 'Unknown Country'}`;
                document.getElementById('userLocation').innerText = `Your Location: ${location}`;
                await getSunriseSunset(latitude, longitude);
            } else {
                throw new Error("All geocoding services failed");
            }
        }
    } catch (error) {
        // Fall back to coordinates display
        document.getElementById('userLocation').innerText = `Your Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        await getSunriseSunset(latitude, longitude);
    }
    
    // Hide loading spinner
    const loadingSpinner = document.querySelector('.loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
}

async function reverseGeocodeApproximate(latitude, longitude) {
    try {
        // Use the same reverse geocoding service but mark as approximate
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        
        if (response.ok) {
            const data = await response.json();
            const location = `${data.city || data.locality || 'Unknown City'}, ${data.principalSubdivision || 'Unknown State'}, ${data.countryName || 'Unknown Country'}`;

            document.getElementById('userLocation').innerText = `Your Location: ${location} (approximate)`;

            // Call the async getSunriseSunset function with approximate coordinates
            await getSunriseSunset(latitude, longitude);
        } else {
            // Fall back to coordinates display
            document.getElementById('userLocation').innerText = `Your Location: ${latitude.toFixed(2)}, ${longitude.toFixed(2)} (approximate)`;
            await getSunriseSunset(latitude, longitude);
        }
    } catch (error) {
        // Fall back to coordinates display but continue with sunrise/sunset
        document.getElementById('userLocation').innerText = `Your Location: ${latitude.toFixed(2)}, ${longitude.toFixed(2)} (approximate)`;
        await getSunriseSunset(latitude, longitude);
    }
    
    // Hide loading spinner
    const loadingSpinner = document.querySelector('.loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
}

async function getApproximateLocation() {
    try {
        // Try multiple IP geolocation services to get coordinates only
        const services = [
            'https://ipapi.co/json/',
            'https://geolocation-db.com/json/',
            'https://freeipapi.com/api/json',
            'https://ipgeolocation.abstractapi.com/v1/?api_key=',
            'https://ipwho.is/'
        ];

        let coordinates = null;
        
        for (const service of services) {
            try {
                const response = await fetch(service);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // Extract only coordinates from different API response formats
                    if (data.latitude && data.longitude) {
                        // ipapi.co, geolocation-db.com, ipwho.is format
                        coordinates = {
                            lat: parseFloat(data.latitude),
                            lng: parseFloat(data.longitude)
                        };
                        break;
                    } else if (data.lat && data.lon) {
                        // Alternative lat/lon format
                        coordinates = {
                            lat: parseFloat(data.lat),
                            lng: parseFloat(data.lon)
                        };
                        break;
                    }
                }
            } catch (serviceError) {
                continue; // Try next service
            }
        }

        if (coordinates) {
            // Update location text to show we're identifying the place
            document.getElementById('userLocation').innerText = `Identifying location... (${coordinates.lat.toFixed(2)}, ${coordinates.lng.toFixed(2)})`;
            
            // Use the same reverse geocoding function to identify the place
            await reverseGeocodeApproximate(coordinates.lat, coordinates.lng);
        } else {
            throw new Error('All IP geolocation services failed to provide coordinates');
        }
        
    } catch (error) {
        console.error('IP geolocation failed:', error);
        // No fallback coordinates - require user to enable location
        document.getElementById('userLocation').innerText = `❌ Unable to detect location. Please refresh and allow location access for Agnihotra times.`;
        
        // Add a note about enabling location
        const upcomingElement = document.getElementById('upcomingTimes');
        if (upcomingElement) {
            upcomingElement.innerHTML = '<li>📍 Location access required for accurate Agnihotra timing</li>';
        }
        
        // Hide loading spinner
        const loadingSpinner = document.querySelector('.loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

async function showError(error) {
    document.getElementById('userLocation').innerText = `Getting approximate location...`;
    
    // Try to get approximate location using IP-based geolocation
    await getApproximateLocation();
}

window.onload = getLocation;

document.addEventListener('DOMContentLoaded', function() {
    const fadeElements = document.querySelectorAll('.fade-in');

    function checkScroll() {
        fadeElements.forEach((element) => {
            const elementTop = element.getBoundingClientRect().top;

            if (elementTop < window.innerHeight - 50) {
                element.classList.add('active');
            }
        });
    }

    function scrollToMantras() {
        const mantrasSection = document.getElementById('mantras-section');

        mantrasSection.scrollIntoView({
            behavior: 'smooth'
        });
    }

    window.addEventListener('scroll', checkScroll);
    checkScroll();
});