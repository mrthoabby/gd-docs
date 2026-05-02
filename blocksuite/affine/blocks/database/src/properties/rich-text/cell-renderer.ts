import { createLitPortal } from '@blocksuite/affine-components/portal';
import {
  createDefaultPillSelect,
  DefaultInlineManagerExtension,
} from '@blocksuite/affine-inline-preset';
import type { RichText } from '@blocksuite/affine-rich-text';
import {
  ParseDocUrlProvider,
  TelemetryProvider,
} from '@blocksuite/affine-shared/services';
import type {
  AffineInlineEditor,
  AffineTextAttributes,
} from '@blocksuite/affine-shared/types';
import { getViewportElement } from '@blocksuite/affine-shared/utils';
import {
  BaseCellRenderer,
  createFromBaseCellRenderer,
  createIcon,
} from '@blocksuite/data-view';
import { IS_MAC } from '@blocksuite/global/env';
import type { BlockSnapshot, DeltaInsert } from '@blocksuite/store';
import { Text } from '@blocksuite/store';
import { computed, effect, signal } from '@preact/signals-core';
import { ref } from 'lit/directives/ref.js';
import { html } from 'lit/static-html.js';

import { EditorHostKey } from '../../context/host-context.js';
import type { DatabaseBlockComponent } from '../../database-block.js';
import { analyzeTextForUrlPaste, insertUrlTextSegments } from '../paste-url.js';
import {
  richTextCellStyle,
  richTextContainerStyle,
} from './cell-renderer-css.js';
import { richTextPropertyModelConfig } from './define.js';

function toggleStyle(
  inlineEditor: AffineInlineEditor | null,
  attrs: AffineTextAttributes
): void {
  if (!inlineEditor) return;

  const inlineRange = inlineEditor.getInlineRange();
  if (!inlineRange) return;

  const root = inlineEditor.rootElement;
  if (!root) {
    return;
  }

  const deltas = inlineEditor.getDeltasByInlineRange(inlineRange);
  let oldAttributes: AffineTextAttributes = {};

  for (const [delta] of deltas) {
    const attributes = delta.attributes;

    if (!attributes) {
      continue;
    }

    oldAttributes = { ...attributes };
  }

  const newAttributes = Object.fromEntries(
    Object.entries(attrs).map(([k, v]) => {
      if (
        typeof v === 'boolean' &&
        v === (oldAttributes as Record<string, unknown>)[k]
      ) {
        return [k, !v];
      } else {
        return [k, v];
      }
    })
  ) as AffineTextAttributes;

  inlineEditor.formatText(inlineRange, newAttributes, {
    mode: 'merge',
  });
  root.blur();

  inlineEditor.syncInlineRange();
}

export class RichTextCell extends BaseCellRenderer<Text, string> {
  inlineEditor$ = computed(() => {
    return this.richText$.value?.inlineEditor;
  });

  get inlineManager() {
    return this.view
      .serviceGet(EditorHostKey)
      ?.std.get(DefaultInlineManagerExtension.identifier);
  }

  get topContenteditableElement() {
    const databaseBlock =
      this.closest<DatabaseBlockComponent>('affine-database');
    return databaseBlock?.topContenteditableElement;
  }

  get host() {
    return this.view.serviceGet(EditorHostKey);
  }

  private readonly richText$ = signal<RichText>();

  private _cellSlashMenuAbortController: AbortController | null = null;

  private _cellSlashStartIndex: number | null = null;

  private changeUserSelectAccordToReadOnly() {
    if (this && this instanceof HTMLElement) {
      this.style.userSelect = this.readonly ? 'text' : 'none';
    }
  }

  private _closeCellSlashMenu() {
    this._cellSlashMenuAbortController?.abort();
    this._cellSlashMenuAbortController = null;
    this._cellSlashStartIndex = null;
  }

