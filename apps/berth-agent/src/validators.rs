use crate::protocol::{ServiceSource, ServiceSpec};

const MAX_ENV: usize = 200;
const MAX_PORTS: usize = 50;
const MAX_VOLUMES: usize = 50;
const MAX_REPLICAS: u32 = 32;

pub fn validate_spec(spec: &ServiceSpec) -> Result<(), String> {
    check_token("service id", &spec.id)?;
    check_display_name(&spec.name)?;

    if spec.env.len() > MAX_ENV {
        return Err(format!("too many env vars (>{MAX_ENV})"));
    }
    if spec.ports.len() > MAX_PORTS {
        return Err(format!("too many ports (>{MAX_PORTS})"));
    }
    if spec.volumes.len() > MAX_VOLUMES {
        return Err(format!("too many volumes (>{MAX_VOLUMES})"));
    }
    if spec.replicas == 0 || spec.replicas > MAX_REPLICAS {
        return Err(format!(
            "replica count must be between 1 and {MAX_REPLICAS}"
        ));
    }
    if spec.replicas > 1 && !spec.volumes.is_empty() {
        return Err("multiple replicas cannot share persistent volumes".to_string());
    }
    if spec.replicas > 1
        && spec
            .ports
            .iter()
            .any(|port| port.public && port.domain.is_none())
    {
        return Err("multiple replicas cannot publish the same host port".to_string());
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
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(format!("{field} contains invalid characters"));
    }
    Ok(())
}

fn check_display_name(value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err("service name is empty".to_string());
    }
    if value.chars().any(char::is_control) {
        return Err("service name contains control characters".to_string());
    }
    Ok(())
}

fn check_value(field: &str, value: &str) -> Result<(), String> {
    if value.chars().any(char::is_control) {
        return Err(format!("{field} contains control characters"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn spec(overrides: serde_json::Value) -> ServiceSpec {
        let mut base = json!({
            "id": "svc1",
            "name": "web",
            "serverId": "srv1",
            "source": { "kind": "image", "image": "nginx", "tag": "latest" },
            "env": [],
            "ports": [],
            "volumes": [],
            "resources": { "cpuCores": 1.0, "memoryMb": 512 },
            "healthCheck": null,
            "restartPolicy": "always",
            "replicas": 1,
            "templateKind": null
        });
        if let (Some(base), Some(extra)) = (base.as_object_mut(), overrides.as_object()) {
            for (key, value) in extra {
                base.insert(key.clone(), value.clone());
            }
        }
        serde_json::from_value(base).expect("valid spec")
    }

    #[test]
    fn replicas_reject_unsupported_shared_resources() {
        let shared_volume = spec(json!({
            "replicas": 2,
            "volumes": [{ "name": "data", "mountPath": "/data" }]
        }));
        let published_port = spec(json!({
            "replicas": 2,
            "ports": [{ "containerPort": 8080, "domain": null, "public": true }]
        }));

        assert!(validate_spec(&shared_volume)
            .unwrap_err()
            .contains("cannot share persistent volumes"));
        assert!(validate_spec(&published_port)
            .unwrap_err()
            .contains("cannot publish the same host port"));
    }

    #[test]
    fn replica_count_is_bounded() {
        assert!(validate_spec(&spec(json!({ "replicas": 0 }))).is_err());
        assert!(validate_spec(&spec(json!({ "replicas": 33 }))).is_err());
        assert!(validate_spec(&spec(json!({ "replicas": 32 }))).is_ok());
    }
}
