export class StorageSettingsRules {
  static sizeError(sizeGb: number): string | null {
    if (!Number.isInteger(sizeGb)) return 'Use a whole number of GB.';
    if (sizeGb < 1) return 'At least 1 GB.';
    if (sizeGb > 2048) return 'At most 2048 GB.';
    return null;
  }

  static growthProblem(
    nextGb: number,
    currentGb: number,
    serverFreeGb: number | null,
  ): string | null {
    if (serverFreeGb === null) return null;
    const extra = nextGb - currentGb;
    if (extra <= serverFreeGb) return null;
    return `That needs ${extra} GB more, and only ${serverFreeGb} GB of this server's Berth storage is free. Raise the server's budget or pick a smaller size.`;
  }

  static change(nextGb: number, currentGb: number): 'same' | 'grow' | 'shrink' {
    if (nextGb === currentGb) return 'same';
    return nextGb > currentGb ? 'grow' : 'shrink';
  }
}
