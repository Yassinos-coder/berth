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

    let (key_pem, csr_pem) = generate_identity_request(&config.agent_id)?;

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

fn generate_identity_request(agent_id: &str) -> AgentResult<(String, String)> {
    let mut rng = rand::thread_rng();
    let private_key = RsaPrivateKey::new(&mut rng, 2048)
        .map_err(|error| format!("failed to generate RSA key: {error}"))?;
    let key_pem = private_key.to_pkcs8_pem(LineEnding::LF)?.to_string();
    let key_pair = KeyPair::from_pem_and_sign_algo(&key_pem, &PKCS_RSA_SHA256)?;

    let mut params = CertificateParams::new(Vec::<String>::new())?;
    let mut dn = DistinguishedName::new();
    dn.push(DnType::CommonName, agent_id.to_string());
    params.distinguished_name = dn;
    let csr_pem = params.serialize_request(&key_pair)?.pem()?;
    Ok((key_pem, csr_pem))
}

fn pending_key_path(client_key_path: &str) -> String {
    format!("{client_key_path}.pending")
}

pub async fn prepare_renewal(config: &AgentConfig) -> AgentResult<String> {
    let agent_id = config.agent_id.clone();
    let generated = tokio::task::spawn_blocking(move || {
        generate_identity_request(&agent_id).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("key generation task failed: {error}"))??;
    let (key_pem, csr_pem) = generated;
    write_secure(&pending_key_path(&config.client_key_path), key_pem.as_bytes())?;
    Ok(csr_pem)
}

pub fn install_renewed_certificate(config: &AgentConfig, cert_pem: &str) -> AgentResult<()> {
    install_renewed_identity(&config.client_key_path, &config.client_cert_path, cert_pem)
}

fn install_renewed_identity(
    client_key_path: &str,
    client_cert_path: &str,
    cert_pem: &str,
) -> AgentResult<()> {
    let pending_key = pending_key_path(client_key_path);
    if !Path::new(&pending_key).exists() {
        return Err("no pending key for the renewed certificate".into());
    }
    if !cert_pem.contains("BEGIN CERTIFICATE") {
        return Err("panel sent an invalid renewed certificate".into());
    }

    let staged_cert = format!("{client_cert_path}.new");
    write_secure(&staged_cert, cert_pem.as_bytes())?;
    fs::rename(&pending_key, client_key_path)?;
    fs::rename(&staged_cert, client_cert_path)?;
    Ok(())
}

#[cfg(test)]
mod renewal_tests {
    use super::*;

    #[test]
    fn installs_the_pending_key_with_the_new_certificate() {
        let dir = std::env::temp_dir().join(format!("berth-renew-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let key = dir.join("client.key").to_string_lossy().to_string();
        let cert = dir.join("client.crt").to_string_lossy().to_string();
        fs::write(&key, "OLD KEY").unwrap();
        fs::write(&cert, "OLD CERT").unwrap();
        fs::write(pending_key_path(&key), "NEW KEY").unwrap();

        install_renewed_identity(&key, &cert, "-----BEGIN CERTIFICATE-----\nNEW\n").unwrap();

        assert_eq!(fs::read_to_string(&key).unwrap(), "NEW KEY");
        assert!(fs::read_to_string(&cert).unwrap().contains("NEW"));
        assert!(!Path::new(&pending_key_path(&key)).exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn leaves_the_current_identity_untouched_without_a_pending_key() {
        let dir = std::env::temp_dir().join(format!("berth-renew-none-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let key = dir.join("client.key").to_string_lossy().to_string();
        let cert = dir.join("client.crt").to_string_lossy().to_string();
        fs::write(&key, "OLD KEY").unwrap();
        fs::write(&cert, "OLD CERT").unwrap();

        assert!(install_renewed_identity(&key, &cert, "-----BEGIN CERTIFICATE-----").is_err());
        assert_eq!(fs::read_to_string(&key).unwrap(), "OLD KEY");
        assert_eq!(fs::read_to_string(&cert).unwrap(), "OLD CERT");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_a_non_certificate_payload_and_keeps_the_pending_key() {
        let dir = std::env::temp_dir().join(format!("berth-renew-bad-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let key = dir.join("client.key").to_string_lossy().to_string();
        let cert = dir.join("client.crt").to_string_lossy().to_string();
        fs::write(&key, "OLD KEY").unwrap();
        fs::write(pending_key_path(&key), "NEW KEY").unwrap();

        assert!(install_renewed_identity(&key, &cert, "garbage").is_err());
        assert_eq!(fs::read_to_string(&key).unwrap(), "OLD KEY");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn generated_requests_are_valid_csrs() {
        let (key, csr) = generate_identity_request("agent-1").unwrap();
        assert!(key.contains("PRIVATE KEY"));
        assert!(csr.contains("CERTIFICATE REQUEST"));
    }
}
