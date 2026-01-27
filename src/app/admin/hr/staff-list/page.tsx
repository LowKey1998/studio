
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { db, auth } from "@/lib/firebase";
import { ref, update, onValue } from 'firebase/database';
import { Search, Printer, User, Mail, Phone, Calendar, Send, Loader2, MoreVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sendEmail } from '@/ai/flows/send-email-flow';
import { createNotification } from '@/lib/firebase';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';

type Staff = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    department?: string;
    role?: string;
    subRoles?: string[]; // This will now hold IDs
    subRoleNames?: string[]; // This will be populated for display
};

type Department = {
    id: string;
    name: string;
};

type SubRole = {
    id: string;
    name: string;
};


export default function StaffListPage() {
    const { user: adminUser, userProfile: adminProfile } = useAuth();
    const [staff, setStaff] = React.useState<Staff[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    const [subRoles, setSubRoles] = React.useState<SubRole[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    // Filter states
    const [searchTerm, setSearchTerm] = React.useState('');
    const [departmentFilter, setDepartmentFilter] = React.useState('all');
    
    // Dialog states
    const [selectedStaff, setSelectedStaff] = React.useState<Staff | null>(null);
    const [isMessageOpen, setIsMessageOpen] = React.useState(false);
    const [messageSubject, setMessageSubject] = React.useState('');
    const [messageBody, setMessageBody] = React.useState('');
    const [sendingMessage, setSendingMessage] = React.useState(false);

    const fetchData = React.useCallback(async () => {
        setTableLoading(true);
        const usersRef = ref(db, 'users');
        const deptsRef = ref(db, 'settings/departments');
        const subRolesRef = ref(db, 'settings/subRoles');

        const unsubUsers = onValue(usersRef, (usersSnap) => {
            onValue(deptsRef, (deptsSnap) => {
                onValue(subRolesRef, (subRolesSnap) => {
                    const departmentsData = deptsSnap.exists() ? deptsSnap.val() : {};
                    setDepartments(Object.keys(departmentsData).map(id => ({ id, ...departmentsData[id] })));
                    
                    const subRolesData = subRolesSnap.exists() ? subRolesSnap.val() : {};
                    const subRolesList = Object.keys(subRolesData).map(id => ({ id, name: subRolesData[id].name }));
                    const subRolesMap = new Map(subRolesList.map(role => [role.id, role.name]));
                    setSubRoles(subRolesList);

                    const usersData = usersSnap.exists() ? usersSnap.val() : {};
                    const staffList: Staff[] = [];
                    for (const uid in usersData) {
                        if (usersData[uid].role === 'Staff' || usersData[uid].role === 'Admin') {
                            const userSubRoleIds = usersData[uid].subRoles || [];
                            const subRoleNames = userSubRoleIds.map((id: string) => subRolesMap.get(id) || 'Unknown Role').filter(Boolean);
                            
                            staffList.push({
                                uid,
                                ...usersData[uid],
                                subRoleNames: subRoleNames,
                            });
                        }
                    }
                    setStaff(staffList.sort((a,b) => a.name.localeCompare(b.name)));
                    setLoading(false);
                    setTableLoading(false);
                });
            });
        });

        return () => {
            unsubUsers();
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const filteredStaff = React.useMemo(() => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        return staff.filter(member => {
            const searchMatch = !searchTerm ||
                member.name.toLowerCase().includes(lowerCaseSearch) ||
                member.id.toLowerCase().includes(lowerCaseSearch) ||
                member.email.toLowerCase().includes(lowerCaseSearch);

            const departmentMatch = departmentFilter === 'all' || member.department === departmentFilter;
            
            return searchMatch && departmentMatch;
        });
    }, [staff, searchTerm, departmentFilter]);
    
    const handlePrint = async () => {
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Staff List Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Filters: Department - ${departments.find(p=>p.name === departmentFilter)?.name || 'All'}`, 14, 30);
        
        const tableColumn = ["ID", "Name", "Email", "Phone", "Department", "Roles"];
        const tableRows = filteredStaff.map(s => [
            s.id,
            s.name,
            s.email,
            s.phoneNumber || 'N/A',
            s.department || 'N/A',
            s.subRoleNames?.join(', ') || s.role || 'Staff',
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35
        });
        
        doc.save(`staff_list_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleAssignDepartment = async (staffUid: string, departmentName: string) => {
        try {
            await update(ref(db, `users/${staffUid}`), { department: departmentName });
            toast({ title: "Department Assigned", description: "The staff member's department has been updated." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Assignment Failed" });
        }
    };
    
    const handleSendMessage = async () => {
        if (!selectedStaff || !messageSubject || !messageBody || !adminProfile) {
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
                to: [selectedStaff.email],
                subject: messageSubject,
                body: emailBody,
                log: true,
                userIds: [selectedStaff.uid]
            });
            await createNotification(selectedStaff.uid, `You have a new message from the admin: ${messageSubject}`, '/staff/dashboard');
            toast({ title: 'Message Sent', description: `Your message has been sent to ${selectedStaff.name}.` });
            setIsMessageOpen(false);
            setMessageBody('');
            setMessageSubject('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send', description: error.message });
        } finally {
            setSendingMessage(false);
        }
    };

    const handleSendCredentials = async (user: Staff) => {
        if (!user) return;
        setTableLoading(true);
        try {
            const body = `
                <h2>Login Details Reminder</h2>
                <p>Hello ${user.name},</p>
                <p>Here are your login details for the staff portal:</p>
                <ul>
                    <li><strong>Portal Link:</strong> <a href="https://studio--edutrack360-copy.us-central1.hosted.app/">https://studio--edutrack360-copy.us-central1.hosted.app/</a></li>
                    <li><strong>User ID:</strong> ${user.id}</li>
                </ul>
                <p>If you have forgotten your password, you can use the "Forgot Password" link on the login page to reset it.</p>
                <p>Best regards,<br/>The Administration</p>
            `;

            await sendEmail({
                to: [user.email],
                subject: 'Your Portal Login Details',
                body,
            });
            toast({ title: 'Credentials Sent', description: `An email with login details has been sent to ${user.name}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send Email', description: error.message });
        } finally {
            setTableLoading(false);
        }
    };

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><User /> Staff List</CardTitle>
                <CardDescription>View, filter, and manage staff members in the system.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4 p-4 border rounded-lg">
                    <div className="flex-grow">
                        <Label htmlFor="search">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search"
                                placeholder="Search by name, ID, or email..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                         <Label htmlFor="department-filter">Department</Label>
                         <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger id="department-filter"><SelectValue placeholder="Filter by department..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="self-end">
                        <Button onClick={handlePrint} disabled={filteredStaff.length === 0}><Printer className="mr-2 h-4 w-4"/> Print List</Button>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Staff ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email & Phone</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading || tableLoading ? (
                             Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            ))
                        ) : filteredStaff.length > 0 ? (
                            filteredStaff.map(member => (
                            <TableRow key={member.uid}>
                                <TableCell>{member.id}</TableCell>
                                <TableCell className="font-medium">{member.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-sm"><Mail className="h-3 w-3 text-muted-foreground"/>{member.email}</div>
                                    {member.phoneNumber && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3 w-3"/>{member.phoneNumber}</div>}
                                </TableCell>
                                <TableCell>
                                    <Select value={member.department || ''} onValueChange={(value) => handleAssignDepartment(member.uid, value)} onClick={(e) => e.stopPropagation()}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Assign..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map(dept => (
                                                <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{member.subRoleNames?.join(', ') || member.role}</TableCell>
                                 <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setSelectedStaff(member); setIsMessageOpen(true); }}><Send className="mr-2 h-4 w-4"/>Send Message</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleSendCredentials(member)}><Mail className="mr-2 h-4 w-4"/>Send Credentials</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No staff found matching your criteria.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                <div className="text-xs text-muted-foreground">
                    Showing <strong>{filteredStaff.length}</strong> of <strong>{staff.length}</strong> staff members.
                </div>
            </CardFooter>
        </Card>
        
        <Dialog open={isMessageOpen} onOpenChange={(open) => { if (!open) { setMessageBody(''); setMessageSubject(''); setSelectedStaff(null); } setIsMessageOpen(open); }}>
             <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Send Message to {selectedStaff?.name}</DialogTitle>
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
        </>
    );
}
