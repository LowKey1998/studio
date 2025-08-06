

import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck as UserCheckIcon, BookUp, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardEdit, HandCoins, Stethoscope, MonitorPlay, Heart, Bus, Handshake, Search, GitBranch, Shield, LandPlot, Users2, Star, Newspaper, GraduationCap, BookCopy, BookOpenCheck, Beaker, Telescope, Truck, Link, UserCog, Check, AlertTriangle, TrendingDown, UserX, CheckCircle2, SlidersHorizontal, UserPlus, Scale, FileUp, Map, Upload, KeyRound, Book, MapPin } from 'lucide-react';

export const allMenuItems = [
    {
      label: 'Dashboard & Analytics',
      icon: LayoutDashboard,
      roles: ['Admin'],
      items: [
        { href: '/admin/dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
        { href: '/admin/dashboard/enrollment', label: 'Enrollment Statistics', icon: Users2 },
        { href: '/admin/dashboard/defaulters', label: 'Defaulter Analysis', icon: UserX },
        { href: '/admin/dashboard/attendance', label: 'Attendance Monitoring', icon: CheckCircle2 },
        { href: '/admin/dashboard/risk-alerts', label: 'Academic Risk Alerts', icon: AlertTriangle },
        { href: '/admin/dashboard/financial-kpis', label: 'Financial KPIs', icon: DollarSign },
        { href: '/admin/dashboard/dropout-trends', label: 'Dropout Trends', icon: TrendingDown },
      ]
    },
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
        { href: '/admin/academics/room-scheduling', label: 'Room Scheduling', icon: Building },
        { href: '/admin/academics/lecturer-allocation', label: 'Lecturer Allocation', icon: UserPlus },
        { href: '/admin/academics/teaching-load', label: 'Teaching Load Balance', icon: Scale },
        { href: '/admin/academics/assessment-setup', label: 'Continous Assessment Setup', icon: ClipboardEdit },
        { href: '/admin/academics/final-exam-setup', label: 'Final Exam Setup', icon: PenSquare },
        { href: '/admin/academics/curriculum-mapping', label: 'Curriculum Mapping', icon: Map },
        { href: '/admin/academics/policies', label: 'Academic Policies Upload', icon: FileUp },
      ]
    },
     {
      label: 'Exams & Results',
      icon: PenSquare,
      roles: ['Admin'],
      items: [
        { href: '/admin/exams/ca-entry', label: 'CA Entry', icon: ClipboardEdit },
        { href: '/admin/exams/final-exam-entry', label: 'Final Exam Entry', icon: PenSquare },
        { href: '/admin/exams/grading-setup', label: 'Grading Setup', icon: SlidersHorizontal },
        { href: '/admin/exams/grade-approval', label: 'Grade Approval', icon: CheckCircle2 },
        { href: '/admin/exams/transcript-generation', label: 'Transcript Generation', icon: FileText },
        { href: '/admin/exams/certificate-printing', label: 'Certificate Printing', icon: Newspaper },
        { href: '/admin/exams/result-publishing', label: 'Result Publishing', icon: Upload },
        { href: '/admin/exams/student-appeals', label: 'Student Appeals Tracking', icon: Search },
      ]
    },
    {
        label: 'Clinicals',
        icon: Stethoscope,
        roles: ['Admin'],
        items: [
            { href: '/admin/clinicals/rotation-planning', label: 'Rotation Planning', icon: GitBranch },
            { href: '/admin/clinicals/preceptor-login', label: 'Preceptor Login', icon: User },
            { href: '/admin/clinicals/ward-logbooks', label: 'Ward Logbooks', icon: Book },
            { href: '/admin/clinicals/community-placement', label: 'Community Placement', icon: MapPin },
            { href: '/admin/clinicals/feedback-forms', label: 'Feedback Forms', icon: MessageSquare },
            { href: '/admin/clinicals/evaluation-reports', label: 'Evaluation Reports', icon: FileText },
            { href: '/admin/clinicals/clinical-assessment', label: 'Clinical Assessment Reports', icon: ClipboardEdit },
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
        label: 'Student Life',
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
        label: 'Parents',
        icon: Users,
        roles: ['Admin'],
        items: []
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
        label: 'Admin',
        icon: Shield,
        roles: ['Admin'],
        items: [
            { href: '/admin/users', label: 'User Management', icon: Users },
            { href: '/admin/settings', label: 'System Settings', icon: Settings },
        ]
    },
    {
        label: 'Integrations',
        icon: Link,
        roles: ['Admin'],
        items: []
    },
     {
        label: 'AI Modules',
        icon: Beaker,
        roles: ['Admin'],
        items: []
    },
     {
        label: '(Clinicals, Practicums & Internships)',
        icon: Stethoscope,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Research & Innovation',
        icon: Telescope,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Community Engagement',
        icon: Handshake,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Quality Assurance',
        icon: Check,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Legal & Compliance',
        icon: GitBranch,
        roles: ['Admin'],
        items: []
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
        label: 'Partnerships',
        icon: Handshake,
        roles: ['Admin'],
        items: []
    },
     {
        label: 'Mentorship & Advising',
        icon: UserCheckIcon,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Media & PR',
        icon: Newspaper,
        roles: ['Admin'],
        items: []
    },
    {
        label: 'Chaplaincy & Spiritual Life',
        icon: Heart,
        roles: ['Admin'],
        items: []
    },
];

export const staffBaseMenuItems = [
    { href: '/staff/courses', label: 'My Courses', icon: Library, roles: [] },
    { href: '/staff/leave-approvals', label: 'Student Absences', icon: UserCheckIcon, roles: ['Lecturer'] },
    { href: '/staff/timetable', label: 'My Timetable', icon: Calendar, roles: [] },
    { href: '/staff/leave', label: 'My Leave', icon: Calendar, roles: [] },
    { href: '/staff/calendar', label: 'Academic Calendar', icon: Calendar, roles: [] },
    { href: '/staff/library', label: 'Library', icon: Library, roles: [] },
];

export const studentMenuItems = [
    { href: '/student/classes', label: 'My Classes', icon: Library, roles: [] },
    { href: '/student/registration', label: 'Registration', icon: UserCheckIcon, roles: [] },
    { href: '/student/payments', label: 'Payments & Invoices', icon: DollarSign, roles: [] },
    { href: '/student/attendance', label: 'My Attendance', icon: Hand, roles: [] },
    { href: '/student/timetable', label: 'My Timetable', icon: Calendar, roles: [] },
    { href: '/student/library', label: 'Library', icon: BookUp, roles: [] },
    { href: '/student/leave', label: 'Request Absence', icon: Calendar, roles: [] },
    { href: '/student/resources', label: 'Resources', icon: FileText, roles: [] },
  ];
