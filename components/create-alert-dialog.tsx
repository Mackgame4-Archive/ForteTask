"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogAction,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CreateAlertDialogProps = {
  error?: string | null;
  title?: string;
  cancelLabel?: string;
  actionLabel?: string | null;
  cancelVariant?: React.ComponentProps<typeof AlertDialogCancel>["variant"];
  actionVariant?: React.ComponentProps<typeof AlertDialogAction>["variant"];
  minify?: boolean;
};

export function CreateAlertDialog({
  error,
  title = "Something went wrong",
  cancelLabel = "OK",
  cancelVariant = "outline",
  actionLabel = null,
  actionVariant = "destructive",
  minify = false,
}: CreateAlertDialogProps) {
  const [dismissedError, setDismissedError] = React.useState<string | null>(null);
  const open = Boolean(error && error !== dismissedError);

  if (!error) {
    return null;
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setDismissedError(error);
        }
      }}
    >
      <AlertDialogContent size={minify ? "sm" : "default"}>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <TriangleAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{error}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter
          className={
            minify && !actionLabel
              ? "group-data-[size=sm]/alert-dialog-content:flex group-data-[size=sm]/alert-dialog-content:grid-cols-none"
              : undefined
          }
        >
          <AlertDialogCancel
            variant={cancelVariant}
            className={minify ? "w-full" : undefined}
          >
            {cancelLabel}
          </AlertDialogCancel>
          {actionLabel ? (
            <AlertDialogAction
              variant={actionVariant}
              className={minify ? "w-full" : undefined}
            >
              {actionLabel}
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
