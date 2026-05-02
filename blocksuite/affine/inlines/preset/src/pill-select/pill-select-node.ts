import { createLitPortal } from '@blocksuite/affine-components/portal';
import { unsafeCSSVar } from '@blocksuite/affine-shared/theme';
import type {
  AffineTextAttributes,
  PillSelectData,
  PillSelectOption,
} from '@blocksuite/affine-shared/types';
import { WithDisposable } from '@blocksuite/global/lit';
import {
  type BlockComponent,
  type BlockStdScope,
  ShadowlessElement,
} from '@blocksuite/std';
import {
  type InlineEditor,
  ZERO_WIDTH_FOR_EMBED_NODE,
} from '@blocksuite/std/inline';
import type { DeltaInsert } from '@blocksuite/store';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import {
  createPillSelectOption,
  getNextPillSelectColor,
  getSelectedPillSelectOption,
  normalizePillSelect,
  PILL_SELECT_COLORS,
  sanitizePillSelectLabel,
} from './utils';

export class AffinePillSelectNode extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    affine-pill-select-node {
      display: inline-block;
      vertical-align: baseline;
    }

    affine-pill-select-node .affine-pill-select {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 22px;
      min-width: 42px;
      padding: 1px 8px;
      margin: 0 2px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--pill-select-color) 36%, transparent);
      background: color-mix(in srgb, var(--pill-select-color) 15%, transparent);
      color: ${unsafeCSSVar('textPrimaryColor')};
      font-family: ${unsafeCSSVar('fontSansFamily')};
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      white-space: nowrap;
      user-select: none;
      cursor: pointer;
    }

    affine-pill-select-node .affine-pill-select[data-empty='true'] {
      border-color: ${unsafeCSSVar('borderColor')};
      background: ${unsafeCSSVar('hoverColor')};
    }

    affine-pill-select-node .affine-pill-select:hover,
    affine-pill-select-node .affine-pill-select[data-selected='true'] {
      background: color-mix(in srgb, var(--pill-select-color) 24%, transparent);
    }

    affine-pill-select-node .pill-select-dot {
      width: 8px;
      height: 8px;
      flex: none;
      border-radius: 50%;
      background: var(--pill-select-color);
    }

    affine-pill-select-node .pill-select-label {
      min-width: 10px;
    }

    affine-pill-select-node .pill-select-chevron {
      color: ${unsafeCSSVar('placeholderColor')};
      font-size: 12px;
      line-height: 1;
      transform: translateY(-1px);
    }

    .pill-select-menu {
      width: 280px;
      padding: 6px;
      border-radius: 8px;
      border: 0.5px solid ${unsafeCSSVar('borderColor')};
      background: ${unsafeCSSVar('backgroundOverlayPanelColor')};
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
      color: ${unsafeCSSVar('textPrimaryColor')};
      font-family: ${unsafeCSSVar('fontSansFamily')};
    }

    .pill-select-option {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      padding: 2px 6px;
      border-radius: 6px;
    }

    .pill-select-option[data-selected='true'] {
      background: ${unsafeCSSVar('hoverColor')};
    }

    .color-button,
    .remove-button,
    .add-option,
    .select-target {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    .color-button {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      cursor: pointer;
    }

    .color-button:hover,
    .remove-button:hover,
    .add-option:hover {
      background: ${unsafeCSSVar('hoverColor')};
    }

    .option-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--pill-select-color);
    }

    .option-label {
      min-width: 0;
      height: 28px;
      padding: 0 6px;
      border: 1px solid transparent;
      border-radius: 5px;
      background: transparent;
      color: inherit;
      font: inherit;
      outline: none;
    }

    .option-label:focus {
      border-color: ${unsafeCSSVar('blue700')};
      background: ${unsafeCSSVar('white10')};
    }

    .select-target {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      color: ${unsafeCSSVar('placeholderColor')};
    }

    .select-target:hover {
      color: ${unsafeCSSVar('textPrimaryColor')};
      background: ${unsafeCSSVar('hoverColor')};
    }

    .add-option {
      width: 100%;
      height: 32px;
      margin-top: 4px;
      padding: 0 8px;
      border-radius: 6px;
      text-align: left;
      cursor: pointer;
      color: ${unsafeCSSVar('textSecondaryColor')};
    }
  `;

  private _editorAbortController: AbortController | null = null;

  private get _data() {
    return normalizePillSelect(this.delta.attributes?.pillSelect);
  }

  private get _selectedOption() {
    return getSelectedPillSelectOption(this._data);
  }

  private get _readonly() {
    return Boolean((this as unknown as { readonly?: boolean }).readonly);
  }

  private _commit(data: PillSelectData) {
    this.editor.formatText(
      {
        index: this.startOffset,
        length: this.endOffset - this.startOffset,
      },
      {
        pillSelect: normalizePillSelect(data),
      }
    );
  }

  override connectedCallback() {
    const result = super.connectedCallback();

    this.disposables.addFromEvent(this, 'click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (this._readonly) return;
      this.toggleEditor();
    });

    return result;
  }

  override render() {
    const option = this._selectedOption;
    const style = `--pill-select-color:${option?.color ?? 'var(--affine-icon-color)'};`;

    return html`<span
      class="affine-pill-select"
      data-selected=${this.selected}
      data-empty=${!option}
      aria-label=${option ? option.label : 'Empty pill select'}
      style=${style}
    >
      <span class="pill-select-dot"></span>
      <span class="pill-select-label">${option?.label ?? ''}</span>
      <span class="pill-select-chevron">⌄</span>
      <v-text .str=${ZERO_WIDTH_FOR_EMBED_NODE}></v-text>
    </span>`;
  }

  toggleEditor() {
    const blockComponent = this.closest<BlockComponent>('[data-block-id]');
    if (!blockComponent) return;

    this._editorAbortController?.abort();
    this._editorAbortController = new AbortController();

    blockComponent.selection.setGroup('note', []);

    const { portal } = createLitPortal({
      template: html`<affine-pill-select-menu
        .data=${this._data}
        .abortController=${this._editorAbortController}
        .onChange=${(data: PillSelectData) => this._commit(data)}
      ></affine-pill-select-menu>`,
      container: blockComponent.host,
      computePosition: {
        referenceElement: this,
        placement: 'bottom-start',
        autoUpdate: {
          animationFrame: true,
        },
      },
      closeOnClickAway: true,
      abortController: this._editorAbortController,
      shadowDom: false,
      portalStyles: {
        zIndex: 'var(--affine-z-index-popover)',
      },
    });

    this._editorAbortController.signal.addEventListener(
      'abort',
      () => {
        portal.remove();
        this.editor.setInlineRange({
          index: this.endOffset,
          length: 0,
        });
      },
      { once: true }
    );
  }

  @property({ attribute: false })
  accessor delta!: DeltaInsert<AffineTextAttributes>;

  @property({ attribute: false })
  accessor editor!: InlineEditor<AffineTextAttributes>;

  @property({ attribute: false })
  accessor endOffset!: number;

  @property({ attribute: false })
  accessor selected!: boolean;

  @property({ attribute: false })
  accessor startOffset!: number;

  @property({ attribute: false })
  accessor std!: BlockStdScope;
}

export class AffinePillSelectMenu extends ShadowlessElement {
  static override styles = AffinePillSelectNode.styles;

  private _commit(data: PillSelectData) {
    const normalized = normalizePillSelect(data);
    this.data = normalized;
    this.onChange?.(normalized);
  }

  private _selectOption(optionId: string) {
    this._commit({
      ...this.data,
      selectedOptionId: optionId,
    });
  }

  private _renameOption(option: PillSelectOption, label: string) {
    this._commit({
      ...this.data,
      options: this.data.options.map(item =>
        item.id === option.id
          ? { ...item, label: sanitizePillSelectLabel(label) }
          : item
      ),
    });
  }

  private _cycleOptionColor(option: PillSelectOption) {
    this._commit({
      ...this.data,
      options: this.data.options.map(item =>
        item.id === option.id
          ? { ...item, color: getNextPillSelectColor(item.color) }
          : item
      ),
    });
  }

  private _addOption() {
    const option = createPillSelectOption(
      `Option ${this.data.options.length + 1}`,
      PILL_SELECT_COLORS[this.data.options.length % PILL_SELECT_COLORS.length]
    );

    this._commit({
      ...this.data,
      selectedOptionId: option.id,
      options: [...this.data.options, option],
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    this.data = normalizePillSelect(this.data);

    this.addEventListener('pointerdown', e => e.stopPropagation());
    this.addEventListener('pointerup', e => e.stopPropagation());
    this.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.abortController.abort();
      }
    });
  }

  override render() {
    return html`<div
      class="pill-select-menu"
      role="listbox"
      aria-label="Pill select options"
    >
      ${this.data.options.map(
        option => html`<div
          class="pill-select-option"
          data-selected=${option.id === this.data.selectedOptionId}
          role="option"
          aria-selected=${option.id === this.data.selectedOptionId}
        >
          <button
            class="color-button"
            aria-label="Change option color"
            style=${`--pill-select-color:${option.color};`}
            @click=${() => this._cycleOptionColor(option)}
          >
            <span class="option-dot"></span>
          </button>
          <input
            class="option-label"
            .value=${option.label}
            aria-label="Option name"
            @change=${(event: Event) =>
              this._renameOption(
                option,
                (event.target as HTMLInputElement).value
              )}
          />
          <button
            class="select-target"
            aria-label="Select option"
            @click=${() => this._selectOption(option.id)}
          >
            ${option.id === this.data.selectedOptionId ? '✓' : ''}
          </button>
        </div>`
      )}
      <button class="add-option" @click=${this._addOption}>+ Add option</button>
    </div>`;
  }

  @property({ attribute: false })
  accessor abortController!: AbortController;

  @property({ attribute: false })
  accessor data!: PillSelectData;

  @property({ attribute: false })
  accessor onChange?: (data: PillSelectData) => void;
}
