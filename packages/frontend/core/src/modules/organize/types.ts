export interface NodeInfo {
  id: string;
  parentId: string | null;
  type: 'folder' | 'doc' | 'tag' | 'collection' | 'container';
  data: string;
  index: string;
}
