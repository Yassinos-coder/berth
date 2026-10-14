import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ServiceVolumeValidator } from './service-volume.validator';

describe('ServiceVolumeValidator.normalize', () => {
  it('returns null for blank input so a volume can be cleared', () => {
    expect(ServiceVolumeValidator.normalize('   ')).toBeNull();
    expect(ServiceVolumeValidator.normalize('')).toBeNull();
  });

  it('accepts an absolute path and trims trailing slashes', () => {
    expect(ServiceVolumeValidator.normalize(' /app/data/ ')).toBe('/app/data');
    expect(ServiceVolumeValidator.normalize('/var/lib/my-app_1.0')).toBe(
      '/var/lib/my-app_1.0',
    );
  });

  it.each(['app/data', './data', '/app data', '/app;rm', '/a\nb', '/'])(
    'rejects %j',
    (path) => {
      expect(() => ServiceVolumeValidator.normalize(path)).toThrow(
        BadRequestException,
      );
    },
  );

  it('rejects parent-directory segments', () => {
    expect(() => ServiceVolumeValidator.normalize('/app/../etc')).toThrow(
      BadRequestException,
    );
  });

  it('rejects overly long paths', () => {
    expect(() => ServiceVolumeValidator.normalize(`/${'a'.repeat(300)}`)).toThrow(
      BadRequestException,
    );
  });
});

describe('ServiceVolumeValidator.volumeNameFor', () => {
  it('derives a stable docker-safe name', () => {
    expect(ServiceVolumeValidator.volumeNameFor('Giveaway-Winner')).toBe(
      'giveaway_winner-data',
    );
  });

  it('falls back when the name has no usable characters', () => {
    expect(ServiceVolumeValidator.volumeNameFor('---')).toBe('berth_app-data');
  });
});
