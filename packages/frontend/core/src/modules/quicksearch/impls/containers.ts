import { ViewLayersIcon } from '@blocksuite/icons/rc';
import { Entity, LiveData } from '@toeverything/infra';
import Fuse from 'fuse.js';

import type { ContainerService } from '../../container';
import type { QuickSearchSession } from '../providers/quick-search-provider';
import type { QuickSearchGroup } from '../types/group';
import type { QuickSearchItem } from '../types/item';
import { highlighter } from '../utils/highlighter';

const group = {
  id: 'containers',
  label: {
    i18nKey: 'com.affine.container.title',
  },
  score: 10,
} as QuickSearchGroup;

export class ContainersQuickSearchSession
  extends Entity
  implements QuickSearchSession<'containers', { containerId: string }>
{
  constructor(private readonly containerService: ContainerService) {
    super();
    void this.containerService.revalidate().catch(console.error);
  }

  query$ = new LiveData('');

  items$: LiveData<QuickSearchItem<'containers', { containerId: string }>[]> =
    LiveData.computed(get => {
      const query = get(this.query$);
      if (!query.trim()) {
        return [];
      }

      const containers = get(this.containerService.containers$);
      const fuse = new Fuse(containers, {
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
          id: 'container:' + item.id,
          source: 'containers',
          label: {
            title:
              highlighter(item.name, '<b>', '</b>', titleMatches ?? []) ||
              item.name,
          },
          group,
          score: 1 - score,
          icon: ViewLayersIcon,
          payload: { containerId: item.id },
        } satisfies QuickSearchItem<'containers', { containerId: string }>;
      });
    });

  query(query: string) {
    this.query$.next(query);
  }
}
