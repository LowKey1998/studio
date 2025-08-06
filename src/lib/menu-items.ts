

import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck as UserCheckIcon, BookUp, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardEdit, HandCoins, Stethoscope, MonitorPlay, Heart, Bus, Handshake, Search, GitBranch, Shield, LandPlot, Users2, Star, Newspaper, GraduationCap, BookCopy, BookOpenCheck, Beaker, Telescope, Truck, Link, UserCog, Check, AlertTriangle, TrendingDown, UserX, CheckCircle2, SlidersHorizontal, UserPlus, Scale, FileUp, Map, Upload, KeyRound, Book, MapPin, Video, FileQuestion, RefreshCw, TrendingUp, Banknote, ShieldAlert, HeartPulse, Home, Barcode } from 'lucide-react';

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
      items: [
        { href: '/admin/e-learning/pdf-upload', label: 'PDF Upload', icon: FileUp },
        { href: '/admin/e-learning/video-lectures', label: 'Video Lectures', icon: Video },
        { href: '/admin/e-learning/powerpoint-slides', label: 'PowerPoint Slides', icon: FileText },
        { href: '/admin/e-learning/online-quizzes', label: 'Online Quizzes', icon: FileQuestion },
        { href: '/admin/e-learning/assignments-upload', label: 'Assignments Upload', icon: Upload },
        { href: '/admin/e-learning/discussion-forums', label: 'Discussion Forums', icon: MessageSquare },
        { href: '/admin/e-learning/scorm-integration', label: 'SCORM Tools Integration', icon: GitBranch },
        { href: '/admin/e-learning/moodle-sync', label: 'Moodle Synchronization', icon: RefreshCw },
      ]
    },
    {
      label: 'Finance',
      icon: Wallet,
      roles: ['Admin', 'Accountant'],
      items: [
        { href: '/admin/payments', label: 'Student Payments', icon: FileText },
        { href: '/admin/payment-plans', label: 'Installment Plans', icon: Wallet },
        { href: '/admin/finance/defaulters', label: 'Defaulter Management', icon: UserX },
        { href: '/admin/finance/mobile-money', label: 'Mobile Money Integration', icon: Link },
        { href: '/admin/finance/reconciliation', label: 'Bank Reconciliation', icon: RefreshCw },
        { href: '/admin/finance/scholarships', label: 'Scholarship Disbursement', icon: GraduationCap },
        { href: '/admin/finance/reporting', label: 'Finance Reporting', icon: FileText },
        { href: '/admin/finance/expenses', label: 'Expense Tracking', icon: TrendingDown },
        { href: '/admin/fees', label: 'Fees Setup', icon: HandCoins },
        { href: '/admin/finance/receivables', label: 'Receivables', icon: TrendingUp },
        { href: '/admin/finance/payables', label: 'Payables', icon: TrendingDown },
        { href: '/admin/finance/ledger', label: 'General Ledger', icon: Book },
        { href: '/admin/cashflow', label: 'Cash Flow Analysis', icon: BarChart2 },
        { href: '/admin/finance/budgeting', label: 'Budget Forecasting', icon: Telescope },
        { href: '/admin/finance/donors', label: 'Donor Fund Tracking', icon: Heart },
        { href: '/admin/finance/bank-integration', label: 'Bank API Integration', icon: Banknote },
      ]
    },
    {
        label: 'Student Life',
        icon: Users2,
        roles: ['Admin'],
        items: [
            { href: '/admin/student-life/hostel-allocation', label: 'Hostel Allocation', icon: Home },
            { href: '/admin/student-life/medical-deferrals', label: 'Medical Deferrals', icon: Stethoscope },
            { href: '/admin/student-life/leave-of-absence', label: 'Leave of Absence', icon: Calendar },
            { href: '/admin/student-life/complaints', label: 'Complaint Submissions', icon: ShieldAlert },
            { href: '/admin/student-life/events', label: 'Event Calendar', icon: Calendar },
            { href: '/admin/student-life/clubs', label: 'Clubs & Associations', icon: Users },
            { href: '/admin/student-life/mental-health', label: 'Mental Health Logs', icon: HeartPulse },
            { href: '/admin/student-life/welfare-reports', label: 'Welfare Reports', icon: FileText },
        ]
    },
    {
      label: 'Library',
      icon: Library,
      roles: ['Admin', 'Librarian'],
      items: [
         { href: '/admin/library', label: 'Book Listing', icon: Library },
         { href: '/admin/book-requests', label: 'Book Requests', icon: BookUp },
         { href: '/admin/library/late-alerts', label: 'Late Alerts', icon: AlertTriangle },
         { href: '/admin/library/barcode-scanner', label: 'Barcode Scanner', icon: Barcode },
         { href: '/admin/library/statistics', label: 'Library Statistics', icon: BarChart2 },
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
             { href: '/admin/hr/onboarding', label: 'Digital Onboarding', icon: UserPlus },
             { href: '/admin/hr/payroll', label: 'Payroll Processing', icon: Wallet },
             { href: '/admin/hr/training', label: 'Training Logs', icon: Book },
             { href: '/admin/hr/performance', label: 'Performance Appraisal', icon: Star },
             { href: '/admin/hr/allocation', label: 'Staff Allocation', icon: Users2 },
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
        items: [
            { href: '/admin/integrations/momo', label: 'MoMo/Airtel Payment API', icon: Wallet },
            { href: '/admin/integrations/paystack', label: 'Paystack API', icon: Wallet },
            { href: '/admin/integrations/whatsapp', label: 'Whatsapp Messaging', icon: MessageSquare },
            { href: '/admin/integrations/sms', label: 'SMS API', icon: MessageSquare },
            { href: '/admin/integrations/biometric', label: 'Biometric Attendance', icon: Hand },
            { href: '/admin/integrations/teveta', label: 'TEVETA XML Export', icon: FileUp },
            { href: '/admin/integrations/compliance', label: 'Compliance Upload', icon: Shield },
        ]
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




