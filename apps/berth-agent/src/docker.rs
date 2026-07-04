use std::collections::{HashMap, HashSet};
use std::process::Stdio;

use tokio::process::Command;

use crate::protocol::{FailedApply, RestartPolicy, ServiceSource, ServiceSpec, ServiceState};

pub const LABEL_MANAGED: &str = "berth.managed";
pub const LABEL_SERVICE_ID: &str = "berth.service_id";
pub const LABEL_SPEC_HASH: &str = "berth.spec_hash";

pub type AgentResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

#[derive(Clone, Debug)]
pub struct DockerReconciler {
    docker_bin: String,
}

#[derive(Debug, Clone)]
pub struct ReconcileOutcome {
    pub applied: Vec<String>,
    pub failed: Vec<FailedApply>,
    pub statuses: Vec<ServiceStatusEvent>,
}

#[derive(Debug, Clone)]
pub struct ServiceStatusEvent {
    pub service_id: String,
    pub state: ServiceState,
    pub container_id: Option<String>,
}

#[derive(Debug, Clone)]
struct ManagedContainer {
    id: String,
    name: String,
    service_id: String,
    spec_hash: Option<String>,
    state: ServiceState,
}

impl DockerReconciler {
    pub fn new(docker_bin: impl Into<String>) -> Self {
        Self {
            docker_bin: docker_bin.into(),
        }
    }

    pub async fn reconcile(&self, desired: &[ServiceSpec]) -> AgentResult<ReconcileOutcome> {
        let mut current = self.list_managed_containers().await?;
        let mut current_by_service = HashMap::new();

        for container in current.drain(..) {
            current_by_service.insert(container.service_id.clone(), container);
        }

        let mut applied = Vec::new();
        let mut failed = Vec::new();
        let mut statuses = Vec::new();
        let desired_ids: HashSet<String> = desired.iter().map(|spec| spec.id.clone()).collect();

        for spec in desired {
            if let Err(reason) = crate::validators::validate_spec(spec) {
                failed.push(FailedApply {
                    service_id: spec.id.clone(),
                    reason,
                });
                statuses.push(ServiceStatusEvent {
                    service_id: spec.id.clone(),
                    state: ServiceState::Crashed,
                    container_id: None,
                });
                current_by_service.remove(&spec.id);
                continue;
            }

            let spec_hash = spec_hash(spec)?;

            match &spec.source {
                ServiceSource::Image { image, tag } => {
                    let existing = current_by_service.remove(&spec.id);
                    let should_replace = existing
                        .as_ref()
                        .map(|container| {
                            container.spec_hash.as_deref() != Some(spec_hash.as_str())
                                || !matches!(container.state, ServiceState::Running)
                        })
                        .unwrap_or(true);

                    if should_replace {
                        if let Some(container) = existing.as_ref() {
                            self.remove_container(&container.name).await?;
                        }

                        self.pull_image(image, tag).await?;
                        let container_id = self.run_service(spec, &spec_hash).await?;

                        applied.push(spec.id.clone());
                        statuses.push(ServiceStatusEvent {
                            service_id: spec.id.clone(),
                            state: ServiceState::Running,
                            container_id: Some(container_id),
                        });
                    } else if let Some(container) = existing {
                        applied.push(spec.id.clone());
                        statuses.push(ServiceStatusEvent {
                            service_id: spec.id.clone(),
                            state: container.state,
                            container_id: Some(container.id),
                        });
                    }
                }
                ServiceSource::Git { .. } => {
                    failed.push(FailedApply {
                        service_id: spec.id.clone(),
                        reason: "git sources are not implemented yet".to_string(),
                    });
                    statuses.push(ServiceStatusEvent {
                        service_id: spec.id.clone(),
                        state: ServiceState::Crashed,
                        container_id: None,
                    });
                }
            }
        }

        for (service_id, container) in current_by_service {
            if desired_ids.contains(&service_id) {
                continue;
            }

            self.remove_container(&container.name).await?;
            statuses.push(ServiceStatusEvent {
                service_id,
                state: ServiceState::Stopped,
                container_id: None,
            });
        }

        Ok(ReconcileOutcome {
            applied,
            failed,
            statuses,
        })
    }

