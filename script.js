function getSunriseSunset(lat, lng) {
    const apiUrlToday = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&timezone=IST&date=today`;
    const apiUrlTomorrow = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&timezone=IST&date=tomorrow`;

    Promise.all([
            fetch(apiUrlToday),
            fetch(apiUrlTomorrow)
        ])
        .then(responses => Promise.all(responses.map(response => response.json())))
        .then(data => {
            const todayResults = data[0].results;
            const tomorrowResults = data[1].results;

            displaySunriseSunset(todayResults, 'todayTimes');

            displaySunriseSunset(tomorrowResults, 'tomorrowTimes');

            displayUpcomingTimings(todayResults, tomorrowResults, 'upcomingTimes');
        })
        .catch(error => {
            console.error('Error fetching sunrise-sunset data:', error);
            const loadingSpinner = document.querySelector('.loading-spinner');
            loadingSpinner.style.display = 'none';
        });

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

    const todaySunriseTime = new Date(todayResults.date + " " + todayResults.sunrise).getTime();
    const todaySunsetTime = new Date(todayResults.date + " " + todayResults.sunset).getTime();

    const tomorrowSunriseTime = new Date(tomorrowResults.date + " " + tomorrowResults.sunrise).getTime();
    const tomorrowSunsetTime = new Date(tomorrowResults.date + " " + tomorrowResults.sunset).getTime();

    const timeDiffTodaySunrise = todaySunriseTime - currentTime;
    const timeDiffTodaySunset = todaySunsetTime - currentTime;

    const timeDiffTomorrowSunrise = tomorrowSunriseTime - currentTime;
    const timeDiffTomorrowSunset = tomorrowSunsetTime - currentTime;

    console.log("Upcoming Sunrise and Sunset Times:");

    if (timeDiffTodaySunrise > 0) {
        console.log(`Today's Sunrise: ${formatDateTime(todaySunriseTime)}`);
        displayCountdownAndTime(element, 'Sunrise', todaySunriseTime, timeDiffTodaySunrise);
    } else if (timeDiffTomorrowSunrise > 0) {
        console.log(`Tomorrow's Sunrise: ${formatDateTime(tomorrowSunriseTime)}`);
        displayCountdownAndTime(element, 'Sunrise', tomorrowSunriseTime, timeDiffTomorrowSunrise);
    }
    if (timeDiffTodaySunset > 0) {
        console.log(`Today's Sunset: ${formatDateTime(todaySunsetTime)}`);
        displayCountdownAndTime(element, 'Sunset', todaySunsetTime, timeDiffTodaySunset);
    } else if (timeDiffTomorrowSunset > 0) {
        console.log(`Tomorrow's Sunset: ${formatDateTime(tomorrowSunsetTime)}`);
        displayCountdownAndTime(element, 'Sunset', tomorrowSunsetTime, timeDiffTomorrowSunset);
    }
}

function displayCountdownAndTime(element, type, time, timeDiff) {
    const countdownLi = document.createElement('li');
    const countdownElement = document.createElement('span');
    countdownElement.id = `${type.toLowerCase()}Countdown`;

    countdownLi.innerText = `${type} Countdown: `;
    countdownLi.appendChild(countdownElement);
    element.appendChild(countdownLi);

    updateCountdown(type.toLowerCase(), time);

    setInterval(() => {
        updateCountdown(type.toLowerCase(), time);
    }, 1000);

    const timeLi = document.createElement('li');
    timeLi.innerText = `${type}: ${formatDateTime(time)}`;
    element.appendChild(timeLi);
}

function updateCountdown(type, targetTime) {
    const currentTime = Date.now();
    const timeDiff = targetTime - currentTime;

    if (timeDiff > 0) {
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        const countdownElement = document.getElementById(`${type}Countdown`);
        countdownElement.innerText = `${hours}h ${minutes}m ${seconds}s`;
    } else {
        const countdownElement = document.getElementById(`${type}Countdown`);
        countdownElement.innerText = 'Countdown expired';
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

function getLocation() {
    const loadingSpinner = document.querySelector('.loading-spinner');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            document.getElementById('userLocation').innerText = `Your Location: Latitude ${latitude}, Longitude ${longitude}`;
            reverseGeocode(latitude, longitude);
        }, showError);
    } else {
        document.getElementById('userLocation').innerText = "Geolocation is not supported by this browser.";
    }
    loadingSpinner.style.display = 'block';
}

function reverseGeocode(latitude, longitude) {
    var api_key = 'c237683947e94e0e985d798833bafb5d';
    var query = latitude + ',' + longitude;
    var api_url = 'https://api.opencagedata.com/geocode/v1/json';
    var request_url = api_url +
        '?' +
        'key=' + api_key +
        '&q=' + encodeURIComponent(query) +
        '&pretty=1' +
        '&no_annotations=1';

    var request = new XMLHttpRequest();
    request.open('GET', request_url, true);

    request.onload = function() {
        if (request.status === 200) {
            var data = JSON.parse(request.responseText);
            var location = data.results[0].formatted;

            document.getElementById('userLocation').innerText = `Your Location: ${location}`;

            getSunriseSunset(latitude, longitude);
        } else if (request.status <= 500) {
            console.log("Unable to reverse geocode! Response code: " + request.status);
            var data = JSON.parse(request.responseText);
            console.log('Error message: ' + data.status.message);
        } else {
            console.log("Server error");
        }
    };

    request.onerror = function() {
        console.log("Unable to connect to the server");
    };

    request.send();
}

function showError(error) {
    document.getElementById('userLocation').innerText = `Error getting location: ${error.message}`;
    const loadingSpinner = document.querySelector('.loading-spinner');
    loadingSpinner.style.display = 'none';
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