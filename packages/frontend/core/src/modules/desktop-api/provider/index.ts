import { createIdentifier } from '@toeverything/infra';

export type AppInfo = {
  windowName?: string;
  viewId?: string;
  [key: string]: unknown;
};

export type ClientHandler = any;
export type ClientEvents = any;
export type SharedStorage = any;
export type TabViewsMetaSchema = {
  workbenches: Array<{ id: string; basename: string }>;
};

export interface DesktopApiProvider {
  handler?: ClientHandler;
  events?: ClientEvents;
  sharedStorage?: SharedStorage;
  appInfo: AppInfo;
}

export const DesktopApiProvider =
  createIdentifier<DesktopApiProvider>('DesktopApiProvider');
