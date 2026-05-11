import { ProductLogoIcon, ScrollableContainer } from '@affine/component';
import { MenuItem } from '@affine/component/ui/menu';
import { AuthService } from '@affine/core/modules/cloud';
import { GlobalDialogService } from '@affine/core/modules/dialogs';
import { type WorkspaceMetadata } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { AddWorkspace } from './add-workspace';
import * as styles from './index.css';
import { CloudWorkspaceListSection } from './workspace-list';

export const SignInItem = () => {
  const globalDialogService = useService(GlobalDialogService);

  const t = useI18n();

  const onClickSignIn = useCallback(() => {
    track.$.navigationPanel.workspaceList.requestSignIn();
    globalDialogService.open('sign-in', {});
  }, [globalDialogService]);

  return (
    <MenuItem
      className={styles.menuItem}
      onClick={onClickSignIn}
      data-testid="cloud-signin-button"
    >
      <div className={styles.signInWrapper}>
        <div className={styles.iconContainer}>
          <ProductLogoIcon />
        </div>

        <div className={styles.signInTextContainer}>
          <div className={styles.signInTextPrimary}>
            {t['com.affine.workspace.cloud.auth']()}
          </div>
          <div className={styles.signInTextSecondary}>
            {t['com.affine.workspace.server.description']()}
          </div>
        </div>
      </div>
    </MenuItem>
  );
};

interface UserWithWorkspaceListProps {
  onEventEnd?: () => void;
  onClickWorkspace?: (workspace: WorkspaceMetadata) => void;
  onCreatedWorkspace?: (payload: {
    metadata: WorkspaceMetadata;
    defaultDocId?: string;
  }) => void;
}

export const UserWithWorkspaceList = ({
  onEventEnd,
  onClickWorkspace,
  onCreatedWorkspace,
}: UserWithWorkspaceListProps) => {
  const globalDialogService = useService(GlobalDialogService);
  const session = useLiveData(useService(AuthService).session.session$);

  const isAuthenticated = session.status === 'authenticated';

  const openSignInModal = useCallback(() => {
    globalDialogService.open('sign-in', {});
  }, [globalDialogService]);

  const onNewWorkspace = useCallback(() => {
    if (!isAuthenticated) {
      return openSignInModal();
    }
    track.$.navigationPanel.workspaceList.createWorkspace();
    globalDialogService.open('create-workspace', {}, payload => {
      if (payload) {
        onCreatedWorkspace?.(payload);
      }
    });
    onEventEnd?.();
  }, [
    globalDialogService,
    isAuthenticated,
    onCreatedWorkspace,
    onEventEnd,
    openSignInModal,
  ]);

  const onAddWorkspace = useCallback(() => {
    track.$.navigationPanel.workspaceList.createWorkspace({
      control: 'import',
    });
    globalDialogService.open('import-workspace', undefined, payload => {
      if (payload) {
        onCreatedWorkspace?.({ metadata: payload.workspace });
      }
    });
    onEventEnd?.();
  }, [globalDialogService, onCreatedWorkspace, onEventEnd]);

  return (
    <>
      <ScrollableContainer
        className={styles.workspaceScrollArea}
        viewPortClassName={styles.workspaceScrollAreaViewport}
        scrollBarClassName={styles.scrollbar}
        scrollThumbClassName={styles.scrollbarThumb}
      >
        <CloudWorkspaceListSection
          onEventEnd={onEventEnd}
          onClickWorkspace={onClickWorkspace}
        />
      </ScrollableContainer>
      <div className={styles.workspaceFooter}>
        <AddWorkspace
          onAddWorkspace={onAddWorkspace}
          onNewWorkspace={onNewWorkspace}
        />
      </div>
    </>
  );
};
