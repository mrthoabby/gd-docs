import {
  AnimatedCollectionsIcon,
  AnimatedFolderIcon,
  type DropTargetDropEvent,
  type DropTargetOptions,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuSub,
  notify,
} from '@affine/component';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import { ContainerService } from '@affine/core/modules/container';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { CompatibleFavoriteItemsAdapter } from '@affine/core/modules/favorite';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { KnowledgeBaseService } from '@affine/core/modules/knowledge-base';
import { NavigationPanelService } from '@affine/core/modules/navigation-panel';
import {
  type FolderNode,
  OrganizeService,
} from '@affine/core/modules/organize';
import { WorkspaceService } from '@affine/core/modules/workspace';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { Unreachable } from '@affine/env/constant';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import {
  AiIcon,
  DeleteIcon,
  EdgelessIcon,
  FolderIcon,
  PageIcon,
  PlusIcon,
  PlusThickIcon,
  RemoveFolderIcon,
  TagsIcon,
  ViewLayersIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import { difference } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

import {
  NavigationPanelTreeNode,
  type NavigationPanelTreeNodeDropEffect,
} from '../../tree';
import type { NavigationPanelTreeNodeIcon } from '../../tree/node';
import type { NodeOperation } from '../../tree/types';
import { NavigationPanelCollectionNode } from '../collection';
import { NavigationPanelContainerNode } from '../container';
import { NavigationPanelDocNode } from '../doc';
import { NavigationPanelKnowledgeBaseNode } from '../knowledge-base';
import { NavigationPanelTagNode } from '../tag';
import type { GenericNavigationPanelNode } from '../types';
import { FolderEmpty } from './empty';
import { FavoriteFolderOperation } from './operations';

export const NavigationPanelFolderNode = ({
  nodeId,
  onDrop,
  defaultRenaming,
  operations,
  location,
  dropEffect,
  canDrop,
  reorderable,
  parentPath,
}: {
  defaultRenaming?: boolean;
  nodeId: string;
  onDrop?: (data: DropTargetDropEvent<AffineDNDData>, node: FolderNode) => void;
  operations?:
    | NodeOperation[]
    | ((type: string, node: FolderNode) => NodeOperation[]);
} & Omit<GenericNavigationPanelNode, 'operations'>) => {
  const { organizeService } = useServices({
    OrganizeService,
  });
  const node = useLiveData(organizeService.folderTree.folderNode$(nodeId));
  const type = useLiveData(node?.type$);
  const data = useLiveData(node?.data$);
  const handleDrop = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      if (!node) {
        return;
      }
      onDrop?.(data, node);
    },
    [node, onDrop]
  );
  const additionalOperations = useMemo(() => {
    if (!type || !node) {
      return;
    }
    if (typeof operations === 'function') {
      return operations(type, node);
    }
    return operations;
  }, [node, operations, type]);

  if (!node) {
    return;
  }

  if (type === 'folder') {
    return (
      <NavigationPanelFolderNodeFolder
        node={node}
        onDrop={handleDrop}
        defaultRenaming={defaultRenaming}
        operations={additionalOperations}
        dropEffect={dropEffect}
        reorderable={reorderable}
        canDrop={canDrop}
        parentPath={parentPath}
      />
    );
  } else if (type === 'doc') {
    return (
      data && (
        <NavigationPanelDocNode
          docId={data}
          location={location}
          onDrop={handleDrop}
          reorderable={reorderable}
          canDrop={canDrop}
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  } else if (type === 'collection') {
    return (
      data && (
        <NavigationPanelCollectionNode
          collectionId={data}
          location={location}
          onDrop={handleDrop}
          canDrop={canDrop}
          reorderable={reorderable}
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  } else if (type === 'tag') {
    return (
      data && (
        <NavigationPanelTagNode
          tagId={data}
          location={location}
          onDrop={handleDrop}
          canDrop={canDrop}
          reorderable
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  } else if (type === 'container') {
    return (
      data && (
        <NavigationPanelContainerNode
          containerId={data}
          location={location}
          onDrop={handleDrop}
          canDrop={canDrop}
          reorderable={reorderable}
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  } else if (type === 'knowledge-base') {
    return (
      data && (
        <NavigationPanelKnowledgeBaseNode
          knowledgeBaseId={data}
          location={location}
          onDrop={handleDrop}
          canDrop={canDrop}
          reorderable={reorderable}
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  }

  return;
};

// Define outside the `NavigationPanelFolderNodeFolder` to avoid re-render(the close animation won't play)
const NavigationPanelFolderIcon: NavigationPanelTreeNodeIcon = ({
  collapsed,
  className,
  draggedOver,
  treeInstruction,
}) => (
  <AnimatedFolderIcon
    className={className}
    open={
      !collapsed || (!!draggedOver && treeInstruction?.type === 'make-child')
    }
  />
);

const NavigationPanelFolderNodeFolder = ({
  node,
  onDrop,
  defaultRenaming,
  location,
  operations: additionalOperations,
  canDrop,
  dropEffect,
  reorderable,
  parentPath,
}: {
  defaultRenaming?: boolean;
  node: FolderNode;
} & GenericNavigationPanelNode) => {
  const t = useI18n();
  const {
    workspaceService,
    featureFlagService,
    workspaceDialogService,
    containerService,
    knowledgeBaseService,
  } = useServices({
    WorkspaceService,
    CompatibleFavoriteItemsAdapter,
    FeatureFlagService,
    WorkspaceDialogService,
    ContainerService,
    KnowledgeBaseService,
  });
  const navigationPanelService = useService(NavigationPanelService);
  const name = useLiveData(node.name$);
  const enableEmojiIcon = useLiveData(
    featureFlagService.flags.enable_emoji_folder_icon.$
  );
  const enableContainers = useLiveData(
    featureFlagService.flags.enable_containers.$
  );
  const enableKnowledgeBase = useLiveData(
    featureFlagService.flags.enable_knowledge_base.$
  );
  const path = useMemo(
    () => [...(parentPath ?? []), `folder-${node.id}`],
    [parentPath, node.id]
  );
  const collapsed = useLiveData(navigationPanelService.collapsed$(path));
  const setCollapsed = useCallback(
    (value: boolean) => {
      navigationPanelService.setCollapsed(path, value);
    },
    [navigationPanelService, path]
  );
  const [newFolderId, setNewFolderId] = useState<string | null>(null);

  const { createDiagram, createPage } = usePageHelper(
    workspaceService.workspace.docCollection
  );
  const handleDelete = useCallback(async () => {
    const containerIds = node.containerIdsInSubtree();
    const knowledgeBaseIds = node.knowledgeBaseIdsInSubtree();
    await Promise.allSettled(
      containerIds.map(containerId =>
        containerService.trashContainer(containerId, {
          lastParentFolderNodeId: node.id,
          lastIndex: null,
        })
      )
    );
    await Promise.allSettled(
      knowledgeBaseIds.map(knowledgeBaseId =>
        knowledgeBaseService.trashKnowledgeBase(knowledgeBaseId, {
          lastParentFolderNodeId: node.id,
          lastIndex: null,
        })
      )
    );
    node.delete();
    track.$.navigationPanel.organize.deleteOrganizeItem({
      type: 'folder',
    });
    notify.success({
      title: t['com.affine.rootAppSidebar.organize.delete.notify-title']({
        name,
      }),
      message: t['com.affine.rootAppSidebar.organize.delete.notify-message'](),
    });
  }, [containerService, knowledgeBaseService, name, node, t]);

  const children = useLiveData(node.sortedChildren$);

  const dndData = useMemo(() => {
    if (!node.id) {
      throw new Unreachable();
    }
    return {
      draggable: {
        entity: {
          type: 'folder',
          id: node.id,
        },
        from: location,
      },
      dropTarget: {
        at: 'navigation-panel:organize:folder',
      },
    } satisfies AffineDNDData;
  }, [location, node.id]);

  const handleRename = useCallback(
    (newName: string) => {
      node.rename(newName);
    },
    [node]
  );

  const syncKnowledgeBaseLocation = useCallback(
    (knowledgeBaseId: string, index: string) => {
      if (!node.id) {
        return;
      }
      void knowledgeBaseService
        .moveKnowledgeBase(knowledgeBaseId, {
          folderNodeId: node.id,
          index,
        })
        .catch(error => {
          notify.error({
            title:
              error instanceof Error
                ? error.message
                : t['com.affine.knowledgeBase.move.error'](),
          });
        });
    },
    [knowledgeBaseService, node.id, t]
  );

  const canAcceptKnowledgeBase = useCallback(
    (knowledgeBaseId?: string) => {
      if (!knowledgeBaseId) {
        return false;
      }
      return !node.sortedChildren$.value.some(
        child =>
          child.type$.value === 'knowledge-base' &&
          child.data$.value !== knowledgeBaseId
      );
    },
    [node]
  );

  const notifyDuplicateKnowledgeBase = useCallback(() => {
    notify.error({
      title: t['com.affine.knowledgeBase.create.duplicate'](),
    });
  }, [t]);

  const handleDropOnFolder = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      if (data.source.data.entity?.type) {
        track.$.navigationPanel.folders.drop({
          type: data.source.data.entity.type,
        });
      }
      if (data.treeInstruction?.type === 'make-child') {
        if (data.source.data.entity?.type === 'folder') {
          if (
            node.id === data.source.data.entity.id ||
            node.beChildOf(data.source.data.entity.id)
          ) {
            return;
          }
          node.moveHere(data.source.data.entity.id, node.indexAt('before'));
          track.$.navigationPanel.organize.moveOrganizeItem({ type: 'folder' });
        } else if (
          data.source.data.entity?.type === 'collection' ||
          data.source.data.entity?.type === 'doc' ||
          data.source.data.entity?.type === 'tag' ||
          data.source.data.entity?.type === 'container' ||
          data.source.data.entity?.type === 'knowledge-base'
        ) {
          if (
            data.source.data.from?.at ===
            'navigation-panel:organize:folder-node'
          ) {
            const index = node.indexAt('before');
            if (
              data.source.data.entity?.type === 'knowledge-base' &&
              !canAcceptKnowledgeBase(data.source.data.entity.id)
            ) {
              notifyDuplicateKnowledgeBase();
              return;
            }
            node.moveHere(data.source.data.from.nodeId, index);
            if (data.source.data.entity?.type === 'knowledge-base') {
              syncKnowledgeBaseLocation(data.source.data.entity.id, index);
            }
            track.$.navigationPanel.organize.moveOrganizeItem({
              type: 'link',
              target: data.source.data.entity?.type,
            });
          } else {
            const index = node.indexAt('before');
            if (
              data.source.data.entity?.type === 'knowledge-base' &&
              !canAcceptKnowledgeBase(data.source.data.entity.id)
            ) {
              notifyDuplicateKnowledgeBase();
              return;
            }
            node.createLink(
              data.source.data.entity?.type,
              data.source.data.entity.id,
              index
            );
            if (data.source.data.entity?.type === 'knowledge-base') {
              syncKnowledgeBaseLocation(data.source.data.entity.id, index);
            }
            track.$.navigationPanel.organize.createOrganizeItem({
              type: 'link',
              target: data.source.data.entity?.type,
            });
          }
        }
      } else {
        onDrop?.(data);
      }
    },
    [
      canAcceptKnowledgeBase,
      node,
      notifyDuplicateKnowledgeBase,
      onDrop,
      syncKnowledgeBaseLocation,
    ]
  );

  const handleDropEffect = useCallback<NavigationPanelTreeNodeDropEffect>(
    data => {
      if (data.treeInstruction?.type === 'make-child') {
        if (data.source.data.entity?.type === 'folder') {
          if (
            node.id === data.source.data.entity.id ||
            node.beChildOf(data.source.data.entity.id)
          ) {
            return;
          }
          return 'move';
        } else if (
          data.source.data.from?.at === 'navigation-panel:organize:folder-node'
        ) {
          if (
            data.source.data.entity?.type === 'knowledge-base' &&
            !canAcceptKnowledgeBase(data.source.data.entity.id)
          ) {
            return;
          }
          return 'move';
        } else if (
          data.source.data.entity?.type === 'collection' ||
          data.source.data.entity?.type === 'doc' ||
          data.source.data.entity?.type === 'tag' ||
          data.source.data.entity?.type === 'container' ||
          data.source.data.entity?.type === 'knowledge-base'
        ) {
          if (
            data.source.data.entity?.type === 'knowledge-base' &&
            !canAcceptKnowledgeBase(data.source.data.entity.id)
          ) {
            return;
          }
          return 'link';
        }
      } else {
        return dropEffect?.(data);
      }
      return;
    },
    [canAcceptKnowledgeBase, dropEffect, node]
  );

  const handleDropOnPlaceholder = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      if (data.source.data.entity?.type) {
        track.$.navigationPanel.folders.drop({
          type: data.source.data.entity.type,
        });
      }
      if (data.source.data.entity?.type === 'folder') {
        if (
          node.id === data.source.data.entity.id ||
          node.beChildOf(data.source.data.entity.id)
        ) {
          return;
        }
        node.moveHere(data.source.data.entity.id, node.indexAt('before'));
        track.$.navigationPanel.organize.moveOrganizeItem({ type: 'folder' });
      } else if (
        data.source.data.entity?.type === 'collection' ||
        data.source.data.entity?.type === 'doc' ||
        data.source.data.entity?.type === 'tag' ||
        data.source.data.entity?.type === 'container' ||
        data.source.data.entity?.type === 'knowledge-base'
      ) {
        if (
          data.source.data.from?.at === 'navigation-panel:organize:folder-node'
        ) {
          const index = node.indexAt('before');
          if (
            data.source.data.entity?.type === 'knowledge-base' &&
            !canAcceptKnowledgeBase(data.source.data.entity.id)
          ) {
            notifyDuplicateKnowledgeBase();
            return;
          }
          node.moveHere(data.source.data.from.nodeId, index);
          if (data.source.data.entity?.type === 'knowledge-base') {
            syncKnowledgeBaseLocation(data.source.data.entity.id, index);
          }
          track.$.navigationPanel.organize.moveOrganizeItem({
            type: data.source.data.entity?.type,
          });
        } else {
          const index = node.indexAt('before');
          if (
            data.source.data.entity?.type === 'knowledge-base' &&
            !canAcceptKnowledgeBase(data.source.data.entity.id)
          ) {
            notifyDuplicateKnowledgeBase();
            return;
          }
          node.createLink(
            data.source.data.entity?.type,
            data.source.data.entity.id,
            index
          );
          if (data.source.data.entity?.type === 'knowledge-base') {
            syncKnowledgeBaseLocation(data.source.data.entity.id, index);
          }
          track.$.navigationPanel.organize.createOrganizeItem({
            type: 'link',
            target: data.source.data.entity?.type,
          });
        }
      }
    },
    [
      canAcceptKnowledgeBase,
      node,
      notifyDuplicateKnowledgeBase,
      syncKnowledgeBaseLocation,
    ]
  );

  const handleDropOnChildren = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>, dropAtNode?: FolderNode) => {
      if (!dropAtNode || !dropAtNode.id) {
        return;
      }
      if (data.source.data.entity?.type) {
        track.$.navigationPanel.folders.drop({
          type: data.source.data.entity.type,
        });
      }
      if (
        data.treeInstruction?.type === 'reorder-above' ||
        data.treeInstruction?.type === 'reorder-below'
      ) {
        const at =
          data.treeInstruction?.type === 'reorder-below' ? 'after' : 'before';
        if (data.source.data.entity?.type === 'folder') {
          if (
            node.id === data.source.data.entity.id ||
            node.beChildOf(data.source.data.entity.id)
          ) {
            return;
          }
          node.moveHere(
            data.source.data.entity.id,
            node.indexAt(at, dropAtNode.id)
          );
          track.$.navigationPanel.organize.moveOrganizeItem({ type: 'folder' });
        } else if (
          data.source.data.entity?.type === 'collection' ||
          data.source.data.entity?.type === 'doc' ||
          data.source.data.entity?.type === 'tag' ||
          data.source.data.entity?.type === 'container' ||
          data.source.data.entity?.type === 'knowledge-base'
        ) {
          if (
            data.source.data.from?.at ===
            'navigation-panel:organize:folder-node'
          ) {
            const index = node.indexAt(at, dropAtNode.id);
            if (
              data.source.data.entity?.type === 'knowledge-base' &&
              !canAcceptKnowledgeBase(data.source.data.entity.id)
            ) {
              notifyDuplicateKnowledgeBase();
              return;
            }
            node.moveHere(data.source.data.from.nodeId, index);
            if (data.source.data.entity?.type === 'knowledge-base') {
              syncKnowledgeBaseLocation(data.source.data.entity.id, index);
            }
            track.$.navigationPanel.organize.moveOrganizeItem({
              type: 'link',
              target: data.source.data.entity?.type,
            });
          } else {
            const index = node.indexAt(at, dropAtNode.id);
            if (
              data.source.data.entity?.type === 'knowledge-base' &&
              !canAcceptKnowledgeBase(data.source.data.entity.id)
            ) {
              notifyDuplicateKnowledgeBase();
              return;
            }
            node.createLink(
              data.source.data.entity?.type,
              data.source.data.entity.id,
              index
            );
            if (data.source.data.entity?.type === 'knowledge-base') {
              syncKnowledgeBaseLocation(data.source.data.entity.id, index);
            }

            track.$.navigationPanel.organize.createOrganizeItem({
              type: 'link',
              target: data.source.data.entity?.type,
            });
          }
        }
      } else if (data.treeInstruction?.type === 'reparent') {
        const currentLevel = data.treeInstruction.currentLevel;
        const desiredLevel = data.treeInstruction.desiredLevel;
        if (currentLevel === desiredLevel + 1) {
          onDrop?.({
            ...data,
            treeInstruction: {
              type: 'reorder-below',
              currentLevel,
              indentPerLevel: data.treeInstruction.indentPerLevel,
            },
          });
          return;
        } else {
          onDrop?.({
            ...data,
            treeInstruction: {
              ...data.treeInstruction,
              currentLevel: currentLevel - 1,
            },
          });
        }
      }
    },
    [
      canAcceptKnowledgeBase,
      node,
      notifyDuplicateKnowledgeBase,
      onDrop,
      syncKnowledgeBaseLocation,
    ]
  );

  const handleDropEffectOnChildren =
    useCallback<NavigationPanelTreeNodeDropEffect>(
      data => {
        if (
          data.treeInstruction?.type === 'reorder-above' ||
          data.treeInstruction?.type === 'reorder-below'
        ) {
          if (data.source.data.entity?.type === 'folder') {
            if (
              node.id === data.source.data.entity.id ||
              node.beChildOf(data.source.data.entity.id)
            ) {
              return;
            }
            return 'move';
          } else if (
            data.source.data.from?.at ===
            'navigation-panel:organize:folder-node'
          ) {
            if (
              data.source.data.entity?.type === 'knowledge-base' &&
              !canAcceptKnowledgeBase(data.source.data.entity.id)
            ) {
              return;
            }
            return 'move';
          } else if (
            data.source.data.entity?.type === 'collection' ||
            data.source.data.entity?.type === 'doc' ||
            data.source.data.entity?.type === 'tag' ||
            data.source.data.entity?.type === 'container' ||
            data.source.data.entity?.type === 'knowledge-base'
          ) {
            if (
              data.source.data.entity?.type === 'knowledge-base' &&
              !canAcceptKnowledgeBase(data.source.data.entity.id)
            ) {
              return;
            }
            return 'link';
          }
        } else if (data.treeInstruction?.type === 'reparent') {
          const currentLevel = data.treeInstruction.currentLevel;
          const desiredLevel = data.treeInstruction.desiredLevel;
          if (currentLevel === desiredLevel + 1) {
            dropEffect?.({
              ...data,
              treeInstruction: {
                type: 'reorder-below',
                currentLevel,
                indentPerLevel: data.treeInstruction.indentPerLevel,
              },
            });
            return;
          } else {
            dropEffect?.({
              ...data,
              treeInstruction: {
                ...data.treeInstruction,
                currentLevel: currentLevel - 1,
              },
            });
          }
        }
        return;
      },
      [canAcceptKnowledgeBase, dropEffect, node]
    );

  const handleCanDrop = useMemo<DropTargetOptions<AffineDNDData>['canDrop']>(
    () => args => {
      const entityType = args.source.data.entity?.type;
      if (args.treeInstruction && args.treeInstruction?.type !== 'make-child') {
        return (
          (typeof canDrop === 'function' ? canDrop(args) : canDrop) ?? true
        );
      }

      if (args.source.data.entity?.type === 'folder') {
        if (
          node.id === args.source.data.entity.id ||
          node.beChildOf(args.source.data.entity.id)
        ) {
          return false;
        }
        return true;
      } else if (
        args.source.data.from?.at === 'navigation-panel:organize:folder-node'
      ) {
        if (
          entityType === 'knowledge-base' &&
          !canAcceptKnowledgeBase(args.source.data.entity?.id)
        ) {
          return false;
        }
        return true;
      } else if (
        entityType === 'collection' ||
        entityType === 'doc' ||
        entityType === 'tag' ||
        entityType === 'container' ||
        entityType === 'knowledge-base'
      ) {
        if (
          entityType === 'knowledge-base' &&
          !canAcceptKnowledgeBase(args.source.data.entity?.id)
        ) {
          return false;
        }
        return true;
      }
      return false;
    },
    [canAcceptKnowledgeBase, canDrop, node]
  );

  const handleChildrenCanDrop = useMemo<
    DropTargetOptions<AffineDNDData>['canDrop']
  >(
    () => args => {
      const entityType = args.source.data.entity?.type;

      if (args.source.data.entity?.type === 'folder') {
        if (
          node.id === args.source.data.entity.id ||
          node.beChildOf(args.source.data.entity.id)
        ) {
          return false;
        }
        return true;
      } else if (
        args.source.data.from?.at === 'navigation-panel:organize:folder-node'
      ) {
        if (
          entityType === 'knowledge-base' &&
          !canAcceptKnowledgeBase(args.source.data.entity?.id)
        ) {
          return false;
        }
        return true;
      } else if (
        entityType === 'collection' ||
        entityType === 'doc' ||
        entityType === 'tag' ||
        entityType === 'container' ||
        entityType === 'knowledge-base'
      ) {
        if (
          entityType === 'knowledge-base' &&
          !canAcceptKnowledgeBase(args.source.data.entity?.id)
        ) {
          return false;
        }
        return true;
      }
      return false;
    },
    [canAcceptKnowledgeBase, node]
  );

  const handleNewDoc = useCallback(() => {
    const newDoc = createPage();
    node.createLink('doc', newDoc.id, node.indexAt('before'));
    track.$.navigationPanel.folders.createDoc();
    track.$.navigationPanel.organize.createOrganizeItem({
      type: 'link',
      target: 'doc',
    });
    setCollapsed(false);
  }, [createPage, node, setCollapsed]);

  const handleNewDiagram = useCallback(() => {
    const newDiagram = createDiagram();
    node.createLink('doc', newDiagram.id, node.indexAt('before'));
    track.$.navigationPanel.folders.createDoc();
    track.$.navigationPanel.organize.createOrganizeItem({
      type: 'link',
      target: 'doc',
    });
    setCollapsed(false);
  }, [createDiagram, node, setCollapsed]);

  const handleCreateSubfolder = useCallback(() => {
    const newFolderId = node.createFolder(
      t['com.affine.rootAppSidebar.organize.new-folders'](),
      node.indexAt('before')
    );
    track.$.navigationPanel.organize.createOrganizeItem({ type: 'folder' });
    setCollapsed(false);
    setNewFolderId(newFolderId);
  }, [node, setCollapsed, t]);

  const handleCreateContainer = useCallback(async () => {
    if (!node.id) {
      return;
    }
    const index = node.indexAt('before');
    const container = await containerService.createContainer({
      name: t['com.affine.container.new'](),
      parentFolderNodeId: node.id,
      index,
    });

    try {
      node.createLink('container', container.id, index);
      track.$.navigationPanel.organize.createOrganizeItem({
        type: 'container',
      });
      setCollapsed(false);
    } catch (error) {
      await containerService.trashContainer(container.id, {
        lastParentFolderNodeId: node.id,
        lastIndex: index,
      });
      throw error;
    }
  }, [containerService, node, setCollapsed, t]);

  const handleCreateKnowledgeBase = useCallback(async () => {
    if (!node.id) {
      return;
    }
    const existingKnowledgeBase = node.sortedChildren$.value.find(
      child => child.type$.value === 'knowledge-base'
    );
    if (existingKnowledgeBase) {
      notify.error({
        title: t['com.affine.knowledgeBase.create.duplicate'](),
      });
      return;
    }

    const index = node.indexAt('before');
    const knowledgeBase = await knowledgeBaseService.createKnowledgeBase({
      name: t['com.affine.knowledgeBase.new'](),
      folderNodeId: node.id,
      index,
    });

    try {
      node.createLink('knowledge-base', knowledgeBase.id, index);
      track.$.navigationPanel.organize.createOrganizeItem({
        type: 'knowledge-base',
      });
      setCollapsed(false);
    } catch (error) {
      await knowledgeBaseService.trashKnowledgeBase(knowledgeBase.id, {
        lastParentFolderNodeId: node.id,
        lastIndex: index,
      });
      throw error;
    }
  }, [knowledgeBaseService, node, setCollapsed, t]);

  const handleAddToFolder = useCallback(
    (type: 'doc' | 'collection' | 'tag') => {
      const initialIds = children
        .filter(node => node.type$.value === type)
        .map(node => node.data$.value)
        .filter(Boolean) as string[];
      const selector =
        type === 'doc'
          ? 'doc-selector'
          : type === 'collection'
            ? 'collection-selector'
            : 'tag-selector';
      workspaceDialogService.open(
        selector,
        {
          init: initialIds,
        },
        selectedIds => {
          if (selectedIds === undefined) {
            return;
          }
          const newItemIds = difference(selectedIds, initialIds);
          const removedItemIds = difference(initialIds, selectedIds);
          const removedItems = children.filter(
            node =>
              !!node.data$.value && removedItemIds.includes(node.data$.value)
          );

          newItemIds.forEach(id => {
            node.createLink(type, id, node.indexAt('after'));
          });
          removedItems.forEach(node => node.delete());
          const updated = newItemIds.length + removedItems.length;
          updated && setCollapsed(false);
        }
      );
      track.$.navigationPanel.organize.createOrganizeItem({
        type: 'link',
        target: type,
      });
    },
    [children, node, setCollapsed, workspaceDialogService]
  );

  const folderOperations = useMemo(() => {
    return [
      {
        index: 0,
        inline: true,
        view: (
          <Menu
            items={
              <>
                <MenuItem prefixIcon={<PageIcon />} onClick={handleNewDoc}>
                  {t['com.affine.rootAppSidebar.organize.folder.new-doc']()}
                </MenuItem>
                <MenuItem
                  prefixIcon={<EdgelessIcon />}
                  onClick={handleNewDiagram}
                >
                  {t['com.affine.new_edgeless']()}
                </MenuItem>
                {enableContainers ? (
                  <MenuItem
                    prefixIcon={<ViewLayersIcon />}
                    onClick={handleCreateContainer}
                  >
                    {t['com.affine.container.new']()}
                  </MenuItem>
                ) : null}
                {enableKnowledgeBase ? (
                  <MenuItem
                    prefixIcon={<AiIcon />}
                    onClick={handleCreateKnowledgeBase}
                  >
                    {t['com.affine.knowledgeBase.new']()}
                  </MenuItem>
                ) : null}
              </>
            }
          >
            <IconButton
              size="16"
              tooltip={t[
                'com.affine.rootAppSidebar.explorer.organize-add-tooltip'
              ]()}
            >
              <PlusIcon />
            </IconButton>
          </Menu>
        ),
      },
      {
        index: 100,
        view: (
          <MenuItem prefixIcon={<FolderIcon />} onClick={handleCreateSubfolder}>
            {t['com.affine.rootAppSidebar.organize.folder.create-subfolder']()}
          </MenuItem>
        ),
      },
      {
        index: 101,
        view: (
          <MenuItem
            prefixIcon={<PageIcon />}
            onClick={() => handleAddToFolder('doc')}
          >
            {t['com.affine.rootAppSidebar.organize.folder.add-docs']()}
          </MenuItem>
        ),
      },
      {
        index: 102,
        view: (
          <MenuSub
            triggerOptions={{
              prefixIcon: <PlusThickIcon />,
            }}
            items={
              <>
                <MenuItem
                  onClick={() => handleAddToFolder('tag')}
                  prefixIcon={<TagsIcon />}
                >
                  {t['com.affine.rootAppSidebar.organize.folder.add-tags']()}
                </MenuItem>
                <MenuItem
                  onClick={() => handleAddToFolder('collection')}
                  prefixIcon={<AnimatedCollectionsIcon closed={false} />}
                >
                  {t[
                    'com.affine.rootAppSidebar.organize.folder.add-collections'
                  ]()}
                </MenuItem>
              </>
            }
          >
            {t['com.affine.rootAppSidebar.organize.folder.add-others']()}
          </MenuSub>
        ),
      },

      {
        index: 200,
        view: node.id ? <FavoriteFolderOperation id={node.id} /> : null,
      },

      {
        index: 9999,
        view: <MenuSeparator key="menu-separator" />,
      },
      {
        index: 10000,
        view: (
          <MenuItem
            type={'danger'}
            prefixIcon={<DeleteIcon />}
            onClick={handleDelete}
          >
            {t['com.affine.rootAppSidebar.organize.delete']()}
          </MenuItem>
        ),
      },
    ];
  }, [
    handleAddToFolder,
    handleCreateContainer,
    handleCreateKnowledgeBase,
    handleCreateSubfolder,
    handleDelete,
    handleNewDiagram,
    handleNewDoc,
    enableContainers,
    enableKnowledgeBase,
    node,
    t,
  ]);

  const finalOperations = useMemo(() => {
    if (additionalOperations) {
      return [...additionalOperations, ...folderOperations];
    }
    return folderOperations;
  }, [additionalOperations, folderOperations]);

  const childrenOperations = useCallback(
    (type: string, node: FolderNode) => {
      if (
        type === 'doc' ||
        type === 'collection' ||
        type === 'tag' ||
        type === 'container' ||
        type === 'knowledge-base'
      ) {
        return [
          {
            index: 999,
            view: (
              <MenuItem
                type={'danger'}
                prefixIcon={<RemoveFolderIcon />}
                data-event-props="$.navigationPanel.organize.deleteOrganizeItem"
                data-event-args-type={node.type$.value}
                onClick={async () => {
                  if (type === 'container') {
                    const containerId = node.data$.value;
                    if (containerId) {
                      await containerService.trashContainer(containerId, {
                        lastParentFolderNodeId: node.info$.value?.parentId,
                        lastIndex: node.index$.value,
                      });
                    }
                  } else if (type === 'knowledge-base') {
                    const knowledgeBaseId = node.data$.value;
                    if (knowledgeBaseId) {
                      await knowledgeBaseService.trashKnowledgeBase(
                        knowledgeBaseId,
                        {
                          lastParentFolderNodeId: node.info$.value?.parentId,
                          lastIndex: node.index$.value,
                        }
                      );
                    }
                  }
                  node.delete();
                }}
              >
                {t['com.affine.rootAppSidebar.organize.delete-from-folder']()}
              </MenuItem>
            ),
          },
        ] satisfies NodeOperation[];
      }
      return [];
    },
    [containerService, knowledgeBaseService, t]
  );

  const handleCollapsedChange = useCallback(
    (collapsed: boolean) => {
      if (collapsed) {
        setNewFolderId(null); // reset new folder id to clear the renaming state
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    },
    [setCollapsed]
  );

  return (
    <NavigationPanelTreeNode
      icon={NavigationPanelFolderIcon}
      name={name}
      dndData={dndData}
      onDrop={handleDropOnFolder}
      defaultRenaming={defaultRenaming}
      renameable
      extractEmojiAsIcon={enableEmojiIcon}
      reorderable={reorderable}
      collapsed={collapsed}
      setCollapsed={handleCollapsedChange}
      onRename={handleRename}
      operations={finalOperations}
      canDrop={handleCanDrop}
      childrenPlaceholder={
        <FolderEmpty canDrop={handleCanDrop} onDrop={handleDropOnPlaceholder} />
      }
      dropEffect={handleDropEffect}
      data-testid={`navigation-panel-folder-${node.id}`}
      explorerIconConfig={node.id ? { where: 'folder', id: node.id } : null}
    >
      {children.map(child => (
        <NavigationPanelFolderNode
          key={child.id}
          nodeId={child.id as string}
          defaultRenaming={child.id === newFolderId}
          onDrop={handleDropOnChildren}
          operations={childrenOperations}
          dropEffect={handleDropEffectOnChildren}
          canDrop={handleChildrenCanDrop}
          location={{
            at: 'navigation-panel:organize:folder-node',
            nodeId: child.id as string,
          }}
          parentPath={path}
        />
      ))}
    </NavigationPanelTreeNode>
  );
};
