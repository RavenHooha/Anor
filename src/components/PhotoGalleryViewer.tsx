import { useRef, useState } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  photos: string[];
  aspectRatio?: number;
};

export default function PhotoGalleryViewer({ photos, aspectRatio = 1 }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth - spacing.lg * 2;
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  if (photos.length === 0) {
    return <View style={[styles.placeholder, { width, aspectRatio }]} />;
  }

  if (photos.length === 1) {
    return (
      <Image
        source={{ uri: photos[0] }}
        style={[styles.single, { width, aspectRatio }]}
      />
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View>
      <FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(url, i) => `${i}:${url}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={[styles.single, { width, aspectRatio }]}
          />
        )}
        style={{ width, aspectRatio, alignSelf: 'center' }}
      />
      <View style={styles.dots}>
        {photos.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  single: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
  },
  placeholder: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    alignSelf: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
});
