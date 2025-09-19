#!/bin/bash
# build-dual.sh - Dual build system for ogg.wasm
#
# Copyright (c) 2002, Xiph.org Foundation
# Copyright (c) 2025 Superstruct Ltd, New Zealand
# Licensed under BSD-3-Clause

set -euo pipefail

VARIANT="${1:-all}"
BUILD_DIR="${BUILD_DIR:-./build-dual}"
INSTALL_PREFIX="${INSTALL_PREFIX:-./install}"
OGG_VERSION="1.3.5"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking build prerequisites..."

    if ! command -v emcc &> /dev/null; then
        log_error "Emscripten not found. Please install and activate EMSDK."
        exit 1
    fi

    if ! command -v cmake &> /dev/null; then
        log_error "CMake not found. Please install cmake."
        exit 1
    fi

    local emcc_version=$(emcc --version | head -n1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -n1)
    log_info "Using Emscripten version: $emcc_version"

    log_success "Prerequisites check completed"
}

# Generate config_types.h for Emscripten target
generate_config_types() {
    local output_dir="$1"
    mkdir -p "$output_dir/include/ogg"

    cat > "$output_dir/include/ogg/config_types.h" << 'EOF'
/* config_types.h for Emscripten/WebAssembly target */
#ifndef _OGG_CONFIG_TYPES_H
#define _OGG_CONFIG_TYPES_H

#include <stdint.h>

typedef int16_t ogg_int16_t;
typedef uint16_t ogg_uint16_t;
typedef int32_t ogg_int32_t;
typedef uint32_t ogg_uint32_t;
typedef int64_t ogg_int64_t;
typedef uint64_t ogg_uint64_t;

#endif
EOF
}

# Build SIDE_MODULE (production)
build_side_module() {
    log_info "Building ogg-side.wasm for production..."

    local build_dir="${BUILD_DIR}-side"
    rm -rf "$build_dir"
    mkdir -p "$build_dir"
    cd "$build_dir"

    # Generate config files
    generate_config_types "$(pwd)"

    # Core OGG sources
    local SOURCES="../src/bitwise.c ../src/framing.c"
    local SIMD_SOURCES="../wasm/ogg_simd.c"
    local WASM_MODULE="../wasm/ogg_wasm_side.c"

    # Compile SIDE_MODULE with optimizations
    emcc $SOURCES $SIMD_SOURCES $WASM_MODULE \
        -I../include \
        -I./include \
        -O3 -flto -msimd128 \
        -sSIDE_MODULE=2 \
        -sSTANDALONE_WASM=1 \
        -sEXPORTED_FUNCTIONS='["_ogg_sync_init","_ogg_sync_clear","_ogg_sync_destroy","_ogg_sync_reset","_ogg_sync_buffer","_ogg_sync_wrote","_ogg_sync_pageseek","_ogg_sync_pageout","_ogg_stream_pagein","_ogg_stream_init","_ogg_stream_clear","_ogg_stream_reset","_ogg_stream_reset_serialno","_ogg_stream_destroy","_ogg_stream_check","_ogg_stream_eos","_ogg_stream_packetout","_ogg_stream_packetpeek","_ogg_page_version","_ogg_page_continued","_ogg_page_bos","_ogg_page_eos","_ogg_page_granulepos","_ogg_page_serialno","_ogg_page_pageno","_ogg_page_packets","_ogg_page_checksum_set","_ogg_crc32_simd","_ogg_simd_available","_ogg_simd_benchmark"]' \
        -sFILESYSTEM=0 \
        -sMALLOC=dlmalloc \
        -sDISABLE_EXCEPTION_CATCHING=1 \
        -o ogg-side.wasm

    # Install artifacts
    mkdir -p "${INSTALL_PREFIX}/wasm"
    cp ogg-side.wasm "${INSTALL_PREFIX}/wasm/"

    # Generate size report
    local size=$(stat -c%s ogg-side.wasm)
    local compressed_size=$(gzip -c ogg-side.wasm | wc -c)
    log_success "SIDE_MODULE: ${INSTALL_PREFIX}/wasm/ogg-side.wasm (${size} bytes, ${compressed_size} compressed)"

    cd - > /dev/null
}

