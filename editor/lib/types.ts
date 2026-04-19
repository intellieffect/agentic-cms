export interface Project {
  id: string;
  name: string;
  clipCount?: number;
  totalDuration?: number;
  sources?: Array<string | { filename: string }>;
  updatedAt?: number | string;
  source?: string;
  locked?: boolean;
}

export interface ReferenceAccount {
  id: string;
  username?: string;
  account_name?: string;
  platform?: string;
  profile_pic_url?: string;
  video_count?: number;
}

export interface ReferenceVideo {
  id: string;
  caption?: string;
  platform?: string;
  url?: string;
  video_url?: string;
  duration_sec?: number;
  like_count?: number;
  comment_count?: number;
  view_count?: number;
  style_tags?: string[];
  transition_tags?: string[];
  music_tags?: string[];
  notes?: string;
  created_at?: string;
  account_name?: string;
  username?: string;
  favorite?: boolean;
  music_artist?: string;
  music_title?: string;
}

export interface FinishedVideo {
  id: string;
  name?: string;
  duration?: number;
  file_size?: number;
  width?: number;
  height?: number;
  tags?: string[];
  notes?: string;
  created_at?: string;
}
