"use client";

import { useState } from "react";
import { createSceneFromUpload, deleteScene } from "@/actions/admin/scenes";
import { Plus, Image as ImageIcon, Trash2, Edit2, Loader2, Target } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ScenesClient({ scenes }: { scenes: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    clickTolerance: 5
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error("Please choose an image file.");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("clickTolerance", String(formData.clickTolerance));
    fd.append("image", imageFile);
    const res = await createSceneFromUpload(fd);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Scene uploaded and tiled!");
      setIsModalOpen(false);
      setFormData({ name: "", clickTolerance: 5 });
      setImageFile(null);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete all clues linked to this scene!")) return;
    const res = await deleteScene(id);
    if (res.error) toast.error(res.error);
    else toast.success("Scene deleted!");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Scenes & Map Configurations</h1>
          <p className="text-zinc-500 mt-2 text-sm">Upload scene images and define interactive clues for your events.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Upload New Scene
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {scenes.map(scene => (
          <div key={scene.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-[#f5c518] transition-colors group flex flex-col shadow-sm">
            <Link
              href={`/admin/scenes/${scene.id}`}
              className="bg-zinc-100 flex items-center justify-center border-b border-zinc-200 relative overflow-hidden block"
              style={{ aspectRatio: `${scene.crop?.fx ?? 16} / ${scene.crop?.fy ?? 9}` }}
            >
              {scene.imageUrl ? (
                <div
                  className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    backgroundImage: `url(${scene.imageUrl})`,
                    backgroundSize: `${100 / (scene.crop?.fx ?? 1)}% ${100 / (scene.crop?.fy ?? 1)}%`,
                    backgroundPosition: "top left",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-zinc-300" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10" />
              <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                <span className="px-2 py-1 bg-white/90 text-zinc-800 rounded-md text-xs font-medium border border-zinc-200">
                  {scene._count.clues} Clues Configured
                </span>
              </div>
            </Link>

            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-zinc-900 mb-1">{scene.name}</h3>
                <p className="text-sm text-zinc-500 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {scene.clickTolerance}px click tolerance
                </p>
                <p className="text-xs text-zinc-400 mt-2">Attached to {scene._count.events} Event(s)</p>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-200">
                <Link href={`/admin/scenes/${scene.id}`} className="flex-1 flex justify-center items-center gap-2 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-medium rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                  Visual Editor
                </Link>
                <button
                  onClick={() => handleDelete(scene.id)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {scenes.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-zinc-300 rounded-2xl">
            <p className="text-zinc-400">No scenes uploaded yet.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-200 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">Upload New Scene</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Scene Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                  placeholder="e.g. Haunted Mansion"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Scene Photo</label>
                <input
                  required
                  type="file"
                  accept="image/*"
                  onChange={e => setImageFile(e.target.files?.[0] ?? null)}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518] file:mr-3 file:px-3 file:py-1 file:rounded-md file:border-0 file:bg-[#f5c518] file:text-zinc-900 file:text-sm file:font-medium file:cursor-pointer"
                />
                <p className="text-xs text-zinc-400 mt-1">The photo is tiled automatically for deep zoom (max 20MB).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Click Tolerance (px)</label>
                <input
                  required
                  type="number"
                  value={formData.clickTolerance}
                  onChange={e => setFormData({ ...formData, clickTolerance: parseInt(e.target.value) })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 rounded-lg transition-colors flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Scene
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
