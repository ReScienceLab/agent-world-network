# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1] - 2026-03-03

### Added

- Auto-detect Yggdrasil for `test_mode`: tri-state `"auto"` (default) detects external daemon automatically.
- Auto-inject public peers into system Yggdrasil when only LAN/multicast peers are present.
- Enriched `yggdrasil_check` tool with peer count and routing table size.
- Factory hooks for session management and command safety checks.
- `AGENTS.md` for AI coding agent context, including release process documentation.
- `CHANGELOG.md` for tracking project changes.

### Changed

- Parallelized bootstrap node connections (worst-case 150s → 30s).
- Debounced peer-db disk writes during discovery (1s coalescing).
- Added `os` and `requires.bins` to skill frontmatter for ClawHub security scan.

### Fixed

- Omit `undefined` alias field from announce payload to prevent canonicalization mismatches.

## [0.2.0] - 2026-03-03

### Breaking Changes

- Renamed channel ID from `ipv6-p2p` to `declaw`.
- Renamed service ID from `ipv6-p2p-node` to `declaw-node`.
- Default data directory changed from `~/.openclaw/ipv6-p2p` to `~/.openclaw/declaw`.
- Old `ipv6-p2p` name preserved as a channel alias for backward compatibility.

### Changed

- Merged `ipv6-p2p` and `yggdrasil` skills into a single `declaw` skill.
- Channel label changed from "IPv6 P2P" to "DeClaw".

### Added

- Complete skill documentation: all tool parameters, error handling table, inbound message flow explanation.
- `references/discovery.md` — bootstrap + gossip architecture and trust model.
- Troubleshooting section for `derived_only` state (PATH, permissions, Docker `NET_ADMIN`).
- Eight example interaction flows including diagnostics, non-default port, and first-time user.

## [0.1.2] - 2026-03-03

### Fixed

- Upgraded main plugin Fastify from 4.x to 5.7.4, resolving high-severity vulnerabilities.
- Upgraded bootstrap service Fastify from `^4.26.2` to `^5.0.0` (resolves to 5.7.4).
- Added `bootstrap/package-lock.json` for reproducible installs.
- Fixed recursive key sorting in signature canonicalization (`identity.ts`).
- Fixed `isYggdrasilAddr` regex to correctly match compressed IPv6 addresses like `200:` and `202:` (`peer-server.ts`).
- Clear startup discovery timer on service stop to prevent dangling callbacks (`index.ts`).

### Added

- Periodic sibling sync between bootstrap nodes (5-minute interval).

## [0.1.1] - 2026-03-03

### Fixed

- Aligned plugin ID in `openclaw.plugin.json` to match npm package name.
- Signature verification mismatch between announce and message endpoints.
- Corrected Yggdrasil address regex and added startup delay for route convergence.
- Increased peer exchange timeout from 10s to 30s.

### Added

- DHT-style peer discovery via bootstrap + gossip exchange.
- Standalone bootstrap server with 5 nodes across AWS regions (us-east-2, us-west-2, eu-west-1, ap-northeast-1, ap-southeast-1).
- Fetch bootstrap node list from GitHub Pages (`bootstrap.json`), with hardcoded fallback.
- ClawHub-compatible frontmatter to skills.
- GitHub Actions workflow to publish to npm on release.
- Banner and logo assets.

### Changed

- Renamed project from `claw-p2p` to `DeClaw`.

## [0.1.0] - 2026-03-02

### Added

- Initial release.
- OpenClaw plugin with Ed25519 identity, TOFU peer trust, and Yggdrasil integration.
- Agent tools: `p2p_add_peer`, `p2p_send_message`, `p2p_list_peers`, `p2p_status`, `p2p_discover`, `yggdrasil_check`.
- IPv6 P2P channel registration for OpenClaw chat UI.
- Yggdrasil setup skill with platform-specific install guide.
- Docker P2P test environment.
