import type { DocProps } from '@affine/core/blocksuite/initialization';
import type { DocMode } from '@blocksuite/affine/model';

export type DocContentType = 'document' | 'diagram';

export function getDocModeByContentType(contentType: DocContentType): DocMode {
  return contentType === 'diagram' ? 'edgeless' : 'page';
}

export function getContentTypeByDocMode(mode?: DocMode): DocContentType {
  return mode === 'edgeless' ? 'diagram' : 'document';
}

export interface DocCreateOptions {
  id?: string;
  title?: string;
  contentType?: DocContentType;
  primaryMode?: DocMode;
  skipInit?: boolean;
  docProps?: DocProps;
}
