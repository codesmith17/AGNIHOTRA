cmake_minimum_required(VERSION 3.22.1)

project("agnihotra_core")

# Define native shared library
add_library(
    agnihotra_core
    SHARED
    AgnihotraTimingEngine.cpp
    agnihotra_jni.cpp
)

find_library(
    log-lib
    log
)

# Hardened compilation flags:
# -O3: Aggressive compiler optimization and instruction vectorization
# -fvisibility=hidden: Strips all internal symbols from the export symbol table
# -fvisibility-inlines-hidden: Strips internal inlined functions
# -ffunction-sections / -fdata-sections: Modular dead-code elimination
target_compile_options(
    agnihotra_core
    PRIVATE
    -O3
    -std=c++17
    -fvisibility=hidden
    -fvisibility-inlines-hidden
    -ffunction-sections
    -fdata-sections
)

# Linker flags:
# -Wl,--gc-sections: Removes unused functions and unreachable code
# -Wl,-s: Fully strips all symbols and debug metadata
target_link_options(
    agnihotra_core
    PRIVATE
    -Wl,--gc-sections
    -Wl,-s
)

target_link_libraries(
    agnihotra_core
    ${log-lib}
)
