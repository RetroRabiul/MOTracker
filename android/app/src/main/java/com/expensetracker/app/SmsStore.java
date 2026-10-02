package com.expensetracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Device-local storage for the SMS import feature.
 *
 * Two things live here, both in SharedPreferences because the incoming-message
 * receiver runs when the app may be dead and needs synchronous, reliable
 * storage:
 *
 * - The configured sender list, so the receiver can decide whether a message is
 *   even relevant while the app is not running.
 * - A small queue of messages captured from configured senders, so a message
 *   that arrives while the app is closed is not lost.
 *
 * Nothing here is ever sent to the network. Clearing app data removes both.
 */
final class SmsStore {

    private static final String PREFS = "sms_import_store";
    private static final String KEY_TERMS = "sender_terms";
    private static final String KEY_ENABLED = "auto_capture_enabled";
    private static final String KEY_PENDING = "pending_messages";

    /** Ceiling on the queue, so a long absence cannot grow storage unbounded. */
    private static final int MAX_PENDING = 50;
    /** Mirrors the parser's limit; longer bodies are truncated before storage. */
    private static final int MAX_BODY_CHARS = 4000;

    private SmsStore() {
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---- configuration -----------------------------------------------------

    static void saveConfig(Context ctx, List<String> addresses, boolean enabled) {
        prefs(ctx).edit()
            .putString(KEY_TERMS, new JSONArray(SmsSenderMatcher.terms(addresses)).toString())
            .putBoolean(KEY_ENABLED, enabled)
            .apply();
    }

    static List<String> terms(Context ctx) {
        return readStringList(prefs(ctx).getString(KEY_TERMS, "[]"));
    }

    static boolean autoCaptureEnabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_ENABLED, false);
    }

    // ---- pending queue -----------------------------------------------------

    /**
     * Appends a captured message unless it is already queued.
     *
     * The id is a digest rather than a provider row id: an SMS_RECEIVED
     * broadcast carries no row id, and the same message can be delivered more
     * than once. The `p` prefix keeps it from ever colliding with the numeric
     * ids used by the inbox query.
     */
    static synchronized boolean enqueue(Context ctx, String address, String body, long timestamp) {
        if (body == null || body.trim().isEmpty()) {
            return false;
        }
        String id = "p" + digest(address + "|" + body + "|" + timestamp);
        JSONArray queue = readArray(prefs(ctx).getString(KEY_PENDING, "[]"));
        for (int i = 0; i < queue.length(); i++) {
            if (id.equals(queue.optJSONObject(i).optString("id"))) {
                return false; // already waiting
            }
        }
        JSONObject message = new JSONObject();
        try {
            message.put("id", id);
            message.put("address", address == null ? "" : address);
            message.put("body", body.substring(0, Math.min(body.length(), MAX_BODY_CHARS)));
            message.put("date", timestamp);
            message.put("read", false);
        } catch (Exception e) {
            return false;
        }
        queue.put(message);
        // Drop oldest first when over the ceiling.
        while (queue.length() > MAX_PENDING) {
            queue.remove(0);
        }
        prefs(ctx).edit().putString(KEY_PENDING, queue.toString()).apply();
        return true;
    }

    /** Returns the queued messages oldest first, without clearing them. */
    static synchronized List<JSONObject> pending(Context ctx) {
        JSONArray queue = readArray(prefs(ctx).getString(KEY_PENDING, "[]"));
        List<JSONObject> out = new ArrayList<>();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject o = queue.optJSONObject(i);
            if (o != null) {
                out.add(o);
            }
        }
        return out;
    }

    /** Removes the given ids once they have been imported or dismissed. */
    static synchronized void removePending(Context ctx, List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        JSONArray queue = readArray(prefs(ctx).getString(KEY_PENDING, "[]"));
        JSONArray kept = new JSONArray();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject o = queue.optJSONObject(i);
            if (o != null && !ids.contains(o.optString("id"))) {
                kept.put(o);
            }
        }
        prefs(ctx).edit().putString(KEY_PENDING, kept.toString()).apply();
    }

    static synchronized void clearPending(Context ctx) {
        prefs(ctx).edit().putString(KEY_PENDING, "[]").apply();
    }

    // ---- helpers -----------------------------------------------------------

    private static JSONArray readArray(String raw) {
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static List<String> readStringList(String raw) {
        List<String> out = new ArrayList<>();
        JSONArray array = readArray(raw);
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, null);
            if (value != null && !value.trim().isEmpty()) {
                out.add(value);
            }
        }
        return out;
    }

    private static String digest(String input) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] bytes = sha.digest(input.getBytes("UTF-8"));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 8; i++) {
                hex.append(String.format("%02x", bytes[i]));
            }
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }
}