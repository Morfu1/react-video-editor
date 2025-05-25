import {
  Control,
  Pattern,
  Video as VideoBase,
  VideoProps as VideoPropsBase,
  timeMsToUnits,
  unitsToTimeMs,
} from "@designcombo/timeline";
import { Filmstrip, FilmstripBacklogOptions } from "../types";
import ThumbnailCache from "../../utils/thumbnail-cache";
import { IDisplay, IMetadata, ITrim } from "@designcombo/types";
import {
  calculateOffscreenSegments,
  calculateThumbnailSegmentLayout,
} from "../../utils/filmstrip";
import { getFileFromUrl } from "../../utils/file";
import { type MP4Clip } from "@designcombo/frames";
import { createMediaControls } from "../controls";

const EMPTY_FILMSTRIP: Filmstrip = {
  offset: 0,
  startTime: 0,
  thumbnailsCount: 0,
  widthOnScreen: 0,
};

interface VideoProps extends VideoPropsBase {
  aspectRatio: number;
  metadata: Partial<IMetadata> & {
    previewUrl: string;
  };
}
class Video extends VideoBase {
  static type = "Video";
  public clip?: MP4Clip | null;
  declare id: string;
  public resourceId: string = "";
  declare tScale: number;
  public isSelected = false;
  declare display: IDisplay;
  declare trim: ITrim;
  declare playbackRate: number;
  declare duration: number;
  public prevDuration: number;
  public itemType = "video";
  public metadata?: Partial<IMetadata>;
  declare src: string;

  public aspectRatio = 1;
  public scrollLeft = 0;
  public filmstripBacklogOptions?: FilmstripBacklogOptions;
  public thumbnailsPerSegment = 0;
  public segmentSize = 0;

  public offscreenSegments = 0;
  public thumbnailWidth: number = 0;
  public thumbnailHeight: number = 40;
  public thumbnailsList: { url: string; ts: number }[] = [];
  public isFetchingThumbnails = false;
  public thumbnailCache = new ThumbnailCache();

  public currentFilmstrip: Filmstrip = EMPTY_FILMSTRIP;
  public nextFilmstrip: Filmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
  public loadingFilmstrip: Filmstrip = EMPTY_FILMSTRIP;

  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  private isDirty: boolean = true;

  private fallbackSegmentIndex: number = 0;
  private fallbackSegmentsCount: number = 0;
  private previewUrl: string = "";

  static createControls(): { controls: Record<string, Control> } {
    return { controls: createMediaControls() };
  }

  constructor(props: VideoProps) {
    super(props);
    this.id = props.id;
    this.tScale = props.tScale;
    this.objectCaching = false;
    this.rx = 4;
    this.ry = 4;
    this.display = props.display;
    this.trim = props.trim;
    this.duration = props.duration;
    this.prevDuration = props.duration;
    this.fill = "#27272a";
    this.borderOpacityWhenMoving = 1;
    this.metadata = props.metadata;

    this.aspectRatio = props.aspectRatio;

    this.src = props.src;
    this.strokeWidth = 0;

    this.transparentCorners = false;
    this.hasBorders = false;

    this.previewUrl = props.metadata?.previewUrl;
    this.initOffscreenCanvas();
    this.initialize();
  }

  private initOffscreenCanvas() {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = new OffscreenCanvas(this.width, this.height);
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }

