#include "AgnihotraTimingEngine.h"
#include "AstronomicalConstants.h"
#include <cmath>
#include <iomanip>
#include <sstream>

using namespace AstronomicalConstants;

namespace {
    inline double degreesToRadians(double degrees) {
        return degrees * DEG_TO_RAD;
    }

    inline double radiansToDegrees(double radians) {
        return radians * RAD_TO_DEG;
    }

    inline double normalizeDegrees(double degrees) {
        double result = std::fmod(degrees, 360.0);
        if (result < 0.0) {
            result += 360.0;
        }
        return result;
    }
}

// -----------------------------------------------------------------------------
// 1. Julian Day and Julian Centuries Calculation
// -----------------------------------------------------------------------------

/**
 * @brief Computes the Julian Day number for a given Gregorian date.
 *
 * Implements the standard integer-arithmetic algorithm (Meeus Ch. 7, p. 60).
 * Handles months Jan/Feb as months 13/14 of the preceding year to simplify leap cycles.
 */
double AgnihotraTimingEngine::computeJulianDay(int year, int month, int day) {
    int adjustedYear = year;
    int adjustedMonth = month;

    if (adjustedMonth <= 2) {
        adjustedYear -= 1;
        adjustedMonth += 12;
    }

    // Gregorian calendar leap year correction terms
    const int centuryTerm = adjustedYear / 100;
    const int gregorianLeapCorrection = 2 - centuryTerm + (centuryTerm / 4);

    const double julianDay = std::floor(365.25 * (adjustedYear + 4716))
                           + std::floor(30.6001 * (adjustedMonth + 1))
                           + day
                           + gregorianLeapCorrection
                           - 1524.5;
    return julianDay;
}

/**
 * @brief Computes time elapsed since astronomical epoch J2000.0 in Julian centuries.
 *
 * Formula: T = (JD - 2451545.0) / 36525.0
 * (Meeus Eq. 25.1)
 */
double AgnihotraTimingEngine::computeJulianCenturies(double julianDay) {
    return (julianDay - JULIAN_DAY_J2000_EPOCH) / DAYS_PER_JULIAN_CENTURY;
}

// -----------------------------------------------------------------------------
// 2. Solar Orbital Mechanics (Jean Meeus Chapter 25)
// -----------------------------------------------------------------------------

/**
 * @brief Computes the Sun's Geometric Mean Longitude (L0) in degrees.
 *
 * Physical Meaning:
 *  - Represents the Sun's mean position along the ecliptic if Earth moved in a perfect circle.
 *  - SUN_MEAN_LONGITUDE_BASE_J2000 (280.46646°): Position at J2000.0.
 *  - SUN_MEAN_LONGITUDE_RATE_PER_CENTURY (36000.76983°/century): Accounts for 100 complete
 *    orbits (36,000°) plus Earth's general axial precession shift (+0.76983° per century).
 *  - SUN_MEAN_LONGITUDE_QUADRATIC_COEFF (0.0003032°): Long-term secular acceleration.
 *
 * Formula: L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T^2
 * (Meeus Eq. 25.2, NOAA Solar Calculation Details)
 */
double AgnihotraTimingEngine::computeGeometricMeanLongitude(double julianCentury) {
    const double meanLongitude = SUN_MEAN_LONGITUDE_BASE_J2000 
        + julianCentury * (SUN_MEAN_LONGITUDE_RATE_PER_CENTURY 
        + SUN_MEAN_LONGITUDE_QUADRATIC_COEFF * julianCentury);

    return normalizeDegrees(meanLongitude);
}

/**
 * @brief Computes the Sun's Geometric Mean Anomaly (M) in degrees.
 *
 * Physical Meaning:
 *  - Earth's angular distance from its orbital perihelion (closest approach to the Sun).
 *  - SUN_MEAN_ANOMALY_BASE_J2000 (357.52911°): Position at epoch J2000.0.
 *  - SUN_MEAN_ANOMALY_RATE_PER_CENTURY (35999.05029°/century): Earth makes ~100 orbits minus
 *    the forward precession of the perihelion (36,000° - 0.94971° = 35999.05029°).
 *
 * Formula: M = 357.52911 + 35999.05029 * T - 0.0001537 * T^2
 * (Meeus Eq. 25.3, NOAA Solar Calculation Details)
 */
