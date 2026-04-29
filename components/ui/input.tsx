"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const BASE =
  "w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none transition focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed";
const INVALID = "border-red-500/60 focus:border-red-500";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(BASE, invalid && INVALID, className)} {...props} />;
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(BASE, "resize-none", invalid && INVALID, className)} {...props} />;
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(BASE, invalid && INVALID, className)} {...props}>
      {children}
    </select>
  );
});
