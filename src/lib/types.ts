
export type Notification = {
  id: string;
  message: string;
  link: string;
  timestamp: string;
  isRead: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};
