use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSpec {
    pub id: String,
    pub name: String,
    pub server_id: String,
    pub source: ServiceSource,
    pub env: Vec<EnvVar>,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMount>,
    #[serde(default)]
    pub command: Vec<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub resources: ResourceLimits,
    pub health_check: Option<HealthCheck>,
    pub restart_policy: RestartPolicy,
    pub replicas: u32,
    #[serde(rename = "templateKind")]
    pub template_kind: Option<String>,
    #[serde(default)]
    pub registry_auth: Option<RegistryAuth>,
    #[serde(default)]
    pub target_platform: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryAuth {
    pub server: String,
    pub username: String,
    pub password: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ServiceSource {
    Image { image: String, tag: String },
    Git {
        repo: String,
        branch: String,
        build: BuildConfig,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildConfig {
    pub builder: BuilderKind,
    pub dockerfile_path: Option<String>,
    pub build_args: Option<std::collections::HashMap<String, String>>,
    pub root_directory: Option<String>,
    pub build_command: Option<String>,
    pub start_command: Option<String>,
    pub revision: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BuilderKind {
    Auto,
    Nixpacks,
    Dockerfile,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceLimits {
    pub cpu_cores: f64,
    pub memory_mb: u64,
    pub cpu_shares: Option<i64>,
    pub pids_limit: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortMapping {
    pub container_port: u16,
    pub domain: Option<String>,
    pub public: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeMount {
    pub name: String,
    pub mount_path: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVar {
    pub key: String,
    pub value: String,
    pub is_secret: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheck {
    pub path: Option<String>,
    pub port: Option<u16>,
    pub interval_seconds: u64,
    pub timeout_seconds: u64,
    pub retries: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum RestartPolicy {
    #[serde(rename = "no")]
    No,
    #[serde(rename = "on-failure")]
    OnFailure,
    #[serde(rename = "always")]
    Always,
    #[serde(rename = "unless-stopped")]
    UnlessStopped,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceState {
    Building,
    Starting,
    Running,
    Unhealthy,
    Stopped,
    Crashed,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSpecs {
    pub hostname: String,
    pub cpu_cores: u32,
    pub memory_mb: u64,
    pub disk_gb: u64,
    pub os: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedApply {
    pub service_id: String,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyRoute {
    pub domain: String,
    pub service_id: String,
    pub target_port: u16,
    pub tls: bool,
    pub force_https: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelRoute {
    pub domain: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PanelToAgent {
    Reconcile {
        services: Vec<ServiceSpec>,
        #[serde(default)]
        proxies: Vec<ProxyRoute>,
        #[serde(default)]
        panel: Option<PanelRoute>,
        #[serde(rename = "forceServiceIds", default)]
        force_service_ids: Vec<String>,
    },
    RemoveService {
        #[serde(rename = "serviceId")]
        service_id: String,
    },
    StreamLogs {
        #[serde(rename = "serviceId")]
        service_id: String,
        follow: bool,
    },
    GetMetrics {
        #[serde(rename = "serviceId")]
        service_id: Option<String>,
    },
    SelfUpdate,
    RunBackup {
        #[serde(rename = "serviceId")]
        service_id: String,
        #[serde(rename = "backupId")]
        backup_id: String,
        #[serde(rename = "containerName")]
        container_name: String,
        #[serde(rename = "dumpCommand")]
        dump_command: String,
        target: BackupTarget,
        #[serde(rename = "objectKey")]
        object_key: String,
    },
    RunRestore {
        #[serde(rename = "serviceId")]
        service_id: String,
        #[serde(rename = "containerName")]
        container_name: String,
        #[serde(rename = "restoreCommand")]
        restore_command: String,
        target: BackupTarget,
        #[serde(rename = "objectKey")]
        object_key: String,
    },
    ExecStart {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "containerName")]
        container_name: String,
    },
    ExecInput {
        #[serde(rename = "sessionId")]
        session_id: String,
        data: String,
    },
    ExecStop {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    ExecResize {
        #[serde(rename = "sessionId")]
        session_id: String,
        cols: u16,
        rows: u16,
    },
    RunCommand {
        #[serde(rename = "runId")]
        run_id: String,
        #[serde(rename = "containerName")]
        container_name: String,
        command: Vec<String>,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupTarget {
    pub endpoint: String,
    pub bucket: String,
    #[serde(default)]
    pub region: Option<String>,
    pub access_key_id: String,
    pub secret_access_key: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AgentToPanel {
    Enrolled {
        #[serde(rename = "agentId")]
        agent_id: String,
        #[serde(rename = "serverSpecs")]
        server_specs: ServerSpecs,
    },
    ServiceStatus {
        #[serde(rename = "serviceId")]
        service_id: String,
        state: ServiceState,
        #[serde(rename = "containerId")]
        container_id: Option<String>,
        deployed: bool,
    },
    BuildProgress {
        #[serde(rename = "serviceId")]
        service_id: String,
        stage: String,
        #[serde(rename = "logChunk")]
        log_chunk: String,
    },
    LogChunk {
        #[serde(rename = "serviceId")]
        service_id: String,
        line: String,
        ts: i64,
    },
    Metrics {
        #[serde(rename = "serviceId")]
        service_id: String,
        #[serde(rename = "cpuPct")]
        cpu_pct: f64,
        #[serde(rename = "memMb")]
        mem_mb: f64,
        #[serde(rename = "netRxMb")]
        net_rx_mb: f64,
        #[serde(rename = "netTxMb")]
        net_tx_mb: f64,
    },
    HostUsage {
        #[serde(rename = "diskUsedGb")]
        disk_used_gb: f64,
        #[serde(rename = "diskTotalGb")]
        disk_total_gb: f64,
    },
    ReconcileResult {
        applied: Vec<String>,
        failed: Vec<FailedApply>,
    },
    BackupResult {
        #[serde(rename = "backupId")]
        backup_id: String,
        success: bool,
        #[serde(rename = "sizeBytes")]
        size_bytes: Option<u64>,
        error: Option<String>,
    },
    RestoreResult {
        #[serde(rename = "serviceId")]
        service_id: String,
        success: bool,
        error: Option<String>,
    },
    ExecOutput {
        #[serde(rename = "sessionId")]
        session_id: String,
        data: String,
    },
    ExecExit {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "exitCode")]
        exit_code: Option<i32>,
    },
    CommandResult {
        #[serde(rename = "runId")]
        run_id: String,
        output: String,
        #[serde(rename = "exitCode")]
        exit_code: Option<i32>,
    },
}
