import type { Notification, User } from '@/lib/types';

export const mockUser: User = {
  id: '1',
  name: 'Alex Starr',
  email: 'alex.starr@example.com',
  avatarUrl: 'https://placehold.co/100x100.png',
};

export const mockNotifications: Notification[] = [
  {
    id: '1',
    message: 'Your payment of $500 for "Tuition Fees" was successful.',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    type: 'success',
  },
  {
    id: '2',
    message: 'New assignment "Calculus II - Problem Set 3" has been posted.',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    type: 'info',
  },
  {
    id: '3',
    message: 'Failed to upload "Lab_Report_Final.pdf". File size exceeds limit.',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    type: 'error',
  },
  {
    id: '4',
    message: 'Your course registration for the new semester is pending approval.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    type: 'warning',
  },
  {
    id: '5',
    message: 'Upcoming quiz in "Modern Physics" in 2 days.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    type: 'info',
  },
  {
    id: '6',
    message: 'Your grade for "History 101 Midterm" has been posted: A-',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    type: 'success',
  },
];
