/*!
 * AnimPure v0.0.1
 * Pure Javascript animation library without any dependency 
 *
 * https://github.com/fatihgozenc/animpure
 * Copyright 2020 Fatih Gözenç
 */

var AnimPure = {

	animate: ({ duration, timing = AnimPure.ease.none, action }) => {
		let start = performance.now()
		requestAnimationFrame(function animate(time) {
			// timeFraction goes from 0 to 1
			let timeFraction = (time - start) / duration
			if (timeFraction > 1) timeFraction = 1;
			// Calculate the current animation state
			action(timing(timeFraction))
			// Recursive executing till progress reaches to 1
			if (timeFraction < 1) {
				requestAnimationFrame(animate)
			}
		})
	},

	ease: {
		none: t => t,
		inQuad: t => t * t,
		outQuad: t => t * (2 - t),
		inOutQuad: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
		inCubic: t => t * t * t,
		outCubic: t => (--t) * t * t + 1,
		inOutCubic: t => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
		inQuart: t => t * t * t * t,
		outQuart: t => 1 - (--t) * t * t * t,
		inOutQuart: t => t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
		inQuint: t => t * t * t * t * t,
		outQuint: t => 1 + (--t) * t * t * t * t,
		inOutQuint: t => t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t
	},

	delay: (n) => {
		n = n || 2000;
		return new Promise(resolve => {
			setTimeout(() => {
				resolve()
			}, n);
		})
	},

	delaySync: (n) => {
		var start = new Date().getTime();
		while (new Date().getTime() < start + n);
	}
}
