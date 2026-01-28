'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';

type Project = {
    id: string;
    title: string;
    description: string;
    status: 'Pending Review' | 'Approved' | 'Rejected';
    submittedById: string;
    submittedByName: string;
    submittedAt: string;
    pitchDeckUrl?: string;
    prototypeUrl?: string;
};

const statusOptions: Project['status'][] = ['Pending Review', 'Approved', 'Rejected'];

export default function ProjectSubmissionsPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'innovationProjects');
        const unsubscribe = onValue(projectsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setProjects(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setProjects([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleStatusChange = async (projectId: string, status: Project['status']) => {
        try {
            await update(ref(db, `innovationProjects/${projectId}`), { status });
            toast({ title: "Status Updated" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Update Failed" });
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Innovation Project Submissions</CardTitle>
                <CardDescription>Review and manage student submissions for innovation projects.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Title</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Assets</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow>
                        : projects.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map(project => (
                            <TableRow key={project.id}>
                                <TableCell className="font-medium">{project.title}</TableCell>
                                <TableCell>{project.submittedByName}</TableCell>
                                <TableCell>{format(new Date(project.submittedAt), 'PPP')}</TableCell>
                                <TableCell>
                                     <Select value={project.status} onValueChange={(value) => handleStatusChange(project.id, value as any)}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                     {project.pitchDeckUrl && (
                                        <Button asChild variant="outline" size="sm">
                                            <a href={project.pitchDeckUrl} target="_blank" rel="noopener noreferrer">Pitch Deck</a>
                                        </Button>
                                    )}
                                     {project.prototypeUrl && (
                                        <Button asChild variant="outline" size="sm">
                                            <a href={project.prototypeUrl} target="_blank" rel="noopener noreferrer">Prototype</a>
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
