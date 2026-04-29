"use client";
import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      richColors
      theme="dark"
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-foreground !border !border-border !rounded-xl !shadow-lg",
          title: "!font-semibold !tracking-tight",
          description: "!text-muted-foreground !text-sm",
          actionButton:
            "!bg-emerald !text-white hover:!brightness-110 !rounded-md !px-2.5 !py-1 !text-xs",
          cancelButton:
            "!bg-secondary !text-secondary-foreground !rounded-md !px-2.5 !py-1 !text-xs",
          success: "!border-emerald/40",
          error: "!border-destructive/50",
        },
        style: {
          // emerald accent ring on hover
        },
      }}
    />
  );
}
