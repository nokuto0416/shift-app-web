"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      if (!fullName) throw new Error("お名前を入力してください");
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      
      if (data.user) {
        // Insert profile
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName
        });
      }
      
      // If email confirmation is disabled, user is automatically logged in
      if (data.session) {
        window.location.href = "/dashboard";
      } else {
        setMessage({ type: "success", text: "登録完了！確認メールを送信しました（設定によっては自動ログインされます）。" });
      }
    } catch (error) {
      const err = error as Error;
      setMessage({ type: "error", text: err.message || "エラーが発生しました" });
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
              <UserPlus size={32} color="var(--primary)" />
            </div>
          </div>
          <h1 className="text-2xl mb-2">アカウント作成</h1>
          <p className="text-muted text-sm">
            新しくシフト管理アプリを利用するための登録を行います
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleRegister}>
          {message.text && (
            <div className={`p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
              {message.text}
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <label htmlFor="fullName" className="text-sm font-bold">お名前（フルネーム）</label>
            <input 
              id="fullName" 
              type="text" 
              className="input-field" 
              placeholder="例: 山田 太郎" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

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
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
            {loading ? "処理中..." : "アカウントを作成する"}
          </button>
        </form>

        <div className="text-center text-sm mt-4 border-t border-gray-200 pt-4">
          <p className="text-muted mb-2">すでにアカウントをお持ちですか？</p>
          <Link href="/login" className="btn btn-secondary w-full">
            ログイン画面へ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
