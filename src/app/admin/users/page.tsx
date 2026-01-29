
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, MoreVertical, Search, Loader2, UserX, UserCheck, Trash2, Pencil, Copy, Download, Send, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ref, set, runTransaction, get, child, push, serverTimestamp, update, onValue, remove, query, orderByChild, equalTo } from 'firebase/database';
import { app, auth, db, createNotification } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { initializeApp, deleteApp } from 'firebase/app';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { onAuthStateChanged } from 'firebase/auth';
import { updateUserStatus } from '@/ai/flows/update-user-status';
import { cn } from '@/lib/utils';
import { allMenuItems, staffBaseMenuItems, studentMenuItems } from '@/lib/menu-items';
import { Textarea } from '@/components/ui/textarea';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { DialogTrigger } from '@radix-ui/react-dialog';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { useAuth } from '@/hooks/use-auth';

type User = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    subRoles?: string[]; // This will now hold IDs
    subRoleNames?: string[]; // For display
    programmeId?: string;
    programmeName?: string;
    year?: number;
    semesterId?: string;
    exemptedCourses?: Record<string, boolean>;
    status?: 'active' | 'disabled';
    intakeId?: string;
    dob?: string;
    gender?: string;
    nationalId?: string;
    passport?: string;
    address?: string;
    guardian?: { name: string; contact: string; };
    emergencyContact?: { name: string; relationship: string; contact: string; };
    educationBackground?: { school: string; qualifications: string; };
    medicalHistory?: string;
    baseSalary?: number;
    isOnline?: boolean;
    lastSeen?: number;
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};

type Semester = {
    id: string;
    name: string;
    status: string;
    year: number;
    semesterInYear: number;
};

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
}

type CurrentAdmin = {
    name: string;
    id: string;
}

type Intake = {
    id: string;
    name: string;
}

type SubRole = {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
}

const roleVariant: { [key: string]: 'default' | 'secondary' | 'outline' } = {
  Admin: 'default',
  Staff: 'secondary',
  Student: 'outline',
};

