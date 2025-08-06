
import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck, BookUp, UploadCloud, BookOpenCheck, BookCopy, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardEdit, HandCoins, Stethoscope, MonitorPlay, Heart, Bus, Handshake, Search, GitBranch, Shield, LandPlot, Users2, Star, Newspaper, GraduationCap } from 'lucide-react';

export const allMenuItems = [
    // Admin & Registrar
    { href: '/admin/dashboard', label: 'Dashboard & Analytics', icon: LayoutDashboard, roles: ['Admin'] },
    
    // Academics
    { href: '/admin/admissions', label: 'Admissions', icon: UserCheck, roles: ['Admin', 'Registrar'] },
    { href: '/admin/academics', label: 'Academics', icon: GraduationCap, roles: ['Admin', 'Registrar'] },
    { href: '/admin/programmes', label: 'Programmes', icon: GanttChart, roles: ['Admin', 'Registrar'] },
    { href: '/admin/courses', label: 'Courses', icon: BookCopy, roles: ['Admin', 'Registrar'] },
    { href: '/admin/course-paths', label: 'Course Paths', icon: Route, roles: ['Admin', 'Registrar'] },
    { href: '/admin/registration-management', label: 'Registration Setup', icon: Settings, roles: ['Admin', 'Registrar'] },
    { href: '/admin/approve-registrations', label: 'Approve Registrations', icon: BookOpenCheck, roles: ['Admin', 'Registrar'] },
    { href: '/admin/calendar', label: 'Academic Calendar', icon: Calendar, roles: ['Admin', 'Registrar'] },
    { href: '/admin/exams', label: 'Exams & Results', icon: ClipboardEdit, roles: ['Admin', 'Registrar'] },
    { href: '/admin/clinicals', label: 'Clinicals & Internships', icon: Stethoscope, roles: ['Admin'] },
    { href: '/admin/elearning', label: 'E-Learning', icon: MonitorPlay, roles: ['Admin'] },

    // Finance
    { href: '/admin/finance', label: 'Finance', icon: DollarSign, roles: ['Admin', 'Accountant'] },
    { href: '/admin/payments', label: 'Payments Overview', icon: DollarSign, roles: ['Admin', 'Accountant'] },
    { href: '/admin/cashflow', label: 'Cash Flow', icon: BarChart2, roles: ['Admin', 'Accountant'] },
    { href: '/admin/payment-plans', label: 'Payment Plans', icon: Wallet, roles: ['Admin', 'Accountant'] },
    { href: '/admin/fees', label: 'Fee Management', icon: HandCoins, roles: ['Admin', 'Accountant'] },
    
    // Student & Campus Life
    { href: '/admin/student-life', label: 'Student Life & Welfare', icon: Heart, roles: ['Admin'] },
    { href: '/admin/library', label: 'Library', icon: Library, roles: ['Admin', 'Librarian'] },
    { href: '/admin/book-requests', label: 'Book Requests', icon: BookUp, roles: ['Admin', 'Librarian'] },
    { href: '/admin/transport', label: 'Transport', icon: Bus, roles: ['Admin'] },
    { href: '/admin/chaplaincy', label: 'Chaplaincy & Spiritual Life', icon: Users2, roles: ['Admin'] },
    { href: '/admin/mentorship', label: 'Mentorship & Advising', icon: Handshake, roles: ['Admin'] },

    // HR
    { href: '/admin/hr', label: 'Human Resources', icon: Users, roles: ['Admin', 'HR'] },
    { href: '/admin/leave-approvals', label: 'Leave Approvals', icon: UserCheck, roles: ['Admin', 'HR'] },
    { href: '/admin/vacancies', label: 'Vacancies', icon: Building, roles: ['Admin', 'HR'] },

    // Administration
    { href: '/admin/administration', label: 'Administration', icon: Settings, roles: ['Admin'] },
    { href: '/admin/users', label: 'User Management', icon: Users, roles: ['Admin'] },
    { href: '/admin/research', label: 'Research & Innovation', icon: Search, roles: ['Admin'] },
    { href: '/admin/community', label: 'Community Engagement', icon: Users2, roles: ['Admin'] },
    { href: '/admin/quality', label: 'Quality Assurance', icon: Star, roles: ['Admin'] },
    { href: '/admin/legal', label: 'Legal & Compliance', icon: Shield, roles: ['Admin'] },
    { href: '/admin/facilities', label: 'Facilities & Estates', icon: LandPlot, roles: ['Admin'] },
    { href: '/admin/partnerships', label: 'Partnerships', icon: Handshake, roles: ['Admin'] },
    { href: '/admin/media', label: 'Media & PR', icon: Newspaper, roles: ['Admin'] },

    // System
    { href: '/admin/integrations', label: 'Integrations', icon: GitBranch, roles: ['Admin'] },
    { href: '/admin/settings', label: 'System Settings', icon: Settings, roles: ['Admin'] },
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
