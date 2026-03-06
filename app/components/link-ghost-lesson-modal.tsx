import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

export function LinkGhostLessonModal(props: {
  lessonId: string;
  sectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const linkFetcher = useFetcher();
  const dirsFetcher = useFetcher<{ directories: string[] }>();
  const [selectedPath, setSelectedPath] = useState<string>("");

  useEffect(() => {
    if (props.open && props.sectionId) {
      dirsFetcher.load(`/api/sections/${props.sectionId}/unlinked-directories`);
    }
  }, [props.open, props.sectionId]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedPath("");
    }
    props.onOpenChange(open);
  };

  const directories = dirsFetcher.data?.directories ?? [];
  const isLoading = dirsFetcher.state === "loading";

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Link to Existing Files
          </DialogTitle>
          <DialogDescription>
            Link this ghost lesson to an existing directory on disk.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : directories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No unlinked directories found in this section.
            </p>
          ) : (
            <Select value={selectedPath} onValueChange={setSelectedPath}>
              <SelectTrigger>
                <SelectValue placeholder="Select a directory..." />
              </SelectTrigger>
              <SelectContent>
                {directories.map((dir) => (
                  <SelectItem key={dir} value={dir}>
                    {dir}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedPath || linkFetcher.state === "submitting"}
              onClick={async () => {
                await linkFetcher.submit(
                  { path: selectedPath },
                  {
                    method: "post",
                    action: `/api/lessons/${props.lessonId}/link-to-path`,
                  }
                );
                handleOpenChange(false);
              }}
            >
              {linkFetcher.state === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Link"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