    pub async fn remove_service(&self, service_id: &str) -> AgentResult<bool> {
        let containers = self.list_managed_containers().await?;

        for container in containers {
            if container.service_id == service_id {
                self.remove_container(&container.name).await?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    async fn list_managed_containers(&self) -> AgentResult<Vec<ManagedContainer>> {
        let output = self
            .docker(&[
                "ps",
                "-a",
                "--filter",
                &format!("label={LABEL_MANAGED}=true"),
                "--format",
                "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Labels}}",
            ])
            .await?;

        let mut containers = Vec::new();

        for line in output.lines().filter(|line| !line.trim().is_empty()) {
            let mut parts = line.splitn(4, '\t');
            let id = parts.next().unwrap_or_default().trim().to_string();
            let name = parts.next().unwrap_or_default().trim().to_string();
            let status = parts.next().unwrap_or_default().trim().to_string();
            let labels = parse_labels(parts.next().unwrap_or_default());

            let Some(service_id) = labels.get(LABEL_SERVICE_ID).cloned() else {
                continue;
            };

            containers.push(ManagedContainer {
                id,
                name,
                service_id,
                spec_hash: labels.get(LABEL_SPEC_HASH).cloned(),
                state: docker_status_to_state(&status),
            });
        }

        Ok(containers)
    }

    async fn pull_image(&self, image: &str, tag: &str) -> AgentResult<()> {
        self.docker_stream(&["pull", &format!("{image}:{tag}")]).await
    }

    async fn run_service(&self, spec: &ServiceSpec, spec_hash: &str) -> AgentResult<String> {
        let image_ref = match &spec.source {
            ServiceSource::Image { image, tag } => format!("{image}:{tag}"),
            ServiceSource::Git { .. } => {
                return Err("git sources are not implemented yet".into());
            }
        };

        for volume in &spec.volumes {
            self.ensure_volume(&volume.name).await?;
        }

        let mut args = vec![
            "run".to_string(),
            "-d".to_string(),
            "--name".to_string(),
            container_name(&spec.id),
            "--label".to_string(),
            format!("{LABEL_MANAGED}=true"),
            "--label".to_string(),
            format!("{LABEL_SERVICE_ID}={}", spec.id),
            "--label".to_string(),
            format!("{LABEL_SPEC_HASH}={spec_hash}"),
            "--restart".to_string(),
            restart_policy_flag(&spec.restart_policy).to_string(),
            "--cpus".to_string(),
            spec.resources.cpu_cores.to_string(),
            "--memory".to_string(),
            format!("{}m", spec.resources.memory_mb),
        ];

        if let Some(cpu_shares) = spec.resources.cpu_shares {
            args.push("--cpu-shares".to_string());
            args.push(cpu_shares.to_string());
        }

        if let Some(pids_limit) = spec.resources.pids_limit {
            args.push("--pids-limit".to_string());
            args.push(pids_limit.to_string());
        }

        for env_var in &spec.env {
            args.push("-e".to_string());
            args.push(format!("{}={}", env_var.key, env_var.value));
        }

        for volume in &spec.volumes {
            args.push("-v".to_string());
            args.push(format!("{}:{}", volume.name, volume.mount_path));
        }

        for port in &spec.ports {
            if port.public && port.domain.is_none() {
                args.push("-p".to_string());
                args.push(format!("{}:{}", port.container_port, port.container_port));
            }
        }

        args.push(image_ref);

        let owned_args: Vec<&str> = args.iter().map(String::as_str).collect();
        let output = self.docker(&owned_args).await?;

        Ok(output.lines().next().unwrap_or_default().trim().to_string())
    }

    async fn ensure_volume(&self, name: &str) -> AgentResult<()> {
        let inspect = Command::new(&self.docker_bin)
            .args(["volume", "inspect", name])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?;

        if inspect.success() {
            return Ok(());
        }

        self.docker_stream(&["volume", "create", name]).await
    }

    async fn remove_container(&self, name: &str) -> AgentResult<()> {
        self.docker_stream(&["rm", "-f", name]).await
    }

    async fn docker(&self, args: &[&str]) -> AgentResult<String> {
        let output = Command::new(&self.docker_bin)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if output.status.success() {
            return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }

        Err(format!(
            "docker {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        )
        .into())
    }

    async fn docker_stream(&self, args: &[&str]) -> AgentResult<()> {
        let status = Command::new(&self.docker_bin)
            .args(args)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .status()
            .await?;

        if status.success() {
            return Ok(());
        }

        Err(format!("docker {} failed with status {status}", args.join(" ")).into())
    }
}

fn container_name(service_id: &str) -> String {
    format!("berth-{service_id}")
}

fn restart_policy_flag(policy: &RestartPolicy) -> &'static str {
    match policy {
        RestartPolicy::No => "no",
        RestartPolicy::OnFailure => "on-failure",
        RestartPolicy::Always => "always",
        RestartPolicy::UnlessStopped => "unless-stopped",
    }
}

fn parse_labels(input: &str) -> HashMap<String, String> {
    let mut labels = HashMap::new();

    for pair in input.split(',').filter(|item| !item.trim().is_empty()) {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or_default().trim();
        let value = parts.next().unwrap_or_default().trim();
        if !key.is_empty() {
            labels.insert(key.to_string(), value.to_string());
        }
    }

    labels
}

fn docker_status_to_state(status: &str) -> ServiceState {
    let lower = status.to_ascii_lowercase();

    if lower.starts_with("up") {
        ServiceState::Running
    } else if lower.starts_with("created") || lower.starts_with("restarting") {
        ServiceState::Starting
    } else if lower.contains("exited (0)") {
        ServiceState::Stopped
    } else if lower.contains("exited") {
        ServiceState::Crashed
    } else {
        ServiceState::Stopped
    }
}

fn spec_hash(spec: &ServiceSpec) -> AgentResult<String> {
    let json = serde_json::to_string(spec)?;
    let mut hash = 1469598103934665603_u64;

    for byte in json.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1099511628211);
    }

    Ok(format!("{hash:016x}"))
}
