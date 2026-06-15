import { colors } from '../theme';
import ProfileTagSection from './ProfileTagSection';

type Props = {
  prefs: string[];
  align?: 'left' | 'center';
};

export default function ConnectPrefChips({ prefs, align = 'left' }: Props) {
  return (
    <ProfileTagSection
      icon="chatbubble-ellipses-outline"
      label="How to connect with me"
      tags={prefs}
      accent={colors.secondary}
      align={align}
    />
  );
}
