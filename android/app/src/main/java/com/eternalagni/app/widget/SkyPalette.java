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

    // Hour-of-day anchors (0..24).
    private static final float[] H = {
            0f, 5f, 6.3f, 7.5f, 10f, 12.5f, 15f, 17f, 18f, 19.3f, 20.5f, 22f, 24f
    };
    // Gradient top colours at each anchor.
    private static final int[] TOP = {
            0xFF0A1733, 0xFF16284F, 0xFF5566A0, 0xFFFFD27A, 0xFFFFE89C,
            0xFFFFF3CE, 0xFFFAB957, 0xFFF59246, 0xFFF57A52, 0xFFB65C9A, 0xFF2E3A72, 0xFF112045, 0xFF0A1733
    };
    // Gradient bottom colours at each anchor.
    private static final int[] BOT = {
            0xFF0B1E40, 0xFF3A4E86, 0xFFE8956F, 0xFFFF9E5E, 0xFFFFCB5C,
            0xFFFFE07A, 0xFFF59030, 0xFFEC6E3C, 0xFFEC5F7E, 0xFF5A4CC4, 0xFF122047, 0xFF0A1838, 0xFF0B1E40
    };

    private static final int INK_DARK = 0xFF3A1A07;       // warm espresso for bright skies
    private static final int INK_DARK_SOFT = 0xCC5A3318;
    private static final int INK_LIGHT = 0xFFFFFFFF;       // for dark/dusk/night skies
    private static final int INK_LIGHT_SOFT = 0xCCD6E2FF;  // cool moonlight for night text
    private static final int LOC_DARK = 0xFF0E5A66;        // teal accent on bright skies
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
