import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { DBFunctionsService } from "@/services/db-service.server";
import { runtimeLive } from "@/services/layer.server";
import { Console, Effect } from "effect";
import { ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { isLeftClick } from "@/lib/utils";
import { useFetcher, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/archived-courses";

export const meta: Route.MetaFunction = () => {
  return [
    {
      title: "CVM - Archived Courses",
    },
  ];
};

export const loader = async (_args: Route.LoaderArgs) => {
  return Effect.gen(function* () {
    const db = yield* DBFunctionsService;
    const archivedRepos = yield* db.getArchivedCourses();
    const repos = yield* db.getCourses();
    const standaloneVideos = yield* db.getStandaloneVideos();
    const plans = yield* db.getPlans();

    return {
      archivedRepos,
      repos,
      standaloneVideos,
      plans,
    };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    runtimeLive.runPromise
  );
};

export default function ArchivedRepos(props: Route.ComponentProps) {
  const unarchiveRepoFetcher = useFetcher();
  const data = props.loaderData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCourseId = searchParams.get("courseId");
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isAddStandaloneVideoModalOpen, setIsAddStandaloneVideoModalOpen] =
    useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar
        repos={data.repos}
        standaloneVideos={data.standaloneVideos}
        selectedCourseId={selectedCourseId}
        isAddCourseModalOpen={isAddCourseModalOpen}
        setIsAddCourseModalOpen={setIsAddCourseModalOpen}
        isAddStandaloneVideoModalOpen={isAddStandaloneVideoModalOpen}
        setIsAddStandaloneVideoModalOpen={setIsAddStandaloneVideoModalOpen}
        plans={data.plans}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-6">Archived Courses</h1>

          {data.archivedRepos.length === 0 ? (
            <p className="text-muted-foreground">No archived courses.</p>
          ) : (
            <div className="space-y-2">
              {data.archivedRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <Button
                      variant="link"
                      className="h-auto p-0 font-medium text-base"
                      onMouseDown={(e) => {
                        if (!isLeftClick(e)) return;
                        navigate(`/?courseId=${repo.id}`, {
                          preventScrollReset: true,
                        });
                      }}
                    >
                      {repo.name}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {repo.filePath}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      unarchiveRepoFetcher.submit(
                        { archived: "false" },
                        {
                          method: "post",
                          action: `/api/courses/${repo.id}/archive`,
                        }
                      );
                    }}
                    disabled={unarchiveRepoFetcher.state !== "idle"}
                  >
                    <ArchiveRestore className="w-4 h-4 mr-2" />
                    Unarchive
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
