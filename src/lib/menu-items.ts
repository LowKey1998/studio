
import { LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck as UserCheckIcon, BookUp, Users, Wallet, GanttChart, Building, Hand, Route, MessageSquare, ClipboardCheck, ClipboardEdit, HandCoins, Stethoscope, MonitorPlay, Heart, Bus, Handshake, Search, GitBranch, Shield, LandPlot, Users2, Star, Newspaper, GraduationCap, BookCopy, BookOpenCheck, Beaker, Telescope, Truck, Link, UserCog, Check, AlertTriangle, TrendingDown, UserX, CheckCircle2, SlidersHorizontal, UserPlus, Scale, FileUp, Map, Upload, KeyRound, Book, MapPin, Video, FileQuestion, RefreshCw, TrendingUp, Banknote, ShieldAlert, HeartPulse, Home, Barcode, BookMarked, Briefcase, Puzzle, Smartphone, GalleryVertical, Wrench, ClipboardList, Sparkles, Lightbulb, Mail, Target, Filter, FileSignature, Send, LineChart, Clock } from 'lucide-react';

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
        { href: '/admin/admissions/add-student', label: 'Add Student', icon: UserPlus },
        { href: '/admin/admissions/students', label: 'Students List', icon: Users },
        { href: '/admin/approve-registrations', label: 'Approve Registrations', icon: BookOpenCheck },
        { href: '/admin/admissions/document-uploads', label: 'Document Uploads', icon: FileUp },
        { href: '/admin/admissions/interview-scheduling', label: 'Interview Scheduling', icon: Calendar },
        { href: '/admin/admissions/scoring', label: 'Scoring & Results', icon: BarChart2, isComingSoon: true },
        { href: '/admin/admissions/offer-letters', label: 'Offer Letters', icon: FileSignature, isComingSoon: true },
        { href: '/admin/admissions/confirmation', label: 'Admission Confirmation', icon: CheckCircle2, isComingSoon: true },
        { href: '/admin/admissions/notifications', label: 'SMS/Email Notifications', icon: Mail },
        { href: '/admin/admissions/analytics', label: 'Admission Funnel Analytics', icon: LineChart },
        { href: '/admin/admissions/leads', label: 'Leads Capture', icon: Users },
        { href: '/admin/admissions/lead-scoring', label: 'Lead Scoring', icon: Star, isComingSoon: true },
        { href: '/admin/admissions/campaigns', label: 'Campaign Tracking', icon: Target, isComingSoon: true },
        { href: '/admin/admissions/agents', label: 'Agent Management', icon: Briefcase, isComingSoon: true },
        { href: '/admin/admissions/bulk-import', label: 'Bulk Import/Export', icon: Upload, isComingSoon: true },
        { href: '/admin/admissions/follow-ups', label: 'Automated Follow-Ups', icon: Send, isComingSoon: true },
      ]
    },
    {
      label: 'Academics',
      icon: GraduationCap,
      roles: ['Admin', 'Registrar'],
      items: [
        { href: '/admin/academics/semester-management', label: 'Semester Management', icon: Calendar },
        { href: '/admin/registration-management', label: 'Registration Management', icon: Settings },
        { href: '/admin/programmes', label: 'Programmes', icon: GanttChart },
        { href: '/admin/courses', label: 'Create/View Course', icon: BookCopy },
        { href: '/admin/course-paths', label: 'Intakes / Course Paths', icon: Route },
        { href: '/admin/timetable', label: 'Timetable', icon: Clock },
        { href: '/admin/calendar', label: 'Academic Calendar', icon: Calendar },
        { href: '/admin/academics/room-scheduling', label: 'Room Scheduling', icon: Building, isComingSoon: true },
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
        { href: '/admin/exams/transcript-generation', label: 'Transcript Generation', icon: FileText, isComingSoon: true },
        { href: '/admin/exams/certificate-printing', label: 'Certificate Printing', icon: Newspaper, isComingSoon: true },
        { href: '/admin/exams/result-publishing', label: 'Result Publishing', icon: Upload },
        { href: '/admin/exams/student-appeals', label: 'Student Appeals Tracking', icon: Search },
      ]
    },
    {
        label: 'Clinicals',
        icon: Stethoscope,
        roles: ['Admin'],
        isComingSoon: true,
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
        { href: '/admin/finance/mobile-money', label: 'Mobile Money Integration', icon: Link, isComingSoon: true },
        { href: '/admin/finance/reconciliation', label: 'Bank Reconciliation', icon: RefreshCw, isComingSoon: true },
        { href: '/admin/finance/scholarships', label: 'Scholarship Management', icon: GraduationCap },
        { href: '/admin/finance/reporting', label: 'Finance Reporting', icon: FileText, isComingSoon: true },
        { href: '/admin/finance/expenses', label: 'Expense Tracking', icon: TrendingDown },
        { href: '/admin/fees', label: 'Fees & Invoicing', icon: HandCoins },
        { href: '/admin/finance/receivables', label: 'Receivables', icon: TrendingUp },
        { href: '/admin/finance/payables', label: 'Payables', icon: TrendingDown },
        { href: '/admin/finance/ledger', label: 'General Ledger', icon: Book },
        { href: '/admin/finance/budgeting', label: 'Budget Forecasting', icon: Telescope },
        { href: '/admin/finance/donors', label: 'Donor Fund Tracking', icon: Heart },
        { href: '/admin/finance/bank-integration', label: 'Bank API Integration', icon: Banknote, isComingSoon: true },
      ]
    },
    {
        label: 'Student Life',
        icon: Users2,
        roles: ['Admin'],
        items: [
            { href: '/admin/student-life/hostel-allocation', label: 'Hostel Allocation', icon: Home },
            { href: '/admin/student-life/medical-deferrals', label: 'Medical Deferrals', icon: Stethoscope },
            { href: '/admin/student-life/leave-of-Absence', label: 'Leave of Absence', icon: Calendar },
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
        isComingSoon: true,
    },
    {
      label: 'HR',
      icon: UserCog,
      roles: ['Admin', 'HR'],
      items: [
           { href: '/admin/hr/add-staff', label: 'Add Staff', icon: UserPlus },
           { href: '/admin/hr/salaries', label: 'Salaries', icon: DollarSign },
           { href: '/admin/hr/payroll', label: 'Payroll Processing', icon: Wallet },
           { href: '/admin/leave-approvals', label: 'Leave Approvals', icon: UserCheckIcon },
           { href: '/admin/vacancies', label: 'Vacancies', icon: Briefcase },
           { href: '/admin/hr/interview-selection', label: 'Interview & Selection', icon: Users2 },
           { href: '/admin/hr/onboarding', label: 'Digital Onboarding', icon: UserPlus },
           { href: '/admin/hr/probation-tracking', label: 'Probation Tracking', icon: Clock },
           { href: '/admin/hr/training', label: 'Training Logs', icon: Book },
           { href: '/admin/hr/performance', label: 'Performance Appraisal', icon: Star },
           { href: '/admin/hr/allocation', label: 'Staff Allocation', icon: Users2 },
           { href: '/admin/hr/contracts', label: 'Staff Contracts', icon: FileText, isComingSoon: true },
      ]
  },
    {
        label: 'Research & Innovation',
        icon: Telescope,
        roles: ['Admin'],
        isComingSoon: true,
    },
    {
        label: 'Innovation',
        icon: Lightbulb,
        roles: ['Admin'],
        isComingSoon: true,
    },
    {
        label: 'Community Engagement',
        icon: Handshake,
        roles: ['Admin'],
        isComingSoon: true,
    },
    {
      label: 'Quality Assurance',
      icon: Check,
      roles: ['Admin'],
      isComingSoon: true,
    },
    {
      label: 'Legal & Compliance',
      icon: GitBranch,
      roles: ['Admin'],
      isComingSoon: true,
    },
    {
      label: 'Facilities & Estates',
      icon: Building,
      roles: ['Admin'],
      isComingSoon: true,
    },
    {
        label: 'Transport',
        icon: Truck,
        roles: ['Admin'],
        isComingSoon: true,
    },
     {
        label: 'Partnerships',
        icon: Handshake,
        roles: ['Admin'],
        isComingSoon: true,
    },
     {
        label: 'Mentorship & Advising',
        icon: UserCheckIcon,
        roles: ['Admin'],
        items: [
            { href: '/admin/mentorship/assignments', label: 'Advisor Assignments', icon: Users2 },
            { href: '/admin/mentorship/logs', label: 'Mentorship Logs', icon: Book },
            { href: '/admin/mentorship/reports', label: 'Advisory Reports', icon: FileText, isComingSoon: true },
        ]
    },
    {
        label: 'Media & PR',
        icon: Newspaper,
        roles: ['Admin'],
        isComingSoon: true,
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
        isComingSoon: true,
    },
     {
        label: 'Admin',
        icon: Shield,
        roles: ['Admin'],
        items: [
            { href: '/admin/users', label: 'User Management', icon: Users },
            { href: '/admin/settings', label: 'System Settings', icon: Settings },
            { href: '/admin/access-rules', label: 'Access Rules', icon: KeyRound },
        ]
    },
];

