export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'institution_admin' | 'institution_staff' | 'administration_admin' | 'administration_staff';
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

// Institution/Administration types
export interface InstitutionAdminProfile {
  id: string;
  user: string;
  user_email: string;
  user_name: string;
  organization: string;
  organization_name: string;
  organization_type: 'institute' | 'administration';
  role: 'institute_admin' | 'institute_staff' | 'administration_admin' | 'administration_staff';
  is_primary_admin: boolean;
  can_manage_users: boolean;
  can_view_analytics: boolean;
  status: 'active' | 'inactive' | 'suspended';
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstitutionUserAssociation {
  id: string;
  institution: string;
  institution_name: string;
  user: string;
  user_email: string;
  user_name: string;
  user_first_name: string;
  user_last_name: string;
  user_phone: string | null;
  user_date_joined: string;
  association_type: 'student' | 'patient' | 'client' | 'member' | 'other';
  status: 'active' | 'inactive' | 'archived';
  added_by: string;
  added_by_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InstitutionDashboardData {
  institution: {
    id: string;
    legal_name: string;
    display_name: string;
    slug: string;
    organization_type: string;
    registration_number: string;
    country: string;
    status: string;
    institution_type: 'institute' | 'administration';
    institution_status: string;
    institution_enabled_at: string | null;
    institution_enabled_by: string | null;
    created_by: string;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string;
    updated_at: string;
  };
  admin_profile: InstitutionAdminProfile;
  total_users: number;
  user_counts: Record<string, number>;
  associations: InstitutionUserAssociation[];
}

export interface UserSearchResult {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  created_at: string;
}

export interface InstitutionLoginResponse {
  user: User;
  institution_admin_profile: InstitutionAdminProfile;
  access: string;
  refresh: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class AuthService {
  private readonly CURRENT_USER_KEY = 'counsellingAi_currentUser';
  private readonly ACCESS_TOKEN_KEY = 'counsellingAi_accessToken';
  private readonly REFRESH_TOKEN_KEY = 'counsellingAi_refreshToken';
  private readonly INSTITUTION_PROFILE_KEY = 'counsellingAi_institutionProfile';

  private async request<T>(endpoint: string, options: RequestInit & { skipAuth?: boolean } = {}): Promise<T> {
    const { skipAuth, headers: customHeaders, ...fetchOptions } = options;
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string> || {}),
    };

    if (!skipAuth) {
      const accessToken = this.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle empty bodies (e.g. DRF returns 204 No Content for logout/delete)
    const text = await response.text();
    
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // If response is not JSON (e.g. HTML error page from server)
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      // If OK but not JSON, return empty object
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || data.detail || data.non_field_errors?.[0] || `Request failed: ${response.status}`);
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
        skipAuth: true,
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

      // Fetch current user using the NEW access token
      const userData = await this.request<User>('/auth/users/me/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.access}`,
        },
      });

