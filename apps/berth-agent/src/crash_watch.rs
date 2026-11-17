use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

use crate::protocol::ServiceState;

pub const WATCH_INTERVAL: Duration = Duration::from_secs(10);
const RESTART_WINDOW: Duration = Duration::from_secs(5 * 60);
const CRASH_LOOP_RESTARTS: u64 = 3;

#[derive(Clone, Debug)]
pub struct ContainerObservation {
    pub service_id: String,
    pub name: String,
    pub status: String,
    pub restart_count: u64,
}

#[derive(Default)]
pub struct CrashWatch {
    restarts: HashMap<String, VecDeque<(Instant, u64)>>,
    reported: HashMap<String, ServiceState>,
}

impl CrashWatch {
    /// Feeds one poll of every managed container and returns the services whose
    /// health changed since the last poll. Only transitions are returned, so a
    /// crash-looping service produces one event, not one per poll.
    pub fn observe(
        &mut self,
        now: Instant,
        observations: &[ContainerObservation],
    ) -> Vec<(String, ServiceState)> {
        let mut per_service: HashMap<&str, Vec<ServiceState>> = HashMap::new();
        for observation in observations {
            let recent = self.recent_restarts(now, observation);
            per_service
                .entry(observation.service_id.as_str())
                .or_default()
                .push(classify(&observation.status, recent));
        }

        let mut changes = Vec::new();
        for (service_id, states) in per_service {
            let state = aggregate(&states);
            let previous = self.reported.insert(service_id.to_string(), state.clone());
            if let Some(change) = transition(previous.as_ref(), &state) {
                changes.push((service_id.to_string(), change));
            }
        }

        let live: Vec<&str> = observations.iter().map(|o| o.name.as_str()).collect();
        self.restarts.retain(|name, _| live.contains(&name.as_str()));
        let services: Vec<&str> = observations.iter().map(|o| o.service_id.as_str()).collect();
        self.reported.retain(|id, _| services.contains(&id.as_str()));
        changes
    }

    fn recent_restarts(&mut self, now: Instant, observation: &ContainerObservation) -> u64 {
        let history = self.restarts.entry(observation.name.clone()).or_default();
        history.push_back((now, observation.restart_count));
        while history
            .front()
            .is_some_and(|(at, _)| now.duration_since(*at) > RESTART_WINDOW)
        {
            history.pop_front();
        }
        let oldest = history.front().map(|(_, count)| *count).unwrap_or(0);
        observation.restart_count.saturating_sub(oldest)
    }
}

fn classify(status: &str, recent_restarts: u64) -> ServiceState {
    let lower = status.to_ascii_lowercase();
    if lower.starts_with("restarting") {
        ServiceState::Crashed
    } else if lower.starts_with("up") {
        if recent_restarts >= CRASH_LOOP_RESTARTS {
            ServiceState::Crashed
        } else {
            ServiceState::Running
        }
    } else if lower.contains("exited (0)") {
        ServiceState::Stopped
    } else if lower.contains("exited") || lower.starts_with("dead") {
        ServiceState::Crashed
    } else {
        ServiceState::Starting
    }
}

fn aggregate(states: &[ServiceState]) -> ServiceState {
    if states.iter().any(|s| matches!(s, ServiceState::Crashed)) {
        ServiceState::Crashed
    } else if states.iter().any(|s| matches!(s, ServiceState::Running)) {
        ServiceState::Running
    } else if states.iter().any(|s| matches!(s, ServiceState::Starting)) {
        ServiceState::Starting
    } else {
        ServiceState::Stopped
    }
}

fn transition(previous: Option<&ServiceState>, current: &ServiceState) -> Option<ServiceState> {
    let was_crashed = matches!(previous, Some(ServiceState::Crashed));
    match current {
        ServiceState::Crashed if !was_crashed => Some(ServiceState::Crashed),
        ServiceState::Running if was_crashed => Some(ServiceState::Running),
        _ => None,
    }
}

pub fn parse_listing(listing: &str, restarts: &HashMap<String, u64>) -> Vec<ContainerObservation> {
    listing
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(3, '\t');
            let name = parts.next()?.trim();
            let service_id = parts.next()?.trim();
            let status = parts.next()?.trim();
            if name.is_empty() || service_id.is_empty() || name.ends_with("-next") {
                return None;
            }
            Some(ContainerObservation {
                service_id: service_id.to_string(),
                name: name.to_string(),
                status: status.to_string(),
                restart_count: restarts.get(name).copied().unwrap_or(0),
            })
        })
        .collect()
}