double AgnihotraTimingEngine::computeGeometricMeanAnomaly(double julianCentury) {
    const double meanAnomaly = SUN_MEAN_ANOMALY_BASE_J2000 
        + julianCentury * (SUN_MEAN_ANOMALY_RATE_PER_CENTURY 
        - SUN_MEAN_ANOMALY_QUADRATIC_COEFF * julianCentury);

    return meanAnomaly;
}

/**
 * @brief Computes the Eccentricity of Earth's Orbit (e).
 *
 * Physical Meaning:
 *  - Measures how elliptical (oval) Earth's orbit is (0 = circular).
 *  - EARTH_ECCENTRICITY_BASE_J2000 (0.016708634): Eccentricity at J2000.0.
 *  - EARTH_ECCENTRICITY_RATE_PER_CENTURY (0.000042037): Earth's orbit is slowly becoming
 *    more circular due to gravitational tugs from Venus and Jupiter.
 *
 * Formula: e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T^2
 * (Meeus Eq. 25.4, NOAA Solar Calculation Details)
 */
double AgnihotraTimingEngine::computeEarthOrbitEccentricity(double julianCentury) {
    const double eccentricity = EARTH_ECCENTRICITY_BASE_J2000 
        - julianCentury * (EARTH_ECCENTRICITY_RATE_PER_CENTURY 
        + EARTH_ECCENTRICITY_QUADRATIC_COEFF * julianCentury);

    return eccentricity;
}

/**
 * @brief Computes the Sun's Equation of the Center (C) in degrees.
 *
 * Physical Meaning:
 *  - Because Earth's orbit is an ellipse (Kepler's Second Law), Earth travels faster near
 *    perihelion and slower near aphelion.
 *  - The Equation of the Center is the angular difference between the true Sun and mean Sun.
 *  - Expanded as a Fourier series in terms of Mean Anomaly (M):
 *      Harmonic 1: sin(M) term (~1.91° max)
 *      Harmonic 2: sin(2M) term (~0.02° max)
 *      Harmonic 3: sin(3M) term (~0.000289° max)
 *
 * (Meeus Ch. 25, p. 164, NOAA Solar Calculation Details)
 */
double AgnihotraTimingEngine::computeEquationOfCenter(double julianCentury) {
    const double meanAnomalyRadians = degreesToRadians(computeGeometricMeanAnomaly(julianCentury));

    // First Fourier harmonic term: sin(M)
    const double harmonic1Coeff = EQUATION_OF_CENTER_HARMONIC_1_BASE 
        - julianCentury * (EQUATION_OF_CENTER_HARMONIC_1_LINEAR 
        + EQUATION_OF_CENTER_HARMONIC_1_QUADRATIC * julianCentury);

    // Second Fourier harmonic term: sin(2M)
    const double harmonic2Coeff = EQUATION_OF_CENTER_HARMONIC_2_BASE 
        - julianCentury * EQUATION_OF_CENTER_HARMONIC_2_LINEAR;

    // Third Fourier harmonic term: sin(3M)
    const double harmonic3Coeff = EQUATION_OF_CENTER_HARMONIC_3_BASE;

    const double equationOfCenter = std::sin(meanAnomalyRadians) * harmonic1Coeff
        + std::sin(2.0 * meanAnomalyRadians) * harmonic2Coeff
        + std::sin(3.0 * meanAnomalyRadians) * harmonic3Coeff;

    return equationOfCenter;
}

/**
 * @brief Computes the Sun's Apparent Longitude (lambda) in degrees.
 *
 * Physical Meaning:
 *  - Apparent position of the Sun as seen from Earth, corrected for:
 *    1. Equation of the Center (orbital ellipticity)
 *    2. Solar Aberration (-0.00569°): accounts for light travel time (~8.3 min)
 *    3. Nutation (-0.00478° * sin(Omega)): periodic wobble caused by Moon's orbital plane
 *
 * (Meeus Eq. 25.8, NOAA Solar Calculation Details)
 */
double AgnihotraTimingEngine::computeApparentLongitude(double julianCentury) {
    const double meanLongitude = computeGeometricMeanLongitude(julianCentury);
    const double equationOfCenter = computeEquationOfCenter(julianCentury);
    const double trueLongitude = meanLongitude + equationOfCenter;

    // Longitude of the Moon's ascending node (18.6 year precession cycle)
    const double moonAscendingNode = MOON_ASCENDING_NODE_BASE_J2000 
        - MOON_ASCENDING_NODE_RATE_PER_CENTURY * julianCentury;

    const double apparentLongitude = trueLongitude 
        - SOLAR_ABERRATION_CORRECTION_DEGREES 
        - SOLAR_NUTATION_LONGITUDE_COEFF * std::sin(degreesToRadians(moonAscendingNode));

    return apparentLongitude;
}

