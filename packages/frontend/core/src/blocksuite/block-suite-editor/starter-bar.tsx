import {
  handleInlineAskAIAction,
  pageAIGroups,
} from '@affine/core/blocksuite/ai';
import { useEnableAI } from '@affine/core/components/hooks/affine/use-enable-ai';
import { DocsService } from '@affine/core/modules/doc';
import { EditorService } from '@affine/core/modules/editor';
import { useI18n } from '@affine/i18n';
import { PageRootBlockComponent } from '@blocksuite/affine/blocks/root';
import type { Store } from '@blocksuite/affine/store';
import { AiIcon, EdgelessIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import clsx from 'clsx';
import {
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from 'react';

import * as styles from './starter-bar.css';

const Badge = forwardRef<
  HTMLLIElement,
  HTMLAttributes<HTMLLIElement> & {
    icon: React.ReactNode;
    text: string;
    active?: boolean;
  }
>(function Badge({ icon, text, className, active, ...attrs }, ref) {
  return (
    <li
      data-active={active}
      className={clsx(styles.badge, className)}
      ref={ref}
      {...attrs}
    >
      <span className={styles.badgeText}>{text}</span>
      <span className={styles.badgeIcon}>{icon}</span>
    </li>
  );
});

const StarterBarNotEmpty = ({ doc }: { doc: Store }) => {
  const t = useI18n();

  const docsService = useService(DocsService);
  const editorService = useService(EditorService);

  const enableAI = useEnableAI();

  const startWithEdgeless = useCallback(() => {
    const record = docsService.list.doc$(doc.id).value;
    record?.setPrimaryMode('edgeless');
    editorService.editor.setMode('edgeless');
  }, [doc.id, docsService.list, editorService.editor]);

  const startWithAI = useCallback(() => {
    const std = editorService.editor.editorContainer$.value?.std;
    if (!std) return;

    const rootBlockId = std.host.store.root?.id;
    if (!rootBlockId) return;

    const rootComponent = std.view.getBlock(rootBlockId);
    if (!(rootComponent instanceof PageRootBlockComponent)) return;

    const { id, created } = rootComponent.focusFirstParagraph();
    if (created) {
      const subscription = std.view.viewUpdated.subscribe(v => {
        if (v.id === id) {
          subscription.unsubscribe();
          handleInlineAskAIAction(std.host, pageAIGroups);
        }
      });
    } else {
      handleInlineAskAIAction(std.host, pageAIGroups);
    }
  }, [editorService.editor]);

  return (
    <div className={styles.root} data-testid="starter-bar">
      {t['com.affine.page-starter-bar.start']()}
      <ul className={styles.badges}>
        {enableAI ? (
          <Badge
            data-testid="start-with-ai-badge"
            icon={<AiIcon className={styles.aiIcon} />}
            text={t['com.affine.page-starter-bar.ai']()}
            onClick={startWithAI}
          />
        ) : null}

        <Badge
          icon={<EdgelessIcon />}
          text={t['com.affine.page-starter-bar.edgeless']()}
          onClick={startWithEdgeless}
        />
      </ul>
    </div>
  );
};

export const StarterBar = ({ doc }: { doc: Store }) => {
  const [isEmpty, setIsEmpty] = useState(doc.isEmpty);

  useEffect(() => {
    return doc.isEmpty$.subscribe(value => {
      setIsEmpty(value);
    });
  }, [doc]);

  if (!isEmpty) return null;

  return <StarterBarNotEmpty doc={doc} />;
};
