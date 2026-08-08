use std::collections::{HashMap, HashSet};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use crate::docker::AgentResult;
use crate::protocol::AgentToPanel;

const METRICS_INTERVAL: Duration = Duration::from_secs(4);
const CONTAINER_PREFIX: &str = "berth-";

/// Streams live container logs and metrics to the panel over an mpsc channel.
/// Owns its background tasks and aborts them on drop (session end).
pub struct Telemetry {
    docker_bin: String,
    tx: mpsc::Sender<AgentToPanel>,
    active_logs: Arc<Mutex<HashSet<String>>>,
    handles: Mutex<Vec<JoinHandle<()>>>,
}

impl Telemetry {
    pub fn new(docker_bin: String, tx: mpsc::Sender<AgentToPanel>) -> Self {
        Self {
            docker_bin,
            tx,
            active_logs: Arc::new(Mutex::new(HashSet::new())),
            handles: Mutex::new(Vec::new()),
        }
    }

    pub fn start_metrics(&self) {
        let docker_bin = self.docker_bin.clone();
        let tx = self.tx.clone();
        let handle = tokio::spawn(async move {
            while !tx.is_closed() {
                if let Err(error) = sample_metrics(&docker_bin, &tx).await {
                    eprintln!("[berth-agent] metrics sample failed: {error}");
                }
                tokio::time::sleep(METRICS_INTERVAL).await;
            }
        });
        self.handles.lock().unwrap().push(handle);
    }

    /// Ensure a `docker logs -f` tailer is running for each currently-running
    /// service. A tailer removes itself when its container goes away, so the
    /// next reconcile re-spawns it against the fresh container.
    pub fn sync_logs(&self, running: &[String]) {
        for service_id in running {
            {
                let mut active = self.active_logs.lock().unwrap();
                if !active.insert(service_id.clone()) {
                    continue;
                }
            }
            let docker_bin = self.docker_bin.clone();
            let tx = self.tx.clone();
            let active = self.active_logs.clone();
            let id = service_id.clone();
            let handle = tokio::spawn(async move {
                if let Err(error) = tail_logs(&docker_bin, &id, &tx).await {
                    eprintln!("[berth-agent] log tail for {id} ended: {error}");
                }
                active.lock().unwrap().remove(&id);
            });
            self.handles.lock().unwrap().push(handle);
        }
    }
}

impl Drop for Telemetry {
    fn drop(&mut self) {
        if let Ok(handles) = self.handles.lock() {
            for handle in handles.iter() {
                handle.abort();
            }
        }
    }
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}

async fn tail_logs(
    docker_bin: &str,
    service_id: &str,
    tx: &mpsc::Sender<AgentToPanel>,
) -> AgentResult<()> {
    let container = format!("{CONTAINER_PREFIX}{service_id}");
    let mut child = Command::new(docker_bin)
        .args(["logs", "-f", "--tail", "40", &container])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().ok_or("log tail: missing stdout")?;
    let stderr = child.stderr.take().ok_or("log tail: missing stderr")?;
    let mut out = BufReader::new(stdout).lines();
    let mut err = BufReader::new(stderr).lines();
    let mut out_open = true;
    let mut err_open = true;

    while out_open || err_open {
        let line = tokio::select! {
            result = out.next_line(), if out_open => match result {
                Ok(Some(line)) => line,
                _ => { out_open = false; continue; }
            },
            result = err.next_line(), if err_open => match result {
                Ok(Some(line)) => line,
                _ => { err_open = false; continue; }
            },
        };
        let event = AgentToPanel::LogChunk {
            service_id: service_id.to_string(),
            line,
            ts: now_millis(),
        };
        if tx.send(event).await.is_err() {
            break;
        }
    }

    let _ = child.kill().await;
    Ok(())
}

