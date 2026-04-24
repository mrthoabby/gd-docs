// [SELFHOST PATCH] El banner de "Enable AFFiNE Cloud" fue suprimido.
// El componente se mantiene por compatibilidad de tipos pero no renderiza nada.

type LocalDemoTipsProps = {
  isLoggedIn: boolean;
  onLogin: () => void;
  onEnableCloud: () => void;
  onClose: () => void;
};

export const LocalDemoTips = (_props: LocalDemoTipsProps) => {
  // Suprimido en modo self-hosted. Los datos se sincronizan al servidor propio.
  return null;
};

export default LocalDemoTips;
