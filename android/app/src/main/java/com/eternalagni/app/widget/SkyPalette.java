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
            0f, 3f, 5f, 6f, 6.75f, 7.5f, 9f, 11f, 12.5f, 14f, 15.5f, 17f, 18f, 18.75f, 19.5f, 21f, 24f
    };
    // Gradient TOP colours (upper sky) at each anchor. Realistic, desaturated
    // photographic-sky tones with a VISIBLE daily arc: navy night → soft dawn →
    // fresh morning blue → bright pale midday → warmer afternoon blue → golden →
    // sunset → rose dusk → night. No neon / cartoon saturation.
    // Blue peaks at midday (12.5) then the bluishness steadily eases off through
    // the afternoon — the upper sky shifts from clean blue toward a warmer,
    // greyer-lavender tone on the way to the golden hour.
    private static final int[] TOP = {
            0xFF0B1426, 0xFF0E1730, 0xFF223358, 0xFF46587E, 0xFF6E8AB6, 0xFF83A6CE,
            0xFF6FA0D6, 0xFF589AD8, 0xFF4F95DA, 0xFF6F95C8, 0xFF8C96B2, 0xFF98909E,
            0xFF6E7290, 0xFF4C5680, 0xFF303E64, 0xFF182742, 0xFF0B1426
    };
    // Gradient BOTTOM colours (horizon) at each anchor — warm at sunrise, pale
    // bright haze at midday, then the blue drains out after noon: neutral pale →
    // warm cream → amber/orange at sunset, deep blue at night.
    private static final int[] BOT = {
            0xFF131F38, 0xFF182A48, 0xFF3A4A6E, 0xFF9C7E7A, 0xFFE0A06A, 0xFFF0CE9A,
            0xFFC2DCEF, 0xFFBAD8EF, 0xFFD2E6F2, 0xFFD2D8D2, 0xFFDCC59A, 0xFFE6AB6E,
            0xFFD6864F, 0xFFA66E80, 0xFF564E70, 0xFF283E58, 0xFF131F38
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