async fn sample_metrics(docker_bin: &str, tx: &mpsc::Sender<AgentToPanel>) -> AgentResult<()> {
    let listing = Command::new(docker_bin)
        .args([
            "ps",
            "--filter",
            "label=berth.managed=true",
            "--format",
            "{{.Names}}\t{{.Label \"berth.service_id\"}}",
        ])
        .output()
        .await?;
    if !listing.status.success() {
        return Ok(());
    }

    let mut names = Vec::new();
    let mut by_name: HashMap<String, String> = HashMap::new();
    for line in String::from_utf8_lossy(&listing.stdout).lines() {
        let mut parts = line.splitn(2, '\t');
        let name = parts.next().unwrap_or("").trim();
        let service_id = parts.next().unwrap_or("").trim();
        if name.is_empty() || service_id.is_empty() {
            continue;
        }
        names.push(name.to_string());
        by_name.insert(name.to_string(), service_id.to_string());
    }
    if names.is_empty() {
        return Ok(());
    }

    let mut args = vec![
        "stats".to_string(),
        "--no-stream".to_string(),
        "--format".to_string(),
        "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}".to_string(),
    ];
    args.extend(names);
    let owned: Vec<&str> = args.iter().map(String::as_str).collect();
    let stats = Command::new(docker_bin).args(&owned).output().await?;
    if !stats.status.success() {
        return Ok(());
    }

    for line in String::from_utf8_lossy(&stats.stdout).lines() {
        let mut parts = line.split('\t');
        let name = parts.next().unwrap_or("").trim();
        let cpu = parts.next().unwrap_or("");
        let mem = parts.next().unwrap_or("");
        let net = parts.next().unwrap_or("");
        let Some(service_id) = by_name.get(name) else {
            continue;
        };
        let (rx, txn) = parse_pair_mb(net);
        let event = AgentToPanel::Metrics {
            service_id: service_id.clone(),
            cpu_pct: parse_pct(cpu),
            mem_mb: parse_size_mb(mem.split('/').next().unwrap_or("")),
            net_rx_mb: rx,
            net_tx_mb: txn,
        };
        if tx.send(event).await.is_err() {
            break;
        }
    }
    Ok(())
}

fn parse_pct(value: &str) -> f64 {
    value.trim().trim_end_matches('%').parse().unwrap_or(0.0)
}

fn parse_pair_mb(value: &str) -> (f64, f64) {
    let mut parts = value.split('/');
    let rx = parse_size_mb(parts.next().unwrap_or(""));
    let tx = parse_size_mb(parts.next().unwrap_or(""));
    (rx, tx)
}

fn parse_size_mb(value: &str) -> f64 {
    let value = value.trim();
    let split = value
        .find(|c: char| c.is_alphabetic())
        .unwrap_or(value.len());
    let (number, unit) = value.split_at(split);
    let number: f64 = number.trim().parse().unwrap_or(0.0);
    let bytes = match unit.trim().to_lowercase().as_str() {
        "b" => number,
        "kb" => number * 1_000.0,
        "kib" => number * 1024.0,
        "mb" => number * 1_000_000.0,
        "mib" => number * 1024.0 * 1024.0,
        "gb" => number * 1_000_000_000.0,
        "gib" => number * 1024.0 * 1024.0 * 1024.0,
        "tb" => number * 1_000_000_000_000.0,
        "tib" => number * 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => number,
    };
    bytes / (1024.0 * 1024.0)
}

#[cfg(test)]
mod tests {
    use super::parse_size_mb;

    #[test]
    fn parses_docker_size_units() {
        assert!((parse_size_mb("1MiB") - 1.0).abs() < f64::EPSILON);
        assert!((parse_size_mb("1MB") - 0.953_674_316_406_25).abs() < f64::EPSILON);
        assert!((parse_size_mb("1024kB") - 0.976_562_5).abs() < f64::EPSILON);
        assert!((parse_size_mb("1.5GiB") - 1536.0).abs() < f64::EPSILON);
    }
}
