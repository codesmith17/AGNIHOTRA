// Function to format date to DD.MM.YYYY format
function formatDateToDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Function to get sunrise and sunset - prioritize homatherapie.de for precise timing
async function getSunriseSunset(lat, lng) {
    if (!lat || !lng) {
        console.error('❌ No coordinates provided to getSunriseSunset');
        return;
    }
    
    console.log(`🌅 Getting precise sunrise/sunset for coordinates: ${lat}, ${lng}`);
    
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayFormatted = formatDateToDDMMYYYY(today);
        const tomorrowFormatted = formatDateToDDMMYYYY(tomorrow);
        
        console.log(`[*] Fetching precise data for today: ${todayFormatted} and tomorrow: ${tomorrowFormatted}...`);
        
        // Try homatherapie.de first for precise timing
        const [todayData, tomorrowData] = await Promise.all([
            fetchSunriseSunsetData(todayFormatted, lat, lng),
            fetchSunriseSunsetData(tomorrowFormatted, lat, lng)
        ]);
        
        if (todayData && tomorrowData) {
            console.log("✅ Got precise timing from homatherapie.de");
            console.log("Today data:", todayData);
            console.log("Tomorrow data:", tomorrowData);
            
            displaySunriseSunset(todayData, 'todayTimes');
            displaySunriseSunset(tomorrowData, 'tomorrowTimes');
            displayUpcomingTimings(todayData, tomorrowData, 'upcomingTimes');
        } else {
            throw new Error('Failed to fetch precise timing from homatherapie.de');
        }
        
    } catch (error) {
        console.error('❌ homatherapie.de API blocked by CORS policy:', error);
        console.log('🔧 CORS prevents browser access to homatherapie.de API');
        console.log('💡 Solution: Use server-side proxy or browser extension to access homatherapie.de');
        console.log('🌅 Using sunrisesunset.io API which also provides seconds precision...');
        await getSunriseSunsetFromSunAPI(lat, lng);
    }
}

