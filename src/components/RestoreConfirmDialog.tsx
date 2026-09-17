import { useState } from "react";
import { importBackup } from "@/lib/db.functions";
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

export function RestoreConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  description = "This will overwrite all current data and restart the app. Are you sure?",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
  description?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore database backup?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {loading ? "Restoring…" : "Overwrite and restart"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useRestoreBackup(onError?: (message: string) => void) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const runRestore = async () => {
    setLoading(true);
    try {
      const res = await importBackup();
      if (res.canceled) {
        setOpen(false);
        return;
      }
      if (!res.ok) {
        onError?.(res.error || "Restore failed.");
        setOpen(false);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Restore failed.");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return { open, setOpen, loading, runRestore };
}
