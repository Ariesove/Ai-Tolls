import * as React from "react";
import { cn } from "@/lib/utils";

// Assuming you might want to use radix-ui/react-slot later for polymorphism,
// but for now I'll stick to a simple button implementation to minimize dependencies if Radix isn't installed.
// Wait, I didn't install class-variance-authority or radix-ui. I should stick to simple props for now or install them.
// Let's implement a clean Button component without extra heavy deps for now, or just use standard tailwind classes.

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      secondary:
        "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus:ring-zinc-500",
      ghost:
        "bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100",
      danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-6 text-lg",
      icon: "h-10 w-10 p-2 flex items-center justify-center",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
