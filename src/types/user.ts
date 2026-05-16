import type { Status } from './status';

export type NearbyUser = {
  id: string;
  name: string;
  photoUrl: string;
  photos: string[];
  status: Status;
  bio: string;
  interests: string[];
  age: number | null;
  distanceM: number;
};
