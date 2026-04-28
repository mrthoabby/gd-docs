import { cssVar } from '@toeverything/theme';
import { globalStyle, style } from '@vanilla-extract/css';

export const authMessage = style({
  color: cssVar('textSecondaryColor'),
  fontSize: cssVar('fontXs'),
  lineHeight: '20px',
});

globalStyle(`${authMessage} a`, {
  color: cssVar('linkColor'),
});

globalStyle(`${authMessage} .link`, {
  cursor: 'pointer',
  color: cssVar('linkColor'),
});

export const captchaWrapper = style({
  margin: 'auto',
  marginBottom: '4px',
  textAlign: 'center',
});

export const passwordButtonRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '30px',
});

export const linkButton = style({
  color: cssVar('linkColor'),
  background: 'transparent',
  borderColor: 'transparent',
  fontSize: cssVar('fontXs'),
  lineHeight: '22px',
  userSelect: 'none',
});


export const skipSection = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

export const authInput = style({
  backgroundColor: cssVarV2.button.signinbutton.background,
});

export const signInButton = style({
  backgroundColor: cssVarV2.button.signinbutton.background,
});
