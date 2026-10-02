package com.expensetracker.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.telephony.SmsMessage;
import java.util.List;

/**
 * Captures messages from the senders the user configured, so a transaction SMS
 * is not missed while the app is closed.
 *
 * Design notes:
 * - Nothing is saved to a transaction here. Capture only queues the message for
 *   the user to review, which is the whole point of the review-first flow.
 * - The sender check happens before the body is read. A message from anyone the
 *   user did not list is dropped without being stored or parsed.
 * - This receiver never marks a message as read. The inbox is the user's, and
 *   silently changing it would be a surprise and a data-integrity problem.
 * - `SMS_RECEIVED` is exempt from the Android 8 implicit-broadcast limits, so a
 *   manifest-declared receiver is the supported way to receive it. An app that
 *   is not the default SMS handler must use this action rather than
 *   `SMS_DELIVER`.
 */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }
        // Reading the body requires READ_SMS. RECEIVE_SMS is checked too: without
        // it the system would not have delivered this broadcast, so the mismatch
        // can only mean it was revoked between delivery and handling. Either way
        // there is nothing useful to do.
        if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED
                || context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        if (!SmsStore.autoCaptureEnabled(context)) {
            return;
        }

        List<String> terms = SmsStore.terms(context);
        if (terms.isEmpty()) {
            return;
        }

        SmsMessage[] messages = getMessages(intent);
        if (messages == null) {
            return;
        }
        for (SmsMessage message : messages) {
            if (message == null) {
                continue;
            }
            String address = message.getDisplayOriginatingAddress();
            if (!SmsSenderMatcher.matches(address, terms)) {
                continue;
            }
            SmsStore.enqueue(context, address, message.getDisplayMessageBody(), message.getTimestampMillis());
        }

        // If the app happens to be open, let it know there is something new.
        SmsReaderPlugin.emitPendingIfLive(context);
    }

    private SmsMessage[] getMessages(Intent intent) {
        try {
            Bundle extras = intent.getExtras();
            if (extras == null) {
                return null;
            }
            Object[] pdus = (Object[]) extras.get("pdus");
            if (pdus == null) {
                return null;
            }
            SmsMessage[] out = new SmsMessage[pdus.length];
            for (int i = 0; i < pdus.length; i++) {
                out[i] = SmsMessage.createFromPdu((byte[]) pdus[i]);
            }
            return out;
        } catch (Exception e) {
            // A malformed broadcast is not worth crashing the app over.
            return null;
        }
    }
}