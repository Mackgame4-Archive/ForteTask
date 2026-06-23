"use client";

import { useRef, useState, type DragEvent, type InputHTMLAttributes } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FileInputMode = "input" | "input-button" | "dropzone";

type FileInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "type" | "value"
> & {
  buttonText?: string;
  dropzoneText?: string;
  mode?: FileInputMode;
  onFileChange?: (file: File | null) => void;
};

export function FileInput({
  accept,
  buttonText = "Escolher ficheiro",
  className,
  disabled,
  dropzoneText = "Arraste um ficheiro para aqui ou clique para escolher.",
  id,
  mode = "input",
  name,
  onFileChange,
  required,
  ...props
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function updateFile(file: File | null) {
    setFileName(file?.name ?? "");
    onFileChange?.(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (disabled) {
      return;
    }

    const file = event.dataTransfer.files.item(0);

    if (!file) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    if (inputRef.current) {
      inputRef.current.files = dataTransfer.files;
    }

    updateFile(file);
  }

  const input = (
    <Input
      {...props}
      ref={inputRef}
      id={id}
      name={name}
      type="file"
      accept={accept}
      disabled={disabled}
      required={required}
      className={cn(mode !== "input" && "sr-only", className)}
      onChange={(event) => updateFile(event.target.files?.item(0) ?? null)}
    />
  );

  if (mode === "input") {
    return input;
  }

  if (mode === "input-button") {
    return (
      <div className="flex min-w-0 gap-2">
        <Input
          {...props}
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          disabled={disabled}
          required={required}
          className={cn("min-w-0 flex-1", className)}
          onChange={(event) => updateFile(event.target.files?.item(0) ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {buttonText}
        </Button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "flex min-h-28 flex-col items-center justify-center gap-2 border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
        isDragging && "border-primary bg-primary/5 text-foreground",
        disabled && "pointer-events-none opacity-50"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      {input}
      <Upload className="size-5" />
      <span>{fileName || dropzoneText}</span>
    </div>
  );
}

export type { FileInputMode };
