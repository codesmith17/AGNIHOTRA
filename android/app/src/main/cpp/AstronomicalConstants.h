#ifndef ASTRONOMICAL_CONSTANTS_H
#define ASTRONOMICAL_CONSTANTS_H

/**
 * @file AstronomicalConstants.h
 * @brief Astronomical and Mathematical Constants for NOAA / Jean Meeus Solar Engine.
 *
 * References:
 *  - Jean Meeus, "Astronomical Algorithms" (2nd English Edition, Willmann-Bell, 1998)
 *  - NOAA Solar Calculator Details: https://gml.noaa.gov/grad/solcalc/calcdetails.html
 *  - P. Kenneth Seidelmann (ed.), "Explanatory Supplement to the Astronomical Almanac" (1992)
 */

namespace AstronomicalConstants {

    // =========================================================================
    // 1. TIME, CALENDAR & EPOCH CONSTANTS
    // =========================================================================

    /**
     * @brief Julian Day at standard astronomical epoch J2000.0.
     * Corresponds to 2000 January 1, 12:00:00 Terrestrial Time (TT) / UTC.
     * (Meeus Ch. 7, p. 59)
     */
    constexpr double JULIAN_DAY_J2000_EPOCH = 2451545.0;

    /**
     * @brief Days in one Julian century.
     * Defined as exactly 36,525 days of 86,400 SI seconds each (100 * 365.25).
     * (Meeus Eq. 25.1)
     */
    constexpr double DAYS_PER_JULIAN_CENTURY = 36525.0;

    /**
     * @brief Earth's rotational speed in minutes of time per degree of longitude.
     * 24 hours * 60 minutes = 1440 minutes / 360 degrees = 4.0 min/deg.
     */
    constexpr double MINUTES_PER_DEGREE_ROTATION = 4.0;

    /**
     * @brief Minutes from midnight to nominal solar noon (12 hours * 60 minutes).
     */
    constexpr double SOLAR_NOON_NOMINAL_MINUTES = 720.0;

    /**
     * @brief Total minutes in a 24-hour solar day.
     */
    constexpr double MINUTES_PER_DAY = 1440.0;

    /**
     * @brief Total seconds in a 24-hour solar day (24 * 3600).
     */
    constexpr int SECONDS_PER_DAY = 86400;

    // =========================================================================
    // 2. MATHEMATICAL CONVERSIONS & CONSTANTS
    // =========================================================================

    /**
     * @brief High-precision mathematical constant Pi (Math.PI / π).
     * Defined to 20 decimal places (3.14159265358979323846) exceeding standard 64-bit IEEE-754 precision.
     */
    constexpr double MATH_PI = 3.14159265358979323846;
    constexpr double PI = MATH_PI;

    /**
     * @brief Conversion factor from degrees to radians: (Math.PI / 180.0)
     */
    constexpr double DEG_TO_RAD = MATH_PI / 180.0;

    /**
     * @brief Conversion factor from radians to degrees: (180.0 / Math.PI)
     */
    constexpr double RAD_TO_DEG = 180.0 / MATH_PI;

    // =========================================================================
    // 3. SUN GEOMETRIC MEAN LONGITUDE (L0) CONSTANTS
    // Formula: L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T^2  (degrees)
    // (Meeus Eq. 25.2, p. 163)
    // =========================================================================

    /**
     * @brief Sun's geometric mean longitude at epoch J2000.0 (degrees).
     * Represents the mean position of the Sun along the ecliptic if Earth's orbit were circular.
     */
    constexpr double SUN_MEAN_LONGITUDE_BASE_J2000 = 280.46646;

    /**
     * @brief Advance of the Sun's mean longitude per Julian century (degrees/century).
     * Accounts for ~100 full orbits (360° * 100 = 36,000°) plus Earth's axial precession shift (+0.76983°).
     */
    constexpr double SUN_MEAN_LONGITUDE_RATE_PER_CENTURY = 36000.76983;

    /**
     * @brief Secular acceleration coefficient for the Sun's mean longitude (degrees/century^2).
     */
    constexpr double SUN_MEAN_LONGITUDE_QUADRATIC_COEFF = 0.0003032;

    // =========================================================================
    // 4. SUN GEOMETRIC MEAN ANOMALY (M) CONSTANTS
    // Formula: M = 357.52911 + 35999.05029 * T - 0.0001537 * T^2  (degrees)
    // (Meeus Eq. 25.3, p. 163)
    // =========================================================================

    /**
     * @brief Sun's geometric mean anomaly at epoch J2000.0 (degrees).
     * Represents Earth's angular distance from perihelion (closest point to Sun) on a circular orbit.
     */
    constexpr double SUN_MEAN_ANOMALY_BASE_J2000 = 357.52911;

    /**
     * @brief Rate of advance of the Sun's mean anomaly per Julian century (degrees/century).
     * 36,000° minus the forward precession of Earth's perihelion (~0.94971°/century).
     */
    constexpr double SUN_MEAN_ANOMALY_RATE_PER_CENTURY = 35999.05029;

    /**
     * @brief Secular quadratic coefficient for the Sun's mean anomaly (degrees/century^2).
     */
    constexpr double SUN_MEAN_ANOMALY_QUADRATIC_COEFF = 0.0001537;

