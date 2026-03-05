/**
 * Deterministic hash-based tag colors using inline HSL styles.
 * Uses djb2 hash for good distribution across similar strings.
 * 16 hues evenly spaced for visual variety.
 */

const HUE_COUNT = 16;

function djb2(s: string): number {
	let hash = 5381;
	for (let i = 0; i < s.length; i++) {
		hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
	}
	return hash;
}

export function tagColor(tag: string): { bg: string; border: string; text: string } {
	const hue = (djb2(tag) % HUE_COUNT) * (360 / HUE_COUNT);
	// Yellow-green hues (45-100°) have inherently lower luminance contrast;
	// boost text lightness to maintain WCAG 4.5:1 ratio on dark backgrounds.
	const textLightness = hue >= 45 && hue <= 100 ? 82 : 75;
	return {
		bg: `hsl(${hue} 60% 15%)`,
		border: `hsl(${hue} 50% 30%)`,
		text: `hsl(${hue} 70% ${textLightness}%)`,
	};
}

export function tagStyle(tag: string): string {
	const c = tagColor(tag);
	return `background-color:${c.bg};border-color:${c.border};color:${c.text}`;
}
