import { createContext, useContext } from 'react';

type ProfileGate = {
  refreshProfile: () => Promise<void>;
};

const ProfileGateContext = createContext<ProfileGate | null>(null);

export const ProfileGateProvider = ProfileGateContext.Provider;

export function useProfileGate(): ProfileGate {
  const ctx = useContext(ProfileGateContext);
  if (!ctx) {
    throw new Error('useProfileGate must be used inside ProfileGateProvider');
  }
  return ctx;
}
