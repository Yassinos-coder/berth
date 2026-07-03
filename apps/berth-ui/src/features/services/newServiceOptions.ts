import {
  Boxes,
  Database,
  Github,
  HardDrive,
  LayoutTemplate,
  SquareDashed,
  type LucideIcon,
} from 'lucide-react';
import type { ServiceKind } from '@/interfaces';

export type SourceChoice =
  | 'git'
  | 'image'
  | 'database'
  | 'bucket'
  | 'template'
  | 'empty';

export interface SourceOption {
  id: SourceChoice;
  title: string;
  description: string;
  icon: LucideIcon;
  kind: ServiceKind;
}

export const SOURCE_OPTIONS: SourceOption[] = [
  {
    id: 'git',
    title: 'GitHub Repository',
    description: 'Build & deploy on push. Dockerfile or Nixpacks, CI/CD included.',
    icon: Github,
    kind: 'git',
  },
  {
    id: 'image',
    title: 'Docker Image',
    description: 'Deploy any public or private image from a registry.',
    icon: Boxes,
    kind: 'image',
  },
  {
    id: 'database',
    title: 'Database',
    description: 'Postgres, MySQL, Redis, Mongo — with a persistent volume.',
    icon: Database,
    kind: 'database',
  },
  {
    id: 'bucket',
    title: 'Bucket',
    description: 'S3-compatible object storage backed by MinIO.',
    icon: HardDrive,
    kind: 'bucket',
  },
  {
    id: 'template',
    title: 'Template',
    description: 'Start from a pre-filled spec — one or many containers.',
    icon: LayoutTemplate,
    kind: 'image',
  },
  {
    id: 'empty',
    title: 'Empty Service',
    description: 'A blank ServiceSpec you configure from scratch.',
    icon: SquareDashed,
    kind: 'image',
  },
];