/**
 * @brief Computes the Obliquity of the Ecliptic (Earth's axial tilt) in degrees.
 *
 * Physical Meaning:
 *  - Earth's tilt relative to its orbital plane (currently ~23.44°).
 *  - Uses the high-precision Lasker polynomial (23° 26' 21.448" at J2000.0).
 *  - Corrected for nutation: +0.00256° * cos(Omega).
 *
 * (Meeus Eq. 22.2, p. 147, NOAA exact constants)
 */
double AgnihotraTimingEngine::computeObliquityCorrection(double julianCentury) {
    // Lasker polynomial for seconds of arc: 21.448" - 46.8150"*T - 0.00059"*T^2 + 0.001813"*T^3
    const double arcseconds = MEAN_OBLIQUITY_ARCSECONDS_BASE 
        - julianCentury * (OBLIQUITY_SECULAR_RATE_ARCSEC 
        + julianCentury * (OBLIQUITY_QUADRATIC_ARCSEC - julianCentury * OBLIQUITY_CUBIC_ARCSEC));

    // Convert degrees, arcminutes, and arcseconds to decimal degrees
    const double meanObliquityDegrees = MEAN_OBLIQUITY_DEGREES 
        + (MEAN_OBLIQUITY_ARCMINUTES + arcseconds / 60.0) / 60.0;

    // Moon ascending node for nutation correction
    const double moonAscendingNode = MOON_ASCENDING_NODE_BASE_J2000 
        - MOON_ASCENDING_NODE_RATE_PER_CENTURY * julianCentury;

    // Corrected obliquity including periodic nutation in obliquity
    const double correctedObliquity = meanObliquityDegrees 
        + NUTATION_OBLIQUITY_COEFF * std::cos(degreesToRadians(moonAscendingNode));

    return correctedObliquity;
}

/**
 * @brief Computes the Sun's Declination (delta) in degrees.
 *
 * Physical Meaning:
 *  - The Sun's celestial latitude above or below the celestial equator.
 *  - At summer solstice: ~ +23.44° (Sun highest in northern sky).
 *  - At winter solstice: ~ -23.44° (Sun lowest in northern sky).
 *  - At equinoxes: 0.0°.
 *
 * Formula: sin(delta) = sin(epsilon) * sin(lambda)
 * (Meeus Eq. 25.6, p. 165)
 */
double AgnihotraTimingEngine::computeSunDeclination(double julianCentury) {
    const double correctedObliquityRadians = degreesToRadians(computeObliquityCorrection(julianCentury));
    const double apparentLongitudeRadians = degreesToRadians(computeApparentLongitude(julianCentury));

    const double sinDeclination = std::sin(correctedObliquityRadians) * std::sin(apparentLongitudeRadians);
    return radiansToDegrees(std::asin(sinDeclination));
}

/**
 * @brief Computes the Equation of Time (EoT) in minutes of time.
 *
 * Physical Meaning:
 *  - The difference between apparent solar time (sundial) and mean solar time (clock).
 *  - Caused by two independent physical phenomena:
 *    1. Earth's axial tilt (obliquity): seasons alter the Sun's progress along the equator.
 *    2. Earth's elliptical orbit (eccentricity): variable orbital speed.
 *  - Range is approximately -14.2 minutes in February to +16.4 minutes in November.
 *
 * (Meeus Eq. 28.1, p. 185, NOAA Solar Calculation Details)
 */
double AgnihotraTimingEngine::computeEquationOfTime(double julianCentury) {
    const double correctedObliquityRadians = degreesToRadians(computeObliquityCorrection(julianCentury));
    const double meanLongitudeRadians = degreesToRadians(computeGeometricMeanLongitude(julianCentury));
    const double eccentricity = computeEarthOrbitEccentricity(julianCentury);
    const double meanAnomalyRadians = degreesToRadians(computeGeometricMeanAnomaly(julianCentury));

    // y = tan^2(epsilon / 2)
    const double tanHalfObliquity = std::tan(correctedObliquityRadians / 2.0);
    const double y = tanHalfObliquity * tanHalfObliquity;

    const double sin2L = std::sin(2.0 * meanLongitudeRadians);
    const double sinM  = std::sin(meanAnomalyRadians);
    const double cos2L = std::cos(2.0 * meanLongitudeRadians);
    const double sin4L = std::sin(4.0 * meanLongitudeRadians);
    const double sin2M = std::sin(2.0 * meanAnomalyRadians);

    // Equation of time in radians
    const double equationOfTimeRadians = 
        y * sin2L 
        - 2.0 * eccentricity * sinM 
        + 4.0 * eccentricity * y * sinM * cos2L 
        - 0.5 * y * y * sin4L 
        - 1.25 * eccentricity * eccentricity * sin2M;

    // Convert radians to minutes of time:
    // (radians * 180 / PI) * 4.0 minutes per degree = minutes
    return radiansToDegrees(equationOfTimeRadians) * MINUTES_PER_DEGREE_ROTATION;
}

