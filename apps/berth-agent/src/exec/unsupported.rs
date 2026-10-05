use tokio::sync::mpsc;

use crate::protocol::AgentToPanel;

#[derive(Clone)]
pub struct ExecManager {
    tx: mpsc::Sender<AgentToPanel>,
}

impl ExecManager {
    pub fn new(_docker_bin: String, tx: mpsc::Sender<AgentToPanel>) -> Self {
        Self { tx }
    }

    pub async fn start(&self, session_id: String, _container_name: String) {
        super::emit_output(&self.tx, &session_id, "interactive shells are only supported on Linux\r\n".into())
            .await;
        super::emit_exit(&self.tx, &session_id, None).await;
    }

    pub async fn input(&self, _session_id: &str, _data: &str) {}

    pub async fn resize(&self, _session_id: &str, _cols: u16, _rows: u16) {}

    pub async fn stop(&self, _session_id: &str) {}
}
