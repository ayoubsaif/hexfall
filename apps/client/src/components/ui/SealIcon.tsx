// Red wax seal with a gold X: the close mark for drawers and dialogs (public/ui/close-seal-gemini.webp,
// 192 px with transparency). Decorative: the button around it carries the accessible name.
export function SealIcon({ className }: { className?: string }) {
  return (
    <img
      src="/ui/close-seal-gemini.webp"
      alt=""
      aria-hidden="true"
      width={192}
      height={192}
      draggable={false}
      className={className}
    />
  );
}
