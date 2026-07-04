use std::env;

const DEFAULT_STATE_DIR: &str = "/etc/berth";

#[derive(Clone, Debug)]
pub struct AgentConfig {
    pub panel_url: Option<String>,
    pub bootstrap_token: Option<String>,
    pub agent_id: String,
    pub docker_bin: String,
    pub ca_cert_path: String,
    pub client_cert_path: String,
    pub client_key_path: String,
}

impl AgentConfig {
    pub fn from_env() -> Self {
        let hostname = env::var("BERTH_AGENT_ID")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(detect_hostname)
            .unwrap_or_else(|| "berth-agent-unknown".to_string());

        let state_dir = env::var("BERTH_STATE_DIR")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_STATE_DIR.to_string());

        Self {
            panel_url: env::var("BERTH_PANEL_URL")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            bootstrap_token: env::var("BERTH_BOOTSTRAP")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            agent_id: hostname,
            docker_bin: env::var("BERTH_DOCKER_BIN")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "docker".to_string()),
            ca_cert_path: path_from_env("BERTH_CA_CERT_PATH", &state_dir, "ca.crt"),
            client_cert_path: path_from_env("BERTH_CLIENT_CERT_PATH", &state_dir, "agent.crt"),
            client_key_path: path_from_env("BERTH_CLIENT_KEY_PATH", &state_dir, "agent.key"),
        }
    }
}

fn path_from_env(key: &str, state_dir: &str, file: &str) -> String {
    env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{state_dir}/{file}"))
}

fn detect_hostname() -> Option<String> {
    env::var("HOSTNAME")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            env::var("COMPUTERNAME")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
}