/**
 * @brief Computes Solar Noon in UTC minutes from midnight.
 *
 * NOAA geographic convention: negLon = -longitude.
 * Uses a two-pass iterative refinement for sub-second precision.
 */
double AgnihotraTimingEngine::computeSolarNoonMinutesUTC(double julianDay, double longitude) {
    const double negativeLongitude = -longitude;
    
    // First pass estimation
    double centuryTime = computeJulianCenturies(julianDay + negativeLongitude / 360.0);
    double equationOfTimeMinutes = computeEquationOfTime(centuryTime);
    const double approximateNoonMinutes = negativeLongitude * MINUTES_PER_DEGREE_ROTATION - equationOfTimeMinutes;

    // Second pass refined calculation
    centuryTime = computeJulianCenturies(julianDay + approximateNoonMinutes / MINUTES_PER_DAY);
    equationOfTimeMinutes = computeEquationOfTime(centuryTime);

    return SOLAR_NOON_NOMINAL_MINUTES + negativeLongitude * MINUTES_PER_DEGREE_ROTATION - equationOfTimeMinutes;
}

/**
 * @brief Computes Agnihotra Sunrise or Sunset in UTC minutes from midnight.
 *
 * Agnihotra Geometric Criterion:
 *  - The center of the solar disc is on the true mathematical horizon.
 *  - Zenith = 90.0° (Elevation = 0.0°).
 *  - 0° depression, no atmospheric refraction applied.
 *  - Hour Angle Equation: cos(H0) = -tan(latitude) * tan(solarDeclination)
 */
double AgnihotraTimingEngine::computeSunEventMinutesUTC(
    int year,
    int month,
    int day,
    double latitude,
    double longitude,
    bool isSunrise
) {
    const double julianDay = computeJulianDay(year, month, day);
    const double negativeLongitude = -longitude;

    const double solarNoonMinutes = computeSolarNoonMinutesUTC(julianDay, longitude);
    double centuryTime = computeJulianCenturies(julianDay + solarNoonMinutes / MINUTES_PER_DAY);

    // --- Iteration 1: Approximate Hour Angle & Event Time ---
    double equationOfTimeMinutes = computeEquationOfTime(centuryTime);
    double sunDeclinationDegrees = computeSunDeclination(centuryTime);

    // Agnihotra Horizon: Zenith = 90.0° -> cos(H0) = -tan(phi) * tan(delta)
    double cosHourAngle = -std::tan(degreesToRadians(latitude)) * std::tan(degreesToRadians(sunDeclinationDegrees));
    if (cosHourAngle < -1.0 || cosHourAngle > 1.0) {
        return -1.0; // Polar day or night: Sun does not cross horizon
    }

    double hourAngleDegrees = radiansToDegrees(std::acos(cosHourAngle));
    if (!isSunrise) {
        hourAngleDegrees = -hourAngleDegrees;
    }

    double utcMinutes = SOLAR_NOON_NOMINAL_MINUTES 
        + MINUTES_PER_DEGREE_ROTATION * (negativeLongitude - hourAngleDegrees) 
        - equationOfTimeMinutes;

    // --- Iteration 2: Refined Pass using Event Century Time ---
    centuryTime = computeJulianCenturies(julianDay + utcMinutes / MINUTES_PER_DAY);
    equationOfTimeMinutes = computeEquationOfTime(centuryTime);
    sunDeclinationDegrees = computeSunDeclination(centuryTime);

    cosHourAngle = -std::tan(degreesToRadians(latitude)) * std::tan(degreesToRadians(sunDeclinationDegrees));
    if (cosHourAngle < -1.0 || cosHourAngle > 1.0) {
        return -1.0;
    }

    hourAngleDegrees = radiansToDegrees(std::acos(cosHourAngle));
    if (!isSunrise) {
        hourAngleDegrees = -hourAngleDegrees;
    }

    utcMinutes = SOLAR_NOON_NOMINAL_MINUTES 
        + MINUTES_PER_DEGREE_ROTATION * (negativeLongitude - hourAngleDegrees) 
        - equationOfTimeMinutes;

    return utcMinutes;
}

