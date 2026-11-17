use std::path::Path;
use std::process::Stdio;

use tokio::process::Command;

use crate::docker::AgentResult;
use crate::protocol::VolumeMount;

pub const DEFAULT_DATA_ROOT: &str = "/var/lib/berth";
const DEFAULT_FSTAB: &str = "/etc/fstab";
const GB: u64 = 1024 * 1024 * 1024;
const HELPER_IMAGE: &str = "alpine:3.20";
const REQUIRED_TOOLS: [&str; 8] = [
    "truncate", "mkfs.ext4", "e2fsck", "resize2fs", "debugfs", "mount", "umount", "findmnt",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Step {
    pub program: String,
    pub args: Vec<String>,
    pub ok_exit_codes: Vec<i32>,
    pub optional: bool,
}

impl Step {
    fn new(program: &str, args: &[&str]) -> Self {
        Self::owned(program, args.iter().map(|arg| arg.to_string()).collect())
    }

    fn owned(program: &str, args: Vec<String>) -> Self {
        Self { program: program.to_string(), args, ok_exit_codes: vec![0], optional: false }
    }

    fn ok_codes(mut self, codes: &[i32]) -> Self {
        self.ok_exit_codes = codes.to_vec();
        self
    }

    fn optional(mut self) -> Self {
        self.optional = true;
        self
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    Run(Step),
    FstabAdd { image: String, mount_point: String },
}

#[derive(Debug, PartialEq, Eq)]
pub enum BackingKind {
    Plain,
    Mounted(String),
    Other,
}

pub fn data_root() -> String {
    std::env::var("BERTH_DATA_ROOT").unwrap_or_else(|_| DEFAULT_DATA_ROOT.to_string())
}

fn fstab_path() -> String {
    std::env::var("BERTH_FSTAB").unwrap_or_else(|_| DEFAULT_FSTAB.to_string())
}

pub fn validate_name(name: &str) -> Result<(), String> {
    let valid = !name.is_empty()
        && name.len() <= 128
        && !name.contains("..")
        && name.chars().next().is_some_and(|c| c.is_ascii_alphanumeric())
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'));
    if valid {
        Ok(())
    } else {
        Err(format!("invalid volume name {name:?}"))
    }
}

pub fn image_path(root: &str, name: &str) -> String {
    format!("{root}/volumes/{name}.img")
}

pub fn mount_point(root: &str, name: &str) -> String {
    format!("{root}/mounts/{name}")
}

pub fn usage_from_df(output: &str, mount: &str) -> Option<(u64, u64)> {
    let line = output.lines().nth(1)?;
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 6 || fields[5..].join(" ") != mount {
        return None;
    }
    let total_kb: u64 = fields[1].parse().ok()?;
    let used_kb: u64 = fields[2].parse().ok()?;
    Some((used_kb / 1024, total_kb / 1024))
}

pub async fn read_usage(root: &str) -> Vec<crate::protocol::VolumeUsageEntry> {
    let mut found = Vec::new();
    let Ok(mut entries) = tokio::fs::read_dir(format!("{root}/mounts")).await else {
        return found;
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let Some(name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        if validate_name(&name).is_err() {
            continue;
        }
        let mount = mount_point(root, &name);
        let Ok(output) = tokio::process::Command::new("df")
            .args(["-Pk", &mount])
            .output()
            .await
        else {
            continue;
        };
        let text = String::from_utf8_lossy(&output.stdout);
        if let Some((used_mb, total_mb)) = usage_from_df(&text, &mount) {
            found.push(crate::protocol::VolumeUsageEntry { name, used_mb, total_mb });
        }
    }
    found
}

pub fn sized_name_for_legacy(name: &str) -> String {
    format!("{name}-sized")
}

fn rmdir_lost_found(image: &str) -> Action {
    Action::Run(Step::new("debugfs", &["-w", "-R", "rmdir lost+found", image]).optional())
}

fn mount_step(image: &str, mount_point: &str) -> Action {
    Action::Run(Step::new("mount", &["-t", "ext4", "-o", "loop,nofail", image, mount_point]))
}

fn unmount_step(mount_point: &str) -> Action {
    Action::Run(Step::new("umount", &[mount_point]).optional())
}

fn volume_create_step(docker: &str, mount_point: &str, name: &str) -> Action {
    Action::Run(Step::owned(
        docker,
        vec![
            "volume".into(),
            "create".into(),
            "--driver".into(),
            "local".into(),
            "--opt".into(),
            "type=none".into(),
            "--opt".into(),
            "o=bind".into(),
            "--opt".into(),
            format!("device={mount_point}"),
            "--label".into(),
            "berth.managed=true".into(),
            "--label".into(),
            "berth.sized=true".into(),
            name.into(),
        ],
    ))
}

pub fn create_steps(root: &str, docker: &str, name: &str, size_gb: u64) -> Vec<Action> {
    let image = image_path(root, name);
    let mount = mount_point(root, name);
    let label: String = format!("b-{name}").chars().take(16).collect();
    vec![
        Action::Run(Step::owned("mkdir", vec!["-p".into(), format!("{root}/volumes"), mount.clone()])),
        Action::Run(Step::owned("truncate", vec!["-s".into(), format!("{size_gb}G"), image.clone()])),
        Action::Run(Step::owned(
            "mkfs.ext4",
            vec!["-F".into(), "-q".into(), "-m".into(), "0".into(), "-L".into(), label, image.clone()],
        )),
        rmdir_lost_found(&image),
        Action::Run(Step::new("chattr", &["+i", &mount]).optional()),
        Action::FstabAdd { image: image.clone(), mount_point: mount.clone() },
        mount_step(&image, &mount),
        volume_create_step(docker, &mount, name),
    ]
}

pub fn resize_steps(root: &str, name: &str, current_bytes: u64, size_gb: u64) -> Vec<Action> {
    let image = image_path(root, name);
    let mount = mount_point(root, name);
    let wanted = size_gb * GB;
    if wanted == current_bytes {
        return Vec::new();
    }
    let size = format!("{size_gb}G");
    let check = Action::Run(Step::new("e2fsck", &["-f", "-y", &image]).ok_codes(&[0, 1]));
    let mut steps = vec![unmount_step(&mount)];
    if wanted > current_bytes {
        steps.push(Action::Run(Step::owned("truncate", vec!["-s".into(), size, image.clone()])));
        steps.push(check);
        steps.push(Action::Run(Step::new("resize2fs", &[&image])));
    } else {
        steps.push(check);
        steps.push(Action::Run(Step::owned("resize2fs", vec![image.clone(), size.clone()])));
        steps.push(Action::Run(Step::owned("truncate", vec!["-s".into(), size, image.clone()])));
    }
    steps.push(rmdir_lost_found(&image));
    steps.push(mount_step(&image, &mount));
    steps
}

pub fn migrate_steps(root: &str, docker: &str, name: &str, size_gb: u64) -> (String, Vec<Action>) {
    let target = sized_name_for_legacy(name);
    let mut steps = create_steps(root, docker, &target, size_gb);
    steps.push(Action::Run(Step::owned(
        docker,
        vec![
            "run".into(),
            "--rm".into(),
            "-v".into(),
            format!("{name}:/from:ro"),
            "-v".into(),
            format!("{target}:/to"),
            HELPER_IMAGE.into(),
            "sh".into(),
            "-c".into(),
            "cp -a /from/. /to/ && sync".into(),
        ],
    )));
    steps.push(Action::Run(Step::owned(
        docker,
        vec![
            "run".into(),
            "--rm".into(),
            "-v".into(),
            format!("{name}:/from:ro"),
            "-v".into(),
            format!("{target}:/to:ro"),
            HELPER_IMAGE.into(),
            "sh".into(),
            "-c".into(),
            "test \"$(find /from | wc -l)\" = \"$(find /to | wc -l)\"".into(),
        ],
    )));
    (target, steps)
}

pub fn classify(options_json: &str) -> BackingKind {
    let value: serde_json::Value = match serde_json::from_str(options_json.trim()) {
        Ok(value) => value,
        Err(_) => return BackingKind::Other,
    };
    let Some(object) = value.as_object() else {
        return if value.is_null() { BackingKind::Plain } else { BackingKind::Other };
    };
    if object.is_empty() {
        return BackingKind::Plain;
    }
    let is_bind = object.get("o").and_then(|v| v.as_str()) == Some("bind")
        && object.get("type").and_then(|v| v.as_str()) == Some("none");
    match (is_bind, object.get("device").and_then(|v| v.as_str())) {
        (true, Some(device)) => BackingKind::Mounted(device.to_string()),
        _ => BackingKind::Other,
    }
}

pub fn fstab_line(image: &str, mount_point: &str) -> String {
    format!("{image} {mount_point} ext4 defaults,loop,nofail 0 0")
}

/// Returns the new fstab text, or None when the image is already listed.
pub fn fstab_with(existing: &str, image: &str, mount_point: &str) -> Option<String> {
    let listed = existing
        .lines()
        .any(|line| line.split_whitespace().next() == Some(image));
    if listed {
        return None;
    }
    let mut text = existing.to_string();
    if !text.is_empty() && !text.ends_with('\n') {
        text.push('\n');
    }
    text.push_str(&fstab_line(image, mount_point));
    text.push('\n');
    Some(text)
}

pub fn missing_tools(path_var: &str) -> Vec<&'static str> {
    REQUIRED_TOOLS
        .iter()
        .copied()
        .filter(|tool| {
            !std::env::split_paths(path_var).any(|dir| Path::new(&dir).join(tool).exists())
        })
        .collect()
}

pub struct VolumeManager {
    docker_bin: String,
}

impl VolumeManager {
    pub fn new(docker_bin: impl Into<String>) -> Self {
        Self { docker_bin: docker_bin.into() }
    }

    /// Makes sure the volume described by `volume` exists and returns the Docker
    /// volume name to mount. Volumes without a size stay plain Docker volumes.
    pub async fn ensure(&self, volume: &VolumeMount) -> AgentResult<String> {
        validate_name(&volume.name)?;
        let Some(size_gb) = volume.size_gb else {
            self.ensure_plain(&volume.name).await?;
            return Ok(volume.name.clone());
        };
        if size_gb == 0 {
            return Err("a volume size must be at least 1 GB".into());
        }
        self.require_tools()?;

        let root = data_root();
        match self.backing(&volume.name).await? {
            None => {
                self.run(&create_steps(&root, &self.docker_bin, &volume.name, size_gb)).await?;
                Ok(volume.name.clone())
            }
            Some(BackingKind::Mounted(device)) => {
                self.expect_mount(&root, &volume.name, &device)?;
                self.reattach(&root, &volume.name).await?;
                self.resize_if_needed(&root, &volume.name, size_gb).await?;
                Ok(volume.name.clone())
            }
            Some(BackingKind::Plain) => self.adopt_legacy(&root, &volume.name, size_gb).await,
            Some(BackingKind::Other) => Err(format!(
                "volume {} uses driver options Berth cannot size; remove it or pick another name",
                volume.name
            )
            .into()),
        }
    }

    async fn adopt_legacy(&self, root: &str, name: &str, size_gb: u64) -> AgentResult<String> {
        let target = sized_name_for_legacy(name);
        match self.backing(&target).await? {
            Some(BackingKind::Mounted(device)) => {
                self.expect_mount(root, &target, &device)?;
                self.reattach(root, &target).await?;
                self.resize_if_needed(root, &target, size_gb).await?;
                Ok(target)
            }
            Some(_) => Err(format!("{target} exists but is not a Berth sized volume").into()),
            None => {
                self.ensure_unused(name).await?;
                eprintln!(
                    "[berth-agent] copying {name} into a {size_gb} GB limited volume ({target}); \
                     the original is kept untouched as a backup"
                );
                let (target, steps) = migrate_steps(root, &self.docker_bin, name, size_gb);
                if let Err(error) = self.run(&steps).await {
                    self.discard_partial(root, &target).await;
                    return Err(format!("could not copy {name} into a limited volume: {error}").into());
                }
                Ok(target)
            }
        }
    }

    async fn discard_partial(&self, root: &str, name: &str) {
        let mount = mount_point(root, name);
        let _ = Command::new(&self.docker_bin).args(["volume", "rm", "-f", name]).output().await;
        let _ = Command::new("umount").arg(&mount).output().await;
        let _ = Command::new("chattr").args(["-i", &mount]).output().await;
        let _ = std::fs::remove_dir(&mount);
        let _ = std::fs::remove_file(image_path(root, name));
        let _ = self.fstab_remove(&image_path(root, name));
    }

    async fn resize_if_needed(&self, root: &str, name: &str, size_gb: u64) -> AgentResult<()> {
        let image = image_path(root, name);
        let current = std::fs::metadata(&image)
            .map_err(|error| format!("cannot read {image}: {error}"))?
            .len();
        let steps = resize_steps(root, name, current, size_gb);
        if steps.is_empty() {
            return Ok(());
        }
        self.ensure_unused(name).await?;
        self.run(&steps).await
    }

    async fn reattach(&self, root: &str, name: &str) -> AgentResult<()> {
        let mount = mount_point(root, name);
        let mounted = Command::new("findmnt").args(["-rn", &mount]).output().await?;
        if mounted.status.success() && !mounted.stdout.is_empty() {
            return Ok(());
        }
        self.run(&[mount_step(&image_path(root, name), &mount)]).await
    }

    fn expect_mount(&self, root: &str, name: &str, device: &str) -> AgentResult<()> {
        let expected = mount_point(root, name);
        if device == expected {
            return Ok(());
        }
        Err(format!("volume {name} is bound to {device}, not {expected}").into())
    }

    fn require_tools(&self) -> AgentResult<()> {
        let path = std::env::var("PATH").unwrap_or_default();
        let missing = missing_tools(&path);
        if missing.is_empty() {
            return Ok(());
        }
        Err(format!(
            "limited volumes need {} on this server (install the e2fsprogs and util-linux packages)",
            missing.join(", ")
        )
        .into())
    }

    async fn ensure_plain(&self, name: &str) -> AgentResult<()> {
        if self.backing(name).await?.is_some() {
            return Ok(());
        }
        self.run(&[Action::Run(Step::new(&self.docker_bin, &["volume", "create", name]))]).await
    }

    async fn ensure_unused(&self, name: &str) -> AgentResult<()> {
        let output = Command::new(&self.docker_bin)
            .args(["ps", "-q", "--filter", &format!("volume={name}")])
            .output()
            .await?;
        if !String::from_utf8_lossy(&output.stdout).trim().is_empty() {
            return Err(format!("volume {name} is in use by a running container").into());
        }
        Ok(())
    }

    async fn backing(&self, name: &str) -> AgentResult<Option<BackingKind>> {
        let output = Command::new(&self.docker_bin)
            .args(["volume", "inspect", "-f", "{{json .Options}}", name])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await?;
        if !output.status.success() {
            return Ok(None);
        }
        Ok(Some(classify(&String::from_utf8_lossy(&output.stdout))))
    }

    fn fstab_add(&self, image: &str, mount_point: &str) -> AgentResult<()> {
        let path = fstab_path();
        let existing = std::fs::read_to_string(&path).unwrap_or_default();
        let Some(updated) = fstab_with(&existing, image, mount_point) else {
            return Ok(());
        };
        let backup = format!("{path}.berth.bak");
        if !Path::new(&backup).exists() && Path::new(&path).exists() {
            std::fs::copy(&path, &backup)?;
        }
        let temp = format!("{path}.berth.tmp");
        std::fs::write(&temp, updated)?;
        std::fs::rename(&temp, &path)?;
        Ok(())
    }

    fn fstab_remove(&self, image: &str) -> AgentResult<()> {
        let path = fstab_path();
        let Ok(existing) = std::fs::read_to_string(&path) else {
            return Ok(());
        };
        let kept: Vec<&str> = existing
            .lines()
            .filter(|line| line.split_whitespace().next() != Some(image))
            .collect();
        let temp = format!("{path}.berth.tmp");
        std::fs::write(&temp, format!("{}\n", kept.join("\n")))?;
        std::fs::rename(&temp, &path)?;
        Ok(())
    }

    async fn run(&self, actions: &[Action]) -> AgentResult<()> {
        for action in actions {
            match action {
                Action::FstabAdd { image, mount_point } => self.fstab_add(image, mount_point)?,
                Action::Run(step) => {
                    let output = Command::new(&step.program).args(&step.args).output().await?;
                    let code = output.status.code().unwrap_or(-1);
                    if step.ok_exit_codes.contains(&code) || step.optional {
                        continue;
                    }
                    return Err(format!(
                        "{} {} failed ({}): {}",
                        step.program,
                        step.args.join(" "),
                        code,
                        String::from_utf8_lossy(&output.stderr).trim()
                    )
                    .into());
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn reads_used_and_total_from_df_for_the_exact_mount() {
        let out = "Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/loop3 1998672 524288 1355000 28% /var/lib/berth/mounts/data
";
        assert_eq!(usage_from_df(out, "/var/lib/berth/mounts/data"), Some((512, 1951)));
    }

    #[test]
    fn ignores_a_path_that_is_not_its_own_mount() {
        let out = "Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/sda1 100000000 50000000 50000000 50% /
";
        assert_eq!(usage_from_df(out, "/var/lib/berth/mounts/data"), None);
        assert_eq!(usage_from_df("", "/x"), None);
    }

    use super::*;

    const ROOT: &str = "/var/lib/berth";

    fn steps_of(actions: &[Action]) -> Vec<&Step> {
        actions
            .iter()
            .filter_map(|action| match action {
                Action::Run(step) => Some(step),
                Action::FstabAdd { .. } => None,
            })
            .collect()
    }

    fn programs(actions: &[Action]) -> Vec<String> {
        actions
            .iter()
            .map(|action| match action {
                Action::Run(step) => step.program.clone(),
                Action::FstabAdd { .. } => "fstab".to_string(),
            })
            .collect()
    }

    #[test]
    fn creates_a_sparse_ext4_image_mounted_on_the_host_and_exposed_as_a_bind_volume() {
        let actions = create_steps(ROOT, "docker", "app-data", 10);
        assert_eq!(
            programs(&actions),
            ["mkdir", "truncate", "mkfs.ext4", "debugfs", "chattr", "fstab", "mount", "docker"]
        );
        let steps = steps_of(&actions);
        assert_eq!(steps[1].args, ["-s", "10G", "/var/lib/berth/volumes/app-data.img"]);
        assert!(steps[2].args.contains(&"-m".to_string()), "no reserved blocks, so the whole size is usable");
        let create = &steps.last().unwrap().args;
        assert!(create.contains(&"type=none".to_string()));
        assert!(create.contains(&"o=bind".to_string()));
        assert!(create.contains(&"device=/var/lib/berth/mounts/app-data".to_string()));
        assert_eq!(create.last().unwrap(), "app-data");
    }

    #[test]
    fn guards_the_empty_mount_point_so_a_missing_mount_cannot_fill_the_host_disk() {
        let actions = create_steps(ROOT, "docker", "app-data", 1);
        let guard = steps_of(&actions).into_iter().find(|s| s.program == "chattr").unwrap();
        assert_eq!(guard.args, ["+i", "/var/lib/berth/mounts/app-data"]);
        let mount_index = programs(&actions).iter().position(|p| p == "mount").unwrap();
        let guard_index = programs(&actions).iter().position(|p| p == "chattr").unwrap();
        assert!(guard_index < mount_index, "the guard goes on before the filesystem is mounted over it");
    }

    #[test]
    fn mounts_at_boot_through_fstab_without_blocking_startup() {
        let line = fstab_line("/v/a.img", "/m/a");
        assert_eq!(line, "/v/a.img /m/a ext4 defaults,loop,nofail 0 0");
        assert!(line.contains("nofail"));
    }

    #[test]
    fn removes_lost_and_found_but_never_fails_if_it_is_already_gone() {
        let actions = create_steps(ROOT, "docker", "app-data", 1);
        let step = steps_of(&actions).into_iter().find(|s| s.program == "debugfs").unwrap();
        assert!(step.optional);
        assert_eq!(step.args[2], "rmdir lost+found");
    }

    #[test]
    fn volume_labels_fit_the_ext4_limit() {
        let actions = create_steps(ROOT, "docker", &"x".repeat(100), 1);
        let mkfs = steps_of(&actions).into_iter().find(|s| s.program == "mkfs.ext4").unwrap();
        let label_index = mkfs.args.iter().position(|arg| arg == "-L").unwrap() + 1;
        assert!(mkfs.args[label_index].len() <= 16);
    }

    #[test]
    fn growing_unmounts_extends_the_file_then_the_filesystem_and_remounts() {
        let actions = resize_steps(ROOT, "a", 5 * GB, 10);
        assert_eq!(programs(&actions), ["umount", "truncate", "e2fsck", "resize2fs", "debugfs", "mount"]);
        assert_eq!(steps_of(&actions)[1].args, ["-s", "10G", "/var/lib/berth/volumes/a.img"]);
    }

    #[test]
    fn shrinking_trims_the_filesystem_before_the_file() {
        let actions = resize_steps(ROOT, "a", 10 * GB, 5);
        assert_eq!(programs(&actions), ["umount", "e2fsck", "resize2fs", "truncate", "debugfs", "mount"]);
        assert_eq!(steps_of(&actions)[2].args, ["/var/lib/berth/volumes/a.img", "5G"]);
    }

    #[test]
    fn an_unchanged_size_does_nothing() {
        assert!(resize_steps(ROOT, "a", 5 * GB, 5).is_empty());
    }

    #[test]
    fn a_filesystem_check_that_fixed_something_is_not_a_failure() {
        let actions = resize_steps(ROOT, "a", 5 * GB, 10);
        let check = steps_of(&actions).into_iter().find(|s| s.program == "e2fsck").unwrap();
        assert_eq!(check.ok_exit_codes, [0, 1]);
    }

    #[test]
    fn migration_copies_and_verifies_but_never_deletes_the_original() {
        let (target, actions) = migrate_steps(ROOT, "docker", "db-data", 20);
        assert_eq!(target, "db-data-sized");
        let steps = steps_of(&actions);
        let all: Vec<String> = steps.iter().flat_map(|s| s.args.clone()).collect();
        assert!(all.contains(&"db-data:/from:ro".to_string()), "the original is mounted read-only");
        assert!(!steps.iter().any(|s| s.args.contains(&"rm".to_string())), "nothing is removed");
        assert!(steps.last().unwrap().args.last().unwrap().contains("find /from | wc -l"), "the copy is verified");
    }

    #[test]
    fn recognises_how_a_volume_is_backed() {
        assert_eq!(classify("null"), BackingKind::Plain);
        assert_eq!(classify("{}"), BackingKind::Plain);
        assert_eq!(
            classify(r#"{"device":"/var/lib/berth/mounts/a","o":"bind","type":"none"}"#),
            BackingKind::Mounted("/var/lib/berth/mounts/a".into())
        );
        assert_eq!(classify(r#"{"type":"nfs","device":":/x","o":"addr=1.2.3.4"}"#), BackingKind::Other);
        assert_eq!(classify("garbage"), BackingKind::Other);
    }

    #[test]
    fn adds_each_image_to_fstab_once_and_keeps_existing_entries() {
        let original = "UUID=abc / ext4 defaults 0 1";
        let updated = fstab_with(original, "/v/a.img", "/m/a").unwrap();
        assert!(updated.starts_with(original));
        assert!(updated.ends_with("/v/a.img /m/a ext4 defaults,loop,nofail 0 0\n"));
        assert_eq!(fstab_with(&updated, "/v/a.img", "/m/a"), None, "no duplicates");
        assert!(fstab_with(&updated, "/v/b.img", "/m/b").is_some());
    }

    #[test]
    fn handles_an_empty_or_unterminated_fstab() {
        assert_eq!(fstab_with("", "/v/a.img", "/m/a").unwrap(), "/v/a.img /m/a ext4 defaults,loop,nofail 0 0\n");
        assert!(fstab_with("x", "/v/a.img", "/m/a").unwrap().starts_with("x\n"));
    }

    #[test]
    fn rejects_volume_names_that_could_escape_the_data_directory() {
        assert!(validate_name("app-data").is_ok());
        assert!(validate_name("my_app.v2-data").is_ok());
        for bad in ["", "../x", "a/b", "-lead", "a b", "a\n", ".hidden", "a..b"] {
            assert!(validate_name(bad).is_err(), "{bad:?} should be rejected");
        }
    }

    #[test]
    fn reports_which_tools_are_missing() {
        let missing = missing_tools("/definitely/not/a/real/dir");
        assert_eq!(missing.len(), REQUIRED_TOOLS.len());
    }
}

#[cfg(test)]
mod e2e {
    //! Needs a real Docker daemon, root, and e2fsprogs + util-linux:
    //!   BERTH_VOLUME_E2E=1 cargo test volumes_e2e -- --ignored --nocapture
    use super::*;

    const DOCKER: &str = "docker";

    async fn sh(args: &[&str]) -> (bool, String) {
        let output = Command::new(DOCKER).args(args).output().await.expect("docker runs");
        let text = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        (output.status.success(), text)
    }

    async fn in_volume(name: &str, script: &str) -> (bool, String) {
        sh(&["run", "--rm", "-v", &format!("{name}:/data"), HELPER_IMAGE, "sh", "-c", script]).await
    }

    async fn cleanup(names: &[&str]) {
        let root = data_root();
        for name in names {
            let _ = sh(&["volume", "rm", "-f", name]).await;
            let mount = mount_point(&root, name);
            let _ = Command::new("umount").arg(&mount).output().await;
            let _ = Command::new("chattr").args(["-i", &mount]).output().await;
            let _ = std::fs::remove_dir(&mount);
            let _ = std::fs::remove_file(image_path(&root, name));
        }
    }

    fn mount(name: &str, size_gb: Option<u64>) -> VolumeMount {
        VolumeMount { name: name.into(), mount_path: "/data".into(), size_gb }
    }

    #[tokio::test]
    #[ignore]
    async fn volumes_e2e() {
        if std::env::var("BERTH_VOLUME_E2E").is_err() {
            return;
        }
        let manager = VolumeManager::new(DOCKER);
        let names = ["berth-e2e-a", "berth-e2e-legacy", "berth-e2e-legacy-sized"];
        cleanup(&names).await;
        let _ = sh(&["pull", "-q", HELPER_IMAGE]).await;

        println!("1. a new 1 GB volume is created and usable");
        let mounted = manager.ensure(&mount("berth-e2e-a", Some(1))).await.expect("create");
        assert_eq!(mounted, "berth-e2e-a");
        let (ok, out) = in_volume("berth-e2e-a", "df -m /data | tail -1; ls -A /data | wc -l").await;
        assert!(ok, "{out}");
        println!("   df: {}", out.lines().next().unwrap_or(""));
        assert!(out.lines().last().unwrap().trim() == "0", "lost+found must be gone so databases can initialise: {out}");

        println!("2. the hard wall: writing 1.2 GB into a 1 GB volume fails");
        let (_, out) = in_volume("berth-e2e-a", "dd if=/dev/zero of=/data/big bs=1M count=1200 2>&1; echo done").await;
        assert!(out.contains("No space left on device"), "the write must hit the wall: {out}");
        println!("   -> {}", out.lines().find(|l| l.contains("No space")).unwrap_or(""));
        let _ = in_volume("berth-e2e-a", "rm -f /data/big; echo precious > /data/keep.txt; sync").await;

        println!("3. growing to 2 GB keeps the data and gives the space");
        manager.ensure(&mount("berth-e2e-a", Some(2))).await.expect("grow");
        let (ok, out) = in_volume("berth-e2e-a", "cat /data/keep.txt; dd if=/dev/zero of=/data/big bs=1M count=1200 2>&1 | tail -1; rm -f /data/big").await;
        assert!(ok && out.contains("precious"), "{out}");
        assert!(!out.contains("No space"), "1.2 GB must now fit: {out}");
        println!("   -> data kept, 1.2 GB write succeeded");

        println!("4. shrinking back to 1 GB keeps the data");
        manager.ensure(&mount("berth-e2e-a", Some(1))).await.expect("shrink");
        let (ok, out) = in_volume("berth-e2e-a", "cat /data/keep.txt; df -m /data | tail -1").await;
        assert!(ok && out.contains("precious"), "{out}");
        println!("   -> {}", out.lines().last().unwrap_or(""));

        println!("4b. usage is reported for the mounted volume");
        let _ = in_volume("berth-e2e-a", "dd if=/dev/zero of=/data/fill bs=1M count=300 2>&1; sync").await;
        let usage = read_usage(&data_root()).await;
        let entry = usage.iter().find(|entry| entry.name == "berth-e2e-a").expect("volume is reported");
        assert!(entry.total_mb > 800 && entry.total_mb <= 1024, "total reflects the 1 GB limit: {entry:?}");
        assert!(entry.used_mb >= 300 && entry.used_mb < entry.total_mb, "usage includes the 300 MB written: {entry:?}");
        let _ = in_volume("berth-e2e-a", "rm -f /data/fill; sync").await;
        println!("   -> {} of {} MB", entry.used_mb, entry.total_mb);

        println!("5. a missing mount fails safely instead of filling the host disk");
        let root = data_root();
        let mount_dir = mount_point(&root, "berth-e2e-a");
        let _ = Command::new("umount").arg(&mount_dir).output().await;
        let (_, out) = in_volume("berth-e2e-a", "echo leak > /data/leak.txt 2>&1; echo exit=$?").await;
        assert!(!out.contains("exit=0"), "writing to an unmounted mount point must fail: {out}");
        println!("   -> {}", out.trim().lines().last().unwrap_or(""));
        manager.ensure(&mount("berth-e2e-a", Some(1))).await.expect("reattach");
        let (ok, out) = in_volume("berth-e2e-a", "cat /data/keep.txt").await;
        assert!(ok && out.contains("precious"), "the data comes back when the mount does: {out}");

        println!("6. a legacy unlimited volume is copied, the original kept as a backup");
        let _ = sh(&["volume", "create", "berth-e2e-legacy"]).await;
        let (ok, out) = in_volume("berth-e2e-legacy", "mkdir -p /data/sub && echo one > /data/a.txt && echo two > /data/sub/b.txt").await;
        assert!(ok, "{out}");
        let adopted = manager.ensure(&mount("berth-e2e-legacy", Some(1))).await.expect("adopt");
        assert_eq!(adopted, "berth-e2e-legacy-sized");
        let (ok, out) = in_volume("berth-e2e-legacy-sized", "cat /data/a.txt /data/sub/b.txt").await;
        assert!(ok && out.contains("one") && out.contains("two"), "{out}");
        let (ok, out) = in_volume("berth-e2e-legacy", "cat /data/a.txt").await;
        assert!(ok && out.contains("one"), "the original must be untouched: {out}");
        let again = manager.ensure(&mount("berth-e2e-legacy", Some(1))).await.expect("idempotent");
        assert_eq!(again, "berth-e2e-legacy-sized");
        println!("   -> copied to {adopted}, original intact, second run is a no-op");

        println!("7. refuses to resize a volume that a running container uses");
        let (ok, _) = sh(&["run", "-d", "--name", "berth-e2e-user", "-v", "berth-e2e-a:/data", HELPER_IMAGE, "sleep", "60"]).await;
        assert!(ok);
        let result = manager.ensure(&mount("berth-e2e-a", Some(3))).await;
        let _ = sh(&["rm", "-f", "berth-e2e-user"]).await;
        assert!(result.is_err(), "resizing under a running container must be refused");
        println!("   -> refused: {}", result.unwrap_err());

        cleanup(&names).await;
        println!("all volume checks passed");
    }
}
