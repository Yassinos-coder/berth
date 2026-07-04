use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::{
    connect_async_tls_with_config, tungstenite::Message, Connector, MaybeTlsStream,
    WebSocketStream,
};

use crate::config::AgentConfig;
use crate::docker::{AgentResult, DockerReconciler};
use crate::enroll;
use crate::host::collect_server_specs;
use crate::protocol::{AgentToPanel, PanelToAgent, ServiceState};
use crate::tls;

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;

const MAX_MESSAGE_BYTES: usize = 1 << 20;
const INITIAL_BACKOFF: Duration = Duration::from_secs(1);
const MAX_BACKOFF: Duration = Duration::from_secs(60);

pub async fn run(config: AgentConfig) -> AgentResult<()> {
    tls::install_crypto_provider();

    let base = config
        .panel_url
        .clone()
        .ok_or("BERTH_PANEL_URL is required for `berth-agent run`")?;

    let reconciler = DockerReconciler::new(config.docker_bin.clone());
    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);
    let mut backoff = INITIAL_BACKOFF;

    loop {
        tokio::select! {
            _ = &mut shutdown => {
                eprintln!("[berth-agent] shutdown signal received");
                return Ok(());
            }
            result = session_cycle(&base, &config, &reconciler) => {
                match result {
                    Ok(()) => backoff = INITIAL_BACKOFF,
                    Err(error) => eprintln!("[berth-agent] session ended: {error}"),
                }
            }
        }

        let jitter = Duration::from_millis(rand::random::<u64>() % 1_000);
        tokio::select! {
            _ = &mut shutdown => return Ok(()),
            _ = tokio::time::sleep(backoff + jitter) => {}
        }
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
}

async fn session_cycle(
    base: &str,
    config: &AgentConfig,
    reconciler: &DockerReconciler,
) -> AgentResult<()> {
    if !enroll::is_enrolled(config) {
        eprintln!("[berth-agent] no client certificate — enrolling with the panel");
        enroll::enroll(config).await?;
        eprintln!("[berth-agent] enrolled successfully");
    }
    connect_and_serve(base, config, reconciler).await
}

async fn connect_and_serve(
    base: &str,
    config: &AgentConfig,
    reconciler: &DockerReconciler,
) -> AgentResult<()> {
    let connector = Connector::Rustls(tls::mtls_config(
        &config.ca_cert_path,
        &config.client_cert_path,
        &config.client_key_path,
    )?);
    let url = format!("{}/agent", base.trim_end_matches('/'));

    let ws_config = WebSocketConfig {
        max_message_size: Some(MAX_MESSAGE_BYTES),
        max_frame_size: Some(MAX_MESSAGE_BYTES),
        ..Default::default()
    };

    let (mut socket, _) =
        connect_async_tls_with_config(url, Some(ws_config), false, Some(connector)).await?;

    let enrolled = AgentToPanel::Enrolled {
        agent_id: config.agent_id.clone(),
        server_specs: collect_server_specs(),
    };
    send_json(&mut socket, &enrolled).await?;

    while let Some(message) = socket.next().await {
        let message = match message {
            Ok(message) => message,
            Err(error) => {
                eprintln!("[berth-agent] websocket error: {error}");
                break;
            }
        };

        if !message.is_text() {
            continue;
        }

        let text = match message.to_text() {
            Ok(text) => text,
            Err(_) => continue,
        };

        let inbound = match serde_json::from_str::<PanelToAgent>(text) {
            Ok(inbound) => inbound,
            Err(error) => {
                eprintln!("[berth-agent] ignoring malformed message: {error}");
                continue;
            }
        };

        if let Err(error) = handle_message(inbound, reconciler, &mut socket).await {
            eprintln!("[berth-agent] handler error (continuing): {error}");
        }
    }

    Ok(())
}

async fn handle_message(
    inbound: PanelToAgent,
    reconciler: &DockerReconciler,
    socket: &mut Socket,
) -> AgentResult<()> {
    match inbound {
        PanelToAgent::Reconcile { services } => {
            let outcome = reconciler.reconcile(&services).await?;

            for status in outcome.statuses {
                let event = AgentToPanel::ServiceStatus {
                    service_id: status.service_id,
                    state: status.state,
                    container_id: status.container_id,
                };
                send_json(socket, &event).await?;
            }

            let result = AgentToPanel::ReconcileResult {
                applied: outcome.applied,
                failed: outcome.failed,
            };
            send_json(socket, &result).await?;
        }
        PanelToAgent::RemoveService { service_id } => {
            let removed = reconciler.remove_service(&service_id).await?;
            if removed {
                let event = AgentToPanel::ServiceStatus {
                    service_id,
                    state: ServiceState::Stopped,
                    container_id: None,
                };
                send_json(socket, &event).await?;
            }
        }
        PanelToAgent::StreamLogs { service_id, .. } => {
            eprintln!("[berth-agent] log streaming not implemented for {service_id}");
        }
        PanelToAgent::GetMetrics { service_id } => {
            eprintln!("[berth-agent] metrics not implemented: {service_id:?}");
        }
    }

    Ok(())
}

async fn send_json(socket: &mut Socket, message: &AgentToPanel) -> AgentResult<()> {
    let payload = serde_json::to_string(message)?;
    socket.send(Message::Text(payload)).await?;
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut term = match signal(SignalKind::terminate()) {
            Ok(term) => term,
            Err(_) => return std::future::pending::<()>().await,
        };
        let mut interrupt = match signal(SignalKind::interrupt()) {
            Ok(interrupt) => interrupt,
            Err(_) => return std::future::pending::<()>().await,
        };
        tokio::select! {
            _ = term.recv() => {}
            _ = interrupt.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
