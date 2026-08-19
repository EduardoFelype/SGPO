import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface OsPhotosSectionProps {
  /** ID da OS. Se não informado (OS nova ainda não criada), a seção permanece oculta */
  serviceOrderId?: number | null;
  onPhotosChange?: () => void;
}

export default function OsPhotosSection({ serviceOrderId, onPhotosChange }: OsPhotosSectionProps) {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const { data: photos, isLoading } = trpc.serviceOrders.photos.list.useQuery(
    { serviceOrderId: serviceOrderId ?? 0 },
    { enabled: Boolean(serviceOrderId), refetchInterval: 60_000 }
  );

  type OsPhoto = { id: number; url: string; fileKey: string; fileName: string | null; createdAt: Date };

  const deleteMutation = trpc.serviceOrders.photos.delete.useMutation({
    onSuccess: () => {
      if (serviceOrderId) utils.serviceOrders.photos.list.invalidate({ serviceOrderId });
      onPhotosChange?.();
      toast.success("Foto removida");
    },
    onError: (e) => toast.error(e.message),
  });

  const addMutation = trpc.serviceOrders.photos.add.useMutation({
    onError: (e) => toast.error(e.message),
  });

  function handleFiles(files: FileList | null) {
    if (!serviceOrderId || !files || files.length === 0) return;
    const fileArray = Array.from(files);
    const toUpload = fileArray.filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`"${f.name}" não é uma imagem e foi ignorado`);
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`"${f.name}" excede 5 MB e foi ignorado`);
        return false;
      }
      return true;
    });

    setUploading(true);
    let done = 0;
    toUpload.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = String(reader.result).replace(/^data:image\/\w+;base64,/, "");
          await addMutation.mutateAsync({
            serviceOrderId,
            base64,
            fileName: file.name,
            mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          });
        } catch (e) {
          toast.error(`Falha ao enviar "${file.name}": ${e instanceof Error ? e.message : "erro desconhecido"}`);
        } finally {
          done++;
          if (done === toUpload.length) {
            setUploading(false);
            utils.serviceOrders.photos.list.invalidate({ serviceOrderId });
            onPhotosChange?.();
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (!serviceOrderId) return null;

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Camera className="h-4 w-4" /> Fotos do veículo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Anexe fotos do veículo no momento da entrada (riscos, nível de combustível, peças danificadas).
          Formatos: JPG, PNG e WEBP — até 5 MB cada.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando fotos...
          </div>
        ) : (photos ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center">
            <ImagePlus className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Nenhuma foto anexada</p>
            <label className="mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={(e) => {
                  const input = (e.target as HTMLElement).closest("label")?.querySelector("input");
                  input?.click();
                }}
              >
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <ImagePlus className="h-3.5 w-3.5" /> Anexar fotos
              </Button>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {(photos ?? []).map((photo: OsPhoto) => (
                <div key={photo.id} className="group relative rounded-lg overflow-hidden border bg-muted/30 aspect-square">
                    <img
                    src={photo.url}
                    alt={photo.fileName ?? "Foto do veículo"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <button
                    onClick={() => setDeleteId(photo.id)}
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive"
                    aria-label={`Remover foto ${photo.fileName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-block">
              <Button type="button" variant="outline" size="sm" disabled={uploading}>
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <ImagePlus className="h-3.5 w-3.5" /> Adicionar mais fotos
              </Button>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>
        )}

        {deleteId && (
          <AlertDialog open onOpenChange={(o) => !o && setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover foto?</AlertDialogTitle>
                <AlertDialogDescription>
                  A foto será removida permanentemente desta ordem de serviço.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteMutation.mutate({ id: deleteId });
                    setDeleteId(null);
                  }}
                  className="bg-destructive"
                >
                  {deleteMutation.isPending ? "Removendo..." : "Sim, remover"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
