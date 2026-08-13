/*!
 * AnimPure v0.0.7
 * Pure Javascript animation library without any dependency
 *
 * https://github.com/fatihgozenc/animpure
 * Copyright 2020 Fatih Gözenç
 */
import { EaseNames, EaseFunction, AnimationAction } from "./types";
export { EaseNames, EaseFunction, AnimationAction } from "./types";
export declare const Eases: {
    [K in EaseNames]: EaseFunction;
};
export declare const delay: (n: number) => Promise<number>;
export declare const delaySync: (n: number) => void;
export default function animate(action: AnimationAction, duration: number, timing?: EaseFunction): Promise<number>;
