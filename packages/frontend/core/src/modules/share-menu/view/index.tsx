import { WorkspaceShareSettingService } from '@affine/core/modules/share-setting';
import type { Workspace } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import type { Store } from '@blocksuite/affine/store';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect } from 'react';

import { ShareMenu } from './share-menu';
export { ShareMenuContent } from './share-menu';

type SharePageModalProps = {
  workspace: Workspace;
  page: Store;
};

export const SharePageButton = ({ workspace, page }: SharePageModalProps) => {
  const t = useI18n();
  const shareSetting = useService(WorkspaceShareSettingService).sharePreview;
  const enableSharing = useLiveData(shareSetting.enableSharing$);

  const handleOpenShareModal = useCallback((open: boolean) => {
    if (open) {
      track.$.sharePanel.$.open();
    }
  }, []);

  useEffect(() => {
    shareSetting.revalidate();
  }, [shareSetting]);

  const sharingDisabled = enableSharing === false;
  const disabledReason = sharingDisabled
    ? t['com.affine.share-menu.workspace-sharing.disabled.tooltip']()
    : undefined;

  return (
    <ShareMenu
      workspaceMetadata={workspace.meta}
      currentPage={page}
      onOpenShareModal={handleOpenShareModal}
      disabled={sharingDisabled}
      disabledReason={disabledReason}
    />
  );
};
