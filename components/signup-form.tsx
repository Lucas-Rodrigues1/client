"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordStrengthChecker } from "@/components/password-strength-checker"
import { apiRepository } from "@/lib/api"
import { useToast } from "@/lib/use-toast"

export function SignupForm({ onBackClick, ...props }: React.ComponentProps<typeof Card> & { onBackClick?: () => void }) {
  const router = useRouter()
  const { addToast } = useToast()
  
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [usernameError, setUsernameError] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const passwordRequirements = {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasUpperCase: /[A-Z]/.test(password),
    hasSymbol: /[!@#$%^&*()_+=\-\[\]{};':"\\|,.<>\/?]/.test(password),
  }

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean)
  const passwordsMatch = password === confirmPassword && password !== ""
  const isFormValid = allRequirementsMet && passwordsMatch && name.trim() !== "" && username.trim() !== "" && usernameError === ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const response = await apiRepository.signup({
      name,
      username,
      password,
    })

    if (response.success) {
      addToast("Conta criada com sucesso! Redirecionando para login...", "success", 1800)
      setTimeout(() => {
        onBackClick?.()
      }, 1800)
    } else if (response.statusCode === 409) {
      addToast("Nome de usuário já existe", "error", 4000)
    } else if (response.statusCode === 400) {
      addToast(response.message || "Dados inválidos", "error", 4000)
    } else {
      addToast(response.message || "Erro ao criar conta", "error", 4000)
    }

    setLoading(false)
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input 
                id="name" 
                type="text" 
                placeholder="Lucas Eduardo" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="userName">Nome de Usuário</FieldLabel>
              <Input
                id="userName"
                type="text"
                placeholder="lucas_rodrigues"
                value={username}
                onChange={(e) => {
                const val = e.target.value
                if (/\s/.test(val)) {
                  setUsernameError("Nome de usuário inválido — espaços não são permitidos")
                } else {
                  setUsernameError("")
                  setUsername(val)
                }
              }}
                required
              />
              {usernameError && (
                <p className="text-sm text-red-500 mt-1">{usernameError}</p>
              )}
              <FieldDescription>
                Seu nome de usuário deve ser único
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite uma senha forte"
                required 
              />
              <FieldDescription>
                Sua senha deve conter pelo menos 8 caracteres, incluindo letra maiúscula, número e símbolo.
              </FieldDescription>
            </Field>
            {password && (
              <div className="mt-4">
                <PasswordStrengthChecker password={password} confirmPassword={confirmPassword} />
              </div>
            )}
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirmar Senha
              </FieldLabel>
              <Input 
                id="confirm-password" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme sua senha"
                required 
              />
              <FieldDescription>
                Por favor, confirme sua senha.
              </FieldDescription>
            </Field>
            <FieldGroup>
              <Field>
                <Button 
                  type="submit" 
                  className="cursor-pointer" 
                  disabled={!isFormValid || loading}
                >
                  {loading ? "Criando conta..." : isFormValid ? "Create Account" : "Preencha os requisitos da senha"}
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account? <button
                    type="button"
                    onClick={onBackClick}
                    className="underline hover:text-primary cursor-pointer"
                  >
                    Sign in
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
