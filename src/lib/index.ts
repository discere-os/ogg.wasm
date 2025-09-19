/**
 * OGG WASM - WebAssembly implementation of libogg
 * Copyright (c) 2002, Xiph.org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause
 */

import type {
  OggOptions,
  OggPage,
  OggPacket,
  OggStreamInfo,
  OggSyncResult,
  OggPageResult,
  OggPacketResult,
  OggStats,
  OggPerformanceMetrics,
  OggValidationResult,
  OggWasmModule
} from './types.ts'

/**
 * WebAssembly implementation of libogg with SIMD optimizations
 *
 * This class provides a modern TypeScript interface to the OGG bitstream format,
 * enabling efficient parsing and processing of OGG files in browsers and Deno.
 */
export default class Ogg {
  private module: OggWasmModule | null = null
  private initialized = false
  private options: Required<OggOptions>
  private syncStatePtr: number = 0
  private streamStates = new Map<number, number>()
  private stats: Partial<OggStats> = {}

  constructor(options: OggOptions = {}) {
    this.options = {
      simdOptimizations: true,
      maxMemoryMB: 64,
      debug: false,
      ...options
    }
  }

  /**
   * Initialize the OGG WASM module
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const moduleFactory = await this.loadModuleFactory()
      const wasmBinary = await this.loadWasmBinary()

      this.module = await moduleFactory({
        wasmBinary: wasmBinary || undefined,
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) {
            return new URL('../../install/wasm/' + path, import.meta.url).href
          }
          return path
        }
      }) as OggWasmModule

      // Initialize sync state
      this.syncStatePtr = this.module._malloc(64) // ogg_sync_state size estimate
      if (this.module._ogg_sync_init(this.syncStatePtr) !== 0) {
        throw new Error('Failed to initialize OGG sync state')
      }

      this.setupPerformanceMonitoring()
      this.initialized = true

      if (this.options.debug) {
        console.log('OGG WASM module initialized successfully')
        console.log(`SIMD support: ${this.isSIMDAvailable()}`)
      }
    } catch (error) {
      throw new Error(`Failed to initialize OGG module: ${error}`)
    }
  }

  private async loadModuleFactory(): Promise<Function> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      const moduleFactory = (await import('../../install/wasm/ogg-main.js')).default
      return moduleFactory
    }

    // Web/CDN runtime - try CDN locations with proper ES6 imports
    const cdnUrls = [
      'https://wasm.discere.cloud/ogg/latest/main/',
      'https://cdn.jsdelivr.net/npm/@discere-os/ogg.wasm/dist/'
    ]

    for (const url of cdnUrls) {
      try {
        const moduleFactory = (await import(`${url}ogg-main.js`)).default
        return moduleFactory
      } catch { continue }
    }

    throw new Error('Failed to load OGG module factory from any source')
  }

  private async loadWasmBinary(): Promise<ArrayBuffer | undefined> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      try {
        const wasmPath = new URL('../../install/wasm/ogg-main.wasm', import.meta.url).pathname
        const wasmBuffer = await Deno.readFile(wasmPath)
        return wasmBuffer.buffer
      } catch (error) {
        if (this.options.debug) {
          console.warn('Failed to load local WASM binary:', error)
        }
        return undefined
      }
    }

    // Web/CDN runtime - try CDN locations
    const cdnUrls = [
      'https://wasm.discere.cloud/ogg/latest/main/',
      'https://cdn.jsdelivr.net/npm/@discere-os/ogg.wasm/dist/'
    ]

    for (const url of cdnUrls) {
      try {
        const response = await fetch(`${url}ogg-main.wasm`)
        if (response.ok) {
          return await response.arrayBuffer()
        }
      } catch { continue }
    }

    // Fallback to undefined for embedded WASM
    return undefined
  }

  /**
   * Check if SIMD optimizations are available
   */
  isSIMDAvailable(): boolean {
    if (!this.module) return false
    return this.module._ogg_simd_available()
  }

