import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function CreateOnDiskModal({
  open,
  onOpenChange,
  onCreateOnDisk,
}: {
  lessonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOnDisk: (repoPath: string) => void;
}) {
  const [repoPathInput, setRepoPathInput] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setRepoPathInput("");
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create on Disk</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!repoPathInput.trim()) return;
            onCreateOnDisk(repoPathInput.trim());
            onOpenChange(false);
            setRepoPathInput("");
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="create-on-disk-repo-path">
              Course Repository Path
            </Label>
            <Input
              id="create-on-disk-repo-path"
              name="repoPath"
              placeholder="e.g. /home/you/project or ~/project"
              value={repoPathInput}
              onChange={(e) => setRepoPathInput(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Must point to an existing git repository directory. You can use an
              absolute path like <code>/home/you/project</code> or a home
              shortcut like <code>~/project</code>. This will permanently assign
              a file path to the course.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setRepoPathInput("");
              }}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!repoPathInput.trim()}>
              Create on Disk
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
