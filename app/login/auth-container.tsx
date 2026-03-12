"use client";

import { useState } from "react";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { ToastContainer, useToast } from "@/lib/use-toast";

type AuthView = "login" | "signup";

export function AuthContainer() {
  const [view, setView] = useState<AuthView>("login");
  const { toasts, removeToast } = useToast();

  return (
    <>
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          {view === "login" ? (
            <LoginForm onSignupClick={() => setView("signup")} />
          ) : (
            <SignupForm onBackClick={() => setView("login")} />
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
