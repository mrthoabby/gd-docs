import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';

import { BlobManagementPanel } from './blob-management';
import { WorkspaceQuotaPanel } from './workspace-quota';

export const WorkspaceSettingStorage = ({
  onCloseSetting: _onCloseSetting,
}: {
  onCloseSetting: () => void;
}) => {
  const t = useI18n();
  const workspacePermissionService = useService(
    WorkspacePermissionService
  ).permission;
  const isTeam = useLiveData(workspacePermissionService.isTeam$);

  return (
    <>
      <SettingHeader
        title={t['Storage']()}
        subtitle={t['com.affine.settings.workspace.storage.subtitle']()}
      />
      {isTeam ? (
        <SettingWrapper>
          <WorkspaceQuotaPanel />
        </SettingWrapper>
      ) : null}

      <SettingWrapper>
        <BlobManagementPanel />
      </SettingWrapper>
    </>
  );
};
