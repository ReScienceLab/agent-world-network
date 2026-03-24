use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Endpoint {
    pub transport: String,
    pub address: String,
    pub port: u16,
    pub priority: i32,
    #[serde(default)]
    pub ttl: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerRecord {
    pub agent_id: String,
    pub public_key: String,
    #[serde(default)]
    pub alias: String,
    #[serde(default)]
    pub endpoints: Vec<Endpoint>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub first_seen: u64,
    #[serde(default)]
    pub last_seen: u64,
    #[serde(default)]
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tofu_cached_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discovered_via: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PeerStore {
    version: u32,
    peers: HashMap<String, PeerRecord>,
}

pub struct PeerDb {
    path: PathBuf,
    store: PeerStore,
    tofu_ttl_ms: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

impl PeerDb {
    pub fn open(data_dir: &Path) -> Self {
        fs::create_dir_all(data_dir).ok();
        let path = data_dir.join("peers.json");
        let store = if path.exists() {
            match fs::read_to_string(&path) {
                Ok(raw) => serde_json::from_str(&raw).unwrap_or(PeerStore {
                    version: 2,
                    peers: HashMap::new(),
                }),
                Err(_) => PeerStore {
                    version: 2,
                    peers: HashMap::new(),
                },
            }
        } else {
            PeerStore {
                version: 2,
                peers: HashMap::new(),
            }
        };
        PeerDb {
            path,
            store,
            tofu_ttl_ms: 7 * 24 * 60 * 60 * 1000,
        }
    }

    pub fn flush(&self) {
        if let Ok(json) = serde_json::to_string_pretty(&self.store) {
            fs::write(&self.path, json).ok();
        }
    }

    pub fn size(&self) -> usize {
        self.store.peers.len()
    }

    pub fn get(&self, agent_id: &str) -> Option<&PeerRecord> {
        self.store.peers.get(agent_id)
    }

    pub fn list(&self) -> Vec<&PeerRecord> {
        let mut peers: Vec<_> = self.store.peers.values().collect();
        peers.sort_by(|a, b| b.last_seen.cmp(&a.last_seen));
        peers
    }

    pub fn upsert(
        &mut self,
        agent_id: &str,
        public_key: &str,
        alias: Option<&str>,
        endpoints: Option<Vec<Endpoint>>,
        capabilities: Option<Vec<String>>,
        source: Option<&str>,
        last_seen: Option<u64>,
    ) {
        let now = now_ms();
        if let Some(existing) = self.store.peers.get_mut(agent_id) {
            if existing.public_key.is_empty() && !public_key.is_empty() {
                existing.public_key = public_key.to_string();
            }
            if let Some(ls) = last_seen {
                existing.last_seen = existing.last_seen.max(ls);
            } else {
                existing.last_seen = now;
            }
            if let Some(a) = alias {
                if existing.source != "manual" {
                    existing.alias = a.to_string();
                }
            }
            if let Some(eps) = endpoints {
                if !eps.is_empty() {
                    existing.endpoints = eps;
                }
            }
            if let Some(caps) = capabilities {
                if !caps.is_empty() {
                    existing.capabilities = caps;
                }
            }
        } else {
            self.store.peers.insert(
                agent_id.to_string(),
                PeerRecord {
                    agent_id: agent_id.to_string(),
                    public_key: public_key.to_string(),
                    alias: alias.unwrap_or("").to_string(),
                    endpoints: endpoints.unwrap_or_default(),
                    capabilities: capabilities.unwrap_or_default(),
                    first_seen: now,
                    last_seen: last_seen.unwrap_or(now),
                    source: source.unwrap_or("gossip").to_string(),
                    version: None,
                    tofu_cached_at: None,
                    discovered_via: None,
                },
            );
        }
    }

    pub fn remove(&mut self, agent_id: &str) -> bool {
        self.store.peers.remove(agent_id).is_some()
    }

    pub fn find_by_capability(&self, cap: &str) -> Vec<&PeerRecord> {
        let is_prefix = cap.ends_with(':');
        let mut matches: Vec<_> = self
            .store
            .peers
            .values()
            .filter(|p| {
                p.capabilities
                    .iter()
                    .any(|c| if is_prefix { c.starts_with(cap) } else { c == cap })
            })
            .collect();
        matches.sort_by(|a, b| b.last_seen.cmp(&a.last_seen));
        matches
    }

    pub fn tofu_verify(&mut self, agent_id: &str, public_key: &str) -> bool {
        let now = now_ms();
        if let Some(existing) = self.store.peers.get_mut(agent_id) {
            if existing.public_key.is_empty() {
                existing.public_key = public_key.to_string();
                existing.tofu_cached_at = Some(now);
                existing.last_seen = now;
                self.flush();
                return true;
            }
            if let Some(cached_at) = existing.tofu_cached_at {
                if now - cached_at > self.tofu_ttl_ms {
                    existing.public_key = public_key.to_string();
                    existing.tofu_cached_at = Some(now);
                    existing.last_seen = now;
                    self.flush();
                    return true;
                }
            }
            if existing.public_key != public_key {
                return false;
            }
            existing.last_seen = now;
            return true;
        }
        // New peer — cache key
        self.store.peers.insert(
            agent_id.to_string(),
            PeerRecord {
                agent_id: agent_id.to_string(),
                public_key: public_key.to_string(),
                alias: String::new(),
                endpoints: vec![],
                capabilities: vec![],
                first_seen: now,
                last_seen: now,
                source: "gossip".to_string(),
                version: None,
                tofu_cached_at: Some(now),
                discovered_via: None,
            },
        );
        self.flush();
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_open_empty() {
        let tmp = TempDir::new().unwrap();
        let db = PeerDb::open(tmp.path());
        assert_eq!(db.size(), 0);
        assert!(db.list().is_empty());
    }

    #[test]
    fn test_upsert_and_get() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:aaa", "pubkey1", Some("Alice"), None, None, None, None);
        assert_eq!(db.size(), 1);
        let peer = db.get("aw:sha256:aaa").unwrap();
        assert_eq!(peer.alias, "Alice");
        assert_eq!(peer.public_key, "pubkey1");
    }

    #[test]
    fn test_upsert_updates_existing() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:aaa", "pk1", Some("Alice"), None, None, None, None);
        let eps = vec![Endpoint {
            transport: "tcp".into(),
            address: "10.0.0.1".into(),
            port: 8099,
            priority: 1,
            ttl: 3600,
        }];
        db.upsert("aw:sha256:aaa", "", Some("Alice Updated"), Some(eps), None, None, None);
        let peer = db.get("aw:sha256:aaa").unwrap();
        assert_eq!(peer.public_key, "pk1"); // not overwritten with empty
        assert_eq!(peer.alias, "Alice Updated");
        assert_eq!(peer.endpoints.len(), 1);
    }

    #[test]
    fn test_remove() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:aaa", "pk1", None, None, None, None, None);
        assert!(db.remove("aw:sha256:aaa"));
        assert_eq!(db.size(), 0);
        assert!(!db.remove("aw:sha256:aaa"));
    }

    #[test]
    fn test_persist_and_reload() {
        let tmp = TempDir::new().unwrap();
        {
            let mut db = PeerDb::open(tmp.path());
            db.upsert("aw:sha256:aaa", "pk1", Some("Alice"), None, None, None, None);
            db.flush();
        }
        let db = PeerDb::open(tmp.path());
        assert_eq!(db.size(), 1);
        let peer = db.get("aw:sha256:aaa").unwrap();
        assert_eq!(peer.alias, "Alice");
    }

    #[test]
    fn test_find_by_capability_exact() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:aaa", "pk1", None, None, Some(vec!["world:arena".into()]), None, None);
        db.upsert("aw:sha256:bbb", "pk2", None, None, Some(vec!["world:lobby".into()]), None, None);
        let found = db.find_by_capability("world:arena");
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].agent_id, "aw:sha256:aaa");
    }

    #[test]
    fn test_find_by_capability_prefix() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:aaa", "pk1", None, None, Some(vec!["world:arena".into()]), None, None);
        db.upsert("aw:sha256:bbb", "pk2", None, None, Some(vec!["world:lobby".into()]), None, None);
        db.upsert("aw:sha256:ccc", "pk3", None, None, Some(vec!["agent".into()]), None, None);
        let found = db.find_by_capability("world:");
        assert_eq!(found.len(), 2);
    }

    #[test]
    fn test_list_sorted_by_last_seen() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:old", "pk1", None, None, None, None, Some(1000));
        db.upsert("aw:sha256:new", "pk2", None, None, None, None, Some(9000));
        db.upsert("aw:sha256:mid", "pk3", None, None, None, None, Some(5000));
        let list = db.list();
        assert_eq!(list[0].agent_id, "aw:sha256:new");
        assert_eq!(list[1].agent_id, "aw:sha256:mid");
        assert_eq!(list[2].agent_id, "aw:sha256:old");
    }

    #[test]
    fn test_tofu_new_peer() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        assert!(db.tofu_verify("aw:sha256:aaa", "pk1"));
        let peer = db.get("aw:sha256:aaa").unwrap();
        assert_eq!(peer.public_key, "pk1");
        assert!(peer.tofu_cached_at.is_some());
    }

    #[test]
    fn test_tofu_same_key_passes() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        assert!(db.tofu_verify("aw:sha256:aaa", "pk1"));
        assert!(db.tofu_verify("aw:sha256:aaa", "pk1"));
    }

    #[test]
    fn test_tofu_different_key_fails() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        assert!(db.tofu_verify("aw:sha256:aaa", "pk1"));
        assert!(!db.tofu_verify("aw:sha256:aaa", "pk2"));
    }

    #[test]
    fn test_tofu_empty_key_accepts() {
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:aaa", "", None, None, None, None, None);
        assert!(db.tofu_verify("aw:sha256:aaa", "pk1"));
        assert_eq!(db.get("aw:sha256:aaa").unwrap().public_key, "pk1");
    }

    #[test]
    fn test_corrupt_file_loads_empty() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("peers.json"), "invalid json").unwrap();
        let db = PeerDb::open(tmp.path());
        assert_eq!(db.size(), 0);
    }

    #[test]
    fn test_ts_format_compatibility() {
        // Verify JSON field names match TS camelCase convention
        let tmp = TempDir::new().unwrap();
        let mut db = PeerDb::open(tmp.path());
        db.upsert("aw:sha256:aaa", "pk1", Some("Test"), None, None, None, None);
        db.flush();
        let raw = fs::read_to_string(tmp.path().join("peers.json")).unwrap();
        assert!(raw.contains("agentId"), "must use camelCase agentId");
        assert!(raw.contains("publicKey"), "must use camelCase publicKey");
        assert!(raw.contains("firstSeen"), "must use camelCase firstSeen");
        assert!(raw.contains("lastSeen"), "must use camelCase lastSeen");
    }
}
