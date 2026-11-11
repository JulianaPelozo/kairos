package br.com.kairos.app

import android.os.Bundle
import br.com.kairos.app.notifier.KairosNotifierPlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(KairosNotifierPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
