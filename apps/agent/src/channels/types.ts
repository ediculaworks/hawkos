export interface Channel {
  readonly name: string;
  connect(): Promise<void>;
  send(channelId: string, content: string): Promise<void>;
  sendTyping?(channelId: string): Promise<void>;
  ownsJid(jid: string): boolean;
  isConnected(): boolean;
  disconnect(): Promise<void>;
}
