import { colors } from '../theme';
import ProfileTagSection from './ProfileTagSection';

type Props = {
  interests: string[];
  align?: 'left' | 'center';
};

export default function InterestChips({ interests, align = 'left' }: Props) {
  return (
    <ProfileTagSection
      icon="sparkles-outline"
      label="Interests"
      tags={interests}
      accent={colors.highlight}
      align={align}
    />
  );
}
