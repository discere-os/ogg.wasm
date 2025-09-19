import { assert, assertEquals, assertExists } from "@std/assert"
import Ogg from "../../src/lib/index.ts"

Deno.test("Ogg module initialization", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  assertExists(ogg)
  assert(ogg.isInitialized())

  ogg.cleanup()
})

Deno.test("SIMD support detection", async () => {
  const ogg = new Ogg({ simdOptimizations: true })
  await ogg.initialize()

  // SIMD support depends on browser/runtime, just ensure it doesn't crash
  const simdAvailable = ogg.isSIMDAvailable()
  assert(typeof simdAvailable === 'boolean')

  ogg.cleanup()
})

Deno.test("Module options handling", async () => {
  const options = {
    simdOptimizations: false,
    maxMemoryMB: 32,
    debug: true
  }

  const ogg = new Ogg(options)
  await ogg.initialize()

  assert(ogg.isInitialized())

  ogg.cleanup()
})

Deno.test("Basic data feeding", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  // Create some test data (not valid OGG, but should not crash)
  const testData = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02])

  const result = ogg.feedData(testData)
  assert(typeof result.success === 'boolean')
  assert(typeof result.bytesConsumed === 'number')

  ogg.cleanup()
})

Deno.test("Page extraction without data", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  // Try to extract page without feeding data
  const result = ogg.extractPage()

  // Should fail gracefully
  assertEquals(result.success, false)
  assertExists(result.error)

  ogg.cleanup()
})

Deno.test("Stream initialization", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  const serialno = 12345
  const success = ogg.initStream(serialno)

  // Should succeed
  assert(success)

  ogg.cleanup()
})

Deno.test("Performance metrics", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  const metrics = ogg.getPerformanceMetrics()

  assertExists(metrics)
  assert(typeof metrics.simdAvailable === 'boolean')
  assert(typeof metrics.simdUsed === 'boolean')
  assert(typeof metrics.crc32Speed === 'number')
  assert(typeof metrics.memcopySpeed === 'number')
  assert(typeof metrics.syncSearchSpeed === 'number')
  assert(typeof metrics.parsingSpeed === 'number')

  ogg.cleanup()
})

Deno.test("Module reset", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  // Initialize a stream
  ogg.initStream(12345)

  // Reset should not crash
  ogg.reset()

  // Should still be initialized
  assert(ogg.isInitialized())

  ogg.cleanup()
})

Deno.test("Empty file validation", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  const emptyData = new Uint8Array(0)

  try {
    const result = await ogg.validateFile(emptyData)
    assertEquals(result.isValid, false)
    assert(result.errors.length > 0)
  } catch (error) {
    // Expected to fail for empty data
    assert(error instanceof Error)
  }

  ogg.cleanup()
})

Deno.test("Invalid data handling", async () => {
  const ogg = new Ogg()
  await ogg.initialize()

  // Random invalid data
  const invalidData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00])

  try {
    const result = await ogg.parseFile(invalidData)
    // Should either succeed with zero streams or fail gracefully
    assert(typeof result.streamCount === 'number')
    assert(typeof result.totalPages === 'number')
    assert(typeof result.totalPackets === 'number')
  } catch (error) {
    // Expected to fail for invalid data
    assert(error instanceof Error)
  }

  ogg.cleanup()
})

Deno.test("Cleanup without initialization", () => {
  const ogg = new Ogg()

  // Should not crash when cleaning up uninitialized module
  ogg.cleanup()

  assertEquals(ogg.isInitialized(), false)
})

Deno.test("Multiple initialization attempts", async () => {
  const ogg = new Ogg()

  // First initialization
  await ogg.initialize()
  assert(ogg.isInitialized())

  // Second initialization should be a no-op
  await ogg.initialize()
  assert(ogg.isInitialized())

  ogg.cleanup()
})

Deno.test("Debug mode operation", async () => {
  const ogg = new Ogg({ debug: true })
  await ogg.initialize()

  // Debug mode should not affect basic functionality
  assert(ogg.isInitialized())

  const metrics = ogg.getPerformanceMetrics()
  assertExists(metrics)

  ogg.cleanup()
})