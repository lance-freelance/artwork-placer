import type { Room } from '@/types';

/**
 * Phase 1: hardcoded placeholder data, shaped exactly as it will be read from
 * the database in Phase 2.
 *
 * Room image spec: 1600x1000px, 16:10. Every file in `/public/rooms/` conforms
 * to the spec — there is no runtime detection or validation.
 */
export const rooms: Room[] = [
  {
    id: 'living-room',
    name: 'Living Room',
    imageFilename: 'living-room.jpg',
    bandSplit: 58,
  },
  {
    id: 'loft',
    name: 'Loft',
    imageFilename: 'loft.jpg',
    bandSplit: 62,
  },
  {
    id: 'office',
    name: 'Office',
    imageFilename: 'office.jpg',
    bandSplit: 55,
  },
  {
    id: 'primary-suite',
    name: 'Primary Suite',
    imageFilename: 'primary-suite.jpg',
    bandSplit: 60,
  },
];
