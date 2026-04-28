import { AffineErrorBoundary } from '@affine/core/components/affine/affine-error-boundary';
import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import type { ReactElement } from 'react';

import { CloudWorkspaceMembersPanel } from './cloud-members-panel';

export const MembersPanel = ({
  onCloseSetting: _onCloseSetting,
}: {
  onCloseSetting: () => void;
}): ReactElement | null => {
  const workspace = useService(WorkspaceService).workspace;
  const isTeam = useWorkspaceInfo(workspace.meta)?.isTeam;
  return (
    <AffineErrorBoundary>
      <CloudWorkspaceMembersPanel isTeam={isTeam} />
    </AffineErrorBoundary>
  );
};
