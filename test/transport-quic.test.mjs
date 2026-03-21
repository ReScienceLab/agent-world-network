import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseHostPort, isNativeQuicAvailable } from "../dist/transport-quic.js"
import { UDPTransport } from "../dist/transport-quic.js"

describe("parseHostPort", () => {
  it("parses [ipv6]:port format", () => {
    const { host, port } = parseHostPort("[::1]:8098")
    assert.equal(host, "::1")
    assert.equal(port, 8098)
  })

  it("parses [full ipv6]:port format", () => {
    const { host, port } = parseHostPort("[2001:db8::1]:9000")
    assert.equal(host, "2001:db8::1")
    assert.equal(port, 9000)
  })

  it("parses ipv4:port format", () => {
    const { host, port } = parseHostPort("192.168.1.1:8098")
    assert.equal(host, "192.168.1.1")
    assert.equal(port, 8098)
  })

  it("parses hostname:port format", () => {
    const { host, port } = parseHostPort("example.com:443")
    assert.equal(host, "example.com")
    assert.equal(port, 443)
  })

  it("throws on invalid format", () => {
    assert.throws(() => parseHostPort("invalid"), /Invalid address format/)
  })
})

describe("isNativeQuicAvailable", () => {
  it("returns a boolean", () => {
    const result = isNativeQuicAvailable()
    assert.equal(typeof result, "boolean")
  })
})

describe("UDPTransport", () => {
  it("has id 'quic'", () => {
    const qt = new UDPTransport()
    assert.equal(qt.id, "quic")
  })

  it("is not active before start", () => {
    const qt = new UDPTransport()
    assert.equal(qt.isActive(), false)
    assert.equal(qt.address, "")
  })

  it("getEndpoint returns correct structure", () => {
    const qt = new UDPTransport()
    const ep = qt.getEndpoint()
    assert.equal(ep.transport, "quic")
    assert.equal(ep.priority, 0)
  })

  it("can start and stop in test mode", async () => {
    const qt = new UDPTransport()
    const id = { agentId: "test", publicKey: "", privateKey: "" }
    const ok = await qt.start(id, { testMode: true, quicPort: 0 })
    assert.equal(ok, true)
    assert.equal(qt.isActive(), true)
    assert.ok(qt.address.length > 0)
    await qt.stop()
    assert.equal(qt.isActive(), false)
  })

  it("uses ADVERTISE_ADDRESS when provided", async () => {
    const qt = new UDPTransport()
    const id = { agentId: "test", publicKey: "", privateKey: "" }
    const ok = await qt.start(id, {
      quicPort: 0,
      advertiseAddress: "203.0.113.1",
      advertisePort: 9000,
    })
    assert.equal(ok, true)
    assert.equal(qt.address, "203.0.113.1:9000")
    assert.deepEqual(qt.publicEndpoint, { address: "203.0.113.1", port: 9000 })
    await qt.stop()
  })

  it("uses bracketed format for IPv6 advertise address", async () => {
    const qt = new UDPTransport()
    const id = { agentId: "test", publicKey: "", privateKey: "" }
    const ok = await qt.start(id, {
      quicPort: 0,
      advertiseAddress: "2001:db8::1",
      advertisePort: 8098,
    })
    assert.equal(ok, true)
    assert.equal(qt.address, "[2001:db8::1]:8098")
    await qt.stop()
  })

  it("registers message handlers", () => {
    const qt = new UDPTransport()
    let called = false
    qt.onMessage(() => { called = true })
    // Handler registered but not called since we haven't started
    assert.equal(called, false)
  })
})
