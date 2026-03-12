"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Camera } from "lucide-react"
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
} from "@/components/ui/file-upload"
import { apiRepository } from "@/lib/api"

interface AvatarUploadModalProps {
  currentAvatar: string | null
  onClose: () => void
  onSaved: (avatar: string | null) => void
}

export function AvatarUploadModal({ currentAvatar, onClose, onSaved }: AvatarUploadModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<string | null>(currentAvatar)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleValueChange(newFiles: File[]) {
    setFiles(newFiles)
    setError(null)
    if (newFiles.length > 0) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(newFiles[0])
    } else {
      setPreview(currentAvatar)
    }
  }

  async function handleSave() {
    if (files.length === 0) return
    setSaving(true)
    setError(null)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      const res = await apiRepository.uploadAvatar(base64)
      setSaving(false)
      if (res.success) {
        onSaved(base64)
        onClose()
      } else {
        setError(res.message ?? "Erro ao salvar foto")
      }
    }
    reader.readAsDataURL(files[0])
  }

  async function handleRemove() {
    setSaving(true)
    setError(null)
    const res = await apiRepository.uploadAvatar(null)
    setSaving(false)
    if (res.success) {
      onSaved(null)
      onClose()
    } else {
      setError(res.message ?? "Erro ao remover foto")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card ring-1 ring-foreground/10 rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Foto de perfil</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Preview circle */}
          <div className="flex justify-center">
            <div className="size-24 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center ring-2 ring-border">
              {preview
                ? <img src={preview} alt="Prévia" className="w-full h-full object-cover" />
                : <Camera className="size-8 text-primary/40" />
              }
            </div>
          </div>

          {/* FileUpload */}
          <FileUpload
            accept="image/*"
            maxFiles={1}
            maxSize={5 * 1024 * 1024}
            onValueChange={handleValueChange}
          >
            <FileUploadDropzone className="border border-dashed rounded-lg p-4 flex flex-col items-center gap-2 text-center hover:bg-muted/50 transition-colors cursor-pointer">
              <Camera className="size-5 text-muted-foreground opacity-60" />
              <p className="text-sm text-muted-foreground">Arraste uma imagem aqui ou</p>
              <FileUploadTrigger asChild>
                <Button size="sm" variant="outline" className="cursor-pointer">
                  Selecionar arquivo
                </Button>
              </FileUploadTrigger>
              <p className="text-xs text-muted-foreground opacity-60">PNG, JPG — máx. 5MB</p>
            </FileUploadDropzone>
            <FileUploadList className="mt-2 space-y-1">
              {files.map((file) => (
                <FileUploadItem key={file.name} value={file}>
                  <FileUploadItemPreview className="size-8 rounded" />
                  <FileUploadItemMetadata className="flex-1 min-w-0 text-sm" />
                  <FileUploadItemDelete asChild>
                    <Button size="icon-sm" variant="ghost" className="cursor-pointer">
                      <X className="size-3" />
                    </Button>
                  </FileUploadItemDelete>
                </FileUploadItem>
              ))}
            </FileUploadList>
          </FileUpload>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 pb-4">
          {currentAvatar && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              onClick={handleRemove}
              disabled={saving}
            >
              Remover foto
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="cursor-pointer">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || files.length === 0} className="cursor-pointer">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
