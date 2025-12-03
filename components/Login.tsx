
import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheck, LogIn, Cloud } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[]; // Nhận danh sách users từ App
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic đăng nhập
    // Trong thực tế với Supabase Auth, bạn sẽ gọi supabase.auth.signInWithPassword
    // Nhưng để giữ code đơn giản và tương thích cấu trúc cũ, ta vẫn check với bảng 'users' đã fetch về
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      onLogin(user);
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-full mb-4 shadow-lg">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Quản Lý Hồ Sơ</h1>
          <p className="text-gray-500 text-sm mt-1">Hệ thống hành chính công</p>
          
          <div className="mt-3 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
             <Cloud size={12} />
             <span>Hệ thống Online (Supabase)</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <LogIn size={20} />
            Đăng nhập
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Mặc định: <b>admin/123</b> (Cần tạo user này trong Database trước)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
