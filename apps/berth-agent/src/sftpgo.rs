//! REST client for the shared `berth-sftpgo` gateway container. Bucket
//! services are provisioned as SFTPGo users backed by their own MinIO
//! instance's S3 API — see `DockerReconciler::ensure_sftpgo` in `docker.rs`
//! for the container lifecycle and MinIO-side bucket creation.

use std::collections::HashSet;

use serde::Deserialize;
use serde_json::json;

use crate::docker::AgentResult;

const STATE_DIR: &str = "/var/lib/berth/sftpgo";
const ADMIN_SECRET_PATH: &str = "/var/lib/berth/sftpgo/admin.secret";
pub const ADMIN_USERNAME: &str = "berth-agent";
const API_BASE: &str = "http://berth-sftpgo:8080/api/v2";

#[derive(Clone, Debug)]
pub struct BucketUser {
    pub username: String,
    pub password: String,
    pub endpoint: String,
    pub bucket: String,
}

/// Returns the persisted admin password, generating and persisting a new one
/// on first use. Stable across agent restarts so previously-issued API
/// tokens and the SFTPGo container's own on-disk admin account stay valid.
pub async fn ensure_admin_secret() -> AgentResult<String> {
    if let Ok(existing) = tokio::fs::read_to_string(ADMIN_SECRET_PATH).await {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }

    let generated = random_secret(32);
    tokio::fs::create_dir_all(STATE_DIR).await?;
    tokio::fs::write(ADMIN_SECRET_PATH, &generated).await?;
    Ok(generated)
}

fn random_secret(len: usize) -> String {
    use rand::distributions::Alphanumeric;
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

async fn fetch_token(client: &reqwest::Client, admin_password: &str) -> AgentResult<String> {
    let response = client
        .get(format!("{API_BASE}/token"))
        .basic_auth(ADMIN_USERNAME, Some(admin_password))
        .send()
        .await?
        .error_for_status()?;
    let token: TokenResponse = response.json().await?;
    Ok(token.access_token)
}

#[derive(Deserialize)]
struct UserSummary {
    username: String,
}

async fn list_usernames(client: &reqwest::Client, token: &str) -> AgentResult<Vec<String>> {
    let response = client
        .get(format!("{API_BASE}/users?limit=500"))
        .bearer_auth(token)
        .send()
        .await?
        .error_for_status()?;
    let users: Vec<UserSummary> = response.json().await?;
    Ok(users.into_iter().map(|user| user.username).collect())
}

async fn upsert_user(
    client: &reqwest::Client,
    token: &str,
    user: &BucketUser,
    exists: bool,
) -> AgentResult<()> {
    let body = json!({
        "status": 1,
        "username": user.username,
        "password": user.password,
        "permissions": { "/": ["*"] },
        "filesystem": {
            "provider": 1,
            "s3config": {
                "bucket": user.bucket,
                "region": "us-east-1",
                "access_key": user.username,
                "access_secret": { "status": "Plain", "payload": user.password },
                "endpoint": user.endpoint,
                "force_path_style": true,
            },
        },
    });

    let request = if exists {
        client
            .put(format!("{API_BASE}/users/{}", user.username))
            .bearer_auth(token)
            .json(&body)
    } else {
        client
            .post(format!("{API_BASE}/users"))
            .bearer_auth(token)
            .json(&body)
    };
    request.send().await?.error_for_status()?;
    Ok(())
}

async fn delete_user(client: &reqwest::Client, token: &str, username: &str) -> AgentResult<()> {
    client
        .delete(format!("{API_BASE}/users/{username}"))
        .bearer_auth(token)
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

/// Syncs the SFTPGo user list to exactly `users` — upserts everything
/// desired, removes anything else. Mirrors the panel's declarative
/// Reconcile model: SFTPGo is entirely agent-managed, so anything not in
/// `users` is considered stale.
pub async fn sync_users(admin_password: &str, users: &[BucketUser]) -> AgentResult<()> {
    let client = reqwest::Client::new();
    let token = fetch_token(&client, admin_password).await?;
    let existing = list_usernames(&client, &token).await.unwrap_or_default();
    let desired: HashSet<&str> = users.iter().map(|user| user.username.as_str()).collect();

    for user in users {
        let exists = existing.iter().any(|name| name == &user.username);
        if let Err(error) = upsert_user(&client, &token, user, exists).await {
            eprintln!(
                "[berth-agent] sftpgo: failed to upsert user {}: {error}",
                user.username
            );
        }
    }

    for username in &existing {
        if !desired.contains(username.as_str()) {
            if let Err(error) = delete_user(&client, &token, username).await {
                eprintln!("[berth-agent] sftpgo: failed to remove stale user {username}: {error}");
            }
        }
    }

    Ok(())
}
