'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type Project = {
    id: string;
    title: string;
    submittedByName: string;
    mentorId?: string;
};

type Mentor = {
    uid: string;
    name: string;
};

export default function MentorshipMatchingPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [mentors, setMentors] = React.useState<Mentor[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'innovationProjects');
        const unsubProjects = onValue(projectsRef, (snapshot) => {
            const approvedProjects: Project[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const id in data) {
                    if (data[id].status === 'Approved') {
                        approvedProjects.push({ id, ...data[id] });
                    }
                }
            }
            setProjects(approvedProjects);
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const staffList: Mentor[] = [];
                for (const uid in usersData) {
                    if (usersData[uid].role === 'Staff' || usersData[uid].role === 'Admin') {
                        staffList.push({ uid, name: usersData[uid].name });
                    }
                }
                setMentors(staffList);
            }
        });

        return () => {
            unsubProjects();
            unsubUsers();
        };
    }, []);

    const handleAssignMentor = async (projectId: string, mentorId: string) => {
        try {
            await update(ref(db, `innovationProjects/${projectId}`), { mentorId });
            toast({ title: "Mentor Assigned" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Assignment Failed" });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mentorship Matching</CardTitle>
                <CardDescription>Assign industry or academic mentors to student innovators.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project / Startup</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Assigned Mentor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow> :
                         projects.map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.title}</TableCell>
                                <TableCell>{p.submittedByName}</TableCell>
                                <TableCell>
                                    <Select value={p.mentorId} onValueChange={(value) => handleAssignMentor(p.id, value)}>
                                        <SelectTrigger className="w-[280px]"><SelectValue placeholder="Assign a mentor..."/></SelectTrigger>
                                        <SelectContent>
                                            {mentors.map(mentor => <SelectItem key={mentor.uid} value={mentor.uid}>{mentor.name}</SelectItem>)}
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
