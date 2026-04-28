import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { cssVarV2 } from '@toeverything/theme/v2';
import { useEffect, useMemo } from 'react';

import * as style from './style.css';

type WorkspaceStatus =
  | 'server'
  | 'joinedWorkspace'
  | 'availableOffline'
  | 'teamWorkspace'
  | 'publishedToWeb';

type LabelProps = {
  value: string;
  background: string;
};

type LabelMap = {
  [key in WorkspaceStatus]: LabelProps;
};
type labelConditionsProps = {
  condition: boolean;
  label: WorkspaceStatus;
};
const Label = ({ value, background }: LabelProps) => {
  return (
    <div>
      <div className={style.workspaceLabel} style={{ background: background }}>
        {value}
      </div>
    </div>
  );
};

const getConditions = (
  isOwner: boolean | null,
  isTeam: boolean | null
): labelConditionsProps[] => {
  return [
    { condition: !isOwner, label: 'joinedWorkspace' },
    {
      condition: true,
      label: 'server',
    },
    { condition: !!isTeam, label: 'teamWorkspace' },
  ];
};

const getLabelMap = (t: ReturnType<typeof useI18n>): LabelMap => ({
  server: {
    value: t['com.affine.settings.workspace.state.sync-affine-cloud'](),
    background: cssVarV2('chip/label/blue'),
  },
  joinedWorkspace: {
    value: t['com.affine.settings.workspace.state.joined'](),
    background: cssVarV2('chip/label/yellow'),
  },
  availableOffline: {
    value: t['com.affine.settings.workspace.state.available-offline'](),
    background: cssVarV2('chip/label/green'),
  },
  publishedToWeb: {
    value: t['com.affine.settings.workspace.state.published'](),
    background: cssVarV2('chip/label/blue'),
  },
  teamWorkspace: {
    value: t['com.affine.settings.workspace.state.team'](),
    background: cssVarV2('chip/label/purple'),
  },
});

export const LabelsPanel = () => {
  const permissionService = useService(WorkspacePermissionService);
  const isOwner = useLiveData(permissionService.permission.isOwner$);
  const isTeam = useLiveData(permissionService.permission.isTeam$);
  const t = useI18n();

  useEffect(() => {
    permissionService.permission.revalidate();
  }, [permissionService]);

  const labelMap = useMemo(() => getLabelMap(t), [t]);

  const labelConditions = useMemo(
    () => getConditions(isOwner, isTeam),
    [isOwner, isTeam]
  );

  return (
    <div className={style.labelWrapper}>
      {labelConditions.map(
        ({ condition, label }) =>
          condition && (
            <Label
              key={label}
              value={labelMap[label].value}
              background={labelMap[label].background}
            />
          )
      )}
    </div>
  );
};
