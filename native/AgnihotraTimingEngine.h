#ifndef AGNIHOTRA_TIMING_ENGINE_H
#define AGNIHOTRA_TIMING_ENGINE_H

#include <string>
#include <vector>
#include <unordered_map>

/**
 * @brief Represents the exact sunrise and sunset timings for a specific day.
 */
struct DailyTimingResult {
    std::string date;     // Format: "DD.MM.YYYY"
    std::string sunrise;  // Format: "HH:MM:SS"
    std::string sunset;   // Format: "HH:MM:SS"
    bool isValid;
};

/**
 * @brief High-precision Agnihotra Timing Engine.
 *
 * Implements the Jean Meeus "Astronomical Algorithms" (2nd ed.) Solar Model
 * strictly adhering to Vedic Agnihotra specifications:
 *  - Zenith = 90.0° (center of the solar disc is on the mathematical horizon).
 *  - 0° depression, no atmospheric refraction correction.
 *  - Rounding to the closest whole second.
 */
class AgnihotraTimingEngine {
public:
    AgnihotraTimingEngine() = default;
    ~AgnihotraTimingEngine() = default;

    /**
     * @brief Computes Agnihotra sunrise and sunset for a single Gregorian calendar date.
     *
     * @param year Gregorian calendar year (e.g., 2026)
     * @param month 1-12 (January = 1)
     * @param day 1-31
     * @param latitude Geographical latitude in decimal degrees (-90.0 to +90.0, North is positive)
     * @param longitude Geographical longitude in decimal degrees (-180.0 to +180.0, East is positive)
     * @param timezoneOffsetHours Timezone offset from UTC in decimal hours (e.g., +5.5 for IST)
     * @return DailyTimingResult containing formatted strings and validity flag
     */
    static DailyTimingResult calculateDay(
        int year,
        int month,
        int day,
        double latitude,
        double longitude,
        double timezoneOffsetHours
    );

    /**
     * @brief Computes a full 365/366 day Agnihotra calendar for an entire year.
     *
     * @param year Calendar year
     * @param latitude Geographical latitude
     * @param longitude Geographical longitude
     * @param timezoneOffsetHours Timezone offset in hours
     * @return std::vector<DailyTimingResult> Vector of results for each day of the year
     */
    static std::vector<DailyTimingResult> calculateFullYear(
        int year,
        double latitude,
        double longitude,
        double timezoneOffsetHours
    );

    /**
     * @brief Computes Agnihotra timings for a range of consecutive days.
     */
    static std::vector<DailyTimingResult> calculateRange(
        int startYear,
        int startMonth,
        int startDay,
        int totalDays,
        double latitude,
        double longitude,
        double timezoneOffsetHours
    );

private:
    // Core Astronomical Calculations
    static double computeJulianDay(int year, int month, int day);
    static double computeJulianCenturies(double julianDay);
    static double computeGeometricMeanLongitude(double julianCentury);
    static double computeGeometricMeanAnomaly(double julianCentury);
    static double computeEarthOrbitEccentricity(double julianCentury);
    static double computeEquationOfCenter(double julianCentury);
    static double computeApparentLongitude(double julianCentury);
    static double computeObliquityCorrection(double julianCentury);
    static double computeSunDeclination(double julianCentury);
    static double computeEquationOfTime(double julianCentury);
    static double computeSolarNoonMinutesUTC(double julianDay, double longitude);

    /**
     * @brief Calculates UTC sunrise or sunset in minutes from midnight.
     * @return UTC minutes from midnight, or -1.0 if polar day/night (sun does not rise/set)
     */
    static double computeSunEventMinutesUTC(
        int year,
        int month,
        int day,
        double latitude,
        double longitude,
        bool isSunrise
    );

    // Helpers
    static std::string formatMinutesToHMS(double utcMinutes, double timezoneOffsetHours);
    static std::string formatDateString(int year, int month, int day);
    static bool isLeapYear(int year);
    static int getDaysInMonth(int year, int month);
};

#endif // AGNIHOTRA_TIMING_ENGINE_H
