import { toast, useConfirmModal } from '@affine/component';
import {
  ContainerService,
  type WorkspaceContainerFile,
} from '@affine/core/modules/container';
import { GlobalContextService } from '@affine/core/modules/global-context';
import {
  useIsActiveView,
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import { getAttachmentFileIconRC } from '@blocksuite/affine/components/icons';
import {
  ArrowLeftSmallIcon,
  ArrowRightSmallIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  MinusIcon,
  PlusIcon,
  ViewLayersIcon,
} from '@blocksuite/icons/rc';
import * as Dialog from '@radix-ui/react-dialog';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import bytes from 'bytes';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import { PageNotFound } from '../../404';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './index.css';

const acceptedTypes = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.md',
  '.txt',
  '.nb',
  '.pdf',
].join(',');

function errorMessage(error: unknown) {
  return UserFriendlyError.fromAny(error).message;
}

type PreviewState =
  | { mode: 'image'; file: WorkspaceContainerFile }
  | { mode: 'pdf'; file: WorkspaceContainerFile }
  | { mode: 'text'; file: WorkspaceContainerFile };

export const Component = function ContainerPage() {
  const t = useI18n();
  const params = useParams();
  const containerId = params.containerId;
  const { containerService, globalContextService } = useServices({
    ContainerService,
    GlobalContextService,
  });
  const isActiveView = useIsActiveView();
  const container = useLiveData(
    containerId ? containerService.container$(containerId) : null
  );
  const files = useLiveData(
    containerId ? containerService.files$(containerId) : null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const { openConfirmModal } = useConfirmModal();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [renamingFile, setRenamingFile] =
    useState<WorkspaceContainerFile | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  useEffect(() => {
    if (!containerId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      containerService.loadContainer(containerId),
      containerService.listFiles(containerId),
    ])
      .catch(setError)
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [containerId, containerService]);

  useEffect(() => {
    setNameDraft(container?.name ?? '');
  }, [container?.name]);

  useEffect(() => {
    if (isActiveView && containerId) {
      const globalContext = globalContextService.globalContext;
      globalContext.containerId.set(containerId);
      globalContext.isContainer.set(true);
      track.container.$.$.openContainer({});

      return () => {
        globalContext.containerId.set(null);
        globalContext.isContainer.set(false);
      };
    }
    return;
  }, [containerId, globalContextService, isActiveView]);

  const sortedFiles = useMemo(
    () =>
      [...(files ?? [])].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [files]
  );

  const imageFiles = useMemo(
    () => sortedFiles.filter(file => file.kind === 'image'),
    [sortedFiles]
  );

  const handleSaveName = useCallback(async () => {
    if (!container || !nameDraft.trim() || nameDraft === container.name) {
      setNameDraft(container?.name ?? '');
      return;
    }
    try {
      await containerService.renameContainer(container.id, nameDraft);
      track.$.navigationPanel.organize.renameOrganizeItem({
        type: 'container',
      });
    } catch (error) {
      setNameDraft(container.name);
      toast(errorMessage(error));
    }
  }, [container, containerService, nameDraft]);

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!containerId || !fileList?.length) return;
      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          const uploaded = await containerService.uploadFile(containerId, file);
          track.container.files.$.uploadContainerFile({
            kind: uploaded.kind,
            result: 'success',
          });
        }
        await containerService.listFiles(containerId);
        toast(t['com.affine.container.upload.success']());
      } catch (error) {
        const message = errorMessage(error);
        track.container.files.$.uploadContainerFile({
          result: 'failure',
          reason: message,
        });
        toast(message);
      } finally {
        setUploading(false);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    },
    [containerId, containerService, t]
  );

  const openRenameFile = useCallback((file: WorkspaceContainerFile) => {
    setRenamingFile(file);
    setRenameDraft(file.name);
  }, []);

  const closeRenameFile = useCallback(() => {
    if (renameSaving) {
      return;
    }
    setRenamingFile(null);
    setRenameDraft('');
  }, [renameSaving]);

  const handleRenameFile = useCallback(async () => {
    if (!renamingFile) {
      return;
    }
    const nextName = renameDraft.trim();
    if (!nextName || nextName === renamingFile.name) {
      closeRenameFile();
      return;
    }
    setRenameSaving(true);
    try {
      await containerService.renameFile(renamingFile, nextName);
      track.container.files.$.renameContainerFile({
        kind: renamingFile.kind,
        result: 'success',
      });
      closeRenameFile();
    } catch (error) {
      const message = errorMessage(error);
      track.container.files.$.renameContainerFile({
        kind: renamingFile.kind,
        result: 'failure',
        reason: message,
      });
      toast(message);
    } finally {
      setRenameSaving(false);
    }
  }, [
    closeRenameFile,
    containerService,
    renameDraft,
    renamingFile,
  ]);

  const handleRenameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        void handleRenameFile();
        return;
      }
      if (event.key === 'Escape') {
        closeRenameFile();
      }
    },
    [closeRenameFile, handleRenameFile]
  );

  const handleDeleteFile = useCallback(
    (file: WorkspaceContainerFile) => {
      openConfirmModal({
        title: t['com.affine.container.file.delete.confirm'](),
        cancelText: t['Cancel'](),
        confirmText: t['com.affine.container.file.delete'](),
        confirmButtonOptions: {
          variant: 'error',
        },
        onConfirm: () => {
          void (async () => {
            try {
              await containerService.deleteFile(file);
              track.container.files.$.deleteContainerFile({
                kind: file.kind,
                result: 'success',
              });
              toast(t['com.affine.container.file.delete.success']());
            } catch (error) {
              const message = errorMessage(error);
              track.container.files.$.deleteContainerFile({
                kind: file.kind,
                result: 'failure',
                reason: message,
              });
              toast(message);
            }
          })();
        },
      });
    },
    [containerService, openConfirmModal, t]
  );

  const handleOpenFile = useCallback((file: WorkspaceContainerFile) => {
    track.container.files.$.previewContainerFile({
      kind: file.kind,
    });
    setPreview({ mode: file.kind, file } as PreviewState);
  }, []);

  if (!containerId) {
    return <PageNotFound />;
  }

  if (!loading && error && !container) {
    return (
      <>
        <ViewIcon icon="container" />
        <ViewTitle title={t['com.affine.container.title']()} />
        <ViewBody>
          <div className={styles.empty}>
            <span className={styles.error}>
              {t['com.affine.container.load.error']()}
            </span>
          </div>
        </ViewBody>
      </>
    );
  }

  if (!loading && !container) {
    return <PageNotFound />;
  }

  return (
    <>
      <ViewIcon icon="container" />
      <ViewTitle title={container?.name ?? t['com.affine.container.title']()} />
      <AllDocSidebarTabs />
      <ViewHeader>
        <div className={styles.header}>
          <ViewLayersIcon />
          <input
            className={styles.titleInput}
            value={nameDraft}
            aria-label={t['com.affine.container.rename.label']()}
            disabled={!container}
            onChange={event => setNameDraft(event.target.value)}
            onBlur={handleSaveName}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setNameDraft(container?.name ?? '');
                event.currentTarget.blur();
              }
            }}
          />
          <div className={styles.toolbar}>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept={acceptedTypes}
              onChange={event => void handleUpload(event.currentTarget.files)}
            />
            <button
              className={styles.primaryButton}
              disabled={!container || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <PlusIcon /> {t['com.affine.container.upload']()}
            </button>
          </div>
        </div>
      </ViewHeader>
      <ViewBody>
        <main className={styles.page}>
          <section className={styles.body}>
            {loading ? (
              <div className={styles.empty}>{t['Loading']()}</div>
            ) : sortedFiles.length === 0 ? (
              <div className={styles.empty}>
                {t['com.affine.container.empty']()}
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>
                      {t['com.affine.container.file.name']()}
                    </th>
                    <th className={styles.th}>
                      {t['com.affine.container.file.type']()}
                    </th>
                    <th className={styles.th}>
                      {t['com.affine.container.file.size']()}
                    </th>
                    <th className={styles.th}>
                      {t['com.affine.container.file.updated']()}
                    </th>
                    <th className={styles.th} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map(file => {
                    const FileIcon = getAttachmentFileIconRC(file.mime);
                    return (
                      <tr key={file.id}>
                        <td className={styles.td}>
                          <button
                            className={styles.nameCell}
                            onClick={() => handleOpenFile(file)}
                          >
                            <FileIcon width={20} height={20} />
                            <span>{file.name}</span>
                          </button>
                        </td>
                        <td className={styles.td}>
                          {file.kind === 'image'
                            ? t['com.affine.container.file.kind.image']()
                            : file.kind === 'pdf'
                              ? t['com.affine.container.file.kind.pdf']()
                              : t['com.affine.container.file.kind.text']()}
                        </td>
                        <td className={styles.td}>{bytes(file.size)}</td>
                        <td className={styles.td}>
                          {new Date(file.updatedAt).toLocaleString()}
                        </td>
                        <td className={styles.td}>
                          <div className={styles.rowActions}>
                            <button
                              className={styles.button}
                              aria-label={t[
                                'com.affine.container.file.rename'
                              ]()}
                              onClick={() => openRenameFile(file)}
                            >
                              <EditIcon />
                            </button>
                            <button
                              className={styles.button}
                              aria-label={t[
                                'com.affine.container.file.delete'
                              ]()}
                              onClick={() => void handleDeleteFile(file)}
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </main>
      </ViewBody>
      <ContainerFilePreview
        preview={preview}
        imageFiles={imageFiles}
        onChangePreview={setPreview}
      />
      <Dialog.Root
        modal
        open={!!renamingFile}
        onOpenChange={open => {
          if (!open) {
            closeRenameFile();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          {renamingFile ? (
            <Dialog.Content className={styles.renameModal}>
              <div className={styles.modalHeader}>
                <Dialog.Title className={styles.modalTitle}>
                  {t['com.affine.container.file.rename']()}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    className={styles.button}
                    aria-label={t['com.affine.container.preview.close']()}
                    disabled={renameSaving}
                  >
                    <CloseIcon />
                  </button>
                </Dialog.Close>
              </div>
              <div className={styles.renameBody}>
                <input
                  className={styles.renameInput}
                  autoFocus
                  value={renameDraft}
                  aria-label={t['com.affine.container.file.rename']()}
                  onChange={event => setRenameDraft(event.currentTarget.value)}
                  onKeyDown={handleRenameKeyDown}
                />
                <div className={styles.modalFooter}>
                  <Dialog.Close asChild>
                    <button className={styles.button} disabled={renameSaving}>
                      {t['Cancel']()}
                    </button>
                  </Dialog.Close>
                  <button
                    className={styles.primaryButton}
                    disabled={!renameDraft.trim() || renameSaving}
                    onClick={() => void handleRenameFile()}
                  >
                    {t['com.affine.container.file.rename']()}
                  </button>
                </div>
              </div>
            </Dialog.Content>
          ) : null}
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};

const ContainerFilePreview = ({
  preview,
  imageFiles,
  onChangePreview,
}: {
  preview: PreviewState | null;
  imageFiles: WorkspaceContainerFile[];
  onChangePreview: (preview: PreviewState | null) => void;
}) => {
  const t = useI18n();
  const containerService = useService(ContainerService);
  const [zoom, setZoom] = useState(1);
  const [text, setText] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setZoom(1);
    setSaveError(null);
    if (preview?.mode === 'text') {
      setLoadingText(true);
      containerService
        .fetchText(preview.file)
        .then(setText)
        .catch(error => setSaveError(errorMessage(error)))
        .finally(() => setLoadingText(false));
    }
  }, [containerService, preview]);

  const imageIndex = preview
    ? imageFiles.findIndex(file => file.id === preview.file.id)
    : -1;
  const canMoveImages = preview?.mode === 'image' && imageFiles.length > 1;

  const handleMoveImage = useCallback(
    (direction: -1 | 1) => {
      if (imageIndex < 0) return;
      const next =
        imageFiles[
          (imageIndex + direction + imageFiles.length) % imageFiles.length
        ];
      onChangePreview({ mode: 'image', file: next });
    },
    [imageFiles, imageIndex, onChangePreview]
  );

  const handleSaveText = useCallback(async () => {
    if (preview?.mode !== 'text') return;
    setSavingText(true);
    setSaveError(null);
    try {
      const saved = await containerService.updateTextFile(
        preview.file,
        text,
        preview.file.revision
      );
      track.container.files.$.saveContainerTextFile({
        kind: 'text',
        result: 'success',
      });
      onChangePreview({ mode: 'text', file: saved });
      toast(t['com.affine.container.text.save.success']());
    } catch (error) {
      const message = errorMessage(error);
      track.container.files.$.saveContainerTextFile({
        kind: 'text',
        result: 'failure',
        reason: message,
      });
      setSaveError(message);
    } finally {
      setSavingText(false);
    }
  }, [containerService, onChangePreview, preview, t, text]);

  return (
    <Dialog.Root
      modal
      open={!!preview}
      onOpenChange={open => {
        if (!open) {
          onChangePreview(null);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        {preview ? (
          <Dialog.Content className={styles.modal}>
            <div className={styles.modalHeader}>
              <Dialog.Title className={styles.modalTitle}>
                {preview.file.name}
              </Dialog.Title>
              {preview.mode === 'image' ? (
                <>
                  <button
                    className={styles.button}
                    aria-label={t['com.affine.container.image.zoom-out']()}
                    onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}
                  >
                    <MinusIcon />
                  </button>
                  <button
                    className={styles.button}
                    aria-label={t['com.affine.container.image.zoom-in']()}
                    onClick={() => setZoom(value => Math.min(3, value + 0.25))}
                  >
                    <PlusIcon />
                  </button>
                  {canMoveImages ? (
                    <>
                      <button
                        className={styles.button}
                        aria-label={t['com.affine.container.image.previous']()}
                        onClick={() => handleMoveImage(-1)}
                      >
                        <ArrowLeftSmallIcon />
                      </button>
                      <button
                        className={styles.button}
                        aria-label={t['com.affine.container.image.next']()}
                        onClick={() => handleMoveImage(1)}
                      >
                        <ArrowRightSmallIcon />
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
              {preview.mode === 'text' ? (
                <button
                  className={styles.primaryButton}
                  disabled={loadingText || savingText}
                  onClick={() => void handleSaveText()}
                >
                  {savingText
                    ? t['com.affine.container.text.saving']()
                    : t['com.affine.container.text.save']()}
                </button>
              ) : null}
              <Dialog.Close asChild>
                <button
                  className={styles.button}
                  aria-label={t['com.affine.container.preview.close']()}
                >
                  <CloseIcon />
                </button>
              </Dialog.Close>
            </div>
            {saveError ? <div className={styles.error}>{saveError}</div> : null}
            <div className={styles.modalBody}>
              {preview.mode === 'image' ? (
                <img
                  className={styles.image}
                  src={containerService.contentUrl(preview.file)}
                  alt={preview.file.name}
                  style={{ transform: `scale(${zoom})` }}
                />
              ) : preview.mode === 'pdf' ? (
                <iframe
                  className={styles.pdf}
                  title={preview.file.name}
                  src={containerService.contentUrl(preview.file)}
                />
              ) : loadingText ? (
                <div>{t['Loading']()}</div>
              ) : (
                <textarea
                  className={styles.editor}
                  aria-label={t['com.affine.container.text.editor']()}
                  value={text}
                  spellCheck
                  onChange={event => setText(event.currentTarget.value)}
                />
              )}
            </div>
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
};
