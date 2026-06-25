"use client";

import { useState, useEffect } from "react";
import { Building, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function JoinServerPage() {
  const [serverId, setServerId] = useState("");
  const [passkey, setPasskey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      }
    };
    checkAuth();
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      // 1. Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("ログインしてください");

      // 2. Check and Join via Secure RPC
      const { data: success, error: rpcError } = await supabase.rpc('join_workspace_secure', {
        p_workspace_id: serverId,
        p_passkey: passkey
      });
      
      if (rpcError) {
        if (rpcError.code === '23505') {
          throw new Error("既にこのサーバーに参加（または申請）しています");
        }
        throw rpcError;
      }

      if (!success) {
        throw new Error("サーバー番号またはパスキーが間違っています");
      }

      setMessage({ type: "success", text: "参加申請が完了しました！管理者の承認をお待ちください。" });
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
              <Building size={32} color="var(--primary)" />
            </div>
          </div>
          <h1 className="text-2xl mb-2">サーバーに参加</h1>
          <p className="text-muted text-sm">
            管理者から共有されたサーバー番号とパスキーを入力してください
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleJoin}>
          {message.text && (
            <div className={`p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
              {message.text}
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <label htmlFor="serverId" className="text-sm font-bold flex items-center gap-1">
              <Building size={16} />
              サーバー番号
            </label>
            <input 
              id="serverId" 
              type="text" 
              className="input-field" 
              placeholder="例: CMP-123456 (UUIDを入力)" 
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              required
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label htmlFor="passkey" className="text-sm font-bold flex items-center gap-1">
              <KeyRound size={16} />
              パスキー
            </label>
            <input 
              id="passkey" 
              type="password" 
              className="input-field" 
              placeholder="••••••••" 
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              required
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm text-blue-800 mt-2 flex gap-2">
            💡 参加申請後、管理者の承認が完了するまでシフト機能は利用できません。
          </div>

          <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
            {loading ? "処理中..." : "参加を申請する"}
          </button>
        </form>
      </div>
    </main>
  );
}
