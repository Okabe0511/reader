import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, LogOut, User, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

export default function Settings() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  
  // Password change states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  const handleLogout = async () => {
    if (window.confirm('确定要退出登录吗？')) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('退出失败:', error);
      } finally {
        // 使用 window.location 强制刷新并跳转，避免 React 路由状态更新的延迟导致的反复横跳
        window.location.href = '/login';
      }
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('密码长度不能少于6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setPasswordError(error.message || '修改密码失败，请重试');
    } else {
      setPasswordSuccess('密码修改成功');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess('');
      }, 2000);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 font-serif" style={{ backgroundImage: 'radial-gradient(#d6d3cd 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex items-center mb-12 border-b-[3px] border-stone-300 pb-6 relative">
          <div className="absolute w-full h-[1px] bg-stone-300 bottom-1 left-0"></div>
          <button 
            onClick={() => navigate('/')}
            className="mr-6 p-2 rounded-full hover:bg-stone-200 transition-colors text-stone-600"
            title="返回书架"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 drop-shadow-sm font-serif italic">
              偏好设置
            </h1>
            <p className="text-stone-500 text-sm mt-1">云端数据与账号管理</p>
          </div>
        </header>

        {/* Content */}
        <div className="bg-[#ece9e4] p-8 rounded-sm shadow-[4px_6px_15px_rgba(0,0,0,0.08),_inset_0_0_20px_rgba(0,0,0,0.02)] border border-stone-300 mb-8">
          <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2 border-b border-stone-300/60 pb-3">
            <User size={20} className="text-[#4A3C31]" />
            账号信息
          </h2>
          
          <div className="flex flex-col gap-6">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-stone-500 mb-1 tracking-wider uppercase">Email</span>
              <span className="text-lg text-stone-800">{session?.user?.email || '加载中...'}</span>
            </div>

            <div className="pt-2 border-t border-stone-300/60 mt-2">
              {!isChangingPassword ? (
                <button 
                  onClick={() => setIsChangingPassword(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-stone-200 text-stone-800 text-sm font-bold rounded-sm hover:bg-stone-300 transition-all border border-stone-300/80 mb-4"
                >
                  <Lock size={16} />
                  <span className="tracking-wider">修改密码</span>
                </button>
              ) : (
                <form onSubmit={handlePasswordChange} className="bg-white/50 p-5 rounded-sm border border-stone-300/80 mb-4 space-y-4">
                  <h3 className="font-bold text-stone-800 mb-2 flex items-center gap-2">
                    <Lock size={16} className="text-stone-500" />
                    设置新密码
                  </h3>
                  
                  {passwordError && (
                    <div className="bg-rose-100 text-rose-800 p-3 rounded text-sm flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="bg-emerald-100 text-emerald-800 p-3 rounded text-sm flex items-start gap-2">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-bold text-stone-600 mb-1">新密码</label>
                      <input 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#8b2323]/50 focus:border-[#8b2323]"
                        placeholder="至少6个字符"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-600 mb-1">确认新密码</label>
                      <input 
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#8b2323]/50 focus:border-[#8b2323]"
                        placeholder="重新输入密码"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-[#4A3C31] text-stone-100 py-2 rounded font-bold hover:bg-[#3D3027] transition-colors disabled:opacity-70 flex justify-center items-center"
                    >
                      {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '确认修改'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordError('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      disabled={isSubmitting}
                      className="flex-1 bg-stone-200 text-stone-700 py-2 rounded font-bold hover:bg-stone-300 transition-colors disabled:opacity-70"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}

              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-800/10 text-rose-800 text-sm font-bold rounded-sm hover:bg-rose-800 hover:text-stone-100 transition-all border border-rose-800/30"
              >
                <LogOut size={16} />
                <span className="tracking-wider">退出登录</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
