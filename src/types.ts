export interface ImglyRemoveConfig {
  model?: "small" | "medium";
  output?: { format?: "image/png"; quality?: number };
  progress?: (key: string, current: number, total: number) => void;
}

export interface ImglyModule {
  removeBackground(image: Blob, config?: ImglyRemoveConfig): Promise<Blob>;
  preload?(config?: ImglyRemoveConfig): Promise<void>;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseResult {
  landmarks: Landmark[][];
}

export interface PoseLandmarkerLike {
  detect(image: HTMLCanvasElement): PoseResult;
}

export interface VisionModule {
  FilesetResolver: {
    forVisionTasks(wasmPath: string): Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions(
      vision: unknown,
      options: {
        baseOptions: { modelAssetPath: string };
        runningMode: "IMAGE";
        numPoses: number;
      },
    ): Promise<PoseLandmarkerLike>;
  };
}

export interface GenerateResponse {
  image?: string;
  mimeType?: string;
  error?: string;
}

export type StageId = "read" | "model" | "segment" | "analyze" | "generate" | "compose";

/** What the pipeline tells the UI while it works. */
export interface Reporter {
  enter(stage: StageId, label: string): void;
  skip(stage: StageId): void;
}
