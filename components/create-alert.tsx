import * as React from "react";
import {
  CircleCheck,
  Info,
  OctagonX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type CreateAlertType = "success" | "warn" | "info" | "error";

type CreateAlertProps = React.ComponentProps<typeof Alert> & {
  type?: CreateAlertType;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
};

const typeStyles: Record<
  CreateAlertType,
  {
    icon: LucideIcon;
    className: string;
    descriptionClassName: string;
  }
> = {
  success: {
    icon: CircleCheck,
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    descriptionClassName: "text-emerald-700/90 dark:text-emerald-300/90",
  },
  warn: {
    icon: TriangleAlert,
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    descriptionClassName: "text-amber-700/90 dark:text-amber-300/90",
  },
  info: {
    icon: Info,
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    descriptionClassName: "text-sky-700/90 dark:text-sky-300/90",
  },
  error: {
    icon: OctagonX,
    className:
      "border-destructive/30 bg-destructive/10 text-destructive",
    descriptionClassName: "text-destructive/90",
  },
};

export function CreateAlert({
  type = "info",
  title,
  description,
  action,
  children,
  className,
  ...props
}: CreateAlertProps) {
  const styles = typeStyles[type];
  const Icon = styles.icon;

  if (!title && !description && !children && !action) {
    return null;
  }

  return (
    <Alert
      variant={type === "error" ? "destructive" : "default"}
      className={cn(styles.className, className)}
      {...props}
    >
      <Icon />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {description ? (
        <AlertDescription className={styles.descriptionClassName}>
          {description}
        </AlertDescription>
      ) : null}
      {children}
      {action ? <AlertAction>{action}</AlertAction> : null}
    </Alert>
  );
}

export type { CreateAlertProps, CreateAlertType };
