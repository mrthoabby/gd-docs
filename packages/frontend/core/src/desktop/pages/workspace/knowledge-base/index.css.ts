import { style } from '@vanilla-extract/css';

export const page = style({
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  background: 'var(--affine-background-primary-color)',
  '@media': {
    'screen and (max-width: 920px)': {
      gridTemplateColumns: '1fr',
    },
  },
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

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const main = style({
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: '1fr auto',
  padding: 24,
  gap: 16,
  overflow: 'hidden',
});

export const answerArea = style({
  minHeight: 0,
  overflow: 'auto',
  border: '1px solid var(--affine-border-color)',
  borderRadius: 8,
  background: 'var(--affine-background-secondary-color)',
  padding: 16,
});

export const empty = style({
  height: '100%',
  minHeight: 220,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 'var(--affine-font-base)',
  textAlign: 'center',
});

export const answer = style({
  whiteSpace: 'pre-wrap',
  lineHeight: 1.6,
  color: 'var(--affine-text-primary-color)',
  fontSize: 'var(--affine-font-base)',
});

export const prompt = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 8,
});

export const textarea = style({
  minHeight: 72,
  resize: 'vertical',
  borderRadius: 8,
  border: '1px solid var(--affine-border-color)',
  padding: 10,
  background: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
  fontSize: 'var(--affine-font-sm)',
  lineHeight: 1.5,
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: 'var(--affine-primary-color)',
    },
  },
});

export const sidebar = style({
  minHeight: 0,
  borderLeft: '1px solid var(--affine-border-color)',
  padding: 24,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  '@media': {
    'screen and (max-width: 920px)': {
      borderLeft: 0,
      borderTop: '1px solid var(--affine-border-color)',
    },
  },
});

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const sectionTitle = style({
  color: 'var(--affine-text-primary-color)',
  fontSize: 'var(--affine-font-sm)',
  fontWeight: 600,
});

export const muted = style({
  color: 'var(--affine-text-secondary-color)',
  fontSize: 'var(--affine-font-xs)',
  lineHeight: 1.5,
});

export const sourceList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const sourceRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minHeight: 36,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'var(--affine-background-secondary-color)',
});

export const sourceName = style({
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  color: 'var(--affine-text-primary-color)',
  fontSize: 'var(--affine-font-sm)',
});

export const sourceMeta = style({
  color: 'var(--affine-text-secondary-color)',
  fontSize: 'var(--affine-font-xs)',
});

export const field = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--affine-text-primary-color)',
  fontSize: 'var(--affine-font-sm)',
});

export const numberInput = style({
  width: 72,
  height: 30,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
  padding: '0 8px',
});

export const button = style({
  height: 34,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-secondary-color)',
  color: 'var(--affine-text-primary-color)',
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
  fontSize: 'var(--affine-font-sm)',
  whiteSpace: 'nowrap',
  selectors: {
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
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

export const selectionAction = style({
  position: 'fixed',
  zIndex: 1002,
  height: 32,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
  boxShadow: 'var(--affine-shadow-2)',
  padding: '0 10px',
  cursor: 'pointer',
  fontSize: 'var(--affine-font-sm)',
});

export const error = style({
  color: 'var(--affine-error-color)',
  fontSize: 'var(--affine-font-sm)',
});
