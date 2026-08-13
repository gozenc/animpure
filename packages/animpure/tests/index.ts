// import animate from "../build";
import animate, { Eases } from "../build";

animate((progress: number) => {
    console.log(progress);
}, 1000);