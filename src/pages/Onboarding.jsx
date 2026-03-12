import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2 } from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    await base44.auth.updateMe({
      full_name: fullName.trim(),
      ...(photoUrl ? { profile_photo: photoUrl } : {}),
    });
    navigate("/Home");
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm w-full max-w-md p-8">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <span className="text-xl font-semibold tracking-wide text-neutral-900">Blaztr</span>
          <p className="text-sm text-neutral-500 mt-1">Let's set up your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-3">
            <label htmlFor="photo-upload" className="cursor-pointer group">
              <div className="w-20 h-20 rounded-full bg-neutral-100 border-2 border-dashed border-neutral-300 group-hover:border-neutral-400 flex items-center justify-center overflow-hidden relative transition-colors">
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                ) : photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
                )}
              </div>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
            <span className="text-xs text-neutral-400">
              {photoUrl ? "Click to change photo" : "Upload a profile photo (optional)"}
            </span>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">Full Name</label>
            <Input
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-neutral-900 hover:bg-neutral-800 h-10"
            disabled={!fullName.trim() || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue →"}
          </Button>
        </form>
      </div>
    </div>
  );
}