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
import { getViewportElement } from '@blocksuite/affine-shared/utils';
import { BaseCellRenderer } from '@blocksuite/data-view';
import { IS_MAC } from '@blocksuite/global/env';
import { LinkedPageIcon } from '@blocksuite/icons/lit';
import type { BlockSnapshot, DeltaInsert, Text } from '@blocksuite/store';
import { computed, signal } from '@preact/signals-core';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { html } from 'lit/static-html.js';

import { EditorHostKey } from '../../context/host-context.js';
import type { DatabaseBlockComponent } from '../../database-block.js';
import { getSingleDocIdFromText } from '../../utils/title-doc.js';
import { analyzeTextForUrlPaste, insertUrlTextSegments } from '../paste-url.js';
import {
  headerAreaIconStyle,
  titleCellStyle,
  titleRichTextStyle,
} from './cell-renderer-css.js';

export class HeaderAreaTextCell extends BaseCellRenderer<Text, string> {
  activity = true;

  docId$ = signal<string>();

  get host() {
    return this.view.serviceGet(EditorHostKey);
  }

  get inlineEditor() {
    return this.richText.value?.inlineEditor;
  }

  get inlineManager() {
    return this.host?.std.get(DefaultInlineManagerExtension.identifier);
  }

  get topContenteditableElement() {
    const databaseBlock =
      this.closest<DatabaseBlockComponent>('affine-database');
    return databaseBlock?.topContenteditableElement;
  }

  get std() {
    return this.view.serviceGet(EditorHostKey)?.std;
  }

  private _cellSlashMenuAbortController: AbortController | null = null;

  private _cellSlashStartIndex: number | null = null;

  private _closeCellSlashMenu() {
    this._cellSlashMenuAbortController?.abort();
    this._cellSlashMenuAbortController = null;
    this._cellSlashStartIndex = null;
  }

  private readonly _insertPillSelectFromSlash = () => {
    const inlineEditor = this.inlineEditor;
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
    const inlineEditor = this.inlineEditor;
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

  private readonly _onCopy = (e: ClipboardEvent) => {
    const inlineEditor = this.inlineEditor;
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
    const inlineEditor = this.inlineEditor;
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
    const inlineEditor = this.inlineEditor;
    const inlineRange = inlineEditor?.getInlineRange();
    if (!inlineEditor || !inlineRange) return;
    e.preventDefault();
    e.stopPropagation();
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

        // Track when a linked doc is created in database title column
        std?.getOptional(TelemetryProvider)?.track('LinkedDocCreated', {
          module: 'database title cell',
          type: 'paste',
          segment: 'database',
          parentFlavour: 'affine:database',
        });
        return;
      }
    }
    insertUrlTextSegments(inlineEditor, inlineRange, segments);
  };

  insertDelta = (delta: DeltaInsert) => {
    const inlineEditor = this.inlineEditor;
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

  override connectedCallback() {
    super.connectedCallback();
    this.classList.add(titleCellStyle);

    const yText = this.value?.yText;
    if (yText) {
      const cb = () => {
        const id = getSingleDocIdFromText(this.value);
        this.docId$.value = id;
      };
      cb();
      if (this.activity) {
        yText.observe(cb);
        this.disposables.add(() => {
          yText.unobserve(cb);
        });
      }
    }

    const selectAll = (e: KeyboardEvent) => {
      if (e.key === 'a' && (IS_MAC ? e.metaKey : e.ctrlKey)) {
        e.stopPropagation();
        e.preventDefault();
        this.inlineEditor?.selectAll();
      }
    };

    this.disposables.addFromEvent(this, 'keydown', selectAll);
    this.disposables.add(() => this._closeCellSlashMenu());
  }

  private readonly _handleKeyDown = (event: KeyboardEvent) => {
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

    if (event.key !== 'Escape') {
      if (event.key === 'Tab') {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
    }

    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      this._scheduleCellSlashMenu();
    }
  };

  override firstUpdated(props: Map<string, unknown>) {
    super.firstUpdated(props);
    this.richText.value?.updateComplete
      .then(() => {
        if (this.richText.value) {
          this.disposables.addFromEvent(
            this.richText.value,
            'copy',
            this._onCopy
          );
          this.disposables.addFromEvent(
            this.richText.value,
            'cut',
            this._onCut
          );
          this.disposables.addFromEvent(
            this.richText.value,
            'paste',
            this._onPaste,
            true
          );
          this.disposables.addFromEvent(
            this.richText.value,
            'keyup',
            this._onRichTextKeyUp,
            true
          );
          this.disposables.addFromEvent(
            this.richText.value,
            'input',
            this._onRichTextInput,
            true
          );
          const inlineEditor = this.inlineEditor;
          if (inlineEditor) {
            this.disposables.add(
              inlineEditor.slots.keydown.subscribe(this._handleKeyDown)
            );
          }
        }
      })
      .catch(console.error);
  }

  override afterEnterEditingMode() {
    this.inlineEditor?.focusEnd();
  }

  protected override render(): unknown {
    return html`${this.renderIcon()}${this.renderBlockText()}`;
  }

  renderBlockText() {
    return html` <rich-text
      ${ref(this.richText)}
      data-disable-ask-ai
      data-not-block-text
      .yText="${this.value}"
      .inlineEventSource="${this.topContenteditableElement}"
      .attributesSchema="${this.inlineManager?.getSchema()}"
      .attributeRenderer="${this.inlineManager?.getRenderer()}"
      .embedChecker="${this.inlineManager?.embedChecker}"
      .markdownMatches="${this.inlineManager?.markdownMatches}"
      .readonly="${!this.isEditing$.value}"
      .enableClipboard="${false}"
      .verticalScrollContainerGetter="${() =>
        this.topContenteditableElement?.host
          ? getViewportElement(this.topContenteditableElement.host)
          : null}"
      data-parent-flavour="affine:database"
      class="${titleRichTextStyle}"
    ></rich-text>`;
  }
  icon$ = computed(() => {
    const iconColumn = this.view.mainProperties$.value.iconColumn;
    if (!iconColumn) return;

    const icon = this.view.cellGetOrCreate(this.cell.rowId, iconColumn).value$
      .value;
    if (!icon) return;
    return icon;
  });
  renderIcon() {
    if (!this.showIcon) {
      return;
    }
    if (this.docId$.value) {
      return html` <div class="${headerAreaIconStyle}">
        ${LinkedPageIcon({})}
      </div>`;
    }
    const icon = this.icon$.value;
    if (!icon) return;

    return html` <div class="${headerAreaIconStyle}">${icon}</div>`;
  }

  private readonly richText = createRef<RichText>();

  @property({ attribute: false })
  accessor showIcon = false;
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-area-text': HeaderAreaTextCell;
  }
}
