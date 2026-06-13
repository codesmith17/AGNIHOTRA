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
    // Gradient TOP colours (upper sky) at each anchor. Tuned from researched
    // time-of-day sky palettes for a richer, more photographic daily arc:
    // deep-navy night → indigo pre-dawn → blue-violet dawn → clean sky blue that
    // peaks vivid at solar noon → warm lavender afternoon → mauve golden hour →
    // deep violet sunset → indigo twilight → night. The upper sky stays cooler
    // than the horizon so sunrise/sunset reads as a warm glow low in the card.
    private static final int[] TOP = {
            0xFF0A1126, 0xFF0C1430, 0xFF202C58, 0xFF405288, 0xFF6E80BC, 0xFF82A8D8,
            0xFF5E9BDD, 0xFF4189D8, 0xFF2F78D0, 0xFF4A84CC, 0xFF8090BC, 0xFF8C7CA6,
            0xFF6E5E90, 0xFF4A3E7A, 0xFF2C2A5C, 0xFF162140, 0xFF0A1126
    };
    // Gradient BOTTOM colours (horizon) at each anchor — deep blue night, rosy
    // dawn blush warming to peach/cream, pale luminous haze through midday, then
    // the blue drains out after noon into hazy gold, a vivid orange sunset and a
    // rose-violet dusk before settling back to night.
    private static final int[] BOT = {
            0xFF0E1B34, 0xFF122142, 0xFF3A3C70, 0xFFC77E8A, 0xFFF4A65C, 0xFFFBD89E,
            0xFFC2E1F2, 0xFFB0D7F0, 0xFF9ECCED, 0xFFB2D0E6, 0xFFDBCBA6, 0xFFEDA968,
            0xFFF2843A, 0xFFC85E6E, 0xFF6B4A7A, 0xFF34325E, 0xFF0E1B34
    };

    private static final int INK_DARK = 0xFF20303F;       // deep slate for bright daytime skies
    private static final int INK_DARK_SOFT = 0xCC3A4A59;
    private static final int INK_LIGHT = 0xFFFFFFFF;       // for dark/dusk/night skies
    private static final int INK_LIGHT_SOFT = 0xCCD6E2FF;  // cool moonlight for night text
    private static final int LOC_DARK = 0xFF1C4E80;        // deep sky-blue accent on bright skies
    private static final int LOC_LIGHT = 0xFFB9D4FF;       // icy blue accent on dark skies

    // The hour-of-day the anchor curve is authored around: dawn warms up at ~6:00
    // and the golden/sunset band sits at ~18:00. When a place's real sunrise and
    // sunset are known, the actual clock time is warped onto this reference
    // timeline so the sunrise/sunset colours land at the real sun times instead
    // of a fixed 6am/6pm.
    private static final float REF_SUNRISE_HOUR = 6f;
    private static final float REF_SUNSET_HOUR = 18f;

    public static Sky now() {
        return at(currentHourOfDay());
    }

    /**
     * Like {@link #now()} but anchors the dawn/dusk colours to the place's actual
     * sunrise/sunset (given as local hours-of-day, 0..24). Daytime is stretched or
     * compressed between the two so e.g. a 7:30pm sunset shows the evening/sunset
     * palette around 7:30pm rather than at a fixed 6pm. Invalid inputs fall back
     * to the plain clock curve.
     */
    public static Sky now(float sunriseHour, float sunsetHour) {
        return at(warpHour(currentHourOfDay(), sunriseHour, sunsetHour));
    }

    private static float currentHourOfDay() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.HOUR_OF_DAY)
                + c.get(Calendar.MINUTE) / 60f
                + c.get(Calendar.SECOND) / 3600f;
    }

    /**
     * Maps a real clock hour onto the reference timeline with three linear
     * segments that pin local midnight (0/24), the real sunrise to
     * {@link #REF_SUNRISE_HOUR} and the real sunset to {@link #REF_SUNSET_HOUR}.
     */
    static float warpHour(float hour, float sunriseHour, float sunsetHour) {
        boolean valid = sunriseHour > 0f && sunsetHour > sunriseHour && sunsetHour < 24f;
        if (!valid) return hour;

        if (hour <= sunriseHour) {
            return REF_SUNRISE_HOUR * (hour / sunriseHour);
        }
        if (hour <= sunsetHour) {
            float frac = (hour - sunriseHour) / (sunsetHour - sunriseHour);
            return REF_SUNRISE_HOUR + (REF_SUNSET_HOUR - REF_SUNRISE_HOUR) * frac;
        }
        float frac = (hour - sunsetHour) / (24f - sunsetHour);
        return REF_SUNSET_HOUR + (24f - REF_SUNSET_HOUR) * frac;
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
