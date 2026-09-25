import { Link } from "react-router";

export function LegalLinks() {
  return (
    <nav
      aria-label="Legal"
      className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-tertiary"
    >
      <Link
        className="underline underline-offset-4 hover:text-primary"
        to="/privacy"
      >
        Privacy Policy
      </Link>
      <Link
        className="underline underline-offset-4 hover:text-primary"
        to="/terms"
      >
        Terms of Service
      </Link>
    </nav>
  );
}
