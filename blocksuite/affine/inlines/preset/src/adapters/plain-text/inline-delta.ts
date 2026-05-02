import {
  InlineDeltaToPlainTextAdapterExtension,
  type TextBuffer,
} from '@blocksuite/affine-shared/adapters';

import { getSelectedPillSelectOption } from '../../pill-select/utils';

export const pillSelectDeltaToPlainTextAdapterMatcher =
  InlineDeltaToPlainTextAdapterExtension({
    name: 'pillSelect',
    match: delta => !!delta.attributes?.pillSelect,
    toAST: delta => {
      const node: TextBuffer = {
        content: typeof delta.insert === 'string' ? delta.insert : '',
      };

      if (!delta.attributes?.pillSelect) {
        return node;
      }

      return {
        content: getSelectedPillSelectOption(delta.attributes.pillSelect).label,
      };
    },
  });

export const InlineDeltaToPlainTextAdapterExtensions = [
  pillSelectDeltaToPlainTextAdapterMatcher,
];
