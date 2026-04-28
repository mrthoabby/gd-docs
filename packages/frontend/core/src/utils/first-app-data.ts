// the following import is used to ensure the block suite editor effects are run
import '../blocksuite/block-suite-editor';

import { DebugLogger } from '@affine/debug';
import { DEFAULT_WORKSPACE_NAME } from '@affine/env/constant';

import { DocsService } from '../modules/doc';
import { type WorkspacesService } from '../modules/workspace';

export async function buildShowcaseWorkspace(
  workspacesService: WorkspacesService,
  flavour: string,
  workspaceName: string
) {
  const meta = await workspacesService.create(flavour, async docCollection => {
    docCollection.meta.initialize();
    docCollection.doc.getMap('meta').set('name', workspaceName);
  });

  const { workspace, dispose } = workspacesService.open({ metadata: meta });

  await workspace.engine.doc.waitForDocReady(workspace.id);

  const docsService = workspace.scope.get(DocsService);
  const defaultDoc = docsService.createDoc();

  dispose();

  return { meta, defaultDocId: defaultDoc.id };
}

const logger = new DebugLogger('createFirstAppData');

export async function createFirstAppData(workspacesService: WorkspacesService) {
  const { meta, defaultDocId } = await buildShowcaseWorkspace(
    workspacesService,
    'affine-cloud',
    DEFAULT_WORKSPACE_NAME
  );
  logger.info('create first workspace', defaultDocId);
  return { meta, defaultPageId: defaultDocId };
}
