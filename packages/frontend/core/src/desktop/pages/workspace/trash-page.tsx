import { toast, useConfirmModal } from '@affine/component';
import {
  createDocExplorerContext,
  DocExplorerContext,
} from '@affine/core/components/explorer/context';
import { DocsExplorer } from '@affine/core/components/explorer/docs-view/docs-list';
import { useBlockSuiteMetaHelper } from '@affine/core/components/hooks/affine/use-block-suite-meta-helper';
import { Header } from '@affine/core/components/pure/header';
import {
  ContainerService,
  type WorkspaceContainer,
} from '@affine/core/modules/container';
import { CollectionRulesService } from '@affine/core/modules/collection-rules';
import { GlobalContextService } from '@affine/core/modules/global-context';
import {
  KnowledgeBaseService,
  type WorkspaceKnowledgeBase,
} from '@affine/core/modules/knowledge-base';
import { OrganizeService } from '@affine/core/modules/organize';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { useI18n } from '@affine/i18n';
import { AiIcon, DeleteIcon, ViewLayersIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import {
  useIsActiveView,
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '../../../modules/workbench';
import { EmptyPageList } from './page-list-empty';
import * as styles from './trash-page.css';

const TrashHeader = () => {
  const t = useI18n();
  return (
    <Header
      left={
        <div className={styles.trashTitle}>
          <DeleteIcon className={styles.trashIcon} />
          {t['com.affine.workspaceSubPath.trash']()}
        </div>
      }
    />
  );
};

export const TrashPage = () => {
  const t = useI18n();
  const collectionRulesService = useService(CollectionRulesService);
  const containerService = useService(ContainerService);
  const knowledgeBaseService = useService(KnowledgeBaseService);
  const globalContextService = useService(GlobalContextService);
  const organizeService = useService(OrganizeService);
  const permissionService = useService(WorkspacePermissionService);

  const { restoreFromTrash, permanentlyDeletePage } = useBlockSuiteMetaHelper();
  const isActiveView = useIsActiveView();
  const { openConfirmModal } = useConfirmModal();

  const [explorerContextValue] = useState(() =>
    createDocExplorerContext({
      displayProperties: [
        'system:createdAt',
        'system:updatedAt',
        'system:tags',
      ],
      showMoreOperation: false,
      showDragHandle: true,
      showDocPreview: false,
      quickFavorite: false,
      quickDeletePermanently: true,
      quickRestore: true,
      quickSelect: true,
      groupBy: undefined,
      orderBy: undefined,
    })
  );
  const [trashedContainers, setTrashedContainers] = useState<
    WorkspaceContainer[]
  >([]);
  const [trashedKnowledgeBases, setTrashedKnowledgeBases] = useState<
    WorkspaceKnowledgeBase[]
  >([]);

  const isAdmin = useLiveData(permissionService.permission.isAdmin$);
  const isOwner = useLiveData(permissionService.permission.isOwner$);
  const groups = useLiveData(explorerContextValue.groups$);
  const isEmpty =
    (groups.length === 0 ||
      (groups.length > 0 && groups.every(group => !group.items?.length))) &&
    trashedContainers.length === 0 &&
    trashedKnowledgeBases.length === 0;

  const handleMultiRestore = useCallback(
    (ids: string[]) => {
      ids.forEach(id => {
        restoreFromTrash(id);
      });
      toast(
        t['com.affine.toastMessage.restored']({
          title: ids.length > 1 ? 'docs' : 'doc',
        })
      );
    },
    [restoreFromTrash, t]
  );

  const handleMultiDelete = useCallback(
    (ids: string[]) => {
      ids.forEach(pageId => {
        permanentlyDeletePage(pageId);
      });
      toast(t['com.affine.toastMessage.permanentlyDeleted']());
    },
    [permanentlyDeletePage, t]
  );

  const onConfirmPermanentlyDelete = useCallback(
    (
      ids: string[],
      callbacks?: {
        onFinished?: () => void;
        onAbort?: () => void;
      }
    ) => {
      if (ids.length === 0) {
        return;
      }
      openConfirmModal({
        title: `${t['com.affine.trashOperation.deletePermanently']()}?`,
        description: t['com.affine.trashOperation.deleteDescription'](),
        cancelText: t['Cancel'](),
        confirmText: t['com.affine.trashOperation.delete'](),
        confirmButtonOptions: {
          variant: 'error',
        },
        onConfirm: () => {
          handleMultiDelete(ids);
          callbacks?.onFinished?.();
        },
        onCancel: () => {
          callbacks?.onAbort?.();
        },
      });
    },
    [handleMultiDelete, openConfirmModal, t]
  );

  useEffect(() => {
    const subscription = collectionRulesService
      .watch({
        filters: [
          {
            type: 'system',
            key: 'trash',
            method: 'is',
            value: 'true',
          },
        ],
        orderBy: {
          type: 'system',
          key: 'updatedAt',
          desc: true,
        },
      })
      .subscribe(result => {
        explorerContextValue.groups$.next(result.groups);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [collectionRulesService, explorerContextValue.groups$]);

  useEffect(() => {
    void containerService
      .revalidate('trashed')
      .then(setTrashedContainers)
      .catch(console.error);
  }, [containerService]);

  useEffect(() => {
    void knowledgeBaseService
      .revalidate('trashed')
      .then(setTrashedKnowledgeBases)
      .catch(console.error);
  }, [knowledgeBaseService]);

  const handleRestoreContainer = useCallback(
    async (containerId: string) => {
      const container = await containerService.restoreContainer(containerId);
      organizeService.restoreContainerLink(container.id, {
        fallbackFolderName: t['com.affine.container.restore-folder'](),
        index: container.lastIndex,
        parentFolderNodeId: container.lastParentFolderNodeId,
      });
      setTrashedContainers(containers =>
        containers.filter(container => container.id !== containerId)
      );
      toast(
        t['com.affine.toastMessage.restored']({
          title: t['com.affine.container.title'](),
        })
      );
    },
    [containerService, organizeService, t]
  );

  const handleRestoreKnowledgeBase = useCallback(
    async (knowledgeBaseId: string) => {
      try {
        const knowledgeBase =
          await knowledgeBaseService.restoreKnowledgeBase(knowledgeBaseId);
        const parentFolderNodeId = organizeService.restoreKnowledgeBaseLink(
          knowledgeBase.id,
          {
            fallbackFolderName: t['com.affine.knowledgeBase.restore-folder'](),
            index: knowledgeBase.lastIndex,
            parentFolderNodeId: knowledgeBase.lastParentFolderNodeId,
          }
        );
        await knowledgeBaseService.moveKnowledgeBase(knowledgeBase.id, {
          folderNodeId: parentFolderNodeId,
          index: knowledgeBase.lastIndex,
        });
        setTrashedKnowledgeBases(knowledgeBases =>
          knowledgeBases.filter(
            knowledgeBase => knowledgeBase.id !== knowledgeBaseId
          )
        );
        toast(
          t['com.affine.toastMessage.restored']({
            title: t['com.affine.knowledgeBase.title'](),
          })
        );
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error));
      }
    },
    [knowledgeBaseService, organizeService, t]
  );

  useEffect(() => {
    if (isActiveView) {
      globalContextService.globalContext.isTrash.set(true);

      return () => {
        globalContextService.globalContext.isTrash.set(false);
      };
    }
    return;
  }, [globalContextService.globalContext.isTrash, isActiveView]);

  return (
    <DocExplorerContext.Provider value={explorerContextValue}>
      <ViewTitle title={t['Trash']()} />
      <ViewIcon icon={'trash'} />
      <ViewHeader>
        <TrashHeader />
      </ViewHeader>
      <ViewBody>
        <div className={styles.body}>
          {isEmpty ? (
            <EmptyPageList type="trash" />
          ) : (
            <>
              <DocsExplorer
                disableMultiDelete={!isAdmin && !isOwner}
                onRestore={isAdmin || isOwner ? handleMultiRestore : undefined}
                onDelete={
                  isAdmin || isOwner ? onConfirmPermanentlyDelete : undefined
                }
              />
              {trashedContainers.length ? (
                <section className={styles.containerTrash}>
                  <div className={styles.containerTrashTitle}>
                    {t['com.affine.container.title']()}
                  </div>
                  {trashedContainers.map(container => (
                    <div className={styles.containerTrashRow} key={container.id}>
                      <ViewLayersIcon />
                      <div className={styles.containerTrashName}>
                        {container.name}
                      </div>
                      <button
                        className={styles.containerTrashButton}
                        onClick={() => void handleRestoreContainer(container.id)}
                      >
                        {t['com.affine.trashOperation.restoreIt']()}
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}
              {trashedKnowledgeBases.length ? (
                <section className={styles.containerTrash}>
                  <div className={styles.containerTrashTitle}>
                    {t['com.affine.knowledgeBase.title']()}
                  </div>
                  {trashedKnowledgeBases.map(knowledgeBase => (
                    <div
                      className={styles.containerTrashRow}
                      key={knowledgeBase.id}
                    >
                      <AiIcon />
                      <div className={styles.containerTrashName}>
                        {knowledgeBase.name}
                      </div>
                      <button
                        className={styles.containerTrashButton}
                        onClick={() =>
                          void handleRestoreKnowledgeBase(knowledgeBase.id)
                        }
                      >
                        {t['com.affine.trashOperation.restoreIt']()}
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}
            </>
          )}
        </div>
      </ViewBody>
    </DocExplorerContext.Provider>
  );
};

export const Component = () => {
  return <TrashPage />;
};
