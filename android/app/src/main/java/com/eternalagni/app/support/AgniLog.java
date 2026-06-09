package com.eternalagni.app.support;

import android.content.Context;
import android.os.Build;
import android.os.Process;
import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Lightweight, process-safe diagnostic logger that appends JSON-Lines (one JSON
 * object per line) to a single support-bundle file under the app's external
 * files directory:
 *
 *   /Android/data/&lt;applicationId&gt;/files/support/agni-support.jsonl
 *
 * Both the WebView (app) process and the widget's broadcast-receiver process
 * write to the same file, so a single bundle captures the full picture for
 * customer support. Every entry is also mirrored to logcat.
 *
 * The file is shareable via the existing FileProvider (see AndroidManifest /
 * file_paths.xml) so a customer can export it from the Support page.
 */
public final class AgniLog {

    private static final String DIR = "support";
    private static final String FILE = "agni-support.jsonl";
    private static final String ROTATED = "agni-support.1.jsonl";
    /** Rotate the active file once it grows past this size (keep one backup). */
    private static final long MAX_BYTES = 1024L * 1024L; // 1 MB

    private static final SimpleDateFormat ISO =
            new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US);

    private static final Object LOCK = new Object();

    private AgniLog() {}

    public static void i(Context ctx, String tag, String msg) {
        Log.i(tag, msg);
        write(ctx, "I", tag, msg);
    }

    public static void w(Context ctx, String tag, String msg) {
        Log.w(tag, msg);
        write(ctx, "W", tag, msg);
    }

    public static void w(Context ctx, String tag, String msg, Throwable t) {
        Log.w(tag, msg, t);
        write(ctx, "W", tag, msg + " :: " + Log.getStackTraceString(t));
    }

    public static void e(Context ctx, String tag, String msg, Throwable t) {
        Log.e(tag, msg, t);
        write(ctx, "E", tag, msg + (t != null ? " :: " + Log.getStackTraceString(t) : ""));
    }

    /**
     * Generic entry point used by the JS bridge so web-layer logs land in the
     * same bundle. {@code level} is one of I/W/E (defaults to I).
     */
    public static void log(Context ctx, String level, String tag, String msg) {
        String lvl = level == null ? "I" : level.trim().toUpperCase(Locale.US);
        switch (lvl) {
            case "E": Log.e(tag, msg); break;
            case "W": Log.w(tag, msg); break;
            default: lvl = "I"; Log.i(tag, msg); break;
        }
        write(ctx, lvl, tag, msg);
    }

    /** The active support log file (created lazily). */
    public static File file(Context ctx) {
        File dir = new File(ctx.getExternalFilesDir(null), DIR);
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return new File(dir, FILE);
    }

    public static File rotatedFile(Context ctx) {
        return new File(file(ctx).getParentFile(), ROTATED);
    }

    /** Deletes the current bundle (and its rotated backup). */
    public static void clear(Context ctx) {
        synchronized (LOCK) {
            try {
                File f = file(ctx);
                if (f.exists()) //noinspection ResultOfMethodCallIgnored
                    f.delete();
                File r = rotatedFile(ctx);
                if (r.exists()) //noinspection ResultOfMethodCallIgnored
                    r.delete();
            } catch (Throwable ignored) {
            }
        }
    }

    private static void write(Context ctx, String level, String tag, String msg) {
        if (ctx == null) return;
        final String line;
        try {
            JSONObject o = new JSONObject();
            long now = System.currentTimeMillis();
            o.put("ts", now);
            o.put("iso", ISO.format(new Date(now)));
            o.put("level", level);
            o.put("tag", tag == null ? "" : tag);
            o.put("proc", processName());
            o.put("pid", Process.myPid());
            o.put("msg", msg == null ? "" : msg);
            line = o.toString();
        } catch (Throwable t) {
            // Never let logging crash the caller.
            return;
        }

        synchronized (LOCK) {
            try {
                File f = file(ctx.getApplicationContext());
                rotateIfNeeded(f);
                appendLine(f, line);
            } catch (Throwable ignored) {
                // Best-effort: a logging failure must never break the app/widget.
            }
        }
    }

    private static void appendLine(File f, String line) throws IOException {
        // Append the whole line (with newline) in one write under an OS-level
        // file lock so the two processes never interleave a single record.
        try (FileOutputStream fos = new FileOutputStream(f, true)) {
            FileChannel channel = fos.getChannel();
            FileLock lock = null;
            try {
                lock = channel.lock();
                fos.write((line + "\n").getBytes("UTF-8"));
                fos.flush();
            } finally {
                if (lock != null) {
                    try { lock.release(); } catch (Throwable ignored) {}
                }
            }
        }
    }

    private static void rotateIfNeeded(File f) {
        try {
            if (f.exists() && f.length() > MAX_BYTES) {
                File rotated = new File(f.getParentFile(), ROTATED);
                if (rotated.exists()) //noinspection ResultOfMethodCallIgnored
                    rotated.delete();
                //noinspection ResultOfMethodCallIgnored
                f.renameTo(rotated);
            }
        } catch (Throwable ignored) {
        }
    }

    private static String processName() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                String name = android.app.Application.getProcessName();
                if (name != null) {
                    int colon = name.indexOf(':');
                    return colon >= 0 ? name.substring(colon + 1) : "main";
                }
            }
        } catch (Throwable ignored) {
        }
        return "p" + Process.myPid();
    }
}
