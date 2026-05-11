// the following import is used to ensure the block suite editor effects are run
import '../blocksuite/block-suite-editor';

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
