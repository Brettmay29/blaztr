import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, Settings, ArrowLeft, Camera, Loader2, Sun, Moon, Bell, Shield, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const navItems = [
  { key: "profile", label: "Profile", icon: User },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function Account() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [activeTab, setActiveTab] = useState(params.get("tab") || "profile");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex flex-col h-screen sticky top-0">
        <div className="h-14 flex items-center px-5 border-b border-neutral-100 dark:border-neutral-700">
          <Link to="/Dashboard" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-[13px]">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Account</p>
        </div>
        <nav className="px-3 space-y-0.5">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                activeTab === key
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8 max-w-2xl">
        {activeTab === "profile" ? <ProfileTab /> : <SettingsTab />}
      </div>
    </div>
  );
}

function ProfileTab() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setFullName(u.full_name || "");
      setPhotoUrl(u.profile_photo || null);
    });
  }, []);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({
      full_name: fullName.trim(),
      ...(photoUrl ? { profile_photo: photoUrl } : {}),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">Profile</h1>
      <p className="text-sm text-neutral-500 mb-8">Manage your personal information.</p>

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-8">
        <label htmlFor="photo-upload" className="cursor-pointer group">
          <div className="w-20 h-20 rounded-full bg-neutral-100 border-2 border-dashed border-neutral-300 group-hover:border-neutral-400 flex items-center justify-center overflow-hidden relative transition-colors">
            {uploading ? (
              <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
            ) : photoUrl ? (
              <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-900 dark:bg-white flex items-center justify-center">
                <span className="text-2xl font-semibold text-white dark:text-neutral-900">
                  {fullName?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
            )}
          </div>
          <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>
        <div>
          <p className="text-sm font-medium text-neutral-800 dark:text-white">{fullName || "Your Name"}</p>
          <p className="text-xs text-neutral-400">{user?.email}</p>
          <label htmlFor="photo-upload" className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer mt-1 flex items-center gap-1">
            <Camera className="w-3 h-3" /> Change photo
          </label>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">Full Name</label>
          <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" className="max-w-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">Email</label>
          <Input value={user?.email || ""} disabled className="max-w-sm bg-neutral-50 text-neutral-400" />
          <p className="text-xs text-neutral-400 mt-1">Email cannot be changed.</p>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || !fullName.trim()}
        className="mt-6 bg-neutral-900 hover:bg-neutral-800 h-9"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? "Saved!" : "Save Changes"}
      </Button>
    </div>
  );
}

function SettingsTab() {
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [replyAlerts, setReplyAlerts] = useState(true);

  const toggleDarkMode = (val) => {
    setDarkMode(val);
    if (val) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">Settings</h1>
      <p className="text-sm text-neutral-500 mb-8">Manage your preferences.</p>

      <div className="space-y-6">
        {/* Appearance */}
        <section>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Appearance</p>
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl divide-y divide-neutral-100 dark:divide-neutral-700">
            <SettingRow
              icon={darkMode ? Moon : Sun}
              label="Dark Mode"
              description="Switch between light and dark theme"
              control={<Switch checked={darkMode} onCheckedChange={toggleDarkMode} />}
            />
          </div>
        </section>

        {/* Notifications */}
        <section>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Notifications</p>
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl divide-y divide-neutral-100 dark:divide-neutral-700">
            <SettingRow
              icon={Bell}
              label="Email Notifications"
              description="Receive daily send summaries via email"
              control={<Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />}
            />
            <SettingRow
              icon={Bell}
              label="Reply Alerts"
              description="Get notified when a lead replies"
              control={<Switch checked={replyAlerts} onCheckedChange={setReplyAlerts} />}
            />
          </div>
        </section>

        {/* Security */}
        <section>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Security</p>
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl divide-y divide-neutral-100 dark:divide-neutral-700">
            <SettingRow
              icon={Shield}
              label="Two-Factor Authentication"
              description="Add an extra layer of security to your account"
              control={<span className="text-xs text-neutral-400">Coming soon</span>}
            />
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-3">Danger Zone</p>
          <div className="bg-white dark:bg-neutral-800 border border-red-100 dark:border-red-900/30 rounded-xl">
            <SettingRow
              icon={Trash2}
              label="Delete Account"
              description="Permanently delete your account and all data"
              control={<Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7">Delete</Button>}
              iconClass="text-red-400"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, control, iconClass }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Icon className={cn("w-4 h-4 text-neutral-400", iconClass)} />
        <div>
          <p className="text-[13px] font-medium text-neutral-800 dark:text-white">{label}</p>
          <p className="text-[11px] text-neutral-400">{description}</p>
        </div>
      </div>
      {control}
    </div>
  );
}