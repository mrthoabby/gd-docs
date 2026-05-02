import '@blocksuite/affine-shared/commands';

import { CaptionedBlockComponent } from '@blocksuite/affine-components/caption';
import { playCheckAnimation } from '@blocksuite/affine-components/icons';
import { createLitPortal } from '@blocksuite/affine-components/portal';
import { TOGGLE_BUTTON_PARENT_CLASS } from '@blocksuite/affine-components/toggle-button';
import { DefaultInlineManagerExtension } from '@blocksuite/affine-inline-preset';
import type { ListBlockModel } from '@blocksuite/affine-model';
import type { RichText } from '@blocksuite/affine-rich-text';
import {
  BLOCK_CHILDREN_CONTAINER_PADDING_LEFT,
  EDGELESS_TOP_CONTENTEDITABLE_SELECTOR,
} from '@blocksuite/affine-shared/consts';
import { DocModeProvider } from '@blocksuite/affine-shared/services';
import {
  getViewportElement,
  isOrderedListType,
} from '@blocksuite/affine-shared/utils';
import type { BlockComponent } from '@blocksuite/std';
import { BlockSelection, TextSelection } from '@blocksuite/std';
import {
  getInlineRangeProvider,
  type InlineRangeProvider,
} from '@blocksuite/std/inline';
import type { BaseSelection } from '@blocksuite/store';
import { effect } from '@preact/signals-core';
import { html, nothing, type TemplateResult } from 'lit';
import { query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { correctNumberedListsOrderToPrev } from './commands/utils.js';
import { listBlockStyles } from './styles.js';
import { getListIcon } from './utils/get-list-icon.js';

const PHASE_LIST_COLORS = [
  '#1e96eb',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#64748b',
] as const;

export class ListBlockComponent extends CaptionedBlockComponent<ListBlockModel> {
  static override styles = listBlockStyles;

  private _inlineRangeProvider: InlineRangeProvider | null = null;

  private _phaseColorMenuAbortController: AbortController | null = null;

  private readonly _onClickIcon = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (this.model.props.type === 'phase') {
      if (this.store.readonly) return;
      this._openPhaseColorMenu(e.currentTarget as HTMLElement);
      return;
    }

    if (this.model.props.type === 'toggle') {
      if (this.store.readonly) {
        this._readonlyCollapsed = !this._readonlyCollapsed;
      } else {
        this.store.captureSync();
        this.store.updateBlock(this.model, {
          collapsed: !this.model.props.collapsed,
        });
      }

      return;
    } else if (this.model.props.type === 'todo') {
      if (this.store.readonly) return;

      this.store.captureSync();
      const checkedPropObj = { checked: !this.model.props.checked };
      this.store.updateBlock(this.model, checkedPropObj);
      if (this.model.props.checked) {
        const checkEl = this.querySelector('.affine-list-block__todo-prefix');
        if (checkEl) {
          playCheckAnimation(checkEl).catch(console.error);
        }
      }
      return;
    }
    this._select();
  };

  private _openPhaseColorMenu(referenceElement: HTMLElement) {
    this._phaseColorMenuAbortController?.abort();
    this._phaseColorMenuAbortController = new AbortController();

    const abortController = this._phaseColorMenuAbortController;
    const currentColor =
      this.model.props.phaseColor ?? PHASE_LIST_COLORS[0];
    const selectColor = (color: string) => {
      this.store.captureSync();
      this.store.updateBlock(this.model, {
        phaseColor: color,
      });
      abortController.abort();
    };

    const { portal } = createLitPortal({
      template: html`<div
        role="menu"
        aria-label="Phase color"
        style="display:flex;gap:6px;padding:8px;border:0.5px solid var(--affine-border-color);border-radius:8px;background:var(--affine-background-overlay-panel-color);box-shadow:0 6px 16px rgba(0,0,0,.14);"
      >
        ${PHASE_LIST_COLORS.map(
          color => html`<button
            type="button"
            aria-label=${`Set phase color ${color}`}
            aria-pressed=${color === currentColor}
            style=${`width:24px;height:24px;border-radius:50%;border:${color === currentColor ? '2px solid var(--affine-text-primary-color)' : '1px solid var(--affine-border-color)'};background:${color};cursor:pointer;`}
            @click=${() => selectColor(color)}
          ></button>`
        )}
      </div>`,
      container: this.host,
      computePosition: {
        referenceElement,
        placement: 'bottom-start',
        autoUpdate: {
          animationFrame: true,
        },
      },
      closeOnClickAway: true,
      abortController,
      shadowDom: false,
      portalStyles: {
        zIndex: 'var(--affine-z-index-popover)',
      },
    });

    abortController.signal.addEventListener(
      'abort',
      () => portal.remove(),
      { once: true }
    );
  }

  get attributeRenderer() {
    return this.inlineManager.getRenderer();
  }

  get attributesSchema() {
    return this.inlineManager.getSchema();
  }

  get embedChecker() {
    return this.inlineManager.embedChecker;
  }

  get inlineManager() {
    return this.std.get(DefaultInlineManagerExtension.identifier);
  }

  override get topContenteditableElement() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return this.closest<BlockComponent>(
        EDGELESS_TOP_CONTENTEDITABLE_SELECTOR
      );
    }
    return this.rootComponent;
  }

  private _select() {
    const selection = this.host.selection;
    selection.update(selList => {
      return selList
        .filter<BaseSelection>(
          sel => !sel.is(TextSelection) && !sel.is(BlockSelection)
        )
        .concat(selection.create(BlockSelection, { blockId: this.blockId }));
    });
  }

  override connectedCallback() {
    super.connectedCallback();

    this._inlineRangeProvider = getInlineRangeProvider(this);

    this.disposables.add(
      effect(() => {
        const collapsed = this.model.props.collapsed$.value;
        this._readonlyCollapsed = collapsed;
      })
    );

    this.disposables.add(
      effect(() => {
        const type = this.model.props.type$.value;
        const order = this.model.props.order$.value;
        // old ordered lists may have no order
        if (isOrderedListType(type) && !Number.isInteger(order)) {
          correctNumberedListsOrderToPrev(this.store, this.model, false);
        }
        // if list is not ordered, order should be null
        if (!isOrderedListType(type) && order !== null) {
          this.model.props.order = null;
        }
      })
    );
  }

  override async getUpdateComplete() {
    const result = await super.getUpdateComplete();
    await this._richTextElement?.updateComplete;
    return result;
  }

  override renderBlock(): TemplateResult<1> {
    const { model, _onClickIcon } = this;
    const widgets = html`${repeat(
      Object.entries(this.widgets),
      ([id]) => id,
      ([_, widget]) => widget
    )}`;
    const collapsed = this.store.readonly
      ? this._readonlyCollapsed
      : model.props.collapsed;

    const listIcon = getListIcon(model, !collapsed, _onClickIcon);

    const textAlignStyle = styleMap({
      textAlign: this.model.props.textAlign$?.value,
      '--affine-phase-list-color':
        this.model.props.phaseColor ?? 'var(--affine-blue-700)',
    });

    const children = html`<div
      class="affine-block-children-container"
      style=${styleMap({
        paddingLeft:
          this.model.props.type === 'phase'
            ? '64px'
            : `${BLOCK_CHILDREN_CONTAINER_PADDING_LEFT}px`,
        display: collapsed ? 'none' : undefined,
      })}
    >
      ${this.renderChildren(this.model)}
    </div>`;

    return html`
      <div
        class=${'affine-list-block-container'}
        data-list-type=${this.model.props.type}
        data-list-order=${this.model.props.order ?? ''}
        data-collapsed=${collapsed}
        style="${textAlignStyle}"
      >
        <div
          class=${classMap({
            'affine-list-rich-text-wrapper': true,
            'affine-list--checked':
              this.model.props.type === 'todo' && this.model.props.checked,
            'affine-list--phase': this.model.props.type === 'phase',
            [TOGGLE_BUTTON_PARENT_CLASS]: true,
          })}
        >
          ${this.model.children.length > 0
            ? html`
                <blocksuite-toggle-button
                  .collapsed=${collapsed}
                  .updateCollapsed=${(value: boolean) => {
                    if (this.store.readonly) {
                      this._readonlyCollapsed = value;
                    } else {
                      this.store.captureSync();
                      this.store.updateBlock(this.model, {
                        collapsed: value,
                      });
                    }
                  }}
                ></blocksuite-toggle-button>
              `
            : nothing}
          ${listIcon}
          <rich-text
            .yText=${this.model.props.text.yText}
            .inlineEventSource=${this.topContenteditableElement ?? nothing}
            .undoManager=${this.store.history.undoManager}
            .attributeRenderer=${this.attributeRenderer}
            .attributesSchema=${this.attributesSchema}
            .markdownMatches=${this.inlineManager?.markdownMatches}
            .embedChecker=${this.embedChecker}
            .readonly=${this.store.readonly}
            .inlineRangeProvider=${this._inlineRangeProvider}
            .enableClipboard=${false}
            .enableUndoRedo=${false}
            .verticalScrollContainerGetter=${() =>
              getViewportElement(this.host)}
          ></rich-text>
        </div>

        ${children} ${widgets}
      </div>
    `;
  }

  @state()
  private accessor _readonlyCollapsed = false;

  @query('rich-text')
  private accessor _richTextElement: RichText | null = null;

  override accessor blockContainerStyles = {
    margin: 'var(--affine-list-margin, 10px 0)',
  };
}
