import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Borderless "View all →" text link for dashboard card headers.
export function ViewAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-pine underline-offset-4 transition-colors hover:text-pine-dark hover:underline"
    >
      View all <ArrowRight size={13} />
    </Link>
  );
}
