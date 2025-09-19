/*
 * WASM MAIN_MODULE wrapper for ogg.wasm
 * Copyright (c) 2002, Xiph.org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause
 */

#include <emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <ogg/ogg.h>

// WASM module information
EMSCRIPTEN_KEEPALIVE
const char* ogg_wasm_version() {
    return "1.3.5-wasm";
}

EMSCRIPTEN_KEEPALIVE
const char* ogg_wasm_build_info() {
    return "MAIN_MODULE build for testing and NPM distribution";
}

// Memory management utilities for JavaScript integration
EMSCRIPTEN_KEEPALIVE
void* ogg_malloc(size_t size) {
    return malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void ogg_free(void* ptr) {
    if (ptr) {
        free(ptr);
    }
}

// Helper function to create and initialize ogg_sync_state
EMSCRIPTEN_KEEPALIVE
ogg_sync_state* ogg_sync_create() {
    ogg_sync_state* oy = malloc(sizeof(ogg_sync_state));
    if (oy) {
        ogg_sync_init(oy);
    }
    return oy;
}

EMSCRIPTEN_KEEPALIVE
void ogg_sync_destroy_state(ogg_sync_state* oy) {
    if (oy) {
        ogg_sync_clear(oy);
        free(oy);
    }
}

// Helper function to create and initialize ogg_stream_state
EMSCRIPTEN_KEEPALIVE
ogg_stream_state* ogg_stream_create(int serialno) {
    ogg_stream_state* os = malloc(sizeof(ogg_stream_state));
    if (os) {
        if (ogg_stream_init(os, serialno) != 0) {
            free(os);
            return NULL;
        }
    }
    return os;
}

EMSCRIPTEN_KEEPALIVE
void ogg_stream_destroy_state(ogg_stream_state* os) {
    if (os) {
        ogg_stream_clear(os);
        free(os);
    }
}

// Helper function to get page data and length
EMSCRIPTEN_KEEPALIVE
unsigned char* ogg_page_get_header(ogg_page* og) {
    return og ? og->header : NULL;
}

EMSCRIPTEN_KEEPALIVE
long ogg_page_get_header_len(ogg_page* og) {
    return og ? og->header_len : 0;
}

EMSCRIPTEN_KEEPALIVE
unsigned char* ogg_page_get_body(ogg_page* og) {
    return og ? og->body : NULL;
}

EMSCRIPTEN_KEEPALIVE
long ogg_page_get_body_len(ogg_page* og) {
    return og ? og->body_len : 0;
}

// Helper function to get packet data and length
EMSCRIPTEN_KEEPALIVE
unsigned char* ogg_packet_get_packet(ogg_packet* op) {
    return op ? op->packet : NULL;
}

EMSCRIPTEN_KEEPALIVE
long ogg_packet_get_bytes(ogg_packet* op) {
    return op ? op->bytes : 0;
}

EMSCRIPTEN_KEEPALIVE
long ogg_packet_get_b_o_s(ogg_packet* op) {
    return op ? op->b_o_s : 0;
}

EMSCRIPTEN_KEEPALIVE
long ogg_packet_get_e_o_s(ogg_packet* op) {
    return op ? op->e_o_s : 0;
}

EMSCRIPTEN_KEEPALIVE
ogg_int64_t ogg_packet_get_granulepos(ogg_packet* op) {
    return op ? op->granulepos : 0;
}

EMSCRIPTEN_KEEPALIVE
long ogg_packet_get_packetno(ogg_packet* op) {
    return op ? op->packetno : 0;
}

// Memory pool for page and packet structs to avoid frequent malloc/free
#define OGG_POOL_SIZE 64
static ogg_page page_pool[OGG_POOL_SIZE];
static ogg_packet packet_pool[OGG_POOL_SIZE];
static int page_pool_used[OGG_POOL_SIZE] = {0};
static int packet_pool_used[OGG_POOL_SIZE] = {0};

EMSCRIPTEN_KEEPALIVE
ogg_page* ogg_page_alloc() {
    for (int i = 0; i < OGG_POOL_SIZE; i++) {
        if (!page_pool_used[i]) {
            page_pool_used[i] = 1;
            memset(&page_pool[i], 0, sizeof(ogg_page));
            return &page_pool[i];
        }
    }
    // Fallback to malloc if pool is exhausted
    return malloc(sizeof(ogg_page));
}

EMSCRIPTEN_KEEPALIVE
void ogg_page_free(ogg_page* page) {
    if (!page) return;

    // Check if it's from our pool
    if (page >= page_pool && page < page_pool + OGG_POOL_SIZE) {
        int index = page - page_pool;
        page_pool_used[index] = 0;
        return;
    }

    // It's a malloc'd pointer
    free(page);
}

EMSCRIPTEN_KEEPALIVE
ogg_packet* ogg_packet_alloc() {
    for (int i = 0; i < OGG_POOL_SIZE; i++) {
        if (!packet_pool_used[i]) {
            packet_pool_used[i] = 1;
            memset(&packet_pool[i], 0, sizeof(ogg_packet));
            return &packet_pool[i];
        }
    }
    // Fallback to malloc if pool is exhausted
    return malloc(sizeof(ogg_packet));
}

EMSCRIPTEN_KEEPALIVE
void ogg_packet_free(ogg_packet* packet) {
    if (!packet) return;

    // Check if it's from our pool
    if (packet >= packet_pool && packet < packet_pool + OGG_POOL_SIZE) {
        int index = packet - packet_pool;
        packet_pool_used[index] = 0;
        return;
    }

    // It's a malloc'd pointer
    free(packet);
}

// Utility function to copy buffer data (useful for JavaScript integration)
EMSCRIPTEN_KEEPALIVE
void ogg_buffer_copy(void* dest, const void* src, size_t size) {
    memcpy(dest, src, size);
}

// Performance diagnostic functions
EMSCRIPTEN_KEEPALIVE
void ogg_pool_stats() {
    int pages_used = 0, packets_used = 0;

    for (int i = 0; i < OGG_POOL_SIZE; i++) {
        if (page_pool_used[i]) pages_used++;
        if (packet_pool_used[i]) packets_used++;
    }

    printf("OGG Pool Stats: %d/%d pages, %d/%d packets in use\n",
           pages_used, OGG_POOL_SIZE, packets_used, OGG_POOL_SIZE);
}

// Module initialization
EMSCRIPTEN_KEEPALIVE
void ogg_module_init() {
    // Initialize any global state if needed
    memset(page_pool_used, 0, sizeof(page_pool_used));
    memset(packet_pool_used, 0, sizeof(packet_pool_used));

    printf("OGG WASM Module initialized (MAIN_MODULE)\n");
}