  /**
   * Feed data into the OGG synchronization layer
   */
  feedData(data: Uint8Array): OggSyncResult {
    if (!this.ensureInitialized()) {
      return { success: false, bytesConsumed: 0, error: 'Module not initialized' }
    }

    try {
      // Get buffer for input data
      const bufferPtr = this.module!._ogg_sync_buffer(this.syncStatePtr, data.length)
      if (!bufferPtr) {
        return { success: false, bytesConsumed: 0, error: 'Failed to allocate sync buffer' }
      }

      // Copy data to WASM memory
      this.module!.HEAPU8.set(data, bufferPtr)

      // Tell sync layer how much data was written
      const result = this.module!._ogg_sync_wrote(this.syncStatePtr, data.length)
      if (result !== 0) {
        return { success: false, bytesConsumed: 0, error: `Sync wrote failed: ${result}` }
      }

      return { success: true, bytesConsumed: data.length }
    } catch (error) {
      return { success: false, bytesConsumed: 0, error: `Feed data error: ${error}` }
    }
  }

  /**
   * Extract a page from the sync layer
   */
  extractPage(): OggPageResult {
    if (!this.ensureInitialized()) {
      return { success: false, error: 'Module not initialized' }
    }

    try {
      // Allocate page structure
      const pagePtr = this.module!._malloc(32) // ogg_page size estimate

      // Try to extract a page
      const result = this.module!._ogg_sync_pageout(this.syncStatePtr, pagePtr)

      if (result === 1) {
        // Page extracted successfully
        const page = this.parsePageFromMemory(pagePtr)
        this.module!._free(pagePtr)

        return {
          success: true,
          page,
          version: this.module!._ogg_page_version(pagePtr),
          continued: !!this.module!._ogg_page_continued(pagePtr),
          bos: !!this.module!._ogg_page_bos(pagePtr),
          eos: !!this.module!._ogg_page_eos(pagePtr),
          granulepos: this.module!._ogg_page_granulepos(pagePtr),
          serialno: this.module!._ogg_page_serialno(pagePtr),
          pageno: this.module!._ogg_page_pageno(pagePtr),
          packets: this.module!._ogg_page_packets(pagePtr)
        }
      } else if (result === 0) {
        // Need more data
        this.module!._free(pagePtr)
        return { success: false, error: 'Need more data' }
      } else {
        // Error
        this.module!._free(pagePtr)
        return { success: false, error: `Page extraction failed: ${result}` }
      }
    } catch (error) {
      return { success: false, error: `Extract page error: ${error}` }
    }
  }

  /**
   * Initialize a stream with given serial number
   */
  initStream(serialno: number): boolean {
    if (!this.ensureInitialized()) return false

    try {
      const streamPtr = this.module!._malloc(64) // ogg_stream_state size estimate
      const result = this.module!._ogg_stream_init(streamPtr, serialno)

      if (result === 0) {
        this.streamStates.set(serialno, streamPtr)
        return true
      } else {
        this.module!._free(streamPtr)
        return false
      }
    } catch {
      return false
    }
  }

  /**
   * Feed a page into a specific stream
   */
  feedPageToStream(serialno: number, page: OggPage): boolean {
    if (!this.ensureInitialized()) return false

    const streamPtr = this.streamStates.get(serialno)
    if (!streamPtr) return false

    try {
      // Create page structure in WASM memory
      const pagePtr = this.createPageInMemory(page)
      const result = this.module!._ogg_stream_pagein(streamPtr, pagePtr)
      this.module!._free(pagePtr)

      return result === 0
    } catch {
      return false
    }
  }

