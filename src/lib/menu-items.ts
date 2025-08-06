
import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck as UserCheckIcon, BookUp, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardEdit, HandCoins, Stethoscope, MonitorPlay, Heart, Bus, Handshake, Search, GitBranch, Shield, LandPlot, Users2, Star, Newspaper, GraduationCap, BookCopy, BookOpenCheck, Beaker, Telescope, Truck, Link, UserCog } from 'lucide-react';

export const allMenuItems = [
    { href: '/admin/dashboard', label: 'Dashboard & Analytics', icon: LayoutDashboard, roles: ['Admin'] },
    {
      label: 'Admissions',
      icon: Newspaper,
      roles: ['Admin', 'Registrar'],
      items: [
        { href: '/admin/registration-management', label: 'Registration Setup', icon: Settings },
        { href: '/admin/approve-registrations', label: 'Approve Registrations', icon: BookOpenCheck },
      ]
    },
    {
      label: 'Academics',
      icon: GraduationCap,
      roles: ['Admin', 'Registrar'],
      items: [
        { href: '/admin/programmes', label: 'Programmes', icon: GanttChart },
        { href: '/admin/courses', label: 'Courses', icon: BookCopy },
        { href: '/admin/course-paths', label: 'Course Paths', icon: Route },
        { href: '/admin/timetable', label: 'Timetable', icon: Calendar },
        { href: '/admin/calendar', label: 'Academic Calendar', icon: Calendar },
      ]
    },
     {
      label: 'E-Learning',
      icon: MonitorPlay,
      roles: ['Admin'],
      items: []
    },
    {
      label: 'Finance',
      icon: Wallet,
      roles: ['Admin', 'Accountant'],
      items: [
        { href: '/admin/payments', label: 'Payments Overview', icon: DollarSign },
        { href: '/admin/cashflow', label: 'Cash Flow', icon: BarChart2 },
        { href: '/admin/payment-plans', label: 'Payment Plans', icon: Wallet },
        { href: '/admin/fees', label: 'Fee Management', icon: HandCoins },
      ]
    },
    {
        label: 'Student Life & Welfare',
        icon: Users2,
        roles: ['Admin'],
        items: []
    },
     {
      label: 'Library',
      icon: Library,
      roles: ['Admin', 'Librarian'],
      items: [
         { href: '/admin/library', label: 'Library Management', icon: Library },
         { href: '/admin/book-requests', label: 'Book Requests', icon: BookUp },
      ]
    },
    {
        label: 'HR',
        icon: UserCog,
        roles: ['Admin', 'HR'],
        items: [
             { href: '/admin/leave-approvals', label: 'Leave Approvals', icon: UserCheckIcon },
             { href: '/admin/vacancies', label: 'Vacancies', icon: Building },
        ]
    },
    {
        label: 'Facilities & Estates',
        icon: Building,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Transport',
        icon: Truck,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Admin',
        icon: Shield,
        roles: ['Admin'],
        items: [
            { href: '/admin/users', label: 'User Management', icon: Users },
            { href: '/admin/settings', label: 'System Settings', icon: Settings },
        ]
    },
];

export const staffBaseMenuItems = [
    { href: '/staff/courses', label: 'My Courses', icon: Library },
    { href: '/staff/leave-approvals', label: 'Student Absences', icon: UserCheckIcon},
    { href: '/staff/timetable', label: 'My Timetable', icon: Calendar },
    { href: '/staff/leave', label: 'My Leave', icon: Calendar },
    { href: '/staff/calendar', label: 'Academic Calendar', icon: Calendar },
    { href: '/staff/library', label: 'Library', icon: Library },
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

