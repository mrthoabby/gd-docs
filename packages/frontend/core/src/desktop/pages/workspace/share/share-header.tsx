import { BlocksuiteHeaderTitle } from '@affine/core/blocksuite/block-suite-header/title';
import { EditorModeSwitch } from '@affine/core/blocksuite/block-suite-mode-switch';
import ShareHeaderRightItem from '@affine/core/components/cloud/share-header-right-item';
import type { DocMode } from '@blocksuite/affine/model';

import * as styles from './share-header.css';

export function ShareHeader({
  publishMode,
}: {
  publishMode: DocMode;
}) {
  return (
    <div className={styles.header}>
      <EditorModeSwitch />
      <BlocksuiteHeaderTitle />
      <div className={styles.spacer} />
      <ShareHeaderRightItem publishMode={publishMode} />
    </div>
  );
}
