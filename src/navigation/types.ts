import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NearbyUser } from '../types/user';

export type MainTabParamList = {
  Home: undefined;
  Threads: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  OnboardingName: undefined;
  OnboardingBio: { name: string; photoUri: string | null };
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  UserProfile: { user: NearbyUser };
  Chat: { threadId: string };
  EditProfile: undefined;
  BlockedUsers: undefined;
  Settings: undefined;
};
