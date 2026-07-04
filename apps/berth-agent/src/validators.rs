use crate::protocol::{ServiceSource, ServiceSpec};

const MAX_ENV: usize = 200;
const MAX_PORTS: usize = 50;
const MAX_VOLUMES: usize = 50;

pub fn validate_spec(spec: &ServiceSpec) -> Result<(), String> {
    check_token("service id", &spec.id)?;
    check_token("service name", &spec.name)?;

    if spec.env.len() > MAX_ENV {
        return Err(format!("too many env vars (>{MAX_ENV})"));
    }
    if spec.ports.len() > MAX_PORTS {
        return Err(format!("too many ports (>{MAX_PORTS})"));
    }
    if spec.volumes.len() > MAX_VOLUMES {
        return Err(format!("too many volumes (>{MAX_VOLUMES})"));
    }

    for env in &spec.env {
        check_token("env key", &env.key)?;
        check_value("env value", &env.value)?;
    }
    for volume in &spec.volumes {
        check_token("volume name", &volume.name)?;
        check_value("mount path", &volume.mount_path)?;
    }

    match &spec.source {
        ServiceSource::Image { image, tag } => {
            check_value("image", image)?;
            check_value("tag", tag)?;
        }
        ServiceSource::Git { .. } => {}
    }

    Ok(())
}

fn check_token(field: &str, value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{field} is empty"));
    }
    if value
        .chars()
        .any(|c| c.is_control() || c.is_whitespace())
    {
        return Err(format!("{field} contains invalid characters"));
    }
    Ok(())
}

fn check_value(field: &str, value: &str) -> Result<(), String> {
    if value.chars().any(char::is_control) {
        return Err(format!("{field} contains control characters"));
    }
    Ok(())
}
