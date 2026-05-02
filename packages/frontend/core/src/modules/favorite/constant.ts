export const FavoriteSupportType = [
  'collection',
  'doc',
  'tag',
  'folder',
  'container',
  'knowledge-base',
] as const;
export type FavoriteSupportTypeUnion =
  | 'collection'
  | 'doc'
  | 'tag'
  | 'folder'
  | 'container'
  | 'knowledge-base';
export const isFavoriteSupportType = (
  type: string
): type is FavoriteSupportTypeUnion =>
  FavoriteSupportType.includes(type as FavoriteSupportTypeUnion);
