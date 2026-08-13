const Utils = {
    async delay(n: number): Promise<number> {
        n = n || 2000;
        return new Promise(resolve => setTimeout(resolve, n));
    },
    delaySync(n: number): void {
        const start = new Date().getTime();
        while (new Date().getTime() < start + n);
    }
};
export default Utils;