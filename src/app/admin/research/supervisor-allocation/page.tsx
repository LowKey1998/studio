'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type ResearchProject = {
    id: string;
    title: string;
    leadResearcherName: string;
    supervisorId?: string;
};

type Staff = {
    uid: string;
    name: string;
};

export default function SupervisorAllocationPage() {
    const [projects, setProjects] = React.useState<ResearchProject[]>([]);
    const [staff, setStaff] = React.useState<Staff[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'researchProjects');
        const unsubProjects = onValue(projectsRef, (snapshot) => {
            setProjects(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const staffList: Staff[] = [];
                for (const uid in usersData) {
                    if (usersData[uid].role === 'Staff') {
                        staffList.push({ uid, name: usersData[uid].name });
                    }
                }
                setStaff(staffList);
            }
        });

        return () => {
            unsubProjects();
            unsubUsers();
        };
    }, []);

    const handleAssignSupervisor = async (projectId: string, supervisorId: string) => {
        try {
            await update(ref(db, `researchProjects/${projectId}`), { supervisorId });
            toast({ title: "Supervisor Assigned", description: "The project has been updated." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Assignment Failed" });
        }
    };

    const filteredProjects = projects.filter(project =>
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.leadResearcherName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Supervisor Allocation</CardTitle>
                <CardDescription>Assign supervisors to registered research projects.</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search projects by title or researcher..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Title</TableHead>
                            <TableHead>Lead Researcher</TableHead>
                            <TableHead>Assigned Supervisor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredProjects.map(project => (
                            <TableRow key={project.id}>
                                <TableCell>{project.title}</TableCell>
                                <TableCell>{project.leadResearcherName}</TableCell>
                                <TableCell>
                                    <Select
                                        value={project.supervisorId}
                                        onValueChange={(value) => handleAssignSupervisor(project.id, value)}
                                    >
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Assign a supervisor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {staff.map(s => (
                                                <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
