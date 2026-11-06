package com.uncoach.untimer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // la voce del coach e i bip partono durante il timer, senza un tocco sullo schermo
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
