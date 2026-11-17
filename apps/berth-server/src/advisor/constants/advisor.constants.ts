export const ADVISOR_MAX_OUTPUT_TOKENS = 3000;
export const ADVISOR_MAX_FINDINGS = 12;
export const ADVISOR_METRIC_WINDOW_DAYS = 7;
export const ADVISOR_MIN_SAMPLES = 120;
export const ADVISOR_MIN_SAMPLES_FOR_DOWNSIZE = 2880;
export const ADVISOR_REQUEST_TIMEOUT_MS = 60_000;
export const ADVISOR_RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const ADVISOR_MANUAL_COOLDOWN_MS = 5 * 60 * 1000;

export const MEMORY_TIERS_MB = [256, 512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768];

export const LIMITS = {
  cpuCores: { min: 0.1, max: 64 },
  memoryMb: { min: 64, max: 262144 },
  diskGb: { min: 1, max: 2048 },
};