    // Resize if dimensions changed
    if (
      this.offscreenCanvas.width !== this.width ||
      this.offscreenCanvas.height !== this.height
    ) {
      this.offscreenCanvas.width = this.width;
      this.offscreenCanvas.height = this.height;
      this.isDirty = true;
    }
  }

  public initDimensions() {
    this.thumbnailWidth = this.thumbnailHeight * this.aspectRatio;

    const segmentOptions = calculateThumbnailSegmentLayout(this.thumbnailWidth);
    this.thumbnailsPerSegment = segmentOptions.thumbnailsPerSegment;
    this.segmentSize = segmentOptions.segmentSize;
  }

  public async initialize() {
    await this.loadFallbackThumbnail();
    this.initDimensions();
    
    // Create fallback pattern immediately after fallback thumbnail is created
    this.createFallbackPattern();
    
    this.onScrollChange({ scrollLeft: 0 });
    this.canvas?.requestRenderAll();

    await this.prepareAssets();
    this.onScrollChange({ scrollLeft: 0 });
  }

  public async prepareAssets() {
    if (typeof window === "undefined") return;

    try {
      const { MP4Clip } = await import("@designcombo/frames");
      const file = await getFileFromUrl(this.src);
      const stream = file.stream();
      this.clip = new MP4Clip(stream);
    } catch (error) {
      console.error("Error loading MP4Clip:", error);
    }
  }

  private calculateFilmstripDimensions({
    segmentIndex,
    widthOnScreen,
  }: {
    segmentIndex: number;
    widthOnScreen: number;
  }) {
    const filmstripOffset = segmentIndex * this.segmentSize;
    const shouldUseLeftBacklog = segmentIndex > 0;
    const leftBacklogSize = shouldUseLeftBacklog ? this.segmentSize : 0;

    const totalWidth = timeMsToUnits(
      this.duration,
      this.tScale,
      this.playbackRate,
    );

    const rightRemainingSize =
      totalWidth - widthOnScreen - leftBacklogSize - filmstripOffset;
    const rightBacklogSize = Math.min(this.segmentSize, rightRemainingSize);

    const filmstripStartTime = unitsToTimeMs(filmstripOffset, this.tScale);
    const filmstrimpThumbnailsCount =
      1 +
      Math.round(
        (widthOnScreen + leftBacklogSize + rightBacklogSize) /
          this.thumbnailWidth,
      );

    return {
      filmstripOffset,
      leftBacklogSize,
      rightBacklogSize,
      filmstripStartTime,
      filmstrimpThumbnailsCount,
    };
  }

  // load fallback thumbnail, resize it and cache it
  private async loadFallbackThumbnail() {
    // For videos, we don't load fallback thumbnails from previewUrl since it's the video file itself
    // Instead, we'll rely on MP4Clip thumbnail generation and create a solid color fallback
    this.createSolidColorFallback();
    return;
  }

  private createSolidColorFallback() {
    // Create a simple solid color thumbnail as fallback for videos
    console.log(`Creating solid color fallback thumbnail with aspect ratio: ${this.aspectRatio}`);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    // Use the video's actual aspect ratio if available, otherwise default to 16:9
    if (!this.aspectRatio || this.aspectRatio <= 0) {
      this.aspectRatio = 16 / 9;
      console.log(`Using default 16:9 aspect ratio`);
    }
    
    const targetHeight = 40;
    const targetWidth = Math.round(targetHeight * this.aspectRatio);
    console.log(`Fallback thumbnail dimensions: ${targetWidth}x${targetHeight}`);
    
    canvas.height = targetHeight;
    canvas.width = targetWidth;
    
    // Fill with a dark gray color
    ctx.fillStyle = "#374151"; // gray-700
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    
    // Add a play icon or video symbol
    ctx.fillStyle = "#9CA3AF"; // gray-400
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("▶", targetWidth / 2, targetHeight / 2 + 5);
    
    // Create image from canvas and cache it
    const img = new Image();
    img.src = canvas.toDataURL();
    
    this.thumbnailWidth = targetWidth;
    this.thumbnailCache.setThumbnail("fallback", img);
    console.log(`Solid color fallback thumbnail created and cached`);
  }

  private generateTimestamps(startTime: number, count: number): number[] {
    const timePerThumbnail = unitsToTimeMs(
      this.thumbnailWidth,
      this.tScale,
      this.playbackRate,
    );

    return Array.from({ length: count }, (_, i) => {
      const timeInFilmstripe = startTime + i * timePerThumbnail;
      return Math.ceil(timeInFilmstripe / 1000);
    });
  }

  private createFallbackPattern() {
    const canvas = this.canvas;
    if (!canvas) {
      console.log("No canvas available for fallback pattern");
      return;
    }

    const canvasWidth = this.canvas!.width;
    const maxPatternSize = 12000;
    const fallbackSource = this.thumbnailCache.getThumbnail("fallback");

    if (!fallbackSource) {
      console.log("No fallback source available for pattern creation");
      return;
    }
    
    console.log("Creating fallback pattern with source:", fallbackSource.width, "x", fallbackSource.height);

    // Compute the total width and number of segments needed
    const totalWidthNeeded = Math.min(canvasWidth * 20, maxPatternSize);
    const segmentsRequired = Math.ceil(totalWidthNeeded / this.segmentSize);
    this.fallbackSegmentsCount = segmentsRequired;
    const patternWidth = segmentsRequired * this.segmentSize;

    // Setup canvas dimensions
    const offCanvas = document.createElement("canvas");
    offCanvas.height = this.thumbnailHeight;
    offCanvas.width = patternWidth;

    const context = offCanvas.getContext("2d")!;
    const thumbnailsTotal = segmentsRequired * this.thumbnailsPerSegment;

    // Draw the fallback image across the entirety of the canvas horizontally
    for (let i = 0; i < thumbnailsTotal; i++) {
      const x = i * this.thumbnailWidth;
      context.drawImage(
        fallbackSource,
        x,
        0,
        this.thumbnailWidth,
        this.thumbnailHeight,
      );
    }

    // Create the pattern and apply it
    const fillPattern = new Pattern({
      source: offCanvas,
      repeat: "no-repeat",
      offsetX: 0,
    });

    this.set("fill", fillPattern);
    this.canvas?.requestRenderAll();
    console.log("Fallback pattern created and applied successfully");
  }
  public async loadAndRenderThumbnails() {
    if (this.isFetchingThumbnails || !this.clip) return;
    // set segmentDrawn to segmentToDraw
    this.loadingFilmstrip = { ...this.nextFilmstrip };
    this.isFetchingThumbnails = true;

    try {
      // Calculate dimensions and offsets
      const { startTime, thumbnailsCount } = this.loadingFilmstrip;

      // Generate required timestamps
      const timestamps = this.generateTimestamps(startTime, thumbnailsCount);

      // Match and prepare thumbnails
      console.log(`Requesting ${timestamps.length} thumbnails for timestamps:`, timestamps);
      const thumbnailsArr = await this.clip.thumbnailsList(this.thumbnailWidth, {
        timestamps: timestamps.map((timestamp) => timestamp * 1e6),
      });
      console.log(`Received ${thumbnailsArr.length} thumbnails from MP4Clip`);

      const updatedThumbnails = thumbnailsArr.map((thumbnail) => {
        return {
          ts: Math.round(thumbnail.ts / 1e6),
          img: thumbnail.img,
        };
      });
      console.log(`Processed thumbnails:`, updatedThumbnails.map(t => ({ ts: t.ts, hasImg: !!t.img })));

      // Load all thumbnails in parallel
      await this.loadThumbnailBatch(updatedThumbnails);

      this.isDirty = true; // Mark as dirty after preparing new thumbnails
      this.currentFilmstrip = { ...this.loadingFilmstrip };

      requestAnimationFrame(() => {
        this.canvas?.requestRenderAll();
      });
    } catch (error) {
      console.error("Error loading video thumbnails:", error);
    } finally {
      this.isFetchingThumbnails = false;
    }
  }

  private async loadThumbnailBatch(thumbnails: { ts: number; img: Blob }[]) {
    console.log(`Loading batch of ${thumbnails.length} thumbnails`);
    let loadedCount = 0;
    let errorCount = 0;
    
    const loadPromises = thumbnails.map(async (thumbnail) => {
      if (this.thumbnailCache.getThumbnail(thumbnail.ts)) {
        console.log(`Thumbnail for ${thumbnail.ts} already cached`);
        return;
      }

      return new Promise<void>((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(thumbnail.img);
        img.src = objectUrl;
        
        img.onload = () => {
          URL.revokeObjectURL(objectUrl); // Clean up the blob URL after image loads
          this.thumbnailCache.setThumbnail(thumbnail.ts, img);
          loadedCount++;
          console.log(`Successfully loaded thumbnail for timestamp ${thumbnail.ts} (${loadedCount} total)`);
          resolve();
        };
        
        img.onerror = (error) => {
          URL.revokeObjectURL(objectUrl); // Clean up on error too
          errorCount++;
          console.error(`Failed to load thumbnail for timestamp ${thumbnail.ts}:`, error, `(${errorCount} errors total)`);
          resolve(); // Resolve instead of reject to not break Promise.all
        };
      });
    });

    await Promise.all(loadPromises);
    console.log(`Finished loading batch: ${loadedCount} successful, ${errorCount} errors`);
  }

  public _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);

    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);

    // Clip the area to prevent drawing outside
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

    this.renderToOffscreen();

    ctx.drawImage(this.offscreenCanvas!, 0, 0);

    ctx.restore();
    // this.drawTextIdentity(ctx);
    this.updateSelected(ctx);
  }

  public setDuration(duration: number) {
    this.duration = duration;
    this.prevDuration = duration;
  }

  public async setSrc(src: string) {
    super.setSrc(src);
    this.clip = null;
    await this.initialize();
    await this.prepareAssets();
    this.thumbnailCache.clearCacheButFallback();
    this.onScale();
  }
  public onResizeSnap() {
    this.renderToOffscreen(true);
  }
  public onResize() {
    this.renderToOffscreen(true);
  }

  public renderToOffscreen(force?: boolean) {
    if (!this.offscreenCtx) return;
    if (!this.isDirty && !force) return;

    this.offscreenCanvas!.width = this.width;
    const ctx = this.offscreenCtx;
    const { startTime, offset, thumbnailsCount } = this.currentFilmstrip;
    const thumbnailWidth = this.thumbnailWidth;
    const thumbnailHeight = this.thumbnailHeight;

    // Calculate the offset caused by the trimming
    const trimFromSize = timeMsToUnits(
      this.trim.from,
      this.tScale,
      this.playbackRate,
    );

    let timeInFilmstripe = startTime;
    const timePerThumbnail = unitsToTimeMs(
      thumbnailWidth,
      this.tScale,
      this.playbackRate,
    );

    // Clear the offscreen canvas
    ctx.clearRect(0, 0, this.width, this.height);

    // Clip with rounded corners
    ctx.beginPath();
    ctx.roundRect(0, 0, this.width, this.height, this.rx);
    ctx.clip();
    // Draw thumbnails
    for (let i = 0; i < thumbnailsCount; i++) {
      let img = this.thumbnailCache.getThumbnail(
        Math.ceil(timeInFilmstripe / 1000),
      );

      if (!img) {
        img = this.thumbnailCache.getThumbnail("fallback");
      }

      if (img && img.complete) {
        const xPosition = i * thumbnailWidth + offset - trimFromSize;

        ctx.drawImage(img, xPosition, 0, thumbnailWidth, thumbnailHeight);
        timeInFilmstripe += timePerThumbnail;
      }
    }

    this.isDirty = false;
  }

  public drawTextIdentity(ctx: CanvasRenderingContext2D) {
    const iconPath = new Path2D(
      "M16.5625 0.925L12.5 3.275V0.625L11.875 0H0.625L0 0.625V9.375L0.625 10H11.875L12.5 9.375V6.875L16.5625 9.2125L17.5 8.625V1.475L16.5625 0.925ZM11.25 8.75H1.25V1.25H11.25V8.75ZM16.25 7.5L12.5 5.375V4.725L16.25 2.5V7.5Z",
    );
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.translate(0, 14);
    ctx.font = "600 12px 'Geist variable'";
    ctx.fillStyle = "#f4f4f5";
    ctx.textAlign = "left";
    ctx.clip();
    ctx.fillText("Video", 36, 10);

    ctx.translate(8, 1);

    ctx.fillStyle = "#f4f4f5";
    ctx.fill(iconPath);
    ctx.restore();
  }

  public setSelected(selected: boolean) {
    this.isSelected = selected;
    this.set({ dirty: true });
  }

  public updateSelected(ctx: CanvasRenderingContext2D) {
    const borderColor = this.isSelected
      ? "rgba(255, 255, 255,1.0)"
      : "rgba(255, 255, 255,0.1)";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      6,
    );
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }

  public calulateWidthOnScreen() {
    const canvasEl = document.getElementById("designcombo-timeline-canvas");
    const canvasWidth = canvasEl?.clientWidth;
    const scrollLeft = this.scrollLeft;
    const timelineWidth = canvasWidth!;
    const cutFromBottomEdge = Math.max(
      timelineWidth - (this.width + this.left + scrollLeft),
      0,
    );
    const visibleHeight = Math.min(
      timelineWidth - this.left - scrollLeft,
      timelineWidth,
    );

    return Math.max(visibleHeight - cutFromBottomEdge, 0);
  }

  // Calculate the width that is not visible on the screen measured from the left
  public calculateOffscreenWidth({ scrollLeft }: { scrollLeft: number }) {
    const offscreenWidth = Math.min(this.left + scrollLeft, 0);

    return Math.abs(offscreenWidth);
  }

  public onScrollChange({
    scrollLeft,
    force,
  }: {
    scrollLeft: number;
    force?: boolean;
  }) {
    const offscreenWidth = this.calculateOffscreenWidth({ scrollLeft });
    const trimFromSize = timeMsToUnits(
      this.trim.from,
      this.tScale,
      this.playbackRate,
    );

    const offscreenSegments = calculateOffscreenSegments(
      offscreenWidth,
      trimFromSize,
      this.segmentSize,
    );

    this.offscreenSegments = offscreenSegments;

    // calculate start segment to draw
    const segmentToDraw = offscreenSegments;

    if (this.currentFilmstrip.segmentIndex === segmentToDraw) {
      return false;
    }

    if (segmentToDraw !== this.fallbackSegmentIndex) {
      const fillPattern = this.fill as Pattern;
      if (fillPattern instanceof Pattern) {
        fillPattern.offsetX =
          this.segmentSize *
          (segmentToDraw - Math.floor(this.fallbackSegmentsCount / 2));
      }

      this.fallbackSegmentIndex = segmentToDraw;
    }
    if (!this.isFetchingThumbnails || force) {
      this.scrollLeft = scrollLeft;
      const widthOnScreen = this.calulateWidthOnScreen();
      // With these lines:
      const { filmstripOffset, filmstripStartTime, filmstrimpThumbnailsCount } =
        this.calculateFilmstripDimensions({
          widthOnScreen: this.calulateWidthOnScreen(),
          segmentIndex: segmentToDraw,
        });

      this.nextFilmstrip = {
        segmentIndex: segmentToDraw,
        offset: filmstripOffset,
        startTime: filmstripStartTime,
        thumbnailsCount: filmstrimpThumbnailsCount,
        widthOnScreen,
      };

      this.loadAndRenderThumbnails();
    }
  }
  public onScale() {
    this.currentFilmstrip = { ...EMPTY_FILMSTRIP };
    this.nextFilmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
    this.loadingFilmstrip = { ...EMPTY_FILMSTRIP };
    this.onScrollChange({ scrollLeft: this.scrollLeft, force: true });
  }
}

export default Video;
