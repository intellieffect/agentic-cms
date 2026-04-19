"""Centralised Supabase table-name constants.

Every table name used by the Python backend is read from an environment
variable so that a host application can remap them at deploy time.
Defaults match the original hard-coded names.
"""
import os

TABLE_VIDEOS = os.environ.get("TABLE_VIDEOS", "reference_videos")
TABLE_ACCOUNTS = os.environ.get("TABLE_ACCOUNTS", "reference_accounts")
TABLE_CAROUSELS = os.environ.get("TABLE_CAROUSELS", "carousels")
TABLE_PROJECTS = os.environ.get("TABLE_PROJECTS", "projects")
TABLE_FINISHED = os.environ.get("TABLE_FINISHED", "finished_videos")
TABLE_PRESETS = os.environ.get("TABLE_PRESETS", "presets")
TABLE_RENDER_JOBS = os.environ.get("TABLE_RENDER_JOBS", "render_jobs")
TABLE_REF_POSTS = os.environ.get("TABLE_REF_POSTS", "ref_posts")
TABLE_REF_ACCOUNTS = os.environ.get("TABLE_REF_ACCOUNTS", "ref_accounts")
TABLE_REF_SLIDES = os.environ.get("TABLE_REF_SLIDES", "ref_slides")
TABLE_STORYBOARDS = os.environ.get("TABLE_STORYBOARDS", "storyboards")
TABLE_SUBTITLES = os.environ.get("TABLE_SUBTITLES", "subtitles")
TABLE_COLLECTIONS = os.environ.get("TABLE_COLLECTIONS", "reference_collections")
TABLE_COLLECTION_ITEMS = os.environ.get("TABLE_COLLECTION_ITEMS", "reference_collection_items")
TABLE_PLANS = os.environ.get("TABLE_PLANS", "plans")
