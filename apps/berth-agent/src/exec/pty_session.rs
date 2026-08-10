use std::collections::HashMap;
use std::sync::Arc;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use pty_process::{Pty, Size};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{mpsc, Mutex};

use crate::protocol::AgentToPanel;

const READ_CHUNK: usize = 4096;
const DEFAULT_ROWS: u16 = 24;
const DEFAULT_COLS: u16 = 80;

enum SessionCommand {
    Input(Vec<u8>),
    Resize(u16, u16),
    Stop,
}

#[derive(Clone)]
pub struct ExecManager {
    docker_bin: String,
    sessions: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<SessionCommand>>>>,
    tx: mpsc::Sender<AgentToPanel>,
}

impl ExecManager {
    pub fn new(docker_bin: String, tx: mpsc::Sender<AgentToPanel>) -> Self {
        Self {
            docker_bin,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            tx,
        }
    }

    pub async fn start(&self, session_id: String, container_name: String) {
        let (pty, pts) = match pty_process::open() {
            Ok(pair) => pair,
            Err(error) => {
                super::emit_output(&self.tx, &session_id, format!("failed to allocate pty: {error}\r\n"))
                    .await;
                super::emit_exit(&self.tx, &session_id, None).await;
                return;
            }
        };
        if let Err(error) = pty.resize(Size::new(DEFAULT_ROWS, DEFAULT_COLS)) {
            super::emit_output(&self.tx, &session_id, format!("failed to size pty: {error}\r\n"))
                .await;
        }

        let child = pty_process::Command::new(&self.docker_bin)
            .args(["exec", "-it", "-e", "TERM=xterm-256color", &container_name, "sh"])
            .spawn(pts);
        let child = match child {
            Ok(child) => child,
            Err(error) => {
                super::emit_output(&self.tx, &session_id, format!("failed to start shell: {error}\r\n"))
                    .await;
                super::emit_exit(&self.tx, &session_id, None).await;
                return;
            }
        };

        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
        self.sessions.lock().await.insert(session_id.clone(), cmd_tx);

        run_session(session_id, pty, child, cmd_rx, self.sessions.clone(), self.tx.clone());
    }

    pub async fn input(&self, session_id: &str, data: &str) {
        let Ok(bytes) = STANDARD.decode(data) else {
            return;
        };
        let sessions = self.sessions.lock().await;
        if let Some(cmd_tx) = sessions.get(session_id) {
            let _ = cmd_tx.send(SessionCommand::Input(bytes));
        }
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) {
        let sessions = self.sessions.lock().await;
        if let Some(cmd_tx) = sessions.get(session_id) {
            let _ = cmd_tx.send(SessionCommand::Resize(rows, cols));
        }
    }

    pub async fn stop(&self, session_id: &str) {
        if let Some(cmd_tx) = self.sessions.lock().await.remove(session_id) {
            let _ = cmd_tx.send(SessionCommand::Stop);
        }
    }

    pub fn run_command(&self, run_id: String, container_name: String, command: Vec<String>) {
        super::spawn_run_command(self.docker_bin.clone(), self.tx.clone(), run_id, container_name, command);
    }
}

fn run_session(
    session_id: String,
    mut pty: Pty,
    mut child: tokio::process::Child,
    mut cmd_rx: mpsc::UnboundedReceiver<SessionCommand>,
    sessions: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<SessionCommand>>>>,
    tx: mpsc::Sender<AgentToPanel>,
) {
    tokio::spawn(async move {
        let mut buf = [0u8; READ_CHUNK];
        loop {
            tokio::select! {
                result = pty.read(&mut buf) => {
                    match result {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            let event = AgentToPanel::ExecOutput {
                                session_id: session_id.clone(),
                                data: STANDARD.encode(&buf[..n]),
                            };
                            if tx.send(event).await.is_err() {
                                break;
                            }
                        }
                    }
                }
                command = cmd_rx.recv() => {
                    match command {
                        Some(SessionCommand::Input(bytes)) => {
                            let _ = pty.write_all(&bytes).await;
                        }
                        Some(SessionCommand::Resize(rows, cols)) => {
                            let _ = pty.resize(Size::new(rows, cols));
                        }
                        Some(SessionCommand::Stop) | None => {
                            let _ = child.start_kill();
                            break;
                        }
                    }
                }
            }
        }

        let status = child.wait().await.ok();
        sessions.lock().await.remove(&session_id);
        let _ = tx
            .send(AgentToPanel::ExecExit {
                session_id,
                exit_code: status.and_then(|s| s.code()),
            })
            .await;
    });
}
