#![forbid(unsafe_code)]

mod config;
mod docker;
mod enroll;
mod host;
mod panel;
mod protocol;
mod tls;
mod validators;

use config::AgentConfig;
use docker::{AgentResult, DockerReconciler};
use host::collect_server_specs;
use protocol::{AgentToPanel, PanelToAgent, ServiceSpec};

#[tokio::main]
async fn main() -> AgentResult<()> {
    let config = AgentConfig::from_env();
    let args: Vec<String> = std::env::args().skip(1).collect();

    match args.first().map(String::as_str) {
        None | Some("run") => panel::run(config).await,
        Some("server-specs") => {
            println!("{}", serde_json::to_string_pretty(&collect_server_specs())?);
            Ok(())
        }
        Some("reconcile-file") => {
            let Some(path) = args.get(1) else {
                return Err("usage: berth-agent reconcile-file <path-to-json>".into());
            };

            let desired = load_desired_state(path).await?;
            let reconciler = DockerReconciler::new(config.docker_bin);
            let outcome = reconciler.reconcile(&desired).await?;
            let result = AgentToPanel::ReconcileResult {
                applied: outcome.applied,
                failed: outcome.failed,
            };

            println!("{}", serde_json::to_string_pretty(&result)?);
            Ok(())
        }
        Some("help") | Some("--help") | Some("-h") => {
            print_help();
            Ok(())
        }
        Some(other) => Err(format!("unknown command `{other}`").into()),
    }
}

async fn load_desired_state(path: &str) -> AgentResult<Vec<ServiceSpec>> {
    let raw = tokio::fs::read_to_string(path).await?;

    if let Ok(message) = serde_json::from_str::<PanelToAgent>(&raw) {
        return match message {
            PanelToAgent::Reconcile { services } => Ok(services),
            _ => Err("expected a Reconcile message in the JSON file".into()),
        };
    }

    Ok(serde_json::from_str::<Vec<ServiceSpec>>(&raw)?)
}

fn print_help() {
    println!("berth-agent");
    println!();
    println!("Commands:");
    println!("  run                 Connect to the panel and reconcile incoming messages");
    println!("  server-specs        Print the detected host specs as JSON");
    println!("  reconcile-file      Reconcile a local JSON file containing ServiceSpec[]");
}
