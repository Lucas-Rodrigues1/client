import { CheckCircle2, XCircle } from "lucide-react";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthCheckerProps {
  password: string;
  confirmPassword?: string;
}

export function PasswordStrengthChecker({
  password,
  confirmPassword,
}: PasswordStrengthCheckerProps) {
  const requirements: PasswordRequirement[] = [
    {
      label: "Mínimo 8 caracteres",
      met: password.length >= 8,
    },
    {
      label: "Contém número",
      met: /\d/.test(password),
    },
    {
      label: "Contém letra maiúscula",
      met: /[A-Z]/.test(password),
    },
    {
      label: "Contém símbolo (@, !, #, $, etc)",
      met: /[!@#$%^&*()_+=\-\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  ];

  const allRequirementsMet = requirements.every((req) => req.met);
  const passwordsMatch =
    !confirmPassword || password === confirmPassword || confirmPassword === "";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {requirements.map((requirement) => (
          <div key={requirement.label} className="flex items-center gap-2">
            {requirement.met ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span
              className={`text-sm ${
                requirement.met ? "text-green-600" : "text-red-600"
              }`}
            >
              {requirement.label}
            </span>
          </div>
        ))}
      </div>

      {confirmPassword && !passwordsMatch && (
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-600">Senhas não correspondem</span>
        </div>
      )}

      {confirmPassword && passwordsMatch && confirmPassword !== "" && (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-600">Senhas correspondem</span>
        </div>
      )}

      {allRequirementsMet && passwordsMatch && (
        <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400 text-sm">
          ✓ Senha forte!
        </div>
      )}
    </div>
  );
}
