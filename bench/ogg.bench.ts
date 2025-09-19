import Ogg from "../src/lib/index.ts"

let ogg: Ogg

// Create test data of various sizes
const testData1KB = new Uint8Array(1024)
const testData64KB = new Uint8Array(64 * 1024)
const testData1MB = new Uint8Array(1024 * 1024)

// Fill with some pattern data
for (let i = 0; i < testData1MB.length; i++) {
  testData1MB[i] = i & 0xFF
}
testData1KB.set(testData1MB.slice(0, 1024))
testData64KB.set(testData1MB.slice(0, 64 * 1024))

// Add OGG magic at the beginning to make it more realistic
testData1KB[0] = 0x4f  // 'O'
testData1KB[1] = 0x67  // 'g'
testData1KB[2] = 0x67  // 'g'
testData1KB[3] = 0x53  // 'S'

testData64KB.set(testData1KB.slice(0, 4))
testData1MB.set(testData1KB.slice(0, 4))

// Setup before benchmarks
await (async () => {
  ogg = new Ogg({ simdOptimizations: true })
  await ogg.initialize()
})()

Deno.bench("OGG data feeding - 1KB", () => {
  ogg.reset()
  const result = ogg.feedData(testData1KB)
  if (!result.success) {
    throw new Error(`Feed failed: ${result.error}`)
  }
})

Deno.bench("OGG data feeding - 64KB", () => {
  ogg.reset()
  const result = ogg.feedData(testData64KB)
  if (!result.success) {
    throw new Error(`Feed failed: ${result.error}`)
  }
})

Deno.bench("OGG data feeding - 1MB", () => {
  ogg.reset()
  const result = ogg.feedData(testData1MB)
  if (!result.success) {
    throw new Error(`Feed failed: ${result.error}`)
  }
})

Deno.bench("OGG page extraction attempts", () => {
  ogg.reset()
  ogg.feedData(testData1KB)

  // Try to extract pages (may not succeed with test data, but measures performance)
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const result = ogg.extractPage()
    if (!result.success) break
    attempts++
  }
})

Deno.bench("OGG stream initialization", () => {
  ogg.reset()

  // Initialize multiple streams
  const serialNumbers = [12345, 54321, 98765, 13579, 24680]

  for (const serialno of serialNumbers) {
    const success = ogg.initStream(serialno)
    if (!success) {
      throw new Error(`Failed to initialize stream ${serialno}`)
    }
  }
})

Deno.bench("OGG module reset", () => {
  // Initialize some state first
  ogg.feedData(testData1KB)
  ogg.initStream(12345)
  ogg.initStream(54321)

  // Benchmark the reset operation
  ogg.reset()
})

Deno.bench("OGG performance metrics collection", () => {
  const metrics = ogg.getPerformanceMetrics()

  // Verify we got valid metrics
  if (metrics.crc32Speed < 0 || metrics.memcopySpeed < 0) {
    throw new Error('Invalid performance metrics')
  }
})

Deno.bench("OGG validation attempt - small data", async () => {
  try {
    const result = await ogg.validateFile(testData1KB)
    // Result validity doesn't matter for benchmarking, just that it completes
    if (typeof result.isValid !== 'boolean') {
      throw new Error('Invalid validation result')
    }
  } catch (error) {
    // Expected to fail for invalid data, but should complete quickly
    if (!(error instanceof Error)) {
      throw new Error('Unexpected error type')
    }
  }
})

Deno.bench("OGG SIMD availability check", () => {
  const simdAvailable = ogg.isSIMDAvailable()

  if (typeof simdAvailable !== 'boolean') {
    throw new Error('SIMD availability check failed')
  }
})

// Benchmark full parsing pipeline with synthetic data
Deno.bench("OGG full parsing pipeline - 64KB", async () => {
  ogg.reset()

  try {
    const stats = await ogg.parseFile(testData64KB)

    // Verify basic stats structure
    if (typeof stats.fileSize !== 'number' || stats.fileSize !== testData64KB.length) {
      throw new Error('Invalid parsing stats')
    }
  } catch (error) {
    // Expected to fail for synthetic data, but should complete
    if (!(error instanceof Error)) {
      throw new Error('Unexpected error type')
    }
  }
})

// Memory pressure test
Deno.bench("OGG memory stress test", () => {
  ogg.reset()

  // Feed data multiple times to test memory management
  for (let i = 0; i < 10; i++) {
    const result = ogg.feedData(testData64KB)
    if (!result.success) {
      throw new Error(`Feed failed on iteration ${i}: ${result.error}`)
    }

    // Try to extract pages
    ogg.extractPage()

    // Reset periodically to test cleanup
    if (i % 3 === 0) {
      ogg.reset()
    }
  }
})

// Concurrent operations test
Deno.bench("OGG multiple stream operations", () => {
  ogg.reset()

  // Initialize multiple streams
  const streams = [11111, 22222, 33333, 44444, 55555]

  for (const streamId of streams) {
    if (!ogg.initStream(streamId)) {
      throw new Error(`Failed to initialize stream ${streamId}`)
    }
  }

  // Feed some data
  ogg.feedData(testData1KB)

  // Try to extract page
  const pageResult = ogg.extractPage()

  if (pageResult.success && pageResult.page) {
    // Try to feed page to all streams
    for (const streamId of streams) {
      ogg.feedPageToStream(streamId, pageResult.page)

      // Try to extract packet
      ogg.extractPacketFromStream(streamId)
    }
  }
})

// Throughput measurement benchmark
Deno.bench("OGG throughput measurement", () => {
  const startTime = performance.now()

  // Process data
  ogg.reset()
  ogg.feedData(testData1MB)

  // Extract all possible pages
  let pageCount = 0
  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    const result = ogg.extractPage()
    if (!result.success) break
    pageCount++
    attempts++
  }

  const endTime = performance.now()
  const throughputMBps = (testData1MB.length / (1024 * 1024)) / ((endTime - startTime) / 1000)

  if (throughputMBps < 0) {
    throw new Error(`Invalid throughput calculation: ${throughputMBps}`)
  }

  // Store result for potential logging (though bench framework handles this)
  globalThis.lastThroughput = throughputMBps
})

// Cleanup after benchmarks
globalThis.addEventListener("unload", () => {
  ogg?.cleanup()
})