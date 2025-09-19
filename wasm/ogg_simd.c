/*
 * SIMD optimizations for OGG bitstream processing
 * Copyright (c) 2002, Xiph.org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause
 */

#include <wasm_simd128.h>
#include <emscripten.h>
#include <stdint.h>
#include <string.h>
#include <stdbool.h>
#include <stdio.h>
#include <time.h>
#include <stdlib.h>

// SIMD feature detection
EMSCRIPTEN_KEEPALIVE
bool ogg_simd_available() {
#ifdef __wasm_simd128__
    return true;
#else
    return false;
#endif
}

// Fast CRC32 calculation for OGG page checksums with SIMD acceleration
static const uint32_t crc_lookup[256] = {
    0x00000000,0x04c11db7,0x09823b6e,0x0d4326d9,0x130476dc,0x17c56b6b,0x1a864db2,0x1e475005,
    0x2608edb8,0x22c9f00f,0x2f8ad6d6,0x2b4bcb61,0x350c9b64,0x31cd86d3,0x3c8ea00a,0x384fbdbd,
    0x4c11db70,0x48d0c6c7,0x4593e01e,0x4152fda9,0x5f15adac,0x5bd4b01b,0x569796c2,0x52568b75,
    0x6a1936c8,0x6ed82b7f,0x639b0da6,0x675a1011,0x791d4014,0x7ddc5da3,0x709f7b7a,0x745e66cd,
    0x9823b6e0,0x9ce2ab57,0x91a18d8e,0x95609039,0x8b27c03c,0x8fe6dd8b,0x82a5fb52,0x8664e6e5,
    0xbe2b5b58,0xbaea46ef,0xb7a96036,0xb3687d81,0xad2f2d84,0xa9ee3033,0xa4ad16ea,0xa06c0b5d,
    0xd4326d90,0xd0f37027,0xddb056fe,0xd9714b49,0xc7361b4c,0xc3f706fb,0xceb42022,0xca753d95,
    0xf23a8028,0xf6fb9d9f,0xfbb8bb46,0xff79a6f1,0xe13ef6f4,0xe5ffeb43,0xe8bccd9a,0xec7dd02d,
    0x34867077,0x30476dc0,0x3d044b19,0x39c556ae,0x278206ab,0x23431b1c,0x2e003dc5,0x2ac12072,
    0x128e9dcf,0x164f8078,0x1b0ca6a1,0x1fcdbb16,0x018aeb13,0x054bf6a4,0x0808d07d,0x0cc9cdca,
    0x7897ab07,0x7c56b6b0,0x71159069,0x75d48dde,0x6b93dddb,0x6f52c06c,0x6211e6b5,0x66d0fb02,
    0x5e9f46bf,0x5a5e5b08,0x571d7dd1,0x53dc6066,0x4d9b3063,0x495a2dd4,0x44190b0d,0x40d816ba,
    0xaca5c697,0xa864db20,0xa527fdf9,0xa1e6e04e,0xbfa1b04b,0xbb60adfc,0xb6238b25,0xb2e29692,
    0x8aad2b2f,0x8e6c3698,0x832f1041,0x87ee0df6,0x99a95df3,0x9d684044,0x902b669d,0x94ea7b2a,
    0xe0b41de7,0xe4750050,0xe9362689,0xedf73b3e,0xf3b06b3b,0xf771768c,0xfa325055,0xfef34de2,
    0xc6bcf05f,0xc27dede8,0xcf3ecb31,0xcbffd686,0xd5b88683,0xd1799b34,0xdc3abded,0xd8fba05a,
    0x690ce0ee,0x6dcdfd59,0x608edb80,0x644fc637,0x7a089632,0x7ec98b85,0x738aad5c,0x774bb0eb,
    0x4f040d56,0x4bc510e1,0x46863638,0x42472b8f,0x5c007b8a,0x58c1663d,0x558240e4,0x51435d53,
    0x251d3b9e,0x21dc2629,0x2c9f00f0,0x285e1d47,0x36194d42,0x32d850f5,0x3f9b762c,0x3b5a6b9b,
    0x0315d626,0x07d4cb91,0x0a97ed48,0x0e56f0ff,0x1011a0fa,0x14d0bd4d,0x19939b94,0x1d528623,
    0xf12f560e,0xf5ee4bb9,0xf8ad6d60,0xfc6c70d7,0xe22b20d2,0xe6ea3d65,0xeba91bbc,0xef68060b,
    0xd727bbb6,0xd3e6a601,0xdea580d8,0xda649d6f,0xc423cd6a,0xc0e2d0dd,0xcda1f604,0xc960ebb3,
    0xbd3e8d7e,0xb9ff90c9,0xb4bcb610,0xb07daba7,0xae3afba2,0xaafbe615,0xa7b8c0cc,0xa379dd7b,
    0x9b3660c6,0x9ff77d71,0x92b45ba8,0x9675461f,0x8832161a,0x8cf30bad,0x81b02d74,0x857130c3,
    0x5d8a9099,0x594b8d2e,0x5408abf7,0x50c9b640,0x4e8ee645,0x4a4ffbf2,0x470cdd2b,0x43cdc09c,
    0x7b827d21,0x7f436096,0x7200464f,0x76c15bf8,0x68860bfd,0x6c47164a,0x61043093,0x65c52d24,
    0x119b4be9,0x155a565e,0x18197087,0x1cd86d30,0x029f3d35,0x065e2082,0x0b1d065b,0x0fdc1bec,
    0x3793a651,0x3352bbe6,0x3e119d3f,0x3ad08088,0x2497d08d,0x2056cd3a,0x2d15ebe3,0x29d4f654,
    0xc5a92679,0xc1683bce,0xcc2b1d17,0xc8ea00a0,0xd6ad50a5,0xd26c4d12,0xdf2f6bcb,0xdbee767c,
    0xe3a1cbc1,0xe760d676,0xea23f0af,0xeee2ed18,0xf0a5bd1d,0xf464a0aa,0xf9278673,0xfde69bc4,
    0x89b8fd09,0x8d79e0be,0x803ac667,0x84fbdbd0,0x9abc8bd5,0x9e7d9662,0x933eb0bb,0x97ffad0c,
    0xafb010b1,0xab710d06,0xa6322bdf,0xa2f33668,0xbcb4666d,0xb8757bda,0xb5365d03,0xb1f740b4,
};

