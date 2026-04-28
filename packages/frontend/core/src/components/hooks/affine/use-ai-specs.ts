import { useConfirmModal, useLitPortalFactory } from '@affine/component';
import { getViewManager } from '@affine/core/blocksuite/manager/view';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import { useMemo } from 'react';

import { useEnableAI } from './use-enable-ai';

export const useAISpecs = () => {
  const framework = useFramework();
  const enableAI = useEnableAI();
  const confirmModal = useConfirmModal();
  const [reactToLit, _portals] = useLitPortalFactory();

  const featureFlagService = useService(FeatureFlagService);

  const enablePDFEmbedPreview = useLiveData(
    featureFlagService.flags.enable_pdf_embed_preview.$
  );

  const specs = useMemo(() => {
    const manager = getViewManager()
      .config.init()
      .foundation(framework)
      .ai(enableAI, framework)
      .editorConfig(framework)
      .editorView({
        framework,
        reactToLit,
        confirmModal,
        scope: 'workspace',
      })
      .cloud(framework, true)
      .pdf(enablePDFEmbedPreview, reactToLit)
      .database(framework)
      .linkedDoc(framework)
      .paragraph(enableAI)
      .linkPreview(framework)
      .iconPicker(framework)
      .codeBlockPreview(framework).value;

    return manager.get('page');
  }, [
    framework,
    reactToLit,
    enableAI,
    enablePDFEmbedPreview,
    confirmModal,
  ]);

  return specs;
};
