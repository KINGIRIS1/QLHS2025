
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Message, ChatGroup, UserRole, Employee } from '../types';
import { fetchMessages, sendMessageApi, uploadChatFile, fetchChatGroups, createChatGroup, deleteChatGroup, deleteMessageApi, addMemberToGroupApi } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { Send, Paperclip, File as FileIcon, X, Loader2, Image as ImageIcon, Download, Hash, MapPin, Plus, Trash2, Users, Monitor, Camera, UserPlus, Shield } from 'lucide-react';

interface InternalChatProps {
  currentUser: User;
  wards?: string[]; 
  employees: Employee[]; 
  users: User[]; // Danh sách tài khoản để thêm vào nhóm
}

const normalizeStr = (str: string) => str ? str.toLowerCase().trim() : '';

const InternalChat: React.FC<InternalChatProps> = ({ currentUser, wards = [], employees, users }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Group State
  const [currentGroupId, setCurrentGroupId] = useState<string>('GENERAL');
  const [customGroups, setCustomGroups] = useState<ChatGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  
  // Add Member State
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [targetGroupForAdd, setTargetGroupForAdd] = useState<ChatGroup | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load Groups
  useEffect(() => {
      loadGroups();
  }, []);

  const loadGroups = async () => {
      const groups = await fetchChatGroups();
      setCustomGroups(groups);
  };

  // Load messages when group changes
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      const data = await fetchMessages(50, currentGroupId);
      setMessages(data);
      setLoading(false);
    };

    loadMessages();

    // Subscribe to realtime changes (Lắng nghe cả INSERT và DELETE)
    const channel = supabase
      .channel(`chat:${currentGroupId}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            if (currentGroupId === 'GENERAL') {
                if (!newMsg.group_id || newMsg.group_id === 'GENERAL') {
                    setMessages(prev => [...prev, newMsg]);
                }
            } else {
                if (newMsg.group_id === currentGroupId) {
                    setMessages(prev => [...prev, newMsg]);
                }
            }
        } 
        else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentGroupId]);

  // --- LOGIC CHỤP MÀN HÌNH (CẬP NHẬT) ---
  const handleScreenshot = async () => {
      try {
          let stream: MediaStream | null = null;
          
          // 1. Kiểm tra môi trường Electron
          // Sử dụng userAgent hoặc check window.require
          const isElectron = /electron/i.test(navigator.userAgent) || !!(window as any).require;

          if (isElectron && (window as any).require) {
             try {
                 const { desktopCapturer } = (window as any).require('electron');
                 // Lấy nguồn màn hình (Screen 1, Screen 2...)
                 const sources = await desktopCapturer.getSources({ types: ['screen'] });
                 
                 if (sources && sources.length > 0) {
                     const source = sources[0]; // Mặc định lấy màn hình chính
                     
                     // Cấu hình constraints riêng cho Electron
                     const constraints = {
                         audio: false,
                         video: {
                             mandatory: {
                                 chromeMediaSource: 'desktop',
                                 chromeMediaSourceId: source.id,
                                 maxWidth: 1920,
                                 maxHeight: 1080,
                                 minWidth: 1280,
                                 minHeight: 720
                             }
                         }
                     };
                     
                     // Gọi getUserMedia thay vì getDisplayMedia trong Electron
                     // @ts-ignore
                     stream = await navigator.mediaDevices.getUserMedia(constraints);
                 }
             } catch (e) {
                 console.warn("Electron native capture failed, trying fallback...", e);
             }
          }

          // 2. Fallback Web API (Cho trình duyệt thường)
          if (!stream) {
               // Check HTTPS hoặc Localhost
               if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                  alert("LỖI: Trình duyệt chặn tính năng này trên giao thức HTTP (Mạng LAN).\nVui lòng sử dụng HTTPS hoặc Localhost, hoặc dùng App Electron.");
                  return;
               }

               if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                   alert("Trình duyệt không hỗ trợ chụp màn hình.");
                   return;
               }

               stream = await navigator.mediaDevices.getDisplayMedia({ 
                  video: true, 
                  audio: false 
              });
          }

          // 3. Xử lý Stream -> Ảnh
          if (stream) {
              const video = document.createElement('video');
              // Quan trọng: Phải gắn vào DOM (dù ẩn) để một số browser render được frame
              video.style.position = 'fixed';
              video.style.top = '-10000px';
              video.style.left = '-10000px';
              document.body.appendChild(video);

              video.srcObject = stream;
              await video.play();

              // Chờ 500ms để video stream ổn định và render frame đầu tiên
              await new Promise(r => setTimeout(r, 500));

              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob((blob) => {
                      if (blob) {
                          const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
                          const screenshotFile = new File([blob], `Screenshot_${timestamp}.png`, { type: 'image/png' });
                          setFile(screenshotFile);
                      }
                      
                      // Dọn dẹp tài nguyên
                      const tracks = stream?.getTracks();
                      tracks?.forEach(t => t.stop());
                      video.remove();
                      canvas.remove();
                  }, 'image/png');
              }
          }
      } catch (err: any) {
          console.error("Lỗi chụp màn hình:", err);
          if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
              // Người dùng hủy, không làm gì cả
          } else {
              alert(`Lỗi chụp màn hình: ${err.message || 'Không xác định'}\n(Thử lại bằng ứng dụng Electron nếu đang dùng Web)`);
          }
      }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          const pastedFile = e.clipboardData.files[0];
          if (pastedFile.type.startsWith('image/')) {
              e.preventDefault();
              setFile(pastedFile);
          }
      }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file) || sending) return;

    setSending(true);
    let fileUrl = '';
    let fileType = '';

    try {
        if (file) {
            const url = await uploadChatFile(file);
            if (!url) {
                setSending(false);
                return;
            }
            fileUrl = url;
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) fileType = 'image';
            else fileType = 'document';
        }

        await sendMessageApi({
            sender_username: currentUser.username,
            sender_name: currentUser.name,
            content: newMessage,
            file_url: fileUrl || undefined,
            file_name: file ? file.name : undefined,
            file_type: fileType || undefined,
            group_id: currentGroupId
        });

        setNewMessage('');
        setFile(null);
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Gửi tin nhắn thất bại.");
    } finally {
        setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setFile(e.target.files[0]);
      }
  };

  const handleCreateGroup = async () => {
      if (!newGroupName.trim()) return;
      // Khi tạo nhóm mới, user hiện tại sẽ là thành viên đầu tiên
      const group = await createChatGroup(newGroupName, 'CUSTOM', currentUser.username, [currentUser.username]);
      if (group) {
          setCustomGroups(prev => [...prev, group]);
          setNewGroupName('');
          setIsCreatingGroup(false);
      }
  };

  const handleDeleteGroup = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAdmin) return;
      if (confirm("XÁC NHẬN: Bạn có chắc muốn xóa nhóm chat này? Tin nhắn trong nhóm sẽ không thể truy cập.")) {
          const success = await deleteChatGroup(id);
          if (success) {
              setCustomGroups(prev => prev.filter(g => g.id !== id));
              if (currentGroupId === id) setCurrentGroupId('GENERAL');
          }
      }
  };

  const handleRecallMessage = async (msgId: string) => {
      if (confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) {
          const success = await deleteMessageApi(msgId);
          if (!success) {
              alert("Không thể thu hồi tin nhắn. Vui lòng thử lại.");
          }
      }
  };

  // --- LOGIC THÊM THÀNH VIÊN ---
  const openAddMemberModal = (group: ChatGroup, e: React.MouseEvent) => {
      e.stopPropagation();
      setTargetGroupForAdd(group);
      setIsAddMemberModalOpen(true);
  };

  const handleAddMember = async (username: string) => {
      if (!targetGroupForAdd || !isAdmin) return;
      
      const currentMembers = targetGroupForAdd.members || [];
      if (currentMembers.includes(username)) return; // Đã có

      const newMembers = [...currentMembers, username];
      const success = await addMemberToGroupApi(targetGroupForAdd.id, newMembers);
      
      if (success) {
          // Update local state
          const updatedGroup = { ...targetGroupForAdd, members: newMembers };
          setCustomGroups(prev => prev.map(g => g.id === targetGroupForAdd.id ? updatedGroup : g));
          setTargetGroupForAdd(updatedGroup);
      }
  };

  const handleRemoveMember = async (username: string) => {
      if (!targetGroupForAdd || !isAdmin) return;

      const newMembers = (targetGroupForAdd.members || []).filter(m => m !== username);
      const success = await addMemberToGroupApi(targetGroupForAdd.id, newMembers);

       if (success) {
          const updatedGroup = { ...targetGroupForAdd, members: newMembers };
          setCustomGroups(prev => prev.map(g => g.id === targetGroupForAdd.id ? updatedGroup : g));
          setTargetGroupForAdd(updatedGroup);
      }
  };

  // --- LOGIC LỌC NHÓM HIỂN THỊ ---
  // Hiển thị nếu: (Là Admin) HOẶC (Là chủ nhóm) HOẶC (Có tên trong members) HOẶC (Nhóm Public - members null)
  const myCustomGroups = useMemo(() => {
      if (isAdmin) return customGroups;
      return customGroups.filter(g => {
          if (!g.members || g.members.length === 0) return true; // Public
          if (g.created_by === currentUser.username) return true;
          if (g.members.includes(currentUser.username)) return true;
          return false;
      });
  }, [customGroups, currentUser, isAdmin]);

  const visibleWards = useMemo(() => {
      if (isAdmin) return wards;
      const currentEmp = employees.find(e => e.id === currentUser.employeeId);
      if (!currentEmp || !currentEmp.managedWards) return [];
      const empWardsNormalized = currentEmp.managedWards.map(normalizeStr);
      return wards.filter(w => empWardsNormalized.includes(normalizeStr(w)));
  }, [wards, currentUser, employees, isAdmin]);


  const formatTime = (isoString: string) => {
      const date = new Date(isoString);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Hash size={18} className="text-blue-600"/> Nhóm Chat
              </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Nút CHUNG */}
              <button 
                  onClick={() => setCurrentGroupId('GENERAL')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${currentGroupId === 'GENERAL' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                  <Users size={16} /> Chung
              </button>

              {visibleWards.length > 0 && (
                  <div className="mt-4 mb-1 px-3 text-xs font-bold text-gray-400 uppercase">Khu vực / Xã Phường</div>
              )}
              {visibleWards.map(ward => {
                  const wardGroupId = `WARD_${ward}`; 
                  return (
                    <button 
                        key={ward}
                        onClick={() => setCurrentGroupId(wardGroupId)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${currentGroupId === wardGroupId ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <MapPin size={16} /> {ward}
                    </button>
                  );
              })}

              {/* Danh sách Nhóm Tùy Chỉnh */}
              <div className="mt-4 mb-1 px-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">Nhóm tùy chỉnh</span>
                  {isAdmin && (
                      <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} className="text-gray-400 hover:text-blue-600"><Plus size={14} /></button>
                  )}
              </div>
              
              {isCreatingGroup && (
                  <div className="px-2 mb-2">
                      <div className="flex gap-1">
                          <input 
                              type="text" 
                              className="w-full border rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                              placeholder="Tên nhóm..."
                              value={newGroupName}
                              onChange={e => setNewGroupName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                              autoFocus
                          />
                          <button onClick={handleCreateGroup} className="bg-blue-600 text-white px-2 rounded text-xs"><Plus size={12} /></button>
                      </div>
                  </div>
              )}

              {myCustomGroups.map(group => (
                  <button 
                    key={group.id}
                    onClick={() => setCurrentGroupId(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm font-medium group relative ${currentGroupId === group.id ? 'bg-purple-100 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                        <Hash size={16} /> <span className="truncate">{group.name}</span>
                    </div>
                    
                    {/* Admin Actions */}
                    {isAdmin && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span onClick={(e) => openAddMemberModal(group, e)} className="p-1 text-gray-400 hover:text-blue-600" title="Thêm thành viên">
                                <UserPlus size={12} />
                            </span>
                            <span onClick={(e) => handleDeleteGroup(group.id, e)} className="p-1 text-gray-400 hover:text-red-500" title="Xóa nhóm">
                                <Trash2 size={12} />
                            </span>
                        </div>
                    )}
                  </button>
              ))}

              {myCustomGroups.length === 0 && !isCreatingGroup && (
                  <div className="px-3 text-xs text-gray-400 italic">Chưa có nhóm nào.</div>
              )}
          </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10 shrink-0">
            <div>
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    {currentGroupId === 'GENERAL' ? (
                        <>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            Kênh Chung
                        </>
                    ) : (
                        <>
                            <Hash size={18} className="text-blue-600" />
                            {currentGroupId.startsWith('WARD_') ? currentGroupId.replace('WARD_', '') : customGroups.find(g => g.id === currentGroupId)?.name || 'Nhóm Chat'}
                        </>
                    )}
                </h2>
                <p className="text-xs text-gray-500">
                    {currentGroupId === 'GENERAL' ? 'Tin nhắn toàn công ty' : 'Trao đổi công việc nội bộ'}
                </p>
            </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {loading ? (
                <div className="flex justify-center items-center h-full text-gray-400">
                    <Loader2 className="animate-spin" />
                </div>
            ) : (
                messages.length > 0 ? messages.map((msg) => {
                    const isMe = msg.sender_username === currentUser.username;
                    const canDelete = isMe || isAdmin;

                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/message`}>
                            <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && <span className="text-xs text-gray-500 mb-1 ml-1 font-medium">{msg.sender_name}</span>}
                                
                                <div className={`p-3 rounded-2xl shadow-sm relative group ${
                                    isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                                }`}>
                                    {canDelete && (
                                        <button 
                                            onClick={() => handleRecallMessage(msg.id)}
                                            className={`absolute -top-2 ${isMe ? '-left-2' : '-right-2'} p-1 bg-white rounded-full shadow-md text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-gray-200`}
                                            title="Thu hồi tin nhắn"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}

                                    {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}

                                    {msg.file_url && (
                                        <div className={`mt-2 p-2 rounded-lg flex items-center gap-3 ${isMe ? 'bg-blue-700' : 'bg-gray-100'}`}>
                                            {msg.file_type === 'image' ? (
                                                <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block relative">
                                                    <img src={msg.file_url} alt="attachment" className="max-w-[200px] max-h-[200px] rounded object-cover border border-gray-300" />
                                                </a>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-white rounded-full shadow-sm text-blue-600">
                                                        <FileIcon size={20} />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className={`text-xs font-medium truncate max-w-[150px] ${isMe ? 'text-blue-100' : 'text-gray-700'}`}>{msg.file_name}</p>
                                                        <a 
                                                            href={msg.file_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className={`text-[10px] hover:underline flex items-center gap-1 ${isMe ? 'text-white' : 'text-blue-600'}`}
                                                        >
                                                            <Download size={10} /> Tải xuống
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    <span className={`text-[10px] absolute bottom-1 ${isMe ? 'left-[-40px] text-gray-400' : 'right-[-40px] text-gray-400'} opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>
                                        {formatTime(msg.created_at)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Hash size={48} className="mb-2 text-gray-300" />
                        <p>Chưa có tin nhắn nào trong nhóm này.</p>
                    </div>
                )
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
            {file && (
                <div className="flex items-center gap-2 mb-2 bg-blue-50 p-2 rounded-lg border border-blue-100 w-fit">
                    {file.type.startsWith('image/') ? <ImageIcon size={16} className="text-blue-600"/> : <FileIcon size={16} className="text-blue-600"/>}
                    <span className="text-sm text-gray-700 truncate max-w-[200px]">{file.name}</span>
                    <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
                </div>
            )}

            <form onSubmit={handleSend} className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <Paperclip size={20} />
                </button>
                <button 
                    type="button" 
                    onClick={handleScreenshot}
                    className="p-3 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors hidden sm:block"
                    title="Chụp màn hình"
                >
                    <Monitor size={20} />
                </button>
                
                <div className="flex-1 relative">
                    <textarea
                        rows={1}
                        className="w-full border border-gray-300 rounded-2xl px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 outline-none resize-none max-h-32 shadow-sm text-sm"
                        placeholder={`Nhắn tin vào ${currentGroupId === 'GENERAL' ? 'kênh chung' : 'nhóm'}... (Dán ảnh Ctrl+V)`}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={(!newMessage.trim() && !file) || sending}
                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-transform active:scale-95 flex items-center justify-center"
                >
                    {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                </button>
            </form>
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      {isAddMemberModalOpen && targetGroupForAdd && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in-up flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center p-4 border-b">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <Shield size={16} className="text-blue-600"/> Quản lý thành viên
                      </h3>
                      <button onClick={() => setIsAddMemberModalOpen(false)} className="text-gray-400 hover:text-red-500">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-4 border-b bg-gray-50 text-sm">
                      Đang chỉnh sửa: <strong>{targetGroupForAdd.name}</strong>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {users.map(u => {
                          const isMember = targetGroupForAdd.members?.includes(u.username);
                          return (
                              <div key={u.username} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                                  <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${isMember ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      <div>
                                          <div className="text-sm font-medium">{u.name}</div>
                                          <div className="text-xs text-gray-500">@{u.username}</div>
                                      </div>
                                  </div>
                                  {isMember ? (
                                      <button 
                                        onClick={() => handleRemoveMember(u.username)}
                                        className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                                      >
                                          Xóa
                                      </button>
                                  ) : (
                                      <button 
                                        onClick={() => handleAddMember(u.username)}
                                        className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                                      >
                                          Thêm
                                      </button>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default InternalChat;