export default function UserManagementPage() {
    const { user: adminUser, userProfile: adminProfile } = useAuth();
    const [open, setOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [users, setUsers] = React.useState<User[]>([]);
    
    // State for creating a user
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [role, setRole] = React.useState('');
    const [subRoleIds, setSubRoleIds] = React.useState<string[]>([]);
    const [programme, setProgramme] = React.useState('');
    const [isTransfer, setIsTransfer] = React.useState(false);
    const [exemptedCourses, setExemptedCourses] = React.useState<Record<string, boolean>>({});
    const [manualId, setManualId] = React.useState('');
    const [isManualId, setIsManualId] = React.useState(false);
    
    const [dob, setDob] = React.useState('');
    const [gender, setGender] = React.useState('');
    const [nationalId, setNationalId] = React.useState('');
    const [passport, setPassport] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [guardianName, setGuardianName] = React.useState('');
    const [guardianContact, setGuardianContact] = React.useState('');
    const [emergencyName, setEmergencyName] = React.useState('');
    const [emergencyRelationship, setEmergencyRelationship] = React.useState('');
    const [emergencyContact, setEmergencyContact] = React.useState('');
    const [previousSchool, setPreviousSchool] = React.useState('');
    const [qualifications, setQualifications] = React.useState('');
    const [medicalHistory, setMedicalHistory] = React.useState('');

    // Cascading Dropdown State
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState('');
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [availableYears, setAvailableYears] = React.useState<number[]>([]);
    const [availableSemesters, setAvailableSemesters] = React.useState<Semester[]>([]);

    // State for editing a user
    const [editingUser, setEditingUser] = React.useState<User | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editRole, setEditRole] = React.useState('');
    const [editSubRoleIds, setEditSubRoleIds] = React.useState<string[]>([]);
    const [editProgramme, setEditProgramme] = React.useState('');
    const [editIntake, setEditIntake] = React.useState('');
    
    // Data for dialogs
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [availableSubRoles, setAvailableSubRoles] = React.useState<SubRole[]>([]);
    const [idSettings, setIdSettings] = React.useState<any>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });


    // State for filtering and searching
    const [searchQuery, setSearchQuery] = React.useState('');
    const [roleFilter, setRoleFilter] = React.useState('All');
    
    // Messaging dialog
    const [isMessageOpen, setIsMessageOpen] = React.useState(false);
    const [messagingUser, setMessagingUser] = React.useState<User | null>(null);
    const [messageSubject, setMessageSubject] = React.useState('');
    const [messageBody, setMessageBody] = React.useState('');
    const [sendingMessage, setSendingMessage] = React.useState(false);
    
    // Bulk email dialog
    const [isBulkEmailOpen, setIsBulkEmailOpen] = React.useState(false);
    const [bulkEmailSubject, setBulkEmailSubject] = React.useState('');
    const [bulkEmailBody, setBulkEmailBody] = React.useState('');
    const [sendingBulkEmail, setSendingBulkEmail] = React.useState(false);


    const [loading, setLoading] = React.useState(false);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    // Fetches all static data and sets up listeners
    React.useEffect(() => {
        setTableLoading(true);

        const refs = {
            users: ref(db, 'users'),
            programmes: ref(db, 'programmes'),
            courses: ref(db, 'courses'),
            intakes: ref(db, 'intakes'),
            subRoles: ref(db, 'settings/subRoles'),
            idPrefixes: ref(db, 'settings/idPrefixes'),
            semesters: ref(db, 'semesters')
        };

        const dataCache = {
            users: {},
            programmes: {},
            subRoles: {}
        };

        const processAndSetUsers = () => {
            const usersData = dataCache.users as Record<string, any>;
            const programmesData = dataCache.programmes as Record<string, any>;
            const subRolesData = dataCache.subRoles as Record<string, any>;

            const subRolesMap = new Map(Object.entries(subRolesData).map(([id, role]: [string, any]) => [id, role.name]));

            const usersList: User[] = Object.keys(usersData).map(uid => {
                const user = usersData[uid];
                const userSubRoleIds = user.subRoles ? (Array.isArray(user.subRoles) ? user.subRoles : Object.values(user.subRoles)) : [];
                const subRoleNames = userSubRoleIds.map((id: string) => subRolesMap.get(id)).filter(Boolean);

                return {
                    uid,
                    ...user,
                    status: user.status || 'active',
                    programmeName: user.programmeId ? programmesData[user.programmeId]?.name : undefined,
                    subRoles: userSubRoleIds,
                    subRoleNames: subRoleNames
                };
            });
            setUsers(usersList);
            setTableLoading(false);
        };
        
        const unsubscribers = [
            onValue(refs.users, (snapshot) => { dataCache.users = snapshot.val() || {}; processAndSetUsers(); }),
            onValue(refs.programmes, (snapshot) => { dataCache.programmes = snapshot.val() || {}; setAllProgrammes(Object.keys(dataCache.programmes).map(id => ({ id, ...dataCache.programmes[id] }))); processAndSetUsers(); }),
            onValue(refs.subRoles, (snapshot) => { dataCache.subRoles = snapshot.val() || {}; setAvailableSubRoles(Object.keys(dataCache.subRoles).map(id => ({id, ...dataCache.subRoles[id]}))); processAndSetUsers(); }),
            onValue(refs.courses, (snapshot) => setAllCourses(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : [])),
            onValue(refs.intakes, (snapshot) => setAllIntakes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : [])),
            onValue(refs.semesters, (snapshot) => setAllSemesters(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : [])),
            onValue(refs.idPrefixes, (snapshot) => setIdSettings(snapshot.exists() ? snapshot.val() : { student: 'STU', staff: 'STF', admin: 'ADM' })),
        ];

        return () => unsubscribers.forEach(unsub => unsub());

    }, []);

    const resetForm = () => {
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setRole(''); setSubRoleIds([]); setProgramme(''); setIsTransfer(false); setExemptedCourses({});
        setManualId(''); setIsManualId(false);
        setDob(''); setGender(''); setNationalId(''); setPassport(''); setAddress('');
        setGuardianName(''); setGuardianContact('');
        setEmergencyName(''); setEmergencyRelationship(''); setEmergencyContact('');
        setPreviousSchool(''); setQualifications(''); setMedicalHistory('');
        setSelectedIntake(''); setSelectedYear(''); setSelectedSemester('');
    };
    
    const handleSubRoleChange = (subRoleId: string, setIds: React.Dispatch<React.SetStateAction<string[]>>) => {
        setIds(prev => prev.includes(subRoleId) ? prev.filter(id => id !== subRoleId) : [...prev, subRoleId]);
    };
    
    React.useEffect(() => {
        if (role === 'student' && manualId) {
            const matchedIntake = allIntakes.find(intake => manualId.startsWith(intake.name));
            if (matchedIntake) {
                setSelectedIntake(matchedIntake.id);
            }
        }
    }, [manualId, role, allIntakes]);
    
    // Update available years when intake changes
    React.useEffect(() => {
        if (!selectedIntake) {
            setAvailableYears([]);
            setSelectedYear('');
            return;
        }
        const intakeName = allIntakes.find(i => i.id === selectedIntake)?.name;
        if (!intakeName) return;

        const years = new Set(allSemesters.filter(s => s.name.startsWith(intakeName)).map(s => s.year));
        setAvailableYears(Array.from(years).sort());
        setSelectedYear('');
    }, [selectedIntake, allSemesters, allIntakes]);

    // Update available semesters when year changes
    React.useEffect(() => {
        if (!selectedIntake || !selectedYear) {
            setAvailableSemesters([]);
            setSelectedSemester('');
            return;
        }
        const intakeName = allIntakes.find(i => i.id === selectedIntake)?.name;
        if (!intakeName) return;
        
        const semesters = allSemesters.filter(s => s.name.startsWith(intakeName) && s.year === Number(selectedYear));
        setAvailableSemesters(semesters.sort((a, b) => a.semesterInYear - b.semesterInYear));
        setSelectedSemester('');
    }, [selectedYear, selectedIntake, allSemesters, allIntakes]);


    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name || !email || !password || !role) { toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all required fields.' }); return; }
        if (role === 'student' && (!programme || !selectedYear || !selectedIntake || !selectedSemester)) { toast({ variant: 'destructive', title: 'Missing Student Info', description: 'Please assign an intake, programme, year, and semester for the student.' }); return; }
        if (isManualId && !manualId.trim()) { toast({ variant: 'destructive', title: 'Manual ID cannot be empty.'}); return; }

        setLoading(true);
        
        const tempAppName = `temp-user-creation-${Date.now()}`;
        const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            let newId = '';
            const prefixes = idSettings || { student: 'STU', staff: 'STF', admin: 'ADM' };
            
            const isIdTaken = async (id: string) => {
                 const userQuery = query(ref(db, 'users'), orderByChild('id'), equalTo(id));
                 const snapshot = await get(userQuery);
                 return snapshot.exists();
            };

            if (isManualId) {
                newId = manualId.trim();
                if (await isIdTaken(newId)) {
                    toast({ variant: 'destructive', title: 'ID already exists', description: 'This User ID is already in use. Please choose another.' });
                    setLoading(false);
                    await deleteApp(tempApp);
                    return;
                }
            } else {
                const counterRef = ref(db, `userCounters/${role}`);
                let isUniqueIdFound = false;

                while (!isUniqueIdFound) {
                    await runTransaction(counterRef, (currentCount) => {
                        const count = (currentCount || 0) + 1;
                        const basePrefix = role === 'student' ? prefixes.student : role === 'staff' ? prefixes.staff : prefixes.admin;
                        let datePart = '';
                        const now = new Date();
                        if(idSettings.includeYear) datePart += format(now, 'yy');
                        if(idSettings.includeMonth) datePart += format(now, 'MM');
                        newId = `${basePrefix}${datePart}${String(count).padStart(3, '0')}`;
                        return count;
                    });

                    if (!(await isIdTaken(newId))) {
                        isUniqueIdFound = true;
                    }
                }
            }
            

            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const user = userCredential.user;
            
            const newUserRole = role.charAt(0).toUpperCase() + role.slice(1);
            const newUser: Omit<User, 'uid'> = { 
                id: newId, name, email, phoneNumber, role: newUserRole, status: 'active'
            };
            
            if (role === 'student') {
                Object.assign(newUser, {
                    programmeId: programme, year: Number(selectedYear), semesterId: selectedSemester, intakeId: selectedIntake,
                    dob, gender, nationalId, passport, address, medicalHistory,
                    guardian: { name: guardianName, contact: guardianContact },
                    emergencyContact: { name: emergencyName, relationship: emergencyRelationship, contact: emergencyContact },
                    educationBackground: { school: previousSchool, qualifications }
                });
                if(isTransfer && Object.keys(exemptedCourses).length > 0) newUser.exemptedCourses = exemptedCourses;
            } else if (role === 'staff') {
                 if (subRoleIds.length > 0) newUser.subRoles = subRoleIds;
            }


            await set(ref(db, `users/${user.uid}`), newUser);
            await set(ref(db, `userRoles/${user.uid}`), { role: role });
            const activityRef = push(ref(db, 'recentActivities'));
            await set(activityRef, { user: adminProfile?.name || 'Admin', userId: adminProfile?.id || 'N/A', action: `created a new ${newUser.role} account for '${name}' (**${newId}**).`, timestamp: serverTimestamp() });
            
            const welcomeEmailBody = `
                <h2>Welcome to ${idSettings.name || 'Edutrack360'}!</h2>
                <p>An account has been created for you. You can now access the portal using the credentials below.</p>
                <ul>
                    <li><strong>Portal Link:</strong> <a href="https://studio--edutrack360-copy.us-central1.hosted.app/">https://studio--edutrack360-copy.us-central1.hosted.app/</a></li>
                    <li><strong>User ID:</strong> ${newId}</li>
                    <li><strong>Password:</strong> ${password}</li>
                </ul>
                <p>We recommend you log in and change your password at your earliest convenience.</p>
                <p>Best regards,<br/>The Administration</p>
            `;

            await sendEmail({
                to: [email],
                subject: `Welcome! Your Account Credentials`,
                body: welcomeEmailBody
            });

            toast({ variant: 'success', title: 'User Created Successfully', description: `${name} has been created with User ID: ${newId} and an email has been sent.` });
            resetForm(); setOpen(false);
        } catch (error: any) {
            console.error("Error creating user:", error);
            toast({ variant: 'destructive', title: 'User Creation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            await deleteApp(tempApp); setLoading(false);
        }
    };

    const handleOpenEditDialog = (user: User) => {
        setEditingUser(user); 
        setEditName(user.name); 
        setEditRole(user.role); 
        
        let roleIds: string[] = [];
        if (Array.isArray(user.subRoles)) {
            roleIds = user.subRoles;
        } else if (typeof user.subRoles === 'object' && user.subRoles !== null) {
            // Handle Firebase's object-with-numeric-keys-for-arrays issue
            roleIds = Object.values(user.subRoles);
        }
        setEditSubRoleIds(roleIds);

        setEditProgramme(user.programmeId || '');
        setEditIntake(user.intakeId || '');
        setIsEditOpen(true);
    };
    
    const handleToggleUserStatus = async (user: User) => {
        const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
        const disabling = newStatus === 'disabled';
        if (!window.confirm(`Are you sure you want to ${disabling ? 'disable' : 'enable'} this user? ${disabling ? 'They will be logged out immediately.' : ''}`)) return;
        setTableLoading(true);
        try {
            await updateUserStatus({ uid: user.uid, disabled: disabling });
            toast({ variant: 'success', title: 'User Status Updated', description: `${user.name} has been ${disabling ? 'disabled' : 'enabled'}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: `Failed to ${disabling ? 'disable' : 'enable'} user.` });
        } finally {
             setTableLoading(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser || !editName || !editRole) { toast({ variant: 'destructive', title: 'Missing Fields' }); return; }
        setLoading(true);
        try {
            const userRef = ref(db, `users/${editingUser.uid}`);
            const updatedUserData: Partial<User> = { name: editName, role: editRole };
             if (editRole === 'Staff') {
                updatedUserData.subRoles = editSubRoleIds;
             }
             if (editRole === 'Student') {
                updatedUserData.intakeId = editIntake;
                updatedUserData.programmeId = editProgramme;
             }

            await update(userRef, updatedUserData);
            await set(ref(db, `userRoles/${editingUser.uid}`), { role: editRole.toLowerCase() });
            let action = `updated the profile for '${editName}' (**${editingUser.id}**).`;
            const changes = [];
            if(editingUser.name !== editName) changes.push(`Name changed to '${editName}'`);
            if(editingUser.role !== editRole) changes.push(`Role changed from ${editingUser.role} to ${editRole}`);
            if(JSON.stringify(editingUser.subRoles || []) !== JSON.stringify(editSubRoleIds)) changes.push(`Sub-roles changed`);
            if (editRole === 'Student') {
                 if (editingUser.intakeId !== editIntake) changes.push(`Intake updated`);
                 if (editingUser.programmeId !== editProgramme) changes.push(`Programme updated`);
            }
            if(changes.length > 0) action += ` Details: ${changes.join('. ')}.`;
            const activityRef = push(ref(db, 'recentActivities'));
            await set(activityRef, { user: adminProfile?.name || 'Admin', userId: adminProfile?.id || 'N/A', action, timestamp: serverTimestamp() });
            toast({ variant: 'success', title: 'User Updated Successfully', description: `${editName}'s profile has been updated.` });
            setIsEditOpen(false); setEditingUser(null);
        } catch (error: any) {
             console.error("Error updating user:", error);
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setLoading(false); }
    };

    const handleDownloadInvoice = async (userId: string) => {
        try {
            const invoicesRef = ref(db, `invoices/${userId}`);
            const snapshot = await get(invoicesRef);
            if (!snapshot.exists()) {
                toast({ variant: 'destructive', title: 'No Invoices', description: 'This student has no invoices on record.' });
                return;
            }
            const invoices = snapshot.val();
            // Get the last invoice
            const latestInvoice = Object.values(invoices).sort((a: any, b: any) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())[0] as any;
            
            if (latestInvoice) {
                 toast({ title: 'Invoice Found', description: `Generating PDF for invoice ID: ${latestInvoice.invoiceId}` });
            } else {
                 toast({ variant: 'destructive', title: 'No Invoices Found'});
            }

        } catch(e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch invoices.'});
        }
    }
    
    const handleExemptionChange = (courseId: string) => {
        setExemptedCourses(prev => {
            const newExemptions = { ...prev };
            if (newExemptions[courseId]) delete newExemptions[courseId]; else newExemptions[courseId] = true;
            return newExemptions;
        });
    }
    
    const handlePasswordReset = async (email: string) => {
        if (!window.confirm(`Are you sure you want to send a password reset link to ${email}?`)) return;
        setTableLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            toast({ title: 'Password Reset Email Sent', description: `Instructions have been sent to ${email}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send Email', description: error.message });
        } finally {
            setTableLoading(false);
        }
    };


    const handleSendMessage = async () => {
        if (!messagingUser || !messageSubject || !messageBody || !adminProfile) {
            toast({ variant: 'destructive', title: 'Subject and message are required.'});
            return;
        }
        setSendingMessage(true);
        try {
            const emailBody = `
                <p>You have received a message from ${adminProfile.name} (${adminProfile.id}):</p>
                <br/>
                <p>${messageBody.replace(/\n/g, '<br>')}</p>
            `;

            await sendEmail({
                to: [messagingUser.email],
                subject: messageSubject,
                body: emailBody,
                log: true,
                userIds: [messagingUser.uid]
            });
            
            const notificationLink = messagingUser.role === 'Student' ? '/student/dashboard' : '/staff/dashboard';
            await createNotification(messagingUser.uid, `You have a new message from the admin: ${messageSubject}`, notificationLink);
            
            toast({ title: 'Message Sent', description: `Your message has been sent to ${messagingUser.name}.` });
            setIsMessageOpen(false);
            setMessageBody('');
            setMessageSubject('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send', description: error.message });
        } finally {
            setSendingMessage(false);
        }
    };
    
    const handleOpenBulkEmail = () => {
        const portalUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-app-url.com';
        setBulkEmailSubject(`Portal Access Link - ${idSettings?.name || 'Edutrack360'}`);
        setBulkEmailBody(`
Hello,

This is a reminder that you can access your student or staff portal using the link below. If you have forgotten your password, you can use the "Forgot Password" link on the login page.

Portal Link: ${portalUrl}

Best regards,
The Administration
        `.trim());
        setIsBulkEmailOpen(true);
    };

    const handleSendBulkEmail = async () => {
        if (!bulkEmailSubject.trim() || !bulkEmailBody.trim()) {
            toast({ variant: 'destructive', title: 'Subject and Body are required.'});
            return;
        }
        if (!window.confirm(`This will send an email to all ${users.length} users in the database. Are you sure you want to proceed?`)) {
            return;
        }
        setSendingBulkEmail(true);
        try {
            const recipientEmails = users.map(u => u.email).filter(Boolean);
            if(recipientEmails.length === 0) {
                toast({variant: 'destructive', title: 'No users with emails found.'});
                return;
            }

            const result = await sendEmail({ to: recipientEmails, subject: bulkEmailSubject, body: bulkEmailBody });
            toast({ title: 'Emails Sent', description: result.result });
            setIsBulkEmailOpen(false);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send Bulk Email', description: error.message });
        } finally {
            setSendingBulkEmail(false);
        }
    };


    const filteredUsers = React.useMemo(() => {
        return users.filter(user => {
            const query = searchQuery.toLowerCase();
            const roleMatch = roleFilter.toLowerCase() === 'all' || (user.role || '').toLowerCase() === roleFilter.toLowerCase();
            const searchMatch = (user.name || '').toLowerCase().includes(query) || 
                                (user.id || '').toLowerCase().includes(query) || 
                                (user.email || '').toLowerCase().includes(query);
            return roleMatch && searchMatch;
        });
    }, [users, roleFilter, searchQuery]);
    
    const coursesForSelectedProgramme = React.useMemo(() => {
        if (!programme) return [];
        const prog = allProgrammes.find(p => p.id === programme);
        if (!prog || !prog.courseIds) return [];
        return allCourses.filter(c => prog.courseIds![c.id]);
    }, [programme, allProgrammes, allCourses]);

    const handlePrint = async () => {
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Users Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Filter: ${roleFilter}`, 14, 30);
        
        const tableColumn = ["ID", "Name", "Email", "Role", "Programme"];
        const tableRows = filteredUsers.map(user => [
            user.id,
            user.name,
            user.email,
            user.role,
            user.programmeName || 'N/A'
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35
        });
        
        doc.save(`users_report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handlePastePrefix = () => {
        if (!role) {
            toast({ variant: 'destructive', title: 'Select a Role', description: 'Please select a role first to get its prefix.' });
            return;
        }
        const prefixes = idSettings || { student: 'STU', staff: 'STF', admin: 'ADM' };
        const basePrefix = role === 'student' ? prefixes.student : role === 'staff' ? prefixes.staff : prefixes.admin;
        
        let datePart = '';
        const now = new Date();
        if(idSettings.includeYear) datePart += format(now, 'yy');
        if(idSettings.includeMonth) datePart += format(now, 'MM');
        setManualId(`${basePrefix}${datePart}`);
    };


  return (
    <>
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="font-headline text-2xl">User Management</CardTitle><CardDescription>Create, view, and manage all users in the system.</CardDescription></div>
            <div className='flex gap-2'>
                <Button variant="outline" onClick={handleOpenBulkEmail} disabled={sendingBulkEmail}>
                    {sendingBulkEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4"/>}
                    Send Link to All
                </Button>
                <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add User</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-4xl">
                        <form onSubmit={handleCreateUser}>
                            <DialogHeader>
                                <DialogTitle className="font-headline">Create New User</DialogTitle>
                                <DialogDescription>Fill in the user's details below. An ID will be generated unless you provide one.</DialogDescription>
                            </DialogHeader>
                             <div className="grid max-h-[70vh] gap-6 overflow-y-auto p-1 py-4">
                                <div className="space-y-1"><Label>Role</Label><Select onValueChange={setRole} value={role} disabled={loading}><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>

                                <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full">
                                    <AccordionItem value="item-1">
                                        <AccordionTrigger className="text-lg font-semibold">Basic Information</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>User ID</Label>
                                                    <div className="flex items-center space-x-2">
                                                        <Switch id="manual-id-switch" checked={isManualId} onCheckedChange={setIsManualId} />
                                                        <Label htmlFor="manual-id-switch">{isManualId ? 'Manual ID' : 'Auto-generate ID'}</Label>
                                                    </div>
                                                    {isManualId && <div className="flex gap-2">
                                                        <Input placeholder="Enter custom User ID" value={manualId} onChange={(e) => setManualId(e.target.value)} />
                                                        <Button type="button" variant="outline" size="icon" onClick={handlePastePrefix} title="Paste current prefix"><Copy className="h-4 w-4"/></Button>
                                                        </div>
                                                    }
                                                </div>
                                                <div className="space-y-1"><Label>Full Name</Label><Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading}/></div>
                                                <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading}/></div>
                                                <div className="space-y-1"><Label>Phone Number (Optional)</Label><Input type="tel" placeholder="+260 977 123456" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} disabled={loading}/></div>
                                                <div className="space-y-1"><Label>Initial Password</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading}/></div>
                                                <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} disabled={loading}/></div>
                                                <div className="space-y-1"><Label>Gender</Label><Select onValueChange={setGender} value={gender} disabled={loading}><SelectTrigger><SelectValue placeholder="Select gender"/></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select></div>
                                                <div className="space-y-1"><Label>National ID</Label><Input placeholder="e.g., 123456/78/9" value={nationalId} onChange={e => setNationalId(e.target.value)} disabled={loading}/></div>
                                                <div className="space-y-1"><Label>Passport Number (Optional)</Label><Input placeholder="e.g., ZA12345" value={passport} onChange={e => setPassport(e.target.value)} disabled={loading}/></div>
                                            </div>
                                            <div className="space-y-1"><Label>Address</Label><Textarea placeholder="Residential Address" value={address} onChange={e => setAddress(e.target.value)} disabled={loading}/></div>
                                        </AccordionContent>
                                    </AccordionItem>
                                    {role !== 'admin' && (
                                    <AccordionItem value="item-2">
                                        <AccordionTrigger className="text-lg font-semibold">{role === 'staff' ? 'Role Information' : 'Academic Information'}</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            {role === 'staff' && (<div className="space-y-2 rounded-md border p-3">
                                                <Label>Sub-Roles</Label>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                        {availableSubRoles.map(subRoleItem => (<div key={subRoleItem.id} className="flex items-center gap-2"><Checkbox id={`create-${subRoleItem.id}`} checked={subRoleIds.includes(subRoleItem.id)} onCheckedChange={() => handleSubRoleChange(subRoleItem.id, setSubRoleIds)} disabled={loading}/><Label htmlFor={`create-${subRoleItem.id}`} className="font-normal">{subRoleItem.name}</Label></div>))}
                                                    </div>
                                            </div>)}
                                            {role === 'student' && (<div className="space-y-4 rounded-md border p-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1"><Label>Programme</Label><Select onValueChange={setProgramme} value={programme} disabled={loading}><SelectTrigger><SelectValue placeholder="Select a programme" /></SelectTrigger><SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                                    <div className="space-y-1"><Label>Intake</Label><Select onValueChange={setSelectedIntake} value={selectedIntake} disabled={loading}><SelectTrigger><SelectValue placeholder="Select an intake" /></SelectTrigger><SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                                    <div className="space-y-1"><Label>Year of Study</Label><Select onValueChange={setSelectedYear} value={selectedYear} disabled={loading || !selectedIntake}><SelectTrigger><SelectValue placeholder="Select year..."/></SelectTrigger><SelectContent>{availableYears.map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                                                    <div className="space-y-1"><Label>Current Semester</Label><Select onValueChange={setSelectedSemester} value={selectedSemester} disabled={loading || !selectedYear}><SelectTrigger><SelectValue placeholder="Select semester..."/></SelectTrigger><SelectContent>{availableSemesters.map(s => <SelectItem key={s.id} value={s.id}>Semester {s.semesterInYear}</SelectItem>)}</SelectContent></Select></div>
                                                </div>
                                                <div className="flex items-center space-x-2 pt-2"><Checkbox id="isTransfer" checked={isTransfer} onCheckedChange={(checked) => setIsTransfer(checked as boolean)} disabled={loading}/><Label htmlFor="isTransfer">This is a transfer student (grant course exemptions)</Label></div>
                                                {isTransfer && (<Accordion type="single" collapsible className="w-full"><AccordionItem value="exemptions"><AccordionTrigger>Course Exemptions</AccordionTrigger><AccordionContent>{coursesForSelectedProgramme.length > 0 ? coursesForSelectedProgramme.map(course => (<div key={course.id} className="flex items-center gap-2"><Checkbox id={`exempt-${course.id}`} checked={!!exemptedCourses[course.id]} onCheckedChange={() => handleExemptionChange(course.id)}/><Label htmlFor={`exempt-${course.id}`} className="font-normal">{course.name} ({course.code})</Label></div>)) : <p className="text-sm text-muted-foreground">Select a programme to see courses.</p>}</AccordionContent></AccordionItem></Accordion>)}
                                            </div>)}
                                        </AccordionContent>
                                    </AccordionItem>
                                     )}
                                     {role === 'student' && (<AccordionItem value="item-3">
                                        <AccordionTrigger className="text-lg font-semibold">Other Details</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2 rounded-md border p-3"><Label>Parent/Guardian</Label><div className="space-y-2 pt-1"><Input placeholder="Full Name" value={guardianName} onChange={e => setGuardianName(e.target.value)} /><Input placeholder="Contact Number" value={guardianContact} onChange={e => setGuardianContact(e.target.value)} /></div></div>
                                                <div className="space-y-2 rounded-md border p-3"><Label>Emergency Contact</Label><div className="space-y-2 pt-1"><Input placeholder="Full Name" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} /><Input placeholder="Relationship" value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} /><Input placeholder="Contact Number" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} /></div></div>
                                            </div>
                                            <div className="space-y-2 rounded-md border p-3"><Label>Education Background</Label><div className="space-y-2 pt-1"><Input placeholder="Previous School" value={previousSchool} onChange={e => setPreviousSchool(e.target.value)} /><Textarea placeholder="Qualifications / Certificates" value={qualifications} onChange={e => setQualifications(e.target.value)} /></div></div>
                                            <div className="space-y-2 rounded-md border p-3"><Label>Medical History &amp; Special Needs</Label><Textarea placeholder="e.g., Allergies, disabilities, etc." value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} /></div>
                                        </AccordionContent>
                                    </AccordionItem>)}
                                </Accordion>
                            </div>
                            <DialogFooter><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create User'}</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, ID, or email..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <Tabs value={roleFilter} onValueChange={setRoleFilter}><TabsList><TabsTrigger value="All">All</TabsTrigger><TabsTrigger value="Admin">Admin</TabsTrigger><TabsTrigger value="Staff">Staff</TabsTrigger><TabsTrigger value="Student">Student</TabsTrigger></TabsList></Tabs>
        </div>
      </CardHeader>
      <CardContent><Table><TableHeader><TableRow><TableHead>User ID</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Programme</TableHead><TableHead>Online Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {tableLoading ? ( Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>))
            ) : filteredUsers.map((user) => (
              <TableRow key={user.uid} className={cn(user.status === 'disabled' && 'bg-muted/50 opacity-60')}>
                <TableCell className="font-medium">{user.id}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell><div className='flex gap-2 items-center'><Badge variant={roleVariant[user.role] || 'outline'}>{user.role} {user.subRoleNames && user.subRoleNames.length > 0 && `(${user.subRoleNames.join(', ')})`}</Badge>{user.status === 'disabled' && <Badge variant="destructive">Disabled</Badge>}</div></TableCell>
                <TableCell>{user.programmeName || 'N/A'}</TableCell>
                <TableCell>
                    {user.isOnline ? 
                        <span className="flex items-center gap-2 text-xs text-green-600 font-semibold"><div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"/>Online</span> : 
                        <span className="text-xs text-muted-foreground">{user.lastSeen ? formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true }) : 'Offline'}</span>}
                </TableCell>
                <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { setMessagingUser(user); setIsMessageOpen(true); }}><Send className="mr-2 h-4 w-4"/>Send Message</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEditDialog(user)}><Pencil className="mr-2 h-4 w-4"/>Edit Profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePasswordReset(user.email)}><Mail className="mr-2 h-4 w-4"/>Send Password Reset</DropdownMenuItem>
                            {user.role === 'Student' && (
                                <DropdownMenuItem onClick={() => handleDownloadInvoice(user.uid)}>
                                    <Download className="mr-2 h-4 w-4"/>Download Last Invoice
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {user.status === 'disabled' ? (
                                <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                                    <UserCheck className="mr-2 h-4 w-4"/>Enable User
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleToggleUserStatus(user)}>
                                    <UserX className="mr-2 h-4 w-4"/>Disable User
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
             {!tableLoading && filteredUsers.length === 0 && (<TableRow><TableCell colSpan={7} className="h-24 text-center">No users found.</TableCell></TableRow>)}
          </TableBody>
        </Table></CardContent>
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent className="sm:max-w-[425px]">
             <form onSubmit={handleUpdateUser}><DialogHeader><DialogTitle className="font-headline">Edit User Profile</DialogTitle><DialogDescription>Update the user's details below. Email and User ID cannot be changed.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-id" className="text-right">User ID</Label><Input id="edit-id" value={editingUser?.id || ''} className="col-span-3" disabled /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-email" className="text-right">Email</Label><Input id="edit-email" value={editingUser?.email || ''} className="col-span-3" disabled /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-name" className="text-right">Name</Label><Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} className="col-span-3" disabled={loading}/></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-role" className="text-right">Role</Label><Select onValueChange={setEditRole} value={editRole} disabled={loading}><SelectTrigger className="col-span-3"><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent><SelectItem value="Student">Student</SelectItem><SelectItem value="Staff">Staff</SelectItem><SelectItem value="Admin">Admin</SelectItem></SelectContent></Select></div>
                    {editRole === 'Student' && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-intake" className="text-right">Intake</Label>
                                <Select onValueChange={setEditIntake} value={editIntake} disabled={loading}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Select an intake" /></SelectTrigger>
                                    <SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-programme" className="text-right">Programme</Label>
                                <Select onValueChange={setEditProgramme} value={editProgramme} disabled={loading}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a programme" /></SelectTrigger>
                                    <SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                    {editRole === 'Staff' && (
                    <>
                        <div className="grid grid-cols-4 items-start gap-4 pt-2"><Label className="text-right pt-2">Sub-Roles</Label><div className="col-span-3 space-y-2">{availableSubRoles.map(subRoleItem => (<div key={subRoleItem.id} className="flex items-center gap-2"><Checkbox id={`edit-${subRoleItem.id}`} checked={editSubRoleIds.includes(subRoleItem.id)} onCheckedChange={() => handleSubRoleChange(subRoleItem.id, setEditSubRoleIds)} disabled={loading}/><Label htmlFor={`edit-${subRoleItem.id}`} className="font-normal">{subRoleItem.name}</Label></div>))}</div></div>
                    </>
                    )}
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>Cancel</Button></DialogClose><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update User'}</Button></DialogFooter>
            </form></DialogContent>
        </Dialog>
        
        <Dialog open={isMessageOpen} onOpenChange={(open) => { if (!open) { setMessageBody(''); setMessageSubject(''); setMessagingUser(null); } setIsMessageOpen(open); }}>
             <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Send Message to {messagingUser?.name}</DialogTitle>
                    <DialogDescription>The message will be sent as an email and an in-app notification.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-1"><Label>Subject</Label><Input value={messageSubject} onChange={e => setMessageSubject(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Body</Label><Textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={8} /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsMessageOpen(false)}>Cancel</Button>
                    <Button onClick={handleSendMessage} disabled={sendingMessage}>{sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} Send</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isBulkEmailOpen} onOpenChange={setIsBulkEmailOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Send Bulk Email</DialogTitle>
                    <DialogDescription>Review and edit the content before sending an email to all users.</DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
                    <div className="space-y-1"><Label>Subject</Label><Input value={bulkEmailSubject} onChange={e => setBulkEmailSubject(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Body</Label><Textarea value={bulkEmailBody} onChange={e => setBulkEmailBody(e.target.value)} rows={10} /></div>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBulkEmailOpen(false)}>Cancel</Button>
                    <Button onClick={handleSendBulkEmail} disabled={sendingBulkEmail}>{sendingBulkEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} Send to All</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </Card>
    </>
  );
}

    

    