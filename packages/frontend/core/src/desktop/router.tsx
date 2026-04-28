import { useEffect, useState } from 'react';
import type { RouteObject } from 'react-router-dom';
import {
  createBrowserRouter as reactRouterCreateBrowserRouter,
  redirect,
  useNavigate,
} from 'react-router-dom';

import { AffineErrorComponent } from '../components/affine/affine-error-boundary/affine-error-fallback';
import { NavigateContext } from '../components/hooks/use-navigate-helper';
import { RootWrapper } from './pages/root';
import {
  CATCH_ALL_ROUTE_PATH,
  getWorkspaceDocPath,
  NOT_FOUND_ROUTE_PATH,
  SHARE_ROUTE_PATH,
  WORKSPACE_ROUTE_PATH,
} from './route-paths';

export function RootRouter() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // a hack to make sure router is ready
    setReady(true);
  }, []);

  return (
    ready && (
      <NavigateContext.Provider value={navigate}>
        <RootWrapper />
      </NavigateContext.Provider>
    )
  );
}

export const topLevelRoutes = [
  {
    element: <RootRouter />,
    errorElement: <AffineErrorComponent />,
    children: [
      {
        path: '/',
        lazy: () => import('./pages/index'),
      },
      {
        path: WORKSPACE_ROUTE_PATH,
        lazy: () => import('./pages/workspace/index'),
      },
      {
        path: SHARE_ROUTE_PATH,
        loader: ({ params }) => {
          return redirect(
            getWorkspaceDocPath(params.workspaceId ?? '', params.pageId ?? '')
          );
        },
      },
      {
        path: NOT_FOUND_ROUTE_PATH,
        lazy: () => import('./pages/404'),
      },
      {
        path: '/expired',
        lazy: () => import('./pages/expired'),
      },
      {
        path: '/invite/:inviteId',
        lazy: () => import('./pages/invite'),
      },
      {
        path: '/redirect-proxy',
        lazy: () => import('./pages/redirect'),
      },
      {
        path: '/theme-editor',
        lazy: () => import('./pages/theme-editor'),
      },
      {
        path: '/clipper/import',
        lazy: () => import('./pages/import-clipper'),
      },
      {
        path: '/auth/:authType',
        lazy: () => import(/* webpackChunkName: "auth" */ './pages/auth/auth'),
      },
      {
        path: '/sign-In',
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/sign-in'),
      },
      {
        path: '/magic-link',
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/magic-link'),
      },
      {
        path: '/oauth/login',
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/oauth-login'),
      },
      {
        path: '/oauth/callback',
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/oauth-callback'),
      },
      // deprecated, keep for old client compatibility
      // use '/sign-in'
      // TODO(@forehalo): remove
      {
        path: '/signIn',
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/sign-in'),
      },
      {
        path: CATCH_ALL_ROUTE_PATH,
        lazy: () => import('./pages/404'),
      },
    ],
  },
] satisfies [RouteObject, ...RouteObject[]];

export const router = reactRouterCreateBrowserRouter(topLevelRoutes, {
  basename: environment.subPath,
  future: {
    v7_normalizeFormMethod: true,
  },
});
