import { useKeyboard } from "@opentui/solid"
import { theme } from "./theme"

export interface LoginRequiredModalProps {
  onClose: () => void
}

export function LoginRequiredModal(props: LoginRequiredModalProps) {
  useKeyboard(() => props.onClose())

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={100}
      alignItems="center"
      justifyContent="center"
      backgroundColor={theme.splashBg}
    >
      <box width="80%" maxWidth={64} flexDirection="column" border borderColor={theme.logo} backgroundColor={theme.splashInputBg} padding={1}>
        <text fg={theme.text}>Sign in required</text>
        <box marginTop={1}>
          <text fg={theme.dim}>Run /login to sign in to a provider before chatting.</text>
        </box>
        <box marginTop={1}>
          <text fg={theme.dim}>Press any key to dismiss</text>
        </box>
      </box>
    </box>
  )
}
