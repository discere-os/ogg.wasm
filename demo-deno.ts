#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * OGG WASM Demo - Comprehensive demonstration of OGG processing capabilities
 * Copyright (c) 2002, Xiph.org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause
 */

import Ogg from "./src/lib/index.ts"

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
}

function colorize(color: string, text: string): string {
  return `${color}${text}${colors.reset}`
}

function createTestOggData(): Uint8Array {
  // Create a more comprehensive test OGG file with multiple pages
  const pages: Uint8Array[] = []

  // Page 1: Beginning of stream with Vorbis identification
  const page1 = new Uint8Array([
    // OGG page header
    0x4f, 0x67, 0x67, 0x53,           // "OggS" magic
    0x00,                             // version
    0x02,                             // header type (beginning of stream)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // granule position
    0x01, 0x23, 0x45, 0x67,           // serial number
    0x00, 0x00, 0x00, 0x00,           // page sequence number
    0x7e, 0xb7, 0x0d, 0x3a,           // checksum (placeholder)
    0x01,                             // number of page segments
    0x1e,                             // segment table (30 bytes in segment)

    // Vorbis identification header (simplified)
    0x01,                             // packet type
    0x76, 0x6f, 0x72, 0x62, 0x69, 0x73, // "vorbis"
    0x00, 0x00, 0x00, 0x00,           // vorbis version
    0x02,                             // channels
    0x44, 0xac, 0x00, 0x00,           // sample rate (44100)
    0x00, 0x00, 0x00, 0x00,           // bitrate maximum
    0x00, 0xee, 0x02, 0x00,           // bitrate nominal
    0x00, 0x00, 0x00, 0x00,           // bitrate minimum
    0xb4,                             // blocksize
    0x01                              // framing flag
  ])

  // Page 2: Continuation with setup data
  const page2 = new Uint8Array([
    // OGG page header
    0x4f, 0x67, 0x67, 0x53,           // "OggS" magic
    0x00,                             // version
    0x00,                             // header type (continuation)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // granule position
    0x01, 0x23, 0x45, 0x67,           // serial number (same as page 1)
    0x01, 0x00, 0x00, 0x00,           // page sequence number
    0x45, 0x23, 0xcd, 0xef,           // checksum (placeholder)
    0x02,                             // number of page segments
    0x10, 0x08,                       // segment table (16 + 8 bytes)

    // Setup header data (placeholder)
    0x03,                             // packet type (setup)
    0x76, 0x6f, 0x72, 0x62, 0x69, 0x73, // "vorbis"
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,

    // Audio data (placeholder)
    0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0xf9, 0xf8
  ])

  // Page 3: End of stream
  const page3 = new Uint8Array([
    // OGG page header
    0x4f, 0x67, 0x67, 0x53,           // "OggS" magic
    0x00,                             // version
    0x04,                             // header type (end of stream)
    0x40, 0x1f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // granule position
    0x01, 0x23, 0x45, 0x67,           // serial number (same as previous)
    0x02, 0x00, 0x00, 0x00,           // page sequence number
    0x12, 0x34, 0x56, 0x78,           // checksum (placeholder)
    0x01,                             // number of page segments
    0x04,                             // segment table (4 bytes)

    // Final audio data
    0xaa, 0xbb, 0xcc, 0xdd
  ])

  pages.push(page1, page2, page3)

  // Combine all pages
  const totalLength = pages.reduce((sum, page) => sum + page.length, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0

  for (const page of pages) {
    combined.set(page, offset)
    offset += page.length
  }

  return combined
}

async function demonstrateBasicFunctionality() {
  console.log(colorize(colors.blue + colors.bright, "\n🎵 Basic OGG Functionality Demo"))
  console.log("=" + "=".repeat(50))

  const ogg = new Ogg({
    simdOptimizations: true,
    debug: true,
    maxMemoryMB: 64
  })

  console.log(colorize(colors.yellow, "📦 Initializing OGG WASM module..."))
  await ogg.initialize()

  console.log(colorize(colors.green, "✅ Module initialized successfully"))
  console.log(colorize(colors.cyan, `🚀 SIMD support: ${ogg.isSIMDAvailable() ? 'Available' : 'Not available'}`))

  // Test with synthetic OGG data
  console.log(colorize(colors.yellow, "\n📄 Creating test OGG data..."))
  const testData = createTestOggData()
  console.log(colorize(colors.green, `✅ Created ${testData.length} bytes of test data`))

  // Feed data
  console.log(colorize(colors.yellow, "\n🔄 Feeding data to sync layer..."))
  const feedResult = ogg.feedData(testData)

  if (feedResult.success) {
    console.log(colorize(colors.green, `✅ Fed ${feedResult.bytesConsumed} bytes successfully`))
  } else {
    console.log(colorize(colors.red, `❌ Failed to feed data: ${feedResult.error}`))
  }

  // Extract pages
  console.log(colorize(colors.yellow, "\n📄 Extracting OGG pages..."))
  let pageCount = 0
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const pageResult = ogg.extractPage()
    attempts++

    if (!pageResult.success) {
      if (pageCount === 0) {
        console.log(colorize(colors.yellow, `⚠️  No valid pages found: ${pageResult.error}`))
      }
      break
    }

    pageCount++
    console.log(colorize(colors.green, `✅ Extracted page ${pageCount}:`))
    console.log(`   Version: ${pageResult.version}`)
    console.log(`   Beginning of stream: ${pageResult.bos}`)
    console.log(`   End of stream: ${pageResult.eos}`)
    console.log(`   Continued: ${pageResult.continued}`)
    console.log(`   Serial number: ${pageResult.serialno}`)
    console.log(`   Page number: ${pageResult.pageno}`)
    console.log(`   Granule position: ${pageResult.granulepos}`)
    console.log(`   Packets: ${pageResult.packets}`)

    if (pageResult.page) {
      console.log(`   Header length: ${pageResult.page.headerLen} bytes`)
      console.log(`   Body length: ${pageResult.page.bodyLen} bytes`)
    }
  }

  console.log(colorize(colors.cyan, `📊 Extracted ${pageCount} pages total`))

  ogg.cleanup()
  console.log(colorize(colors.green, "🧹 Cleanup completed"))
}

