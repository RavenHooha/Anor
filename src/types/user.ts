import type { Status } from './status';

export type NearbyUser = {
  id: string;
  name: string;
  photoUrl: string;
  photos: string[];
  status: Status;
  bio: string;
  interests: string[];
  connectPrefs: string[];
  age: number | null;
  venue: string | null;
  distanceM: number;
  createdAt: string | null;
};
