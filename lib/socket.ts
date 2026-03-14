import { io, Socket } from "socket.io-client"
import { getToken } from "./auth"

type TriggerHandler = (data: unknown) => void

class SocketService {
  private socket: Socket | null = null
  private handlers = new Map<string, Set<TriggerHandler>>()

  connect() {
    if (this.socket?.connected) return

    const token = getToken()
    if (!token) return

    this.socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000", {
      auth: { token },
      transports: ["websocket"],
    })

    this.socket.on("connect", () => {
      console.log("[Socket] Connected:", this.socket?.id)
    })

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason)
    })

    this.socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message)
    })

    this.socket.on("trigger-event", ({ event, data }: { event: string; data: unknown }) => {
      const set = this.handlers.get(event)
      if (set) set.forEach((h) => h(data))
    })
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  emit<T>(event: string, data: T) {
    if (!this.socket?.connected) {
      console.warn("[Socket] Not connected, cannot emit:", event)
      return
    }
    this.socket.emit("trigger-event", { event, data })
  }

  on<T>(event: string, handler: (data: T) => void): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler as TriggerHandler)
    return () => {
      this.handlers.get(event)?.delete(handler as TriggerHandler)
    }
  }

  isConnected() {
    return this.socket?.connected ?? false
  }
}

export const socketService = new SocketService()
