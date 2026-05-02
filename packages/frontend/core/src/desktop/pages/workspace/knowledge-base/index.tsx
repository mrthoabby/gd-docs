import { toast } from '@affine/component';
import { DocsService } from '@affine/core/modules/doc';
import {
  KnowledgeBaseService,
  type KnowledgeBaseSourceInput,
  type WorkspaceKnowledgeBaseSource,
} from '@affine/core/modules/knowledge-base';
import { OrganizeService, type FolderNode } from '@affine/core/modules/organize';
import {
  useIsActiveView,
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import { AiIcon, ResetIcon } from '@blocksuite/icons/rc';
import { Text } from '@blocksuite/affine/store';
import { useLiveData, useServices } from '@toeverything/infra';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import { PageNotFound } from '../../404';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './index.css';

function errorMessage(error: unknown) {
  return UserFriendlyError.fromAny(error).message;
}

function sourceKey(source: KnowledgeBaseSourceInput) {
  return `${source.sourceType}:${source.sourceId}`;
}

function collectSources(
  folder: FolderNode | null | undefined,
  includeSubfolders: boolean
) {
  if (!folder || folder.type$.value !== 'folder') {
    return [];
  }

  const sources = new Map<string, KnowledgeBaseSourceInput>();
  const visit = (parent: FolderNode) => {
    for (const child of parent.sortedChildren$.value) {
      const type = child.type$.value;
      const id = child.data$.value;
      if ((type === 'doc' || type === 'container') && id) {
        const source: KnowledgeBaseSourceInput = {
          sourceType: type,
          sourceId: id,
          parentFolderNodeId: parent.id,
          contentHash: `${type}:${id}`,
        };
        sources.set(sourceKey(source), source);
        continue;
      }
      if (includeSubfolders && type === 'folder') {
        visit(child);
      }
    }
  };

  visit(folder);
  return [...sources.values()];
}

function countSelectionLines(text: string) {
  return text.trim().split(/\r\n|\r|\n/).length;
}

function sourceStatusLabel(
  t: ReturnType<typeof useI18n>,
  status: WorkspaceKnowledgeBaseSource['status']
) {
  switch (status) {
    case 'indexed':
      return t['com.affine.knowledgeBase.source.status.indexed']();
    case 'pending':
      return t['com.affine.knowledgeBase.source.status.pending']();
    case 'stale':
      return t['com.affine.knowledgeBase.source.status.stale']();
    case 'failed':
      return t['com.affine.knowledgeBase.source.status.failed']();
  }
}

export const Component = function KnowledgeBasePage() {
  const t = useI18n();
  const params = useParams();
  const knowledgeBaseId = params.knowledgeBaseId;
  const {
    knowledgeBaseService,
    organizeService,
    docsService,
    workbenchService,
  } = useServices({
    KnowledgeBaseService,
    OrganizeService,
    DocsService,
    WorkbenchService,
  });
  const isActiveView = useIsActiveView();
  const knowledgeBase = useLiveData(
    knowledgeBaseId
      ? knowledgeBaseService.knowledgeBase$(knowledgeBaseId)
      : null
  );
  const sources = useLiveData(
    knowledgeBaseId ? knowledgeBaseService.sourcesFor$(knowledgeBaseId) : null
  );
  const folderNode = useLiveData(
    knowledgeBase
      ? organizeService.folderTree.folderNode$(knowledgeBase.folderNodeId)
      : null
  );
  const folderChildren = useLiveData(folderNode?.sortedChildren$);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerSources, setAnswerSources] = useState<
    WorkspaceKnowledgeBaseSource[]
  >([]);
  const [asking, setAsking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectionAction, setSelectionAction] = useState<{
    text: string;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!knowledgeBaseId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      knowledgeBaseService.loadKnowledgeBase(knowledgeBaseId),
      knowledgeBaseService.listSources(knowledgeBaseId),
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
  }, [knowledgeBaseId, knowledgeBaseService]);

  useEffect(() => {
    setNameDraft(knowledgeBase?.name ?? '');
  }, [knowledgeBase?.name]);

  useEffect(() => {
    if (isActiveView && knowledgeBaseId) {
      track.knowledgeBase.$.$.openKnowledgeBase({});
    }
  }, [isActiveView, knowledgeBaseId]);

  const discoveredSources = useMemo(() => {
    void folderChildren;
    return collectSources(folderNode, knowledgeBase?.includeSubfolders ?? false);
  }, [folderChildren, folderNode, knowledgeBase?.includeSubfolders]);

  const syncSources = useCallback(
    async (options?: { throwOnError?: boolean }) => {
      if (!knowledgeBaseId) {
        return;
      }
      setSyncing(true);
      try {
        await knowledgeBaseService.syncSources(
          knowledgeBaseId,
          discoveredSources
        );
        track.knowledgeBase.sources.$.syncKnowledgeBaseSources({
          result: 'success',
        });
      } catch (error) {
        track.knowledgeBase.sources.$.syncKnowledgeBaseSources({
          result: 'failure',
          reason: errorMessage(error),
        });
        toast(errorMessage(error));
        if (options?.throwOnError) {
          throw error;
        }
      } finally {
        setSyncing(false);
      }
    },
    [discoveredSources, knowledgeBaseId, knowledgeBaseService]
  );

  useEffect(() => {
    if (!loading && knowledgeBaseId && folderNode) {
      void syncSources();
    }
  }, [folderNode, knowledgeBaseId, loading, syncSources]);

  const handleSaveName = useCallback(async () => {
    if (!knowledgeBase || !nameDraft.trim() || nameDraft === knowledgeBase.name) {
      setNameDraft(knowledgeBase?.name ?? '');
      return;
    }
    try {
      await knowledgeBaseService.renameKnowledgeBase(
        knowledgeBase.id,
        nameDraft
      );
      track.$.navigationPanel.organize.renameOrganizeItem({
        type: 'knowledge-base',
      });
    } catch (error) {
      setNameDraft(knowledgeBase.name);
      toast(errorMessage(error));
    }
  }, [knowledgeBase, knowledgeBaseService, nameDraft]);

  const handleToggleSubfolders = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!knowledgeBase) {
        return;
      }
      const includeSubfolders = event.currentTarget.checked;
      if (
        includeSubfolders &&
        !window.confirm(t['com.affine.knowledgeBase.settings.costConfirm']())
      ) {
        return;
      }
      try {
        await knowledgeBaseService.updateSettings(knowledgeBase.id, {
          includeSubfolders,
        });
        track.knowledgeBase.settings.$.updateKnowledgeBaseSettings({
          result: 'success',
          includeSubfolders,
        });
      } catch (error) {
        track.knowledgeBase.settings.$.updateKnowledgeBaseSettings({
          result: 'failure',
          reason: errorMessage(error),
        });
        toast(errorMessage(error));
      }
    },
    [knowledgeBase, knowledgeBaseService, t]
  );

  const handleMinLinesChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!knowledgeBase) {
        return;
      }
      const next = Number(event.currentTarget.value);
      try {
        await knowledgeBaseService.updateSettings(knowledgeBase.id, {
          selectionCreateDocMinLines: next,
        });
        track.knowledgeBase.settings.$.updateKnowledgeBaseSettings({
          result: 'success',
        });
      } catch (error) {
        track.knowledgeBase.settings.$.updateKnowledgeBaseSettings({
          result: 'failure',
          reason: errorMessage(error),
        });
        toast(errorMessage(error));
      }
    },
    [knowledgeBase, knowledgeBaseService]
  );

  const handleReindex = useCallback(async () => {
    if (!knowledgeBaseId) {
      return;
    }
    try {
      await syncSources({ throwOnError: true });
      await knowledgeBaseService.reindex(knowledgeBaseId);
      track.knowledgeBase.sources.$.reindexKnowledgeBase({
        result: 'success',
      });
      toast(t['com.affine.knowledgeBase.reindex.success']());
    } catch (error) {
      track.knowledgeBase.sources.$.reindexKnowledgeBase({
        result: 'failure',
        reason: errorMessage(error),
      });
      toast(errorMessage(error));
    }
  }, [knowledgeBaseId, knowledgeBaseService, syncSources, t]);

  const handleAsk = useCallback(async () => {
    if (!knowledgeBaseId || !question.trim()) {
      return;
    }
    setAsking(true);
    try {
      const result = await knowledgeBaseService.ask(
        knowledgeBaseId,
        question.trim()
      );
      setAnswer(result.answer);
      setAnswerSources(result.sources);
      track.knowledgeBase.chat.$.askKnowledgeBase({ result: 'success' });
    } catch (error) {
      track.knowledgeBase.chat.$.askKnowledgeBase({
        result: 'failure',
        reason: errorMessage(error),
      });
      toast(errorMessage(error));
    } finally {
      setAsking(false);
    }
  }, [knowledgeBaseId, knowledgeBaseService, question]);

  const handleQuestionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        void handleAsk();
      }
    },
    [handleAsk]
  );

  const handleTextSelection = useCallback(() => {
    if (!knowledgeBase) {
      return;
    }
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!selection || !text) {
      setSelectionAction(null);
      return;
    }
    if (countSelectionLines(text) < knowledgeBase.selectionCreateDocMinLines) {
      setSelectionAction(null);
      return;
    }
    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    if (!rect) {
      setSelectionAction(null);
      return;
    }
    setSelectionAction({
      text,
      left: Math.min(rect.left, window.innerWidth - 260),
      top: Math.max(8, rect.top - 40),
    });
  }, [knowledgeBase]);

  const handleCreateDocFromSelection = useCallback(async () => {
    if (!knowledgeBaseId || !folderNode || !selectionAction) {
      return;
    }
    try {
      const draft = await knowledgeBaseService.createSelectionDocDraft(
        knowledgeBaseId,
        selectionAction.text
      );
      const doc = docsService.createDocument({
        id: draft.id,
        title: draft.title,
        docProps: {
          paragraph: {
            text: new Text(draft.content),
          },
        },
      });
      folderNode.createLink('doc', doc.id, folderNode.indexAt('before'));
      workbenchService.workbench.openDoc(doc.id, { at: 'active' });
      setSelectionAction(null);
      await syncSources();
      track.knowledgeBase.chat.$.createDocFromKnowledgeBaseSelection({
        result: 'success',
      });
    } catch (error) {
      track.knowledgeBase.chat.$.createDocFromKnowledgeBaseSelection({
        result: 'failure',
        reason: errorMessage(error),
      });
      toast(errorMessage(error));
    }
  }, [
    docsService,
    folderNode,
    knowledgeBaseId,
    knowledgeBaseService,
    selectionAction,
    syncSources,
    workbenchService,
  ]);

  const handleToggleSource = useCallback(
    async (
      source: WorkspaceKnowledgeBaseSource,
      manualOverride: 'include' | 'exclude'
    ) => {
      try {
        await knowledgeBaseService.updateSourceOverrides(
          source.knowledgeBaseId,
          [
            {
              sourceType: source.sourceType,
              sourceId: source.sourceId,
              manualOverride,
            },
          ]
        );
        track.knowledgeBase.sources.$.updateKnowledgeBaseSourceOverride({
          result: 'success',
          sourceType: source.sourceType,
        });
      } catch (error) {
        track.knowledgeBase.sources.$.updateKnowledgeBaseSourceOverride({
          result: 'failure',
          sourceType: source.sourceType,
          reason: errorMessage(error),
        });
        toast(errorMessage(error));
      }
    },
    [knowledgeBaseService]
  );

  if (!knowledgeBaseId) {
    return <PageNotFound />;
  }

  if (!loading && error && !knowledgeBase) {
    return (
      <>
        <ViewIcon icon="ai" />
        <ViewTitle title={t['com.affine.knowledgeBase.title']()} />
        <ViewBody>
          <div className={styles.empty}>
            <span className={styles.error}>
              {t['com.affine.knowledgeBase.load.error']()}
            </span>
          </div>
        </ViewBody>
      </>
    );
  }

  if (!loading && !knowledgeBase) {
    return <PageNotFound />;
  }

  const sourceList = sources ?? [];
  const indexedCount = sourceList.filter(source => source.status === 'indexed')
    .length;
  const includedCount = sourceList.filter(source => source.included).length;

  return (
    <>
      <ViewIcon icon="ai" />
      <ViewTitle
        title={knowledgeBase?.name ?? t['com.affine.knowledgeBase.title']()}
      />
      <AllDocSidebarTabs />
      <ViewHeader>
        <div className={styles.header}>
          <AiIcon />
          <input
            className={styles.titleInput}
            value={nameDraft}
            aria-label={t['com.affine.knowledgeBase.rename.label']()}
            disabled={!knowledgeBase}
            onChange={event => setNameDraft(event.currentTarget.value)}
            onBlur={handleSaveName}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setNameDraft(knowledgeBase?.name ?? '');
                event.currentTarget.blur();
              }
            }}
          />
          <div className={styles.toolbar}>
            <button
              className={styles.button}
              disabled={!knowledgeBase || syncing}
              onClick={() => void syncSources()}
            >
              <ResetIcon />
              {syncing
                ? t['com.affine.knowledgeBase.syncing']()
                : t['com.affine.knowledgeBase.sync']()}
            </button>
          </div>
        </div>
      </ViewHeader>
      <ViewBody>
        <main className={styles.page}>
          <section className={styles.main}>
            <div
              className={styles.answerArea}
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
            >
              {loading ? (
                <div className={styles.empty}>{t['Loading']()}</div>
              ) : answer ? (
                <div className={styles.answer}>
                  {answer}
                  {answerSources.length ? (
                    <>
                      {'\n\n'}
                      {t['com.affine.knowledgeBase.answer.sources']()}
                      {answerSources
                        .map(source => `\n- ${source.sourceType}:${source.sourceId}`)
                        .join('')}
                    </>
                  ) : null}
                </div>
              ) : (
                <div className={styles.empty}>
                  {t['com.affine.knowledgeBase.empty']()}
                </div>
              )}
            </div>
            <div className={styles.prompt}>
              <textarea
                className={styles.textarea}
                value={question}
                aria-label={t['com.affine.knowledgeBase.ask.label']()}
                placeholder={t['com.affine.knowledgeBase.ask.placeholder']()}
                onChange={event => setQuestion(event.currentTarget.value)}
                onKeyDown={handleQuestionKeyDown}
              />
              <button
                className={styles.primaryButton}
                disabled={!question.trim() || asking}
                onClick={() => void handleAsk()}
              >
                {asking
                  ? t['com.affine.knowledgeBase.asking']()
                  : t['com.affine.knowledgeBase.ask']()}
              </button>
            </div>
          </section>
          <aside className={styles.sidebar}>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                {t['com.affine.knowledgeBase.sources.title']()}
              </div>
              <div className={styles.muted}>
                {t['com.affine.knowledgeBase.sources.summary']({
                  indexed: indexedCount,
                  total: includedCount,
                })}
              </div>
              <button
                className={styles.button}
                disabled={!knowledgeBase}
                onClick={() => void handleReindex()}
              >
                <ResetIcon />
                {t['com.affine.knowledgeBase.reindex']()}
              </button>
              <div className={styles.sourceList}>
                {sourceList.length ? (
                  sourceList.map(source => (
                    <div key={source.id} className={styles.sourceRow}>
                      <div>
                        <div className={styles.sourceName}>
                          {source.sourceType}:{source.sourceId}
                        </div>
                        <div className={styles.sourceMeta}>
                          {source.included
                            ? t['com.affine.knowledgeBase.source.included']()
                            : t['com.affine.knowledgeBase.source.excluded']()}
                          {' · '}
                          {sourceStatusLabel(t, source.status)}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={source.included}
                        aria-label={t[
                          'com.affine.knowledgeBase.source.toggle'
                        ]()}
                        onChange={event =>
                          void handleToggleSource(
                            source,
                            event.currentTarget.checked
                              ? 'include'
                              : 'exclude'
                          )
                        }
                      />
                    </div>
                  ))
                ) : (
                  <div className={styles.muted}>
                    {t['com.affine.knowledgeBase.sources.empty']()}
                  </div>
                )}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                {t['com.affine.knowledgeBase.settings.title']()}
              </div>
              <label className={styles.field}>
                <span>{t['com.affine.knowledgeBase.settings.subfolders']()}</span>
                <input
                  type="checkbox"
                  checked={knowledgeBase?.includeSubfolders ?? false}
                  disabled={!knowledgeBase}
                  onChange={handleToggleSubfolders}
                />
              </label>
              <div className={styles.muted}>
                {t['com.affine.knowledgeBase.settings.subfolders.help']()}
              </div>
              <label className={styles.field}>
                <span>{t['com.affine.knowledgeBase.settings.minLines']()}</span>
                <input
                  className={styles.numberInput}
                  type="number"
                  min={1}
                  max={100}
                  value={knowledgeBase?.selectionCreateDocMinLines ?? 5}
                  disabled={!knowledgeBase}
                  onChange={handleMinLinesChange}
                />
              </label>
            </section>
          </aside>
        </main>
      </ViewBody>
      {selectionAction ? (
        <button
          className={styles.selectionAction}
          style={{
            left: selectionAction.left,
            top: selectionAction.top,
          }}
          onMouseDown={event => event.preventDefault()}
          onClick={() => void handleCreateDocFromSelection()}
        >
          {t['com.affine.knowledgeBase.selection.createDoc']()}
        </button>
      ) : null}
    </>
  );
};