// Function to fetch data from homatherapie.de for a specific date
async function fetchSunriseSunsetData(date, lat, lng) {
    try {
        const year = date.split('.')[2];
        const url = "https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results.html";
        
        // Get location name first
        let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Fallback to coordinates
        
        try {
            console.log(`🔍 Getting location name for coordinates: ${lat}, ${lng}`);
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            
            if (response.ok) {
                const data = await response.json();
                locationName = `${data.city || data.locality || 'Unknown'}, ${data.principalSubdivision || data.countryName || 'Unknown'}`;
                console.log(`📍 Location name resolved: ${locationName}`);
            } else {
                console.log('Could not resolve location name, using coordinates');
            }
        } catch (geoError) {
            console.log('Reverse geocoding failed, using coordinates:', geoError);
        }
        
        // Create form data
        const formData = new URLSearchParams();
        formData.append('yearDate', year);
        formData.append('location', locationName);
        formData.append('lat_deg', lat.toString());
        formData.append('lon_deg', lng.toString());
        formData.append('date', date);
        formData.append('end_date', date);
        
        console.log(`[*] Sending precise timing request for date: ${date}`);
        console.log(`[*] Location: ${locationName}`);
        console.log(`[*] Coordinates: ${lat}, ${lng}`);
        
        // Try deployed proxies first, then local proxy
        const proxyEndpoints = [
            'https://agnihotra-eternal-agni.vercel.app/',  // Deployed Netlify endpoint
            'http://localhost:8080/api/agnihotra'                              // Local development endpoint
        ];
        
        let response = null;
        let proxyUsed = null;
        
        for (const endpoint of proxyEndpoints) {
            try {
                console.log(`[*] Trying proxy endpoint: ${endpoint}`);
                
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString()
                });
                
                if (response.ok) {
                    proxyUsed = endpoint;
                    console.log(`✅ Connected to proxy: ${endpoint}`);
                    break;
                }
                
            } catch (proxyError) {
                console.log(`❌ Proxy ${endpoint} failed:`, proxyError.message);
                continue;
            }
        }
        
        if (response && response.ok) {
            console.log(`✅ Using proxy: ${proxyUsed}`);
            
            const htmlText = await response.text();
            console.log(`[*] Response fetched via proxy for ${date}. Searching for row...`);
            
            // Extract the line containing the date and times from the HTML response
            const lines = htmlText.split('\n');
            const rowContent = lines.find(line => line.includes(date));
            
            if (!rowContent) {
                console.log(`[!] Could not find sunrise/sunset row for ${date}`);
                return null;
            }
            
            console.log(`[*] Found row content for ${date}: ${rowContent.substring(0, 200)}...`);
            
            // Extract sunrise and sunset times with precise HH:MM:SS format
            const timeRegex = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
            const times = [];
            let match;
            
            while ((match = timeRegex.exec(rowContent)) !== null) {
                // Ensure we have proper HH:MM:SS format
                const hour = match[1].padStart(2, '0');
                const minute = match[2];
                const second = match[3];
                times.push(`${hour}:${minute}:${second}`);
            }
            
            if (!times || times.length < 2) {
                console.log(`[!] Could not parse sunrise and sunset times from row for ${date}.`);
                console.log(`[!] Row content: ${rowContent}`);
                return null;
            }
            
            const sunrise = times[0];
            const sunset = times[1];
            
            console.log(`✅ Extracted PRECISE homatherapie.de timing for ${date}:`);
            console.log(`   🌅 Sunrise: ${sunrise} (seconds precision)`);
            console.log(`   🌇 Sunset: ${sunset} (seconds precision)`);
            
            return {
                date: date,
                sunrise: sunrise,
                sunset: sunset
            };
            
        } else {
            console.log(`❌ All proxy endpoints failed`);
            console.log(`💡 To get precise homatherapie.de timing, use deployment or run local proxy`);
            console.log(`🔄 Falling back to browser-compatible API...`);
            
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
async function getSunriseSunsetFromSunAPI(lat, lng) {
    const apiUrlToday = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=today`;
    const apiUrlTomorrow = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=tomorrow`;

    try {
        console.log("🌅 Using sunrisesunset.io API (also provides seconds precision)...");
        console.log("ℹ️  Note: This API also provides HH:MM:SS format, suitable for Agnihotra timing");
        
        const responses = await Promise.all([
            fetch(apiUrlToday),
            fetch(apiUrlTomorrow)
        ]);
        
        const data = await Promise.all(responses.map(response => response.json()));
        
        const todayResults = data[0].results;
        const tomorrowResults = data[1].results;

        console.log("✅ SECONDS-PRECISION timing - Today:", todayResults);
        console.log("✅ SECONDS-PRECISION timing - Tomorrow:", tomorrowResults);

        // Convert to format expected by our functions
        const todayData = {
            date: todayResults.date,
            sunrise: todayResults.sunrise,
            sunset: todayResults.sunset
        };

        const tomorrowData = {
            date: tomorrowResults.date,
            sunrise: tomorrowResults.sunrise,
            sunset: tomorrowResults.sunset
        };

        console.log("Formatted Today data:", todayData);
        console.log("Formatted Tomorrow data:", tomorrowData);

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

    const sunriseLi = document.createElement('li');
    sunriseLi.innerText = `Sunrise: ${results.sunrise}`;

    const sunsetLi = document.createElement('li');
    sunsetLi.innerText = `Sunset: ${results.sunset}`;

    element.appendChild(sunriseLi);
    element.appendChild(sunsetLi);
}

function displayUpcomingTimings(todayResults, tomorrowResults, elementId) {
    const element = document.getElementById(elementId);
    const currentTime = Date.now();

    // Parse the date format DD.MM.YYYY and time format HH:MM:SS
    const todaySunriseTime = parseDateTime(todayResults.date, todayResults.sunrise);
    const todaySunsetTime = parseDateTime(todayResults.date, todayResults.sunset);
    const tomorrowSunriseTime = parseDateTime(tomorrowResults.date, tomorrowResults.sunrise);
    const tomorrowSunsetTime = parseDateTime(tomorrowResults.date, tomorrowResults.sunset);

    console.log("Current time:", new Date(currentTime));
    console.log("Today sunrise:", new Date(todaySunriseTime));
    console.log("Today sunset:", new Date(todaySunsetTime));
    console.log("Tomorrow sunrise:", new Date(tomorrowSunriseTime));

    // Clear previous content and countdowns
    element.innerHTML = '';
    window.activeCountdowns = {}; // Clear all active countdowns

    // Find the next upcoming event(s) based on current time
    const upcomingEvents = [];

    // Check what's coming next
    if (currentTime < todaySunriseTime) {
        // Before today's sunrise - show today's sunrise and sunset
        upcomingEvents.push(['Today\'s Sunrise', todaySunriseTime]);
        upcomingEvents.push(['Today\'s Sunset', todaySunsetTime]);
    } else {
        // After today's sunrise has passed - both next events are tomorrow's
        upcomingEvents.push(['Tomorrow\'s Sunrise', tomorrowSunriseTime]);
        upcomingEvents.push(['Tomorrow\'s Sunset', tomorrowSunsetTime]);
    }

    console.log("Showing upcoming events:", upcomingEvents);

    // Display the upcoming events
    upcomingEvents.forEach(([eventName, eventTime]) => {
        displayCountdownAndTime(element, eventName, eventTime);
    });
}

// Helper function to parse date and time into timestamp
function parseDateTime(dateStr, timeStr) {
    console.log("Parsing date:", dateStr, "time:", timeStr);
    
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
    
    console.log(`✅ Parsed with SECONDS precision: ${date.toLocaleString()} (${hours}:${minutes}:${seconds})`);
    return date.getTime();
}

// Global object to store countdown data
window.activeCountdowns = window.activeCountdowns || {};

function displayCountdownAndTime(element, type, time) {
    const countdownLi = document.createElement('li');
    const countdownElement = document.createElement('span');
    
    // Create a unique ID by removing spaces and special characters
    const uniqueId = type.toLowerCase().replace(/[^a-z0-9]/g, '');
    countdownElement.id = `${uniqueId}Countdown`;

    countdownLi.innerText = `${type} Countdown: `;
    countdownLi.appendChild(countdownElement);
    element.appendChild(countdownLi);

    // Store countdown data globally
    window.activeCountdowns[uniqueId] = time;

    // Start the countdown immediately
    updateCountdown(uniqueId, time);

    const timeLi = document.createElement('li');
    timeLi.innerText = `${type}: ${formatDateTime(time)}`;
    element.appendChild(timeLi);
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
        console.log('Geolocation not supported, trying IP-based geolocation...');
        await getApproximateLocation();
    }
}

async function reverseGeocode(latitude, longitude) {
    try {
        // Use a free reverse geocoding service
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        
        if (response.ok) {
            const data = await response.json();
            const location = `${data.city || data.locality || 'Unknown City'}, ${data.principalSubdivision || 'Unknown State'}, ${data.countryName || 'Unknown Country'}`;

            document.getElementById('userLocation').innerText = `Your Location: ${location}`;

            // Call the async getSunriseSunset function
            await getSunriseSunset(latitude, longitude);
        } else {
            console.log("Unable to reverse geocode! Response code: " + response.status);
            // Fall back to coordinates display
            document.getElementById('userLocation').innerText = `Your Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            await getSunriseSunset(latitude, longitude);
        }
    } catch (error) {
        console.log("Unable to connect to the reverse geocoding server:", error);
        // Fall back to coordinates display but use precise location for sunrise/sunset
        document.getElementById('userLocation').innerText = `Your Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
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
        console.log(`Reverse geocoding approximate coordinates: ${latitude}, ${longitude}`);
        
        // Use the same reverse geocoding service but mark as approximate
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        
        if (response.ok) {
            const data = await response.json();
            const location = `${data.city || data.locality || 'Unknown City'}, ${data.principalSubdivision || 'Unknown State'}, ${data.countryName || 'Unknown Country'}`;

            document.getElementById('userLocation').innerText = `Your Location: ${location} (approximate)`;
            console.log(`Identified approximate location: ${location}`);

            // Call the async getSunriseSunset function with approximate coordinates
            await getSunriseSunset(latitude, longitude);
        } else {
            console.log("Unable to reverse geocode approximate location! Response code: " + response.status);
            // Fall back to coordinates display
            document.getElementById('userLocation').innerText = `Your Location: ${latitude.toFixed(2)}, ${longitude.toFixed(2)} (approximate)`;
            await getSunriseSunset(latitude, longitude);
        }
    } catch (error) {
        console.log("Unable to connect to reverse geocoding server for approximate location:", error);
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
    console.log('🌍 Starting IP-based approximate location detection...');
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
                console.log(`Trying IP geolocation service: ${service}`);
                const response = await fetch(service);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('IP geolocation response:', data);
                    
                    // Extract only coordinates from different API response formats
                    if (data.latitude && data.longitude) {
                        // ipapi.co, geolocation-db.com, ipwho.is format
                        coordinates = {
                            lat: parseFloat(data.latitude),
                            lng: parseFloat(data.longitude)
                        };
                        console.log(`Service ${service} returned coordinates: ${coordinates.lat}, ${coordinates.lng}`);
                        break;
                    } else if (data.lat && data.lon) {
                        // Alternative lat/lon format
                        coordinates = {
                            lat: parseFloat(data.lat),
                            lng: parseFloat(data.lon)
                        };
                        console.log(`Service ${service} returned coordinates: ${coordinates.lat}, ${coordinates.lng}`);
                        break;
                    } else {
                        console.log(`Service ${service} did not return usable coordinates. Response:`, data);
                    }
                }
            } catch (serviceError) {
                console.log(`Service ${service} failed:`, serviceError);
                continue; // Try next service
            }
        }

        if (coordinates) {
            console.log(`Got approximate coordinates: ${coordinates.lat}, ${coordinates.lng}`);
            
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
        console.log('❌ All location detection methods failed. Cannot provide sunrise/sunset times without location.');
        
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
    console.log('Precise location denied, trying IP-based geolocation...');
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

    const mantrasLink = document.getElementById('work');
    mantrasLink.addEventListener('click', scrollToMantras);
});