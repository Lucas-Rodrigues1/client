import { useState } from "react"
import { cn } from "@/lib/utils"
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
import { apiRepository } from "@/lib/api"
import { saveToken, saveUser } from "@/lib/auth"
import { useToast } from "@/lib/use-toast"
import { useRouter } from "next/navigation"

export function LoginForm({
  className,
  onSignupClick,
  ...props
}: React.ComponentProps<"div"> & { onSignupClick?: () => void }) {
  const router = useRouter()
  const { addToast } = useToast()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const response = await apiRepository.login({
      username,
      password,
    })

    if (response.success && response.data) {
      saveToken(response.data.token)
      saveUser(response.data.user)
      addToast(`Bem-vindo, ${response.data.user.name}!`, "success", 1000)
      setTimeout(() => {
        router.push("/dashboard")
      }, 1000)
    } else if (response.statusCode === 401) {
      addToast("Usuário ou senha incorretos", "error", 4000)
    } else if (response.statusCode === 400) {
      addToast(response.message || "Dados inválidos", "error", 4000)
    } else {
      addToast(response.message || "Erro ao fazer login", "error", 4000)
    }

    setLoading(false)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Acesse sua conta</CardTitle>
          <CardDescription>
            Insira seu nome de usuário e senha para acessar sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="userName">Nome de usuário</FieldLabel>
                <Input
                  id="userName"
                  type="text"
                  placeholder="lucasRodrigues"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="**********" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </Field>
              <Field>
                <Button 
                  type="submit" 
                  className="cursor-pointer"
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "Login"}
                </Button>
                <FieldDescription className="text-center">
                  ou Crie uma conta <button
                    type="button"
                    onClick={onSignupClick}
                    className="underline hover:text-primary cursor-pointer"
                  >
                    aqui
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
