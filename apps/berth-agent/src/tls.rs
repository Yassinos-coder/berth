use std::fs;
use std::sync::Arc;

use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::{ClientConfig, RootCertStore};

use crate::docker::AgentResult;

pub fn install_crypto_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

pub fn enrollment_config(ca_path: &str) -> AgentResult<Arc<ClientConfig>> {
    let roots = load_roots(ca_path)?;
    let config = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    Ok(Arc::new(config))
}

pub fn mtls_config(
    ca_path: &str,
    cert_path: &str,
    key_path: &str,
) -> AgentResult<Arc<ClientConfig>> {
    let roots = load_roots(ca_path)?;
    let certs = load_certs(cert_path)?;
    let key = load_key(key_path)?;
    let config = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_client_auth_cert(certs, key)?;
    Ok(Arc::new(config))
}

fn load_roots(path: &str) -> AgentResult<RootCertStore> {
    let mut roots = RootCertStore::empty();
    for cert in load_certs(path)? {
        roots.add(cert)?;
    }
    if roots.is_empty() {
        return Err(format!("no CA certificates found in {path}").into());
    }
    Ok(roots)
}

fn load_certs(path: &str) -> AgentResult<Vec<CertificateDer<'static>>> {
    let data = fs::read(path)?;
    let certs = CertificateDer::pem_slice_iter(&data).collect::<Result<Vec<_>, _>>()?;
    Ok(certs)
}

fn load_key(path: &str) -> AgentResult<PrivateKeyDer<'static>> {
    let data = fs::read(path)?;
    PrivateKeyDer::from_pem_slice(&data)
        .map_err(|error| format!("no private key found in client key file: {error}").into())
}
