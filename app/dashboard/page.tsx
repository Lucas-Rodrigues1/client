"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { removeToken, getUser } from "@/lib/auth"
import { apiRepository, ConversationItem, MessageItem, FriendRequest, FriendItem } from "@/lib/api"
import { socketService } from "@/lib/socket"
import { AddFriendModal } from "@/components/add-friend-modal"
import {
  Search,
  UserPlus,
  Send,
  LogOut,
  Bell,
  Check,
  X,
  MoreHorizontal,
  Archive,
  Trash2,
  Users,
  MessageSquare,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// --- Types ---

type UserStatus = "online" | "offline" | "ausente" | "ocupado"

interface LocalMessage {
  _id: string
  sender: { _id: string; username: string; name?: string }
  content: string
  createdAt: string
  pending?: boolean
  failed?: boolean
}

interface StoredUser {
  id: string
  username: string
  name: string
}

// --- Helpers ---

function getInitials(name: string) {
  if (!name) return "?"
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

function getOtherParticipant(conv: ConversationItem, myId: string) {
  return conv.participants.find((p) => p._id !== myId) ?? conv.participants[0]
}

function getFriendUser(f: FriendItem, myId: string) {
  return f.requester._id === myId ? f.recipient : f.requester
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

const STATUS_LABELS: Record<UserStatus, string> = {
  online: "Online",
  ausente: "Ausente",
  ocupado: "Ocupado",
  offline: "Offline",
}

const STATUS_COLORS: Record<UserStatus, string> = {
  online: "bg-green-500",
  ausente: "bg-yellow-400",
  ocupado: "bg-red-500",
  offline: "bg-gray-400",
}

function StatusDot({ status, className }: { status?: UserStatus; className?: string }) {
  const s = status ?? "offline"
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-card",
        STATUS_COLORS[s],
        className
      )}
    />
  )
}

// --- Dashboard ---

type SidebarTab = "chats" | "friends"

export default function DashboardPage() {
  const router = useRouter()

  // User
  const [user, setUser] = useState<StoredUser | null>(null)
  const [myStatus, setMyStatus] = useState<UserStatus>("online")

  // Sidebar
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats")
  const [search, setSearch] = useState("")

  // Conversations
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [convLoading, setConvLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null)

  // Messages
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Typing
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [remoteTyping, setRemoteTyping] = useState<Record<string, boolean>>({})

  // Friends
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)

  // Online statuses keyed by userId
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({})

  // Friend requests
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [requestsOpen, setRequestsOpen] = useState(false)
  const requestsRef = useRef<HTMLDivElement>(null)

  // Add friend modal
  const [addFriendOpen, setAddFriendOpen] = useState(false)

  // Context menu (archive/delete conversation)
  const [contextMenu, setContextMenu] = useState<{ convId: string; x: number; y: number } | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)

  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const displayName = user?.name ?? "Usuário"
  const displayUsername = user?.username ?? "username"

  // --- Init ---

  useEffect(() => {
    const u = getUser()
    setUser(u)
  }, [])

  useEffect(() => {
    if (!user) return
    loadConversations()
    loadFriendRequests()
    socketService.connect()
    return () => socketService.disconnect()
  }, [user])

  // --- Socket listeners ---

  useEffect(() => {
    const offMsgNew = socketService.on<{
      _id: string; conversationId: string; sender: { id: string; username: string }; content: string; createdAt: string
    }>("message:new", (data) => {
      const msg: LocalMessage = {
        _id: data._id,
        sender: { _id: data.sender.id, username: data.sender.username },
        content: data.content,
        createdAt: data.createdAt,
      }
      setMessages((prev) => {
        if (selectedConvRef.current?._id === data.conversationId) {
          return [...prev, msg]
        }
        return prev
      })
      if (!conversationIdsRef.current.has(data.conversationId)) {
        // This is a brand-new conversation for this user (first message ever)
        // Reload the full list so it appears in the sidebar
        loadConversations()
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c._id === data.conversationId
              ? { ...c, lastMessage: { _id: data._id, content: data.content, sender: data.sender.id, createdAt: data.createdAt }, updatedAt: data.createdAt }
              : c
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        )
      }
    })

    const offMsgAck = socketService.on<{
      _id: string; conversationId: string; sender: { id: string; username: string }; content: string; tempId: string; createdAt: string
    }>("message:ack", (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.tempId
            ? { _id: data._id, sender: { _id: data.sender.id, username: data.sender.username }, content: data.content, createdAt: data.createdAt }
            : m
        )
      )
      setConversations((prev) =>
        prev.map((c) =>
          c._id === data.conversationId
            ? { ...c, lastMessage: { _id: data._id, content: data.content, sender: data.sender.id, createdAt: data.createdAt }, updatedAt: data.createdAt }
            : c
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      )
    })

    const offMsgErr = socketService.on<{ tempId: string; error: string }>("message:error", (data) => {
      setMessages((prev) => prev.map((m) => m._id === data.tempId ? { ...m, pending: false, failed: true } : m))
    })

    const offTypingStart = socketService.on<{ conversationId: string }>("typing:start", (data) => {
      setRemoteTyping((prev) => ({ ...prev, [data.conversationId]: true }))
    })

    const offTypingStop = socketService.on<{ conversationId: string }>("typing:stop", (data) => {
      setRemoteTyping((prev) => ({ ...prev, [data.conversationId]: false }))
    })

    const offFriendReq = socketService.on<{ friendshipId: string; requesterId: string }>("friend:request", () => {
      loadFriendRequests()
    })

    const offFriendAcc = socketService.on<{ friendshipId: string }>("friend:accepted", () => {
      loadFriends()
      loadConversations()
    })

    const offUserStatus = socketService.on<{ userId: string; username: string; status: UserStatus }>("user:status", (data) => {
      setUserStatuses((prev) => ({ ...prev, [data.userId]: data.status }))
    })

    return () => {
      offMsgNew(); offMsgAck(); offMsgErr()
      offTypingStart(); offTypingStop()
      offFriendReq(); offFriendAcc()
      offUserStatus()
    }
  }, [])

  // Ref to track selectedConv inside socket callbacks
  const selectedConvRef = useRef<ConversationItem | null>(null)
  useEffect(() => { selectedConvRef.current = selectedConv }, [selectedConv])

  // Ref to track known conversation IDs inside socket callbacks
  const conversationIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map(c => c._id))
  }, [conversations])

  // --- Click-outside closers ---

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (requestsRef.current && !requestsRef.current.contains(e.target as Node)) setRequestsOpen(false)
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // --- Data loaders ---

  async function loadConversations() {
    setConvLoading(true)
    const res = await apiRepository.listConversations()
    setConvLoading(false)
    if (res.success && res.data) setConversations(res.data)
  }

  async function loadFriendRequests() {
    const res = await apiRepository.listFriendRequests()
    if (res.success && res.data) setFriendRequests(res.data)
  }

  async function loadFriends() {
    setFriendsLoading(true)
    const res = await apiRepository.listFriends()
    setFriendsLoading(false)
    if (res.success && res.data) setFriends(res.data)
  }

  // --- Conversation selection ---

  async function handleSelectConv(conv: ConversationItem) {
    setSelectedConv(conv)
    setMessages([])
    setMsgLoading(true)
    const res = await apiRepository.getMessages(conv._id)
    setMsgLoading(false)
    if (res.success && res.data) {
      setMessages([...res.data].reverse().map((m: MessageItem) => ({
        _id: m._id,
        sender: m.sender,
        content: m.content,
        createdAt: m.createdAt,
      })))
    }
  }

  // --- Start conversation from friends tab ---

  async function handleStartChat(friendId: string) {
    const res = await apiRepository.startConversation(friendId)
    if (res.success && res.data) {
      const conv = res.data
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conv._id)
        return exists ? prev : [conv, ...prev]
      })
      setSidebarTab("chats")
      handleSelectConv(conv)
    }
  }

  // --- Send message ---

  function handleSendMessage() {
    if (!newMessage.trim() || !selectedConv || !user) return
    const tempId = `temp_${Date.now()}`
    const optimistic: LocalMessage = {
      _id: tempId,
      sender: { _id: user.id, username: user.username, name: user.name },
      content: newMessage.trim(),
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setNewMessage("")
    clearTimeout(typingTimerRef.current)
    socketService.emit("typing:stop", { conversationId: selectedConv._id })
    socketService.emit("message:send", { conversationId: selectedConv._id, content: optimistic.content, tempId })
  }

  // --- Typing indicator ---

  function handleTyping(value: string) {
    setNewMessage(value)
    if (!selectedConv) return
    clearTimeout(typingTimerRef.current)
    if (value.trim()) {
      socketService.emit("typing:start", { conversationId: selectedConv._id })
      typingTimerRef.current = setTimeout(() => {
        socketService.emit("typing:stop", { conversationId: selectedConv._id })
      }, 2000)
    } else {
      socketService.emit("typing:stop", { conversationId: selectedConv._id })
    }
  }

  // --- Friend requests ---

  async function handleAccept(friendshipId: string) {
    const res = await apiRepository.acceptFriendRequest(friendshipId)
    if (res.success) {
      setFriendRequests((prev) => prev.filter((r) => r._id !== friendshipId))
      loadFriends()
    }
  }

  async function handleReject(friendshipId: string) {
    const res = await apiRepository.rejectFriendRequest(friendshipId)
    if (res.success) setFriendRequests((prev) => prev.filter((r) => r._id !== friendshipId))
  }

  // --- Conversation context menu ---

  async function handleArchive(convId: string) {
    setContextMenu(null)
    await apiRepository.archiveConversation(convId)
    setConversations((prev) => prev.filter((c) => c._id !== convId))
    if (selectedConv?._id === convId) setSelectedConv(null)
  }

  async function handleDeleteConv(convId: string) {
    setContextMenu(null)
    await apiRepository.deleteConversation(convId)
    setConversations((prev) => prev.filter((c) => c._id !== convId))
    if (selectedConv?._id === convId) setSelectedConv(null)
  }

  // --- Status change ---

  async function handleStatusChange(status: UserStatus) {
    setMyStatus(status)
    setProfileOpen(false)
    socketService.emit("status:change", { status })
  }

  // --- Logout ---

  function handleLogout() {
    clearAllStorage()
    removeToken()
    socketService.disconnect()
    router.push("/login")
  }

  // --- Sidebar tab load trigger ---

  useEffect(() => {
    if (sidebarTab === "friends" && friends.length === 0) loadFriends()
  }, [sidebarTab])

  // --- Filtered lists ---

  const filteredConvs = conversations.filter((c) => {
    if (!search.trim()) return true
    const other = getOtherParticipant(c, user?.id ?? "")
    return other?.name.toLowerCase().includes(search.toLowerCase()) ||
      other?.username.toLowerCase().includes(search.toLowerCase())
  })

  const filteredFriends = friends.filter((f) => {
    if (!search.trim()) return true
    const u = getFriendUser(f, user?.id ?? "")
    return u?.name.toLowerCase().includes(search.toLowerCase()) ||
      u?.username.toLowerCase().includes(search.toLowerCase())
  })

  const activeContact = selectedConv ? getOtherParticipant(selectedConv, user?.id ?? "") : null
  const isRemoteTyping = selectedConv ? !!remoteTyping[selectedConv._id] : false
  const activeContactStatus = activeContact ? (userStatuses[activeContact._id] ?? (activeContact as any).status ?? "offline") as UserStatus : undefined

  // --- Render ---

  return (
    <div className="flex flex-col h-screen bg-muted/30 overflow-hidden">

      {/* --- Navbar --- */}
      <div className="flex items-center justify-end px-5 py-2.5 border-b border-border bg-card">
        {/* Friend requests bell */}
        <div className="relative mr-2" ref={requestsRef}>
          <button
            onClick={() => setRequestsOpen((o) => !o)}
            className="relative size-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <Bell className="size-4" />
            {friendRequests.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                {friendRequests.length}
              </span>
            )}
          </button>

          {requestsOpen && (
            <div className="absolute right-0 top-10 z-50 w-72 rounded-xl bg-card ring-1 ring-foreground/10 shadow-xl py-1 overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-semibold">Solicitações de amizade</p>
              </div>
              {friendRequests.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma solicitação</p>
              ) : (
                friendRequests.map((req) => (
                  <div key={req._id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50">
                    <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary flex-none">
                      {getInitials(req.requester.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.requester.name}</p>
                      <p className="text-xs text-muted-foreground">@{req.requester.username}</p>
                    </div>
                    <button onClick={() => handleAccept(req._id)} className="size-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center cursor-pointer transition-colors">
                      <Check className="size-3.5 text-primary" />
                    </button>
                    <button onClick={() => handleReject(req._id)} className="size-7 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center cursor-pointer transition-colors">
                      <X className="size-3.5 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="flex items-center gap-2.5" ref={profileRef}>
          <div>
            <p className="text-sm font-semibold leading-none text-right">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5 text-right flex items-center justify-end gap-1">
              <StatusDot status={myStatus} className="size-2" />
              {STATUS_LABELS[myStatus]}
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="relative size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            >
              {getInitials(displayName)}
              <StatusDot status={myStatus} className="absolute bottom-0 right-0 size-2.5" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 rounded-xl bg-card ring-1 ring-foreground/10 shadow-lg py-1 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground">@{displayUsername}</p>
                </div>
                {/* Status options */}
                <div className="px-2 py-1.5 border-b border-border">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium px-1 mb-1">Status</p>
                  {(["online", "ausente", "ocupado", "offline"] as UserStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
                        myStatus === s ? "bg-muted font-medium" : "hover:bg-muted/60"
                      )}
                    >
                      <StatusDot status={s} className="size-2.5 flex-none" />
                      {STATUS_LABELS[s]}
                      {myStatus === s && <Check className="size-3 ml-auto text-primary" />}
                    </button>
                  ))}
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

      {/* --- Content --- */}
      <div className="flex flex-1 p-3 gap-3 overflow-hidden">

        {/* --- Sidebar --- */}
        <Card className="w-72 flex-none flex flex-col overflow-hidden gap-0 py-0">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setSidebarTab("chats")}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors cursor-pointer", sidebarTab === "chats" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
            >
              <MessageSquare className="size-3.5" />Chats
            </button>
            <button
              onClick={() => setSidebarTab("friends")}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors cursor-pointer", sidebarTab === "friends" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
            >
              <Users className="size-3.5" />Amigos
            </button>
          </div>

          {/* Search + add friend */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Button variant="ghost" size="icon-sm" title="Adicionar amigo" className="cursor-pointer flex-none" onClick={() => setAddFriendOpen(true)}>
              <UserPlus className="size-4" />
            </Button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {/* Chats tab */}
            {sidebarTab === "chats" && (
              convLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
              ) : filteredConvs.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">
                  {search ? "Nenhum resultado" : "Nenhuma conversa ainda"}
                </p>
              ) : (
                filteredConvs.map((conv) => {
                  const other = getOtherParticipant(conv, user?.id ?? "")
                  const isSelected = selectedConv?._id === conv._id
                  const contactStatus = other ? (userStatuses[other._id] ?? (other as any).status ?? "offline") as UserStatus : "offline"
                  const preview = remoteTyping[conv._id]
                    ? "digitando..."
                    : conv.lastMessage?.content ?? ""
                  return (
                    <div key={conv._id} className="relative group">
                      <button
                        onClick={() => handleSelectConv(conv)}
                        className={cn("w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors mb-0.5 cursor-pointer", isSelected ? "bg-primary/10" : "hover:bg-muted")}
                      >
                        <div className="relative flex-none">
                          <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                            {getInitials(other?.name ?? "")}
                          </div>
                          <StatusDot status={contactStatus} className="absolute bottom-0 right-0 size-2.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline gap-1">
                            <span className="text-sm font-medium truncate">{other?.name ?? other?.username ?? "..."}</span>
                            {conv.lastMessage?.createdAt && (
                              <span className="text-[10px] text-muted-foreground flex-none">{formatTime(conv.lastMessage.createdAt)}</span>
                            )}
                          </div>
                          <p className={cn("text-xs truncate", remoteTyping[conv._id] ? "text-primary italic" : "text-muted-foreground")}>{preview}</p>
                        </div>
                      </button>
                      {/* Context menu trigger */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setContextMenu({ convId: conv._id, x: e.clientX, y: e.clientY }) }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 size-6 flex items-center justify-center rounded hover:bg-muted-foreground/20 transition-all cursor-pointer"
                      >
                        <MoreHorizontal className="size-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  )
                })
              )
            )}

            {/* Friends tab */}
            {sidebarTab === "friends" && (
              friendsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
              ) : filteredFriends.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">
                  {search ? "Nenhum resultado" : "Nenhum amigo ainda — adicione alguém!"}
                </p>
              ) : (
                filteredFriends.map((f) => {
                  const u = getFriendUser(f, user?.id ?? "")
                  const friendStatus = u ? (userStatuses[u._id] ?? (u as any).status ?? "offline") as UserStatus : "offline"
                  return (
                    <div key={f._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted mb-0.5">
                      <div className="relative flex-none">
                        <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                          {getInitials(u?.name ?? "")}
                        </div>
                        <StatusDot status={friendStatus} className="absolute bottom-0 right-0 size-2.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u?.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span>@{u?.username}</span>
                          <span className={cn("text-[10px]", STATUS_COLORS[friendStatus].replace("bg-", "text-"))}>{STATUS_LABELS[friendStatus]}</span>
                        </p>
                      </div>
                      <Button size="icon-sm" variant="ghost" title="Iniciar conversa" className="cursor-pointer flex-none" onClick={() => handleStartChat(u._id)}>
                        <MessageSquare className="size-3.5" />
                      </Button>
                    </div>
                  )
                })
              )
            )}
          </div>
        </Card>

        {/* --- Chat area --- */}
        <Card className="flex-1 flex flex-col overflow-hidden gap-0 py-0">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageSquare className="size-10 opacity-30" />
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="relative flex-none">
                  <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                    {getInitials(activeContact?.name ?? "")}
                  </div>
                  <StatusDot status={activeContactStatus} className="absolute bottom-0 right-0 size-2.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{activeContact?.name ?? activeContact?.username}</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">`@${activeContact?.username}`</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                {msgLoading ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem ainda. Diga olá!</p>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.sender._id === user?.id
                    return (
                      <div key={msg._id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[65%] rounded-2xl px-3.5 py-2 text-sm",
                          isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm",
                          msg.failed && "opacity-50",
                        )}>
                          <p className={msg.pending ? "opacity-60" : ""}>{msg.content}</p>
                          <p className={cn("text-[10px] mt-0.5 text-right", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            {msg.failed ? "falhou" : formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                {/* Typing bubble */}
                {isRemoteTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted/80 rounded-full px-3 py-2 flex items-center gap-[3px]">
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border flex items-end gap-2">
                <Textarea
                  placeholder={`Mensagem para ${activeContact?.name ?? activeContact?.username}...`}
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                  className="resize-none flex-1 max-h-32"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()} size="icon" className="cursor-pointer flex-none mb-0.5">
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* --- Context menu (archive / delete) --- */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 w-44 rounded-xl bg-card ring-1 ring-foreground/10 shadow-xl py-1 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => handleArchive(contextMenu.convId)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer"
          >
            <Archive className="size-4 text-muted-foreground" />
            Arquivar
          </button>
          <button
            onClick={() => handleDeleteConv(contextMenu.convId)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 className="size-4" />
            Excluir conversa
          </button>
        </div>
      )}

      {/* --- Add Friend Modal --- */}
      {addFriendOpen && (
        <AddFriendModal
          onClose={() => setAddFriendOpen(false)}
          onRequestSent={() => setAddFriendOpen(false)}
        />
      )}
    </div>
  )
}
