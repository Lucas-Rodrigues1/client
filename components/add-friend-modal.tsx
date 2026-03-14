"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiRepository, UserResult } from "@/lib/api"
import { Search, UserPlus, X, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddFriendModalProps {
  onClose: () => void
  onRequestSent?: () => void
}

export function AddFriendModal({ onClose, onRequestSent }: AddFriendModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const res = await apiRepository.searchUsers(query.trim())
      setLoading(false)
      if (res.success && res.data) setResults(res.data)
      else setResults([])
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function handleSend(user: UserResult) {
    setErrorMsg(null)
    const res = await apiRepository.sendFriendRequest(user._id)
    if (res.success) {
      setSentIds((prev) => new Set(prev).add(user._id))
      onRequestSent?.()
    } else {
      setErrorMsg(res.message ?? "Erro ao enviar solicitação")
    }
  }

  function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card ring-1 ring-foreground/10 rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Adicionar amigo</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder="Buscar por nome ou @username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {errorMsg && <p className="text-xs text-destructive mt-1.5">{errorMsg}</p>}
        </div>

        <div className="px-2 pb-3 min-h-[60px] max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : query.trim() && results.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">Nenhum usuário encontrado</p>
          ) : (
            results.map((user) => {
              const sent = sentIds.has(user._id)
              return (
                <div
                  key={user._id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="size-8 rounded-full object-cover flex-none" />
                  ) : (
                    <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary flex-none">
                      {getInitials(user.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant={sent ? "secondary" : "default"}
                    disabled={sent}
                    onClick={() => handleSend(user)}
                    className={cn("cursor-pointer flex-none", sent && "pointer-events-none")}
                  >
                    {sent ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
