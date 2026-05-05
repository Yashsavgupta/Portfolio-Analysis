"use client";

import { useState } from "react";
import { Button } from "../ui/Button";

export default function ZerodhaConnectButton() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zerodha/connect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        alert(data.detail || data.error || "Failed to get login URL");
      }
    } catch (e) {
      alert("Failed to connect to Zerodha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading} className="w-full">
      {loading ? "Connecting..." : "Connect Zerodha"}
    </Button>
  );
}