async function demonstrateStreamProcessing() {
  console.log(colorize(colors.blue + colors.bright, "\n🌊 Stream Processing Demo"))
  console.log("=" + "=".repeat(50))

  const ogg = new Ogg({ simdOptimizations: true })
  await ogg.initialize()

  const testData = createTestOggData()

  // Initialize a stream
  const serialno = 0x67452301 // From our test data
  console.log(colorize(colors.yellow, `🔧 Initializing stream with serial number: ${serialno}`))

  if (ogg.initStream(serialno)) {
    console.log(colorize(colors.green, "✅ Stream initialized successfully"))

    // Feed data and extract pages
    ogg.feedData(testData)

    let processedPackets = 0
    while (true) {
      const pageResult = ogg.extractPage()
      if (!pageResult.success) break

      if (pageResult.page && pageResult.serialno === serialno) {
        console.log(colorize(colors.yellow, `📄 Processing page for stream ${serialno}`))

        // Feed page to stream
        if (ogg.feedPageToStream(serialno, pageResult.page)) {
          console.log(colorize(colors.green, "✅ Page fed to stream"))

          // Extract packets
          while (true) {
            const packetResult = ogg.extractPacketFromStream(serialno)
            if (!packetResult.success) break

            processedPackets++
            console.log(colorize(colors.green, `✅ Extracted packet ${processedPackets}:`))

            if (packetResult.packet) {
              console.log(`   Size: ${packetResult.packet.bytes} bytes`)
              console.log(`   Beginning of stream: ${packetResult.packet.bos}`)
              console.log(`   End of stream: ${packetResult.packet.eos}`)
              console.log(`   Granule position: ${packetResult.packet.granulepos}`)
              console.log(`   Packet number: ${packetResult.packet.packetno}`)
            }
          }
        } else {
          console.log(colorize(colors.red, "❌ Failed to feed page to stream"))
        }
      }
    }

    console.log(colorize(colors.cyan, `📊 Processed ${processedPackets} packets from stream`))
  } else {
    console.log(colorize(colors.red, "❌ Failed to initialize stream"))
  }

  ogg.cleanup()
}

async function demonstratePerformanceMetrics() {
  console.log(colorize(colors.blue + colors.bright, "\n⚡ Performance Metrics Demo"))
  console.log("=" + "=".repeat(50))

  const ogg = new Ogg({ simdOptimizations: true })
  await ogg.initialize()

  console.log(colorize(colors.yellow, "📊 Collecting performance metrics..."))
  const metrics = ogg.getPerformanceMetrics()

  console.log(colorize(colors.green, "✅ Performance Results:"))
  console.log(`   CRC32 Speed: ${metrics.crc32Speed.toFixed(1)} MB/s`)
  console.log(`   Memory Copy Speed: ${metrics.memcopySpeed.toFixed(1)} MB/s`)
  console.log(`   Sync Search Speed: ${metrics.syncSearchSpeed.toFixed(1)} MB/s`)
  console.log(`   Parsing Speed: ${metrics.parsingSpeed.toFixed(1)} MB/s`)
  console.log(`   SIMD Available: ${metrics.simdAvailable ? 'Yes' : 'No'}`)
  console.log(`   SIMD Used: ${metrics.simdUsed ? 'Yes' : 'No'}`)

  ogg.cleanup()
}

