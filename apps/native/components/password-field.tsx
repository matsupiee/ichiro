import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { Platform, Pressable, type TextInput, type TextInputProps } from "react-native";

import { Field } from "@/components/ui";
import { colors } from "@/lib/theme";

export const PasswordField = forwardRef<TextInput, TextInputProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    // iOS の新規パスワード自動生成と secureTextEntry の組み合わせでは、
    // 入力が置き換わることがあるため、新規入力時の自動補完を無効にする。
    const disableNewPasswordAutofill =
      Platform.OS === "ios" && props.textContentType === "newPassword";
    return (
      <Field
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="パスワード"
        testID="password-input"
        {...props}
        textContentType={disableNewPasswordAutofill ? "none" : props.textContentType}
        autoComplete={disableNewPasswordAutofill ? "off" : props.autoComplete}
        secureTextEntry={!visible}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "パスワードを隠す" : "パスワードを表示"}
            accessibilityState={{ checked: visible }}
            onPress={() => setVisible((value) => !value)}
            style={{
              width: 44,
              height: 44,
              marginRight: -14,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={colors.mute}
            />
          </Pressable>
        }
      />
    );
  },
);
