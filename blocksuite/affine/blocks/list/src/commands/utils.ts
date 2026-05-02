import { ListBlockModel } from '@blocksuite/affine-model';
import {
  getNextContinuousOrderedLists,
  getPreviousOrderedList,
  isOrderedListType,
  matchModels,
} from '@blocksuite/affine-shared/utils';
import type { BlockModel, Store } from '@blocksuite/store';

/**
 * correct target is a numbered list, which is divided into two steps:
 * 1. check if there is a numbered list before the target list. If so, adjust the order of the target list
 *    to the order of the previous list plus 1, otherwise set the order to 1
 * 2. find continuous lists starting from the target list and keep their order continuous
 */
export function correctNumberedListsOrderToPrev(
  doc: Store,
  modelOrId: BlockModel | string,
  transact = true
) {
  const model =
    typeof modelOrId === 'string' ? doc.getBlock(modelOrId)?.model : modelOrId;

  if (!model) return;

  if (!matchModels(model, [ListBlockModel])) {
    return;
  }

  const type = model.props.type;
  if (!isOrderedListType(type)) {
    return;
  }

  const fn = () => {
    // step 1
    const previousList = getPreviousOrderedList(doc, model, type);

    if (type === 'phase' && model.props.phaseSequenceStart) {
      model.props.order = 1;
    } else if (previousList) {
      if (!previousList.props.order) previousList.props.order = 1;
      model.props.order = previousList.props.order + 1;
    } else {
      model.props.order = 1;
    }

    // step 2
    let base = model.props.order + 1;
    const continuousNumberedLists = getNextContinuousOrderedLists(
      doc,
      model,
      type
    );
    continuousNumberedLists.forEach(list => {
      if (type === 'phase' && list.props.phaseSequenceStart) {
        list.props.order = 1;
        base = 2;
      } else {
        list.props.order = base;
        base++;
      }
    });
  };

  if (transact) {
    doc.transact(fn);
  } else {
    fn();
  }
}

export function correctListOrder(doc: Store, model: ListBlockModel) {
  // old numbered list has no order
  if (
    isOrderedListType(model.props.type) &&
    !Number.isInteger(model.props.order)
  ) {
    correctNumberedListsOrderToPrev(doc, model, false);
  }
  // if list is not numbered, order should be null
  if (!isOrderedListType(model.props.type)) {
    model.props.order = null;
  }
}
