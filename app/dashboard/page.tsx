"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { removeToken, getUser } from "@/lib/auth"
import { Search, UserPlus, Send, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

type Conversation = {
  id: number
  username: string
  name: string
  lastMessage: string
  time: string
  unread: number
  online: boolean
}

type Message = {
  id: number
  text: string
  time: string
  own: boolean
}

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: 1, username: "ana_silva", name: "Ana Silva", lastMessage: "Oi, tudo bem?", time: "10:32", unread: 2, online: true },
  { id: 2, username: "carlos_dev", name: "Carlos Dev", lastMessage: "Viu o PR que mandei?", time: "09:15", unread: 0, online: false },
  { id: 3, username: "maria_ui", name: "Maria UI", lastMessage: "Quando vai terminar?", time: "Ontem", unread: 1, online: true },
  { id: 4, username: "pedro_back", name: "Pedro Back", lastMessage: "Deploy feito!", time: "Seg", unread: 0, online: false },
  { id: 5, username: "julia_qa", name: "Julia QA", lastMessage: "Encontrei um bug...", time: "Seg", unread: 3, online: true },
]

const MOCK_MESSAGES: Record<number, Message[]> = {
  1: [
    { id: 1, text: "Oi, tudo bem?", time: "10:30", own: false },
    { id: 2, text: "Tudo sim! E você?", time: "10:31", own: true },
    { id: 3, text: "Tudo ótimo! Vai aparecer hoje?", time: "10:32", own: false },
  ],
  2: [
    { id: 1, text: "Viu o PR que mandei?", time: "09:10", own: false },
    { id: 2, text: "Ainda não, vou dar uma olhada agora.", time: "09:15", own: true },
  ],
  3: [
    { id: 1, text: "Quando vai terminar aquela feature?", time: "Ontem", own: false },
    { id: 2, text: "Preciso de mais um dia", time: "Ontem", own: true },
    { id: 3, text: "Ok, me avisa quando estiver pronto", time: "Ontem", own: false },
  ],
  4: [
    { id: 1, text: "Deploy feito! Tá no ar", time: "Seg", own: false },
    { id: 2, text: "Ótimo! Obrigado!", time: "Seg", own: true },
  ],
  5: [
    { id: 1, text: "Encontrei um bug no formulário de login", time: "Seg", own: false },
    { id: 2, text: "Qual o comportamento esperado?", time: "Seg", own: true },
    { id: 3, text: "Quando digita errado não mostra mensagem de erro", time: "Seg", own: false },
    { id: 4, text: "Entendi, vou verificar", time: "Seg", own: true },
  ],
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function clearAllStorage() {
  localStorage.clear()
  sessionStorage.clear()
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim()
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; username: string; name: string } | null>(null)
  const [search, setSearch] = useState("")
  const [selectedConv, setSelectedConv] = useState<Conversation>(MOCK_CONVERSATIONS[0])
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES[1] ?? [])
  const [newMessage, setNewMessage] = useState("")
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredConvs = MOCK_CONVERSATIONS.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelectConv(conv: Conversation) {
    setSelectedConv(conv)
    setMessages(MOCK_MESSAGES[conv.id] ?? [])
  }

  function handleSendMessage() {
    if (!newMessage.trim()) return
    const msg: Message = {
      id: Date.now(),
      text: newMessage.trim(),
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      own: true,
    }
    setMessages((prev) => [...prev, msg])
    setNewMessage("")
  }

  function handleLogout() {
    clearAllStorage()
    removeToken()
    router.push("/login")
  }

  const displayName = user?.name ?? "Usuário"
  const displayUsername = user?.username ?? "username"

  return (
    <div className="flex flex-col h-screen bg-muted/30 overflow-hidden">
      {/* Navbar */}
      <div className="flex items-center justify-end px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2.5" ref={profileRef}>
          <div>
            <p className="text-sm font-semibold leading-none text-right">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5 text-right">@{displayUsername}</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              title="Meu perfil"
            >
              {getInitials(displayName)}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-11 z-50 w-44 rounded-xl bg-card ring-1 ring-foreground/10 shadow-lg py-1 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground">@{displayUsername}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="size-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 p-3 gap-3 overflow-hidden">
      {/* Sidebar */}
      <Card className="w-72 flex-none flex flex-col overflow-hidden gap-0 py-0">
        {/* Search + add */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="icon-sm" title="Adicionar amigo" className="cursor-pointer flex-none">
            <UserPlus className="size-4" />
          </Button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {filteredConvs.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Nenhuma conversa encontrada</p>
          ) : (
            filteredConvs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConv(conv)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors mb-0.5 cursor-pointer",
                  selectedConv.id === conv.id ? "bg-primary/10" : "hover:bg-muted"
                )}
              >
                <div className="relative flex-none">
                  <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                    {getInitials(conv.name)}
                  </div>
                  {conv.online && (
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-1">
                    <span className="text-sm font-medium truncate">{conv.name}</span>
                    <span className="text-[10px] text-muted-foreground flex-none">{conv.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center flex-none px-1">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden gap-0 py-0">
        {/* Chat header — selected contact */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="relative flex-none">
            <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
              {getInitials(selectedConv.name)}
            </div>
            {selectedConv.online && (
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">{selectedConv.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{selectedConv.online ? "online" : "offline"}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.own ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[65%] rounded-2xl px-3.5 py-2 text-sm",
                  msg.own
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                <p>{msg.text}</p>
                <p
                  className={cn(
                    "text-[10px] mt-0.5 text-right",
                    msg.own ? "text-primary-foreground/60" : "text-muted-foreground"
                  )}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="px-4 py-3 border-t border-border flex items-end gap-2">
          <Textarea
            placeholder={`Mensagem para ${selectedConv.name}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            className="resize-none flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            size="icon"
            className="cursor-pointer flex-none mb-0.5"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </Card>
      </div>
    </div>
  )
}

