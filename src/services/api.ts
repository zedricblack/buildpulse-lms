import {
  User,
  Worker,
  AttendanceRecord,
  LaborAssignment,
  WorkActivity,
  DailyAccomplishment,
  Supervisor,
  WorkArea,
  AuditLog,
  SystemSettings,
  DashboardStats
} from '../types';

const TOKEN_KEY = 'buildpulse_lms_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function toQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (
      val !== undefined &&
      val !== null &&
      val !== '' &&
      val !== 'all' &&
      val !== 'undefined' &&
      val !== 'null'
    ) {
      searchParams.append(key, String(val).trim());
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) {
        errorMessage = data.error;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User; permissions: any[] }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  getCurrentUser: () =>
    request<{ user: User; permissions: any[] }>('/auth/me'),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  requestPasswordReset: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/reset-password-request', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  // Users (Admin)
  getUsers: () =>
    request<User[]>('/users'),

  createUser: (userData: any) =>
    request<{ success: boolean; userId: string; message: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

  updateUser: (id: string, userData: any) =>
    request<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    }),

  updateUserStatus: (id: string, status: 'active' | 'inactive') =>
    request<{ success: boolean; message: string }>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  resetUserPassword: (id: string, newPassword: string) =>
    request<{ success: boolean; message: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    }),

  // Workers
  getWorkers: (params?: { search?: string; trade?: string; type?: string; status?: string }) => {
    return request<Worker[]>(`/workers${toQueryString(params)}`);
  },

  getWorker: (id: string) =>
    request<Worker>(`/workers/${id}`),

  createWorker: (worker: Partial<Worker>) =>
    request<{ success: boolean; message: string }>('/workers', {
      method: 'POST',
      body: JSON.stringify(worker)
    }),

  updateWorker: (id: string, worker: Partial<Worker>) =>
    request<{ success: boolean; message: string }>(`/workers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(worker)
    }),

  updateWorkerStatus: (id: string, status: 'Active' | 'Inactive') =>
    request<{ success: boolean; message: string }>(`/workers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  deleteWorker: (id: string) =>
    request<{ success: boolean; message: string }>(`/workers/${id}`, {
      method: 'DELETE'
    }),

  // Supervisors & Work Areas
  getSupervisors: () =>
    request<Supervisor[]>('/supervisors'),

  createSupervisor: (data: Partial<Supervisor>) =>
    request<{ success: boolean }>('/supervisors', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getWorkAreas: () =>
    request<WorkArea[]>('/work-areas'),

  createWorkArea: (data: Partial<WorkArea>) =>
    request<{ success: boolean }>('/work-areas', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Activities
  getActivities: () =>
    request<WorkActivity[]>('/activities'),

  createActivity: (activity: Partial<WorkActivity>) =>
    request<{ success: boolean; message: string }>('/activities', {
      method: 'POST',
      body: JSON.stringify(activity)
    }),

  updateActivity: (id: string, activity: Partial<WorkActivity>) =>
    request<{ success: boolean; message: string }>(`/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(activity)
    }),

  updateActivityStatus: (id: string, status: 'Active' | 'Inactive') =>
    request<{ success: boolean; message: string }>(`/activities/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  // Attendance
  getAttendance: (params?: { date?: string; workerId?: string; trade?: string; status?: string }) => {
    return request<AttendanceRecord[]>(`/attendance${toQueryString(params)}`);
  },

  createAttendance: (data: any) =>
    request<{ success: boolean; message: string }>('/attendance', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateAttendance: (id: string, data: any) =>
    request<{ success: boolean; message: string }>(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteAttendance: (id: string) =>
    request<{ success: boolean; message: string }>(`/attendance/${id}`, {
      method: 'DELETE'
    }),

  // Assignments
  getAssignments: (params?: { date?: string; workerId?: string; activityId?: string; areaId?: string; supervisorId?: string; status?: string }) => {
    return request<LaborAssignment[]>(`/assignments${toQueryString(params)}`);
  },

  createAssignment: (data: any) =>
    request<{ success: boolean; message: string }>('/assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateAssignment: (id: string, data: any) =>
    request<{ success: boolean; message: string }>(`/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateAssignmentStatus: (id: string, status: string) =>
    request<{ success: boolean; message: string }>(`/assignments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  deleteAssignment: (id: string) =>
    request<{ success: boolean; message: string }>(`/assignments/${id}`, {
      method: 'DELETE'
    }),

  // Accomplishments
  getAccomplishments: (params?: { date?: string; activityId?: string; areaId?: string; status?: string }) => {
    return request<DailyAccomplishment[]>(`/accomplishments${toQueryString(params)}`);
  },

  createAccomplishment: (data: any) =>
    request<{ success: boolean; message: string }>('/accomplishments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateAccomplishment: (id: string, data: any) =>
    request<{ success: boolean; message: string }>(`/accomplishments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteAccomplishment: (id: string) =>
    request<{ success: boolean; message: string }>(`/accomplishments/${id}`, {
      method: 'DELETE'
    }),

  // Dashboard
  getDashboardStats: (date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<DashboardStats>(`/dashboard/stats${query}`);
  },

  // Audit Logs
  getAuditLogs: (params?: { module?: string; action?: string; search?: string }) => {
    return request<AuditLog[]>(`/audit-logs${toQueryString(params)}`);
  },

  // Settings & System
  getSettings: () =>
    request<{ settings: SystemSettings; databaseStats: any }>('/settings'),

  updateSettings: (data: any) =>
    request<{ success: boolean; message: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  seedDatabase: (forceReset = false) =>
    request<{ seeded: boolean; message: string }>('/system/seed', {
      method: 'POST',
      body: JSON.stringify({ forceReset })
    }),

  syncFirestore: () =>
    request<{ success: boolean; message: string; workerIds: string[] }>('/system/sync-firestore', {
      method: 'POST'
    })
};
