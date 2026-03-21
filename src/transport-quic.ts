/**
 * UDP transport backend — optional fast transport alongside the primary HTTP/TCP layer.
 *
 * IMPORTANT: This is a plain UDP datagram transport, NOT a real QUIC
 * implementation. It provides:
 *   - Unencrypted, unreliable UDP delivery (no retransmission, no ordering)
 *   - Messages >MTU (~1400 bytes) may be silently dropped
 *
 * The advertised public endpoint is determined by explicit configuration
 * (ADVERTISE_ADDRESS / ADVERTISE_PORT env vars or plugin config), not by
 * automatic NIC scanning or STUN. This is intentional: in the world-scoped
 * architecture, reachable addresses are a deployment concern.
 *
 * Security relies entirely on the application-layer Ed25519 signatures.
 * When Node.js native QUIC (node:quic, Node 24+) becomes stable, this
 * transport should be upgraded to use it for transport-layer encryption.
 */
import * as dgram from "node:dgram"
import { Transport, TransportId, TransportEndpoint } from "./transport"
import { Identity } from "./types"

/** Check if Node.js native QUIC is available (node:quic, Node 24+). */
function isNativeQuicAvailable(): boolean {
  try {
    require("node:quic")
    return true
  } catch {
    return false
  }
}

export class UDPTransport implements Transport {
  readonly id: TransportId = "quic"
  private _address: string = ""
  private _port: number = 0
  private _active: boolean = false
  private _socket: dgram.Socket | null = null
  private _handlers: Array<(from: string, data: Buffer) => void> = []
  private _publicEndpoint: { address: string; port: number } | null = null
  private _useNativeQuic: boolean = false

  get address(): string {
    return this._address
  }

  get publicEndpoint() {
    return this._publicEndpoint
  }

  async start(identity: Identity, opts?: Record<string, unknown>): Promise<boolean> {
    const port = (opts?.quicPort as number) ?? 8098
    const testMode = (opts?.testMode as boolean) ?? false
    const advertiseAddress = (opts?.advertiseAddress as string | undefined) ?? process.env.ADVERTISE_ADDRESS
    const advertisePort = (opts?.advertisePort as number | undefined)
      ?? (process.env.ADVERTISE_PORT ? parseInt(process.env.ADVERTISE_PORT, 10) : undefined)

    // Check for native QUIC support first
    this._useNativeQuic = isNativeQuicAvailable()
    if (this._useNativeQuic) {
      console.log("[transport:quic] Native QUIC available (node:quic)")
    }

    try {
      // Create UDP socket for QUIC transport
      this._socket = dgram.createSocket("udp6")

      await new Promise<void>((resolve, reject) => {
        this._socket!.on("error", reject)
        this._socket!.bind(port, "::", () => {
          this._socket!.removeListener("error", reject)
          resolve()
        })
      })

      const actualPort = this._socket.address().port
      this._port = actualPort

      // Set up message handler
      this._socket.on("message", (msg, rinfo) => {
        const from = rinfo.address.includes(":") ? `[${rinfo.address}]:${rinfo.port}` : `${rinfo.address}:${rinfo.port}`
        for (const h of this._handlers) {
          h(from, msg)
        }
      })

      // Use explicit advertise address if configured
      if (!testMode && advertiseAddress) {
        const effPort = advertisePort ?? actualPort
        const isIpv6 = advertiseAddress.includes(":") && !advertiseAddress.includes(".")
        this._address = isIpv6 ? `[${advertiseAddress}]:${effPort}` : `${advertiseAddress}:${effPort}`
        this._publicEndpoint = { address: advertiseAddress, port: effPort }
        console.log(`[transport:quic] Advertised endpoint: ${this._address}`)
      }

      // Fallback to local loopback (no auto-detection)
      if (!this._address) {
        this._address = `[::1]:${actualPort}`
        if (!testMode) {
          console.log(`[transport:quic] Local endpoint: ${this._address} (set ADVERTISE_ADDRESS for public reachability)`)
        }
      }

      this._active = true
      console.log(`[transport:quic] Listening on UDP port ${actualPort}`)
      return true
    } catch (err: any) {
      console.warn(`[transport:quic] Failed to start: ${err?.message}`)
      return false
    }
  }

  async stop(): Promise<void> {
    this._active = false
    if (this._socket) {
      this._socket.close()
      this._socket = null
    }
  }

  isActive(): boolean {
    return this._active
  }

  async send(target: string, data: Buffer): Promise<void> {
    if (!this._socket || !this._active) {
      throw new Error("QUIC transport not active")
    }

    const { host, port } = parseHostPort(target)

    return new Promise((resolve, reject) => {
      this._socket!.send(data, 0, data.length, port, host, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  onMessage(handler: (from: string, data: Buffer) => void): void {
    this._handlers.push(handler)
  }

  getEndpoint(): TransportEndpoint {
    return {
      transport: "quic",
      address: this._address,
      port: this._port,
      priority: 0,
      ttl: 3600,
    }
  }
}

/** Parse a host:port or [host]:port string. */
function parseHostPort(addr: string): { host: string; port: number } {
  // [ipv6]:port format
  const bracketMatch = addr.match(/^\[([^\]]+)\]:(\d+)$/)
  if (bracketMatch) {
    return { host: bracketMatch[1], port: parseInt(bracketMatch[2], 10) }
  }
  // host:port (IPv4 or hostname)
  const lastColon = addr.lastIndexOf(":")
  if (lastColon > 0) {
    return {
      host: addr.slice(0, lastColon),
      port: parseInt(addr.slice(lastColon + 1), 10),
    }
  }
  throw new Error(`Invalid address format: ${addr}`)
}

export { parseHostPort, isNativeQuicAvailable }
