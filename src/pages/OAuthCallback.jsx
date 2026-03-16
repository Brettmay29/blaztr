import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMessage("Google authorization was cancelled or failed.");
      setTimeout(() => navigate("/GmailAccounts"), 3000);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received.");
      setTimeout(() => navigate("/GmailAccounts"), 3000);
      return;
    }

    const exchange = async () => {
      try {
        const res = await base44.functions.invoke("googleOAuthCallback", { code });
        if (res.data?.success) {
          setStatus("success");
          setMessage(`${res.data.email} connected successfully!`);
          setTimeout(() => navigate("/GmailAccounts"), 2000);
        } else {
          setStatus("error");
          setMessage(res.data?.error || "Something went wrong.");
          setTimeout(() => navigate("/GmailAccounts"), 3000);
        }
      } catch (err) {
        setStatus("error");
        setMessage("Connection failed. Please try again.");
        setTimeout(() => navigate("/GmailAccounts"), 3000);
      }
    };

    exchange();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-neutral-500 mx-auto" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Connecting your Gmail account...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{message}</p>
            <p className="text-xs text-neutral-400">Redirecting you back...</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{message}</p>
            <p className="text-xs text-neutral-400">Redirecting you back...</p>
          </>
        )}
      </div>
    </div>
  );
}