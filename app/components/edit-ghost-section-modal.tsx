import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capitalizeTitle } from "@/utils/capitalize-title";
import { useEffect, useState } from "react";

export function EditGhostSectionModal(props: {
  sectionId: string;
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (title: string) => void;
}) {
  const [title, setTitle] = useState(props.currentTitle);

  useEffect(() => {
    setTitle(props.currentTitle);
  }, [props.currentTitle]);

  const isValid = title.trim().length > 0;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) setTitle(props.currentTitle);
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Ghost Section</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValid) return;
            props.onRename(capitalizeTitle(title.trim()));
            props.onOpenChange(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ghost-section-title">Title</Label>
            <Input
              id="ghost-section-title"
              name="title"
              placeholder="e.g. Before We Start"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setTitle(props.currentTitle);
                props.onOpenChange(false);
              }}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
