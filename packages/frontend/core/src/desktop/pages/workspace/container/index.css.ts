import { style } from '@vanilla-extract/css';

export const page = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--affine-background-primary-color)',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: '10px 24px',
  borderBottom: '1px solid var(--affine-border-color)',
});

export const titleInput = style({
  flex: 1,
  minWidth: 0,
  height: 32,
  border: '1px solid transparent',
  borderRadius: 6,
  padding: '0 8px',
  background: 'transparent',
  color: 'var(--affine-text-primary-color)',
  fontSize: 'var(--affine-font-h-6)',
  fontWeight: 600,
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: 'var(--affine-primary-color)',
      background: 'var(--affine-background-secondary-color)',
    },
  },
});

export const body = style({
  position: 'relative',
  flex: 1,
  minHeight: 0,
  padding: 24,
  overflow: 'auto',
  selectors: {
    '&[data-dragging="true"]': {
      outline: '2px solid var(--affine-primary-color)',
      outlineOffset: -2,
    },
  },
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const button = style({
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-secondary-color)',
  color: 'var(--affine-text-primary-color)',
  padding: '0 12px',
  cursor: 'pointer',
  fontSize: 'var(--affine-font-sm)',
  selectors: {
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const pathBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 32,
  marginBottom: 12,
  color: 'var(--affine-text-secondary-color)',
  fontSize: 'var(--affine-font-sm)',
});

export const pathButton = style({
  height: 28,
  border: 0,
  borderRadius: 6,
  padding: '0 8px',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&:not(:first-child)::before': {
      content: '"/"',
      marginRight: 8,
      color: 'var(--affine-text-disable-color)',
    },
    '&:hover, &[aria-current="page"]': {
      background: 'var(--affine-hover-color)',
      color: 'var(--affine-text-primary-color)',
    },
  },
});

export const primaryButton = style([
  button,
  {
    borderColor: 'var(--affine-primary-color)',
    background: 'var(--affine-primary-color)',
    color: 'var(--affine-pure-white)',
  },
]);

export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
});

export const th = style({
  height: 34,
  padding: '0 12px',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 'var(--affine-font-xs)',
  fontWeight: 500,
  textAlign: 'left',
  borderBottom: '1px solid var(--affine-border-color)',
});

export const td = style({
  height: 48,
  padding: '0 12px',
  color: 'var(--affine-text-primary-color)',
  fontSize: 'var(--affine-font-sm)',
  borderBottom: '1px solid var(--affine-border-color)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const nameCell = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  width: '100%',
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
});

export const rowActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
});

export const empty = style({
  height: 'calc(100% - 44px)',
  minHeight: 260,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 'var(--affine-font-base)',
});

export const dropOverlay = style({
  position: 'absolute',
  inset: 16,
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 8,
  border: '1px dashed var(--affine-primary-color)',
  background: 'var(--affine-background-primary-color)',
  boxShadow: 'var(--affine-shadow-2)',
  color: 'var(--affine-primary-color)',
  fontWeight: 600,
  pointerEvents: 'none',
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(0, 0, 0, 0.55)',
});

export const modal = style({
  position: 'fixed',
  zIndex: 1001,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(980px, calc(100vw - 48px))',
  height: 'min(720px, calc(100vh - 48px))',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-primary-color)',
  boxShadow: 'var(--affine-shadow-3)',
  overflow: 'hidden',
});

export const renameModal = style({
  position: 'fixed',
  zIndex: 1001,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(420px, calc(100vw - 48px))',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-primary-color)',
  boxShadow: 'var(--affine-shadow-3)',
  overflow: 'hidden',
});

export const modalHeader = style({
  height: 48,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 16px',
  borderBottom: '1px solid var(--affine-border-color)',
});

export const modalTitle = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 600,
});

export const modalBody = style({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--affine-background-secondary-color)',
});

export const renameBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
});

export const renameInput = style({
  width: '100%',
  height: 34,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  padding: '0 10px',
  color: 'var(--affine-text-primary-color)',
  background: 'var(--affine-background-primary-color)',
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: 'var(--affine-primary-color)',
    },
  },
});

export const modalFooter = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
});

export const image = style({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
});

export const pdf = style({
  width: '100%',
  height: '100%',
  border: 0,
  background: 'var(--affine-pure-white)',
});

export const editor = style({
  width: '100%',
  height: '100%',
  border: 0,
  resize: 'none',
  padding: 16,
  fontFamily: 'var(--affine-font-mono)',
  fontSize: 'var(--affine-font-sm)',
  lineHeight: 1.6,
  color: 'var(--affine-text-primary-color)',
  background: 'var(--affine-background-primary-color)',
  selectors: {
    '&:focus': {
      outline: 'none',
    },
  },
});

export const error = style({
  color: 'var(--affine-error-color)',
});
