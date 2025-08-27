
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type Project = {
    id: string;
    title: string;
    submittedByName: string;
    submittedAt: string;
    pitchDeckUrl?: string;
};

export default function PitchDeckRepositoryPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'innovationProjects');
        const unsubscribe = onValue(projectsRef, (snapshot) => {
            const pitchDecks: Project[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const id in data) {
                    if (data[id].pitchDeckUrl) {
                        pitchDecks.push({ id, ...data[id] });
                    }
                }
            }
            setProjects(pitchDecks.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pitch Deck Repository</CardTitle>
                <CardDescription>A central place to store and review student pitch decks.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Title</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Date Uploaded</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         projects.map(deck => (
                            <TableRow key={deck.id}>
                                <TableCell>{deck.title}</TableCell>
                                <TableCell>{deck.submittedByName}</TableCell>
                                <TableCell>{format(new Date(deck.submittedAt), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm">
                                        <a href={deck.pitchDeckUrl} target="_blank" rel="noopener noreferrer">
                                            <Download className="mr-2 h-4 w-4"/>Download
                                        </a>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {!loading && projects.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No pitch decks submitted yet.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
