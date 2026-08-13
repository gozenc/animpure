export type AnimationAction = (progress: number) => any;
export type EaseFunction = (t: number) => number;
export type EaseNames = "none" | "inQuad" | "outQuad" | "inOutQuad" | "inCubic" | "outCubic" | "inOutCubic" | "inQuart" | "outQuart" | "inOutQuart" | "inQuint" | "outQuint" | "inOutQuint";