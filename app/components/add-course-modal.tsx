import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";
import { useFetcher } from "react-router";

interface AddCourseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCourseModal({ isOpen, onOpenChange }: AddCourseModalProps) {
  const addCourseFetcher = useFetcher();

  useEffect(() => {
    if (addCourseFetcher.state === "idle" && addCourseFetcher.data) {
      onOpenChange(false);
    }
  }, [addCourseFetcher.state, addCourseFetcher.data, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Course</DialogTitle>
        </DialogHeader>
        <addCourseFetcher.Form
          method="post"
          action="/api/courses/add"
          className="space-y-4 py-4"
        >
          <div className="space-y-2">
            <Label htmlFor="course-name">Course Name</Label>
            <Input
              id="course-name"
              placeholder="e.g., Total TypeScript"
              name="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-path">Course Repo Path</Label>
            <Input
              id="course-path"
              placeholder="Enter local file path..."
              name="repoPath"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit">Add Course</Button>
          </div>
        </addCourseFetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
