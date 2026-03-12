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

class ApiRepository {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async signup(data: SignupPayload): Promise<ApiResponse<User>> {
    try {
      const response = await fetch(`${this.baseUrl}/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.message || "Erro ao criar conta",
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data: result.user || result,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro na requisição",
      };
    }
  }

  async login(data: LoginPayload): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.message || "Erro ao fazer login",
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data: result,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro na requisição",
      };
    }
  }
}

export const apiRepository = new ApiRepository(API_URL);
