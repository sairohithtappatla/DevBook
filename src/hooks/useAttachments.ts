import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DBService, type DBAttachment } from "@/services/db";
import { insforge } from "@/lib/insforge";

export function useAttachments(stepId: string | null) {
  return useQuery<DBAttachment[]>({
    queryKey: ["attachments", stepId],
    queryFn: () => (stepId ? DBService.getAttachments(stepId) : Promise.resolve([])),
    enabled: !!stepId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stepId,
      file,
      createdBy,
    }: {
      stepId: string;
      file: File;
      createdBy: string;
      bookId?: string;
    }) => {
      // 1. Upload file to InsForge Storage bucket 'book-assets'
      const fileExt = file.name.split(".").pop();
      const storagePath = `${stepId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await insforge.storage
        .from("book-assets")
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // 2. Insert record into attachments database table
      return DBService.createAttachment({
        step_id: stepId,
        file_name: file.name,
        storage_path: storagePath,
        file_type: file.type,
        file_size: file.size,
        created_by: createdBy,
      });
    },
    onSuccess: (data: any, variables: any) => {
      queryClient.setQueryData(["attachments", variables.stepId], (old: any) => {
        if (!old) return [data];
        return [...old, data];
      });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      attachmentId,
      storagePath,
    }: {
      attachmentId: string;
      storagePath: string;
      stepId: string;
      bookId?: string;
    }) => {
      // 1. Delete from storage bucket
      const { error: storageError } = await insforge.storage
        .from("book-assets")
        .remove(storagePath);
      
      if (storageError) {
        console.error("Storage deletion error (ignored for DB cleanup):", storageError);
      }

      // 2. Delete from database table
      return DBService.deleteAttachment(attachmentId);
    },
    onSuccess: (_, variables: any) => {
      queryClient.setQueryData(["attachments", variables.stepId], (old: any) => {
        if (!old) return [];
        return old.filter((a: any) => a.id !== variables.attachmentId);
      });
    },
  });
}
