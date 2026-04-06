'use client';

import { ChatContext, useChat } from '@/lib/agent-chat';

/**
 * Provides a persistent chat WebSocket connection across dashboard navigation.
 * Place in DashboardLayout so the connection isn't torn down when the user
 * navigates away from the chat page.
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const chat = useChat();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}
