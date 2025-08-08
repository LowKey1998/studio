

import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck as UserCheckIcon, BookUp, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardEdit, HandCoins, Stethoscope, MonitorPlay, Heart, Bus, Handshake, Search, GitBranch, Shield, LandPlot, Users2, Star, Newspaper, GraduationCap, BookCopy, BookOpenCheck, Beaker, Telescope, Truck, Link, UserCog, Check, AlertTriangle, TrendingDown, UserX, CheckCircle2, SlidersHorizontal, UserPlus, Scale, FileUp, Map, Upload, KeyRound, Book, MapPin, Video, FileQuestion, RefreshCw, TrendingUp, Banknote, ShieldAlert, HeartPulse, Home, Barcode, Briefcase, Puzzle, Smartphone, GalleryVertical, Wrench, ClipboardList, Sparkles, Lightbulb } from 'lucide-react';

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
        { href: '/admin/payments', label: 'Student Invoicing', icon: FileText },
        { href: '/admin/payment-plans', label: 'Installment Plans', icon: Wallet },
        { href: '/admin/finance/defaulters', label: 'Defaulter Management', icon: UserX },
        { href: '/admin/finance/mobile-money', label: 'Mobile Money Integration', icon: Link },
        { href: '/admin/finance/reconciliation', label: 'Bank Reconciliation', icon: RefreshCw },
        { href: '/admin/finance/scholarships', label: 'Scholarship Disbursement', icon: GraduationCap },
        { href: '/admin/finance/reporting', label: 'Finance Reporting', icon: FileText },
        { href: '/admin/finance/expenses', label: 'Expense Tracking', icon: TrendingDown },
        { href: '/admin/fees', label: 'Fees & Invoicing', icon: HandCoins },
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
         { href: '/admin/library/statistics', label: 'Statistics', icon: BarChart2 },
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
             { href: '/admin/vacancies', label: 'Vacancies', icon: Briefcase },
             { href: '/admin/hr/onboarding', label: 'Digital Onboarding', icon: UserPlus },
             { href: '/admin/hr/payroll', label: 'Payroll Processing', icon: Wallet },
             { href: '/admin/hr/training', label: 'Training Logs', icon: Book },
             { href: '/admin/hr/performance', label: 'Performance Appraisal', icon: Star },
             { href: '/admin/hr/allocation', label: 'Staff Allocation', icon: Users2 },
        ]
    },
    {
        label: 'Research & Innovation',
        icon: Telescope,
        roles: ['Admin'],
        items: [
            { href: '/admin/research/registration', label: 'Research Project Registration', icon: FileText },
            { href: '/admin/research/supervisor-allocation', label: 'Supervisor Allocation', icon: Users2 },
            { href: '/admin/research/proposal-submission', label: 'Proposal Submission Workflow', icon: GitBranch },
            { href: '/admin/research/ethics-reviews', label: 'Ethics Committee Reviews', icon: Shield },
            { href: '/admin/research/budget-tracking', label: 'Research Budget Tracking', icon: DollarSign },
            { href: '/admin/research/calendar', label: 'Research Calendar', icon: Calendar },
            { href: '/admin/research/publications', label: 'Publication Repository', icon: Library },
            { href: '/admin/research/progress-reports', label: 'Research Progress Reports', icon: BarChart2 },
            { href: '/admin/research/conferences', label: 'Conference Participation Records', icon: Calendar },
            { href: '/admin/research/grants', label: 'Grant Applications Management', icon: FileText },
            { href: '/admin/research/showcase', label: 'Innovation Showcase Submissions', icon: Star },
            { href: '/admin/research/analytics', label: 'Research Output Analytics', icon: BarChart2 },
        ]
    },
    {
        label: 'Innovation',
        icon: Lightbulb,
        roles: ['Admin'],
        items: [
            { href: '/admin/innovation/project-submissions', label: 'Innovation Project Submissions', icon: FileUp },
            { href: '/admin/innovation/prototype-showcase', label: 'Prototype Showcase', icon: GalleryVertical },
            { href: '/admin/innovation/incubator-access', label: 'Innovation Incubator Access', icon: KeyRound },
            { href: '/admin/innovation/mentorship-matching', label: 'Mentorship Matching', icon: UserCheckIcon },
            { href: '/admin/innovation/evaluation-committee', label: 'Innovation Evaluation Committee', icon: Users2 },
            { href: '/admin/innovation/pitch-deck-repository', label: 'Pitch Deck Repository', icon: FileText },
            { href: '/admin/innovation/ip-tracker', label: 'Intellectual Property Registration Tracker', icon: Shield },
            { href: '/admin/innovation/events-calendar', label: 'Innovation Events Calendar', icon: Calendar },
            { href: '/admin/innovation/investor-matching', label: 'Investor Matching Tools', icon: Handshake },
            { href: '/admin/innovation/hackathon-logs', label: 'Hackathon Participation Logs', icon: Book },
            { href: '/admin/innovation/idea-board', label: 'Startup Idea Board', icon: Newspaper },
            { href: '/admin/innovation/collaboration-portal', label: 'Collaboration & Team Building Portal', icon: Users },
        ]
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
        items: [
            { href: '/admin/qa/audit-reports', label: 'Internal Audit Reports', icon: FileText },
            { href: '/admin/qa/accreditation', label: 'Accreditation Tracker', icon: Check },
            { href: '/admin/qa/kpi-dashboard', label: 'KPI Dashboard', icon: BarChart2 },
            { href: '/admin/qa/course-eval', label: 'Course Evaluation', icon: MessageSquare },
        ]
    },
    {
        label: 'Legal & Compliance',
        icon: GitBranch,
        roles: ['Admin'],
        items: [
            { href: '/admin/legal/case-management', label: 'Case Management', icon: Briefcase },
            { href: '/admin/legal/contract-repository', label: 'Contract Repository', icon: FileText },
            { href: '/admin/legal/disciplinary-logs', label: 'Student Disciplinary Logs', icon: UserX },
            { href: '/admin/legal/policy-uploads', label: 'Policy Uploads', icon: FileUp },
        ]
    },
     {
        label: 'Facilities & Estates',
        icon: Building,
        roles: ['Admin'],
        items: [
            { href: '/admin/facilities/maintenance', label: 'Maintenance Requests', icon: Wrench },
            { href: '/admin/facilities/assets', label: 'Classroom &amp; Lab Assets', icon: ClipboardList },
            { href: '/admin/facilities/cleaning', label: 'Cleaning Logs', icon: Sparkles },
            { href: '/admin/facilities/utilities', label: 'ZESCO &amp; Water Reports', icon: FileText },
        ]
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
        items: [
            { href: '/admin/mentorship/assignments', label: 'Advisor Assignments', icon: Users2 },
            { href: '/admin/mentorship/logs', label: 'Mentorship Logs', icon: Book },
            { href: '/admin/mentorship/reports', label: 'Advisory Reports', icon: FileText },
        ]
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
        items: [
            { href: '/admin/chaplaincy/prayer-requests', label: 'Prayer Requests', icon: Heart },
            { href: '/admin/chaplaincy/spiritual-events', label: 'Spiritual Events', icon: Calendar },
            { href: '/admin/chaplaincy/chaplain-logs', label: 'Chaplain Logs', icon: Book },
        ]
    },
    {
        label: 'Add-ons',
        icon: Puzzle,
        roles: ['Admin'],
        items: [
            { href: '/admin/addons/alumni', label: 'EduConnect360-Alumni', icon: Users2 },
            { href: '/admin/addons/portal', label: 'Job &amp; Internal Portal', icon: Briefcase },
            { href: '/admin/addons/multi-campus', label: 'Multi-Campus Managment', icon: Building },
            { href: '/admin/addons/quickbooks', label: 'Quickbooks Integration', icon: Link },
            { href: '/admin/addons/sage', label: 'Sage Integration', icon: Link },
            { href: '/admin/addons/mobile-app', label: 'Edutrack360 Mobile App', icon: Smartphone },
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
    { href: '/student/payments', label: 'Payments &amp; Invoices', icon: DollarSign, roles: [] },
    { href: '/student/attendance', label: 'My Attendance', icon: Hand, roles: [] },
    { href: '/student/timetable', label: 'My Timetable', icon: Calendar, roles: [] },
    { href: '/student/library', label: 'Library', icon: BookUp, roles: [] },
    { href: '/student/leave', label: 'Request Absence', icon: Calendar, roles: [] },
    { href: '/student/resources', label: 'Resources', icon: FileText, roles: [] },
  ];
