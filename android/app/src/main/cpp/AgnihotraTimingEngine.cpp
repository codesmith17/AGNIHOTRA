#include "AgnihotraTimingEngine.h"
#include "AstronomicalConstants.h"
#include <cmath>
#include <iomanip>
#include <sstream>

using namespace AstronomicalConstants;

namespace {
    inline double degreesToRadians(double degrees) __attribute__((always_inline));
    inline double degreesToRadians(double degrees) {
        return degrees * DEG_TO_RAD;
    }

    inline double radiansToDegrees(double radians) __attribute__((always_inline));
    inline double radiansToDegrees(double radians) {
        return radians * RAD_TO_DEG;
    }

    inline double normalizeDegrees(double degrees) __attribute__((always_inline));
    inline double normalizeDegrees(double degrees) {
        double result = std::fmod(degrees, 360.0);
        if (result < 0.0) {
            result += 360.0;
        }
        return result;
    }
}

double AgnihotraTimingEngine::computeJulianDay(int year, int month, int day) {
    int adjustedYear = year;
    int adjustedMonth = month;

    if (adjustedMonth <= 2) {
        adjustedYear -= 1;
        adjustedMonth += 12;
    }

    const int centuryTerm = adjustedYear / 100;
    const int gregorianLeapCorrection = 2 - centuryTerm + (centuryTerm / 4);

    const double julianDay = std::floor(365.25 * (adjustedYear + 4716))
                           + std::floor(30.6001 * (adjustedMonth + 1))
                           + day
                           + gregorianLeapCorrection
                           - 1524.5;
    return julianDay;
}

double AgnihotraTimingEngine::computeJulianCenturies(double julianDay) {
    return (julianDay - JULIAN_DAY_J2000_EPOCH) / DAYS_PER_JULIAN_CENTURY;
}

double AgnihotraTimingEngine::computeGeometricMeanLongitude(double julianCentury) {
    const double meanLongitude = SUN_MEAN_LONGITUDE_BASE_J2000 
        + julianCentury * (SUN_MEAN_LONGITUDE_RATE_PER_CENTURY 
        + SUN_MEAN_LONGITUDE_QUADRATIC_COEFF * julianCentury);

    return normalizeDegrees(meanLongitude);
}

double AgnihotraTimingEngine::computeGeometricMeanAnomaly(double julianCentury) {
    const double meanAnomaly = SUN_MEAN_ANOMALY_BASE_J2000 
        + julianCentury * (SUN_MEAN_ANOMALY_RATE_PER_CENTURY 
        - SUN_MEAN_ANOMALY_QUADRATIC_COEFF * julianCentury);

    return meanAnomaly;
}

double AgnihotraTimingEngine::computeEarthOrbitEccentricity(double julianCentury) {
    const double eccentricity = EARTH_ECCENTRICITY_BASE_J2000 
        - julianCentury * (EARTH_ECCENTRICITY_RATE_PER_CENTURY 
        + EARTH_ECCENTRICITY_QUADRATIC_COEFF * julianCentury);

    return eccentricity;
}

double AgnihotraTimingEngine::computeEquationOfCenter(double julianCentury) {
    const double meanAnomalyRadians = degreesToRadians(computeGeometricMeanAnomaly(julianCentury));

    const double harmonic1Coeff = EQUATION_OF_CENTER_HARMONIC_1_BASE 
        - julianCentury * (EQUATION_OF_CENTER_HARMONIC_1_LINEAR 
        + EQUATION_OF_CENTER_HARMONIC_1_QUADRATIC * julianCentury);

    const double harmonic2Coeff = EQUATION_OF_CENTER_HARMONIC_2_BASE 
        - julianCentury * EQUATION_OF_CENTER_HARMONIC_2_LINEAR;

    const double harmonic3Coeff = EQUATION_OF_CENTER_HARMONIC_3_BASE;

    const double equationOfCenter = std::sin(meanAnomalyRadians) * harmonic1Coeff
        + std::sin(2.0 * meanAnomalyRadians) * harmonic2Coeff
        + std::sin(3.0 * meanAnomalyRadians) * harmonic3Coeff;

    return equationOfCenter;
}

double AgnihotraTimingEngine::computeApparentLongitude(double julianCentury) {
    const double meanLongitude = computeGeometricMeanLongitude(julianCentury);
    const double equationOfCenter = computeEquationOfCenter(julianCentury);
    const double trueLongitude = meanLongitude + equationOfCenter;

    const double moonAscendingNode = MOON_ASCENDING_NODE_BASE_J2000 
        - MOON_ASCENDING_NODE_RATE_PER_CENTURY * julianCentury;

    const double apparentLongitude = trueLongitude 
        - SOLAR_ABERRATION_CORRECTION_DEGREES 
        - SOLAR_NUTATION_LONGITUDE_COEFF * std::sin(degreesToRadians(moonAscendingNode));

    return apparentLongitude;
}

