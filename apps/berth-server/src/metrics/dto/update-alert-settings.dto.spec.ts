import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateAlertSettingsDto } from './update-alert-settings.dto';

const errorsFor = async (input: object) =>
  (await validate(plainToInstance(UpdateAlertSettingsDto, input))).map((error) => error.property);

describe('UpdateAlertSettingsDto', () => {
  it('accepts an empty patch and a full valid patch', async () => {
    expect(await errorsFor({})).toEqual([]);
    expect(await errorsFor({ enabled: false, cpuPct: 80, memPct: 85, diskPct: 95, minutes: 10 })).toEqual([]);
  });

  it.each([
    ['cpuPct', 49],
    ['cpuPct', 101],
    ['memPct', 10],
    ['diskPct', 100],
    ['minutes', 0],
    ['minutes', 61],
  ])('rejects %s=%s', async (field, value) => {
    expect(await errorsFor({ [field]: value })).toEqual([field]);
  });

  it('rejects non-integers and wrong types', async () => {
    expect(await errorsFor({ cpuPct: 80.5 })).toEqual(['cpuPct']);
    expect(await errorsFor({ minutes: '5' })).toEqual(['minutes']);
    expect(await errorsFor({ enabled: 'yes' })).toEqual(['enabled']);
  });
});
