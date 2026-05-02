import { type DropTargetDropEvent, MenuItem, toast } from '@affine/component';
import { IsFavoriteIcon } from '@affine/core/components/pure/icons';
import { CompatibleFavoriteItemsAdapter } from '@affine/core/modules/favorite';
import { KnowledgeBaseService } from '@affine/core/modules/knowledge-base';
import { NavigationPanelService } from '@affine/core/modules/navigation-panel';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import { AiIcon, DeleteIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { NavigationPanelTreeNode } from '../../tree';
import type { NavigationPanelTreeNodeIcon } from '../../tree/node';
import type { NodeOperation } from '../../tree/types';
import type { GenericNavigationPanelNode } from '../types';

const KnowledgeBaseIcon: NavigationPanelTreeNodeIcon = ({ className }) => (
  <AiIcon className={className} />
);

export const NavigationPanelKnowledgeBaseNode = ({
  knowledgeBaseId,
  onDrop,
  location,
  reorderable,
  operations: additionalOperations,
  canDrop,
  dropEffect,
  parentPath,
}: {
  knowledgeBaseId: string;
} & GenericNavigationPanelNode) => {
  const t = useI18n();
  const { knowledgeBaseService } = useServices({
    KnowledgeBaseService,
  });
  const favoriteItemsAdapter = useService(CompatibleFavoriteItemsAdapter);
  const navigationPanelService = useService(NavigationPanelService);
  const knowledgeBase = useLiveData(
    knowledgeBaseService.knowledgeBase$(knowledgeBaseId)
  );
  const routerLocation = useLocation();
  const active =
    routerLocation.pathname === `/knowledge-base/${knowledgeBaseId}`;
  const favorite = useLiveData(
    useMemo(
      () => favoriteItemsAdapter.isFavorite$(knowledgeBaseId, 'knowledge-base'),
      [knowledgeBaseId, favoriteItemsAdapter]
    )
  );

  useEffect(() => {
    if (!knowledgeBase) {
      void knowledgeBaseService
        .loadKnowledgeBase(knowledgeBaseId)
        .catch(console.error);
    }
  }, [knowledgeBase, knowledgeBaseId, knowledgeBaseService]);

  const path = useMemo(
    () => [...(parentPath ?? []), `knowledge-base-${knowledgeBaseId}`],
    [parentPath, knowledgeBaseId]
  );
  const collapsed = useLiveData(navigationPanelService.collapsed$(path));
  const setCollapsed = useCallback(
    (value: boolean) => {
      navigationPanelService.setCollapsed(path, value);
    },
    [navigationPanelService, path]
  );

  const dndData = useMemo(() => {
    return {
      draggable: {
        entity: {
          type: 'knowledge-base',
          id: knowledgeBaseId,
        },
        from: location,
      },
      dropTarget: {
        at: 'navigation-panel:knowledge-base',
      },
    } satisfies AffineDNDData;
  }, [knowledgeBaseId, location]);

  const handleRename = useCallback(
    async (name: string) => {
      if (!knowledgeBase || knowledgeBase.name === name) {
        return;
      }
      await knowledgeBaseService.renameKnowledgeBase(knowledgeBaseId, name);
      track.$.navigationPanel.organize.renameOrganizeItem({
        type: 'knowledge-base',
      });
      toast(t['com.affine.toastMessage.rename']());
    },
    [knowledgeBase, knowledgeBaseId, knowledgeBaseService, t]
  );

  const handleTrash = useCallback(async () => {
    await knowledgeBaseService.trashKnowledgeBase(knowledgeBaseId);
    track.$.navigationPanel.organize.deleteOrganizeItem({
      type: 'knowledge-base',
    });
    toast(t['com.affine.knowledgeBase.trash.success']());
  }, [knowledgeBaseId, knowledgeBaseService, t]);

  const knowledgeBaseOperations = useMemo<NodeOperation[]>(
    () => [
      {
        index: 200,
        view: (
          <MenuItem
            prefixIcon={<IsFavoriteIcon favorite={favorite} />}
            onClick={() =>
              favoriteItemsAdapter.toggle(knowledgeBaseId, 'knowledge-base')
            }
          >
            {favorite
              ? t['com.affine.rootAppSidebar.organize.folder-rm-favorite']()
              : t['com.affine.rootAppSidebar.organize.folder-add-favorite']()}
          </MenuItem>
        ),
      },
      {
        index: 10000,
        view: (
          <MenuItem
            type="danger"
            prefixIcon={<DeleteIcon />}
            onClick={handleTrash}
          >
            {t['com.affine.rootAppSidebar.organize.delete']()}
          </MenuItem>
        ),
      },
    ],
    [favorite, favoriteItemsAdapter, handleTrash, knowledgeBaseId, t]
  );

  const finalOperations = useMemo(() => {
    if (additionalOperations) {
      return additionalOperations;
    }
    return knowledgeBaseOperations;
  }, [additionalOperations, knowledgeBaseOperations]);

  return (
    <NavigationPanelTreeNode
      icon={KnowledgeBaseIcon}
      name={knowledgeBase?.name || t['com.affine.knowledgeBase.untitled']()}
      dndData={dndData}
      onDrop={(data: DropTargetDropEvent<AffineDNDData>) => onDrop?.(data)}
      active={active}
      renameable={!!knowledgeBase}
      onRename={handleRename}
      reorderable={reorderable}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      collapsible={false}
      operations={finalOperations}
      canDrop={canDrop}
      dropEffect={dropEffect}
      to={`/knowledge-base/${knowledgeBaseId}`}
      data-testid={`navigation-panel-knowledge-base-${knowledgeBaseId}`}
    />
  );
};
