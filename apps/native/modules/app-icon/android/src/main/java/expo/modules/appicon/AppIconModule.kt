package expo.modules.appicon

import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppIconModule : Module() {
  private val icons = listOf("blue", "purple", "pink")

  override fun definition() = ModuleDefinition {
    Name("AppIcon")

    AsyncFunction("getIcon") {
      val context = requireNotNull(appContext.reactContext)
      val pm = context.packageManager
      icons.firstOrNull { name ->
        val state = pm.getComponentEnabledSetting(ComponentName(context, "${context.packageName}.Icon_$name"))
        state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
          (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && name == "blue")
      } ?: "blue"
    }

    AsyncFunction("setIcon") { name: String ->
      require(name in icons) { "Unknown app icon" }
      val context = requireNotNull(appContext.reactContext)
      val pm = context.packageManager
      fun component(icon: String) = ComponentName(context, "${context.packageName}.Icon_$icon")
      if (Build.VERSION.SDK_INT >= 33) {
        pm.setComponentEnabledSettings(icons.map { icon ->
          PackageManager.ComponentEnabledSetting(
            component(icon),
            if (icon == name) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
          )
        })
      } else {
        // Enable the new launcher before disabling others so an entry always exists.
        pm.setComponentEnabledSetting(component(name), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
        icons.filter { it != name }.forEach {
          pm.setComponentEnabledSetting(component(it), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
        }
      }
      name
    }
  }
}
