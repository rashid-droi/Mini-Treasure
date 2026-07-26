"use client";
import toast from "react-hot-toast";

export default function SettingsAdminPage() {
  const handleSave = () => {
    toast.success("Settings saved to platform.");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Platform Settings</h1>
          <p className="text-zinc-500 mt-2 text-sm">Configure global application variables and permissions.</p>
        </div>
        <button onClick={handleSave} className="bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
          Save Changes
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden p-6 shadow-sm">
        <div className="max-w-2xl space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-600">Default Game Duration (Minutes)</label>
            <input
              type="number"
              defaultValue={60}
              className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-600">Max Teams per Event</label>
            <input
              type="number"
              defaultValue={50}
              className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
