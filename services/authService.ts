import { User } from '../types';
import { isConfigured, supabase } from './supabaseClient';

const getAuthBaseUrl = (): string => {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return 'http://127.0.0.1:3005';
    }
    return '';
};

const readErrorMessage = async (response: Response): Promise<string> => {
    try {
        const body = await response.json();
        return body?.error || body?.message || `Máy chủ trả về lỗi ${response.status}.`;
    } catch {
        return `Máy chủ trả về lỗi ${response.status}.`;
    }
};

export const authenticateUser = async (username: string, password: string): Promise<User> => {
    if (isConfigured) {
        const { data, error } = await supabase.rpc('login_user', {
            p_username: username,
            p_password: password
        });
        if (error) throw new Error(error.message || 'Không thể xác thực với máy chủ dữ liệu.');
        if (!data?.token || !data?.user) throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
        localStorage.setItem('app_session_token', data.token);
        return data.user as User;
    }

    const response = await fetch(`${getAuthBaseUrl()}/custom/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error(await readErrorMessage(response));

    const body = await response.json();
    if (!body?.token || !body?.user) throw new Error('Phản hồi đăng nhập không hợp lệ.');
    localStorage.setItem('auth_token', body.token);
    return body.user as User;
};

export const restoreAuthenticatedUser = async (): Promise<User | null> => {
    if (isConfigured) {
        const sessionToken = localStorage.getItem('app_session_token');
        if (!sessionToken) return null;
        const { data, error } = await supabase.rpc('validate_app_session');
        if (!error && data?.user) return data.user as User;
        localStorage.removeItem('app_session_token');
        localStorage.removeItem('currentUser');
        return null;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    try {
        const response = await fetch(`${getAuthBaseUrl()}/custom/session`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Phiên đăng nhập không còn hợp lệ.');
        const body = await response.json();
        return body?.user || null;
    } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        return null;
    }
};
