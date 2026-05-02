import type { DocMode } from '@blocksuite/affine/model';
import { Entity, LiveData } from '@toeverything/infra';
import { map } from 'rxjs';

import type { DocsStore } from '../stores/docs';
import {
  getContentTypeByDocMode,
  getDocModeByContentType,
  type DocContentType,
} from '../types';
import { DocRecord } from './record';

export class DocRecordList extends Entity {
  constructor(private readonly store: DocsStore) {
    super();
  }

  private readonly pool = new Map<string, DocRecord>();

  public readonly docsMap$ = LiveData.from<Map<string, DocRecord>>(
    this.store.watchDocIds().pipe(
      map(
        ids =>
          new Map(
            ids.map(id => {
              const exists = this.pool.get(id);
              if (exists) {
                return [id, exists];
              }
              const record = this.framework.createEntity(DocRecord, { id });
              this.pool.set(id, record);
              return [id, record];
            })
          )
      )
    ),
    new Map()
  );

  public readonly docs$ = this.docsMap$.selector(d => Array.from(d.values()));

  public readonly trashDocs$ = LiveData.from<DocRecord[]>(
    this.store.watchTrashDocIds().pipe(
      map(ids =>
        ids.map(id => {
          const exists = this.pool.get(id);
          if (exists) {
            return exists;
          }
          const record = this.framework.createEntity(DocRecord, { id });
          this.pool.set(id, record);
          return record;
        })
      )
    ),
    []
  );

  public readonly nonTrashDocsIds$ = LiveData.from<string[]>(
    this.store.watchNonTrashDocIds(),
    []
  );

  public readonly isReady$ = LiveData.from(
    this.store.watchDocListReady(),
    false
  );

  public doc$(id: string) {
    return this.docsMap$.selector(map => map.get(id));
  }

  public setPrimaryMode(id: string, mode: DocMode) {
    return this.setContentType(id, getContentTypeByDocMode(mode));
  }

  public getPrimaryMode(id: string) {
    return getDocModeByContentType(this.getContentType(id));
  }

  public setContentType(id: string, contentType: DocContentType) {
    return this.store.setDocContentType(id, contentType);
  }

  public getContentType(id: string) {
    return (
      this.store.getDocContentType(id) ??
      getContentTypeByDocMode(this.store.getDocPrimaryModeSetting(id))
    );
  }

  public togglePrimaryMode(id: string): DocMode {
    return this.getPrimaryMode(id);
  }

  public primaryMode$(id: string) {
    return LiveData.from(
      this.store.watchDocContentType(id),
      this.getPrimaryMode(id)
    ).map(contentType => {
      if (contentType === 'diagram' || contentType === 'document') {
        return getDocModeByContentType(contentType);
      }
      return this.getPrimaryMode(id);
    });
  }
}
