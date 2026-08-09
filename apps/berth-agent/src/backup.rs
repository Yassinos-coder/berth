use std::path::Path;
use std::process::Stdio;

use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;

use crate::docker::AgentResult;
use crate::protocol::BackupTarget;

const BACKUP_DIR: &str = "/var/lib/berth/backups";
const MC_IMAGE: &str = "minio/mc:latest";
const MC_ALIAS: &str = "backup-target";

pub async fn run_backup(
    docker_bin: &str,
    container_name: &str,
    dump_command: &str,
    target: &BackupTarget,
    object_key: &str,
) -> AgentResult<u64> {
    fs::create_dir_all(BACKUP_DIR).await.ok();
    let local_path = format!("{BACKUP_DIR}/{}", sanitize_filename(object_key));

    let mut child = Command::new(docker_bin)
        .args(["exec", container_name, "sh", "-c", dump_command])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or("failed to capture dump output")?;
    let mut file = fs::File::create(&local_path).await?;
    let size = tokio::io::copy(&mut stdout, &mut file).await?;
    drop(file);

    let output = child.wait_with_output().await?;
    if !output.status.success() {
        let _ = fs::remove_file(&local_path).await;
        return Err(format!(
            "backup dump failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )
        .into());
    }

    let upload = upload_to_target(docker_bin, &local_path, target, object_key).await;
    let _ = fs::remove_file(&local_path).await;
    upload?;

    Ok(size)
}

pub async fn run_restore(
    docker_bin: &str,
    container_name: &str,
    restore_command: &str,
    target: &BackupTarget,
    object_key: &str,
) -> AgentResult<()> {
    fs::create_dir_all(BACKUP_DIR).await.ok();
    let local_path = format!("{BACKUP_DIR}/{}", sanitize_filename(object_key));

    if let Err(error) = download_from_target(docker_bin, &local_path, target, object_key).await {
        let _ = fs::remove_file(&local_path).await;
        return Err(error);
    }

    let mut bytes = Vec::new();
    fs::File::open(&local_path)
        .await?
        .read_to_end(&mut bytes)
        .await?;

    let mut child = Command::new(docker_bin)
        .args(["exec", "-i", container_name, "sh", "-c", restore_command])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(&bytes).await?;
    }

    let output = child.wait_with_output().await?;
    let _ = fs::remove_file(&local_path).await;
    if !output.status.success() {
        return Err(format!(
            "restore failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )
        .into());
    }
    Ok(())
}

async fn upload_to_target(
    docker_bin: &str,
    local_path: &str,
    target: &BackupTarget,
    object_key: &str,
) -> AgentResult<()> {
    let dir = parent_dir(local_path);
    let filename = file_name(local_path);
    with_mc_session(docker_bin, dir, target, |docker_bin, container_id| {
        let source = format!("/data/{filename}");
        let dest = format!("{MC_ALIAS}/{}/{}", target.bucket, object_key);
        async move { mc_exec(&docker_bin, &container_id, &["mc", "cp", &source, &dest]).await }
    })
    .await
}

async fn download_from_target(
    docker_bin: &str,
    local_path: &str,
    target: &BackupTarget,
    object_key: &str,
) -> AgentResult<()> {
    let dir = parent_dir(local_path);
    let filename = file_name(local_path);
    with_mc_session(docker_bin, dir, target, |docker_bin, container_id| {
        let source = format!("{MC_ALIAS}/{}/{}", target.bucket, object_key);
        let dest = format!("/data/{filename}");
        async move { mc_exec(&docker_bin, &container_id, &["mc", "cp", &source, &dest]).await }
    })
    .await
}

async fn with_mc_session<F, Fut>(
    docker_bin: &str,
    dir: &str,
    target: &BackupTarget,
    op: F,
) -> AgentResult<()>
where
    F: FnOnce(String, String) -> Fut,
    Fut: std::future::Future<Output = AgentResult<()>>,
{
    let container_id = start_mc_container(docker_bin, dir).await?;

    let alias_url = alias_url(&target.endpoint);
    let alias_result = mc_exec(
        docker_bin,
        &container_id,
        &[
            "mc",
            "alias",
            "set",
            MC_ALIAS,
            &alias_url,
            &target.access_key_id,
            &target.secret_access_key,
        ],
    )
    .await;

    let result = match alias_result {
        Ok(()) => op(docker_bin.to_string(), container_id.clone()).await,
        Err(error) => Err(error),
    };

    let _ = Command::new(docker_bin)
        .args(["rm", "-f", &container_id])
        .output()
        .await;

    result
}

async fn start_mc_container(docker_bin: &str, dir: &str) -> AgentResult<String> {
    let output = Command::new(docker_bin)
        .args([
            "run",
            "-d",
            "--rm",
            "-v",
            &format!("{dir}:/data"),
            "--entrypoint",
            "sleep",
            MC_IMAGE,
            "300",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await?;

    if !output.status.success() {
        return Err(format!(
            "failed to start backup helper container: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )
        .into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

async fn mc_exec(docker_bin: &str, container_id: &str, args: &[&str]) -> AgentResult<()> {
    let mut full_args: Vec<&str> = vec!["exec", container_id];
    full_args.extend_from_slice(args);

    let output = Command::new(docker_bin)
        .args(&full_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await?;

    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "{} failed: {}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr).trim()
    )
    .into())
}

fn alias_url(endpoint: &str) -> String {
    if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
        endpoint.to_string()
    } else {
        format!("https://{endpoint}")
    }
}

fn parent_dir(path: &str) -> &str {
    Path::new(path)
        .parent()
        .and_then(|p| p.to_str())
        .filter(|p| !p.is_empty())
        .unwrap_or(BACKUP_DIR)
}

fn file_name(path: &str) -> &str {
    Path::new(path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("backup.dat")
}

fn sanitize_filename(object_key: &str) -> String {
    object_key
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}
