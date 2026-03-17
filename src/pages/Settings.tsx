import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, LogOut, User } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

export default function Settings() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

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

            <div className="pt-6 border-t border-stone-300/60">
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
