use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::config::AgentConfig;
use crate::docker::{AgentResult, DockerReconciler};
use crate::host::collect_server_specs;
use crate::protocol::{AgentToPanel, PanelToAgent, ServiceState};

pub async fn run(config: AgentConfig) -> AgentResult<()> {
    let Some(base_url) = config.panel_url.clone() else {
        return Err("BERTH_PANEL_URL is required for `berth-agent run`".into());
    };

    let connect_url = if let Some(token) = config.bootstrap_token.as_deref() {
        append_query_param(&base_url, "bootstrap", token)
    } else {
        base_url
    };

    let (mut socket, _) = connect_async(connect_url).await?;
    let reconciler = DockerReconciler::new(config.docker_bin.clone());
    let enrolled = AgentToPanel::Enrolled {
        agent_id: config.agent_id,
        server_specs: collect_server_specs(),
    };

    send_json(&mut socket, &enrolled).await?;

    while let Some(message) = socket.next().await {
        let message = message?;

        if !message.is_text() {
            continue;
        }

        let inbound: PanelToAgent = serde_json::from_str(message.to_text()?)?;

        match inbound {
            PanelToAgent::Reconcile { services } => {
                let outcome = reconciler.reconcile(&services).await?;

                for status in outcome.statuses {
                    let event = AgentToPanel::ServiceStatus {
                        service_id: status.service_id,
                        state: status.state,
                        container_id: status.container_id,
                    };
                    send_json(&mut socket, &event).await?;
                }

                let result = AgentToPanel::ReconcileResult {
                    applied: outcome.applied,
                    failed: outcome.failed,
                };
                send_json(&mut socket, &result).await?;
            }
            PanelToAgent::RemoveService { service_id } => {
                let removed = reconciler.remove_service(&service_id).await?;
                if removed {
                    let event = AgentToPanel::ServiceStatus {
                        service_id,
                        state: ServiceState::Stopped,
                        container_id: None,
                    };
                    send_json(&mut socket, &event).await?;
                }
            }
            PanelToAgent::StreamLogs { service_id, .. } => {
                eprintln!("stream logs is not implemented yet for service `{service_id}`");
            }
            PanelToAgent::GetMetrics { service_id } => {
                eprintln!("metrics collection is not implemented yet: {:?}", service_id);
            }
        }
    }

    Ok(())
}

async fn send_json(
    socket: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    message: &AgentToPanel,
) -> AgentResult<()> {
    let payload = serde_json::to_string(message)?;
    socket.send(Message::Text(payload.into())).await?;
    Ok(())
}

fn append_query_param(base_url: &str, key: &str, value: &str) -> String {
    if base_url.contains('?') {
        format!("{base_url}&{key}={value}")
    } else {
        format!("{base_url}?{key}={value}")
    }
}
