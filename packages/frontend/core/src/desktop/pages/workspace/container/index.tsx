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
  FolderIcon,
  MinusIcon,
  PlusIcon,
  TextIcon,
  UploadIcon,
  ViewLayersIcon,
} from '@blocksuite/icons/rc';
import * as Dialog from '@radix-ui/react-dialog';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import bytes from 'bytes';
import {
  type DragEvent,
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
  '.yml',
  '.yaml',
  '.nb',
  '.pdf',
].join(',');

const textFileExtensions = ['.txt', '.md', '.yml', '.yaml', '.nb'];

type UploadCandidate = {
  file: File;
  path: string;
};

type FileWithRelativePath = File & {
  webkitRelativePath?: string;
};

type DirectoryEntry = {
  type: 'directory';
  name: string;
  path: string;
  file?: WorkspaceContainerFile;
  updatedAt: string;
};

type FileEntry = {
  type: 'file';
  file: WorkspaceContainerFile;
};

type ContainerEntry = DirectoryEntry | FileEntry;

interface FileSystemEntryLike {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file(
    success: (file: File) => void,
    error?: (error: DOMException) => void
  ): void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader(): {
    readEntries(
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: DOMException) => void
    ): void;
  };
}

interface DataTransferItemWithEntry extends DataTransferItem {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
}

function errorMessage(error: unknown) {
  return UserFriendlyError.fromAny(error).message;
}

function normalizeRelativePath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
    .join('/');
}

function joinContainerPath(currentPath: string, path: string) {
  const normalized = normalizeRelativePath(path);
  return `${currentPath}${normalized}`;
}

function displayPathName(path: string) {
  const clean = path.endsWith('/') ? path.slice(0, -1) : path;
  return clean.split('/').pop() || clean;
}

function parentPath(path: string) {
  const clean = path.endsWith('/') ? path.slice(0, -1) : path;
  const index = clean.lastIndexOf('/');
  return index >= 0 ? `${clean.slice(0, index)}/` : '';
}

function isTextFileName(name: string) {
  const lowerName = name.toLowerCase();
  return textFileExtensions.some(ext => lowerName.endsWith(ext));
}

function buildContainerEntries(
  files: WorkspaceContainerFile[],
  currentPath: string
): ContainerEntry[] {
  const directories = new Map<string, DirectoryEntry>();
  const fileEntries: FileEntry[] = [];

  for (const file of files) {
    if (!file.name.startsWith(currentPath) || file.name === currentPath) {
      continue;
    }

    const relativePath = file.name.slice(currentPath.length);
    const [segment, ...rest] = relativePath.split('/');
    if (!segment) {
      continue;
    }

    if (rest.length || file.kind === 'directory') {
      const path = `${currentPath}${segment}/`;
      const existing = directories.get(path);
      const updatedAt =
        !existing ||
        new Date(file.updatedAt).getTime() >
          new Date(existing.updatedAt).getTime()
          ? file.updatedAt
          : existing.updatedAt;
      directories.set(path, {
        type: 'directory',
        name: segment,
        path,
        file: file.kind === 'directory' ? file : existing?.file,
        updatedAt,
      });
      continue;
    }

    fileEntries.push({ type: 'file', file });
  }

  const sortedDirectories = [...directories.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const sortedFileEntries = fileEntries.sort((a, b) => {
    const timeDelta =
      new Date(b.file.updatedAt).getTime() -
      new Date(a.file.updatedAt).getTime();
    return timeDelta || a.file.name.localeCompare(b.file.name);
  });
  return [...sortedDirectories, ...sortedFileEntries];
}

function getBreadcrumbs(path: string) {
  const segments = path.split('/').filter(Boolean);
  return segments.map((segment, index) => ({
    name: segment,
    path: `${segments.slice(0, index + 1).join('/')}/`,
  }));
}

function hasFileDrag(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes('Files');
}

function ContainerEntryIcon({ entry }: { entry: ContainerEntry }) {
  if (entry.type === 'directory') {
    return <FolderIcon width={20} height={20} />;
  }
  const FileIcon = getAttachmentFileIconRC(entry.file.mime);
  return <FileIcon width={20} height={20} />;
}

type PreviewState =
  | { mode: 'image'; file: WorkspaceContainerFile }
  | { mode: 'pdf'; file: WorkspaceContainerFile }
  | { mode: 'text'; file: WorkspaceContainerFile };

async function fileFromEntry(entry: FileSystemFileEntryLike) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readDirectoryEntries(
  entry: FileSystemDirectoryEntryLike
): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntryLike[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) {
      return entries;
    }
    entries.push(...batch);
  }
}

