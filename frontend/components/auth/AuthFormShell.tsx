import Link from "next/link";

/**
 * Moldura comum de login/cadastro (card centrado + link de alternância),
 * para os dois formulários não duplicarem layout.
 */
interface AuthFormShellProps {
  title: string;
  subtitle: string;
  altText: string;
  altHref: string;
  altLabel: string;
  children: React.ReactNode;
}

export function AuthFormShell({ title, subtitle, altText, altHref, altLabel, children }: AuthFormShellProps) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-4 text-center text-sm text-text-secondary">
        {altText}{" "}
        <Link href={altHref} className="font-medium text-accent hover:underline">
          {altLabel}
        </Link>
      </p>
    </div>
  );
}

export const AUTH_INPUT_CLASSES =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent";

export const AUTH_LABEL_CLASSES = "text-sm font-medium text-text-primary";
