import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import * as os from "node:os"
import * as fs from "node:fs"
import * as path from "node:path"

const nacl = (await import("tweetnacl")).default

// Import from dist
const { startPeerServer, stopPeerServer } = await import("../dist/peer-server.js")
const { initDb } = await import("../dist/peer-db.js")
const { signMessage, agentIdFromPublicKey } = await import("../dist/identity.js")

function makeKeypair() {
  const kp = nacl.sign.keyPair()
  const pubB64 = Buffer.from(kp.publicKey).toString("base64")
  const privB64 = Buffer.from(kp.secretKey.slice(0, 32)).toString("base64")
  const agentId = agentIdFromPublicKey(pubB64)
  return { publicKey: pubB64, privateKey: privB64, agentId }
}

function signRotation(privB64, payload) {
  return signMessage(privB64, payload)
}

describe("key rotation endpoint", () => {
  let port
  let tmpDir

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dap-kr-test-"))
    initDb(tmpDir)
    port = 18099
    await startPeerServer(port, { testMode: true })
  })

  after(async () => {
    await stopPeerServer()
    fs.rmSync(tmpDir, { recursive: true })
  })

  test("accepts valid key rotation", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()

    const payload = {
      agentId: oldKey.agentId,
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      ...payload,
      signatureByOldKey: signRotation(oldKey.privateKey, payload),
      signatureByNewKey: signRotation(newKey.privateKey, payload),
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 200)
    const json = await resp.json()
    assert.equal(json.ok, true)
  })

  test("rejects invalid old key signature", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()
    const wrongKey = makeKeypair()

    const payload = {
      agentId: oldKey.agentId,
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      ...payload,
      signatureByOldKey: signRotation(wrongKey.privateKey, payload), // wrong!
      signatureByNewKey: signRotation(newKey.privateKey, payload),
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 403)
  })

  test("rejects mismatched agentId", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()
    const otherKey = makeKeypair()

    const payload = {
      agentId: otherKey.agentId, // doesn't match oldPublicKey
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      ...payload,
      signatureByOldKey: signRotation(oldKey.privateKey, payload),
      signatureByNewKey: signRotation(newKey.privateKey, payload),
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 400)
  })

  test("rejects key-loss recovery — TOFU binding mismatch", async () => {
    const tofuKey = makeKeypair()
    const unrelatedOldKey = makeKeypair()
    const newKey = makeKeypair()

    // First, establish TOFU for tofuKey by sending a message
    const msgPayload = {
      from: tofuKey.agentId,
      publicKey: tofuKey.publicKey,
      event: "ping",
      content: "hello",
      timestamp: Date.now(),
    }
    await fetch(`http://[::1]:${port}/peer/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...msgPayload, signature: signRotation(tofuKey.privateKey, msgPayload) }),
    })

    // Now try to rotate with a different oldPublicKey (simulating key-loss)
    const rotPayload = {
      agentId: tofuKey.agentId,
      oldPublicKey: unrelatedOldKey.publicKey, // not the TOFU-cached key
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }
    const body = {
      ...rotPayload,
      signatureByOldKey: signRotation(unrelatedOldKey.privateKey, rotPayload),
      signatureByNewKey: signRotation(newKey.privateKey, rotPayload),
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    // Should fail because agentIdFromPublicKey(unrelatedOldKey) !== tofuKey.agentId
    assert.ok([400, 403].includes(resp.status), `Expected 400 or 403, got ${resp.status}`)
  })
})

describe("key rotation endpoint — AgentWire v0.2 structured format", () => {
  let port
  let tmpDir

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dap-kr-v2-test-"))
    initDb(tmpDir)
    port = 18101
    await startPeerServer(port, { testMode: true })
  })

  after(async () => {
    await stopPeerServer()
    fs.rmSync(tmpDir, { recursive: true })
  })

  function pubToMultibase(pubB64) {
    const pubBytes = Buffer.from(pubB64, "base64")
    const prefix = Buffer.from([0xed, 0x01])
    const prefixed = Buffer.concat([prefix, pubBytes])
    // Base58 encode
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    const digits = [0]
    for (const byte of prefixed) {
      let carry = byte
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] << 8
        digits[j] = carry % 58
        carry = (carry / 58) | 0
      }
      while (carry > 0) {
        digits.push(carry % 58)
        carry = (carry / 58) | 0
      }
    }
    let str = ""
    for (let i = 0; i < prefixed.length && prefixed[i] === 0; i++) str += "1"
    for (let i = digits.length - 1; i >= 0; i--) str += ALPHABET[digits[i]]
    return `z${str}`
  }

  test("accepts valid v0.2 structured key rotation", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()

    const signable = {
      agentId: oldKey.agentId,
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      type: "key-rotation",
      version: "0.2",
      oldIdentity: {
        agentId: oldKey.agentId,
        kid: "#identity",
        publicKeyMultibase: pubToMultibase(oldKey.publicKey),
      },
      newIdentity: {
        agentId: newKey.agentId,
        kid: "#identity",
        publicKeyMultibase: pubToMultibase(newKey.publicKey),
      },
      timestamp: signable.timestamp,
      proofs: {
        signedByOld: signRotation(oldKey.privateKey, signable),
        signedByNew: signRotation(newKey.privateKey, signable),
      },
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 200)
    const json = await resp.json()
    assert.equal(json.ok, true)
  })

  test("rejects v0.2 rotation with invalid old key proof", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()
    const wrongKey = makeKeypair()

    const signable = {
      agentId: oldKey.agentId,
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      type: "key-rotation",
      version: "0.2",
      oldIdentity: {
        agentId: oldKey.agentId,
        kid: "#identity",
        publicKeyMultibase: pubToMultibase(oldKey.publicKey),
      },
      newIdentity: {
        agentId: newKey.agentId,
        kid: "#identity",
        publicKeyMultibase: pubToMultibase(newKey.publicKey),
      },
      timestamp: signable.timestamp,
      proofs: {
        signedByOld: signRotation(wrongKey.privateKey, signable), // wrong signer
        signedByNew: signRotation(newKey.privateKey, signable),
      },
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 403)
  })

  test("rejects v0.2 rotation missing required fields", async () => {
    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "key-rotation", version: "0.2" }),
    })
    assert.equal(resp.status, 400)
  })
})
