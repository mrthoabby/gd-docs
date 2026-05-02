import { InlineDeltaToMarkdownAdapterExtension } from '@blocksuite/affine-shared/adapters';

import { getSelectedPillSelectOption } from '../../pill-select/utils';

export const boldDeltaToMarkdownAdapterMatcher =
  InlineDeltaToMarkdownAdapterExtension({
    name: 'bold',
    match: delta => !!delta.attributes?.bold,
    toAST: (_, context) => {
      const { current: currentMdast } = context;
      return {
        type: 'strong',
        children: [currentMdast],
      };
    },
  });

export const italicDeltaToMarkdownAdapterMatcher =
  InlineDeltaToMarkdownAdapterExtension({
    name: 'italic',
    match: delta => !!delta.attributes?.italic,
    toAST: (_, context) => {
      const { current: currentMdast } = context;
      return {
        type: 'emphasis',
        children: [currentMdast],
      };
    },
  });

export const strikeDeltaToMarkdownAdapterMatcher =
  InlineDeltaToMarkdownAdapterExtension({
    name: 'strike',
    match: delta => !!delta.attributes?.strike,
    toAST: (_, context) => {
      const { current: currentMdast } = context;
      return {
        type: 'delete',
        children: [currentMdast],
      };
    },
  });

export const inlineCodeDeltaToMarkdownAdapterMatcher =
  InlineDeltaToMarkdownAdapterExtension({
    name: 'inlineCode',
    match: delta => !!delta.attributes?.code,
    toAST: delta => ({
      type: 'inlineCode',
      value: delta.insert,
    }),
  });

export const pillSelectDeltaToMarkdownAdapterMatcher =
  InlineDeltaToMarkdownAdapterExtension({
    name: 'pillSelect',
    match: delta => !!delta.attributes?.pillSelect,
    toAST: delta => ({
      type: 'text',
      value: delta.attributes?.pillSelect
        ? (getSelectedPillSelectOption(delta.attributes.pillSelect)?.label ??
          '')
        : typeof delta.insert === 'string'
          ? delta.insert
          : '',
    }),
  });

export const InlineDeltaToMarkdownAdapterExtensions = [
  pillSelectDeltaToMarkdownAdapterMatcher,
  inlineCodeDeltaToMarkdownAdapterMatcher,
  boldDeltaToMarkdownAdapterMatcher,
  italicDeltaToMarkdownAdapterMatcher,
  strikeDeltaToMarkdownAdapterMatcher,
];
