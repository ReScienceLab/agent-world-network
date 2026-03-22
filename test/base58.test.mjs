import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { base58Encode } from "../packages/agent-world-sdk/dist/identity.js"

const encodeCases = [
  { bytes: [0], encoded: "1" },
  { bytes: [0, 0], encoded: "11" },
  { bytes: [0, 1], encoded: "12" },
  { bytes: [1], encoded: "2" },
  { bytes: [1, 0], encoded: "5R" },
]

describe("base58Encode", () => {
  for (const { bytes, encoded } of encodeCases) {
    it(`encodes [${bytes.join(",")}] as ${encoded}`, () => {
      assert.equal(base58Encode(Buffer.from(bytes)), encoded)
    })
  }
})
