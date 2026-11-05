import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { installAudioUnlock } from "./audio/engine.ts";
import { applyInitialLanguage } from "./i18n/index.ts";
import { getConnection } from "./net/useConnection.ts";
import { registerServiceWorker } from "./notify/register.ts";
import { installMotionAttribute } from "./store/motion.ts";
import { installNotifySync, setNotifyDeps } from "./notify/sync.ts";
import "./style.css";

applyInitialLanguage();
installAudioUnlock();
installMotionAttribute();
setNotifyDeps({ send: (type, payload) => getConnection()?.send(type, payload as never) ?? false });
installNotifySync();
registerServiceWorker();

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
