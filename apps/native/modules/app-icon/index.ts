import { requireOptionalNativeModule } from "expo";

export type AppIconName = "blue" | "purple" | "pink";

export default requireOptionalNativeModule<{
  getIcon(): Promise<AppIconName>;
  setIcon(name: AppIconName): Promise<AppIconName>;
}>("AppIcon");
