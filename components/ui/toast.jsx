"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const ToastContext = React.createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const addToast = React.useCallback((toast) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 5000);
  }, []);

  const removeToast = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-5 bg-background",
            toast.variant === "success" && "border-emerald-500",
            toast.variant === "error" && "border-red-500",
            toast.variant === "warning" && "border-amber-500"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              {toast.title && (
                <p className="text-sm font-semibold">{toast.title}</p>
              )}
              {toast.description && (
                <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
