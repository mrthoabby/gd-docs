import type { WorkspaceMetadata } from '../workspace';

export type SettingTab =
  | 'shortcuts'
  | 'notifications'
  | 'appearance'
  | 'about'
  | 'experimental-features'
  | 'editor'
  | 'account'
  | `workspace:${'preference' | 'properties' | 'members' | 'storage' | 'embedding' | 'search'}`;

export type GLOBAL_DIALOG_SCHEMA = {
  'create-workspace': (props: { serverId?: string }) => {
    metadata: WorkspaceMetadata;
    defaultDocId?: string;
  };
  'import-workspace': () => {
    workspace: WorkspaceMetadata;
  };
  'sign-in': (props: { server?: string; step?: string }) => void;
  'change-password': (props: { server?: string }) => void;
  'verify-email': (props: { server?: string; changeEmail?: boolean }) => void;
  'deleted-account': () => void;
};

export type WORKSPACE_DIALOG_SCHEMA = {
  setting: (props: { activeTab?: SettingTab; scrollAnchor?: string }) => void;
  'doc-info': (props: { docId: string }) => void;
  'doc-selector': (props: {
    init: string[];
    onBeforeConfirm?: (ids: string[], cb: () => void) => void;
  }) => string[];
  'collection-selector': (props: {
    init: string[];
    onBeforeConfirm?: (ids: string[], cb: () => void) => void;
  }) => string[];
  'collection-editor': (props: {
    collectionId: string;
    mode?: 'page' | 'rule';
  }) => void;
  'tag-selector': (props: {
    init: string[];
    onBeforeConfirm?: (ids: string[], cb: () => void) => void;
  }) => string[];
  'date-selector': (props: {
    position?: [number, number, number, number]; // [x, y, width, height]
    onSelect?: (date?: string) => void;
  }) => string;
  import: () => {
    docIds: string[];
    entryId?: string;
    isWorkspaceFile?: boolean;
  };
};
