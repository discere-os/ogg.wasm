#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Simple OGG WASM Demo - Quick demonstration of basic functionality
 */

import Ogg from "./src/lib/index.ts"

console.log("🎵 Simple OGG WASM Demo")
console.log("========================\n")

// Initialize the OGG module
console.log("📦 Initializing OGG module...")
const ogg = new Ogg({ simdOptimizations: true })
await ogg.initialize()

console.log(`✅ Module initialized (SIMD: ${ogg.isSIMDAvailable()})`)

// Create simple test data with OGG magic
const testData = new Uint8Array([
  0x4f, 0x67, 0x67, 0x53, // "OggS" magic
  0x00, 0x02,             // version, header type
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // granule position
  0x12, 0x34, 0x56, 0x78, // serial number
  0x00, 0x00, 0x00, 0x00, // page number
  0xab, 0xcd, 0xef, 0x01, // checksum
  0x01,                   // segment count
  0x08,                   // segment size
  0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73, 0x00 // "vorbis" packet
])

console.log(`\n🔄 Processing ${testData.length} bytes of test data...`)

// Feed data to the module
const feedResult = ogg.feedData(testData)
console.log(`📥 Data fed: ${feedResult.success ? 'Success' : 'Failed'}`)

if (feedResult.success) {
  console.log(`   Bytes consumed: ${feedResult.bytesConsumed}`)

  // Try to extract a page
  const pageResult = ogg.extractPage()
  console.log(`📄 Page extraction: ${pageResult.success ? 'Success' : 'Need more data'}`)

  if (pageResult.success) {
    console.log(`   Page info: v${pageResult.version}, serial ${pageResult.serialno}`)
    console.log(`   Flags: BOS=${pageResult.bos}, EOS=${pageResult.eos}`)
  }
}

// Show performance metrics
console.log("\n⚡ Performance metrics:")
const metrics = ogg.getPerformanceMetrics()
console.log(`   SIMD available: ${metrics.simdAvailable}`)
console.log(`   SIMD used: ${metrics.simdUsed}`)

// Clean up
ogg.cleanup()
console.log("\n🧹 Cleanup completed")
console.log("✅ Simple demo finished!")