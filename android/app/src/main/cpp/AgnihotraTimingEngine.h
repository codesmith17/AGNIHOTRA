#ifndef AGNIHOTRA_TIMING_ENGINE_H
#define AGNIHOTRA_TIMING_ENGINE_H

#include <string>
#include <vector>

struct DailyTimingResult {
    std::string date;     // "DD.MM.YYYY"
    std::string sunrise;  // "HH:MM:SS"
    std::string sunset;   // "HH:MM:SS"
    bool isValid;
};

class AgnihotraTimingEngine {
public:
    AgnihotraTimingEngine() = default;
    ~AgnihotraTimingEngine() = default;

    static DailyTimingResult calculateDay(
        int year,
        int month,
        int day,
        double latitude,
        double longitude,
        double timezoneOffsetHours
    );

    static std::vector<DailyTimingResult> calculateFullYear(
        int year,
        double latitude,
        double longitude,
        double timezoneOffsetHours
    );

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

    static double computeSunEventMinutesUTC(
        int year,
        int month,
        int day,
        double latitude,
        double longitude,
        bool isSunrise
    );

    static std::string formatMinutesToHMS(double utcMinutes, double timezoneOffsetHours);
    static std::string formatDateString(int year, int month, int day);
    static bool isLeapYear(int year);
    static int getDaysInMonth(int year, int month);
};

#endif // AGNIHOTRA_TIMING_ENGINE_H