  private readonly _insertPillSelectFromSlash = () => {
    const inlineEditor = this.inlineEditor$.value;
    const inlineRange = inlineEditor?.getInlineRange();
    const slashStartIndex = this._cellSlashStartIndex;
    if (!inlineEditor || !inlineRange || slashStartIndex === null) return;

    const slashLength = Math.max(1, inlineRange.index - slashStartIndex);
    const slashText = inlineEditor.yTextString.slice(
      slashStartIndex,
      slashStartIndex + slashLength
    );
    if (!slashText.startsWith('/')) {
      this._closeCellSlashMenu();
      return;
    }

    inlineEditor.deleteText({
      index: slashStartIndex,
      length: slashLength,
    });
    inlineEditor.insertText(
      {
        index: slashStartIndex,
        length: 0,
      },
      ' '
    );
    inlineEditor.formatText(
      {
        index: slashStartIndex,
        length: 1,
      },
      {
        pillSelect: createDefaultPillSelect(),
      }
    );
    inlineEditor.setInlineRange({
      index: slashStartIndex,
      length: 1,
    });
    this._closeCellSlashMenu();

    inlineEditor
      .waitForUpdate()
      .then(async () => {
        await inlineEditor.waitForUpdate();

        const textPoint = inlineEditor.getTextPoint(slashStartIndex + 1);
        if (!textPoint) return;
        const [text] = textPoint;
        const pillSelectNode = text.parentElement?.closest(
          'affine-pill-select-node'
        );
        (
          pillSelectNode as { toggleEditor?: () => void } | null
        )?.toggleEditor?.();
      })
      .catch(console.error);
  };

  private _openCellSlashMenu(startIndex: number) {
    const host = this.host;
    if (!host) return;

    this._cellSlashMenuAbortController?.abort();
    this._cellSlashStartIndex = startIndex;
    this._cellSlashMenuAbortController = new AbortController();

    const abortController = this._cellSlashMenuAbortController;
    const { portal } = createLitPortal({
      template: html`<div
        role="menu"
        aria-label="Cell insert menu"
        style="min-width:180px;padding:8px;border:0.5px solid var(--affine-border-color);border-radius:8px;background:var(--affine-background-overlay-panel-color);box-shadow:0 6px 16px rgba(0,0,0,.14);"
      >
        <button
          type="button"
          style="display:flex;width:100%;align-items:center;gap:10px;border:0;background:transparent;border-radius:6px;padding:8px;color:var(--affine-text-primary-color);font:inherit;text-align:left;cursor:pointer;"
          @mousedown=${(event: MouseEvent) => event.preventDefault()}
          @click=${this._insertPillSelectFromSlash}
        >
          <span
            aria-hidden="true"
            style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--affine-icon-color);"
          ></span>
          <span>Pill select</span>
        </button>
      </div>`,
      container: host,
      computePosition: {
        referenceElement: this,
        placement: 'bottom-start',
        autoUpdate: {
          animationFrame: true,
        },
      },
      closeOnClickAway: true,
      abortController,
      shadowDom: false,
      portalStyles: {
        zIndex: '9999',
      },
    });

    abortController.signal.addEventListener(
      'abort',
      () => {
        portal.remove();
        if (this._cellSlashMenuAbortController === abortController) {
          this._cellSlashMenuAbortController = null;
          this._cellSlashStartIndex = null;
        }
      },
      { once: true }
    );
  }

  private _maybeOpenCellSlashMenu() {
    const inlineEditor = this.inlineEditor$.value;
    const inlineRange = inlineEditor?.getInlineRange();
    if (!inlineEditor || !inlineRange || inlineRange.index === 0) return;

    const slashStartIndex = inlineRange.index - 1;
    if (inlineEditor.yTextString[slashStartIndex] !== '/') return;

    this._openCellSlashMenu(slashStartIndex);
  }

  private readonly _scheduleCellSlashMenu = () => {
    requestAnimationFrame(() => this._maybeOpenCellSlashMenu());
  };

