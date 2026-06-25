"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Settings as SettingsIcon, Save, ShieldAlert, ArrowLeft, Clock, Key, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Workspace, WorkspaceMember, ShiftPattern } from "@/types";

export default function WorkspaceSettingsPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [workspaceName, setWorkspaceName] = useState("");
  const [deadlineDay, setDeadlineDay] = useState(20);
  const [passkey, setPasskey] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("22:00");
  
  // Shift Patterns state
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([
    { name: "Aシフト", startTime: "09:00", endTime: "15:00" },
    { name: "Bシフト", startTime: "15:00", endTime: "22:00" }
  ]);


  useEffect(() => {
    let isMounted = true;
    
    const load = async () => {
      if (id) {
        try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            if (isMounted) router.push("/login");
            return;
          }

          // Check manager permission
          const { data: member, error: memberError } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', id)
            .eq('user_id', user.id)
            .eq('role', 'manager')
            .eq('status', 'approved')
            .single();
          
          if (memberError || !member) {
            alert("管理者権限がありません。");
            if (isMounted) router.push(`/workspace/${id}`);
            return;
          }

          // Fetch workspace
          const { data: ws } = await supabase.from('workspaces').select('*').eq('id', id).single();
          if (isMounted && ws) {
            setWorkspace(ws);
            setWorkspaceName(ws.name);
            setDeadlineDay(ws.submission_deadline_day || 20);
            setPasskey(ws.passkey || "");
            
            if (ws.open_time) setOpenTime(ws.open_time.substring(0,5));
            if (ws.close_time) setCloseTime(ws.close_time.substring(0,5));
            if (ws.shift_patterns && Array.isArray(ws.shift_patterns)) {
              setShiftPatterns(ws.shift_patterns);
            }
          }

          // Fetch all members (both approved and pending)
          const { data: mems } = await supabase
            .from('workspace_members')
            .select('*, profiles(full_name)')
            .eq('workspace_id', id)
            .order('created_at', { ascending: true });
          
          if (isMounted) {
            setMembers(mems || []);
          }
        } catch (error) {
          console.error(error);
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    };
    
    load();
    return () => { isMounted = false; };
  }, [id, router]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: workspaceName,
          submission_deadline_day: deadlineDay,
          passkey: passkey,
          open_time: `${openTime}:00`,
          close_time: `${closeTime}:00`,
          shift_patterns: shiftPatterns
        })
        .eq('id', id);

      if (error) throw error;
      alert("店舗設定を保存しました。");
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!confirm(`権限を「${newRole === 'manager' ? '管理者' : '一般'}」に変更してもよろしいですか？`)) return;
    
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (error) {
      console.error(error);
      alert("権限の変更に失敗しました。");
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`本当に「${memberName}」さんを退職（削除）させますか？この操作は取り消せません。`)) return;

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId);
      
      if (error) throw error;
      setMembers(members.filter(m => m.id !== memberId));
    } catch (error) {
      console.error(error);
      alert("削除に失敗しました。");
    }
  };

  const handleApproveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ status: 'approved' })
        .eq('id', memberId);

      if (error) throw error;
      setMembers(members.map(m => m.id === memberId ? { ...m, status: 'approved' } : m));
      alert("メンバーを承認しました！");
    } catch (error) {
      console.error(error);
      alert("承認に失敗しました。");
    }
  };

  const addShiftPattern = () => {
    setShiftPatterns([...shiftPatterns, { name: "新しいシフト", startTime: openTime, endTime: closeTime }]);
  };

  const updateShiftPattern = (index: number, field: string, value: string) => {
    const newPatterns = [...shiftPatterns];
    newPatterns[index][field] = value;
    setShiftPatterns(newPatterns);
  };

  const removeShiftPattern = (index: number) => {
    setShiftPatterns(shiftPatterns.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="container py-12 text-center text-muted">読み込み中...</div>;
  }

  return (
    <main className="container max-w-3xl mx-auto py-8 px-4 flex flex-col gap-6 mb-12">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Link href={`/workspace/${id}/admin`} className="btn btn-secondary p-2 rounded-full">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="text-primary" />
            店舗設定・権限管理
          </h1>
          <p className="text-sm text-muted mt-1">{workspace?.name}</p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
        
        {/* General Settings */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
            <SettingsIcon size={18} />
            基本設定
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-muted">店舗（ワークスペース）名</label>
              <input type="text" className="input-field" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-muted">毎月のシフト提出締め切り日</label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="31" className="input-field w-24" value={deadlineDay} onChange={(e) => setDeadlineDay(parseInt(e.target.value))} required />
                <span>日</span>
              </div>
              <p className="text-xs text-muted">※ 従業員画面に「毎月〇日が締め切りです」と表示されます。</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-muted flex items-center gap-1">
                <Key size={14} /> 店舗参加用パスキー
              </label>
              <input type="text" className="input-field" value={passkey} onChange={(e) => setPasskey(e.target.value)} required />
              <p className="text-xs text-muted">※ このパスキーを変更すると、以降の新規参加者は新しいパスキーが必要になります。</p>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
            <Clock size={18} />
            営業時間の設定
          </h2>
          <p className="text-sm text-muted mb-4">
            ここで設定した時間が、従業員がシフトを入力する際の「初期値」になります。
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-sm font-bold">開店時間（開始）</label>
              <input type="time" className="input-field" value={openTime} onChange={(e) => setOpenTime(e.target.value)} step="300" required />
            </div>
            <span className="mt-6">〜</span>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-sm font-bold">閉店時間（終了）</label>
              <input type="time" className="input-field" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} step="300" required />
            </div>
          </div>
        </div>

        {/* Shift Patterns */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
            <SettingsIcon size={18} />
            シフトパターンのカスタマイズ
          </h2>
          <p className="text-sm text-muted mb-4">
            「A番」「早番」など、店舗独自のシフトパターンを作成できます。ここで作成したパターンが提出画面の選択肢に表示されます。
          </p>
          
          <div className="flex flex-col gap-3 mb-4">
            {shiftPatterns.map((pattern, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-3 rounded-md border">
                <input 
                  type="text" 
                  className="input-field flex-1" 
                  value={pattern.name} 
                  onChange={(e) => updateShiftPattern(index, 'name', e.target.value)}
                  placeholder="パターン名（例：早番）"
                  required
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input type="time" className="input-field w-full sm:w-28" value={pattern.startTime} onChange={(e) => updateShiftPattern(index, 'startTime', e.target.value)} step="300" required />
                  <span>-</span>
                  <input type="time" className="input-field w-full sm:w-28" value={pattern.endTime} onChange={(e) => updateShiftPattern(index, 'endTime', e.target.value)} step="300" required />
                  <button type="button" onClick={() => removeShiftPattern(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <button type="button" onClick={addShiftPattern} className="btn btn-secondary flex items-center justify-center gap-1 w-full border-dashed">
            <Plus size={16} /> 新しいパターンを追加
          </button>
        </div>

        {/* Save Button (Sticky to bottom on mobile, static on desktop) */}
        <div className="sticky bottom-4 z-10 pt-4">
          <button type="submit" className="btn btn-primary w-full py-3 text-lg shadow-lg" disabled={saving}>
            <Save size={20} />
            {saving ? "保存中..." : "すべての設定を保存する"}
          </button>
        </div>
      </form>

      {/* Role Management */}
      <div className="card mt-4">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
          <ShieldAlert size={18} />
          権限・メンバー管理
        </h2>

        {/* Pending Members */}
        {members.filter(m => m.status === 'pending').length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-bold mb-2 text-warning flex items-center gap-2">
              <Clock size={16} />
              承認待ちのメンバー
            </h3>
            <div className="flex flex-col gap-2">
              {members.filter(m => m.status === 'pending').map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 border border-orange-200 rounded-md bg-orange-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center font-bold">
                      {member.profiles?.full_name?.substring(0, 1) || '?'}
                    </div>
                    <div>
                      <div className="font-bold">{member.profiles?.full_name}</div>
                      <div className="text-xs text-muted">申請日: {member.created_at.substring(0,10)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleApproveMember(member.id)}
                      className="btn btn-primary py-1 px-3 text-sm"
                    >
                      承認する
                    </button>
                    <button 
                      onClick={() => handleRemoveMember(member.id, member.profiles?.full_name)}
                      className="text-xs text-red-500 hover:text-red-700 underline p-2 whitespace-nowrap"
                    >
                      拒否
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-md font-bold mb-2">承認済みメンバー</h3>
        <p className="text-sm text-muted mb-4">
          「管理者」に設定された従業員は、店長と同じようにシフトカレンダーの編集や、この設定画面へのアクセスが可能になります。（※自動保存されます）
        </p>

        <div className="flex flex-col gap-2">
          {members.filter(m => m.status === 'approved').map(member => (
            <div key={member.id} className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-light text-primary rounded-full flex items-center justify-center font-bold">
                  {member.profiles?.full_name?.substring(0, 1) || '?'}
                </div>
                <div>
                  <div className="font-bold">{member.profiles?.full_name}</div>
                  <div className="text-xs text-muted">参加日: {member.created_at.substring(0,10)}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <select 
                  className={`input-field py-1 px-2 text-sm w-auto font-bold ${member.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white'}`}
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                >
                  <option value="employee">一般（従業員）</option>
                  <option value="manager">管理者（副店長）</option>
                </select>

                <button 
                  onClick={() => handleRemoveMember(member.id, member.profiles?.full_name)}
                  className="text-xs text-red-500 hover:text-red-700 underline p-2 whitespace-nowrap"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
