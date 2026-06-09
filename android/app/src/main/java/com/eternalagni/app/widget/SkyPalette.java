package com.eternalagni.app.widget;

import java.util.Calendar;

/**
 * Computes a "sky clock" colour from the current local time along a smooth
 * 24-hour curve: deep-blue night -> indigo pre-dawn -> peach dawn -> gold
 * morning -> warm midday -> amber afternoon -> rose/violet dusk -> night.
 *
 * Colours are interpolated (with ease-in/ease-out smoothing) between anchor
 * stops, so the background drifts gradually through the day rather than
 * snapping between fixed buckets. Text ink is chosen from the resulting
 * background luminance so labels stay readable at every hour.
 */
public final class SkyPalette {

    private SkyPalette() {}

    public static final class Sky {
        public int top;
        public int bottom;
        public int stroke;
        public int ink;
        public int inkSoft;
        public int locationInk;
    }

    // Hour-of-day anchors (0..24). Densely spaced so that, sampled on the widget's
    // ~45-minute refresh, the colour only ever moves one small step along the
    // curve — a gradual light→medium→deep drift instead of a sudden jump.
    private static final float[] H = {
            0f, 3f, 5f, 6f, 6.75f, 7.5f, 9f, 11f, 13f, 15f, 16.5f, 17.5f, 18.25f, 19f, 20f, 21.5f, 24f
    };
    // Gradient TOP colours (upper sky) at each anchor. Realistic, desaturated
    // photographic-sky tones: deep navy night, gentle blues by day, restrained
    // warmth at the golden hours — no neon / cartoon saturation.
    private static final int[] TOP = {
            0xFF0B1426, 0xFF0C1428, 0xFF1A2A4A, 0xFF3A4E78, 0xFF6E8AB8, 0xFF86A8D0,
            0xFF6E9AD0, 0xFF5A8FCC, 0xFF4F88C8, 0xFF5689C2, 0xFF6E90BE, 0xFF7C8FB2,
            0xFF5E6E9A, 0xFF46527E, 0xFF2C3A60, 0xFF16243F, 0xFF0B1426
    };
    // Gradient BOTTOM colours (horizon) at each anchor — softly warmer near
    // sunrise & sunset, pale haze by day, deep blue at night.
    private static final int[] BOT = {
            0xFF122036, 0xFF13223A, 0xFF2C3C5C, 0xFF7A6E84, 0xFFD69B78, 0xFFEBC79A,
            0xFFB8D2E8, 0xFFAECBE6, 0xFFA6C6E2, 0xFFACC6DE, 0xFFC9B68C, 0xFFE0A972,
            0xFFD38A5C, 0xFF9A6E84, 0xFF4E4E72, 0xFF243A56, 0xFF122036
    };

    private static final int INK_DARK = 0xFF20303F;       // deep slate for bright daytime skies
    private static final int INK_DARK_SOFT = 0xCC3A4A59;
    private static final int INK_LIGHT = 0xFFFFFFFF;       // for dark/dusk/night skies
    private static final int INK_LIGHT_SOFT = 0xCCD6E2FF;  // cool moonlight for night text
    private static final int LOC_DARK = 0xFF1C4E80;        // deep sky-blue accent on bright skies
    private static final int LOC_LIGHT = 0xFFB9D4FF;       // icy blue accent on dark skies

    public static Sky now() {
        Calendar c = Calendar.getInstance();
        float h = c.get(Calendar.HOUR_OF_DAY)
                + c.get(Calendar.MINUTE) / 60f
                + c.get(Calendar.SECOND) / 3600f;
        return at(h);
    }

    public static Sky at(float hour) {
        if (hour < 0f) hour = 0f;
        if (hour > 24f) hour = 24f;

        int i = 0;
        while (i < H.length - 1 && hour > H[i + 1]) {
            i++;
        }
        float span = H[i + 1] - H[i];
        float t = span <= 0f ? 0f : (hour - H[i]) / span;
        if (t < 0f) t = 0f;
        if (t > 1f) t = 1f;
        // Smoothstep easing so transitions are gentle near the anchors.
        float e = t * t * (3f - 2f * t);

        Sky sky = new Sky();
        sky.top = lerpColor(TOP[i], TOP[i + 1], e);
        sky.bottom = lerpColor(BOT[i], BOT[i + 1], e);
        sky.stroke = 0x33000000;

        float lum = (luminance(sky.top) + luminance(sky.bottom)) / 2f;
        boolean bright = lum >= 0.56f;
        sky.ink = bright ? INK_DARK : INK_LIGHT;
        sky.inkSoft = bright ? INK_DARK_SOFT : INK_LIGHT_SOFT;
        sky.locationInk = bright ? LOC_DARK : LOC_LIGHT;
        return sky;
    }

    private static int lerpColor(int a, int b, float t) {
        int aa = (a >>> 24) & 0xFF, ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
        int ba = (b >>> 24) & 0xFF, br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
        int ca = Math.round(aa + (ba - aa) * t);
        int cr = Math.round(ar + (br - ar) * t);
        int cg = Math.round(ag + (bg - ag) * t);
        int cb = Math.round(ab + (bb - ab) * t);
        return (ca << 24) | (cr << 16) | (cg << 8) | cb;
    }

    private static float luminance(int color) {
        int r = (color >> 16) & 0xFF, g = (color >> 8) & 0xFF, b = color & 0xFF;
        return (0.299f * r + 0.587f * g + 0.114f * b) / 255f;
    }
}
