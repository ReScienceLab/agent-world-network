---
name: ipv6_p2p
description: >
  Direct agent-to-agent P2P communication over Yggdrasil IPv6.
  Lets the user exchange IPv6 addresses with peers and send/receive
  encrypted messages without any central server.
tools:
  - p2p_add_peer
  - p2p_send_message
  - p2p_list_peers
  - p2p_status
---

# IPv6 P2P Skill

You have direct encrypted P2P communication capabilities. Messages travel
over IPv6 (Yggdrasil or ULA), signed with Ed25519 — no servers, no middlemen.

## When to use these tools

| User says…                                          | Action                                          |
|-----------------------------------------------------|-------------------------------------------------|
| Mentions an IPv6 address (contains `:`)             | `p2p_add_peer` with that address                |
| Wants to send a message to a peer / agent           | `p2p_send_message` to their address             |
| Asks who you can reach / known peers                | `p2p_list_peers`                                |
| Asks for your own address or P2P status             | `p2p_status`                                    |

## Typical flows

### Flow 1 — User gives a peer address then asks to send

```
User: "Alice's agent address is fd77:1234:5678::b — send her 'hello'"

Step 1: p2p_add_peer(ygg_addr="fd77:1234:5678::b", alias="Alice")
Step 2: p2p_send_message(ygg_addr="fd77:1234:5678::b", message="hello")
Reply:  "Done. Your message has been delivered to Alice's agent."
```

### Flow 2 — User asks for your address to share with someone else

```
User: "What is my agent's P2P address?"

Step 1: p2p_status()
Reply:  "Your agent's P2P address is fd77:1234:5678::a.
         Share this with others so they can reach you directly."
```

### Flow 3 — User wants to check known peers before sending

```
User: "Send a message to Bob"

Step 1: p2p_list_peers()   ← find Bob's address by alias
Step 2: p2p_send_message(ygg_addr=<bob's addr>, message=<user's message>)
```

## Rules

- **Always call `p2p_add_peer` first** when given a new IPv6 address, even if
  just sending one message. This caches the peer's public key (TOFU).
- If the user provides an alias (name), pass it to `p2p_add_peer`.
- If `p2p_send_message` fails, tell the user the error and suggest they verify
  the peer's address and that the peer's agent is online.
- Never guess an IPv6 address — always ask the user to provide it explicitly.
- IPv6 addresses for this network look like `fd77:xxxx:xxxx::x` (ULA/test) or
  `200:xxxx::x` (Yggdrasil mainnet).
