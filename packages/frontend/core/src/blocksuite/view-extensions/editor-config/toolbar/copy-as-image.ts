import { notify } from '@affine/component';
import { EditorService } from '@affine/core/modules/editor';
import { I18n } from '@affine/i18n';
import type { MenuContext } from '@blocksuite/affine/components/toolbar';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { CopyAsImgaeIcon } from '@blocksuite/icons/lit';
import type { FrameworkProvider } from '@toeverything/infra';

export function copyAsImage(_std: BlockStdScope) {
  notify.error({
    title: I18n.t('com.affine.copy.asImage.notAvailable.title'),
    message: I18n.t('com.affine.copy.asImage.notAvailable.message'),
  });
}

export function createCopyAsPngMenuItem(framework: FrameworkProvider) {
  return {
    icon: CopyAsImgaeIcon({ width: '20', height: '20' }),
    label: 'Copy as Image',
    type: 'copy-as-image',
    when: (ctx: MenuContext) => {
      if (ctx.isEmpty()) return false;
      const { editor } = framework.get(EditorService);
      const mode = editor.mode$.value;
      return mode === 'edgeless';
    },
    action: (ctx: MenuContext) => {
      const std = ctx.std;
      return copyAsImage(std);
    },
  };
}