  private readonly _onRichTextKeyUp = (event: KeyboardEvent) => {
    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      this._maybeOpenCellSlashMenu();
    }
  };

  private readonly _onRichTextInput = () => {
    this._maybeOpenCellSlashMenu();
  };

  private readonly _handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      if (event.key === 'Tab') {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
    }

    const cellSlashMenuOpen = !!this._cellSlashMenuAbortController;
    if (cellSlashMenuOpen) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this._insertPillSelectFromSlash();
        return;
      }
      if (event.key === 'Escape') {
        this._closeCellSlashMenu();
        return;
      }
    }

    if (event.key === 'Enter' && !event.isComposing) {
      if (event.shiftKey) {
        // soft enter
        this._onSoftEnter();
      } else {
        // exit editing
        this.selectCurrentCell(false);
      }
      event.preventDefault();
      return;
    }

    const inlineEditor = this.inlineEditor$.value;
    if (!inlineEditor) return;

    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      this._scheduleCellSlashMenu();
    }

    switch (event.key) {
      // bold ctrl+b
      case 'B':
      case 'b':
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          toggleStyle(inlineEditor, { bold: true });
        }
        break;
      // italic ctrl+i
      case 'I':
      case 'i':
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          toggleStyle(inlineEditor, { italic: true });
        }
        break;
      // underline ctrl+u
      case 'U':
      case 'u':
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          toggleStyle(inlineEditor, { underline: true });
        }
        break;
      // strikethrough ctrl+shift+s
      case 'S':
      case 's':
        if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
          event.preventDefault();
          toggleStyle(inlineEditor, { strike: true });
        }
        break;
      // inline code ctrl+shift+e
      case 'E':
      case 'e':
        if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
          event.preventDefault();
          toggleStyle(inlineEditor, { code: true });
        }
        break;
      default:
        break;
    }
  };

  private readonly _initYText = (text?: string) => {
    const yText = new Text(text);
    this.valueSetImmediate(yText);
  };

  private readonly _onSoftEnter = () => {
    if (this.value && this.inlineEditor$.value) {
      const inlineRange = this.inlineEditor$.value.getInlineRange();
      if (!inlineRange) return;

      const text = new Text(this.inlineEditor$.value.yText);
      text.replace(inlineRange.index, inlineRange.length, '\n');
      this.inlineEditor$.value.setInlineRange({
        index: inlineRange.index + 1,
        length: 0,
      });
    }
  };

  private readonly _onCopy = (e: ClipboardEvent) => {
    const inlineEditor = this.inlineEditor$.value;
    if (!inlineEditor) return;

    const inlineRange = inlineEditor.getInlineRange();
    if (!inlineRange) return;

    const text = inlineEditor.yTextString.slice(
      inlineRange.index,
      inlineRange.index + inlineRange.length
    );

    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    e.stopPropagation();
  };

  private readonly _onCut = (e: ClipboardEvent) => {
    const inlineEditor = this.inlineEditor$.value;
    if (!inlineEditor) return;

    const inlineRange = inlineEditor.getInlineRange();
    if (!inlineRange) return;

    const text = inlineEditor.yTextString.slice(
      inlineRange.index,
      inlineRange.index + inlineRange.length
    );
    inlineEditor.deleteText(inlineRange);
    inlineEditor.setInlineRange({
      index: inlineRange.index,
      length: 0,
    });

    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    e.stopPropagation();
  };

  private readonly _onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const inlineEditor = this.inlineEditor$.value;
    if (!inlineEditor) return;

    const inlineRange = inlineEditor.getInlineRange();
    if (!inlineRange) return;

    if (e.clipboardData) {
      try {
        const getDeltas = (snapshot: BlockSnapshot): DeltaInsert[] => {
          // @ts-expect-error FIXME: ts error
          const text = snapshot.props?.text?.delta;
          return text
            ? [...text, ...(snapshot.children?.flatMap(getDeltas) ?? [])]
            : snapshot.children?.flatMap(getDeltas);
        };
        const snapshot = this.std?.clipboard?.readFromClipboard(
          e.clipboardData
        )['BLOCKSUITE/SNAPSHOT'];
        const deltas = (
          JSON.parse(snapshot).snapshot.content as BlockSnapshot[]
        ).flatMap(getDeltas);
        deltas.forEach(delta => this.insertDelta(delta));
        return;
      } catch {
        //
      }
    }
    const text = e.clipboardData
      ?.getData('text/plain')
      ?.replace(/\r?\n|\r/g, '\n');
    if (!text) return;
    const { segments, singleUrl } = analyzeTextForUrlPaste(text);

    if (singleUrl) {
      const std = this.std;
      const result = std
        ?.getOptional(ParseDocUrlProvider)
        ?.parseDocUrl(singleUrl);
      if (result) {
        const text = ' ';
        inlineEditor.insertText(inlineRange, text, {
          reference: {
            type: 'LinkedPage',
            pageId: result.docId,
            params: {
              blockIds: result.blockIds,
              elementIds: result.elementIds,
              mode: result.mode,
            },
          },
        });
        inlineEditor.setInlineRange({
          index: inlineRange.index + text.length,
          length: 0,
        });

        // Track when a linked doc is created in database rich-text column
        std?.getOptional(TelemetryProvider)?.track('LinkedDocCreated', {
          module: 'database rich-text cell',
          type: 'paste',
          segment: 'database',
          parentFlavour: 'affine:database',
        });
        return;
      }
    }
    insertUrlTextSegments(inlineEditor, inlineRange, segments);
  };

  override connectedCallback() {
    super.connectedCallback();
    this.classList.add(richTextCellStyle);

    this.changeUserSelectAccordToReadOnly();

    const selectAll = (e: KeyboardEvent) => {
      if (e.key === 'a' && (IS_MAC ? e.metaKey : e.ctrlKey)) {
        e.stopPropagation();
        e.preventDefault();
        this.inlineEditor$.value?.selectAll();
      }
    };
    this.disposables.addFromEvent(this, 'keydown', selectAll);
    this.disposables.add(
      effect(() => {
        const editor = this.inlineEditor$.value;
        if (editor) {
          const disposable = editor.slots.keydown.subscribe(
            this._handleKeyDown
          );
          return () => disposable.unsubscribe();
        }
        return;
      })
    );
    this.disposables.add(
      effect(() => {
        const richText = this.richText$.value;
        if (richText) {
          richText.addEventListener('copy', this._onCopy, true);
          richText.addEventListener('cut', this._onCut, true);
          richText.addEventListener('paste', this._onPaste, true);
          richText.addEventListener('keyup', this._onRichTextKeyUp, true);
          richText.addEventListener('input', this._onRichTextInput, true);
          return () => {
            richText.removeEventListener('copy', this._onCopy, true);
            richText.removeEventListener('cut', this._onCut, true);
            richText.removeEventListener('paste', this._onPaste, true);
            richText.removeEventListener('keyup', this._onRichTextKeyUp, true);
            richText.removeEventListener('input', this._onRichTextInput, true);
          };
        }
        return;
      })
    );
  }

  override beforeEnterEditMode() {
    if (!this.value || typeof this.value === 'string') {
      this._initYText(this.value);
    }
    return true;
  }

  override afterEnterEditingMode() {
    this.inlineEditor$.value?.focusEnd();
  }

  override beforeExitEditingMode() {
    this._closeCellSlashMenu();
  }

  override render() {
    if (!this.value || !(this.value instanceof Text)) {
      return html` <div class="${richTextContainerStyle}"></div>`;
    }
    return html` <rich-text
      ${ref(this.richText$)}
      data-disable-ask-ai
      data-not-block-text
      .yText="${this.value}"
      .inlineEventSource="${this.topContenteditableElement}"
      .attributesSchema="${this.inlineManager?.getSchema()}"
      .attributeRenderer="${this.inlineManager?.getRenderer()}"
      .embedChecker="${this.inlineManager?.embedChecker}"
      .markdownMatches="${this.inlineManager?.markdownMatches}"
      .readonly="${!this.isEditing$.value || this.readonly}"
      .verticalScrollContainerGetter="${() =>
        this.topContenteditableElement?.host
          ? getViewportElement(this.topContenteditableElement.host)
          : null}"
      class="${richTextContainerStyle} inline-editor"
    ></rich-text>`;
  }

  private get std() {
    return this.view.serviceGet(EditorHostKey)?.std;
  }

  insertDelta = (delta: DeltaInsert<AffineTextAttributes>) => {
    const inlineEditor = this.inlineEditor$.value;
    const range = inlineEditor?.getInlineRange();
    if (!range || !delta.insert) {
      return;
    }
    inlineEditor?.insertText(range, delta.insert, delta.attributes);
    inlineEditor?.setInlineRange({
      index: range.index + delta.insert.length,
      length: 0,
    });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-rich-text-cell': RichTextCell;
  }
}

export const richTextColumnConfig =
  richTextPropertyModelConfig.createPropertyMeta({
    icon: createIcon('TextIcon'),

    cellRenderer: {
      view: createFromBaseCellRenderer(RichTextCell),
    },
  });
