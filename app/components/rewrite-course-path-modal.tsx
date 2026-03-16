import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

export function RewriteCoursePathModal(props: {
  courseId: string;
  currentPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fetcher.data?.success === false && fetcher.data.error) {
      setError(fetcher.data.error);
    } else if (fetcher.data?.success) {
      props.onOpenChange(false);
    }
  }, [fetcher.data, props]);

  useEffect(() => {
    if (props.open) {
      setError(null);
    }
  }, [props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rewrite Course Repo Path</DialogTitle>
        </DialogHeader>
        <fetcher.Form
          method="post"
          action={`/api/courses/${props.courseId}/rewrite-path`}
          className="space-y-4 py-4"
          onSubmit={() => {
            setError(null);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="file-path">Repo Path</Label>
            <Input
              id="file-path"
              name="filePath"
              defaultValue={props.currentPath}
              required
              className="font-mono text-sm"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={fetcher.state === "submitting"}>
              {fetcher.state === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
