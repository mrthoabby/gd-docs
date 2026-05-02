import type { AffineTextAttributes } from '@blocksuite/affine-shared/types';
import { StdIdentifier } from '@blocksuite/std';
import { InlineSpecExtension } from '@blocksuite/std/inline';
import { html } from 'lit';
import { z } from 'zod';

export const PillSelectInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>('pillSelect', provider => {
    const std = provider.get(StdIdentifier);

    return {
      name: 'pillSelect',
      schema: z.object({
        pillSelect: z
          .object({
            id: z.string(),
            selectedOptionId: z.string(),
            mode: z.enum(['copy', 'reference']).optional().catch('copy'),
            options: z.array(
              z.object({
                id: z.string(),
                label: z.string(),
                color: z.string(),
              })
            ),
          })
          .optional()
          .nullable()
          .catch(undefined),
      }),
      match: delta => !!delta.attributes?.pillSelect,
      renderer: ({ delta, selected, editor, startOffset, endOffset }) => {
        return html`<affine-pill-select-node
          .std=${std}
          .delta=${delta}
          .selected=${selected}
          .editor=${editor}
          .startOffset=${startOffset}
          .endOffset=${endOffset}
        ></affine-pill-select-node>`;
      },
      embed: true,
    };
  });
