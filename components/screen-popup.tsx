"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type ScreenPopupPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type ScreenPopup = {
  className?: string;
  content: ReactNode;
  id: string;
};

type ScreenPopupOptions = {
  className?: string;
  duration?: number;
  id?: string;
};

type ScreenPopupContextValue = {
  clear: () => void;
  hide: (position: ScreenPopupPosition) => void;
  show: (
    position: ScreenPopupPosition,
    content: ReactNode,
    options?: ScreenPopupOptions
  ) => string;
};

type ScreenPopupProviderProps = {
  children: ReactNode;
};

const screenPopupPositions: ScreenPopupPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const screenPopupPositionClassNames: Record<ScreenPopupPosition, string> = {
  "top-left": "items-start justify-start",
  "top-center": "items-start justify-center",
  "top-right": "items-start justify-end",
  "center-left": "items-center justify-start",
  center: "items-center justify-center",
  "center-right": "items-center justify-end",
  "bottom-left": "items-end justify-start",
  "bottom-center": "items-end justify-center",
  "bottom-right": "items-end justify-end",
};

const ScreenPopupContext = createContext<ScreenPopupContextValue | null>(null);

function createPopupId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ScreenPopupProvider({ children }: ScreenPopupProviderProps) {
  const [popups, setPopups] = useState<Partial<Record<ScreenPopupPosition, ScreenPopup>>>({});
  const timersRef = useRef<Partial<Record<ScreenPopupPosition, ReturnType<typeof setTimeout>>>>({});

  const clearTimer = useCallback((position: ScreenPopupPosition) => {
    const timer = timersRef.current[position];

    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[position];
    }
  }, []);

  const hide = useCallback((position: ScreenPopupPosition) => {
    clearTimer(position);
    setPopups((currentPopups) => {
      const nextPopups = { ...currentPopups };

      delete nextPopups[position];

      return nextPopups;
    });
  }, [clearTimer]);

  const clear = useCallback(() => {
    for (const position of screenPopupPositions) {
      clearTimer(position);
    }

    setPopups({});
  }, [clearTimer]);

  const show = useCallback(
    (
      position: ScreenPopupPosition,
      content: ReactNode,
      options: ScreenPopupOptions = {}
    ) => {
      const id = options.id ?? createPopupId();

      clearTimer(position);
      setPopups((currentPopups) => ({
        ...currentPopups,
        [position]: {
          className: options.className,
          content,
          id,
        },
      }));

      if (options.duration && options.duration > 0) {
        timersRef.current[position] = setTimeout(() => {
          hide(position);
        }, options.duration);
      }

      return id;
    },
    [clearTimer, hide]
  );

  const contextValue = useMemo(
    () => ({
      clear,
      hide,
      show,
    }),
    [clear, hide, show]
  );

  return (
    <ScreenPopupContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-50 grid p-4">
        {screenPopupPositions.map((position) => {
          const popup = popups[position];

          if (!popup) {
            return null;
          }

          return (
            <div
              key={position}
              className={cn(
                "fixed inset-0 flex p-4",
                screenPopupPositionClassNames[position]
              )}
            >
              <div className={cn("pointer-events-auto", popup.className)}>
                {popup.content}
              </div>
            </div>
          );
        })}
      </div>
    </ScreenPopupContext.Provider>
  );
}

function useScreenPopup() {
  const context = useContext(ScreenPopupContext);

  if (!context) {
    throw new Error("useScreenPopup must be used within a ScreenPopupProvider.");
  }

  return context;
}

export {
  ScreenPopupProvider,
  useScreenPopup,
  type ScreenPopupPosition,
  type ScreenPopupOptions,
};
