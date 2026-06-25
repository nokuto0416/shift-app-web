"use client";

import { useEffect, useState } from "react";
import { User, LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

import { Session } from "@supabase/supabase-js";

export function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    window.location.href = "/login";
  };
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Link href="/" className="font-bold text-lg text-primary">
          ShiftApp
        </Link>
      </div>
      <div className="flex items-center gap-4 relative">
        {session ? (
          <>
            <button 
              className="text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <User size={24} />
            </button>
            
            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute top-10 right-0 bg-white border border-gray-200 shadow-lg rounded-md p-2 w-48 flex flex-col gap-1 z-50">
                <div className="px-3 py-2 text-xs text-muted border-b mb-1 truncate">
                  {session.user.email}
                </div>
                <Link 
                  href="/dashboard" 
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-md text-sm"
                  onClick={() => setMenuOpen(false)}
                >
                  <LayoutDashboard size={16} />
                  ダッシュボード
                </Link>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 rounded-md text-sm text-left w-full"
                >
                  <LogOut size={16} />
                  ログアウト
                </button>
              </div>
            )}
          </>
        ) : (
          <Link href="/login" className="text-sm font-bold text-primary">
            ログイン
          </Link>
        )}
      </div>
    </header>
  );
}
