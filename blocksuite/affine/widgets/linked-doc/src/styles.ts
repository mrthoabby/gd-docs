import { scrollbarStyle } from '@blocksuite/affine-shared/styles';
import { unsafeCSSVar, unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import { baseTheme } from '@toeverything/theme';
import { css, unsafeCSS } from 'lit';

export const linkedDocWidgetStyles = css`
  .input-mask {
    position: absolute;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
`;

export const linkedDocPopoverStyles = css`
  :host {
    position: absolute;
  }

  .linked-doc-popover {
    position: fixed;
    left: 0;
    top: 0;
    box-sizing: border-box;
    font-family: ${unsafeCSS(baseTheme.fontSansFamily)};
    font-size: var(--affine-font-base);
    padding: 8px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    gap: 4px;

    background: ${unsafeCSSVarV2('layer/background/primary')};
    box-shadow: ${unsafeCSSVar('overlayPanelShadow')};
    border-radius: 4px;
    z-index: var(--affine-z-index-popover);
  }

  .linked-doc-popover icon-button {
    justify-content: flex-start;
    gap: 12px;
    padding: 0 8px;
  }

  .linked-doc-popover .group-title {
    color: var(--affine-text-secondary-color);
    padding: 0 8px;
    height: 30px;
    font-size: var(--affine-font-xs);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    font-weight: 500;
    justify-content: space-between;
    max-width: 240px;
  }

  .linked-doc-popover .group-title .group-title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .linked-doc-popover .group-title .loading-icon {
    display: flex;
    align-items: center;
    margin-left: 8px;
  }

  .linked-doc-popover .group-title .loading-icon svg {
    width: 20px;
    height: 20px;
  }

  .linked-doc-popover .divider {
    border-top: 0.5px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
  }

  .group icon-button svg,
  .group icon-button .icon {
    width: 20px;
    height: 20px;
  }
  .group icon-button .icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .linked-doc-popover .group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  ${scrollbarStyle('.linked-doc-popover')}
`;
