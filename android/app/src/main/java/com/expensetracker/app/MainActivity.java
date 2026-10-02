package com.expensetracker.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before super.onCreate so the plugin is available to the
        // first JS evaluation after the bridge initialises.
        registerPlugin(SmsReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
