// Module: Social / Presença Digital

export type { SocialPost, SocialGoal, CreatePostInput, SocialPlatform, PostStatus } from './types';
export { createPost, listPosts, publishPost, listGoals, getPostStats } from './queries';
export { postCommand, handlePost } from './commands';
export { loadL0, loadL1, loadL2 } from './context';