  /**
   * Extract a packet from a stream
   */
  extractPacketFromStream(serialno: number): OggPacketResult {
    if (!this.ensureInitialized()) {
      return { success: false, error: 'Module not initialized' }
    }

    const streamPtr = this.streamStates.get(serialno)
    if (!streamPtr) {
      return { success: false, error: 'Stream not found' }
    }

    try {
      const packetPtr = this.module!._malloc(32) // ogg_packet size estimate
      const result = this.module!._ogg_stream_packetout(streamPtr, packetPtr)

      if (result === 1) {
        // Packet extracted successfully
        const packet = this.parsePacketFromMemory(packetPtr)
        this.module!._free(packetPtr)
        return { success: true, packet }
      } else if (result === 0) {
        // Need more data
        this.module!._free(packetPtr)
        return { success: false, error: 'Need more data' }
      } else {
        // Error
        this.module!._free(packetPtr)
        return { success: false, error: `Packet extraction failed: ${result}` }
      }
    } catch (error) {
      return { success: false, error: `Extract packet error: ${error}` }
    }
  }

  /**
   * Parse an entire OGG file and return statistics
   */
  async parseFile(data: Uint8Array): Promise<OggStats> {
    const startTime = performance.now()

    this.stats = {
      fileSize: data.length,
      streamCount: 0,
      streams: [],
      totalPages: 0,
      totalPackets: 0,
      simdUsed: this.options.simdOptimizations && this.isSIMDAvailable()
    }

    // Feed all data in chunks for better memory management
    const chunkSize = 64 * 1024 // 64KB chunks
    let offset = 0

    while (offset < data.length) {
      const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length))
      const result = this.feedData(chunk)

      if (!result.success) {
        throw new Error(`Failed to feed data: ${result.error}`)
      }

      offset += chunkSize

