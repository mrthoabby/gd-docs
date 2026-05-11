import { DebugLogger } from '@affine/debug';
import {
  catchErrorInto,
  effect,
  Entity,
  LiveData,
} from '@toeverything/infra';
import { filter, map, switchMap, tap } from 'rxjs';

import type { RenderPageOpts } from '../renderer';
import type { PDF } from './pdf';

const logger = new DebugLogger('affine:pdf:page:render');

export class PDFPage extends Entity<{ pdf: PDF; pageNum: number }> {
  readonly pageNum: number = this.props.pageNum;
  bitmap$ = new LiveData<ImageBitmap | null>(null);
  error$ = new LiveData<any>(null);

  private _closeCurrentBitmap() {
    this.bitmap$.value?.close();
    this.bitmap$.next(null);
  }

  private _setBitmap(bitmap: ImageBitmap) {
    const current = this.bitmap$.value;
    if (current && current !== bitmap) {
      current.close();
    }
    this.bitmap$.next(bitmap);
  }

  render = effect(
    switchMap((opts: Omit<RenderPageOpts, 'pageNum'>) =>
      this.props.pdf.renderer.ob$('render', {
        ...opts,
        pageNum: this.pageNum,
      })
    ),
    map(data => data?.bitmap),
    filter((bitmap): bitmap is ImageBitmap => Boolean(bitmap)),
    tap(bitmap => this._setBitmap(bitmap)),
    catchErrorInto(this.error$, error => {
      logger.error('Failed to render page', error);
    })
  );

  constructor() {
    super();
    this.disposables.push(() => {
      this.render.unsubscribe();
      this._closeCurrentBitmap();
    });
  }
}
