"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Bell, BellRing } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function PushSubscriptionManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking push subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPush = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ユーザーがログインしていません");

      const endpoint = subscription.endpoint;
      const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'));
      const auth = arrayBufferToBase64(subscription.getKey('auth'));

      // Save to Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth
      }, { onConflict: 'user_id, endpoint' });

      if (error) throw error;

      setIsSubscribed(true);
      alert("Push通知を有効にしました！");
    } catch (error) {
      console.error("Error subscribing to push:", error);
      alert("通知の有効化に失敗しました。ブラウザの設定で通知が許可されているか確認してください。");
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) return null;

  if (loading) {
    return <div className="text-sm text-gray-500 animate-pulse bg-gray-50 border p-4 rounded-lg">通知設定を確認中...</div>;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        {isSubscribed ? <BellRing className="text-blue-500" /> : <Bell className="text-gray-500" />}
        <div>
          <h3 className="font-bold text-gray-800 text-sm sm:text-base">シフトに関する通知</h3>
          <p className="text-xs sm:text-sm text-gray-600">
            {isSubscribed ? "通知は有効になっています" : "シフト提出の催促や確定の通知を受け取れます"}
          </p>
        </div>
      </div>
      {!isSubscribed && (
        <button 
          onClick={subscribeToPush}
          className="btn btn-primary text-sm px-3 py-1.5 whitespace-nowrap"
        >
          通知を許可
        </button>
      )}
    </div>
  );
}
