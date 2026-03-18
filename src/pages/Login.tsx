import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('注册成功！没有开启邮件验证的话可以直接登录。');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      }
    } catch (err: any) {
      alert(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center font-serif" style={{ backgroundImage: 'radial-gradient(#d6d3cd 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
      <div className="bg-[#ece9e4] p-6 sm:p-10 mx-4 sm:mx-0 rounded-sm shadow-[4px_6px_15px_rgba(0,0,0,0.1),_inset_0_0_20px_rgba(0,0,0,0.02)] max-w-sm w-full border border-stone-300">
        <div className="flex flex-col items-center mb-8 pb-6 border-b border-stone-300/60">
          <BookOpen size={40} className="text-[#4A3C31] mb-4" />
          <h1 className="text-3xl font-bold text-stone-800 italic">Library.</h1>
          <p className="text-stone-500 text-sm mt-1">云端书籍同步与划词阅读</p>
        </div>
        
        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-stone-600 font-bold mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-white/50 border border-stone-300 rounded-sm outline-none focus:border-[#4A3C31] focus:ring-1 focus:ring-[#4A3C31] transition-all"
              required 
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 font-bold mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-white/50 border border-stone-300 rounded-sm outline-none focus:border-[#4A3C31] focus:ring-1 focus:ring-[#4A3C31] transition-all"
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full py-2.5 bg-[#4A3C31] text-stone-100 font-medium rounded-sm shadow-sm hover:bg-[#3D3027] active:translate-y-[1px] transition-all border border-[#2E241D] disabled:opacity-50"
          >
            {loading ? '处理中...' : isSignUp ? '创建账号' : '进入书架'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-stone-500">
          {isSignUp ? '已有账号？' : '首次使用？'}
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-1 text-[#8b2323] hover:underline font-medium"
          >
            {isSignUp ? '立即登录' : '注册体验账号'}
          </button>
        </div>
      </div>
    </div>
  );
}
