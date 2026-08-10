use std::collections::{HashMap, HashSet};
use std::process::Stdio;

use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::protocol::{
    FailedApply, PanelRoute, ProxyRoute, RegistryAuth, RestartPolicy, ServiceSource, ServiceSpec,
    ServiceState,
};

pub const LABEL_MANAGED: &str = "berth.managed";
pub const LABEL_SERVICE_ID: &str = "berth.service_id";
pub const LABEL_SPEC_HASH: &str = "berth.spec_hash";
pub const BERTH_NETWORK: &str = "berth";
const CADDY_CONTAINER: &str = "berth-caddy";
const CADDY_CONFIG_DIR: &str = "/var/lib/berth/caddy";
const SFTPGO_CONTAINER: &str = "berth-sftpgo";
const SFTPGO_MINIO_PORT: u16 = 9000;
const SFTPGO_BUCKET_NAME: &str = "bucket";

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

    pub fn docker_bin(&self) -> &str {
        &self.docker_bin
    }

    pub async fn reconcile(
        &self,
        desired: &[ServiceSpec],
        proxies: &[ProxyRoute],
        panel: Option<&PanelRoute>,
        force_service_ids: &[String],
    ) -> AgentResult<ReconcileOutcome> {
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
                    if let Some(container) = existing.as_ref() {
                        self.update_resources(&container.name, spec).await?;
                    }
                    let should_replace = existing
                        .as_ref()
                        .map(|container| {
                            container.spec_hash.as_deref() != Some(spec_hash.as_str())
                                || !matches!(container.state, ServiceState::Running)
                        })
                        .unwrap_or(true)
                        || force_service_ids.iter().any(|id| id == &spec.id);

                    if should_replace {
                        if let Some(container) = existing.as_ref() {
                            self.remove_container(&container.name).await?;
                        }

                        if let Some(auth) = &spec.registry_auth {
                            self.docker_login(auth).await?;
                        }
                        self.pull_image(image, tag).await?;
                        let container_id = self.run_service(spec, &spec_hash, None).await?;

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
                    let existing = current_by_service.remove(&spec.id);
                    if let Some(container) = existing.as_ref() {
                        self.update_resources(&container.name, spec).await?;
                    }
                    let should_replace = existing
                        .as_ref()
                        .map(|container| {
                            container.spec_hash.as_deref() != Some(spec_hash.as_str())
                                || !matches!(container.state, ServiceState::Running)
                        })
                        .unwrap_or(true)
                        || force_service_ids.iter().any(|id| id == &spec.id);
                    if !should_replace {
                        let container = existing.expect("existing container");
                        applied.push(spec.id.clone());
                        statuses.push(ServiceStatusEvent {
                            service_id: spec.id.clone(),
                            state: container.state,
                            container_id: Some(container.id),
                        });
                        continue;
                    }
                    if let Some(container) = existing {
                        self.remove_container(&container.name).await?;
                    }
                    if let Some(auth) = &spec.registry_auth {
                        self.docker_login(auth).await?;
                    }
                    match self.build_git_source(spec, &spec_hash).await {
                        Ok(image) => {
                            let container_id =
                                self.run_service(spec, &spec_hash, Some(&image)).await?;
                            applied.push(spec.id.clone());
                            statuses.push(ServiceStatusEvent {
                                service_id: spec.id.clone(),
                                state: ServiceState::Running,
                                container_id: Some(container_id),
                            });
                        }
                        Err(error) => {
                            failed.push(FailedApply {
                                service_id: spec.id.clone(),
                                reason: redact_credentials(&error.to_string()),
                            });
                            statuses.push(ServiceStatusEvent {
                                service_id: spec.id.clone(),
                                state: ServiceState::Crashed,
                                container_id: None,
                            });
                        }
                    }
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

        if let Err(error) = self.ensure_proxy(proxies, panel).await {
            eprintln!("[berth-agent] proxy reconcile failed: {error}");
        }

        if let Err(error) = self.ensure_sftpgo(desired).await {
            eprintln!("[berth-agent] sftpgo reconcile failed: {error}");
        }

        Ok(ReconcileOutcome {
            applied,
            failed,
            statuses,
        })
    }

    async fn ensure_proxy(
        &self,
        proxies: &[ProxyRoute],
        panel: Option<&PanelRoute>,
    ) -> AgentResult<()> {
        if proxies.is_empty() && panel.is_none() {
            let _ = self.docker(&["rm", "-f", CADDY_CONTAINER]).await;
            return Ok(());
        }

        let config = build_caddy_config(proxies, panel);
        tokio::fs::create_dir_all(CADDY_CONFIG_DIR).await?;
        let config_path = format!("{CADDY_CONFIG_DIR}/caddy.json");
        tokio::fs::write(&config_path, serde_json::to_vec_pretty(&config)?).await?;

        self.ensure_network().await?;

        if self.container_running(CADDY_CONTAINER).await {
            self.docker(&[
                "exec",
                CADDY_CONTAINER,
                "caddy",
                "reload",
                "--config",
                "/etc/berth-caddy/caddy.json",
            ])
            .await?;
            return Ok(());
        }

        let _ = self.docker(&["rm", "-f", CADDY_CONTAINER]).await;
        let mount = format!("{CADDY_CONFIG_DIR}:/etc/berth-caddy");
        self.docker(&[
            "run",
            "-d",
            "--name",
            CADDY_CONTAINER,
            "--label",
            &format!("{LABEL_MANAGED}=true"),
            "--label",
            "berth.role=proxy",
            "--restart",
            "unless-stopped",
            "--network",
            BERTH_NETWORK,
            "-p",
            "80:80",
            "-p",
            "443:443",
            "-p",
            "443:443/udp",
            "-v",
            "berth-caddy-data:/data",
            "-v",
            "berth-caddy-config:/config",
            "-v",
            &mount,
            "--entrypoint",
            "caddy",
            "caddy:2",
            "run",
            "--config",
            "/etc/berth-caddy/caddy.json",
        ])
        .await?;
        Ok(())
    }

    /// Provisions SFTP access for `bucket`-templated services: ensures the
    /// shared `berth-sftpgo` gateway container is running, makes sure each
    /// bucket's MinIO instance actually has a bucket to serve, and syncs one
    /// SFTPGo user per bucket via its REST API (same username/password as
    /// the bucket's S3 credentials).
    async fn ensure_sftpgo(&self, desired: &[ServiceSpec]) -> AgentResult<()> {
        let buckets: Vec<&ServiceSpec> = desired
            .iter()
            .filter(|spec| spec.template_kind.as_deref() == Some("minio"))
            .collect();

        if buckets.is_empty() {
            let _ = self.docker(&["rm", "-f", SFTPGO_CONTAINER]).await;
            return Ok(());
        }

        self.ensure_network().await?;
        let admin_password = crate::sftpgo::ensure_admin_secret().await?;

        if !self.container_running(SFTPGO_CONTAINER).await {
            let _ = self.docker(&["rm", "-f", SFTPGO_CONTAINER]).await;
            self.docker(&[
                "run",
                "-d",
                "--name",
                SFTPGO_CONTAINER,
                "--label",
                &format!("{LABEL_MANAGED}=true"),
                "--label",
                "berth.role=sftpgo",
                "--restart",
                "unless-stopped",
                "--network",
                BERTH_NETWORK,
                "-p",
                "2022:2022",
                "-v",
                "berth-sftpgo-data:/srv/sftpgo/data",
                "-v",
                "berth-sftpgo-config:/var/lib/sftpgo",
                "-e",
                "SFTPGO_DATA_PROVIDER__CREATE_DEFAULT_ADMIN=true",
                "-e",
                &format!("SFTPGO_DEFAULT_ADMIN_USERNAME={}", crate::sftpgo::ADMIN_USERNAME),
                "-e",
                &format!("SFTPGO_DEFAULT_ADMIN_PASSWORD={admin_password}"),
                "drakkan/sftpgo:latest",
            ])
            .await?;
            // Give the API a moment to come up before the first sync below.
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        }

        let mut entries = Vec::new();
        for spec in &buckets {
            let (Some(user), Some(pass)) = (
                env_value(spec, "MINIO_ROOT_USER"),
                env_value(spec, "MINIO_ROOT_PASSWORD"),
            ) else {
                continue;
            };
            let endpoint = format!("http://{}:{SFTPGO_MINIO_PORT}", container_name(&spec.id));

            if let Err(error) = self
                .ensure_bucket(&endpoint, &user, &pass, SFTPGO_BUCKET_NAME)
                .await
            {
                eprintln!(
                    "[berth-agent] sftpgo: bucket create failed for {}: {error}",
                    spec.id
                );
                continue;
            }

            entries.push(crate::sftpgo::BucketUser {
                username: user,
                password: pass,
                endpoint,
                bucket: SFTPGO_BUCKET_NAME.to_string(),
            });
        }

        if let Err(error) = crate::sftpgo::sync_users(&admin_password, &entries).await {
            eprintln!("[berth-agent] sftpgo: user sync failed: {error}");
        }

        Ok(())
    }

    /// Idempotently creates `bucket` inside a bucket service's own MinIO
    /// instance via a one-shot `minio/mc` container — a fresh `minio/minio`
    /// server has no buckets until one is created.
    async fn ensure_bucket(
        &self,
        endpoint: &str,
        user: &str,
        pass: &str,
        bucket: &str,
    ) -> AgentResult<()> {
        let mut alias_url = reqwest::Url::parse(endpoint)?;
        alias_url
            .set_username(user)
            .map_err(|_| "invalid MinIO username")?;
        alias_url
            .set_password(Some(pass))
            .map_err(|_| "invalid MinIO password")?;

        self.docker(&[
            "run",
            "--rm",
            "--network",
            BERTH_NETWORK,
            "-e",
            &format!("MC_HOST_b={alias_url}"),
            "minio/mc",
            "mb",
            "--ignore-existing",
            &format!("b/{bucket}"),
        ])
        .await?;
        Ok(())
    }

    async fn container_running(&self, name: &str) -> bool {
        self.docker(&["inspect", "-f", "{{.State.Running}}", name])
            .await
            .map(|output| output.trim() == "true")
            .unwrap_or(false)
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
        self.docker_stream(&["pull", &format!("{image}:{tag}")])
            .await
    }

    async fn docker_login(&self, auth: &RegistryAuth) -> AgentResult<()> {
        let mut args = vec![
            "login".to_string(),
            "-u".to_string(),
            auth.username.clone(),
            "--password-stdin".to_string(),
        ];
        if !auth.server.is_empty() {
            args.push(auth.server.clone());
        }
        let owned_args: Vec<&str> = args.iter().map(String::as_str).collect();

        let mut child = Command::new(&self.docker_bin)
            .args(&owned_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(auth.password.as_bytes()).await?;
        }

        let output = child.wait_with_output().await?;
        if output.status.success() {
            return Ok(());
        }
        Err(format!(
            "docker login failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )
        .into())
    }

    async fn update_resources(&self, container: &str, spec: &ServiceSpec) -> AgentResult<()> {
        let mut args = vec![
            "update".to_string(),
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
        args.push(container.to_string());
        let owned_args: Vec<&str> = args.iter().map(String::as_str).collect();
        self.docker(&owned_args).await?;
        Ok(())
    }

    async fn run_service(
        &self,
        spec: &ServiceSpec,
        spec_hash: &str,
        built_image: Option<&str>,
    ) -> AgentResult<String> {
        let image_ref = match (&spec.source, built_image) {
            (_, Some(image)) => image.to_string(),
            (ServiceSource::Image { image, tag }, None) => format!("{image}:{tag}"),
            (ServiceSource::Git { .. }, None) => return Err("git source was not built".into()),
        };

        self.ensure_network().await?;

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
            "--network".to_string(),
            BERTH_NETWORK.to_string(),
            "--network-alias".to_string(),
            spec.name.clone(),
        ];
        if let Some(platform) = &spec.target_platform {
            args.splice(1..1, ["--platform".to_string(), platform.clone()]);
        }

        if let Some(cpu_shares) = spec.resources.cpu_shares {
            args.push("--cpu-shares".to_string());
            args.push(cpu_shares.to_string());
        }

        if let Some(pids_limit) = spec.resources.pids_limit {
            args.push("--pids-limit".to_string());
            args.push(pids_limit.to_string());
        }

        for alias in &spec.aliases {
            args.push("--network-alias".to_string());
            args.push(alias.clone());
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
        for part in &spec.command {
            args.push(part.clone());
        }

        let owned_args: Vec<&str> = args.iter().map(String::as_str).collect();
        let output = self.docker(&owned_args).await?;

        Ok(output.lines().next().unwrap_or_default().trim().to_string())
    }

    async fn build_git_source(&self, spec: &ServiceSpec, spec_hash: &str) -> AgentResult<String> {
        let ServiceSource::Git {
            repo,
            branch,
            build,
        } = &spec.source
        else {
            return Err("expected git source".into());
        };
        let work = std::env::temp_dir().join(format!("berth-build-{}", spec.id));
        if work.exists() {
            tokio::fs::remove_dir_all(&work).await?;
        }
        let clone = Command::new("git")
            .args([
                "clone",
                "--depth",
                "1",
                "--single-branch",
                "--branch",
                branch,
                repo,
            ])
            .arg(&work)
            .output()
            .await?;
        if !clone.status.success() {
            return Err(format!(
                "git clone failed: {}",
                String::from_utf8_lossy(&clone.stderr)
            )
            .into());
        }
        let root = build
            .root_directory
            .as_deref()
            .map(|path| work.join(path))
            .unwrap_or(work.clone());
        let image = format!("berth-build-{}:{}", spec.id, spec_hash);
        let dockerfile = build.dockerfile_path.as_deref().unwrap_or("Dockerfile");
        let use_docker = matches!(build.builder, crate::protocol::BuilderKind::Dockerfile)
            || (matches!(build.builder, crate::protocol::BuilderKind::Auto)
                && root.join(dockerfile).exists());
        let status = if use_docker {
            let mut command = Command::new(&self.docker_bin);
            command.args(["build", "-t", &image, "-f", dockerfile]);
            if let Some(platform) = &spec.target_platform {
                command.args(["--platform", platform]);
            }
            if let Some(args) = &build.build_args {
                for (key, value) in args {
                    command.args(["--build-arg", &format!("{key}={value}")]);
                }
            }
            command.arg(".").current_dir(&root).status().await?
        } else {
            let mut command = Command::new("nixpacks");
            command.args(["build", ".", "--name", &image]);
            if let Some(cmd) = build.build_command.as_deref() {
                command.args(["--build-cmd", cmd]);
            }
            if let Some(cmd) = build.start_command.as_deref() {
                command.args(["--start-cmd", cmd]);
            }
            command.current_dir(&root).status().await?
        };
        let _ = tokio::fs::remove_dir_all(&work).await;
        if !status.success() {
            return Err("application image build failed".into());
        }
        Ok(image)
    }

    async fn ensure_network(&self) -> AgentResult<()> {
        let inspect = Command::new(&self.docker_bin)
            .args(["network", "inspect", BERTH_NETWORK])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?;

        if inspect.success() {
            return Ok(());
        }

        self.docker_stream(&["network", "create", BERTH_NETWORK])
            .await
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

fn env_value(spec: &ServiceSpec, key: &str) -> Option<String> {
    spec.env
        .iter()
        .find(|item| item.key == key)
        .map(|item| item.value.clone())
}

fn redact_credentials(message: &str) -> String {
    if let Some(at) = message.find("@github.com") {
        if let Some(start) = message[..at].rfind("https://") {
            return format!("{}https://***{}", &message[..start], &message[at..]);
        }
    }
    message.to_string()
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
    let mut stable = spec.clone();
    // Resource limits are applied live with `docker update`; changing them
    // must not rebuild images or recreate otherwise healthy containers.
    stable.resources.cpu_cores = 0.0;
    stable.resources.memory_mb = 0;
    stable.resources.cpu_shares = None;
    stable.resources.pids_limit = None;
    if let ServiceSource::Git { repo, .. } = &mut stable.source {
        if let Some((_, suffix)) = repo.split_once("@github.com") {
            *repo = format!("https://github.com{suffix}");
        }
    }
    let json = serde_json::to_string(&stable)?;
    let mut hash = 1469598103934665603_u64;

    for byte in json.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1099511628211);
    }

    Ok(format!("{hash:016x}"))
}

fn build_caddy_config(
    proxies: &[ProxyRoute],
    panel: Option<&PanelRoute>,
) -> serde_json::Value {
    use serde_json::json;

    let mut routes: Vec<serde_json::Value> = proxies
        .iter()
        .map(|route| {
            json!({
                "match": [{ "host": [route.domain] }],
                "handle": [{
                    "handler": "reverse_proxy",
                    "upstreams": [{
                        "dial": format!("berth-{}:{}", route.service_id, route.target_port)
                    }]
                }]
            })
        })
        .collect();

    if let Some(panel) = panel {
        routes.push(json!({
            "match": [{ "host": [panel.domain] }],
            "handle": [{
                "handler": "reverse_proxy",
                "upstreams": [{ "dial": "berth-ui:80" }]
            }]
        }));
    }

    let mut server = json!({
        "listen": [":80", ":443"],
        "routes": routes,
    });

    let skip: Vec<&str> = proxies
        .iter()
        .filter(|route| !route.tls)
        .map(|route| route.domain.as_str())
        .collect();
    if !skip.is_empty() {
        server["automatic_https"] = json!({ "skip": skip });
    }

    let mut config = json!({
        "apps": { "http": { "servers": { "berth": server } } }
    });

    if let Ok(email) = std::env::var("BERTH_ACME_EMAIL") {
        if !email.trim().is_empty() {
            config["apps"]["tls"] = json!({
                "automation": {
                    "policies": [{ "issuers": [{ "module": "acme", "email": email }] }]
                }
            });
        }
    }

    config
}
