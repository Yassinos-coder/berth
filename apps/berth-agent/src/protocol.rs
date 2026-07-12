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
    pub resources: ResourceLimits,
    pub health_check: Option<HealthCheck>,
    pub restart_policy: RestartPolicy,
    pub replicas: u32,
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
#[serde(tag = "type")]
pub enum PanelToAgent {
    Reconcile { services: Vec<ServiceSpec> },
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
    },
    ReconcileResult {
        applied: Vec<String>,
        failed: Vec<FailedApply>,
    },
}
