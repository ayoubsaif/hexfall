// Every client test starts in English, so text assertions stay stable.
import { beforeEach } from "vite-plus/test";
import { i18n } from "../src/i18n/index.ts";

beforeEach(async () => {
  if (i18n.language !== "en") await i18n.changeLanguage("en");
});
