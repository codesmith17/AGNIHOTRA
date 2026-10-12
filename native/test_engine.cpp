#include "AgnihotraTimingEngine.h"
#include <iostream>
#include <chrono>

int main() {
    std::cout << "====================================================\n";
    std::cout << " TESTING CLEAN C++ AGNIHOTRA TIMING ENGINE\n";
    std::cout << "====================================================\n";

    // Test Pune on 24.05.2026: lat=18.5204, lng=73.8567, tz=5.5
    DailyTimingResult pune = AgnihotraTimingEngine::calculateDay(2026, 5, 24, 18.5204, 73.8567, 5.5);
    std::cout << "Pune Date:    " << pune.date << "\n";
    std::cout << "Pune Sunrise: " << pune.sunrise << " (Expected: 06:02:15)\n";
    std::cout << "Pune Sunset:  " << pune.sunset << " (Expected: 19:00:44)\n";

    if (pune.sunrise == "06:02:15" && pune.sunset == "19:00:44") {
        std::cout << ">>> ACCURACY TEST: PASSED (Exact to the second!) <<<\n\n";
    } else {
        std::cerr << ">>> ACCURACY TEST: FAILED! <<<\n";
        return 1;
    }

    // Benchmark 365 days calculation
    auto startTime = std::chrono::high_resolution_clock::now();
    auto yearSchedule = AgnihotraTimingEngine::calculateFullYear(2026, 18.5204, 73.8567, 5.5);
    auto endTime = std::chrono::high_resolution_clock::now();
    auto durationMs = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();

    std::cout << "Calculated " << yearSchedule.size() << " days in " << durationMs << " microseconds (" 
              << (durationMs / 1000.0) << " ms)!\n";
    std::cout << "First day: " << yearSchedule.front().date << " -> Sunrise: " << yearSchedule.front().sunrise << "\n";
    std::cout << "Last day:  " << yearSchedule.back().date << " -> Sunset:  " << yearSchedule.back().sunset << "\n";
    std::cout << "\nClean C++ engine verified successfully!\n";

    return 0;
}
