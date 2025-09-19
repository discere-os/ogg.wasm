/*
 * WASM SIDE_MODULE wrapper for ogg.wasm
 * Copyright (c) 2002, Xiph.org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause
 */

#include <emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <ogg/ogg.h>

// SIDE_MODULE identification
EMSCRIPTEN_KEEPALIVE
const char* ogg_wasm_side_version() {
    return "1.3.5-side";
}

// Essential memory management for SIDE_MODULE
EMSCRIPTEN_KEEPALIVE
void* ogg_side_malloc(size_t size) {
    return malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void ogg_side_free(void* ptr) {
    if (ptr) {
        free(ptr);
    }
}

// Core OGG functionality specifically optimized for SIDE_MODULE
// These functions are designed to minimize memory overhead and maximize performance

EMSCRIPTEN_KEEPALIVE
int ogg_side_sync_init(ogg_sync_state* oy) {
    return ogg_sync_init(oy);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_sync_clear(ogg_sync_state* oy) {
    return ogg_sync_clear(oy);
}

EMSCRIPTEN_KEEPALIVE
char* ogg_side_sync_buffer(ogg_sync_state* oy, long size) {
    return ogg_sync_buffer(oy, size);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_sync_wrote(ogg_sync_state* oy, long bytes) {
    return ogg_sync_wrote(oy, bytes);
}

EMSCRIPTEN_KEEPALIVE
long ogg_side_sync_pageseek(ogg_sync_state* oy, ogg_page* og) {
    return ogg_sync_pageseek(oy, og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_sync_pageout(ogg_sync_state* oy, ogg_page* og) {
    return ogg_sync_pageout(oy, og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_stream_init(ogg_stream_state* os, int serialno) {
    return ogg_stream_init(os, serialno);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_stream_clear(ogg_stream_state* os) {
    return ogg_stream_clear(os);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_stream_pagein(ogg_stream_state* os, ogg_page* og) {
    return ogg_stream_pagein(os, og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_stream_packetout(ogg_stream_state* os, ogg_packet* op) {
    return ogg_stream_packetout(os, op);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_stream_packetpeek(ogg_stream_state* os, ogg_packet* op) {
    return ogg_stream_packetpeek(os, op);
}

// Page inspection functions optimized for SIDE_MODULE
EMSCRIPTEN_KEEPALIVE
int ogg_side_page_version(ogg_page* og) {
    return ogg_page_version(og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_page_continued(ogg_page* og) {
    return ogg_page_continued(og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_page_bos(ogg_page* og) {
    return ogg_page_bos(og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_page_eos(ogg_page* og) {
    return ogg_page_eos(og);
}

EMSCRIPTEN_KEEPALIVE
ogg_int64_t ogg_side_page_granulepos(ogg_page* og) {
    return ogg_page_granulepos(og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_page_serialno(ogg_page* og) {
    return ogg_page_serialno(og);
}

EMSCRIPTEN_KEEPALIVE
long ogg_side_page_pageno(ogg_page* og) {
    return ogg_page_pageno(og);
}

EMSCRIPTEN_KEEPALIVE
int ogg_side_page_packets(ogg_page* og) {
    return ogg_page_packets(og);
}

// Minimal initialization for SIDE_MODULE
EMSCRIPTEN_KEEPALIVE
void ogg_side_module_init() {
    // Minimal initialization - SIDE_MODULE should be lightweight
}