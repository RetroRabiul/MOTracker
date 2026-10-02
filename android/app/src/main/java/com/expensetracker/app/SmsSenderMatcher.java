package com.expensetracker.app;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Sender normalisation shared by the inbox query and the incoming-message
 * receiver, so both agree on what "the same sender" means.
 *
 * Kept free of Android and Capacitor types so the matching rules live in one
 * place instead of drifting between two implementations.
 */
final class SmsSenderMatcher {

    private SmsSenderMatcher() {
    }

    /**
     * Reduces a configured sender to a substring that will match the way that
     * sender is actually stored.
     *
     * Operators write `+8801712345678`, `01712345678` and `8801712345678` for
     * the same SIM, and a message may carry any of them. Matching on the
     * trailing significant digits reconciles all three. Alphanumeric senders
     * such as `bKash` are matched case-insensitively as substrings.
     */
    static List<String> terms(List<String> addresses) {
        Set<String> unique = new LinkedHashSet<>();
        if (addresses == null) {
            return new ArrayList<>();
        }
        for (String raw : addresses) {
            if (raw == null) {
                continue;
            }
            String cleaned = raw.trim();
            if (cleaned.isEmpty()) {
                continue;
            }
            StringBuilder digits = new StringBuilder();
            for (char c : cleaned.toCharArray()) {
                if (Character.isDigit(c)) {
                    digits.append(c);
                }
            }
            if (digits.length() >= 6) {
                String d = digits.toString();
                // Drop a 00 international prefix, then keep the national number.
                String national = d.startsWith("00") ? d.substring(2) : d;
                if (national.length() > 10) {
                    national = national.substring(national.length() - 10);
                }
                unique.add(national);
            } else {
                // Short codes and alphanumeric sender ids.
                unique.add(cleaned.toUpperCase(Locale.ROOT));
            }
        }
        return new ArrayList<>(unique);
    }

    /**
     * Whether an inbound sender matches any configured term.
     *
     * Used by the receiver so a message from anyone else is dropped without
     * being stored, read as text, or surfaced to the web layer.
     */
    static boolean matches(String address, List<String> terms) {
        if (address == null || terms == null || terms.isEmpty()) {
            return false;
        }
        String upper = address.trim().toUpperCase(Locale.ROOT);
        String digits = upper.replaceAll("\\D", "");
        for (String term : terms) {
            if (term == null || term.isEmpty()) {
                continue;
            }
            if (upper.contains(term.toUpperCase(Locale.ROOT))) {
                return true;
            }
            String termDigits = term.replaceAll("\\D", "");
            // A numeric sender is compared on trailing digits so that
            // `+8801712345678` and `01712345678` are recognised as one sender.
            if (termDigits.length() >= 6 && digits.length() >= 6
                && digits.endsWith(termDigits.length() > 10
                    ? termDigits.substring(termDigits.length() - 10)
                    : termDigits)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Escapes LIKE wildcards so a sender containing `%` or `_` is matched
     * literally. Without this, `B_Trade` would also match `BTrade`, quietly
     * widening which messages reach the app.
     */
    static String escapeLike(String term) {
        return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}