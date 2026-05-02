import type { Command, TextSelection } from '@blocksuite/std';

import { createDefaultPillSelect } from './utils';

export const insertInlinePillSelect: Command<{
  currentTextSelection?: TextSelection;
  textSelection?: TextSelection;
}> = (ctx, next) => {
  const textSelection = ctx.textSelection ?? ctx.currentTextSelection;
  if (!textSelection || !textSelection.isCollapsed()) return;

  const blockComponent = ctx.std.view.getBlock(textSelection.from.blockId);
  if (!blockComponent) return;

  const richText = blockComponent.querySelector('rich-text');
  if (!richText) return;

  const inlineEditor = richText.inlineEditor;
  if (!inlineEditor) return;

  inlineEditor.insertText(
    {
      index: textSelection.from.index,
      length: 0,
    },
    ' '
  );
  inlineEditor.formatText(
    {
      index: textSelection.from.index,
      length: 1,
    },
    {
      pillSelect: createDefaultPillSelect(),
    }
  );
  inlineEditor.setInlineRange({
    index: textSelection.from.index,
    length: 1,
  });

  inlineEditor
    .waitForUpdate()
    .then(async () => {
      await inlineEditor.waitForUpdate();

      const textPoint = inlineEditor.getTextPoint(textSelection.from.index + 1);
      if (!textPoint) return;
      const [text] = textPoint;
      const pillSelectNode = text.parentElement?.closest(
        'affine-pill-select-node'
      );
      if (!pillSelectNode) return;
      pillSelectNode.toggleEditor();
    })
    .catch(console.error);

  next();
};
