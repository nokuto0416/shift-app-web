import { CalendarDays } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="container flex flex-col items-center justify-center min-h-screen py-12">
      <div className="card text-center max-w-md w-full flex flex-col gap-6">
        <div className="flex justify-center mb-4">
          <div style={{ backgroundColor: "var(--primary-light)", padding: "1rem", borderRadius: "50%" }}>
            <CalendarDays size={48} color="var(--primary)" />
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl mb-2">シフト管理アプリへようこそ</h1>
          <p className="text-muted">
            シンプルでなじみやすいシフト提出・管理システム
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <Link href="/login" className="btn btn-primary">
            ログインしてはじめる
          </Link>
          
          <div className="flex flex-col items-center justify-center gap-2 mt-2 text-sm text-muted text-center border-t border-gray-200 pt-4">
            <p>アカウントをお持ちでない場合は、まずは新規作成をお願いします。</p>
            <Link href="/register" className="btn btn-secondary w-full mt-2">
              新しくアカウントを作成する
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
