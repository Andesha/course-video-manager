#!/usr/bin/env python3
import os
import sys


def split(value: str, sep: str):
    return [part for part in value.split(sep) if part]


try:
    import DaVinciResolveScript as dvr
except ImportError:
    modules_path = "/opt/resolve/Developer/Scripting/Modules/DaVinciResolveScript.py"
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "DaVinciResolveScript", modules_path
    )
    if not spec or not spec.loader:
        raise RuntimeError("Could not load DaVinciResolveScript")
    module = importlib.util.module_from_spec(spec)
    sys.modules["DaVinciResolveScript"] = module
    spec.loader.exec_module(module)
    import DaVinciResolveScript as dvr


resolve = dvr.scriptapp("Resolve")
if not resolve:
    raise RuntimeError(
        "Could not connect to DaVinci Resolve. Make sure Resolve is open and scripting is enabled."
    )

project_manager = resolve.GetProjectManager()
project = project_manager.GetCurrentProject()
if not project:
    project = project_manager.LoadProject("Course Video Manager")
if not project:
    project = project_manager.CreateProject("Course Video Manager")
if not project:
    raise RuntimeError("Could not open or create a Resolve project")

media_pool = project.GetMediaPool()
folder = media_pool.GetCurrentFolder()
media_storage = resolve.GetMediaStorage()

input_videos = os.getenv("INPUT_VIDEOS")
if not input_videos:
    raise RuntimeError("No INPUT_VIDEOS provided")

clips_to_append = os.getenv("CLIPS_TO_APPEND")
if not clips_to_append:
    raise RuntimeError("No CLIPS_TO_APPEND provided")

new_timeline_name = os.getenv("NEW_TIMELINE_NAME")
if not new_timeline_name:
    raise RuntimeError("No NEW_TIMELINE_NAME provided")

video_paths = split(input_videos, ":::")
video_index_to_clip = {}

for video_index, video_path in enumerate(video_paths):
    clips = media_storage.AddItemListToMediaPool(video_path)
    if not clips or not clips[0]:
        raise RuntimeError(f"Failed to add video to media pool: {video_path}")
    media_id = clips[0].GetMediaId()
    folder_clips = folder.GetClipList()

    found_clip = None
    for folder_clip in folder_clips:
        if folder_clip.GetMediaId() == media_id:
            found_clip = folder_clip
            break

    if not found_clip:
        raise RuntimeError(f"Could not find media pool clip for: {video_path}")

    video_index_to_clip[video_index] = found_clip

print(f"Creating timeline: {new_timeline_name}")
timeline = media_pool.CreateEmptyTimeline(new_timeline_name)
if not timeline:
    raise RuntimeError(f"Failed to create timeline: {new_timeline_name}")

project.SetCurrentTimeline(timeline)
global_timeline_start_frame = timeline.GetStartFrame()

for clip_info_str in split(clips_to_append, ":::"):
    parts = split(clip_info_str, "___")
    start_frame = int(parts[0])
    end_frame = int(parts[1])
    video_index = int(parts[2])
    track_index = int(parts[3])
    timeline_start_frame = int(parts[4]) if len(parts) > 4 and parts[4] else None

    clip = video_index_to_clip.get(video_index)
    if not clip:
        raise RuntimeError(f"Video index {video_index} not found")
    if track_index < 1:
        raise RuntimeError(f"Invalid track index: {track_index}")

    current_video_tracks = timeline.GetTrackCount("video")
    while current_video_tracks < track_index:
        timeline.AddTrack("video")
        current_video_tracks += 1

    clip_info = {
        "startFrame": start_frame,
        "endFrame": end_frame,
        "mediaPoolItem": clip,
        "trackIndex": track_index,
    }
    if timeline_start_frame is not None:
        clip_info["recordFrame"] = timeline_start_frame + global_timeline_start_frame

    appended_items = media_pool.AppendToTimeline([clip_info])
    if not appended_items:
        raise RuntimeError(
            f"Failed to append clip from {clip.GetName()} frames {start_frame}-{end_frame}"
        )

end_frame = timeline.GetEndFrame()
timeline.AddMarker(
    end_frame - global_timeline_start_frame,
    "Blue",
    "Multi-Track Append Point",
    "Content appended after this point",
    1,
)
resolve.OpenPage("cut")
print(f"Created timeline: {timeline.GetName()}")
