import { DocProps, UserProps } from './components';
import { WorkspaceProps } from './components/workspace';

export const TEST_USER: UserProps = {
  email: 'test@test.com',
};

export const TEST_WORKSPACE: WorkspaceProps = {
  name: 'Test Workspace',
  avatar: '/favicon-192.png', // [SELFHOST PATCH] usa assets locales
};

export const TEST_DOC: DocProps = {
  title: 'Test Doc',
  url: '/', // [SELFHOST PATCH] usa URL relativa
};