export const studentMenuItems = [
    {
        label: 'Academics',
        icon: GraduationCap,
        items: [
            { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/student/courses', label: 'My Classes', icon: BookCopy },
            { href: '/student/course-path', label: 'My Course Path', icon: Route },
            { href: '/student/registration', label: 'Registration', icon: UserCheckIcon },
            { href: '/student/timetable', label: 'My Timetable', icon: Calendar },
            { href: '/student/attendance', label: 'My Attendance', icon: Hand },
            { href: '/student/leave', label: 'Request Absence', icon: Calendar },
            { href: '/student/calendar', label: 'Academic Calendar', icon: Calendar },
            { href: '/student/resources', label: 'Resources', icon: FileText },
            { href: '/student/courses/results', label: 'My Results', icon: ClipboardCheck },
        ]
    },
    {
        label: 'eLearning',
        icon: MonitorPlay,
        items: [
            { href: '/student/quizzes', label: 'Quizzes & Exams', icon: FileQuestion },
        ]
    },
    {
        label: 'Finances',
        icon: DollarSign,
        items: [
             { href: '/student/payments', label: 'Payments & Invoices', icon: Wallet },
        ]
    },
    {
        label: 'Campus Life',
        icon: Building,
        items: [
            { href: '/student/library', label: 'Library', icon: BookUp },
            { href: '/student/student-life/clubs', label: 'Clubs & Associations', icon: Users },
            { href: '/vacancies', label: 'Job Vacancies', icon: Briefcase },
        ]
    },
     {
        label: 'Innovation',
        icon: Lightbulb,
        items: [
            { href: '/student/innovation/idea-board', label: 'Idea Board', icon: Newspaper },
            { href: '/student/innovation/my-projects', label: 'My Projects', icon: Briefcase },
            { href: '/admin/innovation/collaboration-portal', label: 'Collaboration Portal', icon: Users },
        ]
    },
    {
        label: 'Spiritual Life',
        icon: Heart,
        items: [
            { href: '/student/chaplaincy/prayer-requests', label: 'Prayer Requests', icon: Heart },
            { href: '/admin/chaplaincy/spiritual-events', label: 'Spiritual Events', icon: Calendar },
        ]
    }
  ];

export const staffBaseMenuItems = [
    {
      label: 'Academics',
      icon: GraduationCap,
      items: [
        { href: '/staff/courses', label: 'My Courses', permission: 'Lecturer' },
        { href: '/staff/student-absences', label: 'Student Absences', permission: 'Lecturer' },
        { href: '/staff/timetable', label: 'My Timetable', permission: 'Lecturer' },
      ],
    },
    {
      label: 'Leave & Timetable',
      icon: Calendar,
      items: [
        { href: '/staff/leave', label: 'My Leave' },
        { href: '/staff/calendar', label: 'Academic Calendar' },
      ]
    },
     {
      label: 'HR',
      icon: UserCog,
      items: [
           { href: '/staff/onboarding', label: 'My Onboarding' },
           { href: '/staff/payroll', label: 'Payroll', permission: 'Accountant' },
      ]
  },
    {
      label: 'General',
      icon: Settings,
      items: [
        { href: '/staff/library', label: 'Library' },
        { href: '/staff/profile', label: 'My Profile' },
      ]
    }
  ];
