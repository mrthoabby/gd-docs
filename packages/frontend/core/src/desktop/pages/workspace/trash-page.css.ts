import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';
export const trashTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 8px',
  fontWeight: 600,
  userSelect: 'none',
});
export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  height: '100%',
  width: '100%',
});
export const trashIcon = style({
  color: cssVar('iconColor'),
  fontSize: cssVar('fontH5'),
});

export const containerTrash = style({
  padding: '12px 24px',
  borderTop: `1px solid ${cssVar('borderColor')}`,
});

export const containerTrashTitle = style({
  marginBottom: 8,
  color: cssVar('textSecondaryColor'),
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
});

export const containerTrashRow = style({
  height: 40,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  color: cssVar('textPrimaryColor'),
});

export const containerTrashName = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

export const containerTrashButton = style({
  height: 28,
  borderRadius: 6,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundSecondaryColor'),
  color: cssVar('textPrimaryColor'),
  padding: '0 10px',
  cursor: 'pointer',
});
