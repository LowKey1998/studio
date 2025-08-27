
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

type Project = {
    id: string;
    title: string;
    submittedByName: string;
    prototypeUrl?: string;
    prototypeType?: 'image' | 'link';
};

export default function PrototypeShowcasePage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const projectsRef = ref(db, 'innovationProjects');
        const unsubscribe = onValue(projectsRef, (snapshot) => {
            const prototypes: Project[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const id in data) {
                    if (data[id].prototypeUrl) {
                        prototypes.push({ id, ...data[id] });
                    }
                }
            }
            setProjects(prototypes);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-none">
                 <CardHeader>
                    <CardTitle>Prototype Showcase</CardTitle>
                    <CardDescription>A gallery of submitted student project prototypes.</CardDescription>
                </CardHeader>
            </Card>
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-80"/>) :
                 projects.map(proto => (
                    <Card key={proto.id}>
                        <CardContent className="p-0">
                             {proto.prototypeType === 'image' ? (
                                <Image src={proto.prototypeUrl!} alt={proto.title} width={600} height={400} className="rounded-t-lg object-cover aspect-video" data-ai-hint="prototype image"/>
                             ) : (
                                <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center p-4">
                                    <a href={proto.prototypeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold break-all text-center">
                                        <ExternalLink className="mx-auto mb-2"/>
                                        View Prototype
                                    </a>
                                </div>
                             )}
                         </CardContent>
                         <CardHeader>
                             <CardTitle>{proto.title}</CardTitle>
                            <CardDescription>by {proto.submittedByName}</CardDescription>
                         </CardHeader>
                    </Card>
                ))}
            </div>
        </div>
    );
}
