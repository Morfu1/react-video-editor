import { ScrollArea } from "@/components/ui/scroll-area";
import { IBoxShadow, IImage, ITrackItem } from "@designcombo/types";
import Outline from "./common/outline";
import Shadow from "./common/shadow";
import Opacity from "./common/opacity";
import Rounded from "./common/radius";
import AspectRatio from "./common/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Crop } from "lucide-react";
import { useEffect, useState } from "react";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import Blur from "./common/blur";
import Brightness from "./common/brightness";
import useLayoutStore from "../store/use-layout-store";
import { Label } from "@/components/ui/label";

const BasicImage = ({ trackItem }: { trackItem: ITrackItem & IImage }) => {
  const [properties, setProperties] = useState(trackItem);
  const { setCropTarget } = useLayoutStore();
  useEffect(() => {
    setProperties(trackItem);
  }, [trackItem]);

  const onChangeBorderWidth = (v: number) => {
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItem.id]: {
          details: {
            borderWidth: v,
          },
        },
      },
    });
    setProperties((prev) => {
      return {
        ...prev,
        details: {
          ...prev.details,
          borderWidth: v,
        },
      };
    });
  };

  const onChangeBorderColor = (v: string) => {
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItem.id]: {
          details: {
            borderColor: v,
          },
        },
      },
    });
    setProperties((prev) => {
      return {
        ...prev,
        details: {
          ...prev.details,
          borderColor: v,
        },
      };
    });
  };

  const handleChangeOpacity = (v: number) => {
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItem.id]: {
          details: {
            opacity: v,
          },
        },
      },
    });
    setProperties((prev) => {
      return {
        ...prev,
        details: {
          ...prev.details,
          opacity: v,
        },
      };
    });
  };

  const onChangeBlur = (v: number) => {
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItem.id]: {
          details: {
            blur: v,
          },
        },
      },
    });
    setProperties((prev) => {
      return {
        ...prev,
        details: {
          ...prev.details,
          blur: v,
        },
      };
    });
  };
  const onChangeBrightness = (v: number) => {
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItem.id]: {
          details: {
            brightness: v,
          },
        },
      },
    });
    setProperties((prev) => {
      return {
        ...prev,
        details: {
          ...prev.details,
          brightness: v,
        },
      };
    });
  };

  const onChangeBorderRadius = (v: number) => {
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItem.id]: {
          details: {
            borderRadius: v,
          },
        },
      },
    });
    setProperties((prev) => {
      return {
        ...prev,
        details: {
          ...prev.details,
          borderRadius: v,
        },
      };
    });
  };

  const onChangeBoxShadow = (boxShadow: IBoxShadow) => {
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItem.id]: {
          details: {
            boxShadow: boxShadow,
          },
        },
      },
    });

    setProperties((prev) => {
      return {
        ...prev,
        details: {
          ...prev.details,
          boxShadow,
        },
      };
    });
  };

  const getOriginalFilename = (src: string): string => {
    try {
      const url = new URL(src);
      const pathname = url.pathname;
      let filename = pathname.split('/').pop() || '';
      filename = filename.split('?')[0]; // Remove query parameters
      
      // Remove timestamp pattern (e.g., "ada_2-1748185411606.png" -> "ada_2.png")
      filename = filename.replace(/-\d{13}(\.\w+)$/, '$1');
      
      return filename;
    } catch {
      let filename = src.split('/').pop()?.split('?')[0] || '';
      // Remove timestamp pattern for non-URL strings too
      filename = filename.replace(/-\d{13}(\.\w+)$/, '$1');
      return filename;
    }
  };



  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        <div>
          <div>Image</div>
          <div className="text-xs text-gray-500 font-normal">
            {trackItem.name && trackItem.name !== 'image' 
              ? trackItem.name 
              : getOriginalFilename(trackItem.details.src)
            }
          </div>
        </div>
      </div>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-2 px-4">
          <div className="mb-4 mt-2">
            <Button
              variant={"secondary"}
              size={"icon"}
              onClick={() => {
                setCropTarget(trackItem);
              }}
            >
              <Crop size={18} />
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-sans text-xs font-semibold text-primary">
              Basic
            </Label>

            <AspectRatio />
            <Rounded
              onChange={(v: number) => onChangeBorderRadius(v)}
              value={properties.details.borderRadius as number}
            />
            <Opacity
              onChange={(v: number) => handleChangeOpacity(v)}
              value={properties.details.opacity!}
            />

            <Blur
              onChange={(v: number) => onChangeBlur(v)}
              value={properties.details.blur!}
            />
            <Brightness
              onChange={(v: number) => onChangeBrightness(v)}
              value={properties.details.brightness!}
            />
          </div>

          <Outline
            label="Outline"
            onChageBorderWidth={(v: number) => onChangeBorderWidth(v)}
            onChangeBorderColor={(v: string) => onChangeBorderColor(v)}
            valueBorderWidth={properties.details.borderWidth as number}
            valueBorderColor={properties.details.borderColor as string}
          />
          <Shadow
            label="Shadow"
            onChange={(v: IBoxShadow) => onChangeBoxShadow(v)}
            value={properties.details.boxShadow!}
          />
        </div>
      </ScrollArea>
    </div>
  );
};

export default BasicImage;
