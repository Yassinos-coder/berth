use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use tokio::sync::mpsc;

use crate::protocol::AgentToPanel;

#[cfg(unix)]
mod pty_session;
#[cfg(unix)]
pub use pty_session::ExecManager;

// berth-agent only ships for Linux (see install.sh), but keeping the crate
// buildable on non-Unix hosts lets contributors `cargo check` without a real
// pty. pty-process itself only supports Unix.
#[cfg(not(unix))]
mod unsupported;
#[cfg(not(unix))]
pub use unsupported::ExecManager;

pub(crate) async fn emit_output(tx: &mpsc::Sender<AgentToPanel>, session_id: &str, text: String) {
    let _ = tx
        .send(AgentToPanel::ExecOutput {
            session_id: session_id.to_string(),
            data: STANDARD.encode(text),
        })
        .await;
}

pub(crate) async fn emit_exit(tx: &mpsc::Sender<AgentToPanel>, session_id: &str, exit_code: Option<i32>) {
    let _ = tx
        .send(AgentToPanel::ExecExit {
            session_id: session_id.to_string(),
            exit_code,
        })
        .await;
}
