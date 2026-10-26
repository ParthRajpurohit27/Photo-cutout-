export interface ImglyRemoveConfig {
  output?: { format?: "image/png"; quality?: number };
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

export type Report = (message: string, percent: number) => void;
