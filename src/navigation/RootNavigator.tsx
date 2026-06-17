import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from '../screens/AuthScreen';
import OnboardingNameScreen from '../screens/OnboardingNameScreen';
import OnboardingBioScreen from '../screens/OnboardingBioScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CustomizeScreen from '../screens/CustomizeScreen';
import MainTabs from './MainTabs';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
    notification: colors.secondary,
  },
};

type Props = {
  isAuthed: boolean;
  hasProfile: boolean;
};

export default function RootNavigator({ isAuthed, hasProfile }: Props) {
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!isAuthed ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !hasProfile ? (
          <>
            <Stack.Screen name="OnboardingName" component={OnboardingNameScreen} />
            <Stack.Screen name="OnboardingBio" component={OnboardingBioScreen} />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{
                headerShown: true,
                headerTitle: '',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerShadowVisible: false,
                headerBackTitle: '',
              }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: { color: colors.textPrimary },
                headerShadowVisible: false,
                headerBackTitle: '',
              }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                headerShown: true,
                headerTitle: '',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerShadowVisible: false,
                headerBackTitle: '',
              }}
            />
            <Stack.Screen
              name="BlockedUsers"
              component={BlockedUsersScreen}
              options={{
                headerShown: true,
                headerTitle: '',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerShadowVisible: false,
                headerBackTitle: '',
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                headerShown: true,
                headerTitle: 'Settings',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: { color: colors.textPrimary },
                headerShadowVisible: false,
                headerBackTitle: '',
              }}
            />
            <Stack.Screen
              name="Customize"
              component={CustomizeScreen}
              options={{
                headerShown: true,
                headerTitle: 'Personalize',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: { color: colors.textPrimary },
                headerShadowVisible: false,
                headerBackTitle: '',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
