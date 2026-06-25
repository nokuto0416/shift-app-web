"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      // Sign in
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      // On success, redirect to dashboard
      window.location.href = "/dashboard";
    } catch (error) {
      const err = error as Error;
      setMessage({ type: "error", text: err.message || "ログインに失敗しました" });
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="container flex flex-col items-center justify-center min-h-[80vh] py-12">
      <div className="card max-w-md w-full flex flex-col gap-6">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-4">
            <div style={{ backgroundColor: "var(--primary-light)", padding: "1rem", borderRadius: "50%" }}>
              <LogIn size={32} color="var(--primary)" />
            </div>
          </div>
          <h1 className="text-2xl mb-2">ログイン</h1>
          <p className="text-muted text-sm">
            シフト管理アプリを利用するにはログインしてください
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleLogin}>
          {message.text && (
            <div className={`p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
              {message.text}
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-bold">メールアドレス</label>
            <input 
              id="email" 
              type="email" 
              className="input-field" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-bold">パスワード</label>
            <input 
              id="password" 
              type="password" 
              className="input-field" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
            {loading ? "処理中..." : "ログイン"}
          </button>
        </form>

        <div className="text-center text-sm mt-4 border-t border-gray-200 pt-4">
          <p className="text-muted mb-2">アカウントをお持ちでないですか？</p>
          <a href="/register" className="btn btn-secondary w-full block text-center">
            新しくアカウントを作成
          </a>
        </div>
      </div>
    </main>
  );
}
