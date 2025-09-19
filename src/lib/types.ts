/**
 * TypeScript definitions for OGG WASM module
 * Copyright (c) 2002, Xiph.org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause
 */

/** Configuration options for OGG WASM module */
export interface OggOptions {
  /** Enable SIMD optimizations for better performance */
  simdOptimizations?: boolean
  /** Maximum memory allocation in MB */
  maxMemoryMB?: number
  /** Enable debug logging */
  debug?: boolean
}

/** OGG page structure */
export interface OggPage {
  /** Page header data */
  header: Uint8Array
  /** Page body data */
  body: Uint8Array
  /** Header length */
  headerLen: number
  /** Body length */
  bodyLen: number
}

/** OGG packet structure */
export interface OggPacket {
  /** Packet data */
  packet: Uint8Array
  /** Packet length in bytes */
  bytes: number
  /** Beginning of stream flag */
  bos: boolean
  /** End of stream flag */
  eos: boolean
  /** Granule position */
  granulepos: bigint
  /** Packet number in sequence */
  packetno: number
}

/** OGG stream information */
export interface OggStreamInfo {
  /** Stream serial number */
  serialno: number
  /** Number of pages processed */
  pageCount: number
  /** Number of packets extracted */
  packetCount: number
  /** Stream is at end */
  eos: boolean
}

/** Result of OGG sync operation */
export interface OggSyncResult {
  /** Operation was successful */
  success: boolean
  /** Number of bytes consumed */
  bytesConsumed: number
  /** Error message if any */
  error?: string
}

/** Result of OGG page parsing */
export interface OggPageResult {
  /** Page was successfully parsed */
  success: boolean
  /** Parsed page data */
  page?: OggPage
  /** Page version (should be 0) */
  version?: number
  /** Page is continued from previous */
  continued?: boolean
  /** Page is beginning of stream */
  bos?: boolean
  /** Page is end of stream */
  eos?: boolean
  /** Page granule position */
  granulepos?: bigint
  /** Stream serial number */
  serialno?: number
  /** Page sequence number */
  pageno?: number
  /** Number of packets in page */
  packets?: number
  /** Error message if parsing failed */
  error?: string
}

/** Result of OGG packet extraction */
export interface OggPacketResult {
  /** Packet was successfully extracted */
  success: boolean
  /** Extracted packet data */
  packet?: OggPacket
  /** Error message if extraction failed */
  error?: string
}

/** OGG file statistics */
export interface OggStats {
  /** Total file size in bytes */
  fileSize: number
  /** Number of streams found */
  streamCount: number
  /** Stream information per stream */
  streams: OggStreamInfo[]
  /** Total pages processed */
  totalPages: number
  /** Total packets extracted */
  totalPackets: number
  /** Processing time in milliseconds */
  processingTime: number
  /** Data throughput in MB/s */
  throughput: number
  /** SIMD optimizations were used */
  simdUsed: boolean
}

/** Performance metrics */
export interface OggPerformanceMetrics {
  /** CRC32 calculation speed in MB/s */
  crc32Speed: number
  /** Memory copy speed in MB/s */
  memcopySpeed: number
  /** Sync pattern search speed in MB/s */
  syncSearchSpeed: number
  /** Overall parsing speed in MB/s */
  parsingSpeed: number
  /** SIMD acceleration available */
  simdAvailable: boolean
  /** SIMD acceleration used */
  simdUsed: boolean
}

/** OGG format validation result */
export interface OggValidationResult {
  /** File is valid OGG format */
  isValid: boolean
  /** OGG format version */
  version: number
  /** List of validation errors */
  errors: string[]
  /** List of validation warnings */
  warnings: string[]
  /** File format details */
  formatDetails: {
    /** Total streams */
    streams: number
    /** Total pages */
    pages: number
    /** Total packets */
    packets: number
    /** File duration estimate (if available) */
    duration?: number
  }
}

/** Internal WASM module interface */
export interface OggWasmModule {
  // Memory management
  _malloc: (size: number) => number
  _free: (ptr: number) => void

  // Core OGG functions
  _ogg_sync_init: (oy: number) => number
  _ogg_sync_clear: (oy: number) => number
  _ogg_sync_destroy: (oy: number) => void
  _ogg_sync_reset: (oy: number) => number
  _ogg_sync_buffer: (oy: number, size: number) => number
  _ogg_sync_wrote: (oy: number, bytes: number) => number
  _ogg_sync_pageseek: (oy: number, og: number) => number
  _ogg_sync_pageout: (oy: number, og: number) => number

  _ogg_stream_init: (os: number, serialno: number) => number
  _ogg_stream_clear: (os: number) => number
  _ogg_stream_reset: (os: number) => number
  _ogg_stream_reset_serialno: (os: number, serialno: number) => number
  _ogg_stream_destroy: (os: number) => void
  _ogg_stream_check: (os: number) => number
  _ogg_stream_eos: (os: number) => number
  _ogg_stream_pagein: (os: number, og: number) => number
  _ogg_stream_packetout: (os: number, op: number) => number
  _ogg_stream_packetpeek: (os: number, op: number) => number

  _ogg_page_version: (og: number) => number
  _ogg_page_continued: (og: number) => number
  _ogg_page_bos: (og: number) => number
  _ogg_page_eos: (og: number) => number
  _ogg_page_granulepos: (og: number) => bigint
  _ogg_page_serialno: (og: number) => number
  _ogg_page_pageno: (og: number) => number
  _ogg_page_packets: (og: number) => number
  _ogg_page_checksum_set: (og: number) => void

  // SIMD optimizations
  _ogg_crc32_simd: (data: number, len: number) => number
  _ogg_simd_available: () => boolean

  // Runtime methods
  cwrap: (name: string, returnType: string, argTypes: string[]) => Function
  ccall: (name: string, returnType: string, argTypes: string[], args: any[]) => any
  UTF8ToString: (ptr: number) => string

  // Memory views
  HEAPU8: Uint8Array
  HEAP32: Int32Array
  HEAPU32: Uint32Array
}