import type { EaseNames, EaseFunction } from "./types";
declare const Eases: {
    [name in EaseNames]: EaseFunction;
};
export default Eases;
