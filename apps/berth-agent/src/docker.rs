use std::collections::{HashMap, HashSet};
use std::process::Stdio;

use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

use crate::protocol::{
    FailedApply, PanelRoute, ProxyRoute, RegistryAuth, RestartPolicy, ServiceSource, ServiceSpec,
    ServiceState,
};

pub const LABEL_MANAGED: &str = "berth.managed";
pub const LABEL_SERVICE_ID: &str = "berth.service_id";
pub const LABEL_SPEC_HASH: &str = "berth.spec_hash";
pub const BERTH_NETWORK: &str = "berth";
const KEPT_BUILD_IMAGES: usize = 2;
const MINIO_CLIENT_IMAGE: &str = "bitnamilegacy/minio-client:latest";
const BUILD_CACHE_MAX_AGE: &str = "until=72h";
const CADDY_CONTAINER: &str = "berth-caddy";
const CADDY_CONFIG_DIR: &str = "/var/lib/berth/caddy";
const SFTPGO_CONTAINER: &str = "berth-sftpgo";
const SFTPGO_MINIO_PORT: u16 = 9000;
const SFTPGO_BUCKET_NAME: &str = "bucket";

pub type BuildLogSink = mpsc::UnboundedSender<(String, String)>;

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
    /// True only when this reconcile actually cut traffic over to a newly
    /// built/pulled image. False for a no-op (already up to date), a build
    /// failure, or a cutover failure — in all of those the old container is
    /// still `Running`, but the panel must not read that as "this deployment
    /// succeeded".
    pub deployed: bool,
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
        build_log: Option<&BuildLogSink>,
    ) -> AgentResult<ReconcileOutcome> {
        self.heal_orphaned_next_containers().await?;

        let mut current = self.list_managed_containers().await?;
        let mut current_by_service = HashMap::new();

        for container in current.drain(..) {
            current_by_service
                .entry(container.service_id.clone())
                .or_insert_with(Vec::new)
                .push(container);
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
                    deployed: false,
                });
                current_by_service.remove(&spec.id);
                continue;
            }

            let spec_hash = spec_hash(spec)?;

            match &spec.source {
                ServiceSource::Image { image, tag } => {
                    let existing = current_by_service.remove(&spec.id).and_then(|replicas| {
                        replicas
                            .iter()
                            .find(|container| container.name == container_name(&spec.id))
                            .cloned()
                            .or_else(|| replicas.into_iter().next())
                    });
                    let should_replace = existing
                        .as_ref()
                        .map(|container| {
                            container.spec_hash.as_deref() != Some(spec_hash.as_str())
                                || !matches!(container.state, ServiceState::Running)
                        })
                        .unwrap_or(true)
                        || force_service_ids.iter().any(|id| id == &spec.id);

                    if should_replace {
                        emit_build_line(build_log, &spec.id, "==> Deploy started");
                        let prepared = async {
                            if let Some(auth) = &spec.registry_auth {
                                self.docker_login(auth).await?;
                            }
                            emit_build_line(
                                build_log,
                                &spec.id,
                                &format!("==> Pulling image {image}:{tag}"),
                            );
                            self.pull_image(image, tag).await
                        }
                        .await;
                        if let Err(error) = prepared {
                            record_failure(
                                &mut failed,
                                &mut statuses,
                                build_log,
                                &spec.id,
                                &error.to_string(),
                                existing.as_ref(),
                            );
                            continue;
                        }
                        let image_ref = format!("{image}:{tag}");
                        let existing_before = existing.clone();

                        match self
                            .cutover(spec, &spec_hash, &image_ref, existing, build_log)
                            .await
                        {
                            Ok((state, container_id)) => {
                                applied.push(spec.id.clone());
                                statuses.push(ServiceStatusEvent {
                                    service_id: spec.id.clone(),
                                    state,
                                    container_id,
                                    deployed: true,
                                });
                            }
                            Err(error) => {
                                failed.push(FailedApply {
                                    service_id: spec.id.clone(),
                                    reason: redact_credentials(&error.to_string()),
                                });
                                statuses.push(ServiceStatusEvent {
                                    service_id: spec.id.clone(),
                                    state: existing_before
                                        .as_ref()
                                        .map(|container| container.state.clone())
                                        .unwrap_or(ServiceState::Crashed),
                                    container_id: existing_before.map(|container| container.id),
                                    deployed: false,
                                });
                            }
                        }
                    } else if let Some(container) = existing {
                        if let Err(error) = self.update_resources(&container.name, spec).await {
                            record_failure(
                                &mut failed,
                                &mut statuses,
                                build_log,
                                &spec.id,
                                &error.to_string(),
                                Some(&container),
                            );
                            continue;
                        }
                        applied.push(spec.id.clone());
                        statuses.push(ServiceStatusEvent {
                            service_id: spec.id.clone(),
                            state: container.state,
                            container_id: Some(container.id),
                            deployed: false,
                        });
                    }
                }
                ServiceSource::Git { .. } => {
                    let existing = current_by_service.remove(&spec.id).and_then(|replicas| {
                        replicas
                            .iter()
                            .find(|container| container.name == container_name(&spec.id))
                            .cloned()
                            .or_else(|| replicas.into_iter().next())
                    });
                    let forced = force_service_ids.iter().any(|id| id == &spec.id);
                    let should_replace = existing
                        .as_ref()
                        .map(|container| {
                            container.spec_hash.as_deref() != Some(spec_hash.as_str())
                                || !matches!(container.state, ServiceState::Running)
                        })
                        .unwrap_or(true)
                        || forced;
                    if !should_replace {
                        let container = existing.as_ref().expect("existing container");
                        if let Err(error) = self.update_resources(&container.name, spec).await {
                            record_failure(
                                &mut failed,
                                &mut statuses,
                                build_log,
                                &spec.id,
                                &error.to_string(),
                                Some(container),
                            );
                            continue;
                        }
                        let container = existing.expect("existing container");
                        applied.push(spec.id.clone());
                        statuses.push(ServiceStatusEvent {
                            service_id: spec.id.clone(),
                            state: container.state,
                            container_id: Some(container.id),
                            deployed: false,
                        });
                        continue;
                    }
                    if let Some(auth) = &spec.registry_auth {
                        if let Err(error) = self.docker_login(auth).await {
                            record_failure(
                                &mut failed,
                                &mut statuses,
                                build_log,
                                &spec.id,
                                &error.to_string(),
                                existing.as_ref(),
                            );
                            continue;
                        }
                    }
                    // Build before touching the old container: the old one keeps serving
                    // traffic for the entire (potentially multi-minute) build, and a failed
                    // build never takes the service down.
                    match self
                        .build_git_source(spec, &spec_hash, forced, build_log)
                        .await
                    {
                        Ok(image) => {
                            match self
                                .cutover(spec, &spec_hash, &image, existing, build_log)
                                .await
                            {
                                Ok((state, container_id)) => {
                                    applied.push(spec.id.clone());
                                    statuses.push(ServiceStatusEvent {
                                        service_id: spec.id.clone(),
                                        state,
                                        container_id,
                                        deployed: true,
                                    });
                                    self.prune_build_artifacts(&spec.id).await;
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
                                        deployed: false,
                                    });
                                }
                            }
                        }
                        Err(error) => {
                            failed.push(FailedApply {
                                service_id: spec.id.clone(),
                                reason: redact_credentials(&error.to_string()),
                            });
                            statuses.push(ServiceStatusEvent {
                                service_id: spec.id.clone(),
                                state: existing
                                    .as_ref()
                                    .map(|container| container.state.clone())
                                    .unwrap_or(ServiceState::Crashed),
                                container_id: existing.map(|container| container.id),
                                deployed: false,
                            });
                        }
                    }
                }
            }
        }

        let failed_ids: HashSet<String> = failed
            .iter()
            .map(|failure| failure.service_id.clone())
            .collect();
        for spec in desired {
            if !applied.iter().any(|id| id == &spec.id) || failed_ids.contains(&spec.id) {
                continue;
            }
            if let Err(error) = self.sync_replica_count(spec, build_log).await {
                failed.push(FailedApply {
                    service_id: spec.id.clone(),
                    reason: redact_credentials(&error.to_string()),
                });
                applied.retain(|id| id != &spec.id);
                if let Some(status) = statuses
                    .iter_mut()
                    .rev()
                    .find(|status| status.service_id == spec.id)
                {
                    status.deployed = false;
                }
            }
        }

        for (service_id, containers) in current_by_service {
            if desired_ids.contains(&service_id) {
                continue;
            }

            for container in containers {
                if let Err(error) = self.remove_container(&container.name).await {
                    eprintln!(
                        "[berth-agent] failed to remove orphaned {}: {error}",
                        container.name
                    );
                    continue;
                }
            }
            statuses.push(ServiceStatusEvent {
                service_id,
                state: ServiceState::Stopped,
                container_id: None,
                deployed: false,
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
            "--log-opt",
            LOG_MAX_SIZE,
            "--log-opt",
            LOG_MAX_FILES,
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
                "--log-opt",
                LOG_MAX_SIZE,
                "--log-opt",
                LOG_MAX_FILES,
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
                &format!(
                    "SFTPGO_DEFAULT_ADMIN_USERNAME={}",
                    crate::sftpgo::ADMIN_USERNAME
                ),
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
    /// instance via a one-shot minio-client container — a fresh MinIO
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
            MINIO_CLIENT_IMAGE,
            "mc",
            "mb",
            "--ignore-existing",
            &format!("b/{bucket}"),
        ])
        .await?;
        Ok(())
    }

    /// If the agent crashed mid-cutover, a `berth-{id}-next` container may be
    /// left running instead of (or alongside) the canonical `berth-{id}`
    /// one. The rest of reconcile assumes the canonical name is what's
    /// serving traffic, so fix that up first: drop the leftover `-next`
    /// duplicate if the canonical container is already there, otherwise
    /// promote it by renaming it into place.
    async fn heal_orphaned_next_containers(&self) -> AgentResult<()> {
        let containers = self.list_managed_containers().await?;

        for container in &containers {
            if !container.name.ends_with("-next") {
                continue;
            }

            let canonical = container_name(&container.service_id);
            if containers.iter().any(|other| other.name == canonical) {
                self.remove_container(&container.name).await?;
            } else {
                let _ = self.docker(&["rename", &container.name, &canonical]).await;
            }
        }

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
        let mut removed = false;

        for container in containers {
            if container.service_id == service_id {
                self.remove_container(&container.name).await?;
                removed = true;
            }
        }

        Ok(removed)
    }

    async fn sync_replica_count(
        &self,
        spec: &ServiceSpec,
        build_log: Option<&BuildLogSink>,
    ) -> AgentResult<()> {
        if spec.replicas <= 1 {
            let containers = self.list_managed_containers().await?;
            for container in containers
                .iter()
                .filter(|container| container.service_id == spec.id)
            {
                if container.name != container_name(&spec.id) {
                    self.remove_container(&container.name).await?;
                }
            }
            return Ok(());
        }

        let image = match &spec.source {
            ServiceSource::Image { image, tag } => format!("{image}:{tag}"),
            ServiceSource::Git { .. } => self
                .docker(&[
                    "inspect",
                    "-f",
                    "{{.Config.Image}}",
                    &container_name(&spec.id),
                ])
                .await?
                .trim()
                .to_string(),
        };
        let desired_hash = spec_hash(spec)?;
        let containers = self.list_managed_containers().await?;
        let service_containers: Vec<ManagedContainer> = containers
            .into_iter()
            .filter(|container| container.service_id == spec.id)
            .collect();

        for index in 1..spec.replicas {
            let name = replica_container_name(&spec.id, index);
            let existing = service_containers
                .iter()
                .find(|container| container.name == name)
                .cloned();
            if existing.as_ref().is_some_and(|container| {
                container.spec_hash.as_deref() == Some(desired_hash.as_str())
                    && matches!(container.state, ServiceState::Running)
            }) {
                self.update_resources(&name, spec).await?;
                continue;
            }

            let (state, _) = self
                .cutover_named(spec, &desired_hash, &image, existing, &name, build_log)
                .await?;
            if !matches!(state, ServiceState::Running) {
                return Err(
                    format!("replica {index} for {} did not become healthy", spec.id).into(),
                );
            }
        }

        for container in &service_containers {
            if let Some(index) = replica_index(&spec.id, &container.name) {
                if index >= spec.replicas {
                    self.remove_container(&container.name).await?;
                }
            }
        }

        Ok(())
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

    async fn run_release_command(
        &self,
        spec: &ServiceSpec,
        image: &str,
        build_log: Option<&BuildLogSink>,
    ) -> AgentResult<()> {
        let Some(command) = spec
            .release_command
            .as_deref()
            .map(str::trim)
            .filter(|command| !command.is_empty())
        else {
            return Ok(());
        };

        self.ensure_network().await?;
        emit_build_line(build_log, &spec.id, "==> Running release command");
        emit_build_line(build_log, &spec.id, &format!("$ {command}"));

        let args = release_command_args(spec, image, command);
        let mut docker = Command::new(&self.docker_bin);
        docker.args(&args);
        let run = run_streamed(docker, &spec.id, build_log);
        let result = tokio::time::timeout(RELEASE_COMMAND_TIMEOUT, run).await;
        let _ = self.docker(&["rm", "-f", &release_container_name(&spec.id)]).await;

        match result {
            Err(_) => {
                emit_build_line(build_log, &spec.id, "==> Release command timed out");
                Err(format!(
                    "release command did not finish within {} minutes; the previous version is still running",
                    RELEASE_COMMAND_TIMEOUT.as_secs() / 60
                )
                .into())
            }
            Ok(Err(error)) => Err(format!("release command could not run: {error}").into()),
            Ok(Ok((true, _))) => {
                emit_build_line(build_log, &spec.id, "==> Release command finished");
                Ok(())
            }
            Ok(Ok((false, _))) => {
                emit_build_line(build_log, &spec.id, "==> Release command failed");
                Err("release command failed; the previous version is still running".into())
            }
        }
    }

    async fn run_service(
        &self,
        spec: &ServiceSpec,
        spec_hash: &str,
        built_image: Option<&str>,
        name: &str,
        attach_aliases: bool,
    ) -> AgentResult<String> {
        let image_ref = match (&spec.source, built_image) {
            (_, Some(image)) => image.to_string(),
            (ServiceSource::Image { image, tag }, None) => format!("{image}:{tag}"),
            (ServiceSource::Git { .. }, None) => return Err("git source was not built".into()),
        };

        self.ensure_network().await?;

        let mut mounted_volumes = Vec::new();
        for volume in &spec.volumes {
            mounted_volumes.push(
                crate::volumes::VolumeManager::new(self.docker_bin.clone())
                    .ensure(volume)
                    .await?,
            );
        }

        let mut args = vec![
            "run".to_string(),
            "-d".to_string(),
            "--name".to_string(),
            name.to_string(),
            "--label".to_string(),
            format!("{LABEL_MANAGED}=true"),
            "--label".to_string(),
            format!("{LABEL_SERVICE_ID}={}", spec.id),
            "--label".to_string(),
            format!("{LABEL_SPEC_HASH}={spec_hash}"),
            "--log-opt".to_string(),
            LOG_MAX_SIZE.to_string(),
            "--log-opt".to_string(),
            LOG_MAX_FILES.to_string(),
            "--restart".to_string(),
            restart_policy_flag(&spec.restart_policy).to_string(),
            "--cpus".to_string(),
            spec.resources.cpu_cores.to_string(),
            "--memory".to_string(),
            format!("{}m", spec.resources.memory_mb),
            "--network".to_string(),
            BERTH_NETWORK.to_string(),
        ];
        if let Some(platform) = &spec.target_platform {
            args.splice(1..1, ["--platform".to_string(), platform.clone()]);
        }
        if attach_aliases {
            append_network_aliases(&mut args, spec);
        }

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

        for (volume, actual_name) in spec.volumes.iter().zip(&mounted_volumes) {
            args.push("-v".to_string());
            args.push(format!("{actual_name}:{}", volume.mount_path));
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

    /// Starts `image` as the new version of `spec` and swaps it in for `existing`
    /// (if any) with no observable downtime: the new container is started
    /// alongside the old one under a temporary name, health-checked, and only
    /// then does the old container get removed and the new one renamed into
    /// its place. Falls back to stop-then-start when the service publishes a
    /// host port directly (not behind Caddy), since Docker can't bind two
    /// containers to the same host port at once.
    async fn cutover(
        &self,
        spec: &ServiceSpec,
        spec_hash: &str,
        image: &str,
        existing: Option<ManagedContainer>,
        build_log: Option<&BuildLogSink>,
    ) -> AgentResult<(ServiceState, Option<String>)> {
        self.cutover_named(
            spec,
            spec_hash,
            image,
            existing,
            &container_name(&spec.id),
            build_log,
        )
        .await
    }

    async fn cutover_named(
        &self,
        spec: &ServiceSpec,
        spec_hash: &str,
        image: &str,
        existing: Option<ManagedContainer>,
        target_name: &str,
        build_log: Option<&BuildLogSink>,
    ) -> AgentResult<(ServiceState, Option<String>)> {
        self.run_release_command(spec, image, build_log).await?;
        emit_build_line(build_log, &spec.id, "==> Starting container");
        let publishes_host_port = spec
            .ports
            .iter()
            .any(|port| port.public && port.domain.is_none());

        if publishes_host_port {
            if let Some(old) = existing {
                self.remove_container(&old.name).await?;
            }
            let container_id = self
                .run_service(spec, spec_hash, Some(image), target_name, true)
                .await?;
            emit_build_line(build_log, &spec.id, "==> Container started");
            return Ok((ServiceState::Running, Some(container_id)));
        }

        let Some(old) = existing else {
            let container_id = self
                .run_service(
                    spec,
                    spec_hash,
                    Some(image),
                    target_name,
                    target_name == container_name(&spec.id),
                )
                .await?;
            if target_name != container_name(&spec.id) {
                if let Err(error) = self.wait_until_healthy(target_name, spec).await {
                    self.remove_container(target_name).await?;
                    return Err(error);
                }
                self.connect_service_aliases(target_name, spec).await?;
            }
            emit_build_line(build_log, &spec.id, "==> Container started");
            return Ok((ServiceState::Running, Some(container_id)));
        };

        let next_name = if target_name == container_name(&spec.id) {
            container_name_next(&spec.id)
        } else {
            format!("{target_name}-next")
        };
        let _ = self.remove_container(&next_name).await;
        let stopped_old_first = stops_old_before_start(spec);
        if stopped_old_first {
            emit_build_line(
                build_log,
                &spec.id,
                "==> Stopping the previous version first (this service must run only once)",
            );
            self.docker(&["stop", &old.name]).await?;
        }
        let container_id = match self
            .run_service(spec, spec_hash, Some(image), &next_name, false)
            .await
        {
            Ok(id) => id,
            Err(error) => {
                if stopped_old_first {
                    let _ = self.docker(&["start", &old.name]).await;
                }
                return Err(error);
            }
        };

        emit_build_line(build_log, &spec.id, "==> Waiting for health check");
        match self.wait_until_healthy(&next_name, spec).await {
            Ok(()) => {
                emit_build_line(build_log, &spec.id, "==> Container healthy");
                self.connect_service_aliases(&next_name, spec).await?;
                self.remove_container(&old.name).await?;
                self.docker(&["rename", &next_name, target_name]).await?;
                Ok((ServiceState::Running, Some(container_id)))
            }
            Err(error) => {
                emit_build_line(
                    build_log,
                    &spec.id,
                    &format!("==> Health check failed: {error}"),
                );
                self.remove_container(&next_name).await?;
                if stopped_old_first {
                    emit_build_line(
                        build_log,
                        &spec.id,
                        "==> Restarting the previous version",
                    );
                    let _ = self.docker(&["start", &old.name]).await;
                }
                Err(error)
            }
        }
    }

    async fn connect_service_aliases(
        &self,
        container: &str,
        spec: &ServiceSpec,
    ) -> AgentResult<()> {
        self.docker(&["network", "disconnect", BERTH_NETWORK, container])
            .await?;
        let aliases = service_network_aliases(spec);
        let mut args = vec!["network".to_string(), "connect".to_string()];
        for alias in aliases {
            args.push("--alias".to_string());
            args.push(alias);
        }
        args.push(BERTH_NETWORK.to_string());
        args.push(container.to_string());
        let owned_args: Vec<&str> = args.iter().map(String::as_str).collect();
        self.docker(&owned_args).await?;
        Ok(())
    }

    /// Polls a freshly started container until it counts as healthy: an HTTP
    /// probe against `spec.health_check` if one is configured, or simply
    /// staying `running` past a short grace period otherwise. Bails out early
    /// if the container exits.
    async fn wait_until_healthy(&self, name: &str, spec: &ServiceSpec) -> AgentResult<()> {
        let (interval, timeout, attempts, path, port) = match &spec.health_check {
            Some(check) => (
                std::time::Duration::from_secs(check.interval_seconds.max(1)),
                std::time::Duration::from_secs(check.timeout_seconds.max(1)),
                check.retries.max(1),
                check.path.clone(),
                check.port,
            ),
            None => (
                std::time::Duration::from_secs(2),
                std::time::Duration::from_secs(2),
                5,
                None,
                None,
            ),
        };

        for attempt in 0..attempts {
            if attempt > 0 {
                tokio::time::sleep(interval).await;
            }

            let status = self
                .docker(&["inspect", "-f", "{{.State.Status}}", name])
                .await
                .unwrap_or_default();
            let status = status.trim();
            if status == "exited" || status == "dead" {
                return Err(format!("container {name} exited during startup").into());
            }
            if status != "running" {
                continue;
            }

            let Some(check_path) = path.as_deref() else {
                return Ok(());
            };

            let Ok(ip) = self.container_ip(name).await else {
                continue;
            };
            if ip.is_empty() {
                continue;
            }

            let check_port = port
                .or_else(|| spec.ports.first().map(|mapping| mapping.container_port))
                .unwrap_or(80);
            let url = format!("http://{ip}:{check_port}{check_path}");

            let Ok(client) = reqwest::Client::builder().timeout(timeout).build() else {
                continue;
            };
            if let Ok(response) = client.get(&url).send().await {
                if response.status().is_success() {
                    return Ok(());
                }
            }
        }

        Err(format!("service did not become healthy after {attempts} attempts").into())
    }

    async fn container_ip(&self, name: &str) -> AgentResult<String> {
        let output = self
            .docker(&[
                "inspect",
                "-f",
                &format!("{{{{(index .NetworkSettings.Networks \"{BERTH_NETWORK}\").IPAddress}}}}"),
                name,
            ])
            .await?;
        Ok(output.trim().to_string())
    }

    // A build is the one thing that can stall every deploy on a server, since
    // reconciles run one after another. So it gets a disk check up front, a
    // hard time limit, low CPU priority, and its work directory is always
    // removed, whatever happens.
    async fn build_git_source(
        &self,
        spec: &ServiceSpec,
        spec_hash: &str,
        clean: bool,
        build_log: Option<&BuildLogSink>,
    ) -> AgentResult<String> {
        if let Some((used_gb, total_gb)) = crate::host::root_disk_usage_gb() {
            let free_gb = total_gb - used_gb;
            if let Err(message) = build_disk_preflight(free_gb, min_build_free_gb()) {
                emit_build_line(build_log, &spec.id, &format!("==> {message}"));
                return Err(message.into());
            }
        }

        let limit = build_timeout();
        let result = tokio::time::timeout(
            limit,
            self.build_git_source_inner(spec, spec_hash, clean, build_log),
        )
        .await;
        let _ = tokio::fs::remove_dir_all(build_work_dir(&spec.id)).await;

        match result {
            Ok(outcome) => outcome,
            Err(_) => {
                let message = format!(
                    "the build did not finish within {} minutes and was stopped, so other deploys on this server can continue. The previous version is still running.",
                    limit.as_secs() / 60
                );
                emit_build_line(build_log, &spec.id, &format!("==> {message}"));
                Err(message.into())
            }
        }
    }

    async fn build_git_source_inner(
        &self,
        spec: &ServiceSpec,
        spec_hash: &str,
        clean: bool,
        build_log: Option<&BuildLogSink>,
    ) -> AgentResult<String> {
        let ServiceSource::Git {
            repo,
            branch,
            build,
        } = &spec.source
        else {
            return Err("expected git source".into());
        };
        emit_build_line(build_log, &spec.id, "==> Build started");
        let work = build_work_dir(&spec.id);
        if work.exists() {
            tokio::fs::remove_dir_all(&work).await?;
        }
        let mut checked_out = false;
        if let Some(revision) = commit_to_check_out(build) {
            emit_build_line(
                build_log,
                &spec.id,
                &format!("==> Checking out commit {}", &revision[..revision.len().min(12)]),
            );
            match checkout_commit(&work, repo, revision).await {
                Ok(()) => checked_out = true,
                Err(error) if build.pinned => {
                    return Err(format!(
                        "could not check out pinned commit {}: {error}",
                        &revision[..revision.len().min(12)]
                    )
                    .into());
                }
                Err(error) => {
                    emit_build_line(
                        build_log,
                        &spec.id,
                        &format!("==> Commit unavailable ({error}); building the branch head"),
                    );
                    if work.exists() {
                        tokio::fs::remove_dir_all(&work).await?;
                    }
                }
            }
        }
        if !checked_out {
            emit_build_line(build_log, &spec.id, &format!("==> Cloning branch {branch}"));
            let clone = Command::new("git")
                .kill_on_drop(true)
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
                    redact_clone_error(&String::from_utf8_lossy(&clone.stderr))
                )
                .into());
            }
        }
        // The agent's own systemd unit hardens file creation with UMask=0077,
        // so a fresh clone is owner-only (600/700). That's invisible to a
        // Dockerfile that stays root the whole way through, but breaks any
        // COPY'd file once the image drops to a non-root USER -- the process
        // can no longer read what the build context happily read as root.
        let chmod = Command::new("chmod")
            .args(["-R", "a+rX"])
            .arg(&work)
            .output()
            .await?;
        if !chmod.status.success() {
            return Err(format!(
                "chmod on cloned repo failed: {}",
                String::from_utf8_lossy(&chmod.stderr)
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
        let mut command = if use_docker {
            emit_build_line(build_log, &spec.id, "==> Building with Dockerfile");
            let mut command = niced_command(&self.docker_bin);
            // Layers are keyed by content, so a pushed change always rebuilds
            // the affected layers. --pull keeps base images fresh; an explicit
            // Redeploy additionally drops the layer cache for a clean build.
            command.args(["build", "--pull", "--progress=plain"]);
            if clean {
                command.arg("--no-cache");
            }
            command.args(["-t", &image, "-f", dockerfile]);
            if let Some(platform) = &spec.target_platform {
                command.args(["--platform", platform]);
            }
            if let Some(args) = &build.build_args {
                for (key, value) in args {
                    command.args(["--build-arg", &format!("{key}={value}")]);
                }
            }
            command.arg(".");
            command
        } else {
            emit_build_line(build_log, &spec.id, "==> Building with Nixpacks");
            let mut command = niced_command("nixpacks");
            command.args(["build", ".", "--name", &image]);
            if clean {
                command.arg("--no-cache");
            }
            if let Some(cmd) = build.build_command.as_deref() {
                command.args(["--build-cmd", cmd]);
            }
            if let Some(cmd) = build.start_command.as_deref() {
                command.args(["--start-cmd", cmd]);
            }
            command
        };
        command.current_dir(&root);
        let (success, log) = run_streamed(command, &spec.id, build_log).await?;
        let _ = tokio::fs::remove_dir_all(&work).await;
        if !success {
            return Err(format!(
                "application image build failed:\n{}",
                truncate_build_log(&log)
            )
            .into());
        }
        emit_build_line(build_log, &spec.id, "==> Build finished");
        Ok(image)
    }

    async fn prune_build_artifacts(&self, service_id: &str) {
        let listing = Command::new(&self.docker_bin)
            .args([
                "images",
                "--filter",
                &format!("reference=berth-build-{service_id}:*"),
                "--format",
                "{{.CreatedAt}}|{{.Repository}}:{{.Tag}}",
            ])
            .output()
            .await;
        if let Ok(output) = listing {
            let mut images: Vec<(String, String)> = String::from_utf8_lossy(&output.stdout)
                .lines()
                .filter_map(|line| line.split_once('|'))
                .map(|(created, image)| (created.to_string(), image.to_string()))
                .collect();
            images.sort_by(|left, right| right.0.cmp(&left.0));
            for (_, image) in images.into_iter().skip(KEPT_BUILD_IMAGES) {
                let _ = Command::new(&self.docker_bin)
                    .args(["rmi", &image])
                    .output()
                    .await;
            }
        }
        let _ = Command::new(&self.docker_bin)
            .args(["builder", "prune", "-f", "--filter", BUILD_CACHE_MAX_AGE])
            .output()
            .await;
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

const RELEASE_COMMAND_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10 * 60);

fn release_container_name(service_id: &str) -> String {
    format!("berth-{service_id}-release")
}

fn release_command_args(spec: &ServiceSpec, image: &str, command: &str) -> Vec<String> {
    let mut args = vec![
        "run".to_string(),
        "--rm".to_string(),
        "--name".to_string(),
        release_container_name(&spec.id),
        "--network".to_string(),
        BERTH_NETWORK.to_string(),
        "--cpus".to_string(),
        spec.resources.cpu_cores.to_string(),
        "--memory".to_string(),
        format!("{}m", spec.resources.memory_mb),
        "--entrypoint".to_string(),
        "sh".to_string(),
    ];
    if let Some(platform) = &spec.target_platform {
        args.splice(1..1, ["--platform".to_string(), platform.clone()]);
    }
    for env_var in &spec.env {
        args.push("-e".to_string());
        args.push(format!("{}={}", env_var.key, env_var.value));
    }
    args.push(image.to_string());
    args.push("-c".to_string());
    args.push(command.to_string());
    args
}

const DEFAULT_BUILD_TIMEOUT_SECS: u64 = 30 * 60;
const DEFAULT_MIN_BUILD_FREE_GB: f64 = 3.0;

fn build_work_dir(service_id: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("berth-build-{service_id}"))
}

fn build_timeout() -> Duration {
    let seconds = std::env::var("BERTH_BUILD_TIMEOUT_SECS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value >= 60)
        .unwrap_or(DEFAULT_BUILD_TIMEOUT_SECS);
    Duration::from_secs(seconds)
}

fn min_build_free_gb() -> f64 {
    std::env::var("BERTH_MIN_BUILD_FREE_GB")
        .ok()
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| *value >= 0.0)
        .unwrap_or(DEFAULT_MIN_BUILD_FREE_GB)
}

fn build_disk_preflight(free_gb: f64, min_gb: f64) -> Result<(), String> {
    if free_gb >= min_gb {
        return Ok(());
    }
    Err(format!(
        "not enough free disk space to build: {free_gb:.1} GB free, at least {min_gb:.1} GB needed. Free some space or remove unused images, then deploy again. The previous version is still running."
    ))
}

// Builds run at low CPU priority so a long build cannot slow down the
// services already running on the same server.
fn niced_command(program: &str) -> Command {
    #[cfg(unix)]
    {
        let mut command = Command::new("nice");
        command.args(["-n", "10", program]);
        command
    }
    #[cfg(not(unix))]
    {
        Command::new(program)
    }
}

fn container_name_next(service_id: &str) -> String {
    format!("berth-{service_id}-next")
}

fn replica_container_name(service_id: &str, index: u32) -> String {
    format!("berth-{service_id}-replica-{index}")
}

fn replica_index(service_id: &str, name: &str) -> Option<u32> {
    if name == container_name(service_id) {
        return Some(0);
    }

    name.strip_prefix(&format!("berth-{service_id}-replica-"))?
        .parse()
        .ok()
}

fn service_network_aliases(spec: &ServiceSpec) -> Vec<String> {
    let mut aliases = HashSet::from([spec.name.clone(), container_name(&spec.id)]);
    aliases.extend(spec.aliases.iter().cloned());
    aliases.into_iter().collect()
}

fn append_network_aliases(args: &mut Vec<String>, spec: &ServiceSpec) {
    for alias in service_network_aliases(spec) {
        args.push("--network-alias".to_string());
        args.push(alias);
    }
}

fn env_value(spec: &ServiceSpec, key: &str) -> Option<String> {
    spec.env
        .iter()
        .find(|item| item.key == key)
        .map(|item| item.value.clone())
}

pub(crate) fn redact_credentials(message: &str) -> String {
    if let Some(at) = message.find("@github.com") {
        if let Some(start) = message[..at].rfind("https://") {
            return format!("{}https://***{}", &message[..start], &message[at..]);
        }
    }
    message.to_string()
}

/// Docker's default `json-file` driver keeps container logs forever, so one
/// chatty service can fill the disk and take the whole server down. Every
/// container Berth starts keeps at most MAX_SIZE x MAX_FILES of logs.
const LOG_MAX_SIZE: &str = "max-size=10m";
const LOG_MAX_FILES: &str = "max-file=3";

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

fn record_failure(
    failed: &mut Vec<FailedApply>,
    statuses: &mut Vec<ServiceStatusEvent>,
    build_log: Option<&BuildLogSink>,
    service_id: &str,
    message: &str,
    existing: Option<&ManagedContainer>,
) {
    let reason = redact_credentials(message);
    emit_build_line(build_log, service_id, &format!("==> Failed: {reason}"));
    failed.push(FailedApply {
        service_id: service_id.to_string(),
        reason,
    });
    statuses.push(ServiceStatusEvent {
        service_id: service_id.to_string(),
        state: existing
            .map(|container| container.state.clone())
            .unwrap_or(ServiceState::Crashed),
        container_id: existing.map(|container| container.id.clone()),
        deployed: false,
    });
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
    stable.replicas = 1;
    stable.replica_policy = None;
    stable.deploy_strategy = crate::protocol::DeployStrategy::default();
    stable.release_command = None;
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

fn emit_build_line(sink: Option<&BuildLogSink>, service_id: &str, line: &str) {
    if let Some(sink) = sink {
        let _ = sink.send((service_id.to_string(), line.to_string()));
    }
}

fn stops_old_before_start(spec: &ServiceSpec) -> bool {
    spec.deploy_strategy == crate::protocol::DeployStrategy::Recreate || !spec.volumes.is_empty()
}

fn looks_like_commit_sha(value: &str) -> bool {
    (7..=64).contains(&value.len()) && value.chars().all(|c| c.is_ascii_hexdigit())
}

fn commit_to_check_out(build: &crate::protocol::BuildConfig) -> Option<&str> {
    build
        .revision
        .as_deref()
        .filter(|revision| looks_like_commit_sha(revision))
}

async fn run_git(args: &[&str], dir: Option<&std::path::Path>) -> Result<(), String> {
    let mut command = Command::new("git");
    if let Some(dir) = dir {
        command.arg("-C").arg(dir);
    }
    let output = command
        .args(args)
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(());
    }
    Err(redact_clone_error(&String::from_utf8_lossy(&output.stderr)))
}

async fn checkout_commit(work: &std::path::Path, repo: &str, revision: &str) -> Result<(), String> {
    let work_str = work.to_string_lossy().to_string();
    run_git(&["init", "--quiet", &work_str], None).await?;
    run_git(&["remote", "add", "origin", repo], Some(work)).await?;
    run_git(&["fetch", "--quiet", "--depth", "1", "origin", revision], Some(work)).await?;
    run_git(&["checkout", "--quiet", "--detach", "FETCH_HEAD"], Some(work)).await
}

fn redact_clone_error(stderr: &str) -> String {
    stderr
        .lines()
        .map(|line| {
            let Some((scheme, rest)) = line.split_once("://") else {
                return line.to_string();
            };
            let Some((credentials, host)) = rest.split_once('@') else {
                return line.to_string();
            };
            if credentials.contains('/') || credentials.contains(' ') {
                return line.to_string();
            }
            format!("{scheme}://***@{host}")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

async fn run_streamed(
    mut command: Command,
    service_id: &str,
    sink: Option<&BuildLogSink>,
) -> AgentResult<(bool, String)> {
    let mut child = command
        .kill_on_drop(true)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let mut stdout = BufReader::new(child.stdout.take().ok_or("missing stdout")?).lines();
    let mut stderr = BufReader::new(child.stderr.take().ok_or("missing stderr")?).lines();
    let mut log = String::new();
    let (mut out_open, mut err_open) = (true, true);
    while out_open || err_open {
        let line = tokio::select! {
            line = stdout.next_line(), if out_open => match line? {
                Some(line) => line,
                None => { out_open = false; continue; }
            },
            line = stderr.next_line(), if err_open => match line? {
                Some(line) => line,
                None => { err_open = false; continue; }
            },
        };
        emit_build_line(sink, service_id, &line);
        log.push_str(&line);
        log.push('\n');
    }
    let status = child.wait().await?;
    Ok((status.success(), log))
}

fn truncate_build_log(log: &str) -> String {
    const MAX_BYTES: usize = 200_000;
    if log.len() <= MAX_BYTES {
        return log.to_string();
    }
    format!(
        "[Build output truncated to the final {MAX_BYTES} bytes]\n{}",
        &log[log.len() - MAX_BYTES..]
    )
}

const PROXY_DIAL_TIMEOUT: &str = "5s";
const PROXY_RESPONSE_HEADER_TIMEOUT: &str = "120s";
const PROXY_RETRY_WINDOW: &str = "8s";
const PROXY_RETRY_INTERVAL: &str = "250ms";
const PROXY_DNS_REFRESH: &str = "1s";
const PROXY_FAIL_WINDOW: &str = "10s";
const PROXY_MAX_FAILS: u32 = 3;

// Every replica of a service shares one network alias, so a DNS lookup returns
// all of them. Resolving it per request (instead of once) spreads load across
// replicas, picks up a scaled-up replica within a second, and keeps working
// while a container is swapped out: a failed dial is retried on another
// replica, or for a few seconds until the new one answers.
fn service_reverse_proxy(service_id: &str, port: u16) -> serde_json::Value {
    serde_json::json!({
        "handler": "reverse_proxy",
        "dynamic_upstreams": {
            "source": "a",
            "name": container_name(service_id),
            "port": port.to_string(),
            "refresh": PROXY_DNS_REFRESH,
        },
        "load_balancing": {
            "selection_policy": { "policy": "least_conn" },
            "try_duration": PROXY_RETRY_WINDOW,
            "try_interval": PROXY_RETRY_INTERVAL,
        },
        "health_checks": {
            "passive": {
                "fail_duration": PROXY_FAIL_WINDOW,
                "max_fails": PROXY_MAX_FAILS,
            }
        },
        "transport": {
            "protocol": "http",
            "dial_timeout": PROXY_DIAL_TIMEOUT,
            "response_header_timeout": PROXY_RESPONSE_HEADER_TIMEOUT,
        },
    })
}

// Access logs feed the traffic stats. Everything that identifies a visitor or
// reveals what they asked for is deleted before the line is written; only the
// domain, status code and duration remain.
fn edge_logging() -> serde_json::Value {
    let delete = serde_json::json!({ "filter": "delete" });
    let encoder = serde_json::json!({
        "format": "filter",
        "wrap": { "format": "json" },
        "fields": {
            "request>remote_ip": delete,
            "request>remote_port": delete,
            "request>client_ip": delete,
            "request>uri": delete,
            "request>headers": delete,
            "request>tls": delete,
            "resp_headers": delete
        }
    });
    serde_json::json!({
        "logs": {
            "default": { "exclude": ["http.log.access"], "encoder": encoder },
            "access": {
                "writer": { "output": "stdout" },
                "encoder": encoder,
                "include": ["http.log.access"]
            }
        }
    })
}

fn build_caddy_config(proxies: &[ProxyRoute], panel: Option<&PanelRoute>) -> serde_json::Value {
    use serde_json::json;

    let mut sorted: Vec<&ProxyRoute> = proxies.iter().collect();
    // Within the same host, a scoped path (e.g. "/api") must be tried before
    // the whole-domain catch-all ("/"), or the catch-all would win first and
    // the scoped route would never be reached. Caddy evaluates routes in
    // array order and stops at the first match.
    sorted.sort_by_key(|route| route.path == "/");

    let mut routes: Vec<serde_json::Value> = sorted
        .iter()
        .map(|route| {
            let mut matcher = json!({ "host": [route.domain] });
            if route.path != "/" {
                // Match the bare path and everything under it, not a plain
                // prefix, so "/api" doesn't also swallow "/apiary".
                matcher["path"] = json!([route.path.clone(), format!("{}/*", route.path)]);
            }
            json!({
                "match": [matcher],
                "handle": [service_reverse_proxy(&route.service_id, route.target_port)]
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
        "logs": { "default_logger_name": "access" },
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
        "logging": edge_logging(),
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

#[cfg(test)]
mod build_isolation_tests {
    use super::*;

    #[test]
    fn refuses_to_build_when_the_disk_is_nearly_full() {
        let message = build_disk_preflight(1.2, 3.0).unwrap_err();
        assert!(message.contains("1.2 GB free"));
        assert!(message.contains("previous version is still running"));
        assert!(build_disk_preflight(3.0, 3.0).is_ok());
        assert!(build_disk_preflight(40.0, 3.0).is_ok());
    }

    #[test]
    fn the_time_limit_has_a_safe_floor() {
        std::env::remove_var("BERTH_BUILD_TIMEOUT_SECS");
        assert_eq!(build_timeout(), Duration::from_secs(1800));
    }

    #[cfg(unix)]
    #[test]
    fn builds_are_started_at_low_priority() {
        let command = niced_command("docker");
        let std = command.as_std();
        assert_eq!(std.get_program(), "nice");
        let args: Vec<_> = std.get_args().map(|arg| arg.to_string_lossy().to_string()).collect();
        assert_eq!(args, ["-n", "10", "docker"]);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn a_build_that_hits_the_time_limit_is_really_killed() {
        let pid_file = std::env::temp_dir().join(format!("berth-kill-test-{}", std::process::id()));
        let mut command = Command::new("sh");
        command.args(["-c", &format!("echo $$ > {}; exec sleep 60", pid_file.display())]);

        let result = tokio::time::timeout(
            Duration::from_millis(500),
            run_streamed(command, "svc", None),
        )
        .await;
        assert!(result.is_err(), "the build must be cut off");

        tokio::time::sleep(Duration::from_millis(300)).await;
        let pid = std::fs::read_to_string(&pid_file).unwrap().trim().to_string();
        let _ = std::fs::remove_file(&pid_file);
        assert!(
            !std::path::Path::new(&format!("/proc/{pid}")).exists(),
            "process {pid} is still running after the timeout"
        );
    }

    #[test]
    fn each_service_builds_in_its_own_directory() {
        assert_ne!(build_work_dir("a"), build_work_dir("b"));
        assert!(build_work_dir("a").ends_with("berth-build-a"));
    }
}

#[cfg(test)]
mod release_command_tests {
    use super::*;
    use serde_json::json;

    fn spec(extra: serde_json::Value) -> ServiceSpec {
        let mut base = json!({
            "id": "svc1", "name": "api", "serverId": "srv1",
            "source": { "kind": "image", "image": "o/api", "tag": "1" },
            "env": [{ "key": "DATABASE_URL", "value": "postgres://x", "isSecret": true }],
            "ports": [], "volumes": [],
            "resources": { "cpuCores": 1.0, "memoryMb": 512 },
            "healthCheck": null, "restartPolicy": "always", "replicas": 1, "templateKind": null
        });
        for (key, value) in extra.as_object().unwrap() {
            base[key] = value.clone();
        }
        serde_json::from_value(base).expect("valid spec")
    }

    #[test]
    fn runs_the_command_in_the_new_image_with_the_service_env() {
        let args = release_command_args(&spec(json!({})), "o/api:1", "npx prisma migrate deploy");
        let joined = args.join(" ");
        assert!(joined.contains("--rm"));
        assert!(joined.contains("DATABASE_URL=postgres://x"));
        assert!(joined.contains(&format!("--network {BERTH_NETWORK}")));
        assert_eq!(args[args.len() - 3], "o/api:1");
        assert_eq!(args[args.len() - 2], "-c");
        assert_eq!(args[args.len() - 1], "npx prisma migrate deploy");
    }

    #[test]
    fn publishes_no_ports_and_mounts_no_volumes() {
        let args = release_command_args(&spec(json!({})), "o/api:1", "true");
        assert!(!args.iter().any(|arg| arg == "-p" || arg == "-v"));
    }

    #[test]
    fn the_command_does_not_change_the_spec_hash() {
        let plain = spec_hash(&spec(json!({}))).unwrap();
        let with = spec_hash(&spec(json!({ "releaseCommand": "npm run migrate" }))).unwrap();
        assert_eq!(plain, with);
    }

    #[test]
    fn rejects_control_characters_and_absurd_length() {
        assert!(crate::validators::validate_spec(&spec(json!({ "releaseCommand": "a\u{0}b" }))).is_err());
        let long = "x".repeat(2001);
        assert!(crate::validators::validate_spec(&spec(json!({ "releaseCommand": long }))).is_err());
        assert!(crate::validators::validate_spec(&spec(json!({ "releaseCommand": "npm run migrate" }))).is_ok());
    }
}

#[cfg(test)]
mod caddy_config_tests {
    use super::*;

    fn route(domain: &str, path: &str, service: &str) -> ProxyRoute {
        ProxyRoute {
            domain: domain.into(),
            path: path.into(),
            service_id: service.into(),
            target_port: 3000,
            tls: true,
            force_https: true,
        }
    }

    fn handler(config: &serde_json::Value, index: usize) -> serde_json::Value {
        config["apps"]["http"]["servers"]["berth"]["routes"][index]["handle"][0].clone()
    }

    #[test]
    fn resolves_every_replica_instead_of_one_fixed_address() {
        let config = build_caddy_config(&[route("a.example.com", "/", "svc1")], None);
        let proxy = handler(&config, 0);
        assert_eq!(proxy["dynamic_upstreams"]["source"], "a");
        assert_eq!(proxy["dynamic_upstreams"]["name"], "berth-svc1");
        assert_eq!(proxy["dynamic_upstreams"]["port"], "3000");
        assert!(proxy.get("upstreams").is_none());
    }

    #[test]
    fn retries_instead_of_failing_while_a_container_is_swapped() {
        let config = build_caddy_config(&[route("a.example.com", "/", "svc1")], None);
        let proxy = handler(&config, 0);
        assert_eq!(proxy["load_balancing"]["selection_policy"]["policy"], "least_conn");
        assert_eq!(proxy["load_balancing"]["try_duration"], PROXY_RETRY_WINDOW);
    }

    #[test]
    fn backend_error_responses_never_mark_a_replica_down() {
        let config = build_caddy_config(&[route("a.example.com", "/", "svc1")], None);
        let passive = handler(&config, 0)["health_checks"]["passive"].clone();
        assert_eq!(passive["max_fails"], PROXY_MAX_FAILS);
        assert!(passive.get("unhealthy_status").is_none());
    }

    #[test]
    fn bounds_how_long_a_stuck_backend_can_hold_a_request() {
        let config = build_caddy_config(&[route("a.example.com", "/", "svc1")], None);
        let transport = handler(&config, 0)["transport"].clone();
        assert_eq!(transport["dial_timeout"], PROXY_DIAL_TIMEOUT);
        assert_eq!(transport["response_header_timeout"], PROXY_RESPONSE_HEADER_TIMEOUT);
    }

    #[test]
    fn dump_config_for_external_validation() {
        let Ok(path) = std::env::var("BERTH_CADDY_DUMP") else { return };
        let mut a = route("a.example.com", "/", "svc1");
        a.tls = false;
        let config = build_caddy_config(&[a], None);
        std::fs::write(path, serde_json::to_string_pretty(&config).unwrap()).unwrap();
    }

    #[test]
    fn access_logs_never_record_who_visited_or_what_they_asked_for() {
        let config = build_caddy_config(&[route("a.example.com", "/", "svc1")], None);
        let fields = &config["logging"]["logs"]["access"]["encoder"]["fields"];
        for key in ["request>remote_ip", "request>client_ip", "request>uri", "request>headers"] {
            assert_eq!(fields[key]["filter"], "delete", "{key} must be removed");
        }
        let default_fields = &config["logging"]["logs"]["default"]["encoder"]["fields"];
        assert_eq!(default_fields["request>remote_ip"]["filter"], "delete", "error logs must be scrubbed too");
        assert_eq!(
            config["apps"]["http"]["servers"]["berth"]["logs"]["default_logger_name"],
            "access"
        );
    }

    #[test]
    fn scoped_paths_still_come_before_the_catch_all() {
        let config = build_caddy_config(
            &[route("a.example.com", "/", "web"), route("a.example.com", "/api", "api")],
            None,
        );
        assert_eq!(handler(&config, 0)["dynamic_upstreams"]["name"], "berth-api");
        assert_eq!(handler(&config, 1)["dynamic_upstreams"]["name"], "berth-web");
    }
}

#[cfg(test)]
mod build_log_tests {
    use super::*;

    #[test]
    fn redacts_credentials_in_clone_urls() {
        let raw =
            "fatal: unable to access 'https://x-access-token:ghs_abc@github.com/o/r.git/': 403";
        let out = redact_clone_error(raw);
        assert!(!out.contains("ghs_abc"));
        assert!(out.contains("https://***@github.com/o/r.git/"));
    }

    #[test]
    fn leaves_plain_lines_alone() {
        assert_eq!(
            redact_clone_error("fatal: repository not found"),
            "fatal: repository not found"
        );
        assert_eq!(
            redact_clone_error("see https://github.com/o/r for help"),
            "see https://github.com/o/r for help"
        );
    }
}

#[cfg(test)]
mod spec_hash_tests {
    use super::*;
    use serde_json::json;

    fn spec(overrides: serde_json::Value) -> ServiceSpec {
        let mut base = json!({
            "id": "svc1",
            "name": "web",
            "serverId": "srv1",
            "source": {
                "kind": "git",
                "repo": "https://x-access-token:tok1@github.com/o/r.git",
                "branch": "main",
                "build": {
                    "builder": "auto",
                    "buildArgs": { "VITE_A": "1", "VITE_B": "2", "VITE_C": "3" }
                }
            },
            "env": [],
            "ports": [],
            "volumes": [],
            "resources": { "cpuCores": 1.0, "memoryMb": 512 },
            "healthCheck": null,
            "restartPolicy": "always",
            "replicas": 1,
            "templateKind": null
        });
        if let (Some(base), Some(extra)) = (base.as_object_mut(), overrides.as_object()) {
            for (key, value) in extra {
                base.insert(key.clone(), value.clone());
            }
        }
        serde_json::from_value(base).expect("valid spec")
    }

    #[test]
    fn identical_specs_hash_identically_across_deserializations() {
        let hashes: std::collections::HashSet<String> = (0..50)
            .map(|_| spec_hash(&spec(json!({}))).unwrap())
            .collect();
        assert_eq!(hashes.len(), 1);
    }

    #[test]
    fn rotating_the_installation_token_does_not_change_the_hash() {
        let a = spec(json!({}));
        let b = spec(json!({
            "source": {
                "kind": "git",
                "repo": "https://x-access-token:tok2@github.com/o/r.git",
                "branch": "main",
                "build": {
                    "builder": "auto",
                    "buildArgs": { "VITE_A": "1", "VITE_B": "2", "VITE_C": "3" }
                }
            }
        }));
        assert_eq!(spec_hash(&a).unwrap(), spec_hash(&b).unwrap());
    }

    #[test]
    fn resource_limit_changes_do_not_force_a_rebuild() {
        let a = spec(json!({}));
        let b =
            spec(json!({ "resources": { "cpuCores": 4.0, "memoryMb": 4096, "cpuShares": 2048 } }));
        assert_eq!(spec_hash(&a).unwrap(), spec_hash(&b).unwrap());
    }

    #[test]
    fn replica_count_changes_do_not_force_a_redeployment() {
        let single = spec(json!({ "replicas": 1 }));
        let scaled = spec(json!({ "replicas": 4 }));
        assert_eq!(spec_hash(&single).unwrap(), spec_hash(&scaled).unwrap());
    }

    #[test]
    fn replica_policy_changes_do_not_force_a_redeployment() {
        let manual = spec(json!({
            "replicaPolicy": {
                "minReplicas": 1,
                "maxReplicas": 4,
                "targetCpuPct": 70,
                "targetMemoryPct": 70,
                "strategy": "manual",
                "cooldownSeconds": 60
            }
        }));
        let automatic = spec(json!({
            "replicaPolicy": {
                "minReplicas": 1,
                "maxReplicas": 8,
                "targetCpuPct": 60,
                "targetMemoryPct": 75,
                "strategy": "balanced",
                "cooldownSeconds": 120
            }
        }));
        assert_eq!(spec_hash(&manual).unwrap(), spec_hash(&automatic).unwrap());
    }

    #[test]
    fn replica_names_map_back_to_their_service_index() {
        assert_eq!(replica_index("svc1", "berth-svc1"), Some(0));
        assert_eq!(replica_index("svc1", "berth-svc1-replica-3"), Some(3));
        assert_eq!(replica_index("svc1", "berth-other-replica-3"), None);
    }

    #[test]
    fn existing_services_keep_their_hash_when_unpinned() {
        let base = spec(json!({}));
        let unpinned = spec(json!({
            "source": {
                "kind": "git",
                "repo": "https://x-access-token:tok1@github.com/o/r.git",
                "branch": "main",
                "build": {
                    "builder": "auto",
                    "buildArgs": { "VITE_A": "1", "VITE_B": "2", "VITE_C": "3" },
                    "pinned": false
                }
            }
        }));
        assert_eq!(spec_hash(&base).unwrap(), spec_hash(&unpinned).unwrap());
    }

    #[test]
    fn pinning_a_commit_changes_the_hash() {
        let at = |pinned: bool, revision: &str| {
            spec(json!({
                "source": {
                    "kind": "git",
                    "repo": "https://x-access-token:tok1@github.com/o/r.git",
                    "branch": "main",
                    "build": { "builder": "auto", "revision": revision, "pinned": pinned }
                }
            }))
        };
        let first = "a".repeat(40);
        let second = "b".repeat(40);
        assert_ne!(
            spec_hash(&at(false, &first)).unwrap(),
            spec_hash(&at(true, &first)).unwrap()
        );
        assert_ne!(
            spec_hash(&at(true, &first)).unwrap(),
            spec_hash(&at(true, &second)).unwrap()
        );
    }

    #[test]
    fn deploy_strategy_does_not_force_a_redeployment() {
        let rolling = spec(json!({}));
        let recreate = spec(json!({ "deployStrategy": "recreate" }));
        assert_eq!(spec_hash(&rolling).unwrap(), spec_hash(&recreate).unwrap());
    }

    #[test]
    fn container_logs_are_capped() {
        let parse = |value: &str, key: &str| -> u64 {
            let number = value
                .strip_prefix(key)
                .and_then(|rest| rest.strip_prefix('='))
                .expect("expected key=value");
            number.trim_end_matches('m').parse().expect("numeric")
        };
        let size_mb = parse(LOG_MAX_SIZE, "max-size");
        let files = parse(LOG_MAX_FILES, "max-file");
        assert!((1..=100).contains(&size_mb));
        assert!((1..=10).contains(&files));
        assert!(size_mb * files <= 100, "a service must never keep more than 100 MB of logs");
    }

    #[test]
    fn only_recreate_stops_the_old_version_first() {
        assert!(!stops_old_before_start(&spec(json!({}))));
        assert!(!stops_old_before_start(&spec(json!({ "deployStrategy": "rolling" }))));
        assert!(stops_old_before_start(&spec(json!({ "deployStrategy": "recreate" }))));
    }

    #[test]
    fn a_service_with_a_volume_never_overlaps_its_old_version() {
        let with_volume = spec(json!({ "volumes": [{ "name": "db-data", "mountPath": "/data" }] }));
        assert!(stops_old_before_start(&with_volume));
    }

    #[test]
    fn a_volume_size_changes_the_hash_but_an_unsized_volume_keeps_it() {
        let plain = spec(json!({ "volumes": [{ "name": "db-data", "mountPath": "/data" }] }));
        let same = spec(json!({ "volumes": [{ "name": "db-data", "mountPath": "/data", "sizeGb": null }] }));
        let sized = spec(json!({ "volumes": [{ "name": "db-data", "mountPath": "/data", "sizeGb": 10 }] }));
        let bigger = spec(json!({ "volumes": [{ "name": "db-data", "mountPath": "/data", "sizeGb": 20 }] }));
        assert_eq!(spec_hash(&plain).unwrap(), spec_hash(&same).unwrap());
        assert_ne!(spec_hash(&plain).unwrap(), spec_hash(&sized).unwrap());
        assert_ne!(spec_hash(&sized).unwrap(), spec_hash(&bigger).unwrap());
    }

    #[test]
    fn only_commit_shas_are_checked_out() {
        assert!(looks_like_commit_sha(&"a".repeat(40)));
        assert!(looks_like_commit_sha("0123abc"));
        assert!(!looks_like_commit_sha("main"));
        assert!(!looks_like_commit_sha("abc12"));
        assert!(!looks_like_commit_sha(&format!("{}g", "a".repeat(39))));
        assert!(!looks_like_commit_sha("--upload-pack=evil"));
    }

    #[test]
    fn real_changes_change_the_hash() {
        let a = spec(json!({}));
        let env = spec(json!({ "env": [{ "key": "A", "value": "1", "isSecret": false }] }));
        let branch = spec(json!({
            "source": {
                "kind": "git",
                "repo": "https://github.com/o/r.git",
                "branch": "dev",
                "build": { "builder": "auto" }
            }
        }));
        assert_ne!(spec_hash(&a).unwrap(), spec_hash(&env).unwrap());
        assert_ne!(spec_hash(&a).unwrap(), spec_hash(&branch).unwrap());
    }
}

#[cfg(test)]
mod failure_tests {
    use super::*;

    fn running_container() -> ManagedContainer {
        ManagedContainer {
            id: "abc123".to_string(),
            name: "berth-svc".to_string(),
            service_id: "svc".to_string(),
            spec_hash: None,
            state: ServiceState::Running,
        }
    }

    #[test]
    fn a_failed_first_deploy_is_reported_as_crashed_with_its_reason() {
        let mut failed = Vec::new();
        let mut statuses = Vec::new();

        record_failure(
            &mut failed,
            &mut statuses,
            None,
            "svc",
            "pull access denied",
            None,
        );

        assert_eq!(failed.len(), 1);
        assert_eq!(failed[0].service_id, "svc");
        assert!(failed[0].reason.contains("pull access denied"));
        assert!(matches!(statuses[0].state, ServiceState::Crashed));
        assert!(!statuses[0].deployed);
    }

    #[test]
    fn a_failed_redeploy_keeps_the_running_container_untouched() {
        let mut failed = Vec::new();
        let mut statuses = Vec::new();
        let existing = running_container();

        record_failure(
            &mut failed,
            &mut statuses,
            None,
            "svc",
            "build failed",
            Some(&existing),
        );

        assert!(matches!(statuses[0].state, ServiceState::Running));
        assert_eq!(statuses[0].container_id.as_deref(), Some("abc123"));
        assert!(!statuses[0].deployed);
    }

    #[test]
    fn the_failure_reason_is_written_to_the_build_log() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let mut failed = Vec::new();
        let mut statuses = Vec::new();

        record_failure(
            &mut failed,
            &mut statuses,
            Some(&tx),
            "svc",
            "image not found",
            None,
        );

        let (service_id, line) = rx.try_recv().expect("a build log line");
        assert_eq!(service_id, "svc");
        assert!(line.contains("image not found"));
    }
}