pub fn parse_restart_counts(inspect: &str) -> HashMap<String, u64> {
    inspect
        .lines()
        .filter_map(|line| {
            let (name, count) = line.split_once('\t')?;
            Some((name.trim().trim_start_matches('/').to_string(), count.trim().parse().ok()?))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn observation(status: &str, restarts: u64) -> ContainerObservation {
        ContainerObservation {
            service_id: "svc".into(),
            name: "berth-svc".into(),
            status: status.into(),
            restart_count: restarts,
        }
    }

    fn step(watch: &mut CrashWatch, at: Instant, status: &str, restarts: u64) -> Vec<(String, ServiceState)> {
        watch.observe(at, &[observation(status, restarts)])
    }

    #[test]
    fn a_healthy_service_reports_nothing() {
        let mut watch = CrashWatch::default();
        let t = Instant::now();
        assert!(step(&mut watch, t, "Up 2 minutes", 0).is_empty());
        assert!(step(&mut watch, t + WATCH_INTERVAL, "Up 2 minutes", 0).is_empty());
    }

    #[test]
    fn a_crash_is_reported_once_not_on_every_poll() {
        let mut watch = CrashWatch::default();
        let t = Instant::now();
        step(&mut watch, t, "Up 1 minute", 0);
        let first = step(&mut watch, t + WATCH_INTERVAL, "Exited (1) 2 seconds ago", 0);
        assert_eq!(first.len(), 1);
        assert!(matches!(first[0].1, ServiceState::Crashed));
        assert!(step(&mut watch, t + WATCH_INTERVAL * 2, "Exited (1) 12 seconds ago", 0).is_empty());
    }

    #[test]
    fn a_crash_loop_is_caught_even_while_the_container_is_briefly_up() {
        let mut watch = CrashWatch::default();
        let t = Instant::now();
        step(&mut watch, t, "Up 5 seconds", 0);
        step(&mut watch, t + WATCH_INTERVAL, "Up 4 seconds", 1);
        step(&mut watch, t + WATCH_INTERVAL * 2, "Up 3 seconds", 2);
        let loop_detected = step(&mut watch, t + WATCH_INTERVAL * 3, "Up 2 seconds", 3);
        assert_eq!(loop_detected.len(), 1);
        assert!(matches!(loop_detected[0].1, ServiceState::Crashed));
    }

    #[test]
    fn restarting_status_counts_as_crashed() {
        let mut watch = CrashWatch::default();
        let changes = step(&mut watch, Instant::now(), "Restarting (1) 3 seconds ago", 4);
        assert!(matches!(changes[0].1, ServiceState::Crashed));
    }

    #[test]
    fn a_single_restart_is_not_a_crash_loop() {
        let mut watch = CrashWatch::default();
        let t = Instant::now();
        step(&mut watch, t, "Up 1 minute", 0);
        assert!(step(&mut watch, t + WATCH_INTERVAL, "Up 5 seconds", 1).is_empty());
    }

    #[test]
    fn old_restarts_age_out_of_the_window() {
        let mut watch = CrashWatch::default();
        let t = Instant::now();
        step(&mut watch, t, "Up 1 hour", 7);
        let later = t + RESTART_WINDOW + Duration::from_secs(60);
        assert!(step(&mut watch, later, "Up 1 hour", 7).is_empty());
    }

    #[test]
    fn recovery_is_reported_so_the_dashboard_clears() {
        let mut watch = CrashWatch::default();
        let t = Instant::now();
        step(&mut watch, t, "Exited (137) 5 seconds ago", 0);
        let recovered = step(&mut watch, t + WATCH_INTERVAL, "Up 3 seconds", 0);
        assert_eq!(recovered.len(), 1);
        assert!(matches!(recovered[0].1, ServiceState::Running));
    }

    #[test]
    fn a_deliberate_stop_is_not_a_crash() {
        let mut watch = CrashWatch::default();
        let t = Instant::now();
        step(&mut watch, t, "Up 1 minute", 0);
        assert!(step(&mut watch, t + WATCH_INTERVAL, "Exited (0) 2 seconds ago", 0).is_empty());
    }

    #[test]
    fn one_crash_looping_replica_marks_the_service_crashed() {
        let mut watch = CrashWatch::default();
        let healthy = ContainerObservation { name: "berth-svc".into(), ..observation("Up 1 hour", 0) };
        let broken = ContainerObservation { name: "berth-svc-replica-1".into(), ..observation("Restarting (1) 2 seconds ago", 0) };
        let changes = watch.observe(Instant::now(), &[healthy, broken]);
        assert!(matches!(changes[0].1, ServiceState::Crashed));
    }

    #[test]
    fn parses_docker_output_and_skips_transient_containers() {
        let restarts = parse_restart_counts("/berth-a\t2\n/berth-b\tnot-a-number\n");
        assert_eq!(restarts.get("berth-a"), Some(&2));
        assert!(!restarts.contains_key("berth-b"));

        let listing = "berth-a\tsvc-a\tUp 1 minute\nberth-a-next\tsvc-a\tCreated\nberth-proxy\t\tUp 3 days\n";
        let parsed = parse_listing(listing, &restarts);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].restart_count, 2);
    }
}
