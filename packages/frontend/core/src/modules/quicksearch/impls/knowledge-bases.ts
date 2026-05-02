import { AiIcon } from '@blocksuite/icons/rc';
import { Entity, LiveData } from '@toeverything/infra';
import Fuse from 'fuse.js';

import type { KnowledgeBaseService } from '../../knowledge-base';
import type { QuickSearchSession } from '../providers/quick-search-provider';
import type { QuickSearchGroup } from '../types/group';
import type { QuickSearchItem } from '../types/item';
import { highlighter } from '../utils/highlighter';

const group = {
  id: 'knowledge-bases',
  label: {
    i18nKey: 'com.affine.knowledgeBase.title',
  },
  score: 10,
} as QuickSearchGroup;

export class KnowledgeBasesQuickSearchSession
  extends Entity
  implements QuickSearchSession<'knowledge-bases', { knowledgeBaseId: string }>
{
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {
    super();
    void this.knowledgeBaseService.revalidate().catch(console.error);
  }

  query$ = new LiveData('');

  items$: LiveData<
    QuickSearchItem<'knowledge-bases', { knowledgeBaseId: string }>[]
  > = LiveData.computed(get => {
    const query = get(this.query$);
    if (!query.trim()) {
      return [];
    }

    const knowledgeBases = get(this.knowledgeBaseService.knowledgeBases$);
    const fuse = new Fuse(knowledgeBases, {
      keys: ['name'],
      includeMatches: true,
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.1,
    });

    return fuse.search(query).map(({ item, matches, score = 1 }) => {
      const normalizedRange = ([start, end]: [number, number]) =>
        [start, end + 1] as [number, number];
      const titleMatches = matches
        ?.filter(match => match.key === 'name')
        .flatMap(match => match.indices.map(normalizedRange));

      return {
        id: 'knowledge-base:' + item.id,
        source: 'knowledge-bases',
        label: {
          title:
            highlighter(item.name, '<b>', '</b>', titleMatches ?? []) ||
            item.name,
        },
        group,
        score: 1 - score,
        icon: AiIcon,
        payload: { knowledgeBaseId: item.id },
      } satisfies QuickSearchItem<
        'knowledge-bases',
        { knowledgeBaseId: string }
      >;
    });
  });

  query(query: string) {
    this.query$.next(query);
  }
}
