use std::fs;
use std::process::Command;

use crate::protocol::ServerSpecs;

pub fn collect_server_specs() -> ServerSpecs {
    ServerSpecs {
        hostname: hostname(),
        cpu_cores: std::thread::available_parallelism()
            .map(|value| value.get() as u32)
            .unwrap_or(1),
        memory_mb: linux_memory_mb().unwrap_or(0),
        disk_gb: root_disk_gb().unwrap_or(0),
        os: std::env::consts::OS.to_string(),
    }
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            std::env::var("COMPUTERNAME")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .or_else(read_hostname_file)
        .unwrap_or_else(|| "unknown-host".to_string())
}

fn read_hostname_file() -> Option<String> {
    fs::read_to_string("/etc/hostname")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn linux_memory_mb() -> Option<u64> {
    let meminfo = fs::read_to_string("/proc/meminfo").ok()?;

    for line in meminfo.lines() {
        if let Some(rest) = line.strip_prefix("MemTotal:") {
            let kib = rest
                .split_whitespace()
                .next()
                .and_then(|value| value.parse::<u64>().ok())?;
            return Some(kib / 1024);
        }
    }

    None
}

fn root_disk_gb() -> Option<u64> {
    let output = Command::new("df").args(["-k", "/"]).output().ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().nth(1)?;
    let available_kib = line
        .split_whitespace()
        .nth(3)
        .and_then(|value| value.parse::<u64>().ok())?;

    Some(available_kib / 1024 / 1024)
}