double AgnihotraTimingEngine::computeObliquityCorrection(double julianCentury) {
    const double arcseconds = MEAN_OBLIQUITY_ARCSECONDS_BASE 
        - julianCentury * (OBLIQUITY_SECULAR_RATE_ARCSEC 
        + julianCentury * (OBLIQUITY_QUADRATIC_ARCSEC - julianCentury * OBLIQUITY_CUBIC_ARCSEC));

    const double meanObliquityDegrees = MEAN_OBLIQUITY_DEGREES 
        + (MEAN_OBLIQUITY_ARCMINUTES + arcseconds / 60.0) / 60.0;

    const double moonAscendingNode = MOON_ASCENDING_NODE_BASE_J2000 
        - MOON_ASCENDING_NODE_RATE_PER_CENTURY * julianCentury;

    const double correctedObliquity = meanObliquityDegrees 
        + NUTATION_OBLIQUITY_COEFF * std::cos(degreesToRadians(moonAscendingNode));

    return correctedObliquity;
}

double AgnihotraTimingEngine::computeSunDeclination(double julianCentury) {
    const double correctedObliquityRadians = degreesToRadians(computeObliquityCorrection(julianCentury));
    const double apparentLongitudeRadians = degreesToRadians(computeApparentLongitude(julianCentury));

    const double sinDeclination = std::sin(correctedObliquityRadians) * std::sin(apparentLongitudeRadians);
    return radiansToDegrees(std::asin(sinDeclination));
}

double AgnihotraTimingEngine::computeEquationOfTime(double julianCentury) {
    const double correctedObliquityRadians = degreesToRadians(computeObliquityCorrection(julianCentury));
    const double meanLongitudeRadians = degreesToRadians(computeGeometricMeanLongitude(julianCentury));
    const double eccentricity = computeEarthOrbitEccentricity(julianCentury);
    const double meanAnomalyRadians = degreesToRadians(computeGeometricMeanAnomaly(julianCentury));

    const double tanHalfObliquity = std::tan(correctedObliquityRadians / 2.0);
    const double y = tanHalfObliquity * tanHalfObliquity;

    const double sin2L = std::sin(2.0 * meanLongitudeRadians);
    const double sinM  = std::sin(meanAnomalyRadians);
    const double cos2L = std::cos(2.0 * meanLongitudeRadians);
    const double sin4L = std::sin(4.0 * meanLongitudeRadians);
    const double sin2M = std::sin(2.0 * meanAnomalyRadians);

    const double equationOfTimeRadians = 
        y * sin2L 
        - 2.0 * eccentricity * sinM 
        + 4.0 * eccentricity * y * sinM * cos2L 
        - 0.5 * y * y * sin4L 
        - 1.25 * eccentricity * eccentricity * sin2M;

    return radiansToDegrees(equationOfTimeRadians) * MINUTES_PER_DEGREE_ROTATION;
}

double AgnihotraTimingEngine::computeSolarNoonMinutesUTC(double julianDay, double longitude) {
    const double negativeLongitude = -longitude;
    
    double centuryTime = computeJulianCenturies(julianDay + negativeLongitude / 360.0);
    double equationOfTimeMinutes = computeEquationOfTime(centuryTime);
    const double approximateNoonMinutes = negativeLongitude * MINUTES_PER_DEGREE_ROTATION - equationOfTimeMinutes;

    centuryTime = computeJulianCenturies(julianDay + approximateNoonMinutes / MINUTES_PER_DAY);
    equationOfTimeMinutes = computeEquationOfTime(centuryTime);

    return SOLAR_NOON_NOMINAL_MINUTES + negativeLongitude * MINUTES_PER_DEGREE_ROTATION - equationOfTimeMinutes;
}

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

    // Iteration 1
    double equationOfTimeMinutes = computeEquationOfTime(centuryTime);
    double sunDeclinationDegrees = computeSunDeclination(centuryTime);

    double cosHourAngle = -std::tan(degreesToRadians(latitude)) * std::tan(degreesToRadians(sunDeclinationDegrees));
    if (cosHourAngle < -1.0 || cosHourAngle > 1.0) {
        return -1.0;
    }

    double hourAngleDegrees = radiansToDegrees(std::acos(cosHourAngle));
    if (!isSunrise) {
        hourAngleDegrees = -hourAngleDegrees;
    }

    double utcMinutes = SOLAR_NOON_NOMINAL_MINUTES 
        + MINUTES_PER_DEGREE_ROTATION * (negativeLongitude - hourAngleDegrees) 
        - equationOfTimeMinutes;

    // Iteration 2
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

std::string AgnihotraTimingEngine::formatMinutesToHMS(double utcMinutes, double timezoneOffsetHours) {
    if (utcMinutes < 0.0) {
        return "--:--:--";
    }

    const double localMinutes = utcMinutes + timezoneOffsetHours * 60.0;
    long long totalSeconds = static_cast<long long>(std::round(localMinutes * 60.0));

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
