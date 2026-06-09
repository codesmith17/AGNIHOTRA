package com.eternalagni.app;

import com.eternalagni.app.support.AgniLog;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.RandomAccessFile;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Bridges the native, cross-process widget logs (written by {@link AgniLog})
 * into the web layer so they are merged into the single customer Support
 * Report JSON that the Support page already builds and shares.
 *
 * The widget runs in its own broadcast-receiver process, so its logs can never
 * reach the WebView's in-memory/localStorage log store directly — this plugin
 * lets {@code payload-builder.js} read them back at report-build time.
 */
@CapacitorPlugin(name = "AgniSupportLog")
public class AgniSupportLogPlugin extends Plugin {

    private static final String TAG_DEFAULT = "AGNIHOTRA";
    private static final int DEFAULT_LIMIT = 400;
    private static final int MAX_LIMIT = 1500;

    /** Append a single log record from JS into the shared bundle (optional). */
    @PluginMethod
    public void log(PluginCall call) {
        String level = call.getString("level", "I");
        String tag = call.getString("tag", TAG_DEFAULT);
        String message = call.getString("message", "");
        try {
            AgniLog.log(getContext(), level, tag, message);
        } catch (Throwable ignored) {
        }
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    /** Reports bundle existence / size for diagnostics UIs. */
    @PluginMethod
    public void getInfo(PluginCall call) {
        File f = AgniLog.file(getContext());
        File rotated = AgniLog.rotatedFile(getContext());
        long size = (f.exists() ? f.length() : 0L) + (rotated.exists() ? rotated.length() : 0L);

        JSObject result = new JSObject();
        result.put("path", f.getAbsolutePath());
        result.put("exists", f.exists() || rotated.exists());
        result.put("bytes", size);
        call.resolve(result);
    }

    /**
     * Returns the most recent native log lines as a single JSON-Lines string
     * ({@code text}). The JS side splits on newlines and JSON.parses each line.
     * Reads the tail of the current file (plus the rotated backup when the
     * current file is short) so the report captures recent widget activity
     * without shipping the whole bundle.
     */
    @PluginMethod
    public void readEntries(PluginCall call) {
        int limit = call.getInt("limit", DEFAULT_LIMIT);
        if (limit <= 0) limit = DEFAULT_LIMIT;
        if (limit > MAX_LIMIT) limit = MAX_LIMIT;

        Deque<String> lines = new ArrayDeque<>();
        try {
            tailInto(lines, AgniLog.file(getContext()), limit);
            if (lines.size() < limit) {
                Deque<String> older = new ArrayDeque<>();
                tailInto(older, AgniLog.rotatedFile(getContext()), limit - lines.size());
                // Prepend older history so the result stays chronological.
                while (!older.isEmpty() && lines.size() < limit) {
                    lines.addFirst(older.pollLast());
                }
            }
        } catch (Throwable ignored) {
        }

        StringBuilder sb = new StringBuilder();
        for (String line : lines) {
            sb.append(line).append('\n');
        }

        JSObject result = new JSObject();
        result.put("text", sb.toString());
        result.put("count", lines.size());
        call.resolve(result);
    }

    /** Wipes the native bundle (current + rotated backup). */
    @PluginMethod
    public void clear(PluginCall call) {
        AgniLog.clear(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    /** Reads up to {@code limit} trailing lines from a file (newest last). */
    private static void tailInto(Deque<String> out, File f, int limit) {
        if (f == null || !f.exists() || limit <= 0) return;
        try (RandomAccessFile raf = new RandomAccessFile(f, "r")) {
            long length = raf.length();
            // Cap the scan window so we never read an unbounded file into memory.
            long window = Math.min(length, 512L * 1024L);
            long start = length - window;
            raf.seek(start);
            // Skip a partial first line when we started mid-file.
            if (start > 0) raf.readLine();

            Deque<String> buffer = new ArrayDeque<>();
            String line;
            while ((line = raf.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                buffer.addLast(line);
                if (buffer.size() > limit) buffer.pollFirst();
            }
            out.addAll(buffer);
        } catch (Throwable ignored) {
        }
    }
}
