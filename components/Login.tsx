
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, LogIn, Settings, Server, Wifi, HardDrive } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[]; // Nhận danh sách users từ App
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // State quản lý cấu hình Server
  const [showConfig, setShowConfig] = useState(false);
  const [serverIp, setServerIp] = useState('');

  useEffect(() => {
    // Lấy IP đã lưu hoặc mặc định localhost
    const saved = localStorage.getItem('SERVER_URL') || 'http://localhost:3000';
    setServerIp(saved);
  }, []);

  const saveConfig = (customUrl?: string) => {
    let url = customUrl || serverIp.trim();
    // Tự động thêm http:// nếu thiếu
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `http://${url}`;
    }
    // Xóa dấu / ở cuối nếu có
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    localStorage.setItem('SERVER_URL', url);
    setServerIp(url);
    
    // Nếu là thao tác tay thì hiện thông báo, nếu auto thì thôi
    if (!customUrl) {
        alert(`Đã lưu cấu hình máy chủ: ${url}\nVui lòng tải lại ứng dụng để áp dụng.`);
        window.location.reload();
    } else {
        // Tự động reload nhanh
        window.location.reload();
    }
  };

  const useLocalServer = () => {
      if(confirm('Bạn muốn dùng máy này làm Máy Chủ?\n\nỨng dụng sẽ kết nối tới Cơ sở dữ liệu nội bộ trên máy này.')) {
          saveConfig('http://localhost:3000');
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      onLogin(user);
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
  };

  const isLocalhost = serverIp.includes('localhost') || serverIp.includes('127.0.0.1');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative">
      {/* Nút mở cấu hình Server góc phải */}
      <button 
        onClick={() => setShowConfig(true)}
        className="absolute top-4 right-4 flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200"
      >
        <Settings size={18} />
        <span className="text-sm font-medium">Cấu hình Kết nối</span>
      </button>

      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-full mb-4 shadow-lg">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Quản Lý Hồ Sơ</h1>
          <p className="text-gray-500 text-sm mt-1">Hệ thống quản lý hành chính công</p>
          
          <div className={`mt-3 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${isLocalhost ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
             {isLocalhost ? <HardDrive size={12} /> : <Wifi size={12} />}
             {isLocalhost ? 'Máy chủ: Thiết bị này (Local)' : `Máy chủ: ${serverIp}`}
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
            Mặc định: <b>admin/123</b>
          </p>
        </div>
      </div>

      {/* Modal Cấu hình Server */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in-up">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Server className="text-blue-600" size={20} />
                        Kết nối Máy chủ
                    </h3>
                </div>
                <div className="p-6 space-y-5">
                    
                    {/* Nút chọn nhanh Localhost */}
                    <div 
                        onClick={useLocalServer}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors flex items-center gap-3 ${isLocalhost ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50 border-gray-300'}`}
                    >
                        <div className={`p-2 rounded-full ${isLocalhost ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                            <HardDrive size={20} />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-gray-800">Dùng máy này làm Máy chủ</div>
                            <div className="text-xs text-gray-500">Dữ liệu lưu trực tiếp trên máy này</div>
                        </div>
                    </div>

                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-gray-400 font-semibold uppercase">Hoặc kết nối LAN</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nhập IP Máy chủ khác</label>
                        <div className="relative">
                            <Wifi className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                value={serverIp}
                                onChange={(e) => setServerIp(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ví dụ: 192.168.1.15:3000"
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-3 justify-end pt-2">
                        <button 
                            onClick={() => setShowConfig(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium"
                        >
                            Đóng
                        </button>
                        <button 
                            onClick={() => saveConfig()}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium shadow-sm"
                        >
                            Lưu IP
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Login;