# Build MAIN_MODULE (testing/NPM)
build_main_module() {
    log_info "Building ogg-main.js for testing..."

    local build_dir="${BUILD_DIR}-main"
    rm -rf "$build_dir"
    mkdir -p "$build_dir"
    cd "$build_dir"

    # Generate config files
    generate_config_types "$(pwd)"

    # Core OGG sources
    local SOURCES="../src/bitwise.c ../src/framing.c"
    local SIMD_SOURCES="../wasm/ogg_simd.c"
    local WASM_MODULE="../wasm/ogg_wasm_main.c"

    # Compile MAIN_MODULE for testing
    emcc $SOURCES $SIMD_SOURCES $WASM_MODULE \
        -I../include \
        -I./include \
        -O3 -flto -msimd128 \
        -sMODULARIZE=1 \
        -sEXPORT_ES6=1 \
        -sEXPORT_NAME="OggModule" \
        -sEXPORTED_FUNCTIONS='["_ogg_sync_init","_ogg_sync_clear","_ogg_sync_destroy","_ogg_sync_reset","_ogg_sync_buffer","_ogg_sync_wrote","_ogg_sync_pageseek","_ogg_sync_pageout","_ogg_stream_pagein","_ogg_stream_init","_ogg_stream_clear","_ogg_stream_reset","_ogg_stream_reset_serialno","_ogg_stream_destroy","_ogg_stream_check","_ogg_stream_eos","_ogg_stream_packetout","_ogg_stream_packetpeek","_ogg_page_version","_ogg_page_continued","_ogg_page_bos","_ogg_page_eos","_ogg_page_granulepos","_ogg_page_serialno","_ogg_page_pageno","_ogg_page_packets","_ogg_page_checksum_set","_ogg_crc32_simd","_ogg_simd_available","_ogg_simd_benchmark","_malloc","_free"]' \
        -sEXPORTED_RUNTIME_METHODS='["cwrap","ccall","UTF8ToString","HEAPU8","HEAP32"]' \
        -sALLOW_MEMORY_GROWTH=1 \
        -sINITIAL_MEMORY=33554432 \
        -sMAXIMUM_MEMORY=134217728 \
        -sFILESYSTEM=0 \
        -sENVIRONMENT=web,webview,worker \
        -sNODEJS_CATCH_EXIT=0 \
        -sNODEJS_CATCH_REJECTION=0 \
        -sMALLOC=dlmalloc \
        -o ogg-main.js

    # Install artifacts
    mkdir -p "${INSTALL_PREFIX}/wasm"
    cp ogg-main.js "${INSTALL_PREFIX}/wasm/"
    cp ogg-main.wasm "${INSTALL_PREFIX}/wasm/"

    # Generate size report
    local js_size=$(stat -c%s ogg-main.js)
    local wasm_size=$(stat -c%s ogg-main.wasm)
    local total_size=$((js_size + wasm_size))
    log_success "MAIN_MODULE: ${INSTALL_PREFIX}/wasm/ogg-main.js (${total_size} bytes total)"

    cd - > /dev/null
}

# Clean build artifacts
clean_build() {
    log_info "Cleaning build artifacts..."
    rm -rf "${BUILD_DIR}"* "${INSTALL_PREFIX}" dist/ npm/
    log_success "Clean completed"
}

# Build summary
build_summary() {
    if [ -d "${INSTALL_PREFIX}/wasm" ]; then
        log_info "Build Summary:"
        echo "├── WASM artifacts in ${INSTALL_PREFIX}/wasm/"
        for file in "${INSTALL_PREFIX}"/wasm/*; do
            if [ -f "$file" ]; then
                local size=$(stat -c%s "$file")
                local name=$(basename "$file")
                echo "│   ├── $name ($(numfmt --to=iec $size))"
            fi
        done
        echo "└── Ready for testing with: deno task demo"
    fi
}

# Main build logic
case "$VARIANT" in
    side)
        check_prerequisites
        build_side_module
        build_summary
        ;;
    main)
        check_prerequisites
        build_main_module
        build_summary
        ;;
    all)
        check_prerequisites
        build_side_module
        build_main_module
        build_summary
        ;;
    clean)
        clean_build
        ;;
    *)
        echo "Usage: $0 [side|main|all|clean]"
        echo ""
        echo "  side  - Build SIDE_MODULE for production (smaller, faster loading)"
        echo "  main  - Build MAIN_MODULE for testing and NPM distribution"
        echo "  all   - Build both variants"
        echo "  clean - Remove all build artifacts"
        exit 1
        ;;
esac