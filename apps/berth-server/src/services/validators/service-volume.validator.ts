import { BadRequestException } from '@nestjs/common';

const MAX_PATH_LENGTH = 255;
const VOLUME_PATH_PATTERN = /^\/[A-Za-z0-9._\-/]+$/;

export class ServiceVolumeValidator {
  static normalize(raw: string): string | null {
    const path = raw.trim();
    if (path.length === 0) return null;
    if (path.length > MAX_PATH_LENGTH) {
      throw new BadRequestException('Volume path is too long');
    }
    if (!VOLUME_PATH_PATTERN.test(path)) {
      throw new BadRequestException(
        'Volume path must be an absolute path such as /app/data',
      );
    }
    if (path.split('/').includes('..')) {
      throw new BadRequestException('Volume path must not contain ".."');
    }
    const trimmed = path.replace(/\/+$/, '');
    if (trimmed.length === 0) {
      throw new BadRequestException('Volume path must not be the root directory');
    }
    return trimmed;
  }

  static volumeNameFor(serviceName: string): string {
    const cleaned = serviceName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+/, '');
    return `${cleaned || 'berth_app'}-data`;
  }
}