async function collectEntryFiles(
  entry: FileSystemEntryLike,
  parent = ''
): Promise<UploadCandidate[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await fileFromEntry(entry as FileSystemFileEntryLike);
    return [{ file, path }];
  }
  if (!entry.isDirectory) {
    return [];
  }

  const children = await readDirectoryEntries(
    entry as FileSystemDirectoryEntryLike
  );
  const files = await Promise.all(
    children.map(child => collectEntryFiles(child, path))
  );
  return files.flat();
}

async function getDropCandidates(dataTransfer: DataTransfer) {
  const entries = Array.from(dataTransfer.items)
    .map(item => (item as DataTransferItemWithEntry).webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntryLike => !!entry);

  if (entries.length) {
    const files = await Promise.all(
      entries.map(entry => collectEntryFiles(entry))
    );
    return files.flat();
  }

  return Array.from(dataTransfer.files).map(file => ({
    file,
    path: (file as FileWithRelativePath).webkitRelativePath || file.name,
  }));
}

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
  const dragDepthRef = useRef(0);
  const { openConfirmModal } = useConfirmModal();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [createMode, setCreateMode] = useState<'file' | 'directory' | null>(
    null
  );
  const [createNameDraft, setCreateNameDraft] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
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
    setCurrentPath('');
    setPreview(null);
  }, [containerId]);

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

  const currentEntries = useMemo(
    () => buildContainerEntries(sortedFiles, currentPath),
    [currentPath, sortedFiles]
  );

  const breadcrumbs = useMemo(() => getBreadcrumbs(currentPath), [currentPath]);

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

  const handleUploadCandidates = useCallback(
    async (candidates: UploadCandidate[]) => {
      if (!containerId || !candidates.length) return;
      setUploading(true);
      try {
        for (const candidate of candidates) {
          const uploaded = await containerService.uploadFile(
            containerId,
            candidate.file,
            joinContainerPath(currentPath, candidate.path)
          );
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
    [containerId, containerService, currentPath, t]
  );

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      await handleUploadCandidates(
        Array.from(fileList).map(file => ({
          file,
          path: (file as FileWithRelativePath).webkitRelativePath || file.name,
        }))
      );
    },
    [handleUploadCandidates]
  );

  const openCreateDialog = useCallback(
    (mode: 'file' | 'directory') => {
      setCreateMode(mode);
      setCreateNameDraft(
        mode === 'file'
          ? t['com.affine.container.create-text.default-name']()
          : t['com.affine.container.create-folder.default-name']()
      );
    },
    [t]
  );

  const closeCreateDialog = useCallback(() => {
    if (createSaving) {
      return;
    }
    setCreateMode(null);
    setCreateNameDraft('');
  }, [createSaving]);

  const handleCreateEntry = useCallback(async () => {
    if (!containerId || !createMode) {
      return;
    }
    const name = createNameDraft.trim();
    if (!name) {
      return;
    }
    if (createMode === 'file' && !isTextFileName(name)) {
      toast(t['com.affine.container.create-text.unsupported']());
      return;
    }

    setCreateSaving(true);
    try {
      if (createMode === 'file') {
        const file = await containerService.createTextFile(
          containerId,
          joinContainerPath(currentPath, name)
        );
        track.container.files.$.createContainerTextFile({
          kind: 'text',
          result: 'success',
        });
        closeCreateDialog();
        setPreview({ mode: 'text', file });
        toast(t['com.affine.container.create-text.success']());
      } else {
        const directory = await containerService.createDirectory(
          containerId,
          joinContainerPath(currentPath, name)
        );
        track.container.files.$.createContainerDirectory({
          kind: 'directory',
          result: 'success',
        });
        closeCreateDialog();
        setCurrentPath(directory.name);
        toast(t['com.affine.container.create-folder.success']());
      }
    } catch (error) {
      const message = errorMessage(error);
      if (createMode === 'file') {
        track.container.files.$.createContainerTextFile({
          kind: 'text',
          result: 'failure',
          reason: message,
        });
      } else {
        track.container.files.$.createContainerDirectory({
          kind: 'directory',
          result: 'failure',
          reason: message,
        });
      }
      toast(message);
    } finally {
      setCreateSaving(false);
    }
  }, [
    closeCreateDialog,
    containerId,
    containerService,
    createMode,
    createNameDraft,
    currentPath,
    t,
  ]);

  const handleCreateKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        void handleCreateEntry();
        return;
      }
      if (event.key === 'Escape') {
        closeCreateDialog();
      }
    },
    [closeCreateDialog, handleCreateEntry]
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) {
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      if (!hasFileDrag(event)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = 0;
      setDragActive(false);
      try {
        const candidates = await getDropCandidates(event.dataTransfer);
        await handleUploadCandidates(candidates);
      } catch (error) {
        toast(errorMessage(error));
      }
    },
    [handleUploadCandidates]
  );

  const openRenameFile = useCallback((file: WorkspaceContainerFile) => {
    setRenamingFile(file);
    setRenameDraft(displayPathName(file.name));
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
    const nextDraft = renameDraft.trim();
    const nextName = joinContainerPath(parentPath(renamingFile.name), nextDraft);
    const currentName =
      renamingFile.kind === 'directory'
        ? renamingFile.name.slice(0, -1)
        : renamingFile.name;
    if (!nextDraft || nextName === currentName) {
      closeRenameFile();
      return;
    }
    setRenameSaving(true);
    try {
      const renamed = await containerService.renameFile(renamingFile, nextName);
      if (
        renamingFile.kind === 'directory' &&
        currentPath.startsWith(renamingFile.name)
      ) {
        setCurrentPath(
          `${renamed.name}${currentPath.slice(renamingFile.name.length)}`
        );
      }
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
    currentPath,
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
        title:
          file.kind === 'directory'
            ? t['com.affine.container.folder.delete.confirm']()
            : t['com.affine.container.file.delete.confirm'](),
        cancelText: t['Cancel'](),
        confirmText:
          file.kind === 'directory'
            ? t['com.affine.container.folder.delete']()
            : t['com.affine.container.file.delete'](),
        confirmButtonOptions: {
          variant: 'error',
        },
        onConfirm: () => {
          void (async () => {
            try {
              await containerService.deleteFile(file);
              if (file.kind === 'directory' && currentPath.startsWith(file.name)) {
                setCurrentPath(parentPath(file.name));
              }
              track.container.files.$.deleteContainerFile({
                kind: file.kind,
                result: 'success',
              });
              toast(
                file.kind === 'directory'
                  ? t['com.affine.container.folder.delete.success']()
                  : t['com.affine.container.file.delete.success']()
              );
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
    [containerService, currentPath, openConfirmModal, t]
  );

  const handleOpenFile = useCallback((file: WorkspaceContainerFile) => {
    if (file.kind === 'directory') {
      setCurrentPath(file.name);
      return;
    }
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
              className={styles.button}
              disabled={!container || uploading}
              onClick={() => openCreateDialog('directory')}
            >
              <FolderIcon /> {t['com.affine.container.create-folder']()}
            </button>
            <button
              className={styles.button}
              disabled={!container || uploading}
              onClick={() => openCreateDialog('file')}
            >
              <TextIcon /> {t['com.affine.container.create-text']()}
            </button>
            <button
              className={styles.primaryButton}
              disabled={!container || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon /> {t['com.affine.container.upload']()}
            </button>
          </div>
        </div>
      </ViewHeader>
      <ViewBody>
        <main className={styles.page}>
          <section
            className={styles.body}
            data-dragging={dragActive}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={event => void handleDrop(event)}
          >
            {dragActive ? (
              <div className={styles.dropOverlay}>
                <UploadIcon />
                <span>{t['com.affine.container.drop-files']()}</span>
              </div>
            ) : null}
            <div className={styles.pathBar}>
              <button
                className={styles.pathButton}
                aria-current={currentPath ? undefined : 'page'}
                onClick={() => setCurrentPath('')}
              >
                {t['com.affine.container.path.root']()}
              </button>
              {breadcrumbs.map(crumb => (
                <button
                  key={crumb.path}
                  className={styles.pathButton}
                  aria-current={crumb.path === currentPath ? 'page' : undefined}
                  onClick={() => setCurrentPath(crumb.path)}
                >
                  {crumb.name}
                </button>
              ))}
            </div>
            {loading ? (
              <div className={styles.empty}>{t['Loading']()}</div>
            ) : currentEntries.length === 0 ? (
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
                  {currentEntries.map(entry => {
                    const file = entry.file;
                    return (
                      <tr
                        key={
                          entry.type === 'directory' ? entry.path : entry.file.id
                        }
                      >
                        <td className={styles.td}>
                          <button
                            className={styles.nameCell}
                            onClick={() => {
                              if (entry.type === 'directory') {
                                setCurrentPath(entry.path);
                                return;
                              }
                              handleOpenFile(entry.file);
                            }}
                          >
                            <ContainerEntryIcon entry={entry} />
                            <span>
                              {entry.type === 'directory'
                                ? entry.name
                                : displayPathName(entry.file.name)}
                            </span>
                          </button>
                        </td>
                        <td className={styles.td}>
                          {entry.type === 'directory'
                            ? t['com.affine.container.file.kind.directory']()
                            : entry.file.kind === 'image'
                              ? t['com.affine.container.file.kind.image']()
                              : entry.file.kind === 'pdf'
                                ? t['com.affine.container.file.kind.pdf']()
                                : t['com.affine.container.file.kind.text']()}
                        </td>
                        <td className={styles.td}>
                          {entry.type === 'directory'
                            ? '-'
                            : bytes(entry.file.size)}
                        </td>
                        <td className={styles.td}>
                          {new Date(
                            entry.type === 'directory'
                              ? entry.updatedAt
                              : entry.file.updatedAt
                          ).toLocaleString()}
                        </td>
                        <td className={styles.td}>
                          {file ? (
                            <div className={styles.rowActions}>
                              <button
                                className={styles.button}
                                aria-label={
                                  file.kind === 'directory'
                                    ? t['com.affine.container.folder.rename']()
                                    : t['com.affine.container.file.rename']()
                                }
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
                          ) : null}
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
        open={!!createMode}
        onOpenChange={open => {
          if (!open) {
            closeCreateDialog();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          {createMode ? (
            <Dialog.Content className={styles.renameModal}>
              <div className={styles.modalHeader}>
                <Dialog.Title className={styles.modalTitle}>
                  {createMode === 'file'
                    ? t['com.affine.container.create-text']()
                    : t['com.affine.container.create-folder']()}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    className={styles.button}
                    aria-label={t['com.affine.container.preview.close']()}
                    disabled={createSaving}
                  >
                    <CloseIcon />
                  </button>
                </Dialog.Close>
              </div>
              <div className={styles.renameBody}>
                <input
                  className={styles.renameInput}
                  autoFocus
                  value={createNameDraft}
                  aria-label={
                    createMode === 'file'
                      ? t['com.affine.container.create-text.name']()
                      : t['com.affine.container.create-folder.name']()
                  }
                  placeholder={
                    createMode === 'file'
                      ? t['com.affine.container.create-text.placeholder']()
                      : t['com.affine.container.create-folder.placeholder']()
                  }
                  onChange={event =>
                    setCreateNameDraft(event.currentTarget.value)
                  }
                  onKeyDown={handleCreateKeyDown}
                />
                <div className={styles.modalFooter}>
                  <Dialog.Close asChild>
                    <button className={styles.button} disabled={createSaving}>
                      {t['Cancel']()}
                    </button>
                  </Dialog.Close>
                  <button
                    className={styles.primaryButton}
                    disabled={!createNameDraft.trim() || createSaving}
                    onClick={() => void handleCreateEntry()}
                  >
                    {createMode === 'file'
                      ? t['com.affine.container.create-text']()
                      : t['com.affine.container.create-folder']()}
                  </button>
                </div>
              </div>
            </Dialog.Content>
          ) : null}
        </Dialog.Portal>
      </Dialog.Root>
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
                  {renamingFile.kind === 'directory'
                    ? t['com.affine.container.folder.rename']()
                    : t['com.affine.container.file.rename']()}
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
                  aria-label={
                    renamingFile.kind === 'directory'
                      ? t['com.affine.container.folder.rename']()
                      : t['com.affine.container.file.rename']()
                  }
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
                    {renamingFile.kind === 'directory'
                      ? t['com.affine.container.folder.rename']()
                      : t['com.affine.container.file.rename']()}
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
