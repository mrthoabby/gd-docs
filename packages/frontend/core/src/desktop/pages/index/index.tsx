import { WorkspacesService } from '@affine/core/modules/workspace';
import { createFirstAppData } from '@affine/core/utils/first-app-data';
import { useLiveData, useService } from '@toeverything/infra';
import { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';
import { WorkspaceNavigator } from '../../../components/workspace-selector';
import { AuthService } from '../../../modules/cloud';
import { AppContainer } from '../../components/app-container';

/**
 * index page
 *
 * Server-only index page. Workspaces are created on the current Docker backend.
 */
export const Component = ({
  defaultIndexRoute = 'all',
  children,
  fallback,
}: {
  defaultIndexRoute?: string;
  children?: ReactNode;
  fallback?: ReactNode;
}) => {
  // navigating and creating may be slow, to avoid flickering, we show workspace fallback
  const [navigating, setNavigating] = useState(true);
  const [creating, setCreating] = useState(false);
  const authService = useService(AuthService);

  const loggedIn = useLiveData(
    authService.session.status$.map(s => s === 'authenticated')
  );

  const workspacesService = useService(WorkspacesService);
  const list = useLiveData(workspacesService.list.workspaces$);
  const listIsLoading = useLiveData(workspacesService.list.isRevalidating$);

  const { openPage, jumpToPage, jumpToSignIn } = useNavigateHelper();

  useLayoutEffect(() => {
    if (!navigating) {
      return;
    }

    if (listIsLoading) {
      return;
    }

    if (!loggedIn) {
      localStorage.removeItem('last_workspace_id');
      jumpToSignIn();
      return;
    }

    if (list.length === 0) {
      setNavigating(false);
      return;
    }

    // open last workspace
    const lastId = localStorage.getItem('last_workspace_id');

    const openWorkspace = list.find(w => w.id === lastId) ?? list[0];
    openPage(openWorkspace.id, defaultIndexRoute, RouteLogic.REPLACE);
  }, [
    list,
    openPage,
    jumpToSignIn,
    listIsLoading,
    loggedIn,
    navigating,
    defaultIndexRoute,
  ]);

  useEffect(() => {
    if (listIsLoading || list.length > 0 || !loggedIn) {
      return;
    }

    setCreating(true);
    createFirstAppData(workspacesService)
      .then(createdWorkspace => {
        if (createdWorkspace) {
          if (createdWorkspace.defaultPageId) {
            jumpToPage(
              createdWorkspace.meta.id,
              createdWorkspace.defaultPageId
            );
          } else {
            openPage(createdWorkspace.meta.id, 'all');
          }
        }
      })
      .catch(err => {
        console.error('Failed to create first app data', err);
      })
      .finally(() => {
        setCreating(false);
      });
  }, [
    jumpToPage,
    jumpToSignIn,
    openPage,
    workspacesService,
    loggedIn,
    listIsLoading,
    list,
  ]);

  if (navigating || creating) {
    return fallback ?? <AppContainer fallback />;
  }

  // TODO(@eyhn): We need a no workspace page
  return (
    children ?? (
      <div
        style={{
          position: 'fixed',
          left: 'calc(50% - 150px)',
          top: '50%',
        }}
      >
        <WorkspaceNavigator
          open={true}
          menuContentOptions={{
            forceMount: true,
          }}
        />
      </div>
    )
  );
};
