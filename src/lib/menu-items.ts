
import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck as UserCheckIcon, BookUp, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardEdit, HandCoins, Stethoscope, MonitorPlay, Heart, Bus, Handshake, Search, GitBranch, Shield, LandPlot, Users2, Star, Newspaper, GraduationCap, BookOpenCheck, BookCopy } from 'lucide-react';

export const allMenuItems = [
    // Admin & Registrar
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin'] },
    { href: '/admin/users', label: 'User Management', icon: Users, roles: ['Admin'] },
    { href: '/admin/programmes', label: 'Programmes', icon: GanttChart, roles: ['Admin', 'Registrar'] },
    { href: '/admin/courses', label: 'Courses', icon: BookCopy, roles: ['Admin', 'Registrar'] },
    { href: '/admin/course-paths', label: 'Course Paths', icon: Route, roles: ['Admin', 'Registrar'] },
    { href: '/admin/registration-management', label: 'Registration Setup', icon: Settings, roles: ['Admin', 'Registrar'] },
    { href: '/admin/approve-registrations', label: 'Approve Registrations', icon: BookOpenCheck, roles: ['Admin', 'Registrar'] },
    { href: '/admin/calendar', label: 'Academic Calendar', icon: Calendar, roles: ['Admin', 'Registrar'] },
    { href: '/admin/payments', label: 'Payments Overview', icon: DollarSign, roles: ['Admin', 'Accountant'] },
    { href: '/admin/cashflow', label: 'Cash Flow', icon: BarChart2, roles: ['Admin', 'Accountant'] },
    { href: '/admin/payment-plans', label: 'Payment Plans', icon: Wallet, roles: ['Admin', 'Accountant'] },
    { href: '/admin/fees', label: 'Fee Management', icon: HandCoins, roles: ['Admin', 'Accountant'] },
    { href: '/admin/library', label: 'Library Management', icon: Library, roles: ['Admin', 'Librarian'] },
    { href: '/admin/book-requests', label: 'Book Requests', icon: BookUp, roles: ['Admin', 'Librarian'] },
    { href: '/admin/timetable', label: 'Timetable', icon: Calendar, roles: ['Admin', 'Registrar'] },
    { href: '/admin/leave-approvals', label: 'Leave Approvals', icon: UserCheckIcon, roles: ['Admin', 'HR'] },
    { href: '/admin/vacancies', label: 'Vacancies', icon: Building, roles: ['Admin', 'HR'] },
    { href: '/admin/settings', label: 'System Settings', icon: Settings, roles: ['Admin'] },
];


export const staffMenuItems = [
    { href: '/staff/courses', label: 'My Courses', icon: Library, roles: ['Lecturer'] },
    { href: '/staff/leave-approvals', label: 'Student Absences', icon: UserCheckIcon, roles: ['Lecturer']},
    { href: '/staff/timetable', label: 'My Timetable', icon: Calendar, roles: ['Lecturer'] },
    { href: '/staff/leave', label: 'My Leave', icon: Calendar, roles: ['*'] },
    { href: '/staff/calendar', label: 'Academic Calendar', icon: Calendar, roles: ['*'] },
    { href: '/staff/library', label: 'Library', icon: Library, roles: ['*'] },
    { href: '/staff/book-requests', label: 'Book Requests', icon: BookUp, roles: ['Librarian'] },
    { href: '/staff/payment-plans', label: 'Payment Plans', icon: Wallet, roles: ['Accountant'] },
    { href: '/staff/payments', label: 'Payments Overview', icon: DollarSign, roles: ['Accountant'] },
    { href: '/staff/cashflow', label: 'Cash Flow', icon: BarChart2, roles: ['Accountant'] },
    { href: '/staff/approve-registrations', label: 'Approve Registrations', icon: BookOpenCheck, roles: ['Registrar'] },
    { href: '/staff/registration-management', label: 'Registration Setup', icon: Settings, roles: ['Registrar'] },
];

export const studentMenuItems = [
    { href: '/student/classes', label: 'My Classes', icon: Library },
    { href: '/student/registration', label: 'Registration', icon: UserCheckIcon },
    { href: '/student/payments', label: 'Payments & Invoices', icon: DollarSign },
    { href: '/student/attendance', label: 'My Attendance', icon: Hand },
    { href: '/student/timetable', label: 'My Timetable', icon: Calendar },
    { href: '/student/library', label: 'Library', icon: BookUp },
    { href: '/student/leave', label: 'Request Absence', icon: Calendar },
    { href: '/student/resources', label: 'Resources', icon: FileText },
  ];
