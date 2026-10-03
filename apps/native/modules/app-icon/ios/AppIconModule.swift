import ExpoModulesCore
import UIKit

public class AppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppIcon")

    AsyncFunction("getIcon") { () -> String in
      return UIApplication.shared.alternateIconName ?? "blue"
    }.runOnQueue(.main)

    AsyncFunction("setIcon") { (name: String, promise: Promise) in
      guard ["blue", "purple", "pink"].contains(name) else {
        promise.reject("INVALID_ICON", "Unknown app icon")
        return
      }
      let app = UIApplication.shared
      guard app.supportsAlternateIcons else {
        promise.reject("UNSUPPORTED", "Alternate icons are unavailable")
        return
      }
      let alternateName: String? = name == "blue" ? nil : name
      guard app.alternateIconName != alternateName else {
        promise.resolve(name)
        return
      }
      app.setAlternateIconName(alternateName) { error in
        if let error {
          promise.reject("ICON_CHANGE_FAILED", error.localizedDescription)
        } else {
          promise.resolve(name)
        }
      }
    }.runOnQueue(.main)
  }
}