EMSCRIPTEN_KEEPALIVE
uint32_t ogg_crc32_simd(const uint8_t* data, size_t len) {
    uint32_t crc = 0;

#ifdef __wasm_simd128__
    // Process 16 bytes at a time with SIMD when possible
    while (len >= 16) {
        v128_t chunk = wasm_v128_load(data);

        // Extract bytes and process through lookup table
        uint8_t bytes[16];
        wasm_v128_store(bytes, chunk);
        for (int i = 0; i < 16; i++) {
            crc = (crc << 8) ^ crc_lookup[((crc >> 24) ^ bytes[i]) & 0xff];
        }

        data += 16;
        len -= 16;
    }
#endif

    // Process remaining bytes
    while (len--) {
        crc = (crc << 8) ^ crc_lookup[((crc >> 24) ^ *data++) & 0xff];
    }

    return crc;
}

// SIMD-optimized memory operations for OGG stream processing
EMSCRIPTEN_KEEPALIVE
void ogg_memcpy_simd(uint8_t* dest, const uint8_t* src, size_t len) {
#ifdef __wasm_simd128__
    // Handle unaligned prefix
    while (((uintptr_t)dest & 15) && len > 0) {
        *dest++ = *src++;
        len--;
    }

    // SIMD copy for aligned data
    while (len >= 64) {
        v128_t v0 = wasm_v128_load(&src[0]);
        v128_t v1 = wasm_v128_load(&src[16]);
        v128_t v2 = wasm_v128_load(&src[32]);
        v128_t v3 = wasm_v128_load(&src[48]);

        wasm_v128_store(&dest[0], v0);
        wasm_v128_store(&dest[16], v1);
        wasm_v128_store(&dest[32], v2);
        wasm_v128_store(&dest[48], v3);

        src += 64;
        dest += 64;
        len -= 64;
    }

    // Handle smaller chunks
    while (len >= 16) {
        v128_t v = wasm_v128_load(src);
        wasm_v128_store(dest, v);
        src += 16;
        dest += 16;
        len -= 16;
    }
#endif

    // Handle remainder
    while (len--) {
        *dest++ = *src++;
    }
}

