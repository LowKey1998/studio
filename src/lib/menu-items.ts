
import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck, BookUp, UploadCloud, BookOpenCheck, BookCopy, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardEdit, HandCoins } from 'lucide-react';

export const allMenuItems = [
    // Admin & Registrar
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin'] },
    { href: '/admin/users', label: 'User Management', icon: Users, roles: ['Admin'] },
    { href: '/admin/programmes', label: 'Programmes', icon: GanttChart, roles: ['Admin', 'Registrar'] },
    { href: '/admin/courses', label: 'Courses', icon: BookCopy, roles: ['Admin', 'Registrar'] },
    { href: '/admin/course-paths', label: 'Course Paths', icon: Route, roles: ['Admin', 'Registrar'] },
    { href: '/admin/registration-management', label: 'Registration', icon: UserCheck, roles: ['Admin', 'Registrar'] },
    { href: '/admin/approve-registrations', label: 'Approve Registrations', icon: BookOpenCheck, roles: ['Admin', 'Registrar'] },
    { href: '/admin/calendar', label: 'Academic Calendar', icon: Calendar, roles: ['Admin', 'Registrar'] },
    { href: '/admin/settings', label: 'System Settings', icon: Settings, roles: ['Admin'] },

    // Accountant
    { href: '/admin/payments', label: 'Payments Overview', icon: DollarSign, roles: ['Admin', 'Accountant'] },
    { href: '/admin/cashflow', label: 'Cash Flow', icon: BarChart2, roles: ['Admin', 'Accountant'] },
    { href: '/admin/payment-plans', label: 'Payment Plans', icon: Wallet, roles: ['Admin', 'Accountant'] },
    { href: '/admin/fees', label: 'Fee Management', icon: HandCoins, roles: ['Admin', 'Accountant'] },

    // Librarian
    { href: '/admin/library', label: 'Manage Library', icon: Library, roles: ['Admin', 'Librarian'] },
    { href: '/admin/book-requests', label: 'Book Requests', icon: BookUp, roles: ['Admin', 'Librarian'] },
    
    // HR
    { href: '/admin/leave-approvals', label: 'Leave Approvals', icon: UserCheck, roles: ['Admin', 'HR'] },
    { href: '/admin/vacancies', label: 'Vacancies', icon: Building, roles: ['Admin', 'HR'] },

    // Lecturer (managed under /staff for now)
    // Shared
];


export const staffMenuItems = [
    { href: '/staff/courses', label: 'My Courses', icon: Library, roles: ['Lecturer'] },
    { href: '/staff/leave-approvals', label: 'Student Absences', icon: UserCheck, roles: ['Lecturer']},
    { href: '/staff/timetable', label: 'My Timetable', icon: Calendar, roles: ['Lecturer'] },
    { href: '/staff/leave', label: 'My Leave', icon: Calendar, roles: ['*'] }, // All staff can apply for leave
    
    // Sub-role specific pages, paths must match a key from allMenuItems
    { href: '/admin/approve-registrations', label: 'Approve Registrations', icon: BookOpenCheck, roles: ['Registrar'] },
    { href: '/admin/registration-management', label: 'Manage Registration', icon: UserCheck, roles: ['Registrar'] },
    { href: '/admin/payments', label: 'Payments Overview', icon: DollarSign, roles: ['Accountant'] },
    { href: '/admin/cashflow', label: 'Cash Flow', icon: BarChart2, roles: ['Accountant'] },
    { href: '/admin/library', label: 'Manage Library', icon: Library, roles: ['Librarian'] },
    { href: '/admin/book-requests', label: 'Book Requests', icon: BookUp, roles: ['Librarian'] },
  ];

export const studentMenuItems = [
    { href: '/student/classes', label: 'My Classes', icon: Library },
    { href: '/student/registration', label: 'Registration', icon: UserCheck },
    { href: '/student/payments', label: 'Payments & Invoices', icon: DollarSign },
    { href: '/student/attendance', label: 'My Attendance', icon: Hand },
    { href: '/student/timetable', label: 'My Timetable', icon: Calendar },
    { href: '/student/library', label: 'Library', icon: BookUp },
    { href: '/student/leave', label: 'Request Absence', icon: Calendar },
    { href: '/student/resources', label: 'Resources', icon: FileText },
  ];