// -----------------------------------------------------------------------------
// Formatting & Public Interface
// -----------------------------------------------------------------------------

std::string AgnihotraTimingEngine::formatMinutesToHMS(double utcMinutes, double timezoneOffsetHours) {
    if (utcMinutes < 0.0) {
        return "--:--:--";
    }

    const double localMinutes = utcMinutes + timezoneOffsetHours * 60.0;
    long long totalSeconds = static_cast<long long>(std::round(localMinutes * 60.0));

    // Normalize to [0, SECONDS_PER_DAY)
    totalSeconds = ((totalSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;

    const int hours = static_cast<int>(totalSeconds / 3600);
    const int minutes = static_cast<int>((totalSeconds % 3600) / 60);
    const int seconds = static_cast<int>(totalSeconds % 60);

    std::ostringstream stream;
    stream << std::setfill('0') << std::setw(2) << hours << ":"
           << std::setfill('0') << std::setw(2) << minutes << ":"
           << std::setfill('0') << std::setw(2) << seconds;

    return stream.str();
}

std::string AgnihotraTimingEngine::formatDateString(int year, int month, int day) {
    std::ostringstream stream;
    stream << std::setfill('0') << std::setw(2) << day << "."
           << std::setfill('0') << std::setw(2) << month << "."
           << year;
    return stream.str();
}

bool AgnihotraTimingEngine::isLeapYear(int year) {
    return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
}

int AgnihotraTimingEngine::getDaysInMonth(int year, int month) {
    static const int daysTable[] = { 0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
    if (month == 2 && isLeapYear(year)) {
        return 29;
    }
    if (month >= 1 && month <= 12) {
        return daysTable[month];
    }
    return 30;
}

DailyTimingResult AgnihotraTimingEngine::calculateDay(
    int year,
    int month,
    int day,
    double latitude,
    double longitude,
    double timezoneOffsetHours
) {
    DailyTimingResult result;
    result.date = formatDateString(year, month, day);

    const double sunriseMinutesUTC = computeSunEventMinutesUTC(year, month, day, latitude, longitude, true);
    const double sunsetMinutesUTC = computeSunEventMinutesUTC(year, month, day, latitude, longitude, false);

    if (sunriseMinutesUTC < 0.0 || sunsetMinutesUTC < 0.0) {
        result.sunrise = "--:--:--";
        result.sunset = "--:--:--";
        result.isValid = false;
        return result;
    }

    result.sunrise = formatMinutesToHMS(sunriseMinutesUTC, timezoneOffsetHours);
    result.sunset = formatMinutesToHMS(sunsetMinutesUTC, timezoneOffsetHours);
    result.isValid = true;
    return result;
}

std::vector<DailyTimingResult> AgnihotraTimingEngine::calculateFullYear(
    int year,
    double latitude,
    double longitude,
    double timezoneOffsetHours
) {
    std::vector<DailyTimingResult> yearResults;
    yearResults.reserve(isLeapYear(year) ? 366 : 365);

    for (int month = 1; month <= 12; ++month) {
        const int daysInMonth = getDaysInMonth(year, month);
        for (int day = 1; day <= daysInMonth; ++day) {
            yearResults.push_back(calculateDay(year, month, day, latitude, longitude, timezoneOffsetHours));
        }
    }

    return yearResults;
}

std::vector<DailyTimingResult> AgnihotraTimingEngine::calculateRange(
    int startYear,
    int startMonth,
    int startDay,
    int totalDays,
    double latitude,
    double longitude,
    double timezoneOffsetHours
) {
    std::vector<DailyTimingResult> rangeResults;
    rangeResults.reserve(totalDays);

    int currentYear = startYear;
    int currentMonth = startMonth;
    int currentDay = startDay;

    for (int i = 0; i < totalDays; ++i) {
        rangeResults.push_back(calculateDay(currentYear, currentMonth, currentDay, latitude, longitude, timezoneOffsetHours));

        currentDay++;
        if (currentDay > getDaysInMonth(currentYear, currentMonth)) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }
    }

    return rangeResults;
}
