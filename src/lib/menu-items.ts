
import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck, BookUp, UploadCloud, BookOpenCheck, BookCopy, Users } from 'lucide-react';

export const studentMenuItems = [
    { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/student/courses', label: 'Courses', icon: Library },
    { href: '/student/assignments', label: 'Assignments', icon: PenSquare },
    { href: '/student/quizzes', label: 'Quizzes', icon: BookCheck },
    { href: '/student/registration', label: 'Registration', icon: UserCheck },
    { href: '/student/attendance', label: 'Attendance', icon: BarChart2 },
    { href: '/student/library', label: 'Library', icon: Library },
    { href: '/student/resources', label: 'Resources', icon: FileText },
    // { href: '/student/calendar', label: 'Calendar', icon: Calendar },
    // { href: '/student/payments', label: 'Payments', icon: DollarSign },
  ];

export const staffMenuItems = [
    { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/staff/courses', label: 'Course Management', icon: BookOpenCheck },
    { href: '/staff/roster', label: 'Student Roster', icon: Users },
    { href: '/staff/assignments', label: 'Assignments', icon: PenSquare },
    { href: '/staff/quizzes', label: 'Quiz Management', icon: BookCopy },
    { href: '/staff/attendance', label: 'Attendance', icon: UserCheck },
    { href: '/staff/library', label: 'Library Management', icon: BookUp },
    { href: '/staff/resources', label: 'Resource Management', icon: UploadCloud },
];

export const adminMenuItems = [
    { href: '/admin/dashboard', label: 'User Management', icon: Users },
    { href: '/staff/courses', label: 'Course Management', icon: BookOpenCheck },
    { href: '/staff/assignments', label: 'Assignment Mgmt', icon: PenSquare },
    { href: '/staff/library', label: 'Library Management', icon: BookUp },
    { href: '/staff/resources', label: 'Resource Management', icon: UploadCloud },
    // { href: '/admin/settings', label: 'Settings', icon: Settings },
]
