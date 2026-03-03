import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isYggdrasilAddr } from "../dist/peer-server.js";

describe("isYggdrasilAddr", () => {
  // Valid Yggdrasil addresses (200::/7 = 0200-03ff first 2 bytes)
  const valid = [
    "200:697f:bda:1e8e:706a:6c5e:630b:51d",   // compressed, our bootstrap
    "202:adbc:dde1:e272:1cdb:97d0:8756:4f77",  // 202: prefix
    "201:5bff:fc61:a4d7:e753:a40f:bdf7:8135",  // 201: prefix
    "2ff:aaaa:bbbb:cccc:dddd:eeee:ffff:1111",  // upper bound of 2xx:
  ];

  const invalid = [
    "fe80::1",                                   // link-local
    "fd00:dead:beef::1",                         // ULA
    "::1",                                       // loopback
    "192.168.1.1",                               // IPv4
    "::ffff:192.168.1.1",                        // IPv4-mapped
    "400:1234:5678:9abc:def0:1234:5678:9abc",   // outside range
    "100:1234:5678:9abc:def0:1234:5678:9abc",   // outside range
    "300:1234:5678:9abc:def0:1234:5678:9abc",   // outside 2xx range
  ];

  for (const addr of valid) {
    it(`accepts ${addr}`, () => {
      assert.equal(isYggdrasilAddr(addr), true);
    });
  }

  for (const addr of invalid) {
    it(`rejects ${addr}`, () => {
      assert.equal(isYggdrasilAddr(addr), false);
    });
  }

  it("strips ::ffff: prefix before matching", () => {
    assert.equal(isYggdrasilAddr("::ffff:200:1234:5678::1"), true);
  });
});