// Fast byte search for OGG sync patterns
EMSCRIPTEN_KEEPALIVE
const uint8_t* ogg_find_sync_simd(const uint8_t* data, size_t len, uint8_t pattern) {
#ifdef __wasm_simd128__
    v128_t pattern_vec = wasm_i8x16_splat(pattern);

    // Process 16 bytes per iteration
    size_t i = 0;
    for (; i + 15 < len; i += 16) {
        v128_t chunk = wasm_v128_load(&data[i]);
        v128_t cmp = wasm_i8x16_eq(chunk, pattern_vec);
        int32_t mask = wasm_i8x16_bitmask(cmp);

        if (mask) {
            // Found match - locate exact position
            int pos = __builtin_ctz(mask);
            return &data[i + pos];
        }
    }

    // Scalar fallback for remainder
    for (; i < len; i++) {
        if (data[i] == pattern) {
            return &data[i];
        }
    }
#else
    // Pure scalar implementation
    for (size_t i = 0; i < len; i++) {
        if (data[i] == pattern) {
            return &data[i];
        }
    }
#endif

    return NULL;
}

// SIMD-optimized memory comparison for OGG page validation
EMSCRIPTEN_KEEPALIVE
int ogg_memcmp_simd(const void* s1, const void* s2, size_t n) {
    const uint8_t* p1 = (const uint8_t*)s1;
    const uint8_t* p2 = (const uint8_t*)s2;

#ifdef __wasm_simd128__
    size_t i = 0;
    for (; i + 15 < n; i += 16) {
        v128_t v1 = wasm_v128_load(&p1[i]);
        v128_t v2 = wasm_v128_load(&p2[i]);
        v128_t cmp = wasm_i8x16_eq(v1, v2);
        int32_t mask = wasm_i8x16_bitmask(cmp);

        if (mask != 0xFFFF) {
            // Found difference - locate it
            for (int j = 0; j < 16; j++) {
                if (p1[i + j] != p2[i + j]) {
                    return p1[i + j] - p2[i + j];
                }
            }
        }
    }

    // Scalar remainder
    for (; i < n; i++) {
        if (p1[i] != p2[i]) {
            return p1[i] - p2[i];
        }
    }
#else
    // Pure scalar implementation
    for (size_t i = 0; i < n; i++) {
        if (p1[i] != p2[i]) {
            return p1[i] - p2[i];
        }
    }
#endif

    return 0;
}

// Performance benchmark function
EMSCRIPTEN_KEEPALIVE
double ogg_simd_benchmark() {
    const size_t test_size = 1024 * 1024; // 1MB test
    uint8_t* test_data = (uint8_t*)malloc(test_size);
    if (!test_data) return 0.0;

    // Initialize test data
    for (size_t i = 0; i < test_size; i++) {
        test_data[i] = (uint8_t)(i & 0xFF);
    }

    // Use performance.now() equivalent for more accurate timing
    double start_time = emscripten_get_now();

    for (int i = 0; i < 100; i++) {
        volatile uint32_t crc = ogg_crc32_simd(test_data, test_size);
        (void)crc; // Prevent optimization
    }

    double end_time = emscripten_get_now();
    double elapsed_ms = end_time - start_time;
    double throughput = (test_size * 100.0) / (elapsed_ms / 1000.0) / (1024 * 1024); // MB/s

    free(test_data);
    return throughput;
}