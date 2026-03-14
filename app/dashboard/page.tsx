"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { removeToken, getUser } from "@/lib/auth"
import { apiRepository, ConversationItem, MessageItem, FriendRequest, FriendItem, UserResult } from "@/lib/api"
import { socketService } from "@/lib/socket"
import { AddFriendModal } from "@/components/add-friend-modal"
import { AvatarUploadModal } from "@/components/avatar-upload-modal"
import { useToast } from "@/lib/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Search,
  UserPlus,
  Send,
  LogOut,
  Bell,
  Check,
  CheckCheck,
  X,
  MoreHorizontal,
  Archive,
  ArchiveX,
  Trash2,
  UserMinus,
  Users,
  MessageSquare,
  Loader2,
  ChevronLeft,
  Settings,
  Camera,
  ImagePlus,
  Smile,
} from "lucide-react"
import { cn } from "@/lib/utils"

type UserStatus = "online" | "offline" | "ausente" | "ocupado"

interface LocalMessage {
  _id: string
  sender: { _id: string; username: string; name?: string }
  content: string
  type?: 'text' | 'image'
  imageUrl?: string
  createdAt: string
  pending?: boolean
  failed?: boolean
  read?: boolean
}

interface UserSettings {
  readReceipts: boolean
}

interface StoredUser {
  id: string
  username: string
  name: string
}

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

function MessageTick({ pending, failed, read, readReceipts, isOwn }: { pending?: boolean; failed?: boolean; read?: boolean; readReceipts?: boolean; isOwn?: boolean }) {
  if (failed) return <X className="size-3 text-destructive" />
  if (pending) return <Check className={cn("size-3", isOwn ? "opacity-40" : "text-muted-foreground/50")} />
  if (read && readReceipts) return <CheckCheck className={cn("size-3", isOwn ? "text-sky-200" : "text-blue-400")} />
  return <CheckCheck className={cn("size-3", isOwn ? "opacity-40" : "text-muted-foreground/50")} />
}

function UserAvatar({
  avatar,
  name,
  className = "size-9",
  textClassName = "text-xs",
  fallbackClassName = "bg-primary/15 text-primary",
}: {
  avatar?: string | null
  name: string
  className?: string
  textClassName?: string
  fallbackClassName?: string
}) {
  if (avatar) return <img src={avatar} alt={name} className={cn("rounded-full object-cover", className)} />
  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold", className, textClassName, fallbackClassName)}>
      {getInitials(name)}
    </div>
  )
}

type SidebarTab = "chats" | "friends"

const DEFAULT_SETTINGS: UserSettings = { readReceipts: true }

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem("chat_settings")
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}

function saveSettings(s: UserSettings) {
  localStorage.setItem("chat_settings", JSON.stringify(s))
}

export default function DashboardPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [user, setUser] = useState<StoredUser | null>(null)
  const [myStatus, setMyStatus] = useState<UserStatus>("online")

  const [settings, setSettings] = useState<UserSettings>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const settingsValRef = useRef<UserSettings>(settings)
  useEffect(() => { settingsValRef.current = settings }, [settings])

  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [avatarUploadOpen, setAvatarUploadOpen] = useState(false)

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats")
  const [search, setSearch] = useState("")

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [convLoading, setConvLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null)

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [remoteTyping, setRemoteTyping] = useState<Record<string, boolean>>({})

  const [friends, setFriends] = useState<FriendItem[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)

  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({})

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [requestsOpen, setRequestsOpen] = useState(false)
  const requestsRef = useRef<HTMLDivElement>(null)

  const [addFriendOpen, setAddFriendOpen] = useState(false)

  const [acceptedNotifications, setAcceptedNotifications] = useState<{ friendshipId: string; user: UserResult; iAccepted: boolean }[]>([])
  const [unreadFriendsCount, setUnreadFriendsCount] = useState(0)

  const [archivedConvs, setArchivedConvs] = useState<ConversationItem[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const [contextMenu, setContextMenu] = useState<{ convId: string; x: number; y: number } | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const [friendToRemove, setFriendToRemove] = useState<{ friendshipId: string; name: string } | null>(null)

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const displayName = user?.name ?? "Usuário"
  const displayUsername = user?.username ?? "username"

  useEffect(() => {
    const u = getUser()
    setUser(u)
  }, [])

  useEffect(() => {
    if (!user) return
    loadAllConversations()
    loadFriendRequests()
    apiRepository.getMyProfile().then((res) => {
      if (res.success && res.data) setMyAvatar(res.data.avatar)
    })
    socketService.connect()
    return () => socketService.disconnect()
  }, [user])

  useEffect(() => {
    const offMsgNew = socketService.on<{
      _id: string; conversationId: string; sender: { id: string; username: string; name?: string }; content: string; type?: string; imageUrl?: string; createdAt: string
    }>("message:new", (data) => {
      const isActive = selectedConvRef.current?._id === data.conversationId
      const msg: LocalMessage = {
        _id: data._id,
        sender: { _id: data.sender.id, username: data.sender.username },
        content: data.content,
        type: (data.type as LocalMessage["type"]) ?? "text",
        imageUrl: data.imageUrl,
        createdAt: data.createdAt,
      }
      setMessages((prev) => {
        if (isActive) return [...prev, msg]
        return prev
      })
      if (isActive && settingsValRef.current.readReceipts) {
        socketService.emit("message:read", { conversationId: data.conversationId })
      }
      if (!isActive) {
        setUnreadCounts((prev) => ({ ...prev, [data.conversationId]: (prev[data.conversationId] ?? 0) + 1 }))
      }
      if (!conversationIdsRef.current.has(data.conversationId)) {
        loadAllConversations()
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
      _id: string; conversationId: string; sender: { id: string; username: string }; content: string; type?: string; imageUrl?: string; tempId: string; createdAt: string
    }>("message:ack", (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.tempId
            ? { _id: data._id, sender: { _id: data.sender.id, username: data.sender.username }, content: data.content, type: (data.type as LocalMessage["type"]) ?? "text", imageUrl: data.imageUrl, createdAt: data.createdAt, read: false }
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

    const offMsgRead = socketService.on<{ conversationId: string }>("message:read", (data) => {
      setMessages((prev) => prev.map((m) => ({ ...m, read: true })))
      void data
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

    const offFriendAcc = socketService.on<{ friendshipId: string; acceptedBy: string }>("friend:accepted", async (data) => {
      const res = await apiRepository.listFriends()
      if (res.success && res.data) {
        setFriends(res.data)
        const accepted = res.data.find(f => f._id === data.friendshipId)
        if (accepted) {
          const myId = getUser()?.id ?? ""
          const iAccepted = data.acceptedBy === myId
          const friendUser = accepted.requester._id === myId ? accepted.recipient : accepted.requester
          if (iAccepted) {
            // I accepted → only show badge on friends tab, no bell notification
            setUnreadFriendsCount(prev => prev + 1)
          } else {
            // Other user accepted my request → bell notification + friends badge
            setAcceptedNotifications(prev => [...prev, { friendshipId: data.friendshipId, user: friendUser, iAccepted: false }])
            setUnreadFriendsCount(prev => prev + 1)
          }
        }
      }
      loadAllConversations()
    })

    const offUserStatus = socketService.on<{ userId: string; username: string; status: UserStatus }>("user:status", (data) => {
      setUserStatuses((prev) => ({ ...prev, [data.userId]: data.status }))
    })

    return () => {
      offMsgNew(); offMsgAck(); offMsgErr(); offMsgRead()
      offTypingStart(); offTypingStop()
      offFriendReq(); offFriendAcc()
      offUserStatus()
    }
  }, [])

  const selectedConvRef = useRef<ConversationItem | null>(null)
  useEffect(() => { selectedConvRef.current = selectedConv }, [selectedConv])

  const conversationIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map(c => c._id))
  }, [conversations])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (requestsRef.current && !requestsRef.current.contains(e.target as Node)) setRequestsOpen(false)
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setContextMenu(null)
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setEmojiPickerOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!requestsOpen && acceptedNotifications.length > 0) {
      setAcceptedNotifications([])
    }
  }, [requestsOpen])

  async function loadAllConversations() {
    setConvLoading(true)
    setArchivedLoading(true)
    const [convRes, archRes] = await Promise.all([
      apiRepository.listConversations(),
      apiRepository.listArchivedConversations(),
    ])
    setConvLoading(false)
    setArchivedLoading(false)

    const userId = user?.id ?? ""
    const seen = new Set<string>()
    const allConvs: ConversationItem[] = []
    for (const c of [...(convRes.data || []), ...(archRes.data || [])]) {
      if (!seen.has(c._id)) { seen.add(c._id); allConvs.push(c) }
    }

    const active = allConvs.filter(c => !c.archivedBy.includes(userId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    const archived = allConvs.filter(c => c.archivedBy.includes(userId))

    setConversations(active)
    setArchivedConvs(archived)
    setUnreadCounts(prev => {
      const next = { ...prev }
      active.forEach(c => {
        const serverCount = c.unreadCount ?? 0
        next[c._id] = Math.max(prev[c._id] ?? 0, serverCount)
      })
      return next
    })
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

  async function handleSelectConv(conv: ConversationItem) {
    setSelectedConv(conv)
    setMessages([])
    setMsgLoading(true)
    setUnreadCounts((prev) => { const n = { ...prev }; delete n[conv._id]; return n })
    if (settingsValRef.current.readReceipts) {
      socketService.emit("message:read", { conversationId: conv._id })
    }
    const res = await apiRepository.getMessages(conv._id)
    setMsgLoading(false)
    if (res.success && res.data) {
      setMessages([...res.data].reverse().map((m: MessageItem) => ({
        _id: m._id,
        sender: m.sender,
        content: m.content,
        type: m.type ?? "text",
        imageUrl: m.imageUrl,
        createdAt: m.createdAt,
        read: true, // historical messages are considered read
      })))
    }
  }

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

  function handleSendMessage() {
    if (!newMessage.trim() || !selectedConv || !user) return
    const tempId = `temp_${Date.now()}`
    const optimistic: LocalMessage = {
      _id: tempId,
      sender: { _id: user.id, username: user.username, name: user.name },
      content: newMessage.trim(),
      type: "text",
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setNewMessage("")
    clearTimeout(typingTimerRef.current)
    socketService.emit("typing:stop", { conversationId: selectedConv._id })
    socketService.emit("message:send", { conversationId: selectedConv._id, content: optimistic.content, tempId })
  }

  function handleSendImage(file: File) {
    if (!selectedConv || !user) return
    const maxSize = 4 * 1024 * 1024 // 4MB
    if (file.size > maxSize) {
      addToast("A imagem deve ter no máximo 4MB.", "error", 3000)
      return
    }
    if (!file.type.startsWith("image/")) {
      addToast("Apenas imagens são permitidas.", "error", 3000)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      const tempId = `temp_${Date.now()}`
      const optimistic: LocalMessage = {
        _id: tempId,
        sender: { _id: user.id, username: user.username, name: user.name },
        content: "📷 Foto",
        type: "image",
        imageUrl: base64,
        createdAt: new Date().toISOString(),
        pending: true,
      }
      setMessages((prev) => [...prev, optimistic])
      socketService.emit("message:send", {
        conversationId: selectedConv._id,
        content: "📷 Foto",
        tempId,
        type: "image",
        imageUrl: base64,
      })
    }
    reader.readAsDataURL(file)
  }

  function handleInsertEmoji(emoji: string) {
    setNewMessage((prev) => prev + emoji)
    setEmojiPickerOpen(false)
  }

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

  async function handleAccept(friendshipId: string) {
    const req = friendRequests.find(r => r._id === friendshipId)
    const res = await apiRepository.acceptFriendRequest(friendshipId)
    if (res.success) {
      setFriendRequests((prev) => prev.filter((r) => r._id !== friendshipId))
      loadFriends()
      addToast(`Agora você e ${req?.requester.name ?? "seu amigo"} são amigos! 🎉`, "success", 2000)
    }
  }

  async function handleReject(friendshipId: string) {
    const res = await apiRepository.rejectFriendRequest(friendshipId)
    if (res.success) setFriendRequests((prev) => prev.filter((r) => r._id !== friendshipId))
  }

  async function handleArchive(convId: string) {
    setContextMenu(null)
    const conv = conversations.find((c) => c._id === convId)
    await apiRepository.archiveConversation(convId)
    setConversations((prev) => prev.filter((c) => c._id !== convId))
    if (conv) setArchivedConvs((prev) => [{ ...conv, archivedBy: [...conv.archivedBy, user?.id ?? ""] }, ...prev])
    if (selectedConv?._id === convId) setSelectedConv(null)
  }

  async function handleUnarchive(convId: string) {
    setContextMenu(null)
    const conv = archivedConvs.find((c) => c._id === convId)
    await apiRepository.unarchiveConversation(convId)
    setArchivedConvs((prev) => prev.filter((c) => c._id !== convId))
    if (conv) {
      const updated = { ...conv, archivedBy: conv.archivedBy.filter(id => id !== (user?.id ?? "")) }
      setConversations((prev) => [updated, ...prev].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
    }
    if (selectedConv?._id === convId) setSelectedConv(null)
  }

  async function handleRemoveFriend(friendshipId: string) {
    const friendItem = friends.find(f => f._id === friendshipId)
    const friendUser = friendItem ? getFriendUser(friendItem, user?.id ?? "") : null
    const res = await apiRepository.removeFriend(friendshipId)
    if (res.success) {
      setFriends((prev) => prev.filter((f) => f._id !== friendshipId))
      addToast(`${friendUser?.name ?? "Amigo"} foi removido da sua lista.`, "success", 2500)
    }
    setFriendToRemove(null)
  }

  async function handleDeleteConv(convId: string) {
    setContextMenu(null)
    await apiRepository.deleteConversation(convId)
    setConversations((prev) => prev.filter((c) => c._id !== convId))
    if (selectedConv?._id === convId) setSelectedConv(null)
  }

  async function handleStatusChange(status: UserStatus) {
    setMyStatus(status)
    socketService.emit("status:change", { status })
  }

  function handleToggleSetting(key: keyof UserSettings) {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      saveSettings(next)
      return next
    })
  }

  function handleLogout() {
    clearAllStorage()
    removeToken()
    socketService.disconnect()
    router.push("/login")
  }

  useEffect(() => {
    if (sidebarTab === "friends" && friends.length === 0) loadFriends()
  }, [sidebarTab])

  const filteredConvs = conversations.filter((c) => {
    if (showArchived) return false // hide regular convs when in archived view
    if (!search.trim()) return true
    const other = getOtherParticipant(c, user?.id ?? "")
    return other?.name.toLowerCase().includes(search.toLowerCase()) ||
      other?.username.toLowerCase().includes(search.toLowerCase())
  })

  const filteredArchivedConvs = archivedConvs.filter((c) => {
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      <Card className="w-72 flex-none flex flex-col overflow-hidden gap-0 py-0 rounded-none border-r border-b-0 border-t-0 border-l-0">

        <div className="flex items-center gap-1 px-3 py-2.5 border-b border-border">
          <div className="relative" ref={requestsRef}>
            <button
              onClick={() => setRequestsOpen((o) => !o)}
              className="relative size-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <Bell className="size-4" />
              {(friendRequests.length + acceptedNotifications.length) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                  {friendRequests.length + acceptedNotifications.length}
                </span>
              )}
            </button>

            {requestsOpen && (
              <div className="absolute left-0 top-10 z-50 w-72 rounded-xl bg-card ring-1 ring-foreground/10 shadow-xl py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-semibold">Notificações</p>
                </div>
                {friendRequests.length === 0 && acceptedNotifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma notificação</p>
                ) : (
                  <>
                    {acceptedNotifications.map((notif) => (
                      <div key={notif.friendshipId} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50">
                        <UserAvatar avatar={notif.user.avatar} name={notif.user.name} className="size-8 flex-none" textClassName="text-xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{notif.user.name}</p>
                          <p className="text-xs text-green-500">aceitou sua solicitação</p>
                        </div>
                        <div className="size-7 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Check className="size-3.5 text-green-500" />
                        </div>
                      </div>
                    ))}
                    {friendRequests.map((req) => (
                      <div key={req._id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50">
                        <UserAvatar avatar={req.requester.avatar} name={req.requester.name} className="size-8 flex-none" textClassName="text-xs" />
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
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>

          <Button variant="ghost" size="icon-sm" title="Adicionar amigo" className="cursor-pointer flex-none" onClick={() => setAddFriendOpen(true)}>
            <UserPlus className="size-4" />
          </Button>
        </div>

        <div className="flex border-b border-border">
          <button
            onClick={() => setSidebarTab("chats")}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors cursor-pointer", sidebarTab === "chats" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <MessageSquare className="size-3.5" />Chats
          </button>
          <button
            onClick={() => { setSidebarTab("friends"); setUnreadFriendsCount(0) }}
            className={cn("relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors cursor-pointer", sidebarTab === "friends" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <Users className="size-3.5" />Amigos
            {unreadFriendsCount > 0 && (
              <span className="absolute top-1 right-2 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                {unreadFriendsCount}
              </span>
            )}
          </button>
        </div>

          <div className="flex-1 overflow-y-auto py-2 px-2">
            {sidebarTab === "chats" && (
              showArchived ? (
                <>
                  <button
                    onClick={() => { setShowArchived(false); setSearch("") }}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                    Voltar para conversas
                  </button>
                  <div className="px-3 pb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Arquivados</p>
                  </div>
                  {archivedLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
                  ) : filteredArchivedConvs.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      {search ? "Nenhum resultado" : "Nenhuma conversa arquivada"}
                    </p>
                  ) : (
                    filteredArchivedConvs.map((conv) => {
                      const other = getOtherParticipant(conv, user?.id ?? "")
                      const isSelected = selectedConv?._id === conv._id
                      const contactStatus = other ? (userStatuses[other._id] ?? (other as any).status ?? "offline") as UserStatus : "offline"
                      return (
                        <div key={conv._id} className="flex items-center gap-0 mb-0.5">
                          <button
                            onClick={() => handleSelectConv(conv)}
                            className={cn("flex-1 min-w-0 text-left px-3 py-2.5 rounded-l-lg flex items-center gap-3 transition-colors cursor-pointer", isSelected ? "bg-primary/10" : "hover:bg-muted")}
                          >
                            <div className="relative flex-none">
                              <UserAvatar avatar={other?.avatar} name={other?.name ?? ""} />
                              <StatusDot status={contactStatus} className="absolute bottom-0 right-0 size-2.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-1">
                                <span className="text-sm font-medium truncate">{other?.name ?? other?.username ?? "..."}</span>
                                {conv.lastMessage?.createdAt && (
                                  <span className="text-[10px] text-muted-foreground flex-none">{formatTime(conv.lastMessage.createdAt)}</span>
                                )}
                              </div>
                              <p className="text-xs truncate text-muted-foreground">{conv.lastMessage?.content ?? ""}</p>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setContextMenu({ convId: conv._id, x: e.clientX, y: e.clientY }) }}
                            className={cn("flex-none size-8 flex items-center justify-center rounded-r-lg transition-colors cursor-pointer", isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted")}
                            title="Opções"
                          >
                            <MoreHorizontal className="size-4 text-muted-foreground" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </>
              ) : (
                <>
                  {archivedConvs.length > 0 && !search.trim() && (
                    <button
                      onClick={() => { setShowArchived(true); setSearch("") }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer mb-0.5 group"
                    >
                      <div className="size-9 rounded-full bg-muted flex items-center justify-center flex-none">
                        <Archive className="size-4 text-muted-foreground" />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium text-foreground">Arquivados</span>
                      <span className="min-w-[20px] h-5 rounded-full bg-muted-foreground/20 text-foreground text-[11px] font-semibold flex items-center justify-center px-1.5">
                        {archivedConvs.length}
                      </span>
                    </button>
                  )}
                  {convLoading ? (
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
                      const unread = unreadCounts[conv._id] ?? 0
                      return (
                        <div key={conv._id} className="flex items-center gap-0 mb-0.5">
                          <button
                            onClick={() => handleSelectConv(conv)}
                            className={cn("flex-1 min-w-0 text-left px-3 py-2.5 rounded-l-lg flex items-center gap-3 transition-colors cursor-pointer", isSelected ? "bg-primary/10" : "hover:bg-muted")}
                          >
                            <div className="relative flex-none">
                              <UserAvatar avatar={other?.avatar} name={other?.name ?? ""} />
                              <StatusDot status={contactStatus} className="absolute bottom-0 right-0 size-2.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-1">
                                <span className={cn("text-sm truncate", unread > 0 ? "font-semibold" : "font-medium")}>{other?.name ?? other?.username ?? "..."}</span>
                                {conv.lastMessage?.createdAt && (
                                  <span className={cn("text-[10px] flex-none", unread > 0 ? "text-primary font-medium" : "text-muted-foreground")}>{formatTime(conv.lastMessage.createdAt)}</span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <p className={cn("text-xs truncate flex-1", remoteTyping[conv._id] ? "text-primary italic" : unread > 0 ? "text-foreground" : "text-muted-foreground")}>{preview}</p>
                                {unread > 0 && (
                                  <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 flex-none">
                                    {unread > 99 ? "99+" : unread}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setContextMenu({ convId: conv._id, x: e.clientX, y: e.clientY }) }}
                            className={cn("flex-none size-8 flex items-center justify-center rounded-r-lg transition-colors cursor-pointer", isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted")}
                            title="Opções"
                          >
                            <MoreHorizontal className="size-4 text-muted-foreground" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </>
              )
            )}

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
                        <UserAvatar avatar={u?.avatar} name={u?.name ?? ""} />
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
                      <Button size="icon-sm" variant="ghost" title="Remover amigo" className="cursor-pointer flex-none text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setFriendToRemove({ friendshipId: f._id, name: u?.name ?? "Amigo" })}>
                        <UserMinus className="size-3.5" />
                      </Button>
                    </div>
                  )
                })
              )
            )}
          </div>

          <div className="border-t border-border px-3 py-2 flex items-center gap-2">
            <div className="relative flex-none" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="relative size-9 rounded-full cursor-pointer hover:opacity-90 transition-opacity flex-none"
              >
                <UserAvatar avatar={myAvatar} name={displayName} className="size-9" textClassName="text-sm" fallbackClassName="bg-primary text-primary-foreground" />
              </button>
              <StatusDot status={myStatus} className="absolute bottom-0 right-0 size-2.5" />
              {profileOpen && (
                <div className="absolute left-0 bottom-12 z-50 w-52 rounded-xl bg-card ring-1 ring-foreground/10 shadow-lg py-1 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border">
                    <p className="text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-muted-foreground">@{displayUsername}</p>
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium px-1 mb-1">Status</p>
                    {(["online", "ausente", "ocupado", "offline"] as UserStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => { handleStatusChange(s); setProfileOpen(false) }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
                          myStatus === s ? "bg-muted font-medium" : "hover:bg-muted/60"
                        )}
                      >
                        <StatusDot status={s} className="size-2.5 flex-none" />
                        {STATUS_LABELS[s]}
                        {myStatus === s && <Check className="size-3 ml-auto text-primary" />}
                      </button>
                    ))}                  </div>
                  <div className="border-t border-border px-2 py-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); setAvatarUploadOpen(true) }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors cursor-pointer"
                    >
                      <Camera className="size-3.5 text-muted-foreground flex-none" />
                      Alterar foto
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <StatusDot status={myStatus} className="size-1.5 border-0" />
                {STATUS_LABELS[myStatus]}
              </p>
            </div>

            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer"
                title="Configurações"
              >
                <Settings className="size-3.5 text-muted-foreground" />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 bottom-9 z-50 w-60 rounded-xl bg-card ring-1 ring-foreground/10 shadow-xl py-1 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border">
                    <p className="text-sm font-semibold">Configurações</p>
                  </div>
                  <button
                    onClick={() => handleToggleSetting("readReceipts")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <CheckCheck className={cn("size-4 flex-none", settings.readReceipts ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Confirmação de leitura</p>
                      <p className="text-xs text-muted-foreground">{settings.readReceipts ? "Ativada" : "Desativada"}</p>
                    </div>
                    <div className={cn("w-8 h-4 rounded-full transition-colors flex-none relative", settings.readReceipts ? "bg-primary" : "bg-muted-foreground/30")}>
                      <span className={cn("absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform", settings.readReceipts ? "left-[calc(100%-14px)]" : "left-0.5")} />
                    </div>
                  </button>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="size-4" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden gap-0 py-0 rounded-none border-0">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageSquare className="size-10 opacity-30" />
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="relative flex-none">
                  <UserAvatar avatar={activeContact?.avatar} name={activeContact?.name ?? ""} />
                  <StatusDot status={activeContactStatus} className="absolute bottom-0 right-0 size-2.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{activeContact?.name ?? activeContact?.username}</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">{`@${activeContact?.username}`}</p>
                </div>
              </div>

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
                          {msg.type === "image" && msg.imageUrl ? (
                            <div className={msg.pending ? "opacity-60" : ""}>
                              <img
                                src={msg.imageUrl}
                                alt="Foto"
                                className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer"
                                onClick={() => window.open(msg.imageUrl, "_blank")}
                              />
                            </div>
                          ) : (
                            <p className={msg.pending ? "opacity-60" : ""}>{msg.content}</p>
                          )}
                          <div className={cn("flex items-center justify-end gap-1 mt-0.5", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            <span className="text-[10px]">
                              {msg.failed ? "falhou" : formatTime(msg.createdAt)}
                            </span>
                            {isOwn && (
                              <MessageTick pending={msg.pending} failed={msg.failed} read={msg.read} readReceipts={settings.readReceipts} isOwn />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
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

              <div className="px-4 py-3 border-t border-border flex items-end gap-2">
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    onClick={() => setEmojiPickerOpen((o) => !o)}
                    className="size-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer mb-0.5"
                    title="Emojis"
                  >
                    <Smile className="size-4 text-muted-foreground" />
                  </button>
                  {emojiPickerOpen && (
                    <div className="absolute bottom-11 left-0 z-50 w-72 max-h-52 rounded-xl bg-card ring-1 ring-foreground/10 shadow-xl p-2 overflow-y-auto">
                      <div className="grid grid-cols-8 gap-1">
                        {["😀","😂","😍","🥰","😎","🤩","😢","😡","👍","👎","❤️","🔥","🎉","✨","💯","🙌","👏","🤔","😅","🥺","😱","🤗","😏","😇","🤣","💀","👀","💪","🙏","🤝","😘","🥳","😭","😤","🫡","🫶","✌️","🤞","☕","🍕","🎮","📸","🎵","⭐","💬","🫠","🤯","😴"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleInsertEmoji(emoji)}
                            className="size-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleSendImage(file)
                    e.target.value = ""
                  }}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="size-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer mb-0.5"
                  title="Enviar foto"
                >
                  <ImagePlus className="size-4 text-muted-foreground" />
                </button>
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

      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 w-44 rounded-xl bg-card ring-1 ring-foreground/10 shadow-xl py-1 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {showArchived ? (
            <button
              onClick={() => handleUnarchive(contextMenu.convId)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer"
            >
              <ArchiveX className="size-4 text-muted-foreground" />
              Desarquivar
            </button>
          ) : (
            <button
              onClick={() => handleArchive(contextMenu.convId)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer"
            >
              <Archive className="size-4 text-muted-foreground" />
              Arquivar
            </button>
          )}
          <button
            onClick={() => handleDeleteConv(contextMenu.convId)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 className="size-4" />
            Excluir conversa
          </button>
        </div>
      )}

      {avatarUploadOpen && (
        <AvatarUploadModal
          currentAvatar={myAvatar}
          onClose={() => setAvatarUploadOpen(false)}
          onSaved={(avatar) => setMyAvatar(avatar)}
        />
      )}

      {addFriendOpen && (
        <AddFriendModal
          onClose={() => setAddFriendOpen(false)}
          onRequestSent={() => setAddFriendOpen(false)}
        />
      )}

      <AlertDialog open={!!friendToRemove} onOpenChange={(open) => { if (!open) setFriendToRemove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover amigo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{friendToRemove?.name}</strong> da sua lista de amigos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => friendToRemove && handleRemoveFriend(friendToRemove.friendshipId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
