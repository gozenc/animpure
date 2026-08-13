/*!
 * AnimPure v0.0.7
 * Pure Javascript animation library without any dependency 
 *
 * https://github.com/fatihgozenc/animpure
 * Copyright 2020 Fatih Gözenç
 */

import { EaseNames, EaseFunction, AnimationAction } from "./types";
export { EaseNames, EaseFunction, AnimationAction } from "./types";
import eases from "./eases";
import utils from "./utils";

export const Eases: { [K in EaseNames]: EaseFunction } = eases;
export const delay = utils.delay;
export const delaySync = utils.delaySync;

export default function animate(
    action: AnimationAction,
    duration: number,
    timing = Eases.none
): Promise<number> {
    const start = performance.now();
    requestAnimationFrame(function progress(time) {
        // fraction goes from 0 to 1
        let fraction = (time - start) / duration;
        if (fraction > 1) fraction = 1;
        // Calculate the current animation state
        action(timing(fraction));
        // Recursive executing till progress reaches to 1
        if (fraction < 1) {
            requestAnimationFrame(progress);
        }
    });
    return delay(duration);
}
