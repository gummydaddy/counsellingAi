export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  access?: string;
  refresh?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class AuthService {
  private readonly CURRENT_USER_KEY = 'counsellingAi_currentUser';
  private readonly ACCESS_TOKEN_KEY = 'counsellingAi_accessToken';
  private readonly REFRESH_TOKEN_KEY = 'counsellingAi_refreshToken';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const accessToken = this.getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  private setTokens(access: string, refresh: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, access);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refresh);
  }

  private clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Register a new user
   */
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    try {
      const data = await this.request<AuthResponse>('/auth/users/register/', {
        method: 'POST',
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
          first_name,
          last_name,
        }),
      });

      if (data.access && data.refresh) {
        this.setTokens(data.access, data.refresh);
      }

      if (data.user) {
        this.setCurrentUser(this.mapDjangoUser(data.user));
      }

      return { success: true, message: 'Account created successfully', user: this.getCurrentUser()! };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return { success: false, message };
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const data = await this.request<{ access: string; refresh: string; user: User }>('/auth/token/', {
        method: 'POST',
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
        }),
      });

      if (data.access && data.refresh) {
        this.setTokens(data.access, data.refresh);
      }

      if (data.user) {
        this.setCurrentUser(this.mapDjangoUser(data.user));
      }

      return { success: true, message: 'Login successful', user: this.getCurrentUser()!, access: data.access, refresh: data.refresh };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, message };
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.request('/auth/users/logout/', {
        method: 'POST',
      });
    } catch {
      // Ignore logout errors
    } finally {
      this.clearTokens();
      localStorage.removeItem(this.CURRENT_USER_KEY);
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.CURRENT_USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  }

  /**
   * Set current user
   */
  private setCurrentUser(user: User): void {
    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null && this.getAccessToken() !== null;
  }

  /**
   * Check if admin
   */
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const data = await this.request<{ access: string }>('/auth/token/refresh/', {
        method: 'POST',
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (data.access) {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, data.access);
        return true;
      }
      return false;
    } catch {
      this.clearTokens();
      localStorage.removeItem(this.CURRENT_USER_KEY);
      return false;
    }
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<AuthResponse> {
    try {
      await this.request('/auth/users/change_password/', {
        method: 'POST',
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      return { success: true, message: 'Password changed successfully' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to change password';
      return { success: false, message };
    }
  }

  /**
   * Delete account
   */
  async deleteAccount(password: string): Promise<AuthResponse> {
    try {
      await this.request('/auth/users/me/', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
      this.logout();
      return { success: true, message: 'Account deleted successfully' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      return { success: false, message };
    }
  }

  /**
   * Map Django user to frontend User type
   */
  private mapDjangoUser(djangoUser: Record<string, unknown>): User {
    return {
      id: djangoUser.id as string,
      email: djangoUser.email as string,
      name: djangoUser.first_name && djangoUser.last_name
        ? `${djangoUser.first_name} ${djangoUser.last_name}`.trim()
        : djangoUser.email as string,
      firstName: djangoUser.first_name as string,
      lastName: djangoUser.last_name as string,
      role: djangoUser.is_superuser || djangoUser.is_staff ? 'admin' : 'user',
      createdAt: djangoUser.created_at as string,
    };
  }
}

// Singleton export (matches project pattern)
export const authService = new AuthService();