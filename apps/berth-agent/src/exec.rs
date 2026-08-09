use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, ChildStdin};
use tokio::process::Command;
use tokio::sync::{mpsc, Mutex};

use crate::protocol::AgentToPanel;

const READ_CHUNK: usize = 4096;

struct ExecSession {
    stdin: ChildStdin,
}

#[derive(Clone)]
pub struct ExecManager {
    docker_bin: String,
    sessions: Arc<Mutex<HashMap<String, ExecSession>>>,
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
        let mut child = match Command::new(&self.docker_bin)
            .args(["exec", "-i", &container_name, "sh"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                self.emit_output(&session_id, format!("failed to start shell: {error}\r\n"))
                    .await;
                self.emit_exit(&session_id, None).await;
                return;
            }
        };

        let Some(stdin) = child.stdin.take() else {
            self.emit_exit(&session_id, None).await;
            return;
        };
        let Some(stdout) = child.stdout.take() else {
            self.emit_exit(&session_id, None).await;
            return;
        };
        let Some(stderr) = child.stderr.take() else {
            self.emit_exit(&session_id, None).await;
            return;
        };

        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), ExecSession { stdin });

        spawn_reader(stdout, session_id.clone(), self.tx.clone());
        spawn_reader(stderr, session_id.clone(), self.tx.clone());
        spawn_waiter(child, session_id, self.sessions.clone(), self.tx.clone());
    }

    pub async fn input(&self, session_id: &str, data: &str) {
        let Ok(bytes) = STANDARD.decode(data) else {
            return;
        };
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(session_id) {
            let _ = session.stdin.write_all(&bytes).await;
        }
    }

    pub async fn stop(&self, session_id: &str) {
        // Dropping stdin closes the pipe, the shell sees EOF and exits; the
        // waiter task removes the session and reports ExecExit.
        self.sessions.lock().await.remove(session_id);
    }

    pub fn run_command(&self, run_id: String, container_name: String, command: Vec<String>) {
        let docker_bin = self.docker_bin.clone();
        let tx = self.tx.clone();
        tokio::spawn(async move {
            let result = if command.is_empty() {
                Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "command is empty"))
            } else {
                Command::new(docker_bin)
                    .arg("exec")
                    .arg(container_name)
                    .args(command)
                    .output()
                    .await
            };
            let (output, exit_code) = match result {
                Ok(result) => {
                    let mut bytes = result.stdout;
                    bytes.extend_from_slice(&result.stderr);
                    bytes.truncate(1024 * 1024);
                    (String::from_utf8_lossy(&bytes).into_owned(), result.status.code())
                }
                Err(error) => (error.to_string(), None),
            };
            let _ = tx.send(AgentToPanel::CommandResult { run_id, output, exit_code }).await;
        });
    }

    async fn emit_output(&self, session_id: &str, text: String) {
        let _ = self
            .tx
            .send(AgentToPanel::ExecOutput {
                session_id: session_id.to_string(),
                data: STANDARD.encode(text),
            })
            .await;
    }

    async fn emit_exit(&self, session_id: &str, exit_code: Option<i32>) {
        let _ = self
            .tx
            .send(AgentToPanel::ExecExit {
                session_id: session_id.to_string(),
                exit_code,
            })
            .await;
    }
}

fn spawn_reader(
    mut reader: impl AsyncReadExt + Unpin + Send + 'static,
    session_id: String,
    tx: mpsc::Sender<AgentToPanel>,
) {
    tokio::spawn(async move {
        let mut buf = [0u8; READ_CHUNK];
        loop {
            match reader.read(&mut buf).await {
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
    });
}

fn spawn_waiter(
    mut child: Child,
    session_id: String,
    sessions: Arc<Mutex<HashMap<String, ExecSession>>>,
    tx: mpsc::Sender<AgentToPanel>,
) {
    tokio::spawn(async move {
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
