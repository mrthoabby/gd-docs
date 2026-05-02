import { css } from 'lit';

export const listPrefix = css`
  .affine-list-block__prefix {
    display: flex;
    color: var(--affine-blue-700);
    font-size: var(--affine-font-sm);
    user-select: none;
    position: relative;
  }

  .affine-list-block__numbered {
    min-width: 22px;
    height: 24px;
    margin-left: 2px;
  }

  .affine-list-block__phase {
    width: 48px;
    min-width: 48px;
    height: 32px;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .affine-list-block__phase-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--affine-blue-700);
    color: var(--affine-white);
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    box-shadow: 0 0 0 4px var(--affine-background-primary-color);
  }

  .affine-list-block__todo-prefix {
    display: flex;
    align-items: center;
    cursor: pointer;
    width: 24px;
    height: 24px;
    color: var(--affine-icon-color);
  }

  .affine-list-block__todo-prefix.readonly {
    cursor: default;
  }

  .affine-list-block__todo-prefix > svg {
    width: 20px;
    height: 20px;
  }
`;

export const listBlockStyles = css`
  affine-list {
    display: block;
    font-size: var(--affine-font-base);
  }

  affine-list code {
    font-size: calc(var(--affine-font-base) - 3px);
    padding: 0px 4px 2px;
  }

  .affine-list-block-container {
    box-sizing: border-box;
    border-radius: 4px;
    position: relative;
  }
  .affine-list-block-container[data-list-type='phase'] {
    border-radius: 8px;
  }
  .affine-list-block-container[data-list-type='phase']::before {
    content: '';
    position: absolute;
    left: 24px;
    top: 0;
    bottom: -1px;
    width: 1px;
    background: var(--affine-border-color);
    pointer-events: none;
  }
  .affine-list-block-container[data-list-type='phase']
    > .affine-list-rich-text-wrapper {
    min-height: 48px;
    align-items: flex-start;
    padding: 8px 0;
  }
  .affine-list-block-container[data-list-type='phase']
    > .affine-list-rich-text-wrapper
    rich-text {
    padding-top: 3px;
    font-weight: 600;
  }
  .affine-list-block-container .affine-list-block-container {
    margin-top: 0;
  }
  .affine-list-rich-text-wrapper {
    position: relative;
    display: flex;
  }
  .affine-list-rich-text-wrapper rich-text {
    flex: 1;
  }

  .affine-list--checked {
    color: var(--affine-text-secondary-color);
  }

  ${listPrefix}
`;
