"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Building, CheckCircle, Clock, Users } from "lucide-react";
import Link from "next/link";
import { PushSubscriptionManager } from "@/components/PushSubscriptionManager";

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [memberships, setMemberships] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      // Fetch user's memberships
      const { data: myMemberships, error: memberError } = await supabase
        .from('workspace_members')
        .select(`
          role,
          status,
          workspaces ( id, name )
        `)
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      setMemberships(myMemberships || []);

      // If user is a manager in any workspace, fetch pending join requests for those workspaces
      const managerWorkspaces = myMemberships
        ?.filter(m => m.role === 'manager' && m.status === 'approved')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => m.workspaces?.id || (Array.isArray(m.workspaces) ? m.workspaces[0]?.id : undefined));

      if (managerWorkspaces && managerWorkspaces.length > 0) {
        const { data: pending, error: pendingError } = await supabase
          .from('workspace_members')
          .select(`
            id,
            user_id,
            status,
            profiles ( full_name ),
            workspaces ( name )
          `)
          .in('workspace_id', managerWorkspaces)
          .eq('status', 'pending');
        
        if (pendingError) throw pendingError;
        setPendingRequests(pending || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      const err = error as Error;
      setFetchError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ status: 'approved' })
        .eq('id', memberId);
      
      if (error) throw error;
      alert("承認しました！");
      fetchDashboardData(); // Reload data
    } catch (error) {
      const err = error as Error;
      alert(err.message || "エラーが発生しました");
      console.error(error);
    }
  };

  if (loading) {
    return <div className="container py-12 text-center text-muted">読み込み中...</div>;
  }

  if (fetchError) {
    return (
      <div className="container py-12 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-left inline-block">
          <h2 className="font-bold mb-2">データの取得に失敗しました</h2>
          <pre className="text-xs overflow-auto max-w-full">{fetchError}</pre>
        </div>
      </div>
    );
  }

  const approvedMemberships = memberships.filter(m => m.status === 'approved');
  const pendingMemberships = memberships.filter(m => m.status === 'pending');

  return (
    <main className="container py-8 flex flex-col gap-8">
      <h1 className="text-2xl font-bold border-b pb-4">ダッシュボード</h1>
      
      <PushSubscriptionManager />

      {/* 所属している企業/サーバー */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl flex items-center gap-2">
          <Building size={24} className="text-primary" />
          あなたの所属サーバー
        </h2>
        
        {approvedMemberships.length === 0 ? (
          <div className="card text-center py-8 text-muted bg-gray-50 border-dashed">
            まだ参加しているサーバーがありません。<br/>
            <div className="flex justify-center gap-4 mt-4">
              <Link href="/join" className="btn btn-secondary text-sm">サーバーに参加</Link>
              <Link href="/create-workspace" className="btn btn-primary text-sm">新しく作成</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvedMemberships.map((m, idx) => (
              <div key={idx} className="card flex justify-between items-center border-l-4 border-l-primary">
                <div>
                  <h3 className="font-bold text-lg">{m.workspaces.name}</h3>
                  <span className="text-sm text-muted">
                    権限: {m.role === 'manager' ? '管理者' : '従業員'}
                  </span>
                </div>
                <Link href={`/workspace/${m.workspaces.id}`} className="btn btn-primary text-sm">
                  開く
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* 申請中のサーバー */}
        {pendingMemberships.length > 0 && (
          <div className="mt-4">
            <h3 className="text-md font-bold mb-2 flex items-center gap-1 text-warning">
              <Clock size={16} /> 承認待ちのサーバー
            </h3>
            <div className="flex flex-col gap-2">
              {pendingMemberships.map((m, idx) => (
                <div key={idx} className="bg-orange-50 border border-orange-200 p-3 rounded-md text-sm flex justify-between items-center">
                  <span>{m.workspaces.name}</span>
                  <span className="text-orange-600 font-bold">承認待ち</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 管理者向け：参加承認待ちリスト */}
      {pendingRequests.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl flex items-center gap-2">
            <Users size={24} className="text-primary" />
            従業員の参加申請（承認待ち）
          </h2>
          <div className="flex flex-col gap-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="card flex justify-between items-center bg-blue-50">
                <div>
                  <div className="font-bold">{req.profiles?.full_name || '名前未設定のユーザー'}</div>
                  <div className="text-sm text-muted">対象サーバー: {req.workspaces?.name}</div>
                </div>
                <button 
                  className="btn bg-success text-white hover:opacity-90"
                  onClick={() => handleApprove(req.id)}
                >
                  <CheckCircle size={16} /> 承認する
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
