// Settings dialog (specs/client-settings): entry button, sections and every label and status.
export const settings = {
  open: "Settings",
  title: "Settings",
  description: "Language, sound, notifications, accessibility and credits.",
  close: "Close settings",
  sectionPicker: "Section",
  section: {
    language: "Language",
    sound: "Sound",
    notifications: "Notifications",
    accessibility: "Accessibility",
    about: "About",
  },
  language: {
    label: "Language",
    hint: "Changes every text at once and is remembered on this device.",
  },
  sound: {
    enabled: "Game sounds",
    enabledHint: "Dice rolls and the chime when your turn starts.",
    volume: "Volume",
    test: "Test sound",
  },
  notifications: {
    enabled: "Turn notifications",
    enabledHint: "Get an alert when it is your turn.",
    status: {
      onPush: "On. You are alerted even when the game tab is closed.",
      onTabOnly: "On. Alerts only work while the game tab is open.",
      off: "Off.",
      blocked:
        "Blocked by the browser. Allow notifications for this site in the browser's site settings, then come back.",
      unsupported: "This browser does not support notifications.",
    },
    iosHint: "On iPhone and iPad, add the game to your home screen to get notifications.",
  },
  accessibility: {
    motion: "Motion",
    motionHint: "Controls the dice throw, card and board animations.",
    system: "Follow system",
    reduce: "Reduce motion",
    full: "Full motion",
  },
  about: {
    version: "Version {{version}}",
    credits: "Credits",
    by: "by",
    otherAssets: "Other theme assets: ",
    themeAssets: "Theme assets: ",
    procedural: "built-in procedural shapes.",
    note: "Sounds are synthesized in the browser. Hexfall is a fan project and is not affiliated with any board game publisher.",
  },
} as const;
