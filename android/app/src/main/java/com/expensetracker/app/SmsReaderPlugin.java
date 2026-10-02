package com.expensetracker.app;

import android.Manifest;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/**
 * Reads the device SMS inbox for the user's own transaction import.
 *
 * Design notes:
 * - Sender filtering happens here, in SQL, not in JavaScript. The web layer
 *   only ever receives messages from senders the user explicitly listed, so a
 *   bug in the parser cannot leak unrelated private messages into the UI.
 * - A `date >= since` bound keeps the query scoped to a user-chosen window
 *   instead of walking the whole inbox.
 * - Nothing is written to the network. Raw message bodies never leave the
 *   device; only the fields the parser extracts are persisted.
 * - Captured messages from configured senders (see SmsReceiver) are queued
 *   device-locally and surfaced here for review. They are still never saved as
 *   transactions without the user approving each one.
 */
@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS },
            alias = "sms"
        )
    }
)
public class SmsReaderPlugin extends Plugin {

    /**
     * One alias covering both permissions, because the feature is unusable with
     * either one missing:
     * - READ_SMS is required to query the inbox and to read a broadcast body.
     * - RECEIVE_SMS is required for SMS_RECEIVED to be delivered at all, so
     *   requesting only READ_SMS would leave the auto-capture toggle silently
     *   doing nothing.
     */
    private static final String ALIAS = "sms";
    private static final String EVENT_PENDING = "smsPending";

    /** Body length beyond which parsing is refused, to bound user regexes. */
    private static final int MAX_BODY_CHARS = 4000;

    /** Hard ceiling on rows returned to the web layer in one call. */
    private static final int MAX_MESSAGES = 200;

