import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export type Status = 'open' | 'connect' | 'focus' | 'spark';

export type StatusConfig = {
  id: Status;
  label: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
};

export const STATUSES: readonly StatusConfig[] = [
  {
    id: 'open',
    label: 'Open',
    description: 'Around and up for whatever.',
    icon: 'cafe-outline',
    color: colors.highlight,
  },
  {
    id: 'connect',
    label: 'Connect',
    description: 'Looking to meet someone new.',
    icon: 'people-outline',
    color: colors.secondary,
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Heads down. Catch me later.',
    icon: 'moon-outline',
    color: colors.textMuted,
  },
  {
    id: 'spark',
    label: 'Spark',
    description: 'Looking for a real connection.',
    icon: 'flame-outline',
    color: colors.primary,
  },
] as const;

export const STATUS_BY_ID: Record<Status, StatusConfig> = STATUSES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<Status, StatusConfig>,
);