      // Process all available pages
      while (true) {
        const pageResult = this.extractPage()
        if (!pageResult.success) break

        this.stats.totalPages!++

        if (pageResult.serialno !== undefined) {
          // Initialize stream if not seen before
          if (!this.streamStates.has(pageResult.serialno)) {
            this.initStream(pageResult.serialno)
            this.stats.streamCount!++
            this.stats.streams!.push({
              serialno: pageResult.serialno,
              pageCount: 0,
              packetCount: 0,
              eos: false
            })
          }

          // Feed page to stream and extract packets
          if (pageResult.page) {
            this.feedPageToStream(pageResult.serialno, pageResult.page)

            // Extract all available packets
            while (true) {
              const packetResult = this.extractPacketFromStream(pageResult.serialno)
              if (!packetResult.success) break

              this.stats.totalPackets!++

              // Update stream stats
              const streamInfo = this.stats.streams!.find(s => s.serialno === pageResult.serialno)
              if (streamInfo) {
                streamInfo.packetCount++
                if (packetResult.packet?.eos) {
                  streamInfo.eos = true
                }
              }
            }

            // Update stream page count
            const streamInfo = this.stats.streams!.find(s => s.serialno === pageResult.serialno)
            if (streamInfo) {
              streamInfo.pageCount++
            }
          }
        }
      }
    }

    const endTime = performance.now()
    this.stats.processingTime = endTime - startTime
    this.stats.throughput = (data.length / 1024 / 1024) / (this.stats.processingTime / 1000)

    return this.stats as OggStats
  }

  /**
   * Validate OGG file format
   */
  async validateFile(data: Uint8Array): Promise<OggValidationResult> {
    const result: OggValidationResult = {
      isValid: true,
      version: 0,
      errors: [],
      warnings: [],
      formatDetails: {
        streams: 0,
        pages: 0,
        packets: 0
      }
    }

    try {
      const stats = await this.parseFile(data)

      result.formatDetails = {
        streams: stats.streamCount,
        pages: stats.totalPages,
        packets: stats.totalPackets
      }

      // Basic validation checks
      if (stats.streamCount === 0) {
        result.errors.push('No OGG streams found')
        result.isValid = false
      }

      if (stats.totalPages === 0) {
        result.errors.push('No OGG pages found')
        result.isValid = false
      }

      // Check for streams without EOS
      const streamsWithoutEOS = stats.streams.filter(s => !s.eos)
      if (streamsWithoutEOS.length > 0) {
        result.warnings.push(`${streamsWithoutEOS.length} streams missing end-of-stream marker`)
      }

    } catch (error) {
      result.errors.push(`Validation failed: ${error}`)
      result.isValid = false
    }

    return result
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): OggPerformanceMetrics {
    if (!this.ensureInitialized()) {
      throw new Error('Module not initialized')
    }

    return {
      crc32Speed: this.measureCRC32Speed(),
      memcopySpeed: this.measureMemcopySpeed(),
      syncSearchSpeed: this.measureSyncSearchSpeed(),
      parsingSpeed: this.stats.throughput || 0,
      simdAvailable: this.isSIMDAvailable(),
      simdUsed: this.options.simdOptimizations && this.isSIMDAvailable()
    }
  }

  /**
   * Reset the sync state for parsing a new file
   */
  reset(): void {
    if (!this.ensureInitialized()) return

    // Clear sync state
    this.module!._ogg_sync_reset(this.syncStatePtr)

    // Clear all streams
    for (const [serialno, streamPtr] of this.streamStates) {
      this.module!._ogg_stream_clear(streamPtr)
      this.module!._free(streamPtr)
    }
    this.streamStates.clear()

    // Reset stats
    this.stats = {}
  }

  /**
   * Check if module is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.module !== null
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (!this.module) return

    // Free sync state
    if (this.syncStatePtr) {
      this.module._ogg_sync_clear(this.syncStatePtr)
      this.module._free(this.syncStatePtr)
      this.syncStatePtr = 0
    }

    // Free all stream states
    for (const [serialno, streamPtr] of this.streamStates) {
      this.module._ogg_stream_clear(streamPtr)
      this.module._free(streamPtr)
    }
    this.streamStates.clear()

    this.module = null
    this.initialized = false
  }

  // Private helper methods

  private ensureInitialized(): boolean {
    if (!this.initialized || !this.module) {
      if (this.options.debug) {
        console.error('OGG module not initialized')
      }
      return false
    }
    return true
  }

  private parsePageFromMemory(pagePtr: number): OggPage {
    // This would need to read the ogg_page struct from memory
    // For now, return a placeholder
    return {
      header: new Uint8Array(27), // OGG page header is always at least 27 bytes
      body: new Uint8Array(0),
      headerLen: 27,
      bodyLen: 0
    }
  }

  private parsePacketFromMemory(packetPtr: number): OggPacket {
    // This would need to read the ogg_packet struct from memory
    // For now, return a placeholder
    return {
      packet: new Uint8Array(0),
      bytes: 0,
      bos: false,
      eos: false,
      granulepos: 0n,
      packetno: 0
    }
  }

  private createPageInMemory(page: OggPage): number {
    // This would need to create an ogg_page struct in WASM memory
    // For now, return a dummy pointer
    const pagePtr = this.module!._malloc(32)
    return pagePtr
  }

  private setupPerformanceMonitoring(): void {
    // Set up any performance monitoring hooks
    if (this.options.debug) {
      console.log('Performance monitoring enabled')
    }
  }

  private measureCRC32Speed(): number {
    if (!this.module) return 0

    const testSize = 1024 * 1024 // 1MB
    const testData = new Uint8Array(testSize)
    const testPtr = this.module._malloc(testSize)

    const iterations = 10
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      this.module._ogg_crc32_simd(testPtr, testSize)
    }

    const endTime = performance.now()
    this.module._free(testPtr)

    const totalBytes = testSize * iterations
    const totalTime = (endTime - startTime) / 1000
    return (totalBytes / 1024 / 1024) / totalTime // MB/s
  }

  private measureMemcopySpeed(): number {
    // Similar to CRC32 speed measurement
    return 0 // Placeholder
  }

  private measureSyncSearchSpeed(): number {
    // Similar to other speed measurements
    return 0 // Placeholder
  }
}

// Export types for convenience
export type * from './types.ts'