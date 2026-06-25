"use client";

import { useState, useEffect } from "react";
import { Building, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function CreateWorkspacePage() {
  const [name, setName] = useState("");
  const [passkey, setPasskey] = useState("");
  const [shiftEntryMode, setShiftEntryMode] = useState("free");
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      // 1. Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("ログインしてください");

      // 2. Create Workspace and assign manager via Secure RPC
      const { data: workspaceId, error: rpcError } = await supabase.rpc('create_workspace_secure', {
        p_name: name,
        p_passkey: passkey,
        p_shift_entry_mode: shiftEntryMode
      });
      
      if (rpcError) throw rpcError;

      setMessage({ type: "success", text: `「${name}」を作成しました。サーバー番号: ${workspaceId}` });
      // In a real app, redirect to dashboard here
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
              <Settings size={32} color="var(--primary)" />
            </div>
          </div>
          <h1 className="text-2xl mb-2">新しい企業サーバーを作成</h1>
          <p className="text-muted text-sm">
            管理する企業・店舗・チーム専用サーバーを作成します
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          {message.text && (
            <div className={`p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
              {message.text}
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-bold flex items-center gap-1">
              <Building size={16} />
              企業・店舗名
            </label>
            <input 
              id="name" 
              type="text" 
              className="input-field" 
              placeholder="例: 株式会社◯◯ 新宿店" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label htmlFor="passkey" className="text-sm font-bold">従業員用の参加パスキー設定</label>
            <input 
              id="passkey" 
              type="text" 
              className="input-field" 
              placeholder="従業員に教える合言葉" 
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="shiftMode" className="text-sm font-bold">シフト提出方式の設定</label>
            <select 
              id="shiftMode" 
              className="input-field bg-white" 
              value={shiftEntryMode}
              onChange={(e) => setShiftEntryMode(e.target.value)}
            >
              <option value="free">自由入力方式（10:00 〜 18:00 など）</option>
              <option value="slots">パターン選択方式（Aシフト、Bシフト など）</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
            {loading ? "作成中..." : "サーバーを作成する"}
          </button>
        </form>
      </div>
    </main>
  );
}
