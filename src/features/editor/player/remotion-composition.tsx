import { SequenceItem } from "./sequence-item";
import { useEffect, useState } from "react";
import { dispatch, filter, subject } from "@designcombo/events";
import {
  EDIT_OBJECT,
  EDIT_TEMPLATE_ITEM,
  ENTER_EDIT_MODE,
} from "@designcombo/state";
import { merge } from "lodash";
import { groupTrackItems } from "../utils/track-items";
import { calculateTextHeight } from "../utils/text";

// This component is specifically for Remotion server-side rendering
// It receives data through props instead of using the Zustand store
const RemotionComposition = ({ storeData }) => {
  const [editableTextId, setEditableTextId] = useState<string | null>(null);
  const {
    trackItemIds,
    trackItemsMap,
    fps,
    trackItemDetailsMap,
    sceneMoveableRef,
    size,
    transitionsMap,
  } = storeData;

  console.log('RemotionComposition received store data:', {
    trackItemIds,
    trackItemsMapKeys: Object.keys(trackItemsMap || {}),
    fps,
    trackItemDetailsMapKeys: Object.keys(trackItemDetailsMap || {}),
    size,
    transitionsMapKeys: Object.keys(transitionsMap || {})
  });

  const mergedTrackItemsDeatilsMap = merge(trackItemsMap, trackItemDetailsMap);
  const groupedItems = groupTrackItems({
    trackItemIds,
    transitionsMap,
    trackItemsMap: mergedTrackItemsDeatilsMap,
  });

  console.log('Grouped items:', groupedItems);
  console.log('Merged track items map:', mergedTrackItemsDeatilsMap);

  const handleTextChange = (id: string, _: string) => {
    // Text change handling for Remotion rendering (simplified)
    console.log('Text change:', id);
  };

  const onTextBlur = (id: string, _: string) => {
    // Text blur handling for Remotion rendering (simplified)
    console.log('Text blur:', id);
  };

  return (
    <>
      {groupedItems.map((group, index) => {
        if (group.length === 1) {
          const item = mergedTrackItemsDeatilsMap[group[0].id];
          console.log('Rendering item:', item?.type, item?.id, item);
          if (!item) {
            console.warn('Item not found:', group[0].id);
            return null;
          }
          return SequenceItem[item.type](item, {
            fps,
            handleTextChange,
            onTextBlur,
            editableTextId,
          });
        }
        return null;
      })}
    </>
  );
};

export default RemotionComposition;