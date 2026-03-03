import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalize, signMessage, verifySignature } from "../dist/identity.js";

describe("canonicalize", () => {
  it("sorts top-level keys", () => {
    const input = { z: 1, a: 2, m: 3 };
    assert.deepEqual(canonicalize(input), { a: 2, m: 3, z: 1 });
    assert.equal(
      JSON.stringify(canonicalize(input)),
      '{"a":2,"m":3,"z":1}'
    );
  });

  it("sorts nested object keys recursively", () => {
    const input = { b: { z: 1, a: 2 }, a: 1 };
    assert.equal(
      JSON.stringify(canonicalize(input)),
      '{"a":1,"b":{"a":2,"z":1}}'
    );
  });

  it("sorts keys inside arrays of objects", () => {
    const input = {
      peers: [
        { yggAddr: "200::1", publicKey: "pk1", lastSeen: 100 },
        { lastSeen: 200, yggAddr: "200::2", publicKey: "pk2" },
      ],
    };
    const result = JSON.stringify(canonicalize(input));
    // Both objects in array should have keys in alphabetical order
    assert.ok(result.includes('"lastSeen":100,"publicKey":"pk1","yggAddr":"200::1"'));
    assert.ok(result.includes('"lastSeen":200,"publicKey":"pk2","yggAddr":"200::2"'));
  });

  it("handles primitives and null", () => {
    assert.equal(canonicalize(42), 42);
    assert.equal(canonicalize("hello"), "hello");
    assert.equal(canonicalize(null), null);
    assert.equal(canonicalize(true), true);
  });

  it("produces identical serialization regardless of key insertion order", () => {
    const a = { fromYgg: "200::1", publicKey: "pk", timestamp: 1, peers: [{ yggAddr: "x", lastSeen: 1 }] };
    const b = { peers: [{ lastSeen: 1, yggAddr: "x" }], timestamp: 1, publicKey: "pk", fromYgg: "200::1" };
    assert.equal(
      JSON.stringify(canonicalize(a)),
      JSON.stringify(canonicalize(b))
    );
  });
});

const nacl = (await import("tweetnacl")).default;

describe("signMessage + verifySignature with nested data", () => {
  const keypair = nacl.sign.keyPair();
  const pubB64 = Buffer.from(keypair.publicKey).toString("base64");
  const privB64 = Buffer.from(keypair.secretKey.slice(0, 32)).toString("base64");

  it("verifies signature on flat object", () => {
    const data = { fromYgg: "200::1", publicKey: pubB64, timestamp: Date.now() };
    const sig = signMessage(privB64, data);
    assert.equal(verifySignature(pubB64, data, sig), true);
  });

  it("verifies signature on object with nested peers array", () => {
    const data = {
      fromYgg: "200::1",
      publicKey: pubB64,
      timestamp: Date.now(),
      peers: [
        { yggAddr: "200::2", publicKey: "pk2", lastSeen: 100 },
        { yggAddr: "200::3", publicKey: "pk3", lastSeen: 200 },
      ],
    };
    const sig = signMessage(privB64, data);
    assert.equal(verifySignature(pubB64, data, sig), true);
  });

  it("verifies even when nested key order differs", () => {
    const dataSign = {
      fromYgg: "200::1",
      publicKey: pubB64,
      timestamp: 999,
      peers: [{ yggAddr: "200::2", publicKey: "pk2", lastSeen: 100 }],
    };
    const sig = signMessage(privB64, dataSign);

    // Verify with different key insertion order
    const dataVerify = {
      peers: [{ lastSeen: 100, yggAddr: "200::2", publicKey: "pk2" }],
      timestamp: 999,
      publicKey: pubB64,
      fromYgg: "200::1",
    };
    assert.equal(verifySignature(pubB64, dataVerify, sig), true);
  });

  it("rejects tampered nested field", () => {
    const data = {
      fromYgg: "200::1",
      publicKey: pubB64,
      timestamp: 999,
      peers: [{ yggAddr: "200::2", publicKey: "pk2", lastSeen: 100 }],
    };
    const sig = signMessage(privB64, data);

    const tampered = {
      ...data,
      peers: [{ yggAddr: "200::EVIL", publicKey: "pk2", lastSeen: 100 }],
    };
    assert.equal(verifySignature(pubB64, tampered, sig), false);
  });
});