    // =========================================================================
    // 5. EARTH ORBIT ECCENTRICITY (e) CONSTANTS
    // Formula: e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T^2  (dimensionless)
    // (Meeus Eq. 25.4, p. 163)
    // =========================================================================

    /**
     * @brief Eccentricity of Earth's elliptical orbit at epoch J2000.0.
     * Determines the departure of the elliptical orbit from a perfect circle (0.0 = circle).
     */
    constexpr double EARTH_ECCENTRICITY_BASE_J2000 = 0.016708634;

    /**
     * @brief Rate of linear decrease in Earth's orbital eccentricity per Julian century.
     * Caused by gravitational perturbations from Venus and Jupiter.
     */
    constexpr double EARTH_ECCENTRICITY_RATE_PER_CENTURY = 0.000042037;

    /**
     * @brief Secular quadratic coefficient for Earth's orbital eccentricity.
     */
    constexpr double EARTH_ECCENTRICITY_QUADRATIC_COEFF = 0.0000001267;

    // =========================================================================
    // 6. SUN EQUATION OF THE CENTER (C) COEFFICIENTS
    // Formula: C = sin(M) * (1.914602 - 0.004817*T - 0.000014*T^2)
    //            + sin(2M) * (0.019993 - 0.000101*T)
    //            + sin(3M) * 0.000289  (degrees)
    // (Meeus Ch. 25, p. 164)
    // =========================================================================

    /**
     * @brief Primary (1st harmonic: sin(M)) coefficient for Sun's Equation of the Center at J2000.0.
     */
    constexpr double EQUATION_OF_CENTER_HARMONIC_1_BASE = 1.914602;
    constexpr double EQUATION_OF_CENTER_HARMONIC_1_LINEAR = 0.004817;
    constexpr double EQUATION_OF_CENTER_HARMONIC_1_QUADRATIC = 0.000014;

    /**
     * @brief Secondary (2nd harmonic: sin(2M)) coefficient for Sun's Equation of the Center.
     */
    constexpr double EQUATION_OF_CENTER_HARMONIC_2_BASE = 0.019993;
    constexpr double EQUATION_OF_CENTER_HARMONIC_2_LINEAR = 0.000101;

    /**
     * @brief Tertiary (3rd harmonic: sin(3M)) coefficient for Sun's Equation of the Center.
     */
    constexpr double EQUATION_OF_CENTER_HARMONIC_3_BASE = 0.000289;

    // =========================================================================
    // 7. MOON ASCENDING NODE (Omega), ABERRATION & NUTATION CONSTANTS
    // Formula: Omega = 125.04 - 1934.136 * T  (degrees)
    // (Meeus Eq. 25.8, p. 164)
    // =========================================================================

    /**
     * @brief Longitude of the ascending node of the Moon's orbit at J2000.0 (degrees).
     */
    constexpr double MOON_ASCENDING_NODE_BASE_J2000 = 125.04;

    /**
     * @brief Rate of regression of the Moon's ascending node per century (degrees/century).
     */
    constexpr double MOON_ASCENDING_NODE_RATE_PER_CENTURY = 1934.136;

    /**
     * @brief Constant of annual solar aberration (degrees).
     */
    constexpr double SOLAR_ABERRATION_CORRECTION_DEGREES = 0.00569;

    /**
     * @brief Nutation in longitude amplitude coefficient (degrees).
     */
    constexpr double SOLAR_NUTATION_LONGITUDE_COEFF = 0.00478;

    // =========================================================================
    // 8. OBLIQUITY OF THE ECLIPTIC (epsilon) CONSTANTS
    // =========================================================================

    constexpr double MEAN_OBLIQUITY_DEGREES = 23.0;
    constexpr double MEAN_OBLIQUITY_ARCMINUTES = 26.0;

    /**
     * @brief Arcseconds component of mean obliquity at J2000.0 (Lasker / NOAA exact value).
     */
    constexpr double MEAN_OBLIQUITY_ARCSECONDS_BASE = 21.448;

    /**
     * @brief Rate of decrease in Earth's axial tilt in arcseconds per century (Lasker polynomial).
     */
    constexpr double OBLIQUITY_SECULAR_RATE_ARCSEC = 46.8150;

    /**
     * @brief Quadratic coefficient for axial tilt decrease in arcseconds per century^2.
     */
    constexpr double OBLIQUITY_QUADRATIC_ARCSEC = 0.00059;

    /**
     * @brief Cubic coefficient for axial tilt in arcseconds per century^3.
     */
    constexpr double OBLIQUITY_CUBIC_ARCSEC = 0.001813;

    /**
     * @brief Nutation in obliquity amplitude coefficient (degrees).
     */
    constexpr double NUTATION_OBLIQUITY_COEFF = 0.00256;

    // =========================================================================
    // 9. VEDIC AGNIHOTRA SOLAR GEOMETRY SPECIFICATIONS
    // =========================================================================

    /**
     * @brief Agnihotra solar zenith angle in decimal degrees.
     * Center of the solar disc is exactly on the true mathematical horizon (Zenith = 90.0°).
     */
    constexpr double AGNIHOTRA_ZENITH_DEGREES = 90.0;
}

#endif // ASTRONOMICAL_CONSTANTS_H
