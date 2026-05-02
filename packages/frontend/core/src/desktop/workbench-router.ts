import type { RouteObject } from 'react-router-dom';

export const workbenchRoutes = [
  {
    path: '/chat',
    lazy: () => import('./pages/workspace/chat/index'),
  },
  {
    path: '/all',
    lazy: () => import('./pages/workspace/all-page/all-page'),
  },
  {
    path: '/collection',
    lazy: () => import('./pages/workspace/all-collection'),
  },
  {
    path: '/collection/:collectionId',
    lazy: () => import('./pages/workspace/collection/index'),
  },
  {
    path: '/tag',
    lazy: () => import('./pages/workspace/all-tag'),
  },
  {
    path: '/tag/:tagId',
    lazy: () => import('./pages/workspace/tag'),
  },
  {
    path: '/container/:containerId',
    lazy: () => import('./pages/workspace/container'),
  },
  {
    path: '/knowledge-base/:knowledgeBaseId',
    lazy: () => import('./pages/workspace/knowledge-base'),
  },
  {
    path: '/trash',
    lazy: () => import('./pages/workspace/trash-page'),
  },
  {
    path: '/:pageId',
    lazy: () => import('./pages/workspace/detail-page/detail-page'),
  },
  {
    path: '/:pageId/attachments/:attachmentId',
    lazy: () => import('./pages/workspace/attachment/index'),
  },
  {
    path: '/journals',
    lazy: () => import('./pages/workspace/journals'),
  },
  {
    path: '/settings',
    lazy: () => import('./pages/workspace/settings'),
  },
  {
    path: '*',
    lazy: () => import('./pages/404'),
  },
] satisfies RouteObject[];