    /**
     * Weak reference to the live plugin so the receiver can notify it when a
     * message arrives while the app is already open. Weak so a destroyed bridge
     * is not kept alive by a static field.
     */
    private static WeakReference<SmsReaderPlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    /**
     * Lets the receiver tell an open app that something is waiting, without
     * doing anything at all when the app is closed (the queue persists, and the
     * web layer drains it on next launch).
     */
    static void emitPendingIfLive(Context context) {
        SmsReaderPlugin plugin = instance.get();
        if (plugin == null) {
            return;
        }
        List<JSONObject> pending = SmsStore.pending(context);
        if (pending.isEmpty()) {
            return;
        }
        JSObject payload = new JSObject();
        payload.put("count", pending.size());
        try {
            plugin.notifyListeners(EVENT_PENDING, payload);
        } catch (Exception e) {
            // The bridge may already be tearing down; the queue is durable.
        }
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (isGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias(ALIAS, call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isGranted());
        call.resolve(ret);
    }

    /**
     * Persists the sender list and the auto-capture preference.
     *
     * The receiver has no access to the web layer, so this is how it learns
     * which senders are relevant. Called whenever rules change, and on launch.
     */
    @PluginMethod
    public void configure(final PluginCall call) {
        final JSArray addresses = call.getArray("addresses", new JSArray());
        final boolean autoCapture = Boolean.TRUE.equals(call.getBoolean("autoCapture", false));
        try {
            List<String> raw = new ArrayList<>();
            for (int i = 0; i < addresses.length(); i++) {
                String value = addresses.getString(i);
                if (value != null && !value.trim().isEmpty()) {
                    raw.add(value);
                }
            }
            SmsStore.saveConfig(getContext(), raw, autoCapture);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not save the SMS configuration: " + e.getMessage());
        }
    }

    /** Messages captured by the receiver, oldest first, awaiting review. */
    @PluginMethod
    public void getPending(PluginCall call) {
        JSArray messages = new JSArray();
        try {
            for (JSONObject message : SmsStore.pending(getContext())) {
                messages.put(toJsObject(message));
            }
            JSObject ret = new JSObject();
            ret.put("messages", messages);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read the pending SMS queue: " + e.getMessage());
        }
    }

    /** Clears queued messages once they are imported or dismissed. */
    @PluginMethod
    public void resolvePending(PluginCall call) {
        try {
            List<String> ids = new ArrayList<>();
            JSArray messages = call.getArray("ids", new JSArray());
            for (int i = 0; i < messages.length(); i++) {
                String id = messages.getString(i);
                if (id != null) {
                    ids.add(id);
                }
            }
            SmsStore.removePending(getContext(), ids);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not update the pending SMS queue: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPending(PluginCall call) {
        SmsStore.clearPending(getContext());
        call.resolve();
    }

    private static JSObject toJsObject(JSONObject source) {
        JSObject out = new JSObject();
        try {
            out.put("id", source.getString("id"));
            out.put("address", source.optString("address"));
            out.put("body", source.optString("body"));
            out.put("date", source.optLong("date"));
            out.put("read", source.optBoolean("read"));
        } catch (Exception e) {
            // Skip anything malformed rather than failing the whole batch.
        }
        return out;
    }

    /**
     * Returns inbox messages whose sender matches one of `addresses` and whose
     * timestamp is at or after `since` (epoch millis), newest first.
     */
    @PluginMethod
    public void readInbox(final PluginCall call) {
        if (!isGranted()) {
            call.reject("SMS permission has not been granted");
            return;
        }

        final List<String> terms = SmsSenderMatcher.terms(toStringList(call.getArray("addresses", new JSArray())));
        final long since = call.getLong("since", 0L);
        final int limit = (int) Math.min(Math.max(call.getInt("limit", 50), 1), MAX_MESSAGES);

        if (terms.isEmpty()) {
            // Refusing here is deliberate: an empty sender list must never turn
            // into "return the whole inbox".
            call.reject("At least one sender address is required");
            return;
        }

        final Context ctx = getContext();
        // ContentResolver queries must not run on the main thread.
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSArray messages = query(ctx, terms, since, limit);
                    JSObject ret = new JSObject();
                    ret.put("messages", messages);
                    call.resolve(ret);
                } catch (SecurityException e) {
                    call.reject("SMS permission was revoked: " + e.getMessage());
                } catch (Exception e) {
                    call.reject("Could not read the SMS inbox: " + e.getMessage());
                }
            }
        }).start();
    }

    private JSArray query(Context ctx, List<String> terms, long since, int limit) {
        Uri uri = Telephony.Sms.Inbox.CONTENT_URI;
        String[] projection = { "_id", "address", "body", "date", "read" };

        // Senders are OR-ed, not AND-ed: a message satisfies the query when it
        // comes from any one configured sender. An AND chain would require a
        // single address to match every configured sender, which is never true
        // and would silently return nothing.
        StringBuilder selection = new StringBuilder("date >= ? AND (");
        List<String> args = new ArrayList<>();
        args.add(Long.toString(since));
        for (int i = 0; i < terms.size(); i++) {
            if (i > 0) {
                selection.append(" OR ");
            }
            selection.append("address LIKE ? ESCAPE '\\'");
            args.add("%" + SmsSenderMatcher.escapeLike(terms.get(i)) + "%");
        }
        selection.append(")");

        // The row cap lives in the sortOrder's LIMIT, so `limit` must NOT also
        // appear in args: SQLite binds args positionally against placeholders and
        // rejects surplus values.
        JSArray out = new JSArray();
        Cursor cursor = ctx
            .getContentResolver()
            .query(uri, projection, selection.toString(), args.toArray(new String[0]), "date DESC LIMIT " + limit);
        if (cursor == null) {
            return out;
        }
        try {
            while (cursor.moveToNext()) {
                JSObject m = new JSObject();
                m.put("id", String.valueOf(cursor.getLong(0)));
                m.put("address", cursor.getString(1));
                String body = cursor.getString(2);
                m.put("body", body == null ? "" : body.substring(0, Math.min(body.length(), MAX_BODY_CHARS)));
                m.put("date", cursor.getLong(3));
                m.put("read", cursor.getInt(4) == 1);
                out.put(m);
            }
        } finally {
            cursor.close();
        }
        return out;
    }

    /**
     * Converts a JSArray of strings, returning an empty list on any malformed
     * value so bad input cannot reach the SQL builder.
     */
    private static List<String> toStringList(JSArray array) {
        List<String> out = new ArrayList<>();
        if (array == null) {
            return out;
        }
        try {
            for (int i = 0; i < array.length(); i++) {
                String value = array.getString(i);
                if (value != null) {
                    out.add(value);
                }
            }
        } catch (Exception e) {
            return new ArrayList<>();
        }
        return out;
    }

    /**
     * Both permissions must be held. getPermissionState reports GRANTED only
     * when every permission in the alias is granted, so a user who accepted
     * READ_SMS but declined RECEIVE_SMS is correctly treated as ungranted
     * rather than getting a screen that claims to work.
     */
    private boolean isGranted() {
        return getPermissionState(ALIAS) == PermissionState.GRANTED;
    }
}
