use std::collections::HashMap;

use crate::protocol::EdgeStatEntry;

const MAX_HOSTS: usize = 500;
const MAX_DURATION_SAMPLES: usize = 5000;

#[derive(Default)]
struct HostBucket {
    requests: u64,
    status_4xx: u64,
    status_5xx: u64,
    durations_ms: Vec<f64>,
}

#[derive(Default)]
pub struct EdgeAggregator {
    hosts: HashMap<String, HostBucket>,
}

impl EdgeAggregator {
    pub fn add_line(&mut self, line: &str) {
        let Some((host, status, duration_ms)) = parse_access_line(line) else {
            return;
        };
        if !self.hosts.contains_key(&host) && self.hosts.len() >= MAX_HOSTS {
            return;
        }
        let bucket = self.hosts.entry(host).or_default();
        bucket.requests += 1;
        match status {
            400..=499 => bucket.status_4xx += 1,
            500..=599 => bucket.status_5xx += 1,
            _ => {}
        }
        if bucket.durations_ms.len() < MAX_DURATION_SAMPLES {
            bucket.durations_ms.push(duration_ms);
        }
    }

    pub fn drain(&mut self) -> Vec<EdgeStatEntry> {
        std::mem::take(&mut self.hosts)
            .into_iter()
            .map(|(domain, mut bucket)| {
                bucket.durations_ms.sort_by(|a, b| a.total_cmp(b));
                EdgeStatEntry {
                    domain,
                    requests: bucket.requests,
                    status_4xx: bucket.status_4xx,
                    status_5xx: bucket.status_5xx,
                    p95_ms: percentile(&bucket.durations_ms, 95),
                }
            })
            .collect()
    }
}

fn percentile(sorted: &[f64], pct: usize) -> u64 {
    if sorted.is_empty() {
        return 0;
    }
    let rank = (sorted.len() * pct).div_ceil(100).max(1);
    sorted[rank - 1].round() as u64
}

fn parse_access_line(line: &str) -> Option<(String, u16, f64)> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    if !value.get("logger")?.as_str()?.starts_with("http.log.access") {
        return None;
    }
    let status = value.get("status")?.as_u64()?;
    if !(100..600).contains(&status) {
        return None;
    }
    let host = value.get("request")?.get("host")?.as_str()?;
    let host = host
        .rsplit_once(':')
        .filter(|(_, port)| port.chars().all(|c| c.is_ascii_digit()))
        .map_or(host, |(name, _)| name)
        .to_ascii_lowercase();
    if host.is_empty() || host.len() > 253 {
        return None;
    }
    let seconds = value.get("duration")?.as_f64()?;
    Some((host, status as u16, (seconds * 1000.0).max(0.0)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(host: &str, status: u16, duration: f64) -> String {
        format!(
            r#"{{"level":"info","logger":"http.log.access.access","msg":"handled request","request":{{"method":"GET","host":"{host}"}},"duration":{duration},"status":{status}}}"#
        )
    }

    fn entry(entries: &[EdgeStatEntry], domain: &str) -> EdgeStatEntry {
        entries.iter().find(|e| e.domain == domain).cloned().expect("domain present")
    }

    #[test]
    fn counts_requests_and_error_classes_per_domain() {
        let mut agg = EdgeAggregator::default();
        for status in [200, 200, 404, 500, 503] {
            agg.add_line(&line("a.example.com", status, 0.01));
        }
        agg.add_line(&line("b.example.com", 200, 0.02));
        let out = agg.drain();
        let a = entry(&out, "a.example.com");
        assert_eq!((a.requests, a.status_4xx, a.status_5xx), (5, 1, 2));
        assert_eq!(entry(&out, "b.example.com").requests, 1);
    }

    #[test]
    fn drain_resets_the_window() {
        let mut agg = EdgeAggregator::default();
        agg.add_line(&line("a.example.com", 200, 0.01));
        assert_eq!(agg.drain().len(), 1);
        assert!(agg.drain().is_empty());
    }

    #[test]
    fn p95_is_the_nearest_rank_in_milliseconds() {
        let mut agg = EdgeAggregator::default();
        for index in 1..=100 {
            agg.add_line(&line("a.example.com", 200, f64::from(index) / 1000.0));
        }
        assert_eq!(entry(&agg.drain(), "a.example.com").p95_ms, 95);
    }

    #[test]
    fn ignores_everything_that_is_not_a_real_answered_request() {
        let mut agg = EdgeAggregator::default();
        agg.add_line("not json");
        agg.add_line(r#"{"logger":"tls.obtain","msg":"obtaining certificate"}"#);
        agg.add_line(&line("a.example.com", 0, 0.01));
        assert!(agg.drain().is_empty());
    }

    #[test]
    fn normalises_the_host_and_never_keeps_more_than_a_cap_of_them() {
        let mut agg = EdgeAggregator::default();
        agg.add_line(&line("A.Example.com:8443", 200, 0.01));
        assert_eq!(agg.drain()[0].domain, "a.example.com");
        for index in 0..(MAX_HOSTS + 50) {
            agg.add_line(&line(&format!("scan{index}.example.com"), 404, 0.01));
        }
        assert_eq!(agg.drain().len(), MAX_HOSTS);
    }
}
