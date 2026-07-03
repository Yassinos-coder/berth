use std::env;

#[derive(Clone, Debug)]
pub struct AgentConfig {
    pub panel_url: Option<String>,
    pub bootstrap_token: Option<String>,
    pub agent_id: String,
    pub docker_bin: String,
}

impl AgentConfig {
    pub fn from_env() -> Self {
        let hostname = env::var("BERTH_AGENT_ID")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(detect_hostname)
            .unwrap_or_else(|| "berth-agent-unknown".to_string());

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
        }
    }
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
