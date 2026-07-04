use std::fs;
use std::path::Path;

use futures_util::{SinkExt, StreamExt};
use rcgen::{CertificateParams, DistinguishedName, DnType, KeyPair, PKCS_RSA_SHA256};
use rsa::pkcs8::{EncodePrivateKey, LineEnding};
use rsa::RsaPrivateKey;
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{
    connect_async_tls_with_config, tungstenite::Message, Connector,
};

use crate::config::AgentConfig;
use crate::docker::AgentResult;
use crate::tls;

#[derive(Serialize)]
struct CsrRequest {
    csr: String,
}

#[derive(Deserialize)]
struct EnrollResponse {
    #[serde(rename = "certPem")]
    cert_pem: Option<String>,
    #[serde(rename = "caPem")]
    ca_pem: Option<String>,
    error: Option<String>,
}

pub fn is_enrolled(config: &AgentConfig) -> bool {
    Path::new(&config.client_cert_path).exists()
        && Path::new(&config.client_key_path).exists()
}

pub async fn enroll(config: &AgentConfig) -> AgentResult<()> {
    let base = config
        .panel_url
        .clone()
        .ok_or("BERTH_PANEL_URL is required to enroll")?;
    let token = config
        .bootstrap_token
        .clone()
        .ok_or("BERTH_BOOTSTRAP is required to enroll")?;

    let mut rng = rand::thread_rng();
    let private_key = RsaPrivateKey::new(&mut rng, 2048)
        .map_err(|error| format!("failed to generate RSA key: {error}"))?;
    let key_pem = private_key.to_pkcs8_pem(LineEnding::LF)?.to_string();
    let key_pair = KeyPair::from_pem_and_sign_algo(&key_pem, &PKCS_RSA_SHA256)?;

    let mut params = CertificateParams::new(Vec::<String>::new())?;
    let mut dn = DistinguishedName::new();
    dn.push(DnType::CommonName, config.agent_id.clone());
    params.distinguished_name = dn;
    let csr_pem = params.serialize_request(&key_pair)?.pem()?;

    let connector = Connector::Rustls(tls::enrollment_config(&config.ca_cert_path)?);
    let url = format!("{}/enroll?bootstrap={}", base.trim_end_matches('/'), token);
    let (mut socket, _) =
        connect_async_tls_with_config(url, None, false, Some(connector)).await?;

    let request = serde_json::to_string(&CsrRequest { csr: csr_pem })?;
    socket.send(Message::Text(request)).await?;

    let response = read_response(&mut socket).await?;
    let _ = socket.close(None).await;

    if let Some(error) = response.error {
        return Err(format!("enrollment rejected: {error}").into());
    }
    let cert_pem = response
        .cert_pem
        .ok_or("panel did not return a certificate")?;

    write_secure(&config.client_key_path, key_pem.as_bytes())?;
    write_secure(&config.client_cert_path, cert_pem.as_bytes())?;
    if let Some(ca) = response.ca_pem {
        if !Path::new(&config.ca_cert_path).exists() {
            write_secure(&config.ca_cert_path, ca.as_bytes())?;
        }
    }

    Ok(())
}

async fn read_response<S>(socket: &mut S) -> AgentResult<EnrollResponse>
where
    S: StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    while let Some(message) = socket.next().await {
        let message = message?;
        if message.is_text() {
            return Ok(serde_json::from_str::<EnrollResponse>(message.to_text()?)?);
        }
    }
    Err("panel closed the enrollment connection without a response".into())
}

fn write_secure(path: &str, data: &[u8]) -> AgentResult<()> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, data)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}