async function demonstrateFileValidation() {
  console.log(colorize(colors.blue + colors.bright, "\n🔍 File Validation Demo"))
  console.log("=" + "=".repeat(50))

  const ogg = new Ogg()
  await ogg.initialize()

  const testData = createTestOggData()

  console.log(colorize(colors.yellow, "🔍 Validating OGG file format..."))

  try {
    const result = await ogg.validateFile(testData)

    console.log(colorize(colors.green, "✅ Validation Results:"))
    console.log(`   Valid OGG File: ${result.isValid ? 'Yes' : 'No'}`)
    console.log(`   Version: ${result.version}`)
    console.log(`   Streams: ${result.formatDetails.streams}`)
    console.log(`   Pages: ${result.formatDetails.pages}`)
    console.log(`   Packets: ${result.formatDetails.packets}`)

    if (result.errors.length > 0) {
      console.log(colorize(colors.red, "❌ Validation Errors:"))
      for (const error of result.errors) {
        console.log(`   • ${error}`)
      }
    }

    if (result.warnings.length > 0) {
      console.log(colorize(colors.yellow, "⚠️  Validation Warnings:"))
      for (const warning of result.warnings) {
        console.log(`   • ${warning}`)
      }
    }
  } catch (error) {
    console.log(colorize(colors.red, `❌ Validation failed: ${error}`))
  }

  ogg.cleanup()
}

async function demonstrateFullParsing() {
  console.log(colorize(colors.blue + colors.bright, "\n📈 Full File Parsing Demo"))
  console.log("=" + "=".repeat(50))

  const ogg = new Ogg({ simdOptimizations: true })
  await ogg.initialize()

  const testData = createTestOggData()

  console.log(colorize(colors.yellow, "📊 Parsing complete file..."))

  try {
    const startTime = performance.now()
    const stats = await ogg.parseFile(testData)
    const endTime = performance.now()

    console.log(colorize(colors.green, "✅ Parsing Complete:"))
    console.log(`   File Size: ${(stats.fileSize / 1024).toFixed(1)} KB`)
    console.log(`   Stream Count: ${stats.streamCount}`)
    console.log(`   Total Pages: ${stats.totalPages}`)
    console.log(`   Total Packets: ${stats.totalPackets}`)
    console.log(`   Processing Time: ${stats.processingTime.toFixed(2)} ms`)
    console.log(`   Throughput: ${stats.throughput.toFixed(1)} MB/s`)
    console.log(`   SIMD Used: ${stats.simdUsed ? 'Yes' : 'No'}`)

    if (stats.streams.length > 0) {
      console.log(colorize(colors.cyan, "\n📊 Stream Details:"))
      for (const [index, stream] of stats.streams.entries()) {
        console.log(`   Stream ${index + 1}:`)
        console.log(`     Serial Number: ${stream.serialno}`)
        console.log(`     Page Count: ${stream.pageCount}`)
        console.log(`     Packet Count: ${stream.packetCount}`)
        console.log(`     End of Stream: ${stream.eos ? 'Yes' : 'No'}`)
      }
    }
  } catch (error) {
    console.log(colorize(colors.red, `❌ Parsing failed: ${error}`))
  }

  ogg.cleanup()
}

async function main() {
  console.log(colorize(colors.magenta + colors.bright, "🎵 OGG WASM Comprehensive Demo"))
  console.log(colorize(colors.white, "WebAssembly implementation of libogg with SIMD optimizations"))
  console.log(colorize(colors.white, "Copyright (c) 2002, Xiph.org Foundation"))
  console.log(colorize(colors.white, "Copyright (c) 2025 Superstruct Ltd, New Zealand"))

  try {
    await demonstrateBasicFunctionality()
    await demonstrateStreamProcessing()
    await demonstratePerformanceMetrics()
    await demonstrateFileValidation()
    await demonstrateFullParsing()

    console.log(colorize(colors.green + colors.bright, "\n🎉 All demos completed successfully!"))
    console.log(colorize(colors.cyan, "\nTo run specific tests: deno task test"))
    console.log(colorize(colors.cyan, "To run benchmarks: deno task bench"))
    console.log(colorize(colors.cyan, "To build WASM: deno task build:wasm"))

  } catch (error) {
    console.log(colorize(colors.red + colors.bright, `\n💥 Demo failed: ${error}`))
    if (error instanceof Error && error.stack) {
      console.log(colorize(colors.red, error.stack))
    }
    Deno.exit(1)
  }
}

if (import.meta.main) {
  await main()
}