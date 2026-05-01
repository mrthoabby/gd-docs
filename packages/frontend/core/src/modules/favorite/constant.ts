export const FavoriteSupportType = [
  'collection',
  'doc',
  'tag',
  'folder',
  'container',
] as const;
export type FavoriteSupportTypeUnion =
  | 'collection'
  | 'doc'
  | 'tag'
  | 'folder'
  | 'container';
export const isFavoriteSupportType = (
  type: string
): type is FavoriteSupportTypeUnion =>
  FavoriteSupportType.includes(type as FavoriteSupportTypeUnion);
