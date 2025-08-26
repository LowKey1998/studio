
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { ref, get } from 'firebase/database';
import { Search, Printer, User, Mail, Phone } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Staff = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    department?: string;
    role?: string;
    subRoles?: string[];
};

type Department = {
    id: string;
    name: string;
};

export default function StaffListPage() {
    const [staff, setStaff] = React.useState<Staff[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Filter states
    const [searchTerm, setSearchTerm] = React.useState('');
    const [departmentFilter, setDepartmentFilter] = React.useState('all');

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersSnap, departmentsSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'settings/departments'))
                ]);

                const departmentsData = departmentsSnap.exists() ? departmentsSnap.val() : {};
                setDepartments(Object.keys(departmentsData).map(id => ({ id, ...departmentsData[id] })));
                
                const usersData = usersSnap.exists() ? usersSnap.val() : {};
                const staffList: Staff[] = [];
                for (const uid in usersData) {
                    if (usersData[uid].role === 'Staff' || usersData[uid].role === 'Admin') {
                        staffList.push({
                            uid,
                            ...usersData[uid],
                        });
                    }
                }
                setStaff(staffList.sort((a,b) => a.name.localeCompare(b.name)));

            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);
    
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
    
    const handlePrint = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Staff List Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Filters: Department - ${departments.find(p=>p.id === departmentFilter)?.name || 'All'}`, 14, 30);
        
        const tableColumn = ["ID", "Name", "Email", "Phone", "Department", "Roles"];
        const tableRows = filteredStaff.map(s => [
            s.id,
            s.name,
            s.email,
            s.phoneNumber || 'N/A',
            s.department || 'N/A',
            s.subRoles?.join(', ') || s.role || 'Staff',
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35
        });
        
        doc.save(`staff_list_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><User /> Staff List</CardTitle>
                <CardDescription>View, filter, and print lists of all staff members in the system.</CardDescription>
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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
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
                                <TableCell>{member.department || 'N/A'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{member.subRoles?.join(', ') || member.role}</TableCell>
                            </TableRow>
                        ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">No staff found matching your criteria.</TableCell>
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
    );
}
