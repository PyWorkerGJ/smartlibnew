import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('smartlib_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('smartlib_token', token);
  } else {
    localStorage.removeItem('smartlib_token');
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = BACKEND_URL || window.location.origin;
    socket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

