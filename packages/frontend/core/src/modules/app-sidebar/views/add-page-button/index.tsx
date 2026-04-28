import { Button, IconButton, Menu, MenuItem } from '@affine/component';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { EditorSettingService } from '@affine/core/modules/editor-setting';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { inferOpenMode } from '@affine/core/utils';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';
import type { DocMode } from '@blocksuite/affine/model';
import {
  ArrowDownSmallIcon,
  EdgelessIcon,
  PageIcon,
  PlusIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import type React from 'react';
import { type MouseEvent, useCallback } from 'react';

import * as styles from './index.css';

/**
 * @return a function to create a new doc
 */
const useNewDoc = () => {
  const workspaceService = useService(WorkspaceService);

  const currentWorkspace = workspaceService.workspace;

  const pageHelper = usePageHelper(currentWorkspace.docCollection);

  const createPage = useAsyncCallback(
    async (e?: MouseEvent, mode?: DocMode) => {
      pageHelper.createPage(mode, { at: inferOpenMode(e) });
    },
    [pageHelper]
  );

  return createPage;
};

interface AddPageButtonProps {
  className?: string;
  style?: React.CSSProperties;
}

const sideBottom = { side: 'bottom' as const };
export function AddPageButton(props: AddPageButtonProps) {
  const editorSetting = useService(EditorSettingService);
  const newDocDefaultMode = useLiveData(
    editorSetting.editorSetting.settings$.selector(s => s.newDocDefaultMode)
  );

  return newDocDefaultMode === 'ask' ? (
    <AddPageWithAsk {...props} />
  ) : (
    <AddPageWithoutAsk {...props} />
  );
}

function AddPageWithAsk({ className, style }: AddPageButtonProps) {
  const t = useI18n();
  const createDoc = useNewDoc();

  const createPage = useCallback(
    (e?: MouseEvent) => {
      createDoc(e, 'page');
      track.$.navigationPanel.$.createDoc();
      track.$.sidebar.newDoc.quickStart({ with: 'page' });
    },
    [createDoc]
  );
  const createEdgeless = useCallback(
    (e?: MouseEvent) => {
      createDoc(e, 'edgeless');
      track.$.navigationPanel.$.createDoc();
      track.$.sidebar.newDoc.quickStart({ with: 'edgeless' });
    },
    [createDoc]
  );

  return (
    <Menu
      items={
        <>
          <MenuItem
            prefixIcon={<PageIcon />}
            onClick={createPage}
            onAuxClick={createPage}
          >
            {t['Page']()}
          </MenuItem>
          <MenuItem
            prefixIcon={<EdgelessIcon />}
            onClick={createEdgeless}
            onAuxClick={createEdgeless}
          >
            {t['Edgeless']()}
          </MenuItem>
        </>
      }
    >
      <Button
        tooltip={t['New Page']()}
        tooltipOptions={sideBottom}
        data-testid="sidebar-new-page-with-ask-button"
        className={clsx([styles.withAskRoot, className])}
        style={style}
      >
        <div className={styles.withAskContent}>
          <PlusIcon />
          <ArrowDownSmallIcon />
        </div>
      </Button>
    </Menu>
  );
}

function AddPageWithoutAsk({ className, style }: AddPageButtonProps) {
  const createDoc = useNewDoc();

  const onClickNewPage = useCallback(
    (e?: MouseEvent) => {
      createDoc(e);
      track.$.navigationPanel.$.createDoc();
    },
    [createDoc]
  );

  const t = useI18n();

  return (
    <IconButton
      tooltip={t['New Page']()}
      tooltipOptions={sideBottom}
      data-testid="sidebar-new-page-button"
      style={style}
      className={clsx([styles.root, className])}
      size={16}
      onClick={onClickNewPage}
      onAuxClick={onClickNewPage}
    >
      <PlusIcon />
    </IconButton>
  );
}
