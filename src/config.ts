export interface SiteConfig {
  /** Gemini API key (paste yours). Used directly from the browser. */
  readonly geminiApiKey: string;
  readonly geminiModel: string;

  /** Your fixed photo (kept in site/photos/). */
  readonly basePhoto: string;
  readonly baseMaxSide: number;
  readonly visitorMaxSide: number;

  /** Which side of you the visitor stands on. */
  readonly visitorSide: "left" | "right";
  /** Visitor's horizontal centre, as fraction of photo width (0..1). */
  readonly visitorCenterX: number;
  /** Visitor's full height as fraction of photo height (head-top to feet). */
  readonly visitorHeightRatio: number;
  /** Where the visitor's feet touch the ground, fraction of photo height. */
  readonly groundY: number;

  /** 0 = no colour matching, 1 = full. */
  readonly colorMatchStrength: number;

  /** Background-removal model: "medium" = better edges, "small" = lighter download. */
  readonly bgModel: "small" | "medium";
  /** Rough download size used only for the first time estimate. */
  readonly estimatedModelMb: number;

  readonly imglyUrl: string;
  readonly visionUrl: string;
  readonly visionWasmUrl: string;
  readonly poseModelUrl: string;
}

export const CONFIG: SiteConfig = {
  geminiApiKey: "AQ.Ab8RN6IOJ5bIeYB2kyOshcqX2VyBSbrJ4DLdtfiL-_U_ogSrqw",
  geminiModel: "gemini-2.5-flash-image",

  basePhoto: "photos/me.jpg",
  baseMaxSide: 3000,
  visitorMaxSide: 1600,

  visitorSide: "left",
  visitorCenterX: 0.27,
  visitorHeightRatio: 0.845,
  groundY: 0.955,

  colorMatchStrength: 0.6,

  bgModel: "medium",
  estimatedModelMb: 85,

  imglyUrl: "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm",
  visionUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm",
  visionWasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  poseModelUrl:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};
