import { type DropTargetDropEvent, MenuItem, toast } from '@affine/component';
import { IsFavoriteIcon } from '@affine/core/components/pure/icons';
import { ContainerService } from '@affine/core/modules/container';
import { CompatibleFavoriteItemsAdapter } from '@affine/core/modules/favorite';
import { GlobalContextService } from '@affine/core/modules/global-context';
import { NavigationPanelService } from '@affine/core/modules/navigation-panel';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import { DeleteIcon, ViewLayersIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import { useCallback, useEffect, useMemo } from 'react';

import { NavigationPanelTreeNode } from '../../tree';
import type { NavigationPanelTreeNodeIcon } from '../../tree/node';
import type { NodeOperation } from '../../tree/types';
import type { GenericNavigationPanelNode } from '../types';

const ContainerIcon: NavigationPanelTreeNodeIcon = ({ className }) => (
  <ViewLayersIcon className={className} />
);

export const NavigationPanelContainerNode = ({
  containerId,
  onDrop,
  location,
  reorderable,
  operations: additionalOperations,
  canDrop,
  dropEffect,
  parentPath,
}: {
  containerId: string;
} & GenericNavigationPanelNode) => {
  const t = useI18n();
  const { containerService, globalContextService } = useServices({
    ContainerService,
    GlobalContextService,
  });
  const favoriteItemsAdapter = useService(CompatibleFavoriteItemsAdapter);
  const navigationPanelService = useService(NavigationPanelService);
  const container = useLiveData(containerService.container$(containerId));
  const active =
    useLiveData(globalContextService.globalContext.containerId.$) ===
    containerId;
  const favorite = useLiveData(
    useMemo(
      () => favoriteItemsAdapter.isFavorite$(containerId, 'container'),
      [containerId, favoriteItemsAdapter]
    )
  );

  useEffect(() => {
    if (!container) {
      void containerService.loadContainer(containerId).catch(console.error);
    }
  }, [container, containerId, containerService]);

  const path = useMemo(
    () => [...(parentPath ?? []), `container-${containerId}`],
    [parentPath, containerId]
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
          type: 'container',
          id: containerId,
        },
        from: location,
      },
      dropTarget: {
        at: 'navigation-panel:container',
      },
    } satisfies AffineDNDData;
  }, [containerId, location]);

  const handleRename = useCallback(
    async (name: string) => {
      if (!container || container.name === name) {
        return;
      }
      await containerService.renameContainer(containerId, name);
      track.$.navigationPanel.organize.renameOrganizeItem({
        type: 'container',
      });
      toast(t['com.affine.toastMessage.rename']());
    },
    [container, containerId, containerService, t]
  );

  const handleTrash = useCallback(async () => {
    await containerService.trashContainer(containerId);
    track.$.navigationPanel.organize.deleteOrganizeItem({
      type: 'container',
    });
    toast(t['com.affine.container.trash.success']());
  }, [containerId, containerService, t]);

  const containerOperations = useMemo<NodeOperation[]>(
    () => [
      {
        index: 200,
        view: (
          <MenuItem
            prefixIcon={<IsFavoriteIcon favorite={favorite} />}
            onClick={() => favoriteItemsAdapter.toggle(containerId, 'container')}
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
    [containerId, favorite, favoriteItemsAdapter, handleTrash, t]
  );

  const finalOperations = useMemo(() => {
    if (additionalOperations) {
      return additionalOperations;
    }
    return containerOperations;
  }, [additionalOperations, containerOperations]);

  return (
    <NavigationPanelTreeNode
      icon={ContainerIcon}
      name={container?.name || t['com.affine.container.untitled']()}
      dndData={dndData}
      onDrop={(data: DropTargetDropEvent<AffineDNDData>) => onDrop?.(data)}
      active={active}
      renameable={!!container}
      onRename={handleRename}
      reorderable={reorderable}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      collapsible={false}
      operations={finalOperations}
      canDrop={canDrop}
      dropEffect={dropEffect}
      to={`/container/${containerId}`}
      data-testid={`navigation-panel-container-${containerId}`}
    />
  );
};