      if (userData) {
        this.setCurrentUser(this.mapDjangoUser(userData));
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
      const data = await this.request<{ access: string; refresh: string }>('/auth/token/', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
        }),
      });

      if (data.access && data.refresh) {
        this.setTokens(data.access, data.refresh);
      }

      // Fetch current user using the NEW access token
      const userData = await this.request<User>('/auth/users/me/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.access}`,
        },
      });

      if (userData) {
        this.setCurrentUser(this.mapDjangoUser(userData));
      }

      return { success: true, message: 'Login successful', user: this.getCurrentUser()!, access: data.access, refresh: data.refresh };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, message };
    }
  }

  /**
   * Institution/Administration login
   */
  async institutionLogin(email: string, password: string, institutionId?: string): Promise<{ success: boolean; message: string; data?: InstitutionLoginResponse }> {
    try {
      const body: Record<string, any> = {
        email: email.toLowerCase(),
        password,
      };
      if (institutionId) {
        body.institution_id = institutionId;
      }

      const data = await this.request<InstitutionLoginResponse>('/organizations/institution/login/', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify(body),
      });

      if (data.access && data.refresh) {
        this.setTokens(data.access, data.refresh);
        // Store institution profile separately
        localStorage.setItem(this.INSTITUTION_PROFILE_KEY, JSON.stringify(data.institution_admin_profile));
      }

      // Map user with institution role
      const user = this.mapDjangoUser(data.user);
      user.role = data.institution_admin_profile.role;
      this.setCurrentUser(user);

      return { success: true, message: 'Institution login successful', data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Institution login failed';
      return { success: false, message };
    }
  }

  /**
   * Get institution dashboard data
   */
  async getInstitutionDashboard(institutionId?: string): Promise<InstitutionDashboardData | null> {
    try {
      let endpoint = '/organizations/institution/dashboard/';
      if (institutionId) {
        endpoint += `?institution_id=${institutionId}`;
      }
      
      const data = await this.request<InstitutionDashboardData>(endpoint, {
        method: 'GET',
      });
      return data;
    } catch (error: unknown) {
      console.error('Failed to fetch institution dashboard:', error);
      return null;
    }
  }

  /**
   * Search platform users for institution association
   */
  async searchInstitutionUsers(query: string, institutionId?: string, limit = 50): Promise<UserSearchResult[]> {
    try {
      let endpoint = `/organizations/institution/users/search/?q=${encodeURIComponent(query)}&limit=${limit}`;
      if (institutionId) {
        endpoint += `&institution_id=${institutionId}`;
      }
      
      const data = await this.request<UserSearchResult[]>(endpoint, {
        method: 'GET',
      });
      return data;
    } catch (error: unknown) {
      console.error('Failed to search institution users:', error);
      return [];
    }
  }

  /**
   * Associate a user with an institution
   */
  async associateInstitutionUser(
    userId: string,
    associationType: 'student' | 'patient' | 'client' | 'member' | 'other' = 'member',
    notes: string = '',
    institutionId?: string
  ): Promise<{ success: boolean; message: string; association?: InstitutionUserAssociation }> {
    try {
      const body: Record<string, any> = {
        user_id: userId,
        association_type: associationType,
        notes,
      };
      if (institutionId) {
        body.institution_id = institutionId;
      }

      const data = await this.request<InstitutionUserAssociation>('/organizations/institution/users/associate/', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: true, message: 'User associated successfully', association: data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to associate user';
      return { success: false, message };
    }
  }

  /**
   * Get institution user associations (paginated)
   */
  async getInstitutionAssociations(
    institutionId?: string,
    params?: {
      association_type?: string;
      status?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<{ results: InstitutionUserAssociation[]; total: number; page: number; pages: number; has_next: boolean; has_previous: boolean } | null> {
    try {
      let endpoint = '/organizations/institution/associations/';
      const queryParams = new URLSearchParams();
      if (institutionId) queryParams.append('institution_id', institutionId);
      if (params?.association_type) queryParams.append('association_type', params.association_type);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      if (queryParams.toString()) endpoint += `?${queryParams.toString()}`;

      const data = await this.request<{ results: InstitutionUserAssociation[]; total: number; page: number; pages: number; has_next: boolean; has_previous: boolean }>(endpoint, {
        method: 'GET',
      });
      return data;
    } catch (error: unknown) {
      console.error('Failed to fetch institution associations:', error);
      return null;
    }
  }

  /**
   * Update an institution user association
   */
  async updateInstitutionAssociation(
    associationId: string,
    updates: { association_type?: string; notes?: string },
    institutionId?: string
  ): Promise<{ success: boolean; message: string; association?: InstitutionUserAssociation }> {
    try {
      const body: Record<string, any> = { ...updates };
      if (institutionId) body.institution_id = institutionId;

      const data = await this.request<InstitutionUserAssociation>(`/organizations/institution/associations/${associationId}/`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      return { success: true, message: 'Association updated', association: data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update association';
      return { success: false, message };
    }
  }

  /**
   * Remove an institution user association
   */
  async removeInstitutionAssociation(
    associationId: string,
    institutionId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const endpoint = institutionId 
        ? `/organizations/institution/associations/${associationId}/?institution_id=${institutionId}`
        : `/organizations/institution/associations/${associationId}/`;

      await this.request(endpoint, {
        method: 'DELETE',
      });

      return { success: true, message: 'Association removed' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to remove association';
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
      localStorage.removeItem(this.INSTITUTION_PROFILE_KEY);
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
   * Get current institution profile
   */
  getInstitutionProfile(): InstitutionAdminProfile | null {
    const profileStr = localStorage.getItem(this.INSTITUTION_PROFILE_KEY);
    if (!profileStr) return null;
    try {
      return JSON.parse(profileStr) as InstitutionAdminProfile;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is institution admin
   */
  isInstitutionAdmin(): boolean {
    const user = this.getCurrentUser();
    const profile = this.getInstitutionProfile();
    return !!user && !!profile && user.role.startsWith('institute') || user.role.startsWith('administration');
  }

  /**
   * Check if user is institution admin with manage users permission
   */
  canManageInstitutionUsers(): boolean {
    const profile = this.getInstitutionProfile();
    return profile?.can_manage_users === true;
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
        skipAuth: true,
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
      localStorage.removeItem(this.INSTITUTION_PROFILE_KEY);
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
   * Get all users (admin)
   */
  async getAllUsers(): Promise<User[]> {
    try {
      // DRF paginates list endpoints: { count, next, previous, results }
      const data = await this.request<
        Record<string, unknown>[] | { results?: Record<string, unknown>[] }
      >('/auth/users/', {
        method: 'GET',
      });
      const users = Array.isArray(data) ? data : data.results ?? [];
      return users.map((user) => this.mapDjangoUser(user));
    } catch {
      return [];
    }
  }

  /**
   * Create a new user (admin)
   */
  async createAdminUser(
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const nameParts = name.trim().split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    try {
      await this.request('/auth/users/register/', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
          first_name,
          last_name,
        }),
      });
      return { success: true, message: 'Admin user created successfully' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create admin user';
      return { success: false, error: message };
    }
  }

  /**
   * Delete a user by ID (admin)
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.request(`/auth/users/${userId}/`, {
        method: 'DELETE',
      });
      return { success: true, message: 'User deleted' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete user';
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