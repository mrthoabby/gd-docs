import { IconButton, Menu, MenuItem } from '@affine/component';
import { Divider } from '@affine/component/ui/divider';
import { useSignOut } from '@affine/core/components/hooks/affine/use-sign-out';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import type { AuthAccountInfo, Server } from '@affine/core/modules/cloud';
import { AuthService, ServersService } from '@affine/core/modules/cloud';
import { GlobalDialogService } from '@affine/core/modules/dialogs';
import {
  type WorkspaceMetadata,
  WorkspaceService,
  WorkspacesService,
} from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import {
  AccountIcon,
  CloudWorkspaceIcon,
  MoreHorizontalIcon,
  SignOutIcon,
} from '@blocksuite/icons/rc';
import {
  FrameworkScope,
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { WorkspaceCard } from '../../workspace-card';
import * as styles from './index.css';

const WorkspaceServerInfo = ({
  name,
  account,
  accountStatus,
  onSignOut,
}: {
  name: string;
  account?: AuthAccountInfo | null;
  accountStatus?: 'authenticated' | 'unauthenticated';
  onSignOut?: () => void;
}) => {
  const t = useI18n();

  const menuItems = useMemo(
    () =>
      [
        accountStatus === 'authenticated' && (
          <MenuItem
            prefixIcon={<SignOutIcon />}
            key="sign-out"
            onClick={onSignOut}
            type="danger"
          >
            {t['Sign out']()}
          </MenuItem>
        ),
      ].filter(Boolean),
    [accountStatus, onSignOut, t]
  );

  return (
    <div className={styles.workspaceServer}>
      <div className={styles.workspaceServerIcon}>
        <CloudWorkspaceIcon />
      </div>
      <div className={styles.workspaceServerContent}>
        <div className={styles.workspaceServerName}>{name}</div>
        <div className={styles.workspaceServerAccount}>
          {account ? account.email : 'Not signed in'}
        </div>
      </div>
      <div className={styles.workspaceServerSpacer} />
      {menuItems.length ? (
        <Menu items={menuItems}>
          <IconButton
            icon={<MoreHorizontalIcon className={styles.infoMoreIcon} />}
          />
        </Menu>
      ) : null}
    </div>
  );
};

const CloudWorkSpaceList = ({
  server,
  workspaces,
  onClickWorkspace,
}: {
  server: Server;
  workspaces: WorkspaceMetadata[];
  onClickWorkspace: (workspaceMetadata: WorkspaceMetadata) => void;
}) => {
  const t = useI18n();
  const globalDialogService = useService(GlobalDialogService);
  const serverName = useLiveData(server.config$.selector(c => c.serverName));
  const authService = useService(AuthService);
  const account = useLiveData(authService.session.account$);
  const accountStatus = useLiveData(authService.session.status$);

  const handleSignOut = useSignOut();

  const handleSignIn = useAsyncCallback(async () => {
    globalDialogService.open('sign-in', {
      server: server.baseUrl,
    });
  }, [globalDialogService, server.baseUrl]);

  return (
    <>
      <WorkspaceServerInfo
        name={serverName}
        account={account}
        accountStatus={accountStatus}
        onSignOut={handleSignOut}
      />
      {accountStatus === 'unauthenticated' ? (
        <MenuItem key="sign-in" onClick={handleSignIn}>
          <div className={styles.signInMenuItemContent}>
            <div className={styles.signInIconWrapper}>
              <AccountIcon />
            </div>
            <div className={styles.signInText}>{t['Sign in']()}</div>
          </div>
        </MenuItem>
      ) : null}
      <WorkspaceList items={workspaces} onClick={onClickWorkspace} />
    </>
  );
};

export const AFFiNEWorkspaceList = ({
  onEventEnd,
  onClickWorkspace,
}: {
  onClickWorkspace?: (workspaceMetadata: WorkspaceMetadata) => void;
  onEventEnd?: () => void;
}) => {
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.list.workspaces$);

  const serversService = useService(ServersService);
  const servers = useLiveData(serversService.servers$);
  const affineCloudServer = useMemo(
    () => servers.find(s => s.id === 'affine-cloud') as Server,
    [servers]
  );

  const handleClickWorkspace = useCallback(
    (workspaceMetadata: WorkspaceMetadata) => {
      onClickWorkspace?.(workspaceMetadata);
      onEventEnd?.();
    },
    [onClickWorkspace, onEventEnd]
  );

  return (
    <>
      <FrameworkScope
        key={affineCloudServer.id}
        scope={affineCloudServer.scope}
      >
        <CloudWorkSpaceList
          server={affineCloudServer}
          workspaces={workspaces.filter(
            ({ flavour }) => flavour === affineCloudServer.id
          )}
          onClickWorkspace={handleClickWorkspace}
        />
      </FrameworkScope>
      <Divider size="thinner" />
    </>
  );
};

interface WorkspaceListProps {
  items: WorkspaceMetadata[];
  onClick: (workspace: WorkspaceMetadata) => void;
  onSettingClick?: (workspace: WorkspaceMetadata) => void;
}

interface SortableWorkspaceItemProps extends Omit<WorkspaceListProps, 'items'> {
  workspaceMetadata: WorkspaceMetadata;
}

const SortableWorkspaceItem = ({
  workspaceMetadata,
  onClick,
  onSettingClick,
}: SortableWorkspaceItemProps) => {
  const handleClick = useCallback(() => {
    onClick(workspaceMetadata);
  }, [onClick, workspaceMetadata]);

  const currentWorkspace = useServiceOptional(WorkspaceService)?.workspace;

  return (
    <WorkspaceCard
      className={styles.workspaceCard}
      infoClassName={styles.workspaceCardInfoContainer}
      workspaceMetadata={workspaceMetadata}
      onClick={handleClick}
      avatarSize={22}
      active={currentWorkspace?.id === workspaceMetadata.id}
      onClickOpenSettings={onSettingClick}
    />
  );
};

export const WorkspaceList = (props: WorkspaceListProps) => {
  const workspaceList = props.items;

  return workspaceList.map(item => (
    <SortableWorkspaceItem key={item.id} {...props} workspaceMetadata={item} />
  ));
};
