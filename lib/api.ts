const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  statusCode?: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignupPayload {
  username: string;
  name: string;
  password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

// Friends & Chat types
export interface UserResult {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
}

export interface FriendRequest {
  _id: string;
  requester: UserResult;
  recipient: string;
  status: "pending";
}

export interface FriendItem {
  _id: string; // friendshipId
  requester: UserResult;
  recipient: UserResult;
  status: "accepted";
}

export interface ConversationParticipant {
  _id: string;
  username: string;
  name: string;
  status?: string;
  avatar?: string;
}

export interface ConversationLastMessage {
  _id: string;
  content: string;
  sender: string;
  createdAt: string;
}

export interface ConversationItem {
  _id: string;
  participants: ConversationParticipant[];
  lastMessage?: ConversationLastMessage | null;
  archivedBy: string[];
  updatedAt: string;
  unreadCount?: number;
}

export interface MessageItem {
  _id: string;
  conversation: string;
  sender: { _id: string; username: string; name: string };
  content: string;
  createdAt: string;
}

class ApiRepository {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async authFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const { getAuthHeader } = await import("./auth");
    const headers = {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(options.headers ?? {}),
    };
    return fetch(`${this.baseUrl}${path}`, { ...options, headers });
  }

  // --- Auth ---

  async signup(data: SignupPayload): Promise<ApiResponse<User>> {
    try {
      const response = await fetch(`${this.baseUrl}/users/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.message || "Erro ao criar conta", statusCode: response.status };
      return { success: true, data: result.user || result, statusCode: response.status };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async login(data: LoginPayload): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.message || "Erro ao fazer login", statusCode: response.status };
      return { success: true, data: result, statusCode: response.status };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  // --- Users ---

  async searchUsers(q: string): Promise<ApiResponse<UserResult[]>> {
    try {
      const response = await this.authFetch(`/users/search?q=${encodeURIComponent(q)}`);
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.error, statusCode: response.status };
      return { success: true, data: result.users };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  // --- Friends ---

  async sendFriendRequest(recipientId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch("/friends/request", { method: "POST", body: JSON.stringify({ recipientId }) });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.error, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async listFriendRequests(): Promise<ApiResponse<FriendRequest[]>> {
    try {
      const response = await this.authFetch("/friends/requests");
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true, data: result.requests };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async listFriends(): Promise<ApiResponse<FriendItem[]>> {
    try {
      const response = await this.authFetch("/friends/");
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true, data: result.friends };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async acceptFriendRequest(friendshipId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch(`/friends/accept/${friendshipId}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.error, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async rejectFriendRequest(friendshipId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch(`/friends/reject/${friendshipId}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.error, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async removeFriend(friendshipId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch(`/friends/${friendshipId}`, { method: "DELETE" });
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  // --- Chat ---

  async startConversation(friendId: string): Promise<ApiResponse<ConversationItem>> {
    try {
      const response = await this.authFetch("/chat/conversations", { method: "POST", body: JSON.stringify({ friendId }) });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.error, statusCode: response.status };
      return { success: true, data: result.conversation };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async listConversations(): Promise<ApiResponse<ConversationItem[]>> {
    try {
      const response = await this.authFetch("/chat/conversations");
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true, data: result.conversations };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async getMessages(conversationId: string, limit = 50, before?: string): Promise<ApiResponse<MessageItem[]>> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (before) params.set("before", before);
      const response = await this.authFetch(`/chat/conversations/${conversationId}/messages?${params}`);
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true, data: result.messages };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async listArchivedConversations(): Promise<ApiResponse<ConversationItem[]>> {
    try {
      const response = await this.authFetch("/chat/conversations/archived");
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true, data: result.conversations };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async archiveConversation(conversationId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch(`/chat/conversations/${conversationId}/archive`, { method: "PATCH" });
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async unarchiveConversation(conversationId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch(`/chat/conversations/${conversationId}/unarchive`, { method: "PATCH" });
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async deleteConversation(conversationId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch(`/chat/conversations/${conversationId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  // --- Profile ---

  async getMyProfile(): Promise<ApiResponse<{ _id: string; username: string; name: string; avatar: string | null }>> {
    try {
      const response = await this.authFetch("/users/me");
      const result = await response.json();
      if (!response.ok) return { success: false, statusCode: response.status };
      return { success: true, data: result.user };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }

  async uploadAvatar(avatar: string | null): Promise<ApiResponse<void>> {
    try {
      const response = await this.authFetch("/users/avatar", { method: "PATCH", body: JSON.stringify({ avatar }) });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.error, statusCode: response.status };
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Erro na requisição" };
    }
  }
}

export const apiRepository = new ApiRepository(API_URL);